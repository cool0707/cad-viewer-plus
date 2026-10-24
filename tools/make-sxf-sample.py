"""Generate the SXF samples in resources/cad-data/samples/ with ezsxf.

    python -m pip install ezsxf==0.3.4
    python tools/make-sxf-sample.py

A small A3 floor plan: a 1/100 partial drawing (部分図) with grid lines,
walls, a door swing, a table, a rug, a column fill, a hatched area, room
names and a dimension, plus a 1/1 sheet border, title and a monochrome
TIFF (G4) image (SXF 3.1 image attribute). Writes sxf-sample.sfc / .p21 and
their ZIP forms .sfz / .p2z (same content; only the ZIP forms carry the
image file). Requires Pillow with libtiff. ezsxf is MIT licensed; the drawing
and the image are original.
"""

import tempfile
import zipfile
from pathlib import Path

import ezsxf
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "resources" / "cad-data" / "samples"
TIMESTAMP = "2026-10-23T00:00:00"


def build():
    doc = ezsxf.new_sfc(
        "sxf-sample.sfc",
        name="サンプル平面図",
        paper="A3",
        orientation="landscape",
        timestamp=TIMESTAMP,
        target="p21",
    )
    frame = 1  # new_sfc creates layer 1
    grid = doc.add_layer("通り芯")
    wall = doc.add_layer("壁")
    door = doc.add_layer("建具")
    text = doc.add_layer("文字")
    dim = doc.add_layer("寸法")
    red = doc.add_color("red")
    green = doc.add_color("green")
    blue = doc.add_color("blue")
    gray = doc.add_color("lightgray")
    chain = doc.add_line_type("chain")
    thick = doc.add_line_width(0.5)
    thin = doc.add_line_width(0.18)
    mincho = doc.add_font("ＭＳ 明朝")

    # Real millimetres inside the 1/100 partial drawing.
    w, h = 10000, 7000
    plan = []
    for x in (0, w / 2, w):
        plan.append({"kind": "line", "start": (x, -1000), "end": (x, h + 1000),
                     "layer": grid, "color": red, "line_type": chain, "line_width": thin})
    for y in (0, h):
        plan.append({"kind": "line", "start": (-1000, y), "end": (w + 1000, y),
                     "layer": grid, "color": red, "line_type": chain, "line_width": thin})
    plan.append({"kind": "polyline", "points": [(0, 0), (w, 0), (w, h), (0, h), (0, 0)],
                 "layer": wall, "line_width": thick})
    plan.append({"kind": "line", "start": (w / 2, 0), "end": (w / 2, h),
                 "layer": wall, "line_width": thick})
    # Door: leaf and swing.
    plan.append({"kind": "line", "start": (w / 2, 2000), "end": (w / 2 + 900, 2000),
                 "layer": door, "color": green})
    plan.append({"kind": "arc", "center": (w / 2, 2000), "radius": 900,
                 "start_angle": 0, "end_angle": 90, "layer": door, "color": green})
    plan.append({"kind": "circle", "center": (w / 4, h / 2), "radius": 600,
                 "layer": door, "color": green})
    plan.append({"kind": "ellipse", "center_x": w * 3 / 4, "center_y": h / 2,
                 "radius_x": 1400, "radius_y": 700, "angle": 30,
                 "layer": door, "color": blue})
    plan.append({"kind": "text", "text": "居間・食堂", "anchor": (w / 4, h - 1500),
                 "height": 400, "base_point": 2, "layer": text})
    plan.append({"kind": "text", "text": "寝室", "anchor": (w * 3 / 4, h - 1500),
                 "height": 400, "base_point": 2, "layer": text})
    plan.append({"kind": "linear_dimension", "start_x": 0, "start_y": -1800,
                 "end_x": w, "end_y": -1800, "layer": dim, "color": blue,
                 "text": "10,000", "text_x": w / 2, "text_y": -1700,
                 "text_height": 250, "text_width": 750, "text_base_point": 2,
                 "arrow1_code": 1, "arrow1_direction": 1, "arrow1_x": 0, "arrow1_y": -1800,
                 "arrow1_scale": 15,
                 "arrow2_code": 1, "arrow2_direction": 1, "arrow2_x": w, "arrow2_y": -1800,
                 "arrow2_scale": 15,
                 "extension1_present": 1, "extension1_start_x": 0, "extension1_start_y": -1200,
                 "extension1_end_x": 0, "extension1_end_y": -1900,
                 "extension2_present": 1, "extension2_start_x": w, "extension2_start_y": -1200,
                 "extension2_end_x": w, "extension2_end_y": -1900})
    # Column (fill) and hatched floor area.
    plan.append({"kind": "fill", "color": gray, "layer": wall,
                 "outer": [(-200, -200), (200, -200), (200, 200), (-200, 200)]})
    plan.append({"kind": "hatch", "layer": wall,
                 "outer": [(w / 2 + 300, 300), (w - 300, 300), (w - 300, 1500),
                           (w / 2 + 300, 1500)],
                 "patterns": [[gray, 1, 1, 0, 0, 150, 45]]})
    doc.extend([{"kind": "partial_drawing", "name": "平面図",
                 "position": (80, 90), "scale": (0.01, 0.01), "elements": plan}])

    # Sheet border and title block in paper millimetres.
    doc.extend([
        {"kind": "polyline", "points": [(10, 10), (410, 10), (410, 287), (10, 287), (10, 10)],
         "layer": frame, "line_width": thick},
        {"kind": "polyline", "points": [(300, 10), (410, 10), (410, 40), (300, 40), (300, 10)],
         "layer": frame},
        {"kind": "text", "text": "サンプル平面図", "anchor": (305, 26), "height": 5,
         "layer": frame, "font": mincho},
        {"kind": "text", "text": "S=1/100  A3", "anchor": (305, 15), "height": 3.5,
         "layer": frame},
    ])
    # Location map (案内図) as a bundled monochrome G4 TIFF, 80 x 60 mm.
    doc.add_image(IMAGE, (320, 200), 80, 60, layer=frame, file_name=IMAGE.name)
    doc.extend([
        {"kind": "text", "text": "案内図 (同梱画像)", "anchor": (320, 195), "height": 3,
         "layer": frame},
    ])
    return doc


