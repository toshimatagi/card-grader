"""鑑定APIルーター"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from ..services.grading import grade_card

router = APIRouter(prefix="/api/v1", tags=["grading"])

# インメモリの鑑定結果ストア（MVP用、後でDBに移行）
_results_store: dict[str, dict] = {}


@router.post("/grade")
async def create_grade(
    front_image: UploadFile = File(...),
    back_image: Optional[UploadFile] = File(None),
    card_type: str = Form("standard"),
):
    """カード鑑定を実行する"""
    # バリデーション
    if front_image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "対応画像形式: JPEG, PNG, WebP")

    image_bytes = await front_image.read()
    if len(image_bytes) > 20 * 1024 * 1024:  # 20MB上限
        raise HTTPException(400, "画像サイズは20MB以下にしてください")

    if len(image_bytes) == 0:
        raise HTTPException(400, "画像データが空です")

    try:
        result = grade_card(image_bytes, card_type=card_type)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"鑑定処理中にエラーが発生しました: {str(e)}")

    # 結果を保存
    _results_store[result["id"]] = result

    return result


@router.get("/grade/{grade_id}")
async def get_grade(grade_id: str):
    """鑑定結果を取得する"""
    if grade_id not in _results_store:
        raise HTTPException(404, "鑑定結果が見つかりません")
    return _results_store[grade_id]


@router.get("/history")
async def get_history(limit: int = 20, offset: int = 0):
    """鑑定履歴を取得する"""
    items = list(_results_store.values())
    items.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "total": len(items),
        "items": [
            {
                "id": item["id"],
                "overall_grade": item["overall_grade"],
                "confidence": item["confidence"],
                "card_type": item["card_type"],
                "created_at": item["created_at"],
            }
            for item in items[offset:offset + limit]
        ],
    }


@router.delete("/history/{grade_id}")
async def delete_grade(grade_id: str):
    """鑑定結果を削除する"""
    if grade_id not in _results_store:
        raise HTTPException(404, "鑑定結果が見つかりません")
    del _results_store[grade_id]
    return {"message": "削除しました"}
