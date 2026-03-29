"""鑑定APIルーター（Supabase永続化対応）"""

import cv2
import numpy as np
import base64
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from ..services.grading import grade_card
from ..services.card_brands import brands_to_api_response
from ..services.ebay import search_sold_items
from ..db.supabase_client import (
    insert_grading,
    get_grading,
    list_gradings,
    delete_grading,
    upload_image,
    save_grading_image,
    get_grading_images,
    delete_grading_images,
)

router = APIRouter(prefix="/api/v1", tags=["grading"])


@router.get("/brands")
async def get_brands():
    """カードブランド・レアリティ一覧を返す"""
    return brands_to_api_response()


@router.post("/grade")
async def create_grade(
    front_image: UploadFile = File(...),
    back_image: Optional[UploadFile] = File(None),
    card_type: str = Form("standard"),
    brand: str = Form(""),
    rarity: str = Form(""),
):
    """カード鑑定を実行し、結果をDBに永続化する"""
    if front_image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "対応画像形式: JPEG, PNG, WebP")

    image_bytes = await front_image.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "画像サイズは20MB以下にしてください")

    if len(image_bytes) == 0:
        raise HTTPException(400, "画像データが空です")

    try:
        result = grade_card(image_bytes, card_type=card_type, brand=brand, rarity=rarity)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"鑑定処理中にエラーが発生しました: {str(e)}")

    # --- Supabase に保存 ---
    try:
        # 1. 鑑定結果をDBに保存
        await insert_grading(result)

        # 2. 画像をStorageにアップロード
        grading_id = result["id"]

        # 元画像（アップロードされたもの）
        original_url = await upload_image(image_bytes, grading_id, "original")
        await save_grading_image(grading_id, "original", original_url)

        # 正面化されたカード画像
        card_jpg = base64.b64decode(result["card_image"])
        card_url = await upload_image(card_jpg, grading_id, "card")
        await save_grading_image(grading_id, "card", card_url)

        # オーバーレイ画像
        for overlay_key, overlay_b64 in result.get("overlay_images", {}).items():
            if overlay_b64:
                overlay_jpg = base64.b64decode(overlay_b64)
                overlay_url = await upload_image(overlay_jpg, grading_id, overlay_key)
                await save_grading_image(grading_id, overlay_key, overlay_url)

    except Exception as e:
        # DB保存失敗してもレスポンスは返す（鑑定結果は取得済み）
        print(f"[WARN] DB保存失敗: {e}")

    return result


@router.get("/grade/{grade_id}")
async def get_grade(grade_id: str):
    """鑑定結果を取得する（DB + Storage URL）"""
    grading = await get_grading(grade_id)
    if not grading:
        raise HTTPException(404, "鑑定結果が見つかりません")

    # 画像URLを取得
    images = await get_grading_images(grade_id)
    image_map = {img["image_type"]: img["storage_path"] for img in images}

    return {
        **grading,
        "card_image_url": image_map.get("card"),
        "overlay_image_urls": {
            k: v for k, v in image_map.items()
            if k not in ("original", "card")
        },
        "original_image_url": image_map.get("original"),
    }


@router.get("/history")
async def get_history(limit: int = 20, offset: int = 0):
    """鑑定履歴を取得する"""
    return await list_gradings(limit=limit, offset=offset)


@router.delete("/history/{grade_id}")
async def delete_grade_history(grade_id: str):
    """鑑定結果を削除する"""
    # Storageの画像も削除
    await delete_grading_images(grade_id)
    # DBから削除（CASCADE で grading_images も消える）
    deleted = await delete_grading(grade_id)
    if not deleted:
        raise HTTPException(404, "鑑定結果が見つかりません")
    return {"message": "削除しました"}


@router.get("/ebay/sold")
async def ebay_sold_search(q: str, brand: str = ""):
    """eBayのSold Listings（販売済み商品）を検索"""
    if not q.strip():
        raise HTTPException(400, "検索クエリを指定してください")
    items = await search_sold_items(q, brand)

    # 価格統計
    prices = [i["price"] for i in items if i.get("price", 0) > 0]
    stats = {}
    if prices:
        sorted_prices = sorted(prices)
        stats = {
            "avg_price": round(sum(prices) / len(prices), 2),
            "min_price": min(prices),
            "max_price": max(prices),
            "median_price": sorted_prices[len(sorted_prices) // 2],
            "count": len(prices),
        }

    return {"items": items, "stats": stats, "total": len(items)}
