p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep("        cands = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86, 0.08, 0.92]\n",
    """        total = poly_len(e.pts)
        cands = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86, 0.08, 0.92]
        if len(e.pts) > 2 and total > 0:
            acc, mids = 0.0, []
            for k in range(len(e.pts) - 1):
                L = math.hypot(e.pts[k + 1][0] - e.pts[k][0], e.pts[k + 1][1] - e.pts[k][1])
                if abs(e.pts[k + 1][1] - e.pts[k][1]) < 1 and L > 50:
                    mids.append((acc + L / 2) / total)
                acc += L
            cands = mids + [c for c in cands if c not in mids]
""")
rep("                pen += abs(f - 0.5) * 3 + (2 if so != (0, 0) else 0)",
    "                pen += abs(f - 0.5) * 1.5 + (2 if so != (0, 0) else 0) + (8 if vertical else 0)")
open(p, 'w', encoding='utf-8').write(s)
