p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


# ---- context anchors
rep("def compute_anchors(d):\n    (radial_anchors if d.mode == 'radial' else layered_anchors)(d)\n", r'''def context_anchors(d):
    sysn = d.nodes['sys']
    have = {(e.a, e.b) for e in d.edges}
    for e in d.edges:
        ent_is_a = e.a != 'sys'
        ent = d.nodes[e.a if ent_is_a else e.b]
        recip = (e.b, e.a) in have
        off = (14 if ent_is_a else -14) if recip else 0
        if abs(ent.cx - sysn.cx) > 300:
            y = ent.cy + off
            ex = ent.cx + ent.w / 2 if ent.cx < sysn.cx else ent.cx - ent.w / 2
            ep = (ex, y)
            sp = boundary_on_line(sysn, ep, (sysn.cx, y), False)
        else:
            x = ent.cx + off
            ey = ent.cy + ent.h / 2 if ent.cy < sysn.cy else ent.cy - ent.h / 2
            ep = (x, ey)
            sp = boundary_on_line(sysn, ep, (x, sysn.cy), False)
        e.pa, e.pb = (ep, sp) if ent_is_a else (sp, ep)


def compute_anchors(d):
    if d.mode == 'context':
        context_anchors(d)
    else:
        (radial_anchors if d.mode == 'radial' else layered_anchors)(d)
''')

# ---- new context diagram block
i = s.index("# ---------------------------------------------------------------------------- 3. Context diagram")
j = s.index("# ---------------------------------------------------------------------------- 4. DFD level 1 (system)")
ctx = r'''# ---------------------------------------------------------------------------- 3. Context diagram (DFD level 0)
d = Diagram('context', 'Context', 'DFD Level 0: Context Diagram', 1500, 960,
            'PawTrack as one process, with every outside person and service it exchanges data with.', 'context')
d.n('sys', 'system', '0\nPawTrack Pet Recovery\n& Impoundment System', 750, 480, 540, 300)
d.n('owner', 'entity', OWNER, 130, 370)
d.n('finder', 'entity', FINDER, 130, 480)
d.n('nfc', 'entity', NFC, 130, 590)
d.n('staff', 'entity', STAFF, 1370, 370)
d.n('mgr', 'entity', MGR, 1370, 480)
d.n('adm', 'entity', SYSADM, 1370, 590)
d.n('google', 'entity', GOOGLE, 655, 80)
d.n('turn', 'entity', TURN, 845, 80)
d.n('brevo', 'entity', BREVO, 750, 880)
pairs = [('owner', 'sign-in, pet & tag details,\nmissing reports, claims, payments', 'match alerts, notifications,\nclaim status, penalty tickets'),
         ('finder', 'sighting / found reports,\ntag scans', 'pet & owner contact,\nmissing pets, impound lists'),
         ('staff', 'login, intake details, case\nupdates, release, payments', 'case lists, alerts,\ndashboards, reports'),
         ('mgr', 'facility details, team &\ninvite code changes', 'team list, invite code,\nfacility records'),
         ('adm', 'access approvals', 'pending access requests'),
         ('google', 'sign-in & map requests', 'verified identity,\nmaps & geocoding'),
         ('turn', 'challenge token', 'human-check result')]
for ent, l1, l2 in pairs:
    if ent in ('google', 'turn'):
        d.e('sys', ent, l1)
        d.e(ent, 'sys', l2)
    else:
        d.e(ent, 'sys', l1)
        d.e('sys', ent, l2)
d.e('nfc', 'sys', 'tag ID (NDEF link)')
d.e('sys', 'brevo', 'OTP & notice emails')
d.e('brevo', 'sys', 'delivery status')
D.append(d)


'''
s = s[:i] + ctx + s[j:]

# ---- Level 1 as two sheets
rep("# ============================================================================ shared names", r'''def split_sheets(d, procs, chunks, key, title):
    import copy
    out = []
    for k, chunk in enumerate(chunks):
        cs = set(chunk)
        sub = Diagram(f'{key}{k + 1}', d.group, f'{title} (sheet {k + 1} of {len(chunks)})', d.w, d.h, d.blurb)
        es = [copy.deepcopy(e) for e in d.edges if e.a in cs or e.b in cs]
        need = {x for e in es for x in (e.a, e.b)}
        for nid in d.order:
            if nid in need:
                sub.nodes[nid] = copy.deepcopy(d.nodes[nid]); sub.order.append(nid)
        sub.edges = es
        std_page(sub, chunk, 400, 0, 245)
        out.append(sub)
    return out


# ============================================================================ shared names''')
rep("std_page(d, procs, 420, 0, 245)\nD.append(d)", "D.extend(split_sheets(d, procs, [procs[:3], procs[3:]], 'dfd1s', 'DFD Level 1: PawTrack System'))")
open(p, 'w', encoding='utf-8').write(s)

q = '.claude-tmp-page2.py'
t = open(q, encoding='utf-8').read()
t = t.replace("if (p.key === 'context') return 'Level 0: Context diagram';", "if (p.key === 'context') return 'Level 0: Context diagram';")
open(q, 'w', encoding='utf-8').write(t)
