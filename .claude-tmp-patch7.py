import re
p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


# ---- dup flag on nodes
rep("def __init__(s, id, kind, label, cx, cy, w, h, lbl='bottom'):\n        s.id,", "def __init__(s, id, kind, label, cx, cy, w, h, lbl='bottom'):\n        s.dup = False\n        s.id,")
rep("    def n(s, id, kind, label, cx, cy, w=None, h=None, lbl='bottom'):\n        dw, dh = SIZE.get(kind, (200, 60))\n        s.nodes[id] = Node(id, kind, label, cx, cy, w or dw, h or dh, lbl)",
    "    def n(s, id, kind, label, cx, cy, w=None, h=None, lbl='bottom', dup=False):\n        dw, dh = SIZE.get(kind, (200, 60))\n        s.nodes[id] = Node(id, kind, label, cx, cy, w or dw, h or dh, lbl)\n        s.nodes[id].dup = dup")

# ---- svg dup mark
rep("    if k == 'entity':\n        return f'<rect x=\"{x:.1f}\" y=\"{y:.1f}\" width=\"{w:.1f}\" height=\"{h:.1f}\" class=\"k-entity\"/>' + lines_svg(n.label, n.cx, n.cy, cls='tb')",
    "    if k == 'entity':\n        mark = f'<path d=\"M{x + w - 15 * FS:.1f} {y + h:.1f} L{x + w:.1f} {y + h - 15 * FS:.1f}\" class=\"k-actor-line\"/>' if n.dup else ''\n        return f'<rect x=\"{x:.1f}\" y=\"{y:.1f}\" width=\"{w:.1f}\" height=\"{h:.1f}\" class=\"k-entity\"/>' + mark + lines_svg(n.label, n.cx, n.cy, cls='tb')")
# ---- drawio dup mark
rep("    for k, e in enumerate(d.edges):\n        A, B = d.nodes[e.a], d.nodes[e.b]\n        fx =",
    "    for k2, nid in enumerate(d.order):\n        n = d.nodes[nid]\n        if n.dup:\n            x1, y1 = n.cx + n.w / 2, n.cy + n.h / 2\n            cells.append(f'<mxCell id=\"m{k2}\" value=\"\" style=\"endArrow=none;html=1;strokeWidth=2;strokeColor=#6c8ebf;\" edge=\"1\" parent=\"1\"><mxGeometry relative=\"1\" as=\"geometry\"><mxPoint x=\"{x1 - 15 * FS:.0f}\" y=\"{y1:.0f}\" as=\"sourcePoint\"/><mxPoint x=\"{x1:.0f}\" y=\"{y1 - 15 * FS:.0f}\" as=\"targetPoint\"/></mxGeometry></mxCell>')\n    for k, e in enumerate(d.edges):\n        A, B = d.nodes[e.a], d.nodes[e.b]\n        fx =")

# ---- shared layout + aggregation (insert before shared names)
i = s.index("# ============================================================================ shared names")
s = s[:i] + r'''def agg(d):
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


def shared_layout(d, procs, yp, zig=0, step=250, dye=200, dys=200, ew=130, sw=170, margin=60):
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


def std_page(d, procs, yp, zig, step):
    agg(d)
    shared_layout(d, procs, yp, zig, step)


''' + s[i:]

