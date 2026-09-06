"""Rebuild the printable primer QR. Run on BOONBOX, not the Windows mirror."""
import json
from pathlib import Path
import qrcode
from qrcode.constants import ERROR_CORRECT_Q
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "print"
OUT.mkdir(exist_ok=True)
URL = "https://cube.coolasheck.com/draft-primer.html"
qr = qrcode.QRCode(error_correction=ERROR_CORRECT_Q, box_size=24, border=4)
qr.add_data(URL)
qr.make(fit=True)
matrix = qr.get_matrix()
qr.make_image(fill_color="black", back_color="white").save(OUT / "cube-qr.png")
W, H = 63 * mm, 88 * mm

def card(c, x=0, y=0):
    c.saveState()
    c.translate(x, y)
    c.setFillColor(HexColor("#ffffff"))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor("#151719"))
    c.setFont("Helvetica-Bold", 25)
    c.drawCentredString(W / 2, 73 * mm, "Cube")
    c.setFont("Helvetica", 9)
    c.drawCentredString(W / 2, 66 * mm, "Winning in Style")
    side = 41 * mm
    left, bottom = (W - side) / 2, 21 * mm
    module = side / len(matrix)
    for row, cells in enumerate(matrix):
        for col, filled in enumerate(cells):
            if filled:
                c.rect(left + col * module, bottom + (len(matrix) - row - 1) * module,
                       module, module, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(W / 2, 17 * mm, "Draft primer")
    c.setFont("Helvetica", 8)
    c.drawCentredString(W / 2, 11 * mm, "cube.coolasheck.com")
    for i, color in enumerate(["#cfb75e", "#397bd3", "#6b5d7c", "#d45555", "#398568"]):
        c.setFillColor(HexColor(color))
        c.rect(10 * mm + i * 8.6 * mm, 6 * mm, 8.6 * mm, 1 * mm, stroke=0, fill=1)
    c.linkURL(URL, (0, 0, W, H), relative=1, thickness=0)
    c.restoreState()

def make_pdf(name, page_size, sheet=False):
    c = Canvas(str(OUT / name), pagesize=page_size, invariant=1)
    c.setTitle("Cube - Draft Primer")
    c.setAuthor("Winning in Style")
    if not sheet:
        card(c)
    else:
        gap = 1.5 * mm
        x0 = (page_size[0] - 3 * W - 2 * gap) / 2
        y0 = (page_size[1] - 3 * H - 2 * gap) / 2
        for row in range(3):
            for col in range(3):
                x, y = x0 + col * (W + gap), y0 + row * (H + gap)
                card(c, x, y)
                c.setStrokeColor(HexColor("#747474"))
                c.setLineWidth(0.2)
                c.rect(x, y, W, H, stroke=1, fill=0)
    c.showPage()
    c.save()

make_pdf("cube-primer-card.pdf", (W, H))
make_pdf("cube-primer-sheet-letter.pdf", letter, sheet=True)
receipt = {"url": URL, "card_mm": [63, 88], "sheet": "US Letter, 9 cards, print at 100%",
           "qr_modules_with_quiet_zone": len(matrix), "quiet_zone_modules": 4,
           "error_correction": "Q", "qr_side_mm": 41, "card_pdf_vector": True}
(OUT / "qr-manifest.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
