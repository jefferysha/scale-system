"""Excel 读取统一入口."""

from pathlib import Path

import openpyxl
from openpyxl.workbook import Workbook


def open_workbook(path: Path) -> Workbook:
    if not path.exists():
        raise FileNotFoundError(f"Excel 不存在: {path}")
    return openpyxl.load_workbook(path, data_only=True, read_only=True)
