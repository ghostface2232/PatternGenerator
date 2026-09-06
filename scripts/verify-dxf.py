"""Independent reader: python scripts/verify-dxf.py /tmp/pattern-export-fixtures.
Requires ezdxf (install in a temporary venv; no application dependency).
"""
import math
import sys
from pathlib import Path
import xml.etree.ElementTree as ET
import ezdxf
from ezdxf import bbox

folder = Path(sys.argv[1])
files = sorted(folder.glob("*.dxf"))
assert files, "No DXF fixtures found"
for path in files:
    drawing = ezdxf.readfile(path)
    audit = drawing.audit()
    assert not audit.errors and not audit.fixes, (path.name, audit.errors, audit.fixes)
    assert drawing.dxfversion == "AC1015", path.name
    inch = path.stem.endswith("-inch")
    scale = 1 / 25.4 if inch else 1
    assert drawing.units == (1 if inch else 4), path.name
    actual = bbox.extents(drawing.modelspace())
    for axis in range(2):
        assert drawing.header["$EXTMIN"][axis] <= actual.extmin[axis] + 1e-8, path.name
        assert drawing.header["$EXTMAX"][axis] >= actual.extmax[axis] - 1e-8, path.name
    for entity in drawing.modelspace():
        assert entity.dxf.layer in {"OUTLINE", "HOLES", "HOLES_EXIT", "KEEPOUT"}
        if entity.dxftype() == "CIRCLE":
            assert entity.dxf.radius > 0
            assert all(math.isfinite(n) for n in entity.dxf.center)
        else:
            assert entity.dxftype() == "LWPOLYLINE"
            assert entity.closed and len(entity) >= 3
            assert all(math.isfinite(n) for point in entity.get_points() for n in point)
    if path.name.startswith("calibration-"):
        circle = drawing.modelspace().query("CIRCLE")[0]
        assert abs(circle.dxf.radius - 2.54 * scale) < 1e-8
        assert abs(circle.dxf.center.x - 12.7 * scale) < 1e-8
        assert abs(circle.dxf.center.y - 40.8 * scale) < 1e-8
    svg = path.with_suffix(".svg")
    if svg.exists():
        root = ET.parse(svg).getroot()
        unit = "in" if inch else "mm"
        assert root.attrib["width"].endswith(unit)
        view = list(map(float, root.attrib["viewBox"].split()))
        assert abs(float(root.attrib["width"][:-len(unit)]) - view[2]) < 1e-8
        group = root.find("{http://www.w3.org/2000/svg}g")
        assert abs(float(group.attrib["transform"][6:-1]) - scale) < 1e-10
        if path.name.startswith("edge-kerf-"):
            assert view[0] / scale <= -0.575 + 1e-8
        if path.name.startswith("calibration-"):
            circle = root.find(".//{http://www.w3.org/2000/svg}circle")
            assert abs(float(circle.attrib["r"]) - 2.54) < 1e-8
        assert root.find(".//{http://www.w3.org/2000/svg}clipPath") is None
print(f"PASS: {len(files)} R2000 DXFs, no audit errors or repairs; calibration dimensions and companion SVGs checked")
