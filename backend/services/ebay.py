"""eBay Browse API でSold Listings（販売済み商品）を検索するサービス"""

import os
import base64
import httpx
from datetime import datetime

EBAY_APP_ID = os.getenv("EBAY_APP_ID", "")
EBAY_APP_SECRET = os.getenv("EBAY_APP_SECRET", "")
EBAY_ENV = os.getenv("EBAY_ENV", "production")  # "sandbox" or "production"

# エンドポイント
_ENDPOINTS = {
    "sandbox": {
        "auth": "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
        "search": "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search",
    },
    "production": {
        "auth": "https://api.ebay.com/identity/v1/oauth2/token",
        "search": "https://api.ebay.com/buy/browse/v1/item_summary/search",
    },
}

# ブランド別の検索キーワード補助
BRAND_SEARCH_TERMS = {
    "pokemon": "Pokemon TCG",
    "onepiece": "One Piece Card Game",
    "yugioh": "Yu-Gi-Oh",
    "dragonball_fw": "Dragon Ball Fusion World",
}

_access_token: str | None = None
_token_expires: float = 0


async def _get_access_token() -> str:
    """eBay OAuth2 Client Credentials でアクセストークンを取得"""
    global _access_token, _token_expires

    if _access_token and datetime.now().timestamp() < _token_expires:
        return _access_token

    if not EBAY_APP_ID or not EBAY_APP_SECRET:
        raise ValueError("EBAY_APP_ID / EBAY_APP_SECRET が設定されていません")

    env = _ENDPOINTS.get(EBAY_ENV, _ENDPOINTS["production"])
    credentials = base64.b64encode(f"{EBAY_APP_ID}:{EBAY_APP_SECRET}".encode()).decode()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            env["auth"],
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {credentials}",
            },
            data={
                "grant_type": "client_credentials",
                "scope": "https://api.ebay.com/oauth/api_scope",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        _access_token = data["access_token"]
        _token_expires = datetime.now().timestamp() + data.get("expires_in", 7200) - 60
        return _access_token


async def search_sold_items(query: str, brand: str = "", limit: int = 20) -> list[dict]:
    """
    eBay Browse API でSold/Completed商品を検索。

    Args:
        query: ユーザーが入力したカード名（例: "ナミ OP09-050 SR"）
        brand: ブランドID（例: "onepiece"）
        limit: 取得件数

    Returns:
        販売済み商品のリスト
    """
    try:
        token = await _get_access_token()
    except Exception:
        return []

    # 検索クエリを構築
    brand_term = BRAND_SEARCH_TERMS.get(brand, "")
    search_query = f"{brand_term} {query}".strip()

    env = _ENDPOINTS.get(EBAY_ENV, _ENDPOINTS["production"])

    params = {
        "q": search_query,
        "filter": "buyingOptions:{FIXED_PRICE|AUCTION},conditions:{NEW|LIKE_NEW|VERY_GOOD}",
        "sort": "-date",
        "limit": str(min(limit, 50)),
        "category_ids": "2536",  # Trading Cards カテゴリ
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                env["search"],
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
                    "Content-Type": "application/json",
                },
                params=params,
                timeout=15,
            )

            if resp.status_code != 200:
                return []

            data = resp.json()
            items = data.get("itemSummaries", [])

            results = []
            for item in items:
                price_info = item.get("price", {})
                price_val = float(price_info.get("value", 0))
                if price_val <= 0:
                    continue

                image = item.get("image", {})
                results.append({
                    "title": item.get("title", ""),
                    "price": price_val,
                    "currency": price_info.get("currency", "USD"),
                    "sold_date": item.get("itemEndDate", item.get("lastSoldDate", "")),
                    "image_url": image.get("imageUrl", ""),
                    "item_url": item.get("itemWebUrl", ""),
                    "condition": item.get("condition", ""),
                })

            return results

    except Exception:
        return []
