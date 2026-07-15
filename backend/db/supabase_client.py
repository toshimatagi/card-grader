"""Supabase クライアント（REST API直接呼び出し）"""

import os
import uuid
import httpx
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
STORAGE_BUCKET = "card-images"


def _headers() -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _storage_headers(content_type: str = "image/jpeg") -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
    }


# ---------------------------------------------------------------------------
# DB 操作
# ---------------------------------------------------------------------------

async def insert_grading(grading_data: dict) -> dict:
    """鑑定結果をDBに保存"""
    payload = {
        "id": grading_data["id"],
        "overall_grade": grading_data["overall_grade"],
        "confidence": grading_data["confidence"],
        "card_type": grading_data["card_type"],
        "sub_grades": grading_data["sub_grades"],
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/gradings",
            headers=_headers(),
            json=payload,
            timeout=15,
        )
        res.raise_for_status()
        return res.json()[0]


async def get_grading(grading_id: str) -> dict | None:
    """鑑定結果をDBから取得"""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/gradings?id=eq.{grading_id}&select=*",
            headers=_headers(),
            timeout=10,
        )
        res.raise_for_status()
        rows = res.json()
        return rows[0] if rows else None


async def list_gradings(limit: int = 20, offset: int = 0) -> dict:
    """鑑定結果一覧を取得"""
    headers = _headers()
    headers["Prefer"] = "count=exact"
    headers["Range"] = f"{offset}-{offset + limit - 1}"

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/gradings?select=id,overall_grade,confidence,card_type,created_at&order=created_at.desc",
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()

        # Content-Range ヘッダーからtotalを取得
        content_range = res.headers.get("content-range", "")
        total = 0
        if "/" in content_range:
            total_str = content_range.split("/")[-1]
            total = int(total_str) if total_str != "*" else len(res.json())

        return {"total": total, "items": res.json()}


async def update_grading_centering(grading_id: str, manual_adjusted: dict) -> dict | None:
    """結果画面の手動センタリング確定値を gradings.sub_grades.centering.detail.manual_adjusted に保存。

    read-modify-write で既存 sub_grades にマージする（jsonb 全体を差し替え）。
    保存した値（saved_at 付き）を返す。対象が無ければ None。
    手動確定値は AI 測定との系統誤差を測る教師データなので、キャッシュと違い
    失敗は握りつぶさず呼び出し側で扱えるよう例外を伝播させる。
    """
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/gradings?id=eq.{grading_id}&select=sub_grades",
            headers=_headers(),
            timeout=10,
        )
        res.raise_for_status()
        rows = res.json()
        if not rows:
            return None

        sub_grades = rows[0].get("sub_grades") or {}
        centering = sub_grades.get("centering") or {}
        detail = centering.get("detail") or {}

        stored = dict(manual_adjusted)
        stored["saved_at"] = datetime.now(timezone.utc).isoformat()
        detail["manual_adjusted"] = stored
        centering["detail"] = detail
        sub_grades["centering"] = centering

        patch = await client.patch(
            f"{SUPABASE_URL}/rest/v1/gradings?id=eq.{grading_id}",
            headers=_headers(),
            json={"sub_grades": sub_grades},
            timeout=10,
        )
        patch.raise_for_status()
        return stored


async def delete_grading(grading_id: str) -> bool:
    """鑑定結果を削除（関連画像もCASCADEで削除）"""
    async with httpx.AsyncClient() as client:
        res = await client.delete(
            f"{SUPABASE_URL}/rest/v1/gradings?id=eq.{grading_id}",
            headers=_headers(),
            timeout=10,
        )
        return res.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Storage 操作
# ---------------------------------------------------------------------------

async def upload_image(image_bytes: bytes, grading_id: str, image_type: str) -> str:
    """画像をSupabase Storageにアップロードし、URLを返す"""
    file_name = f"{grading_id}/{image_type}.jpg"

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{file_name}",
            headers=_storage_headers(),
            content=image_bytes,
            timeout=30,
        )
        res.raise_for_status()

    # 公開URLを返す
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{file_name}"
    return public_url


async def save_grading_image(grading_id: str, image_type: str, storage_path: str) -> None:
    """画像のメタデータをDBに保存"""
    payload = {
        "grading_id": grading_id,
        "image_type": image_type,
        "storage_path": storage_path,
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/grading_images",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        res.raise_for_status()


async def get_grading_images(grading_id: str) -> list:
    """鑑定に紐づく画像URL一覧を取得"""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/grading_images?grading_id=eq.{grading_id}&select=image_type,storage_path",
            headers=_headers(),
            timeout=10,
        )
        res.raise_for_status()
        return res.json()


async def delete_grading_images(grading_id: str) -> None:
    """Storageから画像ファイルを削除"""
    images = await get_grading_images(grading_id)
    if not images:
        return

    async with httpx.AsyncClient() as client:
        # httpx の client.delete() はリクエストボディ (json=) を受け付けないため
        # client.request("DELETE", ...) を使う
        await client.request(
            "DELETE",
            f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}",
            headers=_headers(),
            json={"prefixes": [f"{grading_id}/"]},
            timeout=15,
        )


# ---------------------------------------------------------------------------
# AI センタリングキャッシュ（同期・ベストエフォート）
# ---------------------------------------------------------------------------
# grade_card() は同期関数（threadpool 上で実行）なので、ここだけ httpx.Client を使う。
# 照合/保存に失敗しても鑑定は止めない（キャッシュはあくまで再現性・費用対策）。

def get_centering_cache(phash_hex: str) -> dict | None:
    """pHash に対応する AI センタリング測定結果を取得。ヒットしなければ None。"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        with httpx.Client() as client:
            res = client.get(
                f"{SUPABASE_URL}/rest/v1/ai_centering_cache"
                f"?phash=eq.{phash_hex}&select=result",
                headers=_headers(),
                timeout=5,
            )
            res.raise_for_status()
            rows = res.json()
            return rows[0]["result"] if rows else None
    except Exception as e:  # noqa: BLE001 — キャッシュは素通し
        print(f"[cache] lookup failed (ignored): {e}")
        return None


def save_centering_cache(phash_hex: str, result: dict, model: str = "") -> None:
    """AI センタリング測定結果を pHash キーで upsert。失敗は無視。"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    try:
        payload = {"phash": phash_hex, "result": result, "model": model}
        headers = _headers()
        headers["Prefer"] = "resolution=merge-duplicates"
        with httpx.Client() as client:
            res = client.post(
                f"{SUPABASE_URL}/rest/v1/ai_centering_cache",
                headers=headers,
                json=payload,
                timeout=5,
            )
            res.raise_for_status()
    except Exception as e:  # noqa: BLE001 — キャッシュは素通し
        print(f"[cache] save failed (ignored): {e}")
