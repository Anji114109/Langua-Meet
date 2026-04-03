Place Unicode TrueType fonts in this folder for multilingual PDF output.

Recommended files:
- NotoSansTelugu-Regular.ttf
- NotoSans-Regular.ttf

How it works:
- The app first checks `PDF_FONT_PATH` env var.
- Then it checks these local files in this folder.
- Then it falls back to common Windows fonts.

If no Unicode font is found, reportlab falls back to Helvetica, which will show square boxes for Telugu text.
