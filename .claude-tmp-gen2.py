import re, os, math, html as H, zlib, base64, urllib.parse, json

FS = 1.0


def sfs(style):
    return re.sub(r'fontSize=(\d+)', lambda m: 'fontSize=%s' % round(max(5.0, int(m.group(1)) * FS), 1), style)


# ============================================================================ model
SIZE = {'entity': (150, 64), 'process': (210, 96), 'store': (190, 50), 'usecase': (300, 48), 'actor': (46, 84),
        'system': (340, 200), 'term': (180, 46), 'decision': (230, 112), 'fproc': (240, 58), 'conn': (40, 40)}
SHAPE = {'entity': 'rect', 'process': 'rect', 'store': 'rect', 'usecase': 'ellipse', 'actor': 'rect', 'system': 'ellipse',
         'term': 'rect', 'decision': 'diamond', 'fproc': 'rect', 'conn': 'ellipse', 'boundary': 'none'}


class Node:
    def __init__(s, id, kind, label, cx, cy, w, h, lbl='bottom'):
        s.dup = False
        s.id, s.kind, s.label, s.cx, s.cy, s.w, s.h, s.lbl = id, kind, label, cx, cy, w, h, lbl


class Edge:
    def __init__(s, a, b, label, dashed, both, gen, sa, sb, lp):
        if label and chr(10) not in label and len(label) > 17:
            w = label.split(' ')
            best, bi = 10**9, 0
            for k in range(1, len(w)):
                dd_ = abs(len(' '.join(w[:k])) - len(' '.join(w[k:])))
                if dd_ < best: best, bi = dd_, k
            if len(w) > 1: label = ' '.join(w[:bi]) + chr(10) + ' '.join(w[bi:])
        s.lo = (0, 0)
        s.pts = None
        s._sides = (None, None)
        s._chan = None
        s.a, s.b, s.label, s.dashed, s.both, s.gen, s.sa, s.sb, s.fixed = a, b, label, dashed, both, gen, sa, sb, lp
        s.lp, s.pa, s.pb = 0.5, None, None


class Diagram:
    def __init__(s, key, group, title, w, h, blurb, mode='layered'):
        s.key, s.group, s.title, s.w, s.h, s.blurb, s.mode = key, group, title, w, h, blurb, mode
        s.nodes, s.edges, s.order = {}, [], []
        s.ortho = False

    def n(s, id, kind, label, cx, cy, w=None, h=None, lbl='bottom', dup=False):
        dw, dh = SIZE.get(kind, (200, 60))
        s.nodes[id] = Node(id, kind, label, cx, cy, w or dw, h or dh, lbl)
        s.nodes[id].dup = dup
        s.order.append(id)

    def e(s, a, b, label='', dashed=False, both=False, gen=False, sa=None, sb=None, lp=None):
        s.edges.append(Edge(a, b, label, dashed, both, gen, sa, sb, lp))


# ============================================================================ geometry
def inside(n, x, y):
    dx, dy = x - n.cx, y - n.cy
    hw, hh = n.w / 2, n.h / 2
    sh = SHAPE.get(n.kind, 'rect')
    if sh == 'ellipse':
        return (dx / hw) ** 2 + (dy / hh) ** 2 <= 1
    if sh == 'diamond':
        return abs(dx) / hw + abs(dy) / hh <= 1
    return abs(dx) <= hw and abs(dy) <= hh


def boundary_on_line(n, a, b, exiting):
    """Point where the straight line a->b leaves (exiting) or enters node n."""
    P = lambda t: (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        ins = inside(n, *P(mid))
        if exiting:
            lo, hi = (mid, hi) if ins else (lo, mid)
        else:
            lo, hi = (lo, mid) if ins else (mid, hi)
    return P(lo if exiting else hi)


def ray_point(n, tx, ty):
    """Boundary point of n in the direction of (tx, ty) from its center."""
    return boundary_on_line(n, (n.cx, n.cy), (tx, ty), True) if (tx, ty) != (n.cx, n.cy) else (n.cx, n.cy)


def radial_anchors(d):
    have = {(e.a, e.b) for e in d.edges}
    for e in d.edges:
        A, B = d.nodes[e.a], d.nodes[e.b]
        if A.kind == 'usecase' and B.kind == 'usecase':
            up = B.cy < A.cy
            e.pa = (A.cx, A.cy - A.h / 2 if up else A.cy + A.h / 2)
            e.pb = (B.cx, B.cy + B.h / 2 if up else B.cy - B.h / 2)
            continue
        if B.kind == 'usecase':
            e.pb = (B.cx - B.w / 2 if A.cx < B.cx else B.cx + B.w / 2, B.cy)
            e.pa = boundary_on_line(A, (A.cx, A.cy), e.pb, True)
            continue
        if A.kind == 'usecase':
            e.pa = (A.cx - A.w / 2 if B.cx < A.cx else A.cx + A.w / 2, A.cy)
            e.pb = boundary_on_line(B, (B.cx, B.cy), e.pa, True)
            continue
        dx, dy = B.cx - A.cx, B.cy - A.cy
        L = math.hypot(dx, dy) or 1
        off = (15 if e.a < e.b else -15) if (e.b, e.a) in have else 0
        nx, ny = -dy / L * off, dx / L * off
        a, b = (A.cx + nx, A.cy + ny), (B.cx + nx, B.cy + ny)
        e.pa = boundary_on_line(A, a, b, True)
        e.pb = boundary_on_line(B, a, b, False)


def pick_side(A, B):
    dx, dy = B.cx - A.cx, B.cy - A.cy
    if abs(dy) >= 0.55 * abs(dx):
        return 'bottom' if dy > 0 else 'top'
    return 'right' if dx > 0 else 'left'


OPP = {'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left'}


def layered_anchors(d):
    sides = []
    for e in d.edges:
        A, B = d.nodes[e.a], d.nodes[e.b]
        sa = e.sa or pick_side(A, B)
        sb = e.sb or (OPP[sa] if not e.sa else pick_side(B, A))
        sides.append((sa, sb))
        e._sides = (sa, sb)
    groups = {}
    for i, e in enumerate(d.edges):
        for end, nid, side in ((0, e.a, sides[i][0]), (1, e.b, sides[i][1])):
            other = d.nodes[e.b if end == 0 else e.a]
            key = other.cx if side in ('top', 'bottom') else other.cy
            groups.setdefault((nid, side), []).append((key, i, end))
    anchors = {}
    for (nid, side), items in groups.items():
        n = d.nodes[nid]
        items.sort()
        cnt = len(items)
        for k, (_, i, end) in enumerate(items):
            t = 0.5 if cnt == 1 else 0.14 + 0.72 * (k + 0.5) / cnt
            if SHAPE.get(n.kind) == 'diamond' or n.kind in ('system',):
                t = 0.5
            x0, y0 = n.cx - n.w / 2, n.cy - n.h / 2
            if side == 'top':
                p = (x0 + n.w * t, y0)
            elif side == 'bottom':
                p = (x0 + n.w * t, y0 + n.h)
            elif side == 'left':
                p = (x0, y0 + n.h * t)
            else:
                p = (x0 + n.w, y0 + n.h * t)
            anchors[(i, end)] = p
    for i, e in enumerate(d.edges):
        A, B = d.nodes[e.a], d.nodes[e.b]
        pa, pb = anchors[(i, 0)], anchors[(i, 1)]
        if SHAPE.get(A.kind) == 'ellipse':
            pa = ray_point(A, *pb)
        if SHAPE.get(B.kind) == 'ellipse':
            pb = ray_point(B, *pa)
        e.pa, e.pb = pa, pb


def poly_len(pts):
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
        if sa in ('left', 'right') and sb in ('top', 'bottom'):
            e.pts = [pa, (pb[0], pa[1]), pb]
            continue
        if sa in ('top', 'bottom') and sb in ('left', 'right'):
            e.pts = [pa, (pa[0], pb[1]), pb]
            continue
        if sa == sb and sa in ('left', 'right'):
            cx = max(pa[0], pb[0]) + 48 if sa == 'right' else min(pa[0], pb[0]) - 48
            e.pts = [pa, (cx, pa[1]), (cx, pb[1]), pb]
            continue
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
            e._chan = (kind, lo, hi, slots[best[i]])


def context_anchors(d):
    sysn = d.nodes['sys']
    have = {(e.a, e.b) for e in d.edges}
    for e in d.edges:
        ent_is_a = e.a != 'sys'
        ent = d.nodes[e.a if ent_is_a else e.b]
        recip = (e.b, e.a) in have
        off = (14 if ent_is_a else -14) if recip else 0
        if abs(ent.cx - sysn.cx) > 300:
            y = ent.cy + off
            ex = ent.cx + ent.w / 2 if ent.cx < sysn.cx else ent.cx - ent.w / 2
            ep = (ex, y)
            sp = boundary_on_line(sysn, ep, (sysn.cx, y), False)
        else:
            x = ent.cx + off
            ey = ent.cy + ent.h / 2 if ent.cy < sysn.cy else ent.cy - ent.h / 2
            ep = (x, ey)
            sp = boundary_on_line(sysn, ep, (x, sysn.cy), False)
        e.pa, e.pb = (ep, sp) if ent_is_a else (sp, ep)


def seg_overlap(a, b, c, e2):
    if abs(a[1] - b[1]) < 1 and abs(c[1] - e2[1]) < 1 and abs(a[1] - c[1]) < 12:
        return min(max(a[0], b[0]), max(c[0], e2[0])) - max(min(a[0], b[0]), min(c[0], e2[0])) > 6
    if abs(a[0] - b[0]) < 1 and abs(c[0] - e2[0]) < 1 and abs(a[0] - c[0]) < 12:
        return min(max(a[1], b[1]), max(c[1], e2[1])) - max(min(a[1], b[1]), min(c[1], e2[1])) > 6
    return False


def clashes(d, k):
    e = d.edges[k]
    n = 0
    for j, f in enumerate(d.edges):
        if j == k:
            continue
        for a in range(len(e.pts) - 1):
            for b in range(len(f.pts) - 1):
                if seg_overlap(e.pts[a], e.pts[a + 1], f.pts[b], f.pts[b + 1]):
                    n += 1
    return n


def unstack(d):
    """Move arrow tracks sideways until no two arrows run on top of, or right beside, each other."""
    for _ in range(8):
        moved = False
        for k, e in enumerate(d.edges):
            if e._chan is None:
                continue
            cur = clashes(d, k)
            if cur == 0:
                continue
            kind, lo, hi, c0 = e._chan
            pa, pb = e.pa, e.pb
            best_c, best_n = None, cur
            keep = e.pts
            for c in sorted(range(int(lo), int(hi) + 1, 4), key=lambda v: abs(v - c0)):
                e.pts = [pa, (c, pa[1]), (c, pb[1]), pb] if kind == 'h' else [pa, (pa[0], c), (pb[0], c), pb]
                n = clashes(d, k)
                if n < best_n:
                    best_c, best_n = c, n
                    if n == 0:
                        break
            if best_c is None:
                e.pts = keep
            else:
                c = best_c
                e.pts = [pa, (c, pa[1]), (c, pb[1]), pb] if kind == 'h' else [pa, (pa[0], c), (pb[0], c), pb]
                e._chan = (kind, lo, hi, c)
                moved = True
        if not moved:
            break
    # a stubborn pair: try moving both tracks together
    for k, e in enumerate(d.edges):
        if e._chan is None or clashes(d, k) == 0:
            continue
        for j, f in enumerate(d.edges):
            if j == k or f._chan is None:
                continue
            if not any(seg_overlap(e.pts[a], e.pts[a + 1], f.pts[b], f.pts[b + 1]) for a in range(len(e.pts) - 1) for b in range(len(f.pts) - 1)):
                continue
            ke, kf = e._chan, f._chan
            def setc(edge, ch, c):
                edge.pts = [edge.pa, (c, edge.pa[1]), (c, edge.pb[1]), edge.pb] if ch[0] == 'h' else [edge.pa, (edge.pa[0], c), (edge.pb[0], c), edge.pb]
            base = clashes(d, k) + clashes(d, j)
            best = (base, ke[3], kf[3])
            for ce in range(int(ke[1]), int(ke[2]) + 1, 8):
                for cf in range(int(kf[1]), int(kf[2]) + 1, 8):
                    setc(e, ke, ce); setc(f, kf, cf)
                    n = clashes(d, k) + clashes(d, j)
                    if n < best[0]:
                        best = (n, ce, cf)
            setc(e, ke, best[1]); setc(f, kf, best[2])
            e._chan = (ke[0], ke[1], ke[2], best[1]); f._chan = (kf[0], kf[1], kf[2], best[2])


def compute_anchors(d):
    if d.mode == 'context':
        context_anchors(d)
    else:
        (radial_anchors if d.mode == 'radial' else layered_anchors)(d)
    for e in d.edges:
        e.pts = [e.pa, e.pb]
    if d.ortho:
        route_ortho(d)
        unstack(d)


# ---------------------------------------------------------------------------- label placement
def point_at(a, b, f):
    return a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f


def label_size(text):
    parts = text.split('\n')
    return max(len(p) for p in parts) * 5.7 * FS + 8, len(parts) * 12.5 * FS + 4


def overlap(a, b):
    w = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
    h = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
    return w * h if w > 0 and h > 0 else 0


def seg_hits(a, b, r):
    """True when the segment a-b passes through rectangle r (sampled)."""
    for k in range(1, 20):
        x, y = point_at(a, b, k / 20)
        if r[0] < x < r[0] + r[2] and r[1] < y < r[1] + r[3]:
            return True
    return False


def place_labels(d):
    nodes = [(n.cx - n.w / 2, n.cy - n.h / 2, n.w, n.h) for n in d.nodes.values() if n.kind != 'boundary']
    segs = []
    for e in d.edges:
        segs.append([(e.pts[k], e.pts[k + 1]) for k in range(len(e.pts) - 1)])
    placed = []
    for ei, e in enumerate(d.edges):
        if not e.label:
            continue
        w, h = label_size(e.label)
        total = poly_len(e.pts)
        cands = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86, 0.08, 0.92]
        if len(e.pts) > 2 and total > 0:
            acc, mids = 0.0, []
            for k in range(len(e.pts) - 1):
                L = math.hypot(e.pts[k + 1][0] - e.pts[k][0], e.pts[k + 1][1] - e.pts[k][1])
                if abs(e.pts[k + 1][1] - e.pts[k][1]) < 1 and L > 50:
                    mids.append((acc + L / 2) / total)
                acc += L
            cands = mids + [c for c in cands if c not in mids]
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
                pen += abs(f - 0.5) * 1.5 + (2 if so != (0, 0) else 0) + (8 if vertical else 0)
                if pen < best_pen:
                    best, bo, best_pen = f, so, pen
        e.lp, e.lo = best, bo
        (x, y), _ = poly_point(e.pts, best)
        placed.append((x + bo[0] - w / 2, y + bo[1] - h / 2, w, h))


