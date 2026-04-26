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

// --- Nav html ---
const pages = [
  {href:"index.html",    label:"📊 Dashboard"},
  {href:"vzz.html",      label:"📋 VZZ"},
  {href:"rozvaha.html",  label:"🏦 Rozvaha"},
  {href:"cashflow.html", label:"💧 Cash Flow"},
  {href:"ukazatele.html",label:"📐 Ukazatele"},
  {href:"predikce.html", label:"🔮 Predikce"},
];

function renderNav(d) {
  const cur = location.pathname.split("/").pop() || "index.html";
  const meta = d ? d.aktualni : null;
  document.getElementById("hdr-nazev").textContent = d ? (d.nazev || d.klient_id) : "…";
  document.getElementById("hdr-period").textContent = meta ? meta.period_label : "";
  document.getElementById("hdr-ico").textContent = d ? (d.ico||"") : "";
  document.getElementById("nav-links").innerHTML = pages
    .map(p=>`<a href="${p.href}" class="${p.href===cur?'active':''}">${p.label}</a>`)
    .join("");
}

// --- Nacti data + vykresli ---
async function loadData(renderFn) {
  try {
    const r = await fetch(BASE_DATA + "?t=" + Date.now());
    if(!r.ok) throw new Error("HTTP "+r.status);
    const d = await r.json();
    renderNav(d);
    document.getElementById("loading").style.display="none";
    document.getElementById("app").style.display="block";
    if(d.aktualni && d.aktualni.upozorneni) {
      const disc = document.getElementById("disclaimer");
      if(disc) { disc.textContent = d.aktualni.upozorneni; disc.style.display="block"; }
    }
    renderFn(d);
  } catch(e) {
    document.getElementById("loading").style.display="none";
    const eb = document.getElementById("err");
    eb.style.display="block";
    eb.innerHTML=`<strong>Nepodařilo se načíst data.</strong> ${e.message}<br><small>${BASE_DATA}</small>`;
    renderNav(null);
  }
}

// --- Stavba radku tabulky ---
function tr(label, vals, {bold=false, sub=false, sub2=false, sep=false, note=false,
                           negRed=false, posGreen=false, showDelta=false, invertDelta=false}={}) {
  if(sep) return `<tr class="sep"><td colspan="${1+vals.length}"></td></tr>`;
  const cls = bold?"bold":sub2?"sub2":sub?"sub":"";
  let html = `<tr class="${cls}"><td>${note?`<em>${label}</em>`:label}</td>`;
  vals.forEach((v,i)=>{
    let txt, tdcls="";
    if(typeof v==="object"&&v!==null&&"val" in v) {
      txt = v.fmt; tdcls = v.cls||"";
    } else {
      txt = v===null||v===undefined?"—":v;
    }
    const n = parseFloat(String(txt).replace(/\s/g,"").replace("Kč","").replace("%",""));
    if(!isNaN(n)) {
      if(negRed&&n<0) tdcls="neg";
      if(posGreen&&n>0) tdcls="pos";
    }
    html += `<td class="${tdcls}">${txt}</td>`;
  });
  if(showDelta && vals.length>=2) {
    const a = parseFloat(String(vals[0]).replace(/\s/g,"").replace("Kč","").replace("%",""));
    const b = parseFloat(String(vals[1]).replace(/\s/g,"").replace("Kč","").replace("%",""));
    const d2 = delta(a,b);
    if(d2!==null) {
      const good = invertDelta ? d2<0 : d2>0;
      html += `<td class="${good?"pos":"neg"}">${d2>0?"▲":"▼"} ${Math.abs(d2).toFixed(1)}%</td>`;
    } else { html += `<td></td>`; }
  }
  return html + `</tr>`;
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