IMAGE = Path(tempfile.gettempdir()) / "SXF-MAP.TIF"


def make_image():
    """A 640 x 480 bilevel location map: roads, a river and the site."""
    img = Image.new("1", (640, 480), 1)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 639, 479), outline=0, width=4)
    for y in (120, 330):
        d.line((0, y, 639, y), fill=0, width=10)
    d.line((200, 0, 260, 479), fill=0, width=10)
    d.line((470, 0, 520, 479), fill=0, width=6)
    # River: dashed curve.
    for i in range(0, 640, 24):
        d.arc((i - 40, 380, i + 40, 470), 200, 340, fill=0, width=3)
    # Site: hatched block with a mark.
    d.rectangle((300, 160, 420, 290), outline=0, width=6)
    for k in range(300, 420, 12):
        d.line((k, 290, k + 40, 160), fill=0, width=2)
    d.ellipse((560, 40, 620, 100), outline=0, width=4)
    d.polygon([(590, 30), (580, 70), (600, 70)], fill=0)
    img.save(IMAGE, compression="group4")


def main():
    make_image()
    doc = build()
    # The plain SFC / P21 reference the image (shown as a missing image);
    # the ZIP forms carry it.
    doc.save(OUT / "sxf-sample.sfc")
    with tempfile.TemporaryDirectory() as tmp:
        bundle = Path(tmp) / "bundle"
        doc.save_p21_bundle(bundle, file_name="sxf-sample.p21")
        (OUT / "sxf-sample.p21").write_bytes((bundle / "sxf-sample.p21").read_bytes())
    doc.save_p2z(OUT / "sxf-sample.p2z")
    # SFZ is the SFC file in a ZIP archive (fixed timestamp: reproducible).
    with zipfile.ZipFile(OUT / "sxf-sample.sfz", "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in (("SXF-SAMPLE.SFC", (OUT / "sxf-sample.sfc").read_bytes()),
                           (IMAGE.name, IMAGE.read_bytes())):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 23, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    for name in ("sfc", "p21", "p2z", "sfz"):
        print("wrote", OUT / f"sxf-sample.{name}")


if __name__ == "__main__":
    main()
