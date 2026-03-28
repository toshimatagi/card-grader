from pydantic import BaseModel
from typing import Optional
from enum import Enum


class CardType(str, Enum):
    STANDARD = "standard"  # 63x88mm (MTG, Pokemon)
    SMALL = "small"        # 59x86mm (Yu-Gi-Oh)
    CUSTOM = "custom"


class GradeOptions(BaseModel):
    detailed_report: bool = True
    overlay_images: bool = True


class CenteringDetail(BaseModel):
    lr_ratio: str
    tb_ratio: str
    left_border: float
    right_border: float
    top_border: float
    bottom_border: float


class SurfaceDetail(BaseModel):
    scratches: int
    severity: str
    whitening: str
    defects: list[dict] = []


class ColorPrintDetail(BaseModel):
    fading: float
    ink_uniformity: float
    is_holo: bool
    saturation_score: float


class EdgesDetail(BaseModel):
    edge_straightness: float
    corner_roundness_uniformity: float
    corner_damages: list[dict] = []


class SubGrade(BaseModel):
    score: float
    detail: dict


class GradeResult(BaseModel):
    id: str
    overall_grade: float
    confidence: float
    sub_grades: dict[str, SubGrade]
    overlay_images: dict[str, Optional[str]] = {}
    created_at: str
