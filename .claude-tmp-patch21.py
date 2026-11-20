p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


# remember bounds and builder for each routed edge
rep("        for i, e in enumerate(es):\n            e.pts = build(e, kind, slots[best[i]])\n",
    "        for i, e in enumerate(es):\n            e.pts = build(e, kind, slots[best[i]])\n            e._chan = (kind, lo, hi, slots[best[i]])\n")
rep("        s._sides = (None, None)\n", "        s._sides = (None, None)\n        s._chan = None\n")

# nudge pass after routing
rep("def compute_anchors(d):\n    if d.mode == 'context':", '''def seg_overlap(a, b, c, e2):
    if abs(a[1] - b[1]) < 1 and abs(c[1] - e2[1]) < 1 and abs(a[1] - c[1]) < 6:
        return min(max(a[0], b[0]), max(c[0], e2[0])) - max(min(a[0], b[0]), min(c[0], e2[0])) > 6
    if abs(a[0] - b[0]) < 1 and abs(c[0] - e2[0]) < 1 and abs(a[0] - c[0]) < 6:
        return min(max(a[1], b[1]), max(c[1], e2[1])) - max(min(a[1], b[1]), min(c[1], e2[1])) > 6
    return False


def clashes(d, k):
    e = d.edges[k]
    for j, f in enumerate(d.edges):
        if j == k:
            continue
        for a in range(len(e.pts) - 1):
            for b in range(len(f.pts) - 1):
                if seg_overlap(e.pts[a], e.pts[a + 1], f.pts[b], f.pts[b + 1]):
                    return True
    return False


def unstack(d):
    """Move an arrow's track sideways until it no longer lies on top of another arrow."""
    for _ in range(3):
        moved = False
        for k, e in enumerate(d.edges):
            if e._chan is None or not clashes(d, k):
                continue
            kind, lo, hi, c0 = e._chan
            pa, pb = e.pa, e.pb
            for off in (7, -7, 14, -14, 21, -21, 28, -28, 35, -35):
                c = c0 + off
                if not (lo - 10 <= c <= hi + 10):
                    continue
                keep = e.pts
                e.pts = [pa, (c, pa[1]), (c, pb[1]), pb] if kind == 'h' else [pa, (pa[0], c), (pb[0], c), pb]
                if not clashes(d, k):
                    e._chan = (kind, lo, hi, c)
                    moved = True
                    break
                e.pts = keep
        if not moved:
            break


def compute_anchors(d):
    if d.mode == 'context':''')
rep("    if d.ortho:\n        route_ortho(d)\n", "    if d.ortho:\n        route_ortho(d)\n        unstack(d)\n")
open(p, 'w', encoding='utf-8').write(s)
