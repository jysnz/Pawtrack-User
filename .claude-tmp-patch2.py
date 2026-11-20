p='.claude-tmp-gen2.py'
s=open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    assert a in s, a[:50]
    s=s.replace(a,b,1)
rep("spill_last=False, ew=130","spill_last=False, wrap=0, rowh=640, ew=130")
rep("    cursor, cxs = margin, {}\n","    cursor, cxs, maxr = margin, {}, 0\n")
rep("        W = max(230,","        if wrap and idx and idx % wrap == 0:\n            maxr = max(maxr, cursor - gap); cursor = margin\n        W = max(230,")
rep("        ypp = yp + (zig if idx % 2 else 0)","        ypp = yp + (zig if idx % 2 else 0) + (idx // wrap if wrap else 0) * rowh")
rep("    right = cursor - gap\n","    right = max(maxr, cursor - gap)\n")
rep("        right = cx + W / 2 + 150 + ew / 2 + gap\n","        right = max(maxr, cx + W / 2 + 150 + ew / 2)\n")
rep("    d.w = right + margin - gap + 0","    d.w = right + margin")
rep("explode_layout(d, procs, 400, spill_last=True)","explode_layout(d, procs, 400, spill_last=True, wrap=3, rowh=640)")
open(p,'w',encoding='utf-8').write(s)