# ---- Level 1 (the six-process system diagram) replaces old DFD level 0 block
i = s.index("# ---------------------------------------------------------------------------- 4. DFD level 0")
j = s.index("# ---------------------------------------------------------------------------- DFD level 1 / 2 helpers")
l1 = r'''# ---------------------------------------------------------------------------- 4. DFD level 1 (system)
d = Diagram('dfd1', 'Data flow', 'DFD Level 1: PawTrack System', 2000, 1000,
            'The context diagram opened up into its six main processes, the eight data stores they share, and the people and services around them. A slash in a corner marks a shape drawn more than once.')
for id, lab, dup in [('nfc', NFC, 0), ('finder', FINDER, 0), ('owner1', OWNER, 1), ('owner2', OWNER, 1), ('google', GOOGLE, 0), ('staff', STAFF, 0),
                     ('mgr', MGR, 0), ('adm', SYSADM, 0), ('turn', TURN, 0), ('brevo', BREVO, 0)]:
    d.n(id, 'entity', lab, 0, 0, dup=bool(dup))
pn = ['1.0\nManage Pets &\nNFC Tags', '2.0\nHandle Missing &\nSighting Reports', '3.0\nSend Alerts &\nReports',
      '4.0\nProcess Impoundment\n& Claims', '5.0\nManage Facilities\n& Teams', '6.0\nManage Accounts\n& Authentication']
procs = [f'p{i + 1}' for i in range(6)]
for pid, t in zip(procs, pn):
    d.n(pid, 'process', t, 0, 0, 200, 100)
sn = ['D1  Pets & NFC Tags', 'D2  Reports & Sightings', 'D3  Notifications', 'D4  Impound Records', 'D5  Penalty Tickets',
      'D6  Facilities & Teams', 'D7  Accounts', 'D8  Verification Codes']
for i, t in enumerate(sn):
    d.n(f'd{i + 1}', 'store', t, 0, 0, 170, 50)
d.e('nfc', 'p1', 'tag ID')
d.e('finder', 'p1', 'tag scan'); d.e('p1', 'finder', 'pet & owner contact')
d.e('owner1', 'p1', 'pet details, tag link'); d.e('p1', 'owner1', 'pet records')
d.e('owner1', 'p2', 'missing report'); d.e('finder', 'p2', 'sighting / found report'); d.e('google', 'p2', 'geocoded places')
d.e('p3', 'owner2', 'alerts & notifications'); d.e('p3', 'staff', 'alerts, dashboards, reports'); d.e('p3', 'mgr', 'breakdown & reports')
d.e('owner2', 'p4', 'claim documents, payment'); d.e('p4', 'owner2', 'claim result, penalty ticket')
d.e('staff', 'p4', 'intake, case updates, release'); d.e('p4', 'staff', 'case lists')
d.e('p4', 'finder', 'public facility & animal lists')
d.e('mgr', 'p5', 'facility & team changes'); d.e('p5', 'mgr', 'team list, invite code'); d.e('staff', 'p5', 'join with invite code')
d.e('owner2', 'p6', 'sign-in')
d.e('staff', 'p6', 'login, access request'); d.e('p6', 'staff', 'session, code result')
d.e('mgr', 'p6', 'login, change email / password')
d.e('adm', 'p6', 'access decisions'); d.e('p6', 'adm', 'access requests')
d.e('google', 'p6', 'verified identity'); d.e('turn', 'p6', 'human-check result'); d.e('p6', 'brevo', 'OTP & notice emails')
for a, b in (('p1', 'd1'), ('p2', 'd2'), ('p4', 'd4'), ('p4', 'd5'), ('p5', 'd6'), ('p5', 'd7'), ('p6', 'd7'), ('p6', 'd8')):
    d.e(a, b, both=True)
for a, b in (('d1', 'p2'), ('d2', 'p3'), ('d4', 'p3'), ('d1', 'p4'), ('d6', 'p4'), ('p3', 'd3')):
    d.e(a, b)
std_page(d, procs, 420, 0, 245)
D.append(d)


'''
s = s[:i] + l1 + s[j:]

# ---- helpers use the shared layout
rep("    return dfd_pages(dd, [p[0] for p in procs])", "    std_page(dd, [p[0] for p in procs], 400, 0, 250)\n    return [dd]")
rep("    explode_layout(dd, pids, 380, zig=150, gap=130)\n    return dd", "    std_page(dd, pids, 380, 150, 250)\n    return dd")
s = s.replace("DFD Level 2:", "DFD Level 3:").replace("DFD Level 1: 1.0", "DFD Level 2: 1.0").replace("DFD Level 1: 2.0", "DFD Level 2: 2.0").replace("DFD Level 1: 3.0", "DFD Level 2: 3.0").replace("DFD Level 1: 4.0", "DFD Level 2: 4.0").replace("DFD Level 1: 5.0", "DFD Level 2: 5.0").replace("DFD Level 1: 6.0", "DFD Level 2: 6.0")
rep("'Context', 'Context Diagram'", "'Context', 'DFD Level 0: Context Diagram'")
open(p, 'w', encoding='utf-8').write(s)

q = '.claude-tmp-page2.py'
t = open(q, encoding='utf-8').read()
t = t.replace("[['Use case', 'Use case'], ['Context', 'Context'], ['Data flow', 'Data flow diagrams'],", "[['Use case', 'Use case diagrams'], ['Context', 'DFD level 0'], ['Data flow', 'DFD levels 1 to 3'],")
t = t.replace("data flow diagrams (levels 0, 1 and 2)", "data flow diagrams (levels 0 to 3)")
t = t.replace("if (p.key.startsWith('dfd')) return p.title.replace('DFD ', '');", "if (p.key.startsWith('dfd')) return p.title.replace('DFD ', '');\n  if (p.key === 'context') return 'Level 0: Context diagram';")
open(q, 'w', encoding='utf-8').write(t)
