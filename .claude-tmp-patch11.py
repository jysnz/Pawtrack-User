p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep("def std_page(d, procs, yp, zig, step):\n    agg(d)\n", '''def auto_dup(d, procs):
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


def std_page(d, procs, yp, zig, step, dup=False):
    if dup:
        auto_dup(d, procs)
    agg(d)
''')
rep("    std_page(dd, [p[0] for p in procs], 400, 0, 250)\n    return [dd]", "    std_page(dd, [p[0] for p in procs], 400, 0, 250, dup=True)\n    return [dd]")
rep("    std_page(dd, pids, 380, 150, 250)\n    return dd", "    std_page(dd, pids, 380, 150, 250, dup=True)\n    return dd")
open(p, 'w', encoding='utf-8').write(s)
