import json
data = json.load(open('.claude-tmp-pages.json', encoding='utf-8'))
pages, link = data['pages'], data['link']
payload = json.dumps(pages, ensure_ascii=False).replace('<', '\\u003c')

html = '''<title>PawTrack System Diagrams</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500&display=swap">
<style>
/* Layout: a slim index on the left, one diagram at a time on the right; the index turns into a scrolling strip on phones. */
:root {
  --bg: #f3f5f8; --panel: #ffffff; --ink: #18202e; --ink-2: #485468; --ink-3: #7a8598; --line: #d9dfe8;
  --accent: #b9410f; --accent-ink: #ffffff; --accent-soft: #fbece4;
  --c-ent: #dbe8fb; --c-ent-s: #5b84c4; --c-proc: #fdf0c8; --c-proc-s: #c9a227; --c-store: #dcefd9; --c-store-s: #6aa35f;
  --c-dec: #e8dcf0; --c-dec-s: #8a63a8; --c-uc: #ffffff; --c-uc-s: #d08a12; --c-term: #eef0f3; --c-term-s: #6b7482;
  --c-fp: #dbe8fb; --c-fp-s: #5b84c4; --edge: #556072; --lbl: #ffffff;
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-head: 'Space Grotesk', 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #12161d; --panel: #1a202a; --ink: #e8ecf3; --ink-2: #aab4c4; --ink-3: #7f8a9c; --line: #2c3544;
  --accent: #f0794a; --accent-ink: #1a0d06; --accent-soft: #2b1d16;
  --c-ent: #1f3556; --c-ent-s: #6f9be0; --c-proc: #4a3d12; --c-proc-s: #d6b43a; --c-store: #1d3d22; --c-store-s: #6fb467;
  --c-dec: #3a2a4b; --c-dec-s: #a982c8; --c-uc: #1a202a; --c-uc-s: #e0a23a; --c-term: #272f3c; --c-term-s: #8d98aa;
  --c-fp: #1f3556; --c-fp-s: #6f9be0; --edge: #9aa6ba; --lbl: #1a202a; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #12161d; --panel: #1a202a; --ink: #e8ecf3; --ink-2: #aab4c4; --ink-3: #7f8a9c; --line: #2c3544;
  --accent: #f0794a; --accent-ink: #1a0d06; --accent-soft: #2b1d16;
  --c-ent: #1f3556; --c-ent-s: #6f9be0; --c-proc: #4a3d12; --c-proc-s: #d6b43a; --c-store: #1d3d22; --c-store-s: #6fb467;
  --c-dec: #3a2a4b; --c-dec-s: #a982c8; --c-uc: #1a202a; --c-uc-s: #e0a23a; --c-term: #272f3c; --c-term-s: #8d98aa;
  --c-fp: #1f3556; --c-fp-s: #6f9be0; --edge: #9aa6ba; --lbl: #1a202a; color-scheme: dark; }

* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--font-sans); font-size: 14px; line-height: 1.5; }
.wrap { max-width: 1480px; margin: 0 auto; padding-inline: max(16px, env(safe-area-inset-left, 0px)) max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px 40px; }
header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px 24px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
header h1 { margin: 0; font: 700 clamp(22px, 4vw, 30px)/1.15 var(--font-head); letter-spacing: -0.02em; text-wrap: balance; }
header p { margin: 6px 0 0; max-width: 62ch; color: var(--ink-2); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 600 13.5px var(--font-sans); text-decoration: none; cursor: pointer; transition: border-color .15s, background-color .15s, transform .1s; }
.btn:hover { border-color: var(--accent); }
.btn:active { transform: scale(0.97); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.btn.primary:hover { filter: brightness(1.06); }
.btn:focus-visible, nav a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.shell { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 24px; margin-top: 20px; align-items: start; }
nav { position: sticky; top: 12px; display: flex; flex-direction: column; gap: 16px; }
nav h2 { margin: 0 0 6px; font: 600 11px var(--font-sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); }
nav ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
nav a { display: block; padding: 7px 10px; border-radius: 7px; color: var(--ink-2); text-decoration: none; font-weight: 500; }
nav a:hover { background: var(--panel); color: var(--ink); }
nav a[aria-current="page"] { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
main { min-width: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
.bar { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px 20px; padding: 16px 18px 14px; border-bottom: 1px solid var(--line); }
.bar h2 { margin: 0; font: 700 20px/1.2 var(--font-head); letter-spacing: -0.01em; }
.bar p { margin: 4px 0 0; max-width: 70ch; color: var(--ink-2); }
.tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tools .btn { min-height: 34px; padding: 0 12px; font-size: 13px; }
.zoom { min-width: 48px; text-align: center; font: 500 12px var(--font-mono); color: var(--ink-3); }
.canvas { overflow: auto; padding: 18px; max-height: 78vh; background-image: radial-gradient(var(--line) 1px, transparent 1px); background-size: 20px 20px; }
.canvas svg { display: block; margin: 0 auto; max-width: none; height: auto; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 12px 18px; border-top: 1px solid var(--line); color: var(--ink-2); font-size: 12.5px; }
.legend span { display: inline-flex; align-items: center; gap: 7px; }
.legend i { width: 14px; height: 14px; border-radius: 3px; border: 2px solid; }
.note { margin-top: 18px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); color: var(--ink-2); }
.note code { font-family: var(--font-mono); font-size: 12.5px; color: var(--ink); }
#toast { position: fixed; left: 50%; bottom: max(20px, env(safe-area-inset-bottom, 0px)); transform: translateX(-50%) translateY(12px); max-width: min(92vw, 520px); padding: 10px 16px; border-radius: 9px; background: var(--ink); color: var(--bg); font-weight: 500; opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s; z-index: 20; }
#toast.on { opacity: 1; transform: translateX(-50%); }

/* diagram parts: every colour comes from the tokens above, so both themes work */
svg .t { font-family: var(--font-sans); fill: var(--ink); } svg .tb { font-weight: 700; } svg .el { fill: var(--ink-2); }
svg .k-entity { fill: var(--c-ent); stroke: var(--c-ent-s); stroke-width: 2; }
svg .k-process { fill: var(--c-proc); stroke: var(--c-proc-s); stroke-width: 2; }
svg .k-store-bg { fill: var(--panel); stroke: none; } svg .k-store { fill: none; stroke: var(--c-store-s); stroke-width: 2.5; }
svg .k-usecase { fill: var(--c-uc); stroke: var(--c-uc-s); stroke-width: 2; }
svg .k-system { fill: var(--c-proc); stroke: var(--c-proc-s); stroke-width: 2.5; }
svg .k-term { fill: var(--c-term); stroke: var(--c-term-s); stroke-width: 2; }
svg .k-decision { fill: var(--c-dec); stroke: var(--c-dec-s); stroke-width: 2; }
svg .k-fproc { fill: var(--c-fp); stroke: var(--c-fp-s); stroke-width: 2; }
svg .k-page { fill: var(--panel); stroke: var(--line); stroke-width: 2; }
svg .k-boundary { fill: none; stroke: var(--ink-3); stroke-width: 2; }
svg .k-actor { fill: var(--panel); stroke: var(--ink); stroke-width: 2; } svg .k-actor-line { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linecap: round; }
svg .edge { stroke: var(--edge); stroke-width: 1.4; } svg .edge.dash { stroke-dasharray: 6 4; }
svg .m-fill { fill: var(--edge); } svg .m-hollow { fill: var(--panel); stroke: var(--edge); stroke-width: 1.4; }
svg .lbl-bg { fill: var(--lbl); opacity: .94; }

@media (max-width: 860px) {
  .shell { grid-template-columns: minmax(0, 1fr); }
  nav { position: static; flex-direction: row; overflow-x: auto; gap: 18px; padding-bottom: 4px; }
  nav > div { flex: none; } nav ul { flex-direction: row; }
  nav a { white-space: nowrap; }
}
@media (prefers-reduced-motion: reduce) { .btn, #toast { transition: none; } }
</style>
<div class="wrap">
  <header>
    <div>
      <h1>PawTrack System Diagrams</h1>
      <p>Use cases, context diagram, data flow diagrams (levels 0 to 3) and system flowcharts for the PawTrack owner app and admin console.</p>
    </div>
    <div class="actions">
      <a class="btn primary" id="open" href="__LINK__" target="_blank" rel="noopener">Open all 16 pages in draw.io</a>
      <button class="btn" id="copy" type="button">Copy this page for draw.io</button>
    </div>
  </header>
  <div class="shell">
    <nav id="nav" aria-label="Diagrams"></nav>
    <main>
      <div class="bar">
        <div><h2 id="ttl"></h2><p id="blurb"></p></div>
        <div class="tools">
          <button class="btn" id="zout" type="button" aria-label="Zoom out">&minus;</button>
          <span class="zoom" id="zval" aria-live="polite">100%</span>
          <button class="btn" id="zin" type="button" aria-label="Zoom in">+</button>
          <button class="btn" id="zfit" type="button">Fit width</button>
        </div>
      </div>
      <div class="canvas" id="canvas" tabindex="0" aria-label="Diagram, scrollable"></div>
      <div class="legend" id="legend"></div>
    </main>
  </div>
  <div class="note">
    <p style="margin:0">The same diagrams are saved as <code>docs/pawtrack-diagrams.drawio</code> in the project: open it in draw.io (File &rarr; Open) and every diagram is its own page tab. To use a single page from here, press <b>Copy this page for draw.io</b>, then in draw.io choose Extras &rarr; Edit Diagram, paste, and press OK.</p>
  </div>
</div>
<div id="toast" role="status"></div>
<script>
const PAGES = __PAYLOAD__;
const GROUPS = [['Use case', 'Use case diagrams'], ['Context', 'DFD level 0'], ['Data flow', 'DFD levels 1 to 3'], ['System flowchart', 'System flowcharts']];
const LEGEND = {
  'Use case': [['--c-uc','--c-uc-s','Use case'], ['--panel','--ink','Actor'], ['--panel','--ink-3','System boundary']],
  'Context': [['--c-ent','--c-ent-s','External entity'], ['--c-proc','--c-proc-s','The system (process 0)']],
  'Data flow': [['--c-ent','--c-ent-s','External entity'], ['--c-proc','--c-proc-s','Process'], ['--panel','--c-store-s','Data store']],
  'System flowchart': [['--c-term','--c-term-s','Start / end / connector'], ['--c-fp','--c-fp-s','Step'], ['--c-dec','--c-dec-s','Decision']]
};
const $ = (id) => document.getElementById(id);
let current = PAGES[0], zoom = 1;

function label(p) {
  if (p.key.startsWith('dfd')) return p.title.replace('DFD ', '');
  if (p.key === 'context') return 'Level 0: Context diagram';
  if (p.group === 'Use case') return p.title.replace('Use Case: ', '');
  return p.title;
}
function buildNav() {
  $('nav').innerHTML = GROUPS.map(([g, lab]) => {
    const items = PAGES.filter((p) => p.group === g);
    return `<div><h2>${lab}</h2><ul>${items.map((p) => `<li><a href="#${p.key}" data-key="${p.key}">${label(p)}</a></li>`).join('')}</ul></div>`;
  }).join('');
}
function setZoom(z) {
  zoom = Math.max(0.25, Math.min(2.5, z));
  const svg = $('canvas').querySelector('svg');
  if (svg) svg.style.width = Math.round(current.w * zoom) + 'px';
  $('zval').textContent = Math.round(zoom * 100) + '%';
}
function fit() { setZoom(Math.max(0.3, Math.min(1, ($('canvas').clientWidth - 36) / current.w))); }
function show(key) {
  current = PAGES.find((p) => p.key === key) || PAGES[0];
  $('ttl').textContent = current.title;
  $('blurb').textContent = current.blurb;
  $('canvas').innerHTML = current.svg;
  $('legend').innerHTML = `<span>${current.nodes} shapes, ${current.edges} connectors</span>`;
  document.querySelectorAll('#nav a').forEach((a) => { if (a.dataset.key === current.key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  fit();
  $('canvas').scrollTo(0, 0);
}
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 4200); }
$('copy').addEventListener('click', async () => {
  const text = current.xml;
  try { await navigator.clipboard.writeText(text); toast('Copied. In draw.io: Extras, Edit Diagram, paste, OK.'); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove(); toast(ok ? 'Copied. In draw.io: Extras, Edit Diagram, paste, OK.' : 'Copy was blocked here. Use "Open all 16 pages in draw.io" instead.');
  }
});
$('zin').addEventListener('click', () => setZoom(zoom * 1.2));
$('zout').addEventListener('click', () => setZoom(zoom / 1.2));
$('zfit').addEventListener('click', fit);
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
window.addEventListener('resize', () => { if (zoom <= 1) fit(); });
buildNav();
show(location.hash.slice(1) || PAGES[0].key);
</script>
'''
html = html.replace('__LINK__', link).replace('__PAYLOAD__', payload)
html = html.replace('Open all 16 pages', 'Open all %d pages' % len(pages))
open('.claude-tmp-artifact.html', 'w', encoding='utf-8').write(html)
print('artifact bytes', len(html))