# ============================================================================ draw.io output
FILL = {'entity': ('#dae8fc', '#6c8ebf'), 'process': ('#fff2cc', '#d6b656'), 'store': ('#d5e8d4', '#82b366'),
        'usecase': ('#ffffff', '#d79b00'), 'system': ('#fff2cc', '#d6b656'), 'term': ('#f5f5f5', '#666666'),
        'decision': ('#e1d5e7', '#9673a6'), 'fproc': ('#dae8fc', '#6c8ebf'), 'conn': ('#f5f5f5', '#666666')}


def lab_html(n):
    parts = n.label.split('\n')
    esc = [H.escape(p, quote=False) for p in parts]
    if n.kind in ('process', 'system'):
        esc[0] = '<b>' + esc[0] + '</b>'
        return '<br>'.join(esc)
    if n.kind in ('entity', 'actor'):
        return '<b>' + '<br>'.join(esc) + '</b>'
    return '<br>'.join(esc)


def node_style(n):
    f, s = FILL.get(n.kind, ('#ffffff', '#666666'))
    base = 'whiteSpace=wrap;html=1;'
    k = n.kind
    if k == 'entity':
        return base + f'rounded=0;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=12;'
    if k == 'process':
        return base + f'rounded=1;arcSize=14;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=12;'
    if k == 'store':
        return base + f'shape=partialRectangle;left=0;right=0;fillColor=#ffffff;strokeColor={s};strokeWidth=2;fontSize=12;'
    if k == 'system':
        return base + f'ellipse;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=17;'
    if k in ('usecase', 'conn'):
        return base + f'ellipse;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=12;'
    if k == 'actor':
        pos = 'verticalLabelPosition=top;verticalAlign=bottom;' if n.lbl == 'top' else 'verticalLabelPosition=bottom;verticalAlign=top;'
        return f'shape=umlActor;{pos}html=1;outlineConnect=0;strokeWidth=2;fontSize=12;fillColor=#ffffff;strokeColor=#333333;'
    if k == 'term':
        return base + f'rounded=1;arcSize=50;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=12;'
    if k == 'decision':
        return base + f'rhombus;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=12;'
    if k == 'fproc':
        return base + f'rounded=0;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=12;'
    if k == 'boundary':
        return base + 'rounded=0;fillColor=none;strokeColor=#666666;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;fontStyle=1;fontSize=14;'
    return base


def drawio_page(d):
    global FS
    FS = d.fs
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    cid = {nid: f'n{k + 2}' for k, nid in enumerate(d.order)}
    for nid in d.order:
        n = d.nodes[nid]
        if n.kind == 'boundary':
            val = H.escape('<b>' + H.escape(n.label, quote=False) + '</b>', quote=True)
        else:
            val = H.escape(lab_html(n), quote=True)
        cells.append(f'<mxCell id="{cid[nid]}" value="{val}" style="{sfs(node_style(n))}" vertex="1" parent="1"><mxGeometry x="{n.cx - n.w / 2:.0f}" y="{n.cy - n.h / 2:.0f}" width="{n.w:.0f}" height="{n.h:.0f}" as="geometry"/></mxCell>')
    for k2, nid in enumerate(d.order):
        n = d.nodes[nid]
        if False:
            x1, y1 = n.cx + n.w / 2, n.cy + n.h / 2
            cells.append(f'<mxCell id="m{k2}" value="" style="endArrow=none;html=1;strokeWidth=2;strokeColor=#6c8ebf;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="{x1 - 15 * FS:.0f}" y="{y1:.0f}" as="sourcePoint"/><mxPoint x="{x1:.0f}" y="{y1 - 15 * FS:.0f}" as="targetPoint"/></mxGeometry></mxCell>')
    for k, e in enumerate(d.edges):
        A, B = d.nodes[e.a], d.nodes[e.b]
        fx = lambda n, p: ((p[0] - (n.cx - n.w / 2)) / n.w, (p[1] - (n.cy - n.h / 2)) / n.h)
        (ax, ay), (bx, by) = fx(A, e.pa), fx(B, e.pb)
        style = ('edgeStyle=none;html=1;rounded=0;strokeColor=#555555;strokeWidth=1.5;fontSize=11;fontColor=#333333;labelBackgroundColor=#ffffff;'
                 f'exitX={ax:.3f};exitY={ay:.3f};exitDx=0;exitDy=0;exitPerimeter=0;entryX={bx:.3f};entryY={by:.3f};entryDx=0;entryDy=0;entryPerimeter=0;')
        style += 'endArrow=block;endFill=0;endSize=14;' if e.gen else 'endArrow=classic;endFill=1;'
        if e.dashed:
            style += 'dashed=1;'
        if e.both:
            style += 'startArrow=classic;startFill=1;'
        lab = '<br>'.join(H.escape(p, quote=False) for p in e.label.split('\n')) if e.label else ''
        style = sfs(style)
        gx = f' x="{2 * e.lp - 1:.2f}"' if e.label and abs(e.lp - 0.5) > 0.01 else ''
        off = f'<mxPoint x="{e.lo[0]:.0f}" y="{e.lo[1]:.0f}" as="offset"/>' if e.label and e.lo != (0, 0) else ''
        if len(e.pts) > 2:
            off += '<Array as="points">' + ''.join(f'<mxPoint x="{q[0]:.0f}" y="{q[1]:.0f}"/>' for q in e.pts[1:-1]) + '</Array>'
        cells.append(f'<mxCell id="e{k}" value="{H.escape(lab, quote=True)}" style="{style}" edge="1" parent="1" source="{cid[e.a]}" target="{cid[e.b]}"><mxGeometry{gx} relative="1" as="geometry">{off}</mxGeometry></mxCell>')
    cells.extend(legend_cells(d))
    cells.extend(title_cells(d))
    return (f'<mxGraphModel dx="1422" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" '
            f'pageScale="1" pageWidth="{d.w:.0f}" pageHeight="{d.h:.0f}" math="0" shadow="0"><root>' + ''.join(cells) + '</root></mxGraphModel>')


def mxfile(diagrams):
    out = ['<mxfile host="app.diagrams.net" agent="Claude" version="24.0.0" type="device">']
    for i, d in enumerate(diagrams):
        out.append(f'<diagram id="pt{i + 1}" name="{H.escape(d.title, quote=True)}">{drawio_page(d)}</diagram>')
    out.append('</mxfile>')
    return '\n'.join(out)


# ============================================================================ SVG output
def lines_svg(label, x, y, bold_first=False, cls='', mul=1.0):
    parts = label.split('\n')
    n = len(parts)
    fz, lh = 12 * FS * mul, 15 * FS * mul
    out = []
    for i, p in enumerate(parts):
        yy = y - (n - 1) * lh / 2 + i * lh + 0.33 * fz
        w = ' font-weight="700"' if (bold_first and i == 0) else ''
        out.append(f'<text x="{x:.1f}" y="{yy:.1f}" text-anchor="middle" class="t {cls}" style="font-size:{fz:.1f}px"{w}>{H.escape(p)}</text>')
    return ''.join(out)


