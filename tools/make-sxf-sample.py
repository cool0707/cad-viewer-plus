"""Generate the SXF samples in resources/cad-data/samples/ with ezsxf.

    python -m pip install ezsxf==0.3.4
    python tools/make-sxf-sample.py

A small A3 floor plan: a 1/100 partial drawing (部分図) with grid lines,
walls, a door swing, a table, a rug, a column fill, a hatched area, room
names and a dimension, plus a 1/1 sheet border and title. Writes
sxf-sample.sfc / .p21 and their ZIP forms .sfz / .p2z (same content). ezsxf is MIT licensed;
the drawing itself is original.
"""

import zipfile
from pathlib import Path

import ezsxf

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
    return doc


def main():
    doc = build()
    doc.save(OUT / "sxf-sample.sfc")
    doc.save_p21(OUT / "sxf-sample.p21")
    doc.save_p2z(OUT / "sxf-sample.p2z")
    # SFZ is the SFC file in a ZIP archive (fixed timestamp: reproducible).
    with zipfile.ZipFile(OUT / "sxf-sample.sfz", "w", zipfile.ZIP_DEFLATED) as archive:
        info = zipfile.ZipInfo("SXF-SAMPLE.SFC", date_time=(2026, 10, 23, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, (OUT / "sxf-sample.sfc").read_bytes())
    for name in ("sfc", "p21", "p2z", "sfz"):
        print("wrote", OUT / f"sxf-sample.{name}")


if __name__ == "__main__":
    main()
