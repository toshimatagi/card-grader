"""Supabase クライアント（REST API直接呼び出し）"""

import os
import uuid
import httpx

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

    # ファイルパスのリストを作成
    paths = [img["storage_path"].split(f"/{STORAGE_BUCKET}/")[-1] for img in images]

    async with httpx.AsyncClient() as client:
        await client.delete(
            f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}",
            headers=_headers(),
            json={"prefixes": [f"{grading_id}/"]},
            timeout=15,
        )