def node_svg(n):
    x, y, w, h = n.cx - n.w / 2, n.cy - n.h / 2, n.w, n.h
    k = n.kind
    fz = 12 * FS
    if k == 'boundary':
        return (f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" class="k-boundary"/>'
                f'<text x="{x + 14 * FS:.1f}" y="{y + 24 * FS:.1f}" class="t tb" style="font-size:{14 * FS:.1f}px">{H.escape(n.label)}</text>')
    if k == 'actor':
        fig = (f'<g transform="translate({n.cx:.1f} {y:.1f}) scale({n.h / 84:.3f})"><circle cx="0" cy="10" r="9" class="k-actor"/>'
               f'<path d="M0 19 V52 M-20 30 H20 M0 52 L-17 80 M0 52 L17 80" class="k-actor-line"/></g>')
        parts = n.label.split('\n')
        lh = 14 * FS
        if n.lbl == 'top':
            lab = ''.join(f'<text x="{n.cx:.1f}" y="{y - 8 * FS - (len(parts) - 1 - i) * lh:.1f}" text-anchor="middle" class="t tb" style="font-size:{fz:.1f}px">{H.escape(p)}</text>' for i, p in enumerate(parts))
        else:
            lab = ''.join(f'<text x="{n.cx:.1f}" y="{y + h + 16 * FS + i * lh:.1f}" text-anchor="middle" class="t tb" style="font-size:{fz:.1f}px">{H.escape(p)}</text>' for i, p in enumerate(parts))
        return fig + lab
    if k == 'entity':
        mark = f'<path d="M{x + w - 15 * FS:.1f} {y + h:.1f} L{x + w:.1f} {y + h - 15 * FS:.1f}" class="k-actor-line"/>' if False else ''
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" class="k-entity"/>' + mark + lines_svg(n.label, n.cx, n.cy, cls='tb')
    if k == 'process':
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{14 * FS:.1f}" class="k-process"/>' + lines_svg(n.label, n.cx, n.cy, bold_first=True)
    if k == 'store':
        mark = f'<path d="M{x + w - 15 * FS:.1f} {y + h:.1f} L{x + w:.1f} {y + h - 15 * FS:.1f}" class="k-store"/>' if False else ''
        return (f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" class="k-store-bg"/>'
                f'<path d="M{x:.1f} {y:.1f} H{x + w:.1f} M{x:.1f} {y + h:.1f} H{x + w:.1f}" class="k-store"/>' + lines_svg(n.label, n.cx, n.cy) + mark)
    if k == 'usecase':
        return f'<ellipse cx="{n.cx:.1f}" cy="{n.cy:.1f}" rx="{w / 2:.1f}" ry="{h / 2:.1f}" class="k-usecase"/>' + lines_svg(n.label, n.cx, n.cy)
    if k == 'system':
        return f'<ellipse cx="{n.cx:.1f}" cy="{n.cy:.1f}" rx="{w / 2:.1f}" ry="{h / 2:.1f}" class="k-system"/>' + lines_svg(n.label, n.cx, n.cy, bold_first=True, mul=1.45)
    if k == 'conn':
        return f'<ellipse cx="{n.cx:.1f}" cy="{n.cy:.1f}" rx="{w / 2:.1f}" ry="{h / 2:.1f}" class="k-term"/>' + lines_svg(n.label, n.cx, n.cy, cls='tb')
    if k == 'term':
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{h / 2:.1f}" class="k-term"/>' + lines_svg(n.label, n.cx, n.cy, cls='tb')
    if k == 'decision':
        pts = f'{n.cx:.1f},{y:.1f} {x + w:.1f},{n.cy:.1f} {n.cx:.1f},{y + h:.1f} {x:.1f},{n.cy:.1f}'
        return f'<polygon points="{pts}" class="k-decision"/>' + lines_svg(n.label, n.cx, n.cy)
    if k == 'fproc':
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" class="k-fproc"/>' + lines_svg(n.label, n.cx, n.cy)
    return ''


def legend_items(d):
    k = d.key
    if k.startswith('uc-'):
        items = [('usecase', 'Use case'), ('actor', 'Actor'), ('boundary', 'System boundary'), ('flow', 'Association')]
        if any(e.dashed for e in d.edges):
            items.append(('dash', '«include» / «extend»'))
        if any(e.gen for e in d.edges):
            items.append(('gen', 'Generalization'))
        return items
    if k == 'context':
        return [('entity', 'External entity'), ('system', 'System (process 0)'), ('flow', 'Data flow')]
    if k.startswith('fc'):
        return [('term', 'Start / end'), ('fproc', 'Step'), ('decision', 'Decision'), ('conn', 'Connector'), ('flow', 'Flow')]
    items = [('entity', 'External entity'), ('process', 'Process'), ('store', 'Data store'), ('flow', 'Data flow')]
    if any(e.both for e in d.edges):
        items.append(('both', 'Two-way flow'))
    if any(e.dashed for e in d.edges):
        items.append(('dash', 'Reply / confirmation'))
    return items


def legend_layout(d):
    fz = max(9.5, 11 * d.fs)
    x, y = 40.0, d.h - 34.0
    out = []
    for kind, label in legend_items(d):
        w = len(label) * fz * 0.56 + 40
        out.append((kind, label, x, y, fz))
        x += w + 22
    return out


def title_svg(d):
    return (f'<text x="40" y="38" class="t tb" style="font-size:17px">{H.escape(d.title)}</text>'
            f'<path d="M40 48 H{d.w - 40}" class="k-boundary" style="stroke-width:1.2"/>')


def title_cells(d):
    return [f'<mxCell id="ttl" value="{H.escape("<b>" + H.escape(d.title, quote=False) + "</b>", quote=True)}" style="text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=17;fontColor=#222222;" vertex="1" parent="1"><mxGeometry x="40" y="16" width="{d.w - 80:.0f}" height="30" as="geometry"/></mxCell>',
            f'<mxCell id="ttlrule" value="" style="endArrow=none;html=1;strokeWidth=1;strokeColor=#888888;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="40" y="48" as="sourcePoint"/><mxPoint x="{d.w - 40:.0f}" y="48" as="targetPoint"/></mxGeometry></mxCell>']


def legend_svg(d):
    out = []
    for kind, label, x, y, fz in legend_layout(d):
        cx, cy = x + 13, y
        if kind == 'entity':
            out.append(f'<rect x="{x}" y="{cy - 8}" width="26" height="16" class="k-entity"/>')
        elif kind == 'process':
            out.append(f'<rect x="{x}" y="{cy - 8}" width="26" height="16" rx="5" class="k-process"/>')
        elif kind == 'store':
            out.append(f'<path d="M{x} {cy - 8} H{x + 26} M{x} {cy + 8} H{x + 26}" class="k-store"/>')
        elif kind == 'usecase':
            out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="13" ry="8" class="k-usecase"/>')
        elif kind == 'system':
            out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="13" ry="9" class="k-system"/>')
        elif kind == 'conn':
            out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="9" ry="9" class="k-term"/>')
        elif kind == 'term':
            out.append(f'<rect x="{x}" y="{cy - 8}" width="26" height="16" rx="8" class="k-term"/>')
        elif kind == 'fproc':
            out.append(f'<rect x="{x}" y="{cy - 8}" width="26" height="16" class="k-fproc"/>')
        elif kind == 'decision':
            out.append(f'<polygon points="{cx},{cy - 9} {x + 26},{cy} {cx},{cy + 9} {x},{cy}" class="k-decision"/>')
        elif kind == 'boundary':
            out.append(f'<rect x="{x}" y="{cy - 8}" width="26" height="16" class="k-boundary"/>')
        elif kind == 'actor':
            out.append(f'<g transform="translate({cx} {cy - 10}) scale(0.24)"><circle cx="0" cy="10" r="9" class="k-actor"/><path d="M0 19 V52 M-20 30 H20 M0 52 L-17 80 M0 52 L17 80" class="k-actor-line"/></g>')
        else:
            cls = 'edge dash' if kind == 'dash' else 'edge'
            mk = ' marker-end="url(#tri)"' if kind == 'gen' else ' marker-end="url(#ar)"'
            if kind == 'both':
                mk += ' marker-start="url(#ar)"'
            out.append(f'<path d="M{x} {cy} L{x + 26} {cy}" class="{cls}" fill="none"{mk}/>')
        out.append(f'<text x="{x + 34}" y="{cy + fz * 0.35:.1f}" class="t" style="font-size:{fz:.1f}px">{H.escape(label)}</text>')
    return ''.join(out)


