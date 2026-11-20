p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


# ---- reserve room for the legend at the bottom of each A4 page
rep("sc = min(1.0, (pw - 72) / bw, (ph - 72) / bh)\n        if best is None", "sc = min(1.0, (pw - 72) / bw, (ph - 112) / bh)\n        if best is None")
rep("    oy = (ph - bh * sc) / 2 - y0 * sc\n    sn = sc", "    oy = (ph - 44 - bh * sc) / 2 - y0 * sc\n    sn = sc")

# ---- legend definitions and drawing
i = s.index("def diagram_svg(d):")
leg = r'''def legend_items(d):
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


'''
s = s[:i] + leg + s[i:]
rep("    out.append('</svg>')\n    return ''.join(out)\n\n\ndef finalize", "    out.append(legend_svg(d))\n    out.append('</svg>')\n    return ''.join(out)\n\n\ndef finalize")
rep("    return (f'<mxGraphModel dx=", "    cells.extend(legend_cells(d))\n    return (f'<mxGraphModel dx=")
open(p, 'w', encoding='utf-8').write(s)

q = '.claude-tmp-page2.py'
t = open(q, encoding='utf-8').read()
a = t.index("$('legend').innerHTML =")
b = t.index("+ `<span>${current.nodes}", a)
t = t[:a] + "$('legend').innerHTML = " + t[b + 2:]
open(q, 'w', encoding='utf-8').write(t)
