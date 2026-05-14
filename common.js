// ============================================================
// common.js – sdilene funkce pro vsechny HTML stranky v20260513-2137
// ============================================================
const KLIENT_ID   = "demo_sro";
const PAGES_BASE  = "https://ucetnizaverka-hash.github.io/Live-reporting";
const BASE_DATA   = `${PAGES_BASE}/data/vsechna_obdobi_${KLIENT_ID}.json`;
const PDF_URL     = `${PAGES_BASE}/data/vykazy_${KLIENT_ID}.pdf`;

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
// REZIM: prubezne stranky = vzdy "live", historika = vzdy "rocni"
// ============================================================
const _isHistPage = () => location.pathname.includes("historika");
const getMode = () => _isHistPage() ? "rocni" : (location.hash.includes("rocni") ? "rocni" : "live");
const setMode = (m) => {
  if(window._renderFn && window._lastData) {
    window._renderFn(window._lastData);
    _updateModeToggle(window._lastData);
  }
};

// Vrati data aktualni periody podle rezimu
const getModeData = (d) => {
  if(getMode()==="rocni" && d.rocni && Object.keys(d.rocni).length > 0) return d.rocni;
  return d.aktualni;
};

// Vrati periody pro zobrazeni
const getModeAllP = (d) => {
  const mode = getMode();
  const _plny = p => p && (p.je_plny_rok === true || p.mesice === 12 || p.mesice_obdobi === 12);
  if (mode === "rocni") {
    const hist = (d.periody || [])
      .filter(_plny)
      .map(p => ({
        ...p,
        label:        `Rok ${p.rok || ""}`,
        period_label: `Rok ${p.rok || ""}`,
      }));
    const rocni = d.rocni && Object.keys(d.rocni).length > 0
      ? [{...d.rocni,
          label:        `Rok ${d.rocni.rok || ""}`,
          period_label: `Rok ${d.rocni.rok || ""}`,
        }]
      : [];
    return [...hist, ...rocni].filter(p => p && Object.keys(p).length > 0);
  }
  return [d.aktualni].filter(p => p && Object.keys(p).length > 0);
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
  {href:"historika.html", label:"Historická analýza"},
];

function _updateModeToggle(d) {
  const el = document.getElementById("mode-toggle");
  if(el) el.style.display = "none";
}

function renderNav(d) {
  const cur = location.pathname.split("/").pop() || "index.html";
  const meta = d ? getModeData(d) : null;
  const period = meta ? (meta.period_label||"") : "";

  if(document.getElementById("hdr-nazev"))
    document.getElementById("hdr-nazev").textContent = d ? (d.nazev || d.klient_id) : "…";
  if(document.getElementById("hdr-period"))
    document.getElementById("hdr-period").textContent = period ? (" · " + period) : "";
  if(document.getElementById("hdr-ico"))
    document.getElementById("hdr-ico").textContent = d ? (d.ico||"") : "";

  const histPages = [
    {href:"historika.html", label:"Historická analýza"},
    {href:"rozvaha.html",   label:"Rozvaha"},
    {href:"vzz.html",       label:"VZZ"},
    {href:"cashflow.html",  label:"Cash Flow"},
  ];
  const livePages = [
    {href:"index.html",     label:"Úvodní stránka"},
    {href:"rozvaha.html",   label:"Rozvaha"},
    {href:"vzz.html",       label:"VZZ"},
    {href:"cashflow.html",  label:"Cash Flow"},
    {href:"ukazatele.html", label:"Ukazatele"},
  ];

  // Hist stranky vzdy s #rocni, live stranky bez hashe
  const mkLive = p => `<a href="${p.href}" class="nav-lnk${p.href===cur&&!location.hash.includes('rocni')?' active':''}">${p.label}</a>`;
  const mkHist = p => `<a href="${p.href}#rocni" class="nav-lnk${(p.href===cur&&location.hash.includes('rocni'))||(p.href===cur&&_isHistPage())?' active':''}">${p.label}</a>`;

  const navEl = document.getElementById("nav-links");
  if(navEl) navEl.innerHTML = `
    <div class="nav-group">
      <span class="nav-glbl">Průběžné výkaznictví${period ? `<span class="nav-gdate"> · k ${period}</span>` : ""}</span>
      <div class="nav-glinks">${livePages.map(mkLive).join("")}</div>
    </div>
    <div class="nav-divider"></div>
    <div class="nav-group">
      <span class="nav-glbl">Historické výkaznictví</span>
      <div class="nav-glinks">${histPages.map(mkHist).join("")}</div>
    </div>`;
  _updateModeToggle(d);
}

// --- Nacti data + vykresli ---
const BASE_DATA_RAW = `https://raw.githubusercontent.com/ucetnizaverka-hash/Live-reporting/main/data/vsechna_obdobi_${KLIENT_ID}.json`;

async function _fetchWithFallback(url, fallback) {
  const urls = [url, fallback];
  let lastErr;
  for (const u of urls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(u + "?t=" + Date.now(), {signal: ctrl.signal});
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch(e) { lastErr = e; }
  }
  throw lastErr;
}

async function loadData(renderFn) {
  window._renderFn = renderFn;
  try {
    const d = window._LIVE_DATA
      ? window._LIVE_DATA
      : await _fetchWithFallback(BASE_DATA, BASE_DATA_RAW);
    window._lastData = d;
    renderNav(d);
    document.getElementById("loading").style.display="none";
    document.getElementById("app").style.display="block";

    const cur = getModeData(d);
    if(cur && cur.upozorneni) {
      const disc = document.getElementById("disclaimer");
      if(disc) { disc.textContent = cur.upozorneni; disc.style.display="block"; }
    }

    const modeBadge = document.getElementById("mode-badge");
    if(modeBadge) {
      const mode = getMode();
      const rocniOk = hasRocni(d);
      modeBadge.innerHTML = mode==="rocni" && rocniOk
        ? `<span class="badge yellow">Roční výkazy · ${d.rocni.period_label||""}</span>`
        : `<span class="badge green">Průběžné výkaznictví · ${(d.aktualni||{}).period_label||""}</span>`;
    }

    renderFn(d);

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

// --- Altman / IN05 pasmo badge ---
function altmanBadge(pasmo) {
  const m = {zelene:["green","ZDRAVÁ FIRMA"],sede:["yellow","ŠEDÁ ZÓNA"],cervene:["red","RIZIKO"]};
  const [cls,lbl] = m[pasmo]||["yellow",pasmo||"?"];
  return `<span class="badge ${cls}">${lbl}</span>`;
}
function in05Badge(pasmo) {
  const m = {zelene:["green","TVORBA HODNOTY"],sede:["yellow","ŠEDÁ ZÓNA"],cervene:["red","FINANČNÍ TÍSEŇ"]};
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
