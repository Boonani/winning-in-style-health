# Printable Primer Card

- `cube-primer-card.pdf`: one 63 x 88 mm card, vector QR.
- `cube-primer-sheet-letter.pdf`: nine cards on US Letter. Print at **Actual Size / 100%**, not Fit. Cut at the fine gray borders.
- `cube-qr.png`: high-resolution standalone QR with a four-module white quiet zone.

Every code points to https://cube.coolasheck.com/primer. Do not trim the white quiet zone or print a logo over the code. The generated PDF card and all nine rendered sheet codes were independently decoded with OpenCV.

Rebuild on BOONBOX using Python with `reportlab`, `qrcode`, and `pillow`: `python tooling/scripts/build-qr.py`. Verification additionally uses `opencv-python-headless` and Poppler `pdftoppm`. Keep the URL and physical dimensions in `qr-manifest.json` in sync with the generator.

## Player Observations

`cube-first-pick-card.pdf` and `cube-last-pick-card.pdf` open separate anonymous player forms. `cube-player-qr-sheet-letter.pdf` has three of each on one Letter page. Print at 100%. Both forms ask for the card, pack 1-3, and experience 0-5. These QR codes are separate from the primer QR.