def legend_cells(d):
    cells = []
    for n, (kind, label, x, y, fz) in enumerate(legend_layout(d)):
        cy = y
        st = {'entity': 'rounded=0;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;',
              'process': 'rounded=1;arcSize=25;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;',
              'store': 'shape=partialRectangle;left=0;right=0;fillColor=#ffffff;strokeColor=#82b366;strokeWidth=2;',
              'usecase': 'ellipse;fillColor=#ffffff;strokeColor=#d79b00;strokeWidth=2;',
              'system': 'ellipse;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;',
              'conn': 'ellipse;fillColor=#f5f5f5;strokeColor=#666666;strokeWidth=2;',
              'term': 'rounded=1;arcSize=50;fillColor=#f5f5f5;strokeColor=#666666;strokeWidth=2;',
              'fproc': 'rounded=0;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;',
              'decision': 'rhombus;fillColor=#e1d5e7;strokeColor=#9673a6;strokeWidth=2;',
              'boundary': 'rounded=0;fillColor=none;strokeColor=#666666;strokeWidth=2;',
              'actor': 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;outlineConnect=0;fillColor=#ffffff;strokeColor=#333333;strokeWidth=2;'}.get(kind)
        if st:
            w, h = (13, 22) if kind == 'actor' else ((18, 18) if kind == 'conn' else (26, 16))
            xx = x + (13 - w / 2 if kind in ('actor', 'conn') else 0)
            cells.append(f'<mxCell id="lg{n}" value="" style="html=1;{st}" vertex="1" parent="1"><mxGeometry x="{xx:.0f}" y="{cy - h / 2:.0f}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        else:
            style = 'endArrow=classic;html=1;strokeColor=#555555;strokeWidth=1.5;'
            if kind == 'gen':
                style = 'endArrow=block;endFill=0;endSize=10;html=1;strokeColor=#555555;strokeWidth=1.5;'
            if kind == 'dash':
                style += 'dashed=1;'
            if kind == 'both':
                style += 'startArrow=classic;startFill=1;'
            cells.append(f'<mxCell id="lg{n}" value="" style="{style}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="{x:.0f}" y="{cy:.0f}" as="sourcePoint"/><mxPoint x="{x + 26:.0f}" y="{cy:.0f}" as="targetPoint"/></mxGeometry></mxCell>')
        cells.append(f'<mxCell id="lt{n}" value="{H.escape(label, quote=True)}" style="text;html=1;align=left;verticalAlign=middle;whiteSpace=nowrap;fontSize={fz:.0f};fontColor=#333333;" vertex="1" parent="1"><mxGeometry x="{x + 32:.0f}" y="{cy - 9:.0f}" width="{len(label) * fz * 0.6 + 6:.0f}" height="18" as="geometry"/></mxCell>')
    return cells


def diagram_svg(d):
    global FS
    FS = d.fs
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {d.w:.0f} {d.h:.0f}" width="{d.w:.0f}" height="{d.h:.0f}" role="img" aria-label="{H.escape(d.title)}">']
    out.append('<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="m-fill"/></marker>'
               '<marker id="tri" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto"><path d="M0 0 L12 6 L0 12 z" class="m-hollow"/></marker></defs>')
    out.append(f'<rect x="1" y="1" width="{d.w - 2:.0f}" height="{d.h - 2:.0f}" class="k-page"/>')
    for nid in d.order:
        if d.nodes[nid].kind == 'boundary':
            out.append(node_svg(d.nodes[nid]))
    labels = []
    for e in d.edges:
        cls = 'edge' + (' dash' if e.dashed else '')
        mk = ' marker-end="url(#tri)"' if e.gen else ' marker-end="url(#ar)"'
        if e.both:
            mk += ' marker-start="url(#ar)"'
        out.append('<path d="M' + ' L'.join(f'{q[0]:.1f} {q[1]:.1f}' for q in e.pts) + f'" class="{cls}" fill="none" stroke-linejoin="round"{mk}/>')
        if e.label:
            (lx, ly), _dv = poly_point(e.pts, e.lp)
            labels.append((lx + e.lo[0], ly + e.lo[1], e.label))
    for nid in d.order:
        if d.nodes[nid].kind != 'boundary':
            out.append(node_svg(d.nodes[nid]))
    for lx, ly, text in labels:
        wd, ht = label_size(text)
        out.append(f'<rect x="{lx - wd / 2:.1f}" y="{ly - ht / 2:.1f}" width="{wd:.1f}" height="{ht:.1f}" rx="3" class="lbl-bg"/>')
    for lx, ly, text in labels:
        parts = text.split('\n')
        fz, lh = 10.5 * FS, 12.5 * FS
        for i, p in enumerate(parts):
            out.append(f'<text x="{lx:.1f}" y="{ly - (len(parts) - 1) * lh / 2 + i * lh + 0.33 * fz:.1f}" text-anchor="middle" class="t el" style="font-size:{fz:.1f}px">{H.escape(p)}</text>')
    out.append(legend_svg(d))
    out.append(title_svg(d))
    out.append('</svg>')
    return ''.join(out)


def finalize(d):
    """Scale the whole diagram onto one A4 page (portrait or landscape, whichever keeps it larger)."""
    global FS
    x0 = min(n.cx - n.w / 2 for n in d.nodes.values()); x1 = max(n.cx + n.w / 2 for n in d.nodes.values())
    y0 = min(n.cy - n.h / 2 - (34 if n.kind == 'actor' and n.lbl == 'top' else 0) for n in d.nodes.values())
    y1 = max(n.cy + n.h / 2 + (34 if n.kind == 'actor' and n.lbl != 'top' else 0) for n in d.nodes.values())
    if d.key == 'fc3':
        x1 += 90
    bw, bh = x1 - x0, y1 - y0
    best = None
    for pw, ph in ((1123, 794), (794, 1123)):
        sc = min(1.0, (pw - 72) / bw, (ph - 156) / bh)
        if best is None or sc > best[0] + 1e-6:
            best = (sc, pw, ph)
    sc, pw, ph = best
    ox = (pw - bw * sc) / 2 - x0 * sc
    oy = 56 + (ph - 100 - bh * sc) / 2 - y0 * sc
    sn = sc
    for n in d.nodes.values():
        if n.kind == 'boundary':
            n.cx, n.cy, n.w, n.h = n.cx * sc + ox, n.cy * sc + oy, n.w * sc, n.h * sc
        else:
            n.cx, n.cy, n.w, n.h = n.cx * sc + ox, n.cy * sc + oy, n.w * sn, n.h * sn
    d.w, d.h, d.fs = pw, ph, sc
    FS = d.fs
    ns = [n for n in d.nodes.values() if n.kind != 'boundary' and n.kind != 'actor']
    for i, a in enumerate(ns):
        for b in ns[i + 1:]:
            if abs(a.cx - b.cx) < (a.w + b.w) / 2 - 1 and abs(a.cy - b.cy) < (a.h + b.h) / 2 - 1:
                print('OVERLAP', d.key, a.id, b.id)


# ============================================================================ layered layout (rows ordered to cut crossings)
def pack_row(d, ids, desired, minx, maxx, gap=34):
    ids = sorted(ids, key=lambda i: desired[i])
    fwd, bwd = {}, {}
    cur = minx
    for i in ids:
        w = d.nodes[i].w
        x = max(desired[i], cur + w / 2)
        fwd[i] = x
        cur = x + w / 2 + gap
    cur = maxx
    for i in reversed(ids):
        w = d.nodes[i].w
        x = min(desired[i], cur - w / 2)
        bwd[i] = x
        cur = x - w / 2 - gap
    # centre clusters on their desired position: average of left-packed and right-packed
    xs = {i: (fwd[i] + bwd[i]) / 2 for i in ids}
    # then enforce spacing once more left to right
    cur = minx
    for i in ids:
        w = d.nodes[i].w
        xs[i] = max(xs[i], cur + w / 2)
        cur = xs[i] + w / 2 + gap
    return xs


def layered(d, ents, procs, stores, ye, yp, ys, x0, step, margin=70):
    for i, pid in enumerate(procs):
        d.nodes[pid].cx, d.nodes[pid].cy = x0 + step * i, yp
    right = x0 + step * (len(procs) - 1) + 110
    for ids, y in ((ents, ye), (stores, ys)):
        want = {}
        for i in ids:
            xs = []
            for e in d.edges:
                if e.a == i and e.b in procs: xs.append(d.nodes[e.b].cx)
                if e.b == i and e.a in procs: xs.append(d.nodes[e.a].cx)
            want[i] = sum(xs) / len(xs) if xs else x0
        pos = pack_row(d, ids, want, margin, max(right, margin + 190 * len(ids)))
        for i in ids:
            d.nodes[i].cx, d.nodes[i].cy = pos[i], y
    lo = min(n.cx - n.w / 2 for n in d.nodes.values())
    hi = max(n.cx + n.w / 2 for n in d.nodes.values())
    shift = margin - lo
    for n in d.nodes.values():
        n.cx += shift
    d.w = hi - lo + 2 * margin


def explode_layout(d, procs, yp, zig=0, gap=95, spill_last=False, wrap=0, rowh=640, ew=118, sw=148, dy=215, margin=60):
    P = set(procs)
    ents = [i for i in d.order if d.nodes[i].kind == 'entity']
    stores = [i for i in d.order if d.nodes[i].kind == 'store']
    base = set(ents + stores)
    copies, per_e, per_s = {}, {p: [] for p in procs}, {p: [] for p in procs}
    for e in d.edges:
        if e.a in base and e.b in P: x, p = e.a, e.b
        elif e.b in base and e.a in P: x, p = e.b, e.a
        else: continue
        if (x, p) not in copies:
            copies[(x, p)] = f'{x}@{p}'
            (per_e if x in ents else per_s)[p].append(x)
    for (x, p), nid in copies.items():
        o = d.nodes[x]
        d.nodes[nid] = Node(nid, o.kind, o.label, 0, 0, ew if o.kind == 'entity' else sw, o.h)
        d.order.append(nid)
    for e in d.edges:
        if e.a in base: e.a = copies[(e.a, e.b)]
        elif e.b in base: e.b = copies[(e.b, e.a)]
    for x in base:
        del d.nodes[x]; d.order.remove(x)
    spill = []
    cursor, cxs, maxr = margin, {}, 0
    for idx, p in enumerate(procs):
        ee = sorted(per_e[p], key=ents.index); ss = sorted(per_s[p], key=stores.index)
        if spill_last and idx == len(procs) - 1 and len(ee) > 4:
            spill = ee[4:]; ee = ee[:4]
        if wrap and idx and idx % wrap == 0:
            maxr = max(maxr, cursor - gap); cursor = margin
        W = max(215, len(ee) * (ew + 8), len(ss) * (sw + 8))
        cx = cursor + W / 2; cursor += W + gap
        ypp = yp + (zig if idx % 2 else 0) + (idx // wrap if wrap else 0) * rowh
        d.nodes[p].cx, d.nodes[p].cy = cx, ypp
        for k, x in enumerate(ee):
            n = d.nodes[f'{x}@{p}']; n.cx, n.cy = cx + (k - (len(ee) - 1) / 2) * (ew + 8), ypp - dy
        for k, x in enumerate(ss):
            n = d.nodes[f'{x}@{p}']; n.cx, n.cy = cx + (k - (len(ss) - 1) / 2) * (sw + 8), ypp + dy
        cxs[p] = (cx, W, ypp)
    right = max(maxr, cursor - gap)
    if spill:
        p = procs[-1]; cx, W, ypp = cxs[p]
        for k, x in enumerate(spill):
            n = d.nodes[f'{x}@{p}']; n.cx, n.cy = cx + W / 2 + 150, ypp + (k - (len(spill) - 1) / 2) * 105
        right = max(maxr, cx + W / 2 + 150 + ew / 2)
    ys = [n.cy - n.h / 2 for n in d.nodes.values()]; ye = [n.cy + n.h / 2 for n in d.nodes.values()]
    sh = 50 - min(ys)
    for n in d.nodes.values(): n.cy += sh
    d.w = right + margin
    d.h = max(ye) + sh + 50


def scale_of(d):
    x0 = min(n.cx - n.w / 2 for n in d.nodes.values()); x1 = max(n.cx + n.w / 2 for n in d.nodes.values())
    y0 = min(n.cy - n.h / 2 for n in d.nodes.values()); y1 = max(n.cy + n.h / 2 for n in d.nodes.values())
    return max(min(1.0, (pw - 72) / (x1 - x0), (ph - 72) / (y1 - y0)) for pw, ph in ((1123, 794), (794, 1123)))


def dfd_pages(d, procs, **kw):
    import copy
    pe = set(procs)
    n = len(procs)

    def sub_of(chunk, key, title):
        cs = set(chunk)
        sub = Diagram(key, d.group, title, d.w, d.h, d.blurb)
        es = [copy.deepcopy(e) for e in d.edges if e.a in cs or e.b in cs]
        need = {x for e in es for x in (e.a, e.b)}
        for nid in d.order:
            if nid in need:
                sub.nodes[nid] = copy.deepcopy(d.nodes[nid]); sub.order.append(nid)
        sub.edges = es
        return sub

    if any(e.a in pe and e.b in pe for e in d.edges):
        explode_layout(d, procs, 400, **kw)
        return [d]
    for size in range(n, 0, -1):
        chunks = [procs[k:k + size] for k in range(0, n, size)]
        subs = [sub_of(c, d.key, d.title) for c in chunks]
        ok = True
        for sb, c in zip(subs, chunks):
            t = copy.deepcopy(sb)
            explode_layout(t, c, 400, **kw)
            if scale_of(t) < 0.8 and size > 1:
                ok = False
                break
        if ok:
            break
    if size == n:
        explode_layout(d, procs, 400, **kw)
        return [d]
    out = []
    for k, c in enumerate(chunks):
        sb = sub_of(c, f'{d.key}-{k + 1}', f'{d.title} ({k + 1} of {len(chunks)})')
        explode_layout(sb, c, 400, **kw)
        out.append(sb)
    return out


def agg(d):
    """One arrow per pair of shapes: a flow and its reply become a single double-headed arrow."""
    out, used = [], set()
    for k, e in enumerate(d.edges):
        if k in used:
            continue
        for k2 in range(k + 1, len(d.edges)):
            f = d.edges[k2]
            if k2 not in used and f.a == e.b and f.b == e.a and not e.both and not f.both:
                e.both = True
                if e.label and f.label:
                    e.label = e.label + ' /' + chr(10) + f.label
                elif f.label:
                    e.label = f.label
                used.add(k2)
                break
        out.append(e)
    d.edges = out


def seg_cross(a, b, c, e):
    def o(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    if a == c or a == e or b == c or b == e:
        return False
    return o(a, b, c) * o(a, b, e) < 0 and o(c, e, a) * o(c, e, b) < 0


def order_row(ids, pos_of, links, fixed_y, other_pts):
    """Pick the left-to-right order of one row of shapes that gives the fewest crossing arrows."""
    import random
    n = len(ids)
    if n < 2:
        return list(ids)

    def cost(order):
        xs = {i: pos_of(k) for k, i in enumerate(order)}
        segs = []
        for i in order:
            for q in links.get(i, []):
                segs.append(((xs[i], fixed_y), other_pts[q]))
        c = 0
        for a in range(len(segs)):
            for b in range(a + 1, len(segs)):
                if seg_cross(segs[a][0], segs[a][1], segs[b][0], segs[b][1]):
                    c += 1000
        return c + sum(abs(sg[0][0] - sg[1][0]) for sg in segs) * 0.05
    rnd = random.Random(7)
    best, bc = None, 1e18
    starts = [sorted(ids, key=lambda i: sum(other_pts[q][0] for q in links.get(i, [])) / max(1, len(links.get(i, []))))]
    for _ in range(25):
        o = list(ids); rnd.shuffle(o); starts.append(o)
    for o in starts:
        cur, cc = list(o), cost(o)
        improved = True
        while improved:
            improved = False
            for a in range(n):
                for b in range(a + 1, n):
                    t = list(cur); t[a], t[b] = t[b], t[a]
                    ct = cost(t)
                    if ct < cc - 1e-9:
                        cur, cc, improved = t, ct, True
        if cc < bc:
            best, bc = cur, cc
    return best


def shared_layout(d, procs, yp, zig=0, step=250, dye=300, dys=290, ew=130, sw=170, margin=60):
    ents = [i for i in d.order if d.nodes[i].kind == 'entity']
    stores = [i for i in d.order if d.nodes[i].kind == 'store']
    pts = {}
    for k, pid in enumerate(procs):
        n = d.nodes[pid]
        n.cx, n.cy = margin + 110 + k * step, yp + (zig if k % 2 else 0)
        pts[pid] = (n.cx, n.cy)
    pxs = [pts[q][0] for q in procs]
    center = (pxs[0] + pxs[-1]) / 2
    ytop = min(pts[q][1] for q in procs) - dye
    ybot = max(pts[q][1] for q in procs) + dys
    for ids, y, w in ((ents, ytop, ew), (stores, ybot, sw)):
        if not ids:
            continue
        pitch = max(w + 26, (pxs[-1] - pxs[0] + step) / len(ids))
        pos_of = lambda k, n=len(ids), pitch=pitch: center + (k - (n - 1) / 2) * pitch
        links = {i: [] for i in ids}
        for e in d.edges:
            if e.a in links and e.b in pts: links[e.a].append(e.b)
            if e.b in links and e.a in pts: links[e.b].append(e.a)
        order = order_row(ids, pos_of, links, y, pts)
        for k, i in enumerate(order):
            d.nodes[i].cx, d.nodes[i].cy = pos_of(k), y
            d.nodes[i].w = w
    ys = [n.cy - n.h / 2 for n in d.nodes.values()]
    sh = 50 - min(ys)
    for n in d.nodes.values():
        n.cy += sh
    d.w, d.h = 2000, 1000


def auto_dup(d, procs):
    """Repeat a store or entity (with a corner slash) when it serves processes that are not neighbours."""
    import copy
    idx = {p: k for k, p in enumerate(procs)}
    for x in [i for i in d.order if d.nodes[i].kind in ('entity', 'store')]:
        link = sorted({idx[e.b if e.a == x else e.a] for e in d.edges if (e.a == x and e.b in idx) or (e.b == x and e.a in idx)})
        clusters = []
        for k in link:
            if clusters and k - clusters[-1][-1] <= 1:
                clusters[-1].append(k)
            else:
                clusters.append([k])
        if len(clusters) < 2:
            continue
        d.nodes[x].dup = True
        for c, cl in enumerate(clusters[1:], 1):
            nid = f'{x}~{c}'
            d.nodes[nid] = copy.deepcopy(d.nodes[x]); d.nodes[nid].id = nid; d.order.append(nid)
            ps = {procs[k] for k in cl}
            for e in d.edges:
                if e.a == x and e.b in ps: e.a = nid
                elif e.b == x and e.a in ps: e.b = nid


def columns_layout(d, procs, gap=310, margin=50):
    """People on the left, processes in the middle, data stores on the right: arrows run sideways between neighbouring columns."""
    for n_ in d.nodes.values():
        if n_.kind == 'process': n_.h = min(n_.h, 84)
        elif n_.kind == 'store': n_.h = 40
        elif n_.kind == 'entity': n_.h = 50
    # one lane of at least 15 px per arrow on each side, so arrows never bunch up
    cnt = {}
    for e in d.edges:
        for nid in (e.a, e.b):
            n_ = d.nodes[nid]
            other = d.nodes[e.b if nid == e.a else e.a]
            side = 'L' if n_.kind == 'process' and other.kind == 'entity' else ('R' if n_.kind == 'process' else 'S')
            cnt[(nid, side)] = cnt.get((nid, side), 0) + 1
    for (nid, side), c in cnt.items():
        n_ = d.nodes[nid]
        if n_.kind in ('process', 'entity', 'store') and side != 'S' or n_.kind in ('entity', 'store'):
            n_.h = max(n_.h, 15 * c + 14)
    ents = [i for i in d.order if d.nodes[i].kind == 'entity']
    stores = [i for i in d.order if d.nodes[i].kind == 'store']
    # parties that only talk to the first / last process sit directly above / below it
    def only(i):
        return {e.b if e.a == i else e.a for e in d.edges if e.a == i or e.b == i}
    top_ids = [i for i in ents if len(procs) > 2 and only(i) == {procs[0]}] if len(procs) > 2 else []
    bot_ids = [i for i in ents if len(procs) > 2 and only(i) == {procs[-1]}] if len(procs) > 2 else []
    if len(bot_ids) < 2:
        bot_ids = []
    if len(top_ids) < 1:
        top_ids = []
    ents = [i for i in ents if i not in top_ids and i not in bot_ids]
    np_, ne, ns = len(procs), len(ents), len(stores)
    ph_ = max([d.nodes[q].h for q in procs] + [0]) + 20
    eh_ = max([d.nodes[i].h for i in ents] + [0]) + 16
    sh_ = max([d.nodes[i].h for i in stores] + [0]) + 16
    H = max((np_ - 1) * ph_, (ne - 1) * eh_, (ns - 1) * sh_, 1)

    def ys(m):
        return [0.0] if m == 1 else [-H / 2 + k * H / (m - 1) for k in range(m)]
    pw = max(d.nodes[q].w for q in procs)
    pts = {}
    for q, y in zip(procs, ys(np_)):
        d.nodes[q].cx, d.nodes[q].cy = 0.0, y
        pts[q] = (y, 0.0)
    ex = -(pw / 2 + gap + 65)
    sx = pw / 2 + gap + 80
    for ids, x in ((ents, ex), (stores, sx)):
        if not ids:
            continue
        yy = ys(len(ids))
        links = {i: [] for i in ids}
        for e in d.edges:
            if e.a in links and e.b in pts: links[e.a].append(e.b)
            if e.b in links and e.a in pts: links[e.b].append(e.a)
        order = order_row(ids, lambda k, yy=yy: yy[k], links, x, pts)
        for k, i in enumerate(order):
            d.nodes[i].cx, d.nodes[i].cy = x, yy[k]
    for ids, y, ent_side in ((top_ids, d.nodes[procs[0]].cy - 150, 'bottom'), (bot_ids, d.nodes[procs[-1]].cy + 150, 'top')):
        for k, i in enumerate(ids):
            d.nodes[i].cx, d.nodes[i].cy = (k - (len(ids) - 1) / 2) * 160, y
    for e in d.edges:
        ka, kb = d.nodes[e.a].kind, d.nodes[e.b].kind
        if e.a in top_ids or e.b in top_ids or e.a in bot_ids or e.b in bot_ids:
            ent_first = e.a in top_ids or e.a in bot_ids
            tops = e.a in top_ids or e.b in top_ids
            if ent_first:
                e.sa, e.sb = ('bottom', 'top') if tops else ('top', 'bottom')
            else:
                e.sa, e.sb = ('top', 'bottom') if tops else ('bottom', 'top')
        elif ka == 'entity': e.sa, e.sb = 'right', 'left'
        elif kb == 'entity': e.sa, e.sb = 'left', 'right'
        elif ka == 'store': e.sa, e.sb = 'left', 'right'
        elif kb == 'store': e.sa, e.sb = 'right', 'left'
    x0 = min(n.cx - n.w / 2 for n in d.nodes.values()); y0 = min(n.cy - n.h / 2 for n in d.nodes.values())
    for n in d.nodes.values():
        n.cx += margin - x0; n.cy += margin - y0
    d.w, d.h = 2000, 1000


def std_page(d, procs, yp, zig, step, dup=False):
    d.ortho = True
    if dup:
        auto_dup(d, procs)
    agg(d)
    if not any(e.a in procs and e.b in procs for e in d.edges):
        columns_layout(d, procs)
        return
    shared_layout(d, procs, yp, zig, step)


def split_sheets(d, procs, chunks, key, title):
    import copy
    out = []
    for k, chunk in enumerate(chunks):
        cs = set(chunk)
        sub = Diagram(f'{key}{k + 1}', d.group, f'{title} (sheet {k + 1} of {len(chunks)})', d.w, d.h, d.blurb + f' This sheet covers processes {k * 3 + 1}.0 to {k * 3 + 3}.0.')
        es = [copy.deepcopy(e) for e in d.edges if e.a in cs or e.b in cs]
        need = {x for e in es for x in (e.a, e.b)}
        for nid in d.order:
            if nid in need:
                sub.nodes[nid] = copy.deepcopy(d.nodes[nid]); sub.order.append(nid)
        sub.edges = es
        std_page(sub, chunk, 400, 0, 245)
        out.append(sub)
    return out


# ============================================================================ shared names
OWNER, FINDER, NFC = 'Pet Owner', 'Finder /\nCommunity Member', 'NFC Collar Tag'
STAFF, MGR, SYSADM = 'Facility Staff', 'Facility Manager', 'System\nAdministrator'
GOOGLE, TURN, BREVO = 'Google\n(Sign-In & Maps)', 'Cloudflare\nTurnstile', 'Brevo\nEmail Service'
D = []

# ---------------------------------------------------------------------------- 1. Use case: public & owner
d = Diagram('uc-public', 'Use case', 'Use Case: Public & Owner App', 1150, 1000,
            'What finders and pet owners can do in the PawTrack owner app. A signed-in owner can do everything a finder can.', 'radial')
d.n('bd', 'boundary', 'PawTrack: Public & Owner App', 620, 515, 640, 940)
uc = ['Browse missing pets & map', 'Report a sighting / found pet', 'Scan an NFC collar tag', 'Browse impound facilities & animals',
      'Sign in with Google', 'Register pet profile', 'Link NFC tag to pet', 'Report missing pet', 'Verify a sighting match',
      'Claim impounded pet', 'Pay penalty ticket', 'Receive notifications', 'Manage settings (theme, language)']
ys = [120 + 66 * k for k in range(len(uc))]
for k, t in enumerate(uc):
    d.n(f'u{k}', 'usecase', t, 620, ys[k], 300, 50)
d.n('finder', 'actor', 'Finder /\nCommunity Member', 120, sum(ys[:4]) / 4, lbl='top')
d.n('owner', 'actor', 'Pet Owner', 120, sum(ys[4:]) / 9)
d.n('google', 'actor', 'Google\n(Sign-In & Maps)', 1060, 340)
for k in range(4):
    d.e('finder', f'u{k}')
for k in range(4, 13):
    d.e('owner', f'u{k}')
d.e('owner', 'finder', 'inherits', gen=True)
for k in (0, 1, 4, 7):
    d.e('google', f'u{k}')
d.e('u6', 'u5', '«extend»', dashed=True)
d.e('u10', 'u9', '«extend»', dashed=True)
D.append(d)

# ---------------------------------------------------------------------------- 2. Use case: admin console
d = Diagram('uc-admin', 'Use case', 'Use Case: Admin Console', 1250, 1100,
            'What facility staff, facility managers and the system administrator do in the admin console. A manager can do everything staff can.', 'radial')
d.n('bd', 'boundary', 'PawTrack: Admin Console', 650, 540, 720, 1010)
uc = ['Sign in / request admin access (OTP)', 'Change email / set or change password (OTP)', 'Log animal intake (NFC or manual)',
      'View dashboard, breakdown, heatmap, reports', 'Manage impound cases (edit, +24h)', 'Release animal to owner',
      'Record or waive penalty ticket', 'Confirm transfer arrival', 'View alerts', 'Switch active facility',
      'Manage team & invite code', 'Edit facility details', 'Add / delete facility or sub-facility', 'Convert facility main / sub',
      'Review access requests']
ys = [110 + 60 * k for k in range(len(uc))]
for k, t in enumerate(uc):
    d.n(f'u{k}', 'usecase', t, 650, ys[k], 360, 46)
d.n('staff', 'actor', 'Facility Staff', 120, sum(ys[:10]) / 10, lbl='top')
d.n('mgr', 'actor', 'Facility Manager', 120, sum(ys[10:14]) / 4 + 10)
d.n('adm', 'actor', 'System\nAdministrator', 120, ys[14] + 10)
d.n('brevo', 'actor', 'Brevo\nEmail Service', 1150, 170)
d.n('google', 'actor', 'Google\n(Maps)', 1150, 400)
for k in range(10):
    d.e('staff', f'u{k}')
for k in range(10, 14):
    d.e('mgr', f'u{k}')
d.e('adm', 'u14')
d.e('mgr', 'staff', 'inherits', gen=True)
d.e('brevo', 'u0'); d.e('brevo', 'u1')
d.e('google', 'u2'); d.e('google', 'u3')
d.e('u5', 'u6', '«include»', dashed=True)
D.append(d)

# ---------------------------------------------------------------------------- 3. Context diagram (DFD level 0)
d = Diagram('context', 'Context', 'DFD Level 0: Context Diagram', 1500, 960,
            'PawTrack as one process, with every outside person and service it exchanges data with.', 'context')
d.n('sys', 'system', '0\nPawTrack Pet Recovery\n& Impoundment System', 750, 450, 400, 240)
d.n('owner', 'entity', OWNER, 250, 370)
d.n('finder', 'entity', FINDER, 250, 450)
d.n('nfc', 'entity', NFC, 250, 530)
d.n('staff', 'entity', STAFF, 1250, 370)
d.n('mgr', 'entity', MGR, 1250, 450)
d.n('adm', 'entity', SYSADM, 1250, 530)
d.n('google', 'entity', GOOGLE, 655, 120)
d.n('turn', 'entity', TURN, 845, 120)
d.n('brevo', 'entity', BREVO, 750, 780)
pairs = [('owner', 'sign-in, pet & tag details,\nmissing reports, claims, payments', 'match alerts, notifications,\nclaim status, penalty tickets'),
         ('finder', 'sighting / found reports,\ntag scans', 'pet & owner contact,\nmissing pets, impound lists'),
         ('staff', 'login, intake details, case\nupdates, release, payments', 'case lists, alerts,\ndashboards, reports'),
         ('mgr', 'facility details, team &\ninvite code changes', 'team list, invite code,\nfacility records'),
         ('adm', 'access approvals', 'pending access requests'),
         ('google', 'sign-in & map requests', 'verified identity,\nmaps & geocoding'),
         ('turn', 'challenge token', 'human-check result')]
for ent, l1, l2 in pairs:
    if ent in ('google', 'turn'):
        d.e('sys', ent, l1)
        d.e(ent, 'sys', l2)
    else:
        d.e(ent, 'sys', l1)
        d.e('sys', ent, l2)
d.e('nfc', 'sys', 'tag ID (NDEF link)')
d.e('sys', 'brevo', 'OTP & notice emails')
d.e('brevo', 'sys', 'delivery status')
D.append(d)


# ---------------------------------------------------------------------------- 4. DFD level 1 (system)
d = Diagram('dfd1', 'Data flow', 'DFD Level 1: PawTrack System', 2000, 1000,
            'The context diagram opened up into its six main processes, the eight data stores they share, and the people and services around them.')
for id, lab, dup in [('nfc', NFC, 0), ('finder', FINDER, 1), ('finder2', FINDER, 1), ('owner1', OWNER, 1), ('owner2', OWNER, 1), ('google', GOOGLE, 1), ('google2', GOOGLE, 1), ('staff', 'Facility Staff /\nManager', 0),
                     ('adm', SYSADM, 0), ('turn', TURN, 0), ('brevo', BREVO, 0)]:
    d.n(id, 'entity', lab, 0, 0, dup=bool(dup))
pn = ['1.0\nManage Pets &\nNFC Tags', '2.0\nHandle Missing &\nSighting Reports', '3.0\nSend Alerts &\nReports',
      '4.0\nProcess Impoundment\n& Claims', '5.0\nManage Facilities\n& Teams', '6.0\nManage Accounts\n& Authentication']
procs = [f'p{i + 1}' for i in range(6)]
for pid, t in zip(procs, pn):
    d.n(pid, 'process', t, 0, 0, 200, 100)
sn = ['D1  Pets & NFC Tags', 'D2  Reports & Sightings', 'D3  Notifications', 'D4  Impound Records', 'D5  Penalty Tickets',
      'D6  Facilities & Teams', 'D7  Accounts', 'D8  Verification Codes']
for i, t in enumerate(sn):
    d.n(f'd{i + 1}', 'store', t, 0, 0, 150, 50)
d.n('d1b', 'store', sn[0], 0, 0, 150, 50, dup=True)
d.n('d2b', 'store', sn[1], 0, 0, 150, 50, dup=True)
d.nodes['d1'].dup = True
d.nodes['d2'].dup = True
d.e('nfc', 'p1', 'tag ID')
d.e('finder', 'p1', 'tag scan'); d.e('p1', 'finder', 'pet & owner contact')
d.e('owner1', 'p1', 'pet details, tag link'); d.e('p1', 'owner1', 'pet records')
d.e('owner1', 'p2', 'missing report'); d.e('finder', 'p2', 'sighting / found report'); d.e('google', 'p2', 'geocoded places')
d.e('p3', 'owner2', 'alerts & notifications'); d.e('p3', 'staff', 'alerts, dashboards,\nbreakdown, reports')
d.e('owner2', 'p4', 'claim documents, payment'); d.e('p4', 'owner2', 'claim result, penalty ticket')
d.e('staff', 'p4', 'intake, case updates, release'); d.e('p4', 'staff', 'case lists')
d.e('p4', 'finder2', 'public facility & animal lists')
d.e('staff', 'p5', 'facility & team changes,\njoin with invite code'); d.e('p5', 'staff', 'team list, invite code')
d.e('owner2', 'p6', 'sign-in')
d.e('staff', 'p6', 'login, access request,\nchange email / password'); d.e('p6', 'staff', 'session, code result')
d.e('adm', 'p6', 'access decisions'); d.e('p6', 'adm', 'access requests')
d.e('google2', 'p6', 'verified identity'); d.e('turn', 'p6', 'human-check result'); d.e('p6', 'brevo', 'OTP & notice emails')
for a, b in (('p1', 'd1'), ('p2', 'd2'), ('p4', 'd4'), ('p4', 'd5'), ('p5', 'd6'), ('p5', 'd7'), ('p6', 'd7'), ('p6', 'd8')):
    d.e(a, b, both=True)
for a, b in (('d1', 'p2'), ('d2b', 'p3'), ('d4', 'p3'), ('d1b', 'p4'), ('d6', 'p4'), ('p3', 'd3')):
    d.e(a, b)
D.extend(split_sheets(d, procs, [procs[:3], procs[3:]], 'dfd1s', 'DFD Level 1: PawTrack System'))


# ---------------------------------------------------------------------------- DFD level 1 / 2 helpers
def l1(key, title, blurb, ents, procs, stores, edges, step=300, yp=420, ys=760):
    dd = Diagram(key, 'Data flow', title, 1500, 900, blurb)
    for id, lab, _ in ents:
        dd.n(id, 'entity', lab, 0, 0)
    for id, lab in procs:
        dd.n(id, 'process', lab, 0, 0, 220, 100)
    for id, lab in stores:
        dd.n(id, 'store', lab, 0, 0, 205, 52)
    for ed in edges:
        dd.e(*ed[:3], **(ed[3] if len(ed) > 3 else {}))
    std_page(dd, [p[0] for p in procs], 400, 0, 250, dup=True)
    return [dd]


D.extend(l1('dfd1-1', 'DFD Level 2: 1.0 Pets & NFC Tags', 'How a pet is registered, linked to a collar tag, edited and found again by a tag scan.',
            [('owner', OWNER, 0), ('nfc', NFC, 0), ('finder', FINDER, 0)],
            [('p1', '1.1\nRegister\npet profile'), ('p2', '1.2\nLink NFC tag\nto pet'), ('p3', '1.3\nUpdate or\nremove pet'), ('p4', '1.4\nLook up pet by\ntag scan')],
            [('d1', 'D1.1  Registered Pets'), ('d2', 'D1.2  NFC Tags')],
            [('owner', 'p1', 'pet details & photo'), ('p1', 'owner', 'pet saved'), ('owner', 'p2', 'tag code'), ('nfc', 'p2', 'tag ID'),
             ('owner', 'p3', 'edits / delete'), ('finder', 'p4', 'tag scan'), ('p4', 'finder', 'pet & owner contact'), ('nfc', 'p4', 'tag ID'),
             ('p1', 'd1', 'new pet record'), ('d1', 'p2', 'pet record'), ('p2', 'd2', 'tag-pet link'), ('p3', 'd1', 'updated record', {'both': True}),
             ('d2', 'p4', 'linked pet id'), ('d1', 'p4', 'pet & contact details')]))

D.extend(l1('dfd1-2', 'DFD Level 2: 2.0 Missing & Sighting Reports', 'How missing-pet reports and community sightings are filed, matched, verified and closed.',
            [('owner', OWNER, 0), ('google', GOOGLE, 0), ('finder', FINDER, 0)],
            [('p1', '2.1\nFile missing-pet\nreport'), ('p2', '2.2\nSubmit sighting /\nfound report'), ('p3', '2.3\nMatch & verify\nsightings'), ('p4', '2.4\nResolve case\n(reunited / archive)')],
            [('d1', 'D2.1  Missing Reports'), ('d2', 'D2.2  Community Sightings'), ('d3', 'D1  Registered Pets')],
            [('owner', 'p1', 'report details, last-seen pin'), ('google', 'p1', 'geocoded address'), ('d3', 'p1', 'pet profile'), ('p1', 'd1', 'missing report'),
             ('finder', 'p2', 'sighting details, photo, pin'), ('google', 'p2', 'geocoded address'), ('p2', 'd2', 'sighting'),
             ('d1', 'p3', 'open reports'), ('d2', 'p3', 'new sightings'), ('p3', 'owner', 'possible-match alert'), ('owner', 'p3', 'verify / dismiss'), ('p3', 'd2', 'verified status'),
             ('owner', 'p4', 'mark found / reunited'), ('p4', 'd1', 'closed report'), ('p4', 'd2', 'archive linked sightings')]))

D.extend(l1('dfd1-3', 'DFD Level 2: 3.0 Alerts & Reports', 'How notifications are created, and how dashboards, breakdowns, heatmaps and report lists are built.',
            [('owner', OWNER, 0), ('staff', STAFF, 0), ('mgr', MGR, 0)],
            [('p1', '3.1\nCreate\nnotifications'), ('p2', '3.2\nBuild dashboard\n& breakdown'), ('p3', '3.3\nBuild heatmap &\nreport lists'), ('p4', '3.4\nShow alerts\nfeed')],
            [('d1', 'D2  Reports & Sightings'), ('d2', 'D4  Impound Records'), ('d3', 'D5  Penalty Tickets'), ('d4', 'D6  Facilities & Teams'), ('d5', 'D3  Notifications')],
            [('d1', 'p1', 'new reports & sightings'), ('d2', 'p1', 'intake & deadline events'), ('p1', 'd5', 'notification'), ('d5', 'p4', 'notifications'),
             ('p4', 'owner', 'alerts'), ('p4', 'staff', 'operational alerts'), ('d2', 'p2', 'cases'), ('d3', 'p2', 'tickets'), ('d4', 'p2', 'capacity'),
             ('p2', 'staff', 'dashboard'), ('p2', 'mgr', 'breakdown'), ('d1', 'p3', 'reports & sightings'), ('p3', 'staff', 'heatmap & lists')]))

D.extend(l1('dfd1-4', 'DFD Level 2: 4.0 Impoundment & Claims', 'From logging an animal at a facility, through the 72-hour claim window, to release, penalty tickets and transfers.',
            [('staff', STAFF, 0), ('owner', OWNER, 0), ('finder', FINDER, 0)],
            [('p1', '4.1\nLog intake'), ('p2', '4.2\nHold & monitor\nclaim window'), ('p3', '4.3\nClaim &\nrelease'), ('p4', '4.4\nIssue & settle\npenalty'), ('p5', '4.5\nTransfer between\nfacilities'), ('p6', '4.6\nPublish impound\nlists')],
            [('d1', 'D1  Pets & NFC Tags'), ('d2', 'D4  Impound Records'), ('d3', 'D5  Penalty Tickets'), ('d4', 'D6  Facilities & Teams'), ('d5', 'D3  Notifications')],
            [('staff', 'p1', 'intake details, photo, pin'), ('d1', 'p1', 'pet by tag'), ('d4', 'p1', 'facility & cage'), ('p1', 'd2', 'record + 72h deadline'), ('p1', 'd3', 'ticket (if missing)'), ('p1', 'd5', 'guardian alert'),
             ('d2', 'p2', 'active cases'), ('p2', 'staff', 'overdue / due-soon list'), ('staff', 'p2', 'extend +24h'), ('p2', 'd2', 'new deadline'),
             ('owner', 'p3', 'claim documents'), ('p3', 'owner', 'release confirmation'), ('staff', 'p3', 'verify & release'), ('d3', 'p3', 'penalty status'), ('p3', 'd2', 'closed case'),
             ('staff', 'p4', 'payment / waiver'), ('p4', 'd3', 'ticket updated'), ('p4', 'owner', 'penalty ticket'),
             ('d2', 'p5', 'overdue sub-facility pets'), ('p5', 'd2', 'transfer status'), ('staff', 'p5', 'arrival confirmation'), ('d4', 'p5', 'main facility'),
             ('d2', 'p6', 'records'), ('d4', 'p6', 'facilities'), ('p6', 'finder', 'facility & animal lists')], step=255))

D.extend(l1('dfd1-5', 'DFD Level 2: 5.0 Facilities & Teams', 'How a manager registers and edits facilities, runs the team, adds or deletes facilities and switches the active one.',
            [('mgr', MGR, 0), ('staff', STAFF, 0)],
            [('p1', '5.1\nRegister / edit\nfacility'), ('p2', '5.2\nManage team &\ninvite code'), ('p3', '5.3\nAdd or delete\nfacility'), ('p4', '5.4\nConvert main /\nsub-facility'), ('p5', '5.5\nChoose active\nfacility')],
            [('d1', 'D6  Facilities & Teams'), ('d2', 'D7  Accounts'), ('d3', 'D4  Impound Records'), ('d4', 'D5  Penalty Tickets')],
            [('mgr', 'p1', 'details & photo'), ('p1', 'd1', 'facility record'), ('mgr', 'p2', 'invite / role / remove'), ('p2', 'd2', 'membership', {'both': True}), ('p2', 'd1', 'invite code'),
             ('mgr', 'p3', 'add / delete request'), ('p3', 'mgr', 'result or blockers'), ('d3', 'p3', 'open cases check'), ('d4', 'p3', 'unpaid tickets check'), ('p3', 'd1', 'facility added / removed'),
             ('mgr', 'p4', 'type change'), ('p4', 'd1', 'parent updated'), ('staff', 'p5', 'choice'), ('p5', 'staff', 'facility-scoped views'), ('d1', 'p5', 'facilities in tree')], step=280))

D.extend(l1('dfd1-6', 'DFD Level 2: 6.0 Accounts & Authentication', 'Sign-in, admin access requests with an emailed code, approval by the administrator, and changing email or password.',
            [('google', GOOGLE, 0), ('turn', TURN, 0), ('owner', OWNER, 0), ('staff', 'Facility Staff /\nManager', 0), ('brevo', BREVO, 0), ('adm', SYSADM, 0)],
            [('p1', '6.1\nSign in'), ('p2', '6.2\nRequest admin access\n(OTP sign-up)'), ('p3', '6.3\nReview access\nrequests'), ('p4', '6.4\nChange email or\npassword (OTP)')],
            [('d1', 'D7  Accounts'), ('d2', 'D8  Verification Codes')],
            [('owner', 'p1', 'credentials / Google sign-in'), ('staff', 'p1', 'email + password'), ('google', 'p1', 'verified identity'), ('turn', 'p1', 'human-check result'),
             ('p1', 'staff', 'session'), ('p1', 'd1', 'profile lookup', {'both': True}),
             ('staff', 'p2', 'details, password, code'), ('p2', 'd2', 'code hash'), ('p2', 'brevo', 'sign-up code email'), ('p2', 'd1', 'pending request'),
             ('d1', 'p3', 'pending requests'), ('adm', 'p3', 'approve / reject'), ('p3', 'd1', 'status updated'),
             ('staff', 'p4', 'change request, code, new password'), ('p4', 'staff', 'result'), ('p4', 'brevo', 'code email & notice'), ('p4', 'd2', 'code', {'both': True}), ('p4', 'd1', 'email / password updated')], step=330))


def l2(key, title, blurb, ents, procs, stores, edges, step=300):
    dd = Diagram(key, 'Data flow', title, 1500, 900, blurb)
    for id, lab, _ in ents:
        dd.n(id, 'entity', lab, 0, 0)
    for id, lab in procs:
        dd.n(id, 'process', lab, 0, 0, 220, 104)
    for id, lab in stores:
        dd.n(id, 'store', lab, 0, 0, 205, 52)
    for ed in edges:
        dd.e(*ed[:3], **(ed[3] if len(ed) > 3 else {}))
    pids = [p[0] for p in procs]
    std_page(dd, pids, 380, 150, 250, dup=True)
    return dd


D.append(l2('dfd2-4-1', 'DFD Level 3: 4.1 Log Intake', 'The steps inside "Log intake": from a tag scan to a saved impound record, the 72-hour clock and the guardian alert.',
            [('staff', STAFF, 0), ('nfc', NFC, 0)],
            [('a', '4.1.1\nStart intake (scan\nNFC or manual)'), ('b', '4.1.2\nLook up pet; check\nnot already held'), ('c', '4.1.3\nCapture details,\nphoto, pickup pin'),
             ('d', '4.1.4\nChoose facility\n& cage'), ('e', '4.1.5\nSave record, start\n72-hour clock'), ('f', '4.1.6\nIssue ticket &\nalert guardian')],
            [('s1', 'D1  Pets & NFC Tags'), ('s2', 'D4  Impound Records'), ('s3', 'D6  Facilities & Teams'), ('s4', 'D5  Penalty Tickets'), ('s5', 'D3  Notifications')],
            [('nfc', 'a', 'tag ID'), ('staff', 'a', 'scan / manual entry'), ('a', 'b', 'tag code'), ('s1', 'b', 'pet profile & guardian'), ('s2', 'b', 'active holdings'),
             ('b', 'c', 'pet match or "stray"'), ('staff', 'c', 'details, photo, pin'), ('c', 'd', 'intake draft'), ('s3', 'd', 'facilities, capacity'),
             ('d', 'e', 'draft + facility, cage'), ('e', 's2', 'impound record, 72h deadline'), ('e', 'f', 'new record'), ('f', 's4', 'penalty ticket'), ('f', 's5', 'guardian alert'),
             ('e', 'staff', 'intake confirmation')], step=265))

D.append(l2('dfd2-4-3', 'DFD Level 3: 4.3 Claim & Release', 'The steps inside "Claim & release": the owner\'s claim, identity checks, the penalty ticket, release and the notice.',
            [('owner', OWNER, 0), ('staff', STAFF, 0)],
            [('a', '4.3.1\nReceive claim &\ndocuments'), ('b', '4.3.2\nVerify ownership\n& ID'), ('c', '4.3.3\nCheck penalty\nticket'),
             ('d', '4.3.4\nRecord payment\nor waive'), ('e', '4.3.5\nRelease animal &\nclose case'), ('f', '4.3.6\nNotify owner')],
            [('s1', 'D1  Pets & NFC Tags'), ('s2', 'D4  Impound Records'), ('s3', 'D5  Penalty Tickets'), ('s4', 'D3  Notifications')],
            [('owner', 'a', 'claim, ID, proof'), ('a', 'b', 'claim file'), ('s1', 'b', 'registered owner'), ('s2', 'b', 'case record'), ('staff', 'b', 'verification decision'),
             ('b', 'c', 'verified claim'), ('s3', 'c', 'ticket status'), ('c', 'd', 'unpaid ticket'), ('staff', 'd', 'payment / waiver'), ('d', 's3', 'ticket paid / waived'),
             ('d', 'e', 'ticket settled'), ('c', 'e', 'no ticket due', {'dashed': True}), ('staff', 'e', 'release'), ('e', 's2', 'case closed'), ('e', 'f', 'released'),
             ('f', 's4', 'notification'), ('f', 'owner', 'release confirmation')], step=265))

D.append(l2('dfd2-6-4', 'DFD Level 3: 6.4 Change Email or Password', 'The steps inside "Change email or password": request, emailed code, code check, the change itself and the notice.',
            [('staff', 'Facility Staff /\nManager', 0), ('brevo', BREVO, 0)],
            [('a', '6.4.1\nAccept request\n& validate'), ('b', '6.4.2\nGenerate & email\ncode'), ('c', '6.4.3\nVerify code (tries\n& expiry limits)'),
             ('d', '6.4.4\nApply new email\nor password'), ('e', '6.4.5\nSend change notice,\nrefresh session')],
            [('s1', 'D7  Accounts'), ('s2', 'D8  Verification Codes')],
            [('staff', 'a', 'change request'), ('s1', 'a', 'account & sign-in method'), ('a', 'b', 'validated request'), ('b', 's2', 'code hash, expiry'), ('b', 'brevo', 'code email'),
             ('staff', 'c', '6-digit code'), ('s2', 'c', 'stored hash & tries'), ('b', 'c', 'code sent', {'dashed': True}), ('c', 'd', 'code proven'),
             ('staff', 'd', 'new password'), ('d', 's1', 'email / password updated'), ('d', 'e', 'change applied'), ('e', 'brevo', 'change notice'), ('e', 'staff', 'result, new session')], step=290))

# ---------------------------------------------------------------------------- Flowcharts (strict grid, right-angle arrows only)
def fc_new(key, title, blurb):
    dd = Diagram(key, 'System flowchart', title, 1000, 1200, blurb)
    dd.ortho = True
    return dd


def fp(dd, id, label, x, y, w=250):
    dd.n(id, 'fproc', label, x, y, w, 48)


def dc(dd, id, label, x, y):
    dd.n(id, 'decision', label, x, y, 210, 88)


def tm(dd, id, label, x, y, w=190):
    dd.n(id, 'term', label, x, y, w, 40)


def cn(dd, id, label, x, y):
    dd.n(id, 'conn', label, x, y, 34, 34)


# ---- Flowchart 1
d = fc_new('fc1', 'Flowchart 1: Report & Find a Missing Pet',
           'The owner and finder journey: register a pet, report it missing, get a match, and either arrange the return or hand over to the impound flow.')
X, R = 420, 820
tm(d, 's', 'Start', X, 50)
fp(d, 'f1', 'Owner signs in\n(Google or email)', X, 130)
fp(d, 'f2', 'Owner registers the pet profile\nand links the NFC collar tag', X, 210)
dc(d, 'd1', 'Pet goes\nmissing?', X, 310)
tm(d, 'e0', 'Pet stays protected', R, 310, 200)
fp(d, 'f3', 'Owner files a missing-pet report\n(last-seen pin on the map)', X, 410)
fp(d, 'f4', 'System stores the report, alerts\nnearby users, shows the map pin', X, 490)
cn(d, 'cC1', 'C', 200, 590)
dc(d, 'd2', 'Seen or found\nby someone?', X, 590)
fp(d, 'f4b', 'Keep searching;\nshare the report', R, 590)
cn(d, 'cC2', 'C', R, 670)
fp(d, 'f5', 'Finder scans the NFC tag or\nsubmits a sighting report', X, 690)
fp(d, 'f6', 'System matches it to the report\nand notifies the owner', X, 770)
dc(d, 'd3', 'Owner verifies\nthe match?', X, 870)
fp(d, 'f6b', 'Match dismissed;\nsearch continues', R, 870)
cn(d, 'cC3', 'C', R, 950)
dc(d, 'd4', 'Animal taken to an\nimpound facility?', X, 1010)
fp(d, 'f7', 'Owner and finder\narrange the return', R, 1010)
fp(d, 'f8', 'Owner marks the report\nas reunited', R, 1090)
tm(d, 'e1', 'Pet reunited', R, 1170)
cn(d, 'cA', 'A', X, 1110)
tm(d, 'cAt', 'Continue: Flowchart 2', X, 1190, 210)
for a, b, l in [('s', 'f1', ''), ('f1', 'f2', ''), ('f2', 'd1', ''), ('d1', 'e0', 'No'), ('d1', 'f3', 'Yes'), ('f3', 'f4', ''), ('f4', 'd2', ''),
                ('cC1', 'd2', ''), ('d2', 'f4b', 'No'), ('f4b', 'cC2', ''), ('d2', 'f5', 'Yes'), ('f5', 'f6', ''), ('f6', 'd3', ''), ('d3', 'f6b', 'No'), ('f6b', 'cC3', ''),
                ('d3', 'd4', 'Yes'), ('d4', 'f7', 'No'), ('f7', 'f8', ''), ('f8', 'e1', ''), ('d4', 'cA', 'Yes'), ('cA', 'cAt', '')]:
    d.e(a, b, l)
D.append(d)

# ---- Flowchart 2
d = fc_new('fc2', 'Flowchart 2: Impound, Claim & Release',
           'What happens once an animal reaches a facility: intake, the 72-hour claim window, verification, penalty ticket and release.')
cn(d, 'cA', 'A', X, 50)
fp(d, 'n1', 'Staff log the intake: NFC scan or manual\nentry, photo, pickup pin on the map', X, 130, 290)
fp(d, 'n2', 'System saves the record and starts\nthe 72-hour claim window', X, 210)
dc(d, 'd1', 'Reported missing\nby its owner?', X, 310)
fp(d, 'n2b', 'Penalty ticket issued;\nguardian alerted', R, 310)
fp(d, 'n3', 'Animal appears in the public list;\nthe owner can see and claim it', X, 440, 290)
dc(d, 'd2', 'Claimed within\n72 hours?', X, 560)
fp(d, 'n3b', 'Transferred to the main facility\nor closed as unclaimed', R, 560, 270)
tm(d, 'e0', 'Case closed', R, 640)
fp(d, 'n4', 'Owner shows a valid ID and\nproof of ownership', X, 720)
dc(d, 'd4', 'Documents\nverified?', X, 830)
fp(d, 'n4b', 'Claim refused; reason\nnoted for the owner', R, 830)
dc(d, 'd5', 'Penalty ticket\nunpaid?', X, 950)
fp(d, 'n5b', 'Owner pays, or staff\nwaive the ticket', R, 950)
fp(d, 'n5', 'Staff release the animal\nand close the case', X, 1070)
fp(d, 'n6', 'Owner is notified; the missing\nreport is marked reunited', X, 1150)
tm(d, 'e1', 'Pet reunited', X, 1230)
for a, b, l, kw in [('cA', 'n1', '', {}), ('n1', 'n2', '', {}), ('n2', 'd1', '', {}), ('d1', 'n2b', 'Yes', {}), ('n2b', 'n3', '', {'sa': 'bottom', 'sb': 'right'}),
                    ('d1', 'n3', 'No', {}), ('n3', 'd2', '', {}), ('d2', 'n3b', 'No', {}), ('n3b', 'e0', '', {}), ('d2', 'n4', 'Yes', {}), ('n4', 'd4', '', {}),
                    ('d4', 'n4b', 'No', {}), ('n4b', 'n4', 'owner may bring\nmore proof', {'sa': 'top', 'sb': 'right'}), ('d4', 'd5', 'Yes', {}),
                    ('d5', 'n5b', 'Yes', {}), ('n5b', 'n5', '', {'sa': 'bottom', 'sb': 'right'}), ('d5', 'n5', 'No', {}), ('n5', 'n6', '', {}), ('n6', 'e1', '', {})]:
    d.e(a, b, l, **kw)
D.append(d)

# ---- Flowchart 3
d = fc_new('fc3', 'Flowchart 3: Admin Sign-In & Access',
           'How an admin gets into the console: saved session, sign-in, requesting access with an emailed code, joining a facility, choosing the active one.')
L = 100
tm(d, 's', 'Start', X, 50)
fp(d, 'n1', 'Open the admin console', X, 130)
dc(d, 'd1', 'Saved session\nstill valid?', X, 230)
cn(d, 'cB1', 'B', 700, 230)
dc(d, 'd2', 'Has an approved\nadmin account?', X, 350)
fp(d, 'r1', 'Request access: name, email,\nbirth date (18+), password', R, 350)
fp(d, 'r2', 'Turnstile check; a 6-digit code\nis emailed to the new admin', R, 450)
dc(d, 'r3', 'Code correct?\n(5 tries, 10 min)', R, 560)
fp(d, 'r4', 'Request saved as pending;\nthe administrator reviews it', R, 670)
tm(d, 'r5', 'Wait for approval, then sign in', R, 760, 260)
fp(d, 'n2', 'Sign in: email + password\n(Turnstile) or Google', X, 470)
dc(d, 'd3', 'Signed in?', X, 590)
fp(d, 'x1', 'Show the error;\ntry again', L, 590, 170)
dc(d, 'd4', 'Joined a\nfacility?', X, 710)
fp(d, 'x2', 'Register a facility or\njoin with an invite code', L, 710, 200)
cn(d, 'cB2', 'B', L, 810)
fp(d, 'n8', 'Choose the active facility\n(every page follows it)', X, 810)
fp(d, 'n9', 'Work: log intake, manage cases,\nrelease animals, view reports', X, 900, 270)
tm(d, 'e', 'Sign out', X, 980)
for a, b, l, kw in [('s', 'n1', '', {}), ('n1', 'd1', '', {}), ('d1', 'cB1', 'Yes', {}), ('d1', 'd2', 'No', {}), ('cB2', 'n8', '', {}),
                    ('d2', 'r1', 'No', {}), ('r1', 'r2', '', {}), ('r2', 'r3', '', {}), ('r3', 'r2', 'No: resend', {'sa': 'right', 'sb': 'right'}),
                    ('r3', 'r4', 'Yes', {}), ('r4', 'r5', '', {}), ('d2', 'n2', 'Yes', {}), ('n2', 'd3', '', {}), ('d3', 'x1', 'No', {}),
                    ('x1', 'n2', '', {'sa': 'top', 'sb': 'left'}), ('d3', 'd4', 'Yes', {}), ('d4', 'x2', 'No', {}), ('x2', 'cB2', '', {}),
                    ('d4', 'n8', 'Yes', {}), ('n8', 'n9', '', {}), ('n9', 'e', '', {})]:
    d.e(a, b, l, **kw)
D.append(d)

# ============================================================================ outputs
for dd in D:
    finalize(dd)
    compute_anchors(dd)
    place_labels(dd)
def stacked(d):
    segs = []
    for k, e in enumerate(d.edges):
        for a in range(len(e.pts) - 1):
            segs.append((k, e.pts[a], e.pts[a + 1]))
    bad = []
    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            ki, a, b = segs[i]; kj, c, e2 = segs[j]
            if ki == kj:
                continue
            if abs(a[1] - b[1]) < 1 and abs(c[1] - e2[1]) < 1 and abs(a[1] - c[1]) < 11:
                ov = min(max(a[0], b[0]), max(c[0], e2[0])) - max(min(a[0], b[0]), min(c[0], e2[0]))
                if ov > 6: bad.append((ki, kj, 'h', round(a[1]), round(ov)))
            if abs(a[0] - b[0]) < 1 and abs(c[0] - e2[0]) < 1 and abs(a[0] - c[0]) < 11:
                ov = min(max(a[1], b[1]), max(c[1], e2[1])) - max(min(a[1], b[1]), min(c[1], e2[1]))
                if ov > 6: bad.append((ki, kj, 'v', round(a[0]), round(ov)))
    return bad


for dd in D:
    sb = stacked(dd)
    if sb:
        print('STACKED', dd.key, [(dd.edges[a].a + '>' + dd.edges[a].b, dd.edges[b].a + '>' + dd.edges[b].b, o, c, l) for a, b, o, c, l in sb][:8])
xml = mxfile(D)
os.makedirs('docs', exist_ok=True)
open('docs/pawtrack-diagrams.drawio', 'w', encoding='utf-8').write(xml)
comp = zlib.compressobj(9, zlib.DEFLATED, -15)
raw = comp.compress(xml.encode('utf-8')) + comp.flush()
link = 'https://app.diagrams.net/?lightbox=0#R' + urllib.parse.quote(base64.b64encode(raw).decode('ascii'), safe='')
pages = [{'key': dd.key, 'group': dd.group, 'title': dd.title, 'blurb': dd.blurb, 'w': round(dd.w), 'h': round(dd.h), 'svg': diagram_svg(dd),
          'xml': drawio_page(dd), 'edges': len(dd.edges), 'nodes': len(dd.nodes)} for dd in D]
json.dump({'pages': pages, 'link': link}, open('.claude-tmp-pages.json', 'w', encoding='utf-8'))
print('pages', len(D), 'xml bytes', len(xml))

