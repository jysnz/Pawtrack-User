# ---------------------------------------------------------------------------- Flowcharts (strict grid, right-angle arrows only)
def fc_new(key, title, blurb):
    dd = Diagram(key, 'System flowchart', title, 1000, 1200, blurb)
    dd.ortho = True
    return dd


def fp(dd, id, label, x, y, w=250):
    dd.n(id, 'fproc', label, x, y, w, 48)


def dc(dd, id, label, x, y):
    dd.n(id, 'decision', label, x, y, 210, 88)


def tm(dd, id, label, x, y, w=190):
    dd.n(id, 'term', label, x, y, w, 40)


def cn(dd, id, label, x, y):
    dd.n(id, 'conn', label, x, y, 34, 34)


# ---- Flowchart 1
d = fc_new('fc1', 'Flowchart 1: Report & Find a Missing Pet',
           'The owner and finder journey: register a pet, report it missing, get a match, and either arrange the return or hand over to the impound flow.')
X, R = 420, 820
tm(d, 's', 'Start', X, 50)
fp(d, 'f1', 'Owner signs in\n(Google or email)', X, 130)
fp(d, 'f2', 'Owner registers the pet profile\nand links the NFC collar tag', X, 210)
dc(d, 'd1', 'Pet goes\nmissing?', X, 310)
tm(d, 'e0', 'Pet stays protected', R, 310, 200)
fp(d, 'f3', 'Owner files a missing-pet report\n(last-seen pin on the map)', X, 410)
fp(d, 'f4', 'System stores the report, alerts\nnearby users, shows the map pin', X, 490)
cn(d, 'cC1', 'C', 200, 590)
dc(d, 'd2', 'Seen or found\nby someone?', X, 590)
fp(d, 'f4b', 'Keep searching;\nshare the report', R, 590)
cn(d, 'cC2', 'C', R, 670)
fp(d, 'f5', 'Finder scans the NFC tag or\nsubmits a sighting report', X, 690)
fp(d, 'f6', 'System matches it to the report\nand notifies the owner', X, 770)
dc(d, 'd3', 'Owner verifies\nthe match?', X, 870)
fp(d, 'f6b', 'Match dismissed;\nsearch continues', R, 870)
cn(d, 'cC3', 'C', R, 950)
dc(d, 'd4', 'Animal taken to an\nimpound facility?', X, 1010)
fp(d, 'f7', 'Owner and finder\narrange the return', R, 1010)
fp(d, 'f8', 'Owner marks the report\nas reunited', R, 1090)
tm(d, 'e1', 'Pet reunited', R, 1170)
cn(d, 'cA', 'A', X, 1110)
tm(d, 'cAt', 'Continue: Flowchart 2', X, 1190, 210)
for a, b, l in [('s', 'f1', ''), ('f1', 'f2', ''), ('f2', 'd1', ''), ('d1', 'e0', 'No'), ('d1', 'f3', 'Yes'), ('f3', 'f4', ''), ('f4', 'd2', ''),
                ('cC1', 'd2', ''), ('d2', 'f4b', 'No'), ('f4b', 'cC2', ''), ('d2', 'f5', 'Yes'), ('f5', 'f6', ''), ('f6', 'd3', ''), ('d3', 'f6b', 'No'), ('f6b', 'cC3', ''),
                ('d3', 'd4', 'Yes'), ('d4', 'f7', 'No'), ('f7', 'f8', ''), ('f8', 'e1', ''), ('d4', 'cA', 'Yes'), ('cA', 'cAt', '')]:
    d.e(a, b, l)
D.append(d)

# ---- Flowchart 2
d = fc_new('fc2', 'Flowchart 2: Impound, Claim & Release',
           'What happens once an animal reaches a facility: intake, the 72-hour claim window, verification, penalty ticket and release.')
