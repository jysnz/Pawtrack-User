p='.claude-tmp-gen2.py'
s=open(p,encoding='utf-8').read()
i=s.index("def dfd_pages(d, procs, **kw):")
j=s.index("# ============================================================================ shared names")
new='''def dfd_pages(d, procs, **kw):
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


'''
s=s[:i]+new+s[j:]
open(p,'w',encoding='utf-8').write(s)
