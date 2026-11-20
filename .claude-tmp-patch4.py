p='.claude-tmp-gen2.py'
s=open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    assert a in s, a[:60]
    s=s.replace(a,b,1)
rep("""    for n in d.nodes.values():
        n.cx, n.cy, n.w, n.h = n.cx * sc + ox, n.cy * sc + oy, n.w * sc, n.h * sc
    d.w, d.h, d.fs = pw, ph, sc
    FS = sc""","""    sn = max(sc, 0.84)
    for n in d.nodes.values():
        if n.kind == 'boundary':
            n.cx, n.cy, n.w, n.h = n.cx * sc + ox, n.cy * sc + oy, n.w * sc, n.h * sc
        else:
            n.cx, n.cy, n.w, n.h = n.cx * sc + ox, n.cy * sc + oy, n.w * sn, n.h * sn
    d.w, d.h, d.fs = pw, ph, max(sc, 0.92)
    FS = d.fs
    ns = [n for n in d.nodes.values() if n.kind != 'boundary' and n.kind != 'actor']
    for i, a in enumerate(ns):
        for b in ns[i + 1:]:
            if abs(a.cx - b.cx) < (a.w + b.w) / 2 - 1 and abs(a.cy - b.cy) < (a.h + b.h) / 2 - 1:
                print('OVERLAP', d.key, a.id, b.id)""")
rep("scale({FS:.3f})","scale({n.h / 84:.3f})")
rep("ew=130, sw=165, dy=225, margin=60","ew=118, sw=148, dy=215, margin=60")
rep("(ew + 16)","(ew + 8)") if False else None
s=s.replace("(ew + 16)","(ew + 8)").replace("(sw + 16)","(sw + 8)")
rep("W = max(230,","W = max(215,")
rep("def explode_layout(d, procs, yp, zig=0, gap=120,","def explode_layout(d, procs, yp, zig=0, gap=95,")
open(p,'w',encoding='utf-8').write(s)
