p='.claude-tmp-gen2.py'
s=open(p,encoding='utf-8').read()
def rep(a,b,cnt=1):
    global s
    assert a in s, a[:60]
    s=s.replace(a,b,cnt)

# wrap long labels + offset
rep("""        s.a, s.b, s.label, s.dashed""","""        if label and '\n' not in label and len(label) > 17:
            w = label.split(' ')
            best, bi = 10**9, 0
            for k in range(1, len(w)):
                dd_ = abs(len(' '.join(w[:k])) - len(' '.join(w[k:])))
                if dd_ < best: best, bi = dd_, k
            if len(w) > 1: label = ' '.join(w[:bi]) + '\n' + ' '.join(w[bi:])
        s.lo = (0, 0)
        s.a, s.b, s.label, s.dashed""")

# label placement with side offsets
i=s.index("def place_labels(d):")
j=s.index("# ============================================================================ draw.io output")
s=s[:i]+'''def place_labels(d):
    nodes = [(n.cx - n.w / 2, n.cy - n.h / 2, n.w, n.h) for n in d.nodes.values() if n.kind != 'boundary']
    segs = [(e.pa, e.pb) for e in d.edges]
    placed = []
    for ei, e in enumerate(d.edges):
        if not e.label:
            continue
        w, h = label_size(e.label)
        vertical = abs(e.pb[1] - e.pa[1]) > abs(e.pb[0] - e.pa[0])
        cands = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86]
        if e.fixed is not None:
            cands = [e.fixed]
        sides = [(0, 0)]
        if vertical:
            sides += [(-(w / 2 + 6), 0), (w / 2 + 6, 0)]
        else:
            sides += [(0, -(h / 2 + 4)), (0, h / 2 + 4)]
        best, bo, best_pen = cands[0], (0, 0), 1e18
        for f in cands:
            for so in sides:
                x, y = point_at(e.pa, e.pb, f)
                r = (x + so[0] - w / 2, y + so[1] - h / 2, w, h)
                pen = sum(overlap(r, q) for q in placed) * 4 + sum(overlap(r, q) for q in nodes) * 6
                pen += sum(40 for si, (sa, sb) in enumerate(segs) if si != ei and seg_hits(sa, sb, r))
                pen += abs(f - 0.5) * 3 + (2 if so != (0, 0) else 0)
                if pen < best_pen:
                    best, bo, best_pen = f, so, pen
        e.lp, e.lo = best, bo
        x, y = point_at(e.pa, e.pb, best)
        placed.append((x + bo[0] - w / 2, y + bo[1] - h / 2, w, h))


'''+s[j:]

# drawio offset
rep("""        gx = f' x="{2 * e.lp - 1:.2f}"' if e.label and abs(e.lp - 0.5) > 0.01 else ''
        cells.append(f'<mxCell id="e{k}" value="{H.escape(lab, quote=True)}" style="{style}" edge="1" parent="1" source="{cid[e.a]}" target="{cid[e.b]}"><mxGeometry{gx} relative="1" as="geometry"/></mxCell>')""",
"""        gx = f' x="{2 * e.lp - 1:.2f}"' if e.label and abs(e.lp - 0.5) > 0.01 else ''
        off = f'<mxPoint x="{e.lo[0]:.0f}" y="{e.lo[1]:.0f}" as="offset"/>' if e.label and e.lo != (0, 0) else ''
        cells.append(f'<mxCell id="e{k}" value="{H.escape(lab, quote=True)}" style="{style}" edge="1" parent="1" source="{cid[e.a]}" target="{cid[e.b]}"><mxGeometry{gx} relative="1" as="geometry">{off}</mxGeometry></mxCell>')""")

# svg label position
rep("""            lx, ly = point_at(e.pa, e.pb, e.lp)
            labels.append""","""            lx, ly = point_at(e.pa, e.pb, e.lp)
            lx, ly = lx + e.lo[0], ly + e.lo[1]
            labels.append""")

# explode layout
i=s.index("# ============================================================================ shared names")
s=s[:i]+'''def explode_layout(d, procs, yp, zig=0, gap=120, spill_last=False, ew=130, sw=165, dy=225, margin=60):
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
    cursor, cxs = margin, {}
    for idx, p in enumerate(procs):
        ee = sorted(per_e[p], key=ents.index); ss = sorted(per_s[p], key=stores.index)
        if spill_last and idx == len(procs) - 1 and len(ee) > 4:
            spill = ee[4:]; ee = ee[:4]
        W = max(230, len(ee) * (ew + 16), len(ss) * (sw + 16))
        cx = cursor + W / 2; cursor += W + gap
        ypp = yp + (zig if idx % 2 else 0)
        d.nodes[p].cx, d.nodes[p].cy = cx, ypp
        for k, x in enumerate(ee):
            n = d.nodes[f'{x}@{p}']; n.cx, n.cy = cx + (k - (len(ee) - 1) / 2) * (ew + 16), ypp - dy
        for k, x in enumerate(ss):
            n = d.nodes[f'{x}@{p}']; n.cx, n.cy = cx + (k - (len(ss) - 1) / 2) * (sw + 16), ypp + dy
        cxs[p] = (cx, W, ypp)
    right = cursor - gap
    if spill:
        p = procs[-1]; cx, W, ypp = cxs[p]
        for k, x in enumerate(spill):
            n = d.nodes[f'{x}@{p}']; n.cx, n.cy = cx + W / 2 + 150, ypp + (k - (len(spill) - 1) / 2) * 105
        right = cx + W / 2 + 150 + ew / 2 + gap
    ys = [n.cy - n.h / 2 for n in d.nodes.values()]; ye = [n.cy + n.h / 2 for n in d.nodes.values()]
    sh = 50 - min(ys)
    for n in d.nodes.values(): n.cy += sh
    d.w = right + margin - gap + 0
    d.h = max(ye) + sh + 50


'''+s[i:]

# L0
rep("layered(d, ents, procs, stores, 90, 520, 960, 330, 290)\nD.append(d)","explode_layout(d, procs, 400, spill_last=True)\nD.append(d)")
# l1
rep("    layered(dd, [e[0] for e in ents], [p[0] for p in procs], [s[0] for s in stores], 90, yp, ys, 250, step)\n    return dd","    explode_layout(dd, [p[0] for p in procs], 400)\n    return dd")
# l2
rep("""    layered(dd, [e[0] for e in ents], pids, [s[0] for s in stores], 90, 400, 800, 200, step)
    for i, pid in enumerate(pids):      # zig-zag so neighbouring steps have room for their labels
        dd.nodes[pid].cy = 330 if i % 2 == 0 else 500
    return dd""","""    explode_layout(dd, pids, 380, zig=150, gap=130)
    return dd""")
open(p,'w',encoding='utf-8').write(s)
