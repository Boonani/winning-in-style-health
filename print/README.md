# Printable Primer Card

- `cube-primer-card.pdf`: one 63 x 88 mm card, vector QR.
- `cube-primer-sheet-letter.pdf`: nine cards on US Letter. Print at **Actual Size / 100%**, not Fit. Cut at the fine gray borders.
- `cube-qr.png`: high-resolution standalone QR with a four-module white quiet zone.

Every code points to https://cube.coolasheck.com/draft-primer.html. Do not trim the white quiet zone or print a logo over the code. The generated PDF card and all nine rendered sheet codes were independently decoded with OpenCV.

Rebuild on BOONBOX using Python with `reportlab`, `qrcode`, and `pillow`: `python tooling/scripts/build-qr.py`. Verification additionally uses `opencv-python-headless` and Poppler `pdftoppm`. Keep the URL and physical dimensions in `qr-manifest.json` in sync with the generator.
