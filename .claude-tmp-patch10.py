p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


# entities with extra marked copies
rep("('finder', FINDER, 0), ('owner1', OWNER, 1), ('owner2', OWNER, 1), ('google', GOOGLE, 0),",
    "('finder', FINDER, 1), ('finder2', FINDER, 1), ('owner1', OWNER, 1), ('owner2', OWNER, 1), ('google', GOOGLE, 1), ('google2', GOOGLE, 1),")
rep("d.e('p4', 'finder', 'public facility & animal lists')", "d.e('p4', 'finder2', 'public facility & animal lists')")
rep("d.e('google', 'p6', 'verified identity')", "d.e('google2', 'p6', 'verified identity')")
# stores: add marked copies
rep("""for i, t in enumerate(sn):
    d.n(f'd{i + 1}', 'store', t, 0, 0, 170, 50)""", """for i, t in enumerate(sn):
    d.n(f'd{i + 1}', 'store', t, 0, 0, 150, 50)
d.n('d1b', 'store', sn[0], 0, 0, 150, 50, dup=True)
d.n('d2b', 'store', sn[1], 0, 0, 150, 50, dup=True)
d.nodes['d1'].dup = True
d.nodes['d2'].dup = True""")
rep("d.e('d1', 'p2'); ", "d.e('d1', 'p2'); ") if False else None
rep("for a, b in (('d1', 'p2'), ('d2', 'p3'), ('d4', 'p3'), ('d1', 'p4'), ('d6', 'p4'), ('p3', 'd3')):\n    d.e(a, b)\nstd_page(d, procs, 420, 0, 245)",
    "for a, b in (('d1', 'p2'), ('d2b', 'p3'), ('d4', 'p3'), ('d1b', 'p4'), ('d6', 'p4'), ('p3', 'd3')):\n    d.e(a, b)\nstd_page(d, procs, 420, 0, 245)")
# store dup marks in svg
rep("""    if k == 'store':
        return (f'<rect""", """    if k == 'store':
        mark = f'<path d="M{x + w - 15 * FS:.1f} {y + h:.1f} L{x + w:.1f} {y + h - 15 * FS:.1f}" class="k-store"/>' if n.dup else ''
        return (f'<rect""")
rep("class=\"k-store\"/>' + lines_svg(n.label, n.cx, n.cy))", "class=\"k-store\"/>' + lines_svg(n.label, n.cx, n.cy) + mark)")
open(p, 'w', encoding='utf-8').write(s)
