// ============================================================
// common.js – sdilene funkce pro vsechny HTML stranky
// ============================================================
const KLIENT_ID = "demo_sro";
const BASE_DATA = `https://raw.githubusercontent.com/ucetnizaverka-hash/Live-reporting/main/data/vsechna_obdobi_${KLIENT_ID}.json`;
const PDF_URL   = `https://raw.githubusercontent.com/ucetnizaverka-hash/Live-reporting/main/data/vykazy_${KLIENT_ID}.pdf`;

// --- Formatovani ---
const kc = (v, empty="—") => {
  if (v===null||v===undefined) return empty;
  const n = parseFloat(v); if(isNaN(n)) return String(v);
  return n.toLocaleString("cs-CZ",{maximumFractionDigits:0}) + " Kč";
};
const pct  = (v,d=1) => (v===null||v===undefined) ? "—" : parseFloat(v).toFixed(d)+" %";
const num  = (v,d=2) => (v===null||v===undefined) ? "—" : parseFloat(v).toFixed(d);
const days = (v) => (v===null||v===undefined) ? "—" : Math.round(parseFloat(v))+" dní";

const delta = (a,b) => {
  if(!b||b===0||a===null||a===undefined) return null;
  return ((a-b)/Math.abs(b)*100);
};
const deltaHtml = (a,b,invert=false) => {
  const d = delta(a,b); if(d===null) return "";
  const good = invert ? d<0 : d>0;
  const cls = good ? "delta up" : "delta down";
  const sign = d>0 ? "▲" : "▼";
  return `<span class="${cls}">${sign} ${Math.abs(d).toFixed(1)}%</span>`;
};

// ============================================================
// REZIM: "live" (průběžné výkaznictví) nebo "rocni" (roční výkazy)
// ============================================================
const getMode = () => location.hash.includes("rocni") ? "rocni" : "live";
const setMode = (m) => {
  location.hash = (m === "rocni") ? "rocni" : "live";
  // Znovu vykresli bez noveho fetche (re-render)
  if(window._renderFn && window._lastData) {
    window._renderFn(window._lastData);
    _updateModeToggle(window._lastData);
  }
};

// Vrati data aktualni periody podle rezimu
const getModeData = (d) => {
  const mode = getMode();
  if(mode === "rocni" && d.rocni && Object.keys(d.rocni).length > 0) return d.rocni;
  return d.aktualni;
};

// Vrati vsechny periody pro zobrazeni (historicke + aktualni v danem rezimu)
const getModeAllP = (d) => {
  const cur = getModeData(d);
  return [...(d.periody||[]), cur].filter(p => p && Object.keys(p).length > 0);
};

// Zjisti jestli existuji rocni data
const hasRocni = (d) => d && d.rocni && Object.keys(d.rocni).length > 0;

// --- Nav html ---
const pages = [
  {href:"index.html",     label:"Dashboard"},
  {href:"vzz.html",       label:"VZZ"},
  {href:"rozvaha.html",   label:"Rozvaha"},
  {href:"cashflow.html",  label:"Cash Flow"},
  {href:"ukazatele.html", label:"Ukazatele"},
  {href:"predikce.html",  label:"Predikce"},
  {href:"historika.html", label:"Historická analýza"},
];

function _updateModeToggle(d) {
  const el = document.getElementById("mode-toggle");
  if(!el) return;
  if(!hasRocni(d)) { el.style.display="none"; return; }
  const mode = getMode();
  el.style.display = "flex";
  el.innerHTML = `
    <span style="font-size:11px;color:var(--gray);margin-right:6px">Zobrazení:</span>
    <button class="${mode==='live'?'mt-active':''}"   onclick="setMode('live')">Průběžné výkaznictví</button>
    <button class="${mode==='rocni'?'mt-active':''}"  onclick="setMode('rocni')">Roční výkazy</button>`;
}

function renderNav(d) {
  const cur = location.pathname.split("/").pop() || "index.html";
  const meta = d ? getModeData(d) : null;
  document.getElementById("hdr-nazev").textContent = d ? (d.nazev || d.klient_id) : "…";
  document.getElementById("hdr-period").textContent = meta ? (" · " + (meta.period_label||"")) : "";
  document.getElementById("hdr-ico").textContent = d ? (d.ico||"") : "";
  document.getElementById("nav-links").innerHTML = pages
    .map(p=>`<a href="${p.href}${location.hash}" class="${p.href===cur?'active':''}">${p.label}</a>`)
    .join("");
  _updateModeToggle(d);
}

