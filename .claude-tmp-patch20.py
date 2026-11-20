p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


# ---- room for a title strip at the top
rep("(ph - 112) / bh)", "(ph - 156) / bh)")
rep("    oy = (ph - 44 - bh * sc) / 2 - y0 * sc\n", "    oy = 56 + (ph - 100 - bh * sc) / 2 - y0 * sc\n")

# ---- title drawing (svg + draw.io)
rep("def legend_svg(d):", '''def title_svg(d):
    return (f'<text x="40" y="38" class="t tb" style="font-size:17px">{H.escape(d.title)}</text>'
            f'<path d="M40 48 H{d.w - 40}" class="k-boundary" style="stroke-width:1.2"/>')


def title_cells(d):
    return [f'<mxCell id="ttl" value="{H.escape("<b>" + H.escape(d.title, quote=False) + "</b>", quote=True)}" style="text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=17;fontColor=#222222;" vertex="1" parent="1"><mxGeometry x="40" y="16" width="{d.w - 80:.0f}" height="30" as="geometry"/></mxCell>',
            f'<mxCell id="ttlrule" value="" style="endArrow=none;html=1;strokeWidth=1;strokeColor=#888888;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="40" y="48" as="sourcePoint"/><mxPoint x="{d.w - 40:.0f}" y="48" as="targetPoint"/></mxGeometry></mxCell>']


def legend_svg(d):''')
rep("    out.append(legend_svg(d))\n    out.append('</svg>')", "    out.append(legend_svg(d))\n    out.append(title_svg(d))\n    out.append('</svg>')")
rep("    cells.extend(legend_cells(d))\n", "    cells.extend(legend_cells(d))\n    cells.extend(title_cells(d))\n")

# ---- stacked-line checker
rep("xml = mxfile(D)", '''def stacked(d):
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
            if abs(a[1] - b[1]) < 1 and abs(c[1] - e2[1]) < 1 and abs(a[1] - c[1]) < 5:
                ov = min(max(a[0], b[0]), max(c[0], e2[0])) - max(min(a[0], b[0]), min(c[0], e2[0]))
                if ov > 6: bad.append((ki, kj, 'h', round(a[1]), round(ov)))
            if abs(a[0] - b[0]) < 1 and abs(c[0] - e2[0]) < 1 and abs(a[0] - c[0]) < 5:
                ov = min(max(a[1], b[1]), max(c[1], e2[1])) - max(min(a[1], b[1]), min(c[1], e2[1]))
                if ov > 6: bad.append((ki, kj, 'v', round(a[0]), round(ov)))
    return bad


for dd in D:
    sb = stacked(dd)
    if sb:
        print('STACKED', dd.key, [(dd.edges[a].a + '>' + dd.edges[a].b, dd.edges[b].a + '>' + dd.edges[b].b, o, c, l) for a, b, o, c, l in sb][:8])
xml = mxfile(D)''')
open(p, 'w', encoding='utf-8').write(s)
