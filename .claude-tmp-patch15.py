p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep("""    ents = [i for i in d.order if d.nodes[i].kind == 'entity']
    stores = [i for i in d.order if d.nodes[i].kind == 'store']
    np_, ne, ns = len(procs), len(ents), len(stores)
    H = max((np_ - 1) * 128, (ne - 1) * 78, (ns - 1) * 78, 1)
""", """    ents = [i for i in d.order if d.nodes[i].kind == 'entity']
    stores = [i for i in d.order if d.nodes[i].kind == 'store']
    # parties that only talk to the first / last process sit directly above / below it
    def only(i):
        return {e.b if e.a == i else e.a for e in d.edges if e.a == i or e.b == i}
    top_ids = [i for i in ents if len(procs) > 2 and only(i) == {procs[0]}] if len(procs) > 2 else []
    bot_ids = [i for i in ents if len(procs) > 2 and only(i) == {procs[-1]}] if len(procs) > 2 else []
    if len(bot_ids) < 2:
        bot_ids = []
    if len(top_ids) < 1:
        top_ids = []
    ents = [i for i in ents if i not in top_ids and i not in bot_ids]
    np_, ne, ns = len(procs), len(ents), len(stores)
    H = max((np_ - 1) * 128, (ne - 1) * 78, (ns - 1) * 74, 1)
""")
rep("""    for e in d.edges:
        ka, kb = d.nodes[e.a].kind, d.nodes[e.b].kind
        if ka == 'entity': e.sa, e.sb = 'right', 'left'""", """    for ids, y, ent_side in ((top_ids, d.nodes[procs[0]].cy - 190, 'bottom'), (bot_ids, d.nodes[procs[-1]].cy + 190, 'top')):
        for k, i in enumerate(ids):
            d.nodes[i].cx, d.nodes[i].cy = (k - (len(ids) - 1) / 2) * 160, y
    for e in d.edges:
        ka, kb = d.nodes[e.a].kind, d.nodes[e.b].kind
        if e.a in top_ids or e.b in top_ids or e.a in bot_ids or e.b in bot_ids:
            ent_first = e.a in top_ids or e.a in bot_ids
            tops = e.a in top_ids or e.b in top_ids
            if ent_first:
                e.sa, e.sb = ('bottom', 'top') if tops else ('top', 'bottom')
            else:
                e.sa, e.sb = ('top', 'bottom') if tops else ('bottom', 'top')
        elif ka == 'entity': e.sa, e.sb = 'right', 'left'""")
open(p, 'w', encoding='utf-8').write(s)
