p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep("        s.lo = (0, 0)\n", "        s.lo = (0, 0)\n        s.pts = None\n        s._sides = (None, None)\n")
rep("        s.nodes, s.edges, s.order = {}, [], []", "        s.nodes, s.edges, s.order = {}, [], []\n        s.ortho = False")
rep("        sides.append((sa, sb))\n    groups = {}", "        sides.append((sa, sb))\n        e._sides = (sa, sb)\n    groups = {}")

# ---- routing + polyline helpers replace compute_anchors
rep("def compute_anchors(d):\n    (radial_anchors if d.mode == 'radial' else layered_anchors)(d)\n", r'''def poly_len(pts):
    return sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))


def poly_point(pts, f):
    """Point at fraction f of the way along a polyline, plus the direction of the segment there."""
    total = poly_len(pts)
    t = total * f
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if t <= L or i == len(pts) - 2:
            u = 0 if L == 0 else min(1.0, t / L)
            return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u), (b[0] - a[0], b[1] - a[1])
        t -= L
    return pts[-1], (1, 0)


def route_ortho(d):
    """Right-angle routes: each arrow gets its own track in the gap between the two shapes; track order chosen for fewest crossings."""
    import random
    groups = {}
    for e in d.edges:
        sa, sb = e._sides
        pa, pb = e.pa, e.pb
        e.pts = [pa, pb]
        if sa in ('left', 'right') and sb in ('left', 'right') and abs(pa[1] - pb[1]) > 1.5 and abs(pa[0] - pb[0]) > 30:
            if (sa == 'right') == (pb[0] > pa[0]):
                groups.setdefault(('h', round(pa[0]), round(pb[0])), []).append(e)
        elif sa in ('top', 'bottom') and sb in ('top', 'bottom') and abs(pa[0] - pb[0]) > 1.5 and abs(pa[1] - pb[1]) > 30:
            if (sa == 'bottom') == (pb[1] > pa[1]):
                groups.setdefault(('v', round(pa[1]), round(pb[1])), []).append(e)

    def build(e, kind, c):
        pa, pb = e.pa, e.pb
        return [pa, (c, pa[1]), (c, pb[1]), pb] if kind == 'h' else [pa, (pa[0], c), (pb[0], c), pb]

    for key, es in groups.items():
        kind = key[0]
        lo = min(key[1], key[2]) + 16
        hi = max(key[1], key[2]) - 16
        n = len(es)
        slots = [lo + (hi - lo) * (k + 1) / (n + 1) for k in range(n)]

        def cost(perm):
            polys = [build(e, kind, slots[perm[i]]) for i, e in enumerate(es)]
            c = 0
            for i in range(n):
                for j in range(i + 1, n):
                    for a in range(3):
                        for b in range(3):
                            if seg_cross(polys[i][a], polys[i][a + 1], polys[j][b], polys[j][b + 1]):
                                c += 1
            return c
        rnd = random.Random(3)
        best, bc = list(range(n)), cost(list(range(n)))
        starts = [list(range(n)), list(reversed(range(n)))] + [rnd.sample(range(n), n) for _ in range(5)]
        for st in starts:
            if bc == 0:
                break
            cur, cc = list(st), cost(st)
            imp = True
            while imp and cc > 0:
                imp = False
                for a in range(n):
                    for b in range(a + 1, n):
                        t = list(cur); t[a], t[b] = t[b], t[a]
                        ct = cost(t)
                        if ct < cc:
                            cur, cc, imp = t, ct, True
            if cc < bc:
                best, bc = cur, cc
        for i, e in enumerate(es):
            e.pts = build(e, kind, slots[best[i]])


def compute_anchors(d):
    (radial_anchors if d.mode == 'radial' else layered_anchors)(d)
    for e in d.edges:
        e.pts = [e.pa, e.pb]
    if d.ortho:
        route_ortho(d)
''')

# ---- label placement on polylines
i = s.index("def place_labels(d):")
j = s.index("# ============================================================================ draw.io output")
s = s[:i] + r'''def place_labels(d):
    nodes = [(n.cx - n.w / 2, n.cy - n.h / 2, n.w, n.h) for n in d.nodes.values() if n.kind != 'boundary']
    segs = []
    for e in d.edges:
        segs.append([(e.pts[k], e.pts[k + 1]) for k in range(len(e.pts) - 1)])
    placed = []
    for ei, e in enumerate(d.edges):
        if not e.label:
            continue
        w, h = label_size(e.label)
        cands = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86, 0.08, 0.92]
        if e.fixed is not None:
            cands = [e.fixed]
        best, bo, best_pen = cands[0], (0, 0), 1e18
        for f in cands:
            (x, y), dv = poly_point(e.pts, f)
            vertical = abs(dv[1]) > abs(dv[0])
            sides = [(0, 0)]
            if vertical:
                sides += [(-(w / 2 + 6), 0), (w / 2 + 6, 0)]
            else:
                sides += [(0, -(h / 2 + 4)), (0, h / 2 + 4)]
            for so in sides:
                r = (x + so[0] - w / 2, y + so[1] - h / 2, w, h)
                pen = sum(overlap(r, q) for q in placed) * 4 + sum(overlap(r, q) for q in nodes) * 6
                pen += sum(40 for si, sl in enumerate(segs) if si != ei for (sa, sb) in sl if seg_hits(sa, sb, r))
                pen += abs(f - 0.5) * 3 + (2 if so != (0, 0) else 0)
                if pen < best_pen:
                    best, bo, best_pen = f, so, pen
        e.lp, e.lo = best, bo
        (x, y), _ = poly_point(e.pts, best)
        placed.append((x + bo[0] - w / 2, y + bo[1] - h / 2, w, h))


''' + s[j:]

# ---- drawio waypoints
rep("        off = f'<mxPoint x=\"{e.lo[0]:.0f}\" y=\"{e.lo[1]:.0f}\" as=\"offset\"/>' if e.label and e.lo != (0, 0) else ''",
    "        off = f'<mxPoint x=\"{e.lo[0]:.0f}\" y=\"{e.lo[1]:.0f}\" as=\"offset\"/>' if e.label and e.lo != (0, 0) else ''\n        if len(e.pts) > 2:\n            off += '<Array as=\"points\">' + ''.join(f'<mxPoint x=\"{q[0]:.0f}\" y=\"{q[1]:.0f}\"/>' for q in e.pts[1:-1]) + '</Array>'")
# ---- svg path + label point
rep("""out.append(f'<path d="M{e.pa[0]:.1f} {e.pa[1]:.1f} L{e.pb[0]:.1f} {e.pb[1]:.1f}" class="{cls}" fill="none"{mk}/>')""",
    """out.append('<path d="M' + ' L'.join(f'{q[0]:.1f} {q[1]:.1f}' for q in e.pts) + f'" class="{cls}" fill="none" stroke-linejoin="round"{mk}/>')""")
rep("            lx, ly = point_at(e.pa, e.pb, e.lp)\n", "            (lx, ly), _dv = poly_point(e.pts, e.lp)\n")
# ---- turn routing on for the data flow pages
rep("def std_page(d, procs, yp, zig, step, dup=False):\n", "def std_page(d, procs, yp, zig, step, dup=False):\n    d.ortho = True\n")
open(p, 'w', encoding='utf-8').write(s)
