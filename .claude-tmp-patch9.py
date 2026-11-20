p = '.claude-tmp-gen2.py'
s = open(p, encoding='utf-8').read()
NL = chr(10)
BS = chr(92)
for a in ["Facility Staff /" + NL + "Manager", "alerts, dashboards," + NL + "breakdown, reports", "facility & team changes," + NL + "join with invite code", "login, access request," + NL + "change email / password"]:
    assert a in s, a
    s = s.replace(a, a.replace(NL, BS + 'n'))
open(p, 'w', encoding='utf-8').write(s)
