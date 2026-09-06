"""Build separate anonymous first/last pick QR cards and a paired Letter sheet."""
import json
from pathlib import Path
import qrcode
from qrcode.constants import ERROR_CORRECT_Q
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor

OUT = Path(__file__).resolve().parents[2] / "print"
W, H = 63 * mm, 88 * mm
KINDS = {"first": ("First pick", "#247760"), "last": ("Last card", "#967129")}
matrices = {}
for kind in KINDS:
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_Q, box_size=24, border=4)
    qr.add_data("https://draft.coolasheck.com/?pick=" + kind)
    qr.make(fit=True)
    matrices[kind] = qr.get_matrix()
    qr.make_image(fill_color="black", back_color="white").save(OUT / ("cube-" + kind + "-pick-qr.png"))


def card(canvas, kind, x=0, y=0):
    title, color = KINDS[kind]
    canvas.saveState()
    canvas.translate(x, y)
    canvas.setFillColor(HexColor("#ffffff"))
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#151719"))
    canvas.setFont("Helvetica-Bold", 22)
    canvas.drawCentredString(W / 2, 74 * mm, title)
    canvas.setFont("Helvetica", 9)
    canvas.drawCentredString(W / 2, 66 * mm, "Winning in Style")
    matrix = matrices[kind]
    side = 41 * mm
    step = side / len(matrix)
    left, bottom = (W - side) / 2, 21 * mm
    for row, cells in enumerate(matrix):
        for col, filled in enumerate(cells):
            if filled:
                canvas.rect(left + col * step, bottom + (len(matrix) - row - 1) * step, step, step, stroke=0, fill=1)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawCentredString(W / 2, 17 * mm, "Anonymous")
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(W / 2, 11 * mm, "draft.coolasheck.com")
    canvas.setFillColor(HexColor(color))
    canvas.rect(10 * mm, 6 * mm, 43 * mm, 1 * mm, stroke=0, fill=1)
    canvas.linkURL("https://draft.coolasheck.com/?pick=" + kind, (0, 0, W, H), relative=1, thickness=0)
    canvas.restoreState()


for kind in KINDS:
    canvas = Canvas(str(OUT / ("cube-" + kind + "-pick-card.pdf")), pagesize=(W, H), invariant=1)
    canvas.setTitle("Cube - " + KINDS[kind][0])
    canvas.setAuthor("Winning in Style")
    card(canvas, kind)
    canvas.showPage()
    canvas.save()

canvas = Canvas(str(OUT / "cube-player-qr-sheet-letter.pdf"), pagesize=letter, invariant=1)
canvas.setTitle("Cube - Anonymous Player QR Cards")
canvas.setAuthor("Winning in Style")
gap = 1.5 * mm
x0, y0 = (letter[0] - 2 * W - gap) / 2, (letter[1] - 3 * H - 2 * gap) / 2
for row in range(3):
    for column, kind in enumerate(KINDS):
        x, y = x0 + column * (W + gap), y0 + row * (H + gap)
        card(canvas, kind, x, y)
        canvas.setStrokeColor(HexColor("#777777"))
        canvas.setLineWidth(0.2)
        canvas.rect(x, y, W, H, stroke=1, fill=0)
canvas.showPage()
canvas.save()
receipt = {"urls": {kind: "https://draft.coolasheck.com/?pick=" + kind for kind in KINDS},
           "card_mm": [63, 88], "sheet": "US Letter, 3 first-pick and 3 last-card codes, print at 100%",
           "quiet_zone_modules": 4, "error_correction": "Q", "qr_side_mm": 41}
(OUT / "player-qr-manifest.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
