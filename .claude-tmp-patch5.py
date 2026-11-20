p='.claude-tmp-gen2.py'
s=open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    assert a in s, a[:60]
    s=s.replace(a,b,1)
rep("    sn = max(sc, 0.84)\n","    sn = sc\n")
rep("d.w, d.h, d.fs = pw, ph, max(sc, 0.92)","d.w, d.h, d.fs = pw, ph, max(sc, 0.9)")
rep("# ============================================================================ shared names", r'''def scale_of(d):
    x0 = min(n.cx - n.w / 2 for n in d.nodes.values()); x1 = max(n.cx + n.w / 2 for n in d.nodes.values())
    y0 = min(n.cy - n.h / 2 for n in d.nodes.values()); y1 = max(n.cy + n.h / 2 for n in d.nodes.values())
    return max(min(1.0, (pw - 72) / (x1 - x0), (ph - 72) / (y1 - y0)) for pw, ph in ((1123, 794), (794, 1123)))


def dfd_pages(d, procs, **kw):
    import copy
    pe = set(procs)
    has_pp = any(e.a in pe and e.b in pe for e in d.edges)
    t = copy.deepcopy(d)
    explode_layout(t, procs, 400, **kw)
    if has_pp or len(procs) < 4 or scale_of(t) >= 0.8:
        explode_layout(d, procs, 400, **kw)
        return [d]
    half = len(procs) // 2
    out = []
    for k, chunk in enumerate((procs[:half], procs[half:])):
        cs = set(chunk)
        sub = Diagram(f'{d.key}-{k + 1}', d.group, f'{d.title} ({k + 1} of 2)', d.w, d.h, d.blurb)
        es = [copy.deepcopy(e) for e in d.edges if e.a in cs or e.b in cs]
        need = {x for e in es for x in (e.a, e.b)}
        for nid in d.order:
            if nid in need:
                sub.nodes[nid] = copy.deepcopy(d.nodes[nid]); sub.order.append(nid)
        sub.edges = es
        out += dfd_pages(sub, chunk, **kw)
    return out


# ============================================================================ shared names''')
rep("explode_layout(d, procs, 400, spill_last=True, wrap=3, rowh=640)\nD.append(d)","D.extend(dfd_pages(d, procs, spill_last=True))")
rep("    explode_layout(dd, [p[0] for p in procs], 400, wrap=3 if len(procs) >= 6 else 0, rowh=640)\n    return dd","    return dfd_pages(dd, [p[0] for p in procs])")
s=s.replace("D.append(l1(","D.extend(l1(")
open(p,'w',encoding='utf-8').write(s)
q='.claude-tmp-page2.py'
t=open(q,encoding='utf-8').read()
t=t.replace("""  if (p.key === 'dfd0') return 'Level 0: system';
  if (p.key.startsWith('dfd1')) return 'Level 1: ' + p.title.replace('DFD Level 1: ', '');
  if (p.key.startsWith('dfd2')) return 'Level 2: ' + p.title.replace('DFD Level 2: ', '');""","""  if (p.key.startsWith('dfd')) return p.title.replace('DFD ', '');""")
t=t.replace("open('.claude-tmp-artifact.html', 'w'","html = html.replace('Open all 16 pages', 'Open all %d pages' % len(pages))\nopen('.claude-tmp-artifact.html', 'w'")
open(q,'w',encoding='utf-8').write(t)
