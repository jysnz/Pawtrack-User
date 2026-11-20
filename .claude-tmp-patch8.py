p='.claude-tmp-gen2.py'
s=open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    assert a in s, a[:60]
    s=s.replace(a,b,1)
rep("""('staff', STAFF, 0),
                     ('mgr', MGR, 0), ('adm'""","""('staff', 'Facility Staff /\nManager', 0),
                     ('adm'""")
rep("d.e('p3', 'staff', 'alerts, dashboards, reports'); d.e('p3', 'mgr', 'breakdown & reports')","d.e('p3', 'staff', 'alerts, dashboards,\nbreakdown, reports')")
rep("d.e('mgr', 'p5', 'facility & team changes'); d.e('p5', 'mgr', 'team list, invite code'); d.e('staff', 'p5', 'join with invite code')","d.e('staff', 'p5', 'facility & team changes,\njoin with invite code'); d.e('p5', 'staff', 'team list, invite code')")
rep("d.e('staff', 'p6', 'login, access request'); d.e('p6', 'staff', 'session, code result')\nd.e('mgr', 'p6', 'login, change email / password')","d.e('staff', 'p6', 'login, access request,\nchange email / password'); d.e('p6', 'staff', 'session, code result')")
open(p,'w',encoding='utf-8').write(s)
