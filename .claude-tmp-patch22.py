p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep("""    for n_ in d.nodes.values():
        if n_.kind == 'process': n_.h = min(n_.h, 84)
        elif n_.kind == 'store': n_.h = 40
        elif n_.kind == 'entity': n_.h = 50
""", """    for n_ in d.nodes.values():
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
""")
rep("H = max((np_ - 1) * 104, (ne - 1) * 66, (ns - 1) * 58, 1)", """ph_ = max([d.nodes[q].h for q in procs] + [0]) + 20
    eh_ = max([d.nodes[i].h for i in ents] + [0]) + 16
    sh_ = max([d.nodes[i].h for i in stores] + [0]) + 16
    H = max((np_ - 1) * ph_, (ne - 1) * eh_, (ns - 1) * sh_, 1)""")
open(p, 'w', encoding='utf-8').write(s)
