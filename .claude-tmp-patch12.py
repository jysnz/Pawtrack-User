p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep("def std_page(d, procs, yp, zig, step, dup=False):\n    if dup:\n        auto_dup(d, procs)\n    agg(d)\n", '''def columns_layout(d, procs, gap=230, margin=50):
    """People on the left, processes in the middle, data stores on the right: arrows run sideways between neighbouring columns."""
    ents = [i for i in d.order if d.nodes[i].kind == 'entity']
    stores = [i for i in d.order if d.nodes[i].kind == 'store']
    np_, ne, ns = len(procs), len(ents), len(stores)
    H = max((np_ - 1) * 128, (ne - 1) * 78, (ns - 1) * 78, 1)

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
    for e in d.edges:
        ka, kb = d.nodes[e.a].kind, d.nodes[e.b].kind
        if ka == 'entity': e.sa, e.sb = 'right', 'left'
        elif kb == 'entity': e.sa, e.sb = 'left', 'right'
        elif ka == 'store': e.sa, e.sb = 'left', 'right'
        elif kb == 'store': e.sa, e.sb = 'right', 'left'
    x0 = min(n.cx - n.w / 2 for n in d.nodes.values()); y0 = min(n.cy - n.h / 2 for n in d.nodes.values())
    for n in d.nodes.values():
        n.cx += margin - x0; n.cy += margin - y0
    d.w, d.h = 2000, 1000


def std_page(d, procs, yp, zig, step, dup=False):
    if dup:
        auto_dup(d, procs)
    agg(d)
    if not any(e.a in procs and e.b in procs for e in d.edges):
        columns_layout(d, procs)
        return
''')
# Level 1 system page: duplicates were chosen for the row layout; use the auto rule there too
rep("std_page(d, procs, 420, 0, 245)\nD.append(d)", "std_page(d, procs, 420, 0, 245)\nD.append(d)")
open(p, 'w', encoding='utf-8').write(s)
