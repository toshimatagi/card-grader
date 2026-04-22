"""クローラー共通基盤

- レート制限付きHTTPクライアント
- User-Agent / Accept-Language 固定
- リトライ（簡易）
- スクレイパー抽象クラス
"""

from __future__ import annotations

import asyncio
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

import httpx

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 "
    "tcg-authority-bot/0.1 (+https://tcg-authority.com)"
)


@dataclass
class CrawledCard:
    """各スクレイパーが返す中間表現"""

    brand: str                     # 'onepiece'
    set_code: str                  # 'OP15' (正規化済み・大文字)
    card_no: str                   # '050' (3桁固定)
    variant: str                   # 'normal'|'parallel'|'super_parallel'|'manga'|'alt_art'|'other'
    rarity: str                    # 'C'|'UC'|'R'|'SR'|'SEC'|'L'|'SP'|'P'
    name_ja: str
    source: str                    # 'yuyutei' など
    source_card_id: str            # サイト固有ID（URL末尾など）
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    price_type: str = "sell"       # 'sell'|'buy'
    price: Optional[int] = None    # JPY
    stock_status: Optional[str] = None
    raw: dict = field(default_factory=dict)


class RateLimiter:
    """最低 interval_sec 秒ごとに1リクエスト許可する非同期セマフォ"""

    def __init__(self, interval_sec: float = 2.0, jitter_sec: float = 0.5):
        self.interval = interval_sec
        self.jitter = jitter_sec
        self._last = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self._lock:
            now = time.monotonic()
            gap = now - self._last
            sleep_for = max(0.0, self.interval - gap)
            if self.jitter > 0:
                sleep_for += random.uniform(0, self.jitter)
            if sleep_for > 0:
                await asyncio.sleep(sleep_for)
            self._last = time.monotonic()


class HttpSession:
    """httpx.AsyncClient + RateLimiter のラッパ"""

    def __init__(self, interval_sec: float = 2.0, timeout: float = 20.0):
        self.limiter = RateLimiter(interval_sec=interval_sec)
        self._client = httpx.AsyncClient(
            headers={
                "User-Agent": USER_AGENT,
                "Accept-Language": "ja,en;q=0.7",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            timeout=timeout,
            follow_redirects=True,
        )

    async def get(self, url: str, *, retries: int = 2) -> httpx.Response:
        last_exc: Optional[Exception] = None
        for attempt in range(retries + 1):
            await self.limiter.wait()
            try:
                resp = await self._client.get(url)
                if resp.status_code == 429:
                    # Retry-After 尊重 or backoff
                    retry_after = float(resp.headers.get("Retry-After", "10"))
                    await asyncio.sleep(min(retry_after, 60))
                    continue
                resp.raise_for_status()
                return resp
            except (httpx.RequestError, httpx.HTTPStatusError) as e:
                last_exc = e
                if attempt < retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
        assert last_exc is not None
        raise last_exc

    async def aclose(self) -> None:
        await self._client.aclose()


class BaseScraper(ABC):
    """全スクレイパーの共通インタフェース"""

    source: str = ""                      # 'yuyutei' など
    rate_interval: float = 2.0            # リクエスト間隔

    def __init__(self) -> None:
        self.http = HttpSession(interval_sec=self.rate_interval)

    @abstractmethod
    async def list_sets(self, brand: str) -> list[str]:
        """ブランドで扱うセットコード一覧を返す (例: ['OP01','OP02',...])"""

    @abstractmethod
    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        """1セット分のカードと現在価格を返す"""

    async def aclose(self) -> None:
        await self.http.aclose()
