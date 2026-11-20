import re
p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:60]
    s = s.replace(a, b, 1)


# ---- global font scale + helpers
rep(r'''# ============================================================================ model''', r'''FS = 1.0


def sfs(style):
    return re.sub(r'fontSize=(\d+)', lambda m: 'fontSize=%s' % round(max(5.0, int(m.group(1)) * FS), 1), style)


# ============================================================================ model''')
rep('import os, math,', 'import re, os, math,')

# ---- label size
rep(r'''    return max(len(p) for p in parts) * 5.7 + 10, len(parts) * 12.5 + 4''',
    r'''    return max(len(p) for p in parts) * 5.7 * FS + 8, len(parts) * 12.5 * FS + 4''')

# ---- use case anchors: lines end on the left/right tip of each oval, vertical links on top/bottom tips
rep(r'''    have = {(e.a, e.b) for e in d.edges}
    for e in d.edges:
        A, B = d.nodes[e.a], d.nodes[e.b]
''', r'''    have = {(e.a, e.b) for e in d.edges}
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
''')

# ---- drawio: scale fonts
rep(r'''{node_style(n)}" vertex''', r'''{sfs(node_style(n))}" vertex''')
rep(r'''        gx = f' x="{2 * e.lp - 1:.2f}"' ''', r'''        style = sfs(style)
        gx = f' x="{2 * e.lp - 1:.2f}"' ''')
rep(r'''def drawio_page(d):
''', r'''def drawio_page(d):
    global FS
    FS = d.fs
''')

# ---- svg: rewrite lines_svg .. diagram_svg
i = s.index('def lines_svg')
j = s.index('# ============================================================================ layered layout')
new_svg = r'''def lines_svg(label, x, y, bold_first=False, cls=''):
    parts = label.split('\n')
    n = len(parts)
    fz, lh = 12 * FS, 15 * FS
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
        fig = (f'<g transform="translate({n.cx:.1f} {y:.1f}) scale({FS:.3f})"><circle cx="0" cy="10" r="9" class="k-actor"/>'
               f'<path d="M0 19 V52 M-20 30 H20 M0 52 L-17 80 M0 52 L17 80" class="k-actor-line"/></g>')
        parts = n.label.split('\n')
        lh = 14 * FS
        if n.lbl == 'top':
            lab = ''.join(f'<text x="{n.cx:.1f}" y="{y - 8 * FS - (len(parts) - 1 - i) * lh:.1f}" text-anchor="middle" class="t tb" style="font-size:{fz:.1f}px">{H.escape(p)}</text>' for i, p in enumerate(parts))
        else:
            lab = ''.join(f'<text x="{n.cx:.1f}" y="{y + h + 16 * FS + i * lh:.1f}" text-anchor="middle" class="t tb" style="font-size:{fz:.1f}px">{H.escape(p)}</text>' for i, p in enumerate(parts))
        return fig + lab
    if k == 'entity':
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" class="k-entity"/>' + lines_svg(n.label, n.cx, n.cy, cls='tb')
    if k == 'process':
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{14 * FS:.1f}" class="k-process"/>' + lines_svg(n.label, n.cx, n.cy, bold_first=True)
    if k == 'store':
        return (f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" class="k-store-bg"/>'
                f'<path d="M{x:.1f} {y:.1f} H{x + w:.1f} M{x:.1f} {y + h:.1f} H{x + w:.1f}" class="k-store"/>' + lines_svg(n.label, n.cx, n.cy))
    if k == 'usecase':
        return f'<ellipse cx="{n.cx:.1f}" cy="{n.cy:.1f}" rx="{w / 2:.1f}" ry="{h / 2:.1f}" class="k-usecase"/>' + lines_svg(n.label, n.cx, n.cy)
    if k == 'system':
        return f'<ellipse cx="{n.cx:.1f}" cy="{n.cy:.1f}" rx="{w / 2:.1f}" ry="{h / 2:.1f}" class="k-system"/>' + lines_svg(n.label, n.cx, n.cy, bold_first=True)
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
        out.append(f'<path d="M{e.pa[0]:.1f} {e.pa[1]:.1f} L{e.pb[0]:.1f} {e.pb[1]:.1f}" class="{cls}" fill="none"{mk}/>')
        if e.label:
            lx, ly = point_at(e.pa, e.pb, e.lp)
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
    out.append('</svg>')
    return ''.join(out)


def finalize(d):
    """Scale the whole diagram onto one A4 page (portrait or landscape, whichever keeps it larger)."""
    global FS
    x0 = min(n.cx - n.w / 2 for n in d.nodes.values()); x1 = max(n.cx + n.w / 2 for n in d.nodes.values())
    y0 = min(n.cy - n.h / 2 - (34 if n.kind == 'actor' and n.lbl == 'top' else 0) for n in d.nodes.values())
    y1 = max(n.cy + n.h / 2 + (34 if n.kind == 'actor' and n.lbl != 'top' else 0) for n in d.nodes.values())
    bw, bh = x1 - x0, y1 - y0
    best = None
    for pw, ph in ((1123, 794), (794, 1123)):
        sc = min(1.0, (pw - 72) / bw, (ph - 72) / bh)
        if best is None or sc > best[0] + 1e-6:
            best = (sc, pw, ph)
    sc, pw, ph = best
    ox = (pw - bw * sc) / 2 - x0 * sc
    oy = (ph - bh * sc) / 2 - y0 * sc
    for n in d.nodes.values():
        n.cx, n.cy, n.w, n.h = n.cx * sc + ox, n.cy * sc + oy, n.w * sc, n.h * sc
    d.w, d.h, d.fs = pw, ph, sc
    FS = sc


'''
s = s[:i] + new_svg + s[j:]

# ---- outputs loop
rep(r'''for dd in D:
    compute_anchors(dd)
    place_labels(dd)''', r'''for dd in D:
    finalize(dd)
    compute_anchors(dd)
    place_labels(dd)''')
open(p, 'w', encoding='utf-8').write(s)

q = '.claude-tmp-page2.py'
t = open(q, encoding='utf-8').read()
t = t.replace("svg .k-boundary {", "svg .k-page { fill: var(--panel); stroke: var(--line); stroke-width: 2; }\nsvg .k-boundary {", 1)
t = t.replace("svg .t { font: 12px var(--font-sans);", "svg .t { font-family: var(--font-sans);", 1)
t = t.replace("svg .el { font-size: 10.5px; fill: var(--ink-2); }", "svg .el { fill: var(--ink-2); }", 1)
open(q, 'w', encoding='utf-8').write(t)
