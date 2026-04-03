from __future__ import annotations

import os
from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def register_pdf_font() -> str:
    """Register a Unicode-capable font for PDF rendering.

    Returns the registered font name. Falls back to Helvetica when
    no candidate TrueType font is available.
    """

    font_name = "MeetingUnicode"

    if font_name in pdfmetrics.getRegisteredFontNames():
        return font_name

    base_dir = Path(__file__).resolve().parent
    candidates = [
        # Project-level fonts (preferred, portable)
        base_dir / "fonts" / "NotoSansTelugu-Regular.ttf",
        base_dir / "fonts" / "NotoSans-Regular.ttf",
        # Windows fonts (common Telugu-capable options)
        Path("C:/Windows/Fonts/Nirmala.ttf"),
        Path("C:/Windows/Fonts/Nirmala.ttc"),
        Path("C:/Windows/Fonts/Gautam.ttf"),
        Path("C:/Windows/Fonts/Vrinda.ttf"),
    ]

    env_font_path = os.getenv("PDF_FONT_PATH")
    if env_font_path:
        candidates.insert(0, Path(env_font_path))

    for font_path in candidates:
        if font_path.exists() and font_path.is_file():
            try:
                # TTC files can contain multiple font faces; try common indexes.
                if font_path.suffix.lower() == ".ttc":
                    for index in range(4):
                        try:
                            pdfmetrics.registerFont(
                                TTFont(font_name, str(font_path), subfontIndex=index)
                            )
                            return font_name
                        except Exception:
                            continue
                else:
                    pdfmetrics.registerFont(TTFont(font_name, str(font_path)))
                    return font_name
            except Exception:
                continue

    return "Helvetica"
