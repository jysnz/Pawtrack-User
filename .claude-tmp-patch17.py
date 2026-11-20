p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:60]
    s = s.replace(a, b, 1)


rep("750, 480, 540, 300)", "750, 450, 400, 240)")
rep("d.n('owner', 'entity', OWNER, 130, 370)", "d.n('owner', 'entity', OWNER, 250, 370)")
rep("d.n('finder', 'entity', FINDER, 130, 480)", "d.n('finder', 'entity', FINDER, 250, 450)")
rep("d.n('nfc', 'entity', NFC, 130, 590)", "d.n('nfc', 'entity', NFC, 250, 530)")
rep("d.n('staff', 'entity', STAFF, 1370, 370)", "d.n('staff', 'entity', STAFF, 1250, 370)")
rep("d.n('mgr', 'entity', MGR, 1370, 480)", "d.n('mgr', 'entity', MGR, 1250, 450)")
rep("d.n('adm', 'entity', SYSADM, 1370, 590)", "d.n('adm', 'entity', SYSADM, 1250, 530)")
rep("d.n('google', 'entity', GOOGLE, 655, 80)", "d.n('google', 'entity', GOOGLE, 655, 120)")
rep("d.n('turn', 'entity', TURN, 845, 80)", "d.n('turn', 'entity', TURN, 845, 120)")
rep("d.n('brevo', 'entity', BREVO, 750, 880)", "d.n('brevo', 'entity', BREVO, 750, 780)")
rep("def lines_svg(label, x, y, bold_first=False, cls=''):", "def lines_svg(label, x, y, bold_first=False, cls='', mul=1.0):")
rep("    fz, lh = 12 * FS, 15 * FS\n    out = []", "    fz, lh = 12 * FS * mul, 15 * FS * mul\n    out = []")
rep("class=\"k-system\"/>' + lines_svg(n.label, n.cx, n.cy, bold_first=True)", "class=\"k-system\"/>' + lines_svg(n.label, n.cx, n.cy, bold_first=True, mul=1.45)")
rep("    if k in ('usecase', 'system', 'conn'):\n        return base + f'ellipse;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=12;'",
    "    if k == 'system':\n        return base + f'ellipse;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=17;'\n    if k in ('usecase', 'conn'):\n        return base + f'ellipse;fillColor={f};strokeColor={s};strokeWidth=2;fontSize=12;'")
open(p, 'w', encoding='utf-8').write(s)