cn(d, 'cA', 'A', X, 50)
fp(d, 'n1', 'Staff log the intake: NFC scan or manual\nentry, photo, pickup pin on the map', X, 130, 290)
fp(d, 'n2', 'System saves the record and starts\nthe 72-hour claim window', X, 210)
dc(d, 'd1', 'Reported missing\nby its owner?', X, 310)
fp(d, 'n2b', 'Penalty ticket issued;\nguardian alerted', R, 310)
fp(d, 'n3', 'Animal appears in the public list;\nthe owner can see and claim it', X, 440, 290)
dc(d, 'd2', 'Claimed within\n72 hours?', X, 560)
fp(d, 'n3b', 'Transferred to the main facility\nor closed as unclaimed', R, 560, 270)
tm(d, 'e0', 'Case closed', R, 640)
fp(d, 'n4', 'Owner shows a valid ID and\nproof of ownership', X, 720)
dc(d, 'd4', 'Documents\nverified?', X, 830)
fp(d, 'n4b', 'Claim refused; reason\nnoted for the owner', R, 830)
dc(d, 'd5', 'Penalty ticket\nunpaid?', X, 950)
fp(d, 'n5b', 'Owner pays, or staff\nwaive the ticket', R, 950)
fp(d, 'n5', 'Staff release the animal\nand close the case', X, 1070)
fp(d, 'n6', 'Owner is notified; the missing\nreport is marked reunited', X, 1150)
tm(d, 'e1', 'Pet reunited', X, 1230)
for a, b, l, kw in [('cA', 'n1', '', {}), ('n1', 'n2', '', {}), ('n2', 'd1', '', {}), ('d1', 'n2b', 'Yes', {}), ('n2b', 'n3', '', {'sa': 'bottom', 'sb': 'right'}),
                    ('d1', 'n3', 'No', {}), ('n3', 'd2', '', {}), ('d2', 'n3b', 'No', {}), ('n3b', 'e0', '', {}), ('d2', 'n4', 'Yes', {}), ('n4', 'd4', '', {}),
                    ('d4', 'n4b', 'No', {}), ('n4b', 'n4', 'owner may bring\nmore proof', {'sa': 'top', 'sb': 'right'}), ('d4', 'd5', 'Yes', {}),
                    ('d5', 'n5b', 'Yes', {}), ('n5b', 'n5', '', {'sa': 'bottom', 'sb': 'right'}), ('d5', 'n5', 'No', {}), ('n5', 'n6', '', {}), ('n6', 'e1', '', {})]:
    d.e(a, b, l, **kw)
D.append(d)

# ---- Flowchart 3
d = fc_new('fc3', 'Flowchart 3: Admin Sign-In & Access',
           'How an admin gets into the console: saved session, sign-in, requesting access with an emailed code, joining a facility, choosing the active one.')
L = 100
tm(d, 's', 'Start', X, 50)
fp(d, 'n1', 'Open the admin console', X, 130)
dc(d, 'd1', 'Saved session\nstill valid?', X, 230)
cn(d, 'cB1', 'B', 700, 230)
dc(d, 'd2', 'Has an approved\nadmin account?', X, 350)
fp(d, 'r1', 'Request access: name, email,\nbirth date (18+), password', R, 350)
fp(d, 'r2', 'Turnstile check; a 6-digit code\nis emailed to the new admin', R, 450)
dc(d, 'r3', 'Code correct?\n(5 tries, 10 min)', R, 560)
fp(d, 'r4', 'Request saved as pending;\nthe administrator reviews it', R, 670)
tm(d, 'r5', 'Wait for approval, then sign in', R, 760, 260)
fp(d, 'n2', 'Sign in: email + password\n(Turnstile) or Google', X, 470)
dc(d, 'd3', 'Signed in?', X, 590)
fp(d, 'x1', 'Show the error;\ntry again', L, 590, 170)
dc(d, 'd4', 'Joined a\nfacility?', X, 710)
fp(d, 'x2', 'Register a facility or\njoin with an invite code', L, 710, 200)
cn(d, 'cB2', 'B', L, 810)
fp(d, 'n8', 'Choose the active facility\n(every page follows it)', X, 810)
fp(d, 'n9', 'Work: log intake, manage cases,\nrelease animals, view reports', X, 900, 270)
tm(d, 'e', 'Sign out', X, 980)
for a, b, l, kw in [('s', 'n1', '', {}), ('n1', 'd1', '', {}), ('d1', 'cB1', 'Yes', {}), ('d1', 'd2', 'No', {}), ('cB2', 'n8', '', {}),
                    ('d2', 'r1', 'No', {}), ('r1', 'r2', '', {}), ('r2', 'r3', '', {}), ('r3', 'r2', 'No: resend', {'sa': 'right', 'sb': 'right'}),
                    ('r3', 'r4', 'Yes', {}), ('r4', 'r5', '', {}), ('d2', 'n2', 'Yes', {}), ('n2', 'd3', '', {}), ('d3', 'x1', 'No', {}),
                    ('x1', 'n2', '', {'sa': 'top', 'sb': 'left'}), ('d3', 'd4', 'Yes', {}), ('d4', 'x2', 'No', {}), ('x2', 'cB2', '', {}),
                    ('d4', 'n8', 'Yes', {}), ('n8', 'n9', '', {}), ('n9', 'e', '', {})]:
    d.e(a, b, l, **kw)
D.append(d)