// --- Nacti data + vykresli ---
async function loadData(renderFn) {
  window._renderFn = renderFn;
  try {
    const r = await fetch(BASE_DATA + "?t=" + Date.now());
    if(!r.ok) throw new Error("HTTP "+r.status);
    const d = await r.json();
    window._lastData = d;
    renderNav(d);
    document.getElementById("loading").style.display="none";
    document.getElementById("app").style.display="block";

    // Disclaimer ze živých dat
    const cur = getModeData(d);
    if(cur && cur.upozorneni) {
      const disc = document.getElementById("disclaimer");
      if(disc) { disc.textContent = cur.upozorneni; disc.style.display="block"; }
    }

    // Badge rezimu
    const modeBadge = document.getElementById("mode-badge");
    if(modeBadge) {
      const mode = getMode();
      const rocniOk = hasRocni(d);
      modeBadge.innerHTML = mode==="rocni" && rocniOk
        ? `<span class="badge yellow">Roční výkazy · ${d.rocni.period_label||""}</span>`
        : `<span class="badge green">Průběžné výkaznictví · ${(d.aktualni||{}).period_label||""}</span>`;
    }

    renderFn(d);

    // Hashchange – prepnuti rezimu bez noveho fetche
    window.onhashchange = () => {
      renderNav(d);
      const disc = document.getElementById("disclaimer");
      const cur2 = getModeData(d);
      if(disc && cur2) { disc.textContent = cur2.upozorneni||""; disc.style.display = cur2.upozorneni?"block":"none"; }
      const mb = document.getElementById("mode-badge");
      const mode2 = getMode();
      if(mb) {
        mb.innerHTML = mode2==="rocni" && hasRocni(d)
          ? `<span class="badge yellow">Roční výkazy · ${d.rocni.period_label||""}</span>`
          : `<span class="badge green">Průběžné výkaznictví · ${(d.aktualni||{}).period_label||""}</span>`;
      }
      renderFn(d);
    };

  } catch(e) {
    document.getElementById("loading").style.display="none";
    const eb = document.getElementById("err");
    eb.style.display="block";
    eb.innerHTML=`<strong>Nepodařilo se načíst data.</strong> ${e.message}<br><small>${BASE_DATA}</small>`;
    renderNav(null);
  }
}

// --- Altman pasmo badge ---
function altmanBadge(pasmo) {
  const m = {zelene:["green","ZDRAVÁ FIRMA"],sede:["yellow","ŠEDÁ ZÓNA"],cervene:["red","RIZIKO"]};
  const [cls,lbl] = m[pasmo]||["yellow",pasmo||"?"];
  return `<span class="badge ${cls}">${lbl}</span>`;
}

// --- Sektor benchmark indikator ---
function benchColor(val, bench, higherBetter=true, tolerance=0.15) {
  if(val===null||val===undefined||bench===null) return "";
  const v=parseFloat(val), b=parseFloat(bench);
  if(isNaN(v)||isNaN(b)) return "";
  const ratio = higherBetter ? v/b : b/v;
  if(ratio>=1-tolerance) return "bench-ok";
  if(ratio>=1-tolerance*2) return "bench-warn";
  return "bench-bad";
}

// --- Trend sipka ---
function trendArrow(cur, prev) {
  if(prev===null||prev===undefined||cur===null||cur===undefined) return "";
  const d = cur - prev;
  if(Math.abs(d) < 0.01) return '<span class="delta">→</span>';
  return d > 0
    ? '<span class="delta up">▲ ' + Math.abs(d).toFixed(1) + '</span>'
    : '<span class="delta down">▼ ' + Math.abs(d).toFixed(1) + '</span>';
}

// --- Animated background helper ---
function injectBgCanvas() {
  if (document.querySelector('.bg-canvas')) return;
  const div = document.createElement('div');
  div.className = 'bg-canvas';
  div.innerHTML = `
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>`;
  document.body.insertBefore(div, document.body.firstChild);
}
document.addEventListener('DOMContentLoaded', injectBgCanvas);
