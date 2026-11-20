p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


# replace the three flowcharts
i = s.index("# ---------------------------------------------------------------------------- Flowchart 1")
j = s.index("# ============================================================================ outputs")
s = s[:i] + open('.claude-tmp-fcblock.py', encoding='utf-8').read() + s[j:]

# one-bend and loop routes
rep("""        e.pts = [pa, pb]
        if sa in ('left', 'right') and sb in ('left', 'right')""", """        e.pts = [pa, pb]
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
        if sa in ('left', 'right') and sb in ('left', 'right')""")
open(p, 'w', encoding='utf-8').write(s)
