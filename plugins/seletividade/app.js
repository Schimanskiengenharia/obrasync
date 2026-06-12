// ─────────────────────────────────────────────────────────────────────────────
// Estudo de Seletividade — plugin do ObraSync (Schimanski Engenharia)
// HTML + CSS + JS puro, canvas próprio (sem CDN). Sessão validada na API do
// ObraSync via token Bearer compartilhado pelo localStorage (mesma origem).
// v1.1 — logo em base64 no PDF (evita corrida de carregamento da imagem no
// window.print) e tipografia do gráfico proporcional ao tamanho do canvas
// (legível nas imagens de alta resolução do PDF, nítido em telas high-DPI).
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const API_BASE = new URL("../../api", location.href).href.replace(/\/$/, "");
const LOGIN_URL = new URL("../../", location.href).href;
const AUTH_KEY = "finconta.auth";
const DRAFT_KEY = "finconta.seletividade.draft";

const ROLE_LABELS = {
  admin: "Administrador", financeiro: "Financeiro", comercial: "Comercial",
  engenharia: "Engenharia", gestor_obra: "Gestor de obra", equipe_campo: "Equipe de campo",
  cliente_obra: "Cliente", fornecedor_terceiro: "Fornecedor", consulta: "Consulta",
  gerente: "Gerente", operador: "Operador", visualizador: "Visualizador",
};

// Curvas IEC 60255: t = DT × β / (M^α − 1), com M = I / Ipartida.
const IEC_CURVES = {
  NI:  { beta: 0.14,  alpha: 0.02 }, // Normalmente Inversa
  MI:  { beta: 13.5,  alpha: 1.00 }, // Muito Inversa
  EI:  { beta: 80.0,  alpha: 2.00 }, // Extremamente Inversa
  LTI: { beta: 120.0, alpha: 1.00 }, // Inversa de Tempo Longo
};

const INRUSH_FACTORS = { seco: 14, oleo_menor: 10, oleo_maior: 8 };

// Tempo de atuação da unidade instantânea (função 50), em segundos.
// Usado tanto no desenho da queda vertical do coordenograma quanto na
// verificação de seletividade — gráfico e badge sempre coerentes.
const INST_TRIP_TIME = 0.05;

// Tempo (s) de atuação da unidade 51 para a corrente I (mesma base de Ip).
function calcTime(I, Ip, DT, curve) {
  if (!(Ip > 0) || !(DT > 0)) return Infinity;
  const M = I / Ip;
  if (M <= 1) return Infinity; // abaixo do pick-up: não atua
  const { beta, alpha } = IEC_CURVES[curve] || IEC_CURVES.NI;
  return DT * beta / (Math.pow(M, alpha) - 1);
}

// Dial (DT) para a curva passar por M=20 com t=0,2 s.
function dialForCurve(curve) {
  const { beta, alpha } = IEC_CURVES[curve] || IEC_CURVES.NI;
  return 0.2 * (Math.pow(20, alpha) - 1) / beta;
}

// ── Logo em base64 (pré-carregada; usada no relatório de impressão) ─────────
// A <img> do relatório é inserida no DOM imediatamente antes do window.print():
// com caminho relativo, a imagem podia não terminar de carregar a tempo e sair
// em branco no PDF. Em data URL a renderização é imediata, sem rede.
let logoDataUrl = null;

async function loadLogoBase64() {
  if (logoDataUrl) return logoDataUrl;
  try {
    const res = await fetch(new URL("../../assets/logo.png", location.href).href);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => { logoDataUrl = String(reader.result); resolve(logoDataUrl); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Sessão ObraSync ─────────────────────────────────────────────────────────

function readObraSyncAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.token ? session : null;
  } catch {
    return null;
  }
}

async function checkObraSyncSession() {
  const session = readObraSyncAuth();
  if (!session) {
    window.location.href = LOGIN_URL;
    return null;
  }
  try {
    // Token só nos headers (Authorization + X-Auth-Token, que o PHP-CGI não
    // remove). O antigo ?token= na query deixava o token de sessão gravado
    // nos access logs do Apache e foi removido — a API também não o aceita mais.
    const res = await fetch(`${API_BASE}/check-session`, {
      headers: { Authorization: `Bearer ${session.token}`, "X-Auth-Token": session.token },
    });
    const data = await res.json();
    if (!res.ok || (!data.ok && !data.success)) {
      window.location.href = LOGIN_URL;
      return null;
    }
    return data.user; // { id, username, name, email, role }
  } catch {
    window.location.href = LOGIN_URL;
    return null;
  }
}

// Tema por usuário (mesmas chaves do ObraSync); o tema base já foi aplicado
// pelo script inline do <head> antes do primeiro paint.
function applyUserTheme(userId) {
  let pref = "auto";
  try {
    pref = localStorage.getItem(`finconta.theme.${userId}`) || localStorage.getItem("finconta.theme") || "auto";
  } catch { /* sem armazenamento */ }
  if (!["light", "dark", "auto"].includes(pref)) pref = "auto";
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const apply = () => {
    const dark = pref === "dark" || (pref === "auto" && media?.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };
  apply();
  if (pref === "auto") media?.addEventListener?.("change", apply);
}

// ── Helpers de formulário ───────────────────────────────────────────────────

const qs = (id) => document.getElementById(id);
const num = (id) => {
  const value = parseFloat(String(qs(id)?.value ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
};
const txt = (id) => String(qs(id)?.value ?? "").trim();

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const fmt = (value, decimals = 2) =>
  Number.isFinite(value) ? value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : "—";

// Instantâneo da retaguarda: aceita número ou a palavra BLOQ (função 50
// bloqueada no relé da concessionária). BLOQ/vazio → 0 → plotCurve não
// desenha a queda vertical e a curva 51 desce naturalmente até tMin.
function parseInstValue(id) {
  const raw = String(qs(id)?.value ?? "").trim().toUpperCase();
  if (raw === "BLOQ" || raw === "") return 0;
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isInstBloq(id) {
  const raw = String(qs(id)?.value ?? "").trim().toUpperCase();
  return raw === "BLOQ";
}

function allFieldIds() {
  return [...document.querySelectorAll(".panel-left input, .panel-left select")].map((el) => el.id).filter(Boolean);
}

function saveDraft() {
  const data = {};
  allFieldIds().forEach((id) => { data[id] = qs(id).value; });
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([id, value]) => { if (qs(id)) qs(id).value = value; });
  } catch { /* draft corrompido: ignora */ }
}

// ── Motor de cálculo ────────────────────────────────────────────────────────

let calc = null; // resultado do último cálculo
let chartMode = "ambos";

function computeStudy() {
  const Vn = num("nccTensao");        // kV
  const kva = num("instKva");
  const kw = num("instDemandaKw");
  const fp = num("instFp");
  const rtc = num("instRtc");
  if (!(Vn > 0) || !(kva > 0) || !(kw > 0) || !(fp > 0) || !(rtc > 0)) {
    alert("Preencha tensão nominal, potência do transformador, demanda, fator de potência e RTC com valores maiores que zero.");
    return null;
  }

  const inrushFactor = INRUSH_FACTORS[txt("instIsolacao")] || 10;
  const curvaFase = txt("instCurvaFase") || "NI";
  const curvaNeutro = txt("instCurvaNeutro") || "NI";

  const In = (kva * 1000) / (Math.sqrt(3) * Vn * 1000);
  const InDem = (kw / fp) / (Math.sqrt(3) * Vn);

  const inrushFase = inrushFactor * InDem;   // A primário @ 0,1 s
  const inrushNeutro = inrushFase / 3;

  const aj51F = (1.25 * InDem) / rtc;        // A secundário
  const aj51N = aj51F / 3;
  const aj50F = (1.1 * inrushFase) / rtc;
  const aj50N = aj50F / 3;

  const prim51F = aj51F * rtc;
  const prim51N = aj51N * rtc;
  const prim50F = aj50F * rtc;
  const prim50N = aj50N * rtc;

  const dialFase = dialForCurve(curvaFase);
  const dialNeutro = dialForCurve(curvaNeutro);

  return {
    Vn, kva, kw, fp, rtc, inrushFactor, curvaFase, curvaNeutro,
    In, InDem, inrushFase, inrushNeutro,
    aj51F, aj51N, aj50F, aj50N,
    prim51F, prim51N, prim50F, prim50N,
    dialFase, dialNeutro,
    icc3f: num("nccIcc3f"),
    iccFt: num("nccIccFt"),
    ret: {
      fase: { ip: num("retFaseIp"), dial: num("retFaseDial"), curva: txt("retFaseCurva") || "NI", inst: parseInstValue("retFaseInst"), instBloq: isInstBloq("retFaseInst") },
      neutro: { ip: num("retNeutroIp"), dial: num("retNeutroDial"), curva: txt("retNeutroCurva") || "NI", inst: parseInstValue("retNeutroInst"), instBloq: isInstBloq("retNeutroInst") },
    },
    ansi: {
      fase: { i: num("ansiFaseI"), t: num("ansiFaseT") },
      neutro: { i: num("ansiNeutroI"), t: num("ansiNeutroT") },
    },
  };
}

// Tempo de atuação da instalação (51 + 50) em corrente PRIMÁRIA.
function tripTimeInstalacao(I, fase) {
  const Ip = fase ? calc.prim51F : calc.prim51N;
  const dial = fase ? calc.dialFase : calc.dialNeutro;
  const curva = fase ? calc.curvaFase : calc.curvaNeutro;
  const inst = fase ? calc.prim50F : calc.prim50N;
  let t = calcTime(I, Ip, dial, curva);
  if (inst > 0 && I >= inst) t = Math.min(t, INST_TRIP_TIME);
  return t;
}

// Tempo de atuação da retaguarda Energisa em corrente primária.
function tripTimeRetaguarda(I, fase) {
  const ret = fase ? calc.ret.fase : calc.ret.neutro;
  let t = calcTime(I, ret.ip, ret.dial, ret.curva);
  if (ret.inst > 0 && I >= ret.inst) t = Math.min(t, INST_TRIP_TIME);
  return t;
}

// Verifica se a curva da retaguarda fica SEMPRE acima da curva da instalação
// na faixa de corrente relevante (até o Icc correspondente).
function checkSelectivity(fase) {
  const iccLimit = fase ? calc.icc3f : calc.iccFt;
  const pickupInst = fase ? calc.prim51F : calc.prim51N;
  const pickupRet = fase ? calc.ret.fase.ip : calc.ret.neutro.ip;
  if (!(iccLimit > 0) || !(pickupRet > 0)) return { ok: true, margin: null, evaluated: false };

  const Imin = Math.max(pickupInst, pickupRet) * 1.05;
  if (Imin >= iccLimit) return { ok: true, margin: null, evaluated: false };

  let margin = Infinity;
  let ok = true;
  const steps = 240;
  const logMin = Math.log10(Imin);
  const logMax = Math.log10(iccLimit);
  for (let i = 0; i <= steps; i++) {
    const I = Math.pow(10, logMin + (i / steps) * (logMax - logMin));
    const tInst = tripTimeInstalacao(I, fase);
    const tRet = tripTimeRetaguarda(I, fase);
    if (!Number.isFinite(tInst) || !Number.isFinite(tRet)) continue;
    const diff = tRet - tInst;
    if (diff < margin) margin = diff;
    if (diff <= 0) ok = false; // curvas se cruzam ou se tocam
  }
  return { ok, margin: Number.isFinite(margin) ? margin : null, evaluated: true };
}

// ── Renderização dos resultados ─────────────────────────────────────────────

function renderResults() {
  const rows = [
    ["group", "Correntes calculadas"],
    ["In — nominal do transformador", `${fmt(calc.In)} A`],
    ["In.dem — corrente de demanda", `${fmt(calc.InDem)} A`],
    [`INRUSH fase (×${calc.inrushFactor}) @ 0,1 s`, `${fmt(calc.inrushFase)} A`],
    ["INRUSH neutro @ 0,1 s", `${fmt(calc.inrushNeutro)} A`],
    ["Icc trifásico (NCC)", `${fmt(calc.icc3f, 0)} A`],
    ["Icc fase-terra (NCC)", `${fmt(calc.iccFt, 0)} A`],
    ["group", "Ajustes do relé — secundário (A)"],
    [`51F — curva ${calc.curvaFase}`, `${fmt(calc.aj51F)} A`],
    [`51N — curva ${calc.curvaNeutro}`, `${fmt(calc.aj51N)} A`],
    ["50F — instantâneo", `${fmt(calc.aj50F)} A`],
    ["50N — instantâneo", `${fmt(calc.aj50N)} A`],
    ["group", "Ajustes refletidos ao primário (A)"],
    ["51F primário", `${fmt(calc.prim51F)} A`],
    ["51N primário", `${fmt(calc.prim51N)} A`],
    ["50F primário", `${fmt(calc.prim50F)} A`],
    ["50N primário", `${fmt(calc.prim50N)} A`],
    ["group", "Dial calculado (M=20, t=0,2 s)"],
    [`DT fase (${calc.curvaFase})`, fmt(calc.dialFase, 4)],
    [`DT neutro (${calc.curvaNeutro})`, fmt(calc.dialNeutro, 4)],
  ];
  qs("resultadosBody").innerHTML = rows.map(([label, value]) =>
    label === "group"
      ? `<tr class="group"><td colspan="2">${value}</td></tr>`
      : `<tr><td>${label}</td><td>${value}</td></tr>`
  ).join("");
  // Re-trigger da animação de entrada ao recalcular (reflow reinicia o keyframe).
  const el = qs("resultados");
  el.classList.remove("hidden");
  el.style.animation = "none";
  el.offsetHeight; // reflow
  el.style.animation = "";
}

function renderBadge() {
  const fase = checkSelectivity(true);
  const neutro = checkSelectivity(false);
  const ok = fase.ok && neutro.ok;
  const badge = qs("badgeSeletividade");
  badge.textContent = ok ? "✅ SELETIVIDADE OK" : "❌ SELETIVIDADE NOK";
  badge.className = `badge ${ok ? "ok" : "nok"}`;
  const part = (name, r) => `${name}: ${r.ok ? "OK" : "NOK"}${r.evaluated && r.margin !== null ? ` (margem mín. ${fmt(r.margin)} s)` : ""}`;
  qs("seletividadeDetalhe").textContent =
    `${part("Fase", fase)} · ${part("Neutro", neutro)} — instalação deve atuar antes da retaguarda em toda a faixa até o Icc.`;
  return { fase, neutro, ok };
}

// ── Coordenograma (canvas log-log) ──────────────────────────────────────────

const CHART = {
  iMin: 1, iMax: 100000,   // corrente (A primário)
  tMin: 0.01, tMax: 1000,  // tempo (s)
};

const COLORS = {
  inst: "#2563eb",
  ret: "#16a34a",
  icc: "#dc2626",
  inom: "#6b7280",
  inrush: "#7c3aed",
  ansi: "#ea580c",
  grid: "#e5e7eb",
  gridMinor: "#f3f4f6",
  text: "#374151",
};

// Desenha o coordenograma em um contexto 2D já preparado, em coordenadas
// lógicas W×H. Na tela o ctx vem transformado pelo devicePixelRatio (traço
// vetorial nítido em high-DPI); no PDF é um canvas offscreen 1600×1100.
// Tipografia e espessuras são proporcionais a H para legibilidade no PDF.
function drawChart(ctx, W, H, mode, options = {}) {
  const scale = H / 740; // base de proporção (altura típica da tela)
  const fontSize = Math.max(10, Math.round(12 * scale));
  const pad = {
    left: Math.round(78 * scale),
    right: Math.round(24 * scale),
    top: Math.round((options.title ? 58 : 28) * scale),
    bottom: Math.round(56 * scale),
  };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const xPos = (I) => pad.left + ((Math.log10(I) - Math.log10(CHART.iMin)) / (Math.log10(CHART.iMax) - Math.log10(CHART.iMin))) * plotW;
  const yPos = (t) => pad.top + (1 - (Math.log10(t) - Math.log10(CHART.tMin)) / (Math.log10(CHART.tMax) - Math.log10(CHART.tMin))) * plotH;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Título (usado nas versões exportadas para o PDF)
  if (options.title) {
    ctx.fillStyle = "#1e3a5f";
    ctx.font = `bold ${Math.round(20 * scale)}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(options.title, W / 2, Math.round(34 * scale));
  }

  // ── Grade log-log ──
  const decadeLabel = (v) => (v >= 1000 ? `${nf.format(v / 1000)}k` : nf.format(v));
  ctx.lineWidth = 1;
  for (let e = 0; e <= 5; e++) {
    const base = Math.pow(10, e);
    if (e < 5) {
      for (let m = 2; m <= 9; m++) {
        const xi = xPos(base * m);
        ctx.strokeStyle = COLORS.gridMinor;
        ctx.beginPath(); ctx.moveTo(xi, pad.top); ctx.lineTo(xi, pad.top + plotH); ctx.stroke();
      }
    }
    const xi = xPos(base);
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath(); ctx.moveTo(xi, pad.top); ctx.lineTo(xi, pad.top + plotH); ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = `${fontSize}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(decadeLabel(base), xi, pad.top + plotH + fontSize + 6);
  }
  for (let e = -2; e <= 3; e++) {
    const base = Math.pow(10, e);
    if (e < 3) {
      for (let m = 2; m <= 9; m++) {
        const yi = yPos(base * m);
        ctx.strokeStyle = COLORS.gridMinor;
        ctx.beginPath(); ctx.moveTo(pad.left, yi); ctx.lineTo(pad.left + plotW, yi); ctx.stroke();
      }
    }
    const yi = yPos(base);
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath(); ctx.moveTo(pad.left, yi); ctx.lineTo(pad.left + plotW, yi); ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = `${fontSize}px Inter, Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(base.toLocaleString("pt-BR"), pad.left - 8, yi + 4);
  }

  // Moldura + títulos dos eixos
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold ${Math.max(11, Math.round(13 * scale))}px Inter, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Corrente (A) — primário", pad.left + plotW / 2, H - Math.round(12 * scale));
  ctx.save();
  ctx.translate(Math.round(20 * scale), pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Tempo (s)", 0, 0);
  ctx.restore();

  if (!calc) return;

  const clip = () => { ctx.save(); ctx.beginPath(); ctx.rect(pad.left, pad.top, plotW, plotH); ctx.clip(); };

  // Curva 51 em corrente primária com o comportamento real da função 50:
  // a curva temporizada vai até o pick-up do instantâneo e cai VERTICALMENTE
  // até o tempo de atuação instantânea; além desse ponto nada é desenhado
  // (o disjuntor abriu) — como nos coordenogramas profissionais (Supercoord).
  const plotCurve = (Ip, dial, curve, instLevel, color, dashed) => {
    if (!(Ip > 0) || !(dial > 0)) return;
    clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, 2.2 * scale);
    ctx.setLineDash(dashed ? [9 * scale, 6 * scale] : []);
    const hasInst = instLevel > Ip * 1.02 && instLevel < CHART.iMax;
    const logStart = Math.log10(Ip * 1.02);
    const logEnd = Math.log10(hasInst ? instLevel : CHART.iMax);
    ctx.beginPath();
    let started = false;
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const I = Math.pow(10, logStart + (i / steps) * (logEnd - logStart));
      const t = calcTime(I, Ip, dial, curve);
      if (!Number.isFinite(t)) continue;
      const tc = Math.min(Math.max(t, CHART.tMin), CHART.tMax);
      if (!started) { ctx.moveTo(xPos(I), yPos(tc)); started = true; }
      else ctx.lineTo(xPos(I), yPos(tc));
    }
    // Queda vertical abrupta no pick-up do instantâneo (continuação do traço).
    if (hasInst && started) {
      ctx.lineTo(xPos(instLevel), yPos(Math.max(INST_TRIP_TIME, CHART.tMin)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  // Linha vertical de referência/instantâneo com rótulo.
  const vline = (I, color, dash, label) => {
    if (!(I > CHART.iMin) || I > CHART.iMax) return;
    clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.4, 1.6 * scale);
    ctx.setLineDash(dash.map((d) => d * scale));
    ctx.beginPath(); ctx.moveTo(xPos(I), pad.top); ctx.lineTo(xPos(I), pad.top + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (label) {
      // Rótulo deslocado para a DIREITA da linha (o texto rotacionado se estende
      // no sentido +x) e a 30% da altura do plot — fora do topo, onde as curvas
      // e a legenda se acumulam.
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `${Math.max(10, Math.round(11 * scale))}px Inter, Arial, sans-serif`;
      ctx.translate(xPos(I) + Math.round(8 * scale), pad.top + plotH * 0.30);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = "left";
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  };

  const pointMark = (I, t, color, shape, label) => {
    if (!(I > 0) || !(t > 0)) return;
    const px = xPos(Math.min(Math.max(I, CHART.iMin), CHART.iMax));
    const py = yPos(Math.min(Math.max(t, CHART.tMin), CHART.tMax));
    const r = Math.max(5, 5.5 * scale);
    ctx.fillStyle = color;
    if (shape === "tri") {
      ctx.beginPath();
      ctx.moveTo(px - r, py - r); ctx.lineTo(px + r * 1.2, py); ctx.lineTo(px - r, py + r);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = `${Math.max(10, Math.round(11 * scale))}px Inter, Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(label, px + r + 4, py - r);
  };

  const showFase = mode === "fase" || mode === "ambos";
  const showNeutro = mode === "neutro" || mode === "ambos";

  // Linhas de referência de corrente (verticais no diagrama tempo × corrente)
  if (showFase) vline(calc.icc3f, COLORS.icc, [8, 5], `ICCmax = ${fmt(calc.icc3f, 0)} A`);
  if (showNeutro) vline(calc.iccFt, COLORS.icc, [8, 5], `ICCmin = ${fmt(calc.iccFt, 0)} A`);
  vline(calc.In, COLORS.inom, [4, 4], `Inom = ${fmt(calc.In, 1)} A`);

  // Instantâneos da instalação (linhas verticais pontilhadas azuis)
  if (showFase) vline(calc.prim50F, COLORS.inst, [2, 4], `50F = ${fmt(calc.prim50F, 0)} A`);
  if (showNeutro) vline(calc.prim50N, COLORS.inst, [2, 4], `50N = ${fmt(calc.prim50N, 0)} A`);

  // Curvas 51 — instalação (azul) e retaguarda Energisa (verde)
  if (showFase) {
    plotCurve(calc.prim51F, calc.dialFase, calc.curvaFase, calc.prim50F, COLORS.inst, false);
    plotCurve(calc.ret.fase.ip, calc.ret.fase.dial, calc.ret.fase.curva, calc.ret.fase.inst, COLORS.ret, false);
  }
  if (showNeutro) {
    plotCurve(calc.prim51N, calc.dialNeutro, calc.curvaNeutro, calc.prim50N, COLORS.inst, true);
    plotCurve(calc.ret.neutro.ip, calc.ret.neutro.dial, calc.ret.neutro.curva, calc.ret.neutro.inst, COLORS.ret, true);
  }

  // Pontos INRUSH (roxo) e ANSI (laranja)
  if (showFase) {
    pointMark(calc.inrushFase, 0.1, COLORS.inrush, "dot", "INRUSH F");
    pointMark(calc.ansi.fase.i, calc.ansi.fase.t, COLORS.ansi, "tri", "ANSI F");
  }
  if (showNeutro) {
    pointMark(calc.inrushNeutro, 0.1, COLORS.inrush, "dot", "INRUSH N");
    pointMark(calc.ansi.neutro.i, calc.ansi.neutro.t, COLORS.ansi, "tri", "ANSI N");
  }

  // ── Legenda (canto superior direito) ──
  const legend = [];
  if (showFase) {
    legend.push({ color: COLORS.inst, dash: [], label: `51F instalação (${calc.curvaFase})` });
    legend.push({ color: COLORS.ret, dash: [], label: `51F retaguarda (${calc.ret.fase.curva})${calc.ret.fase.instBloq ? " — 50F BLOQ" : ""}` });
    legend.push({ color: COLORS.inst, dash: [2, 4], label: "50F instantâneo" });
  }
  if (showNeutro) {
    legend.push({ color: COLORS.inst, dash: [9, 6], label: `51N instalação (${calc.curvaNeutro})` });
    legend.push({ color: COLORS.ret, dash: [9, 6], label: `51N retaguarda (${calc.ret.neutro.curva})${calc.ret.neutro.instBloq ? " — 50N BLOQ" : ""}` });
    legend.push({ color: COLORS.inst, dash: [2, 4], label: "50N instantâneo" });
  }
  legend.push({ color: COLORS.icc, dash: [8, 5], label: "Icc (máx/mín)" });
  legend.push({ color: COLORS.inrush, dot: true, label: "INRUSH @ 0,1 s" });
  legend.push({ color: COLORS.ansi, tri: true, label: "Ponto ANSI" });

  const lineH = fontSize + Math.round(7 * scale);
  // Largura dinâmica: rótulos com sufixo "— 50x BLOQ" excedem os 235px fixos
  ctx.font = `${fontSize}px Inter, Arial, sans-serif`;
  const maxLabelW = Math.max(...legend.map((item) => ctx.measureText(item.label).width));
  const lw = Math.max(Math.round(235 * scale), Math.ceil(maxLabelW + 52 * scale));
  const lh = legend.length * lineH + Math.round(14 * scale);
  const lx = pad.left + plotW - lw - Math.round(10 * scale);
  const ly = pad.top + Math.round(10 * scale);
  ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.fillRect(lx, ly, lw, lh);
  ctx.strokeRect(lx, ly, lw, lh);
  legend.forEach((item, index) => {
    const iy = ly + fontSize + Math.round(4 * scale) + index * lineH;
    const mid = iy - fontSize * 0.32;
    if (item.dot) {
      ctx.fillStyle = item.color;
      ctx.beginPath(); ctx.arc(lx + 22 * scale, mid, 5 * scale, 0, Math.PI * 2); ctx.fill();
    } else if (item.tri) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(lx + 16 * scale, mid - 5 * scale);
      ctx.lineTo(lx + 28 * scale, mid);
      ctx.lineTo(lx + 16 * scale, mid + 5 * scale);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = Math.max(2, 2.4 * scale);
      ctx.setLineDash(item.dash.map((d) => d * scale));
      ctx.beginPath(); ctx.moveTo(lx + 10 * scale, mid); ctx.lineTo(lx + 34 * scale, mid); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = COLORS.text;
    ctx.font = `${fontSize}px Inter, Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(item.label, lx + 42 * scale, iy);
  });
}

// Tela: desenha direto no canvas visível com o contexto transformado pelo
// devicePixelRatio — traço vetorial nítido em monitores high-DPI (desenhar em
// um canvas intermediário de resolução CSS e copiar deixaria o gráfico borrado).
function renderScreenChart() {
  const canvas = qs("coordenograma");
  const container = canvas.parentElement;
  const cssWidth = Math.max(480, container.clientWidth - 16);
  const cssHeight = Math.round(cssWidth * 0.74);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawChart(ctx, cssWidth, cssHeight, chartMode);
}

// PDF: canvas offscreen real em alta resolução, exportado como PNG.
// Proporção 10:7 (1600×1120) rotacionada 90° via CSS na página RETRATO:
// o desenho ocupa ~112×160mm impressos (~363dpi), com título e rodapé
// repetido preservados na página.
function chartImage(mode, title) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1120;
  drawChart(canvas.getContext("2d"), canvas.width, canvas.height, mode, { title });
  return canvas.toDataURL("image/png");
}

// ── PDF (window.print + @media print) ──────────────────────────────────────

function tableHtml(rows) {
  return `<table><tbody>${rows.map(([label, value]) =>
    `<tr><th>${label}</th><td>${value || "—"}</td></tr>`).join("")}</tbody></table>`;
}

function buildPrintReport(selectivity, logoSrc) {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Campo_Grande" });
  const c = calc;
  const report = qs("printReport");

  // Instantâneo da retaguarda: "BLOQ" quando a função 50 está bloqueada
  const fmtInst = (val, bloq) => (bloq ? "BLOQ" : (val > 0 ? `${fmt(val, 0)} A` : "—"));

  report.innerHTML = `
    <table class="print-layout">
    <tbody><tr><td>
    <div class="print-head">
      <img src="${logoSrc || "../../assets/logo.png"}" alt="Schimanski Engenharia" />
      <div>
        <h1>Estudo de Seletividade — Coordenação de Proteção</h1>
        <p><strong>${txt("projNome") || "Empreendimento não informado"}</strong></p>
        <p>Cliente: ${txt("projCliente") || "—"}${txt("projCnpj") ? ` · CNPJ: ${txt("projCnpj")}` : ""}</p>
        <p>Endereço: ${txt("projEndereco") || "—"}</p>
        ${(() => {
          const engNome  = txt("projEngenheiro") || "—";
          const engCrea  = txt("projCrea")       || "—";
          const execNome = txt("projExecutor")   || "—";
          const execCrea = txt("projCreaExec")   || "—";

          // Campos vazios contam como pessoas distintas (duas linhas com "—")
          const mesmaPessoa =
            txt("projEngenheiro") !== "" &&
            txt("projExecutor") !== "" &&
            engNome.toLowerCase() === execNome.toLowerCase();

          if (mesmaPessoa) {
            return `
              <p><span class="print-head-role">Engenheiro Responsável</span></p>
              <p>
                Projeto &amp; Execução:
                <strong>${engNome}</strong>
                &nbsp;&nbsp;·&nbsp;&nbsp;
                ${engCrea}
              </p>`;
          }
          return `
            <p><span class="print-head-role">Engenheiros Responsáveis</span></p>
            <p>
              Projetista:
              <strong>${engNome}</strong>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              ${engCrea}
              &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
              Executor:
              <strong>${execNome}</strong>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              ${execCrea}
            </p>`;
        })()}
        <p>Data: ${now}</p>
      </div>
    </div>

    <div class="memorial">
      <h2>Finalidade</h2>
      <p>O presente Estudo tem a finalidade de definir os requisitos mínimos necessários para a coordenação das proteções de sobrecorrente em tensão primária da subestação <strong>${txt("projNome") || "—"}</strong>, pertencente a <strong>${txt("projCliente") || "—"}</strong>, localizada em ${txt("projEndereco") || "—"}, dentro da área de concessão da distribuidora de energia elétrica local.</p>

      <h2>Dados do Sistema e Fornecimento</h2>
      <p>Conforme informações constantes no NCC (Nível de Curto-Circuito) fornecido pela concessionária, referência <strong>${txt("nccPe") || "—"}</strong>, o ponto de fornecimento está conectado à Subestação <strong>${txt("nccSe") || "—"}</strong>, Circuito <strong>${txt("nccCircuito") || "—"}</strong>, Montante <strong>${txt("nccMontante") || "—"}</strong>, Fabricante <strong>${txt("nccFabricante") || "—"}</strong>, com tensão nominal de <strong>${fmt(c.Vn)} kV</strong>. As correntes de curto-circuito no ponto de entrega são: trifásica máxima de <strong>${fmt(c.icc3f, 0)} A</strong> e fase-terra de <strong>${fmt(c.iccFt, 0)} A</strong>.</p>

      <h2>Dados da Instalação</h2>
      <p>A instalação é composta por transformador de <strong>${fmt(c.kva, 0)} kVA</strong>, tipo <strong>${qs("instIsolacao").selectedOptions[0].textContent}</strong>, com demanda prevista de <strong>${fmt(c.kw, 0)} kW</strong> e fator de potência de <strong>${fmt(c.fp, 2)}</strong>. A corrente nominal do transformador calculada é de <strong>${fmt(c.In)} A</strong> e a corrente de demanda prevista é de <strong>${fmt(c.InDem)} A</strong>. A corrente transitória de magnetização (INRUSH) de fase foi calculada em <strong>${fmt(c.inrushFase)} A @ 0,1 s</strong> (fator ×${c.inrushFactor}), e a de neutro em <strong>${fmt(c.inrushNeutro)} A @ 0,1 s</strong>. ${c.ansi.fase.i ? `O ponto ANSI do transformador corresponde a <strong>${fmt(c.ansi.fase.i, 0)} A @ ${fmt(c.ansi.fase.t)} s</strong>, conforme NBR 5356-11.` : ""}</p>

      <h2>Critério de Ajuste das Proteções — Funções 50/51 Fase e Neutro</h2>
      <p>Os valores de ajuste apresentados a seguir são expressos em duas bases: <strong>valores secundários</strong>, que correspondem às grandezas aplicadas diretamente nas entradas do relé de proteção <strong>${txt("releFabricante") || "—"} ${txt("releModelo") || "—"}</strong>, e <strong>valores primários</strong>, que representam as correntes reais no sistema de média tensão, obtidos pela multiplicação pelo RTC (Relação de Transformação de Corrente = <strong>${fmt(c.rtc, 0)}</strong>) do TC instalado (${fmt(num("tcPrim"), 0)}/${fmt(num("tcSec"), 0)} A · classe ${txt("tcClasse") || "—"}). O relé atua com base nos valores secundários, enquanto os valores primários servem de referência para verificação e coordenação no coordenograma.</p>
      <p><strong>Função 51F — Temporizado de Fase:</strong> corrente de partida calculada aplicando fator de 125% sobre a corrente de demanda, refletida ao secundário do TC (RTC = ${fmt(c.rtc, 0)}), resultando em <strong>${fmt(c.aj51F)} A secundário / ${fmt(c.prim51F)} A primário</strong>. Curva adotada: IEC <strong>${c.curvaFase}</strong>, dial calculado <strong>${fmt(c.dialFase, 4)}</strong>, garantindo tempo máximo de atuação de 0,2 s para relação I/Ip = 20.</p>
      <p><strong>Função 51N — Temporizado de Neutro:</strong> corrente de partida equivalente a 1/3 da corrente de fase, resultando em <strong>${fmt(c.aj51N)} A secundário / ${fmt(c.prim51N)} A primário</strong>. Curva adotada: IEC <strong>${c.curvaNeutro}</strong>, dial calculado <strong>${fmt(c.dialNeutro, 4)}</strong>.</p>
      <p><strong>Função 50F — Instantâneo de Fase:</strong> corrente de partida definida em 110% da corrente de INRUSH de demanda, resultando em <strong>${fmt(c.aj50F)} A secundário / ${fmt(c.prim50F)} A primário</strong>, com atuação instantânea, evitando operação indevida do relé durante a energização do transformador.</p>
      <p><strong>Função 50N — Instantâneo de Neutro:</strong> corrente de partida equivalente a 1/3 da corrente instantânea de fase, resultando em <strong>${fmt(c.aj50N)} A secundário / ${fmt(c.prim50N)} A primário</strong>, com atuação instantânea.</p>
      <p>Os ajustes foram definidos atendendo ao intervalo de coordenação mínimo de <strong>0,3 s</strong> em relação à proteção de retaguarda da concessionária: Fase Ip = ${fmt(c.ret.fase.ip, 0)} A · Dial ${fmt(c.ret.fase.dial, 2)} · Curva ${c.ret.fase.curva} · Inst. ${fmtInst(c.ret.fase.inst, c.ret.fase.instBloq)} — Neutro Ip = ${fmt(c.ret.neutro.ip, 0)} A · Dial ${fmt(c.ret.neutro.dial, 2)} · Curva ${c.ret.neutro.curva} · Inst. ${fmtInst(c.ret.neutro.inst, c.ret.neutro.instBloq)}, conforme recomendação da distribuidora.</p>
    </div>

    <h2>1. Informações do NCC (Energisa)</h2>
    ${tableHtml([
      ["SE / Circuito", `${txt("nccSe") || "—"} / ${txt("nccCircuito") || "—"}`],
      ["Montante / Fabricante", `${txt("nccMontante") || "—"} / ${txt("nccFabricante") || "—"}`],
      ["PE de referência", txt("nccPe")],
      ["Tensão nominal", `${fmt(c.Vn)} kV`],
      ["Z1 (pu)", `${fmt(num("nccZ1Re"), 4)} + j${fmt(num("nccZ1Im"), 4)}`],
      ["Z0 (pu)", `${fmt(num("nccZ0Re"), 4)} + j${fmt(num("nccZ0Im"), 4)}`],
      ["Icc trifásico", `${fmt(c.icc3f, 0)} A ∠ ${fmt(num("nccIcc3fAng"), 1)}°`],
      ["Icc fase-terra", `${fmt(c.iccFt, 0)} A ∠ ${fmt(num("nccIccFtAng"), 1)}°`],
      ["Retaguarda Fase", `Ip ${fmt(c.ret.fase.ip, 1)} A · Dial ${fmt(c.ret.fase.dial, 2)} · Curva ${c.ret.fase.curva} · Inst. ${fmtInst(c.ret.fase.inst, c.ret.fase.instBloq)}`],
      ["Retaguarda Neutro", `Ip ${fmt(c.ret.neutro.ip, 1)} A · Dial ${fmt(c.ret.neutro.dial, 2)} · Curva ${c.ret.neutro.curva} · Inst. ${fmtInst(c.ret.neutro.inst, c.ret.neutro.instBloq)}`],
    ])}

    <h2>2. Dados da instalação</h2>
    ${tableHtml([
      ["Potência do transformador", `${fmt(c.kva, 1)} kVA`],
      ["Demanda prevista", `${fmt(c.kw, 1)} kW`],
      ["Fator de potência", fmt(c.fp, 2)],
      ["Tipo de isolação", `${qs("instIsolacao").selectedOptions[0]?.textContent || "—"}`],
      ["RTC", fmt(c.rtc, 1)],
      ["Curvas IEC (fase / neutro)", `${c.curvaFase} / ${c.curvaNeutro}`],
    ])}

    <h2>3. Correntes calculadas</h2>
    ${tableHtml([
      ["In — nominal do transformador", `${fmt(c.In)} A`],
      ["In.dem — corrente de demanda", `${fmt(c.InDem)} A`],
      [`INRUSH fase (×${c.inrushFactor}) @ 0,1 s`, `${fmt(c.inrushFase)} A`],
      ["INRUSH neutro @ 0,1 s", `${fmt(c.inrushNeutro)} A`],
      ["Ponto ANSI fase", c.ansi.fase.i ? `${fmt(c.ansi.fase.i, 0)} A @ ${fmt(c.ansi.fase.t)} s` : "—"],
      ["Ponto ANSI neutro", c.ansi.neutro.i ? `${fmt(c.ansi.neutro.i, 0)} A @ ${fmt(c.ansi.neutro.t)} s` : "—"],
    ])}

    <h2>4. Ajustes do relé (50/51)</h2>
    <table>
      <thead><tr><th>Função</th><th>Curva</th><th>Dial (DT)</th><th>Secundário (A)</th><th>Primário (A)</th></tr></thead>
      <tbody>
        <tr><td>51F</td><td>${c.curvaFase}</td><td>${fmt(c.dialFase, 4)}</td><td>${fmt(c.aj51F)}</td><td>${fmt(c.prim51F)}</td></tr>
        <tr><td>51N</td><td>${c.curvaNeutro}</td><td>${fmt(c.dialNeutro, 4)}</td><td>${fmt(c.aj51N)}</td><td>${fmt(c.prim51N)}</td></tr>
        <tr><td>50F</td><td>—</td><td>—</td><td>${fmt(c.aj50F)}</td><td>${fmt(c.prim50F)}</td></tr>
        <tr><td>50N</td><td>—</td><td>—</td><td>${fmt(c.aj50N)}</td><td>${fmt(c.prim50N)}</td></tr>
      </tbody>
    </table>
    <p>Verificação de seletividade:
      <span class="print-badge ${selectivity.ok ? "ok" : "nok"}">${selectivity.ok ? "SELETIVIDADE OK" : "SELETIVIDADE NOK"}</span>
      — Fase: ${selectivity.fase.ok ? "OK" : "NOK"} · Neutro: ${selectivity.neutro.ok ? "OK" : "NOK"}
    </p>

    <h2>5. Equipamentos</h2>
    ${tableHtml([
      ["TC", `${fmt(num("tcPrim"), 0)}/${fmt(num("tcSec"), 0)} A · classe ${txt("tcClasse") || "—"}`],
      ["TP", `${fmt(num("tpPrim"), 0)}/${fmt(num("tpSec"), 0)} V · classe ${txt("tpClasse") || "—"}`],
      ["Disjuntor", `${txt("djTipo") || "—"} · In ${fmt(num("djIn"), 0)} A · Vn ${fmt(num("djVn"), 1)} kV · ${fmt(num("djIcc"), 1)} kA`],
      ["Relé", `${txt("releFabricante") || "—"} ${txt("releModelo")}`],
      ["Nobreak", txt("nbMarca") ? `${txt("nbMarca")} ${txt("nbModelo")} · ${fmt(num("nbPotencia"), 0)} VA` : "—"],
    ])}

    <div class="page-break print-chart">
      <h2>6. Coordenograma — Fase</h2>
      <img src="${chartImage("fase", "Coordenograma — Fase")}" alt="Coordenograma fase" />
    </div>
    <div class="page-break print-chart">
      <h2>7. Coordenograma — Neutro</h2>
      <img src="${chartImage("neutro", "Coordenograma — Neutro")}" alt="Coordenograma neutro" />
    </div>
    <div class="page-break print-chart">
      <h2>8. Coordenograma — Fase + Neutro</h2>
      <img src="${chartImage("ambos", "Coordenograma — Fase + Neutro")}" alt="Coordenograma fase e neutro" />
    </div>

    <div class="print-assinaturas-pagina">
    <h2>9. Assinaturas</h2>
    ${(() => {
      const engNome  = txt("projEngenheiro");
      const engCrea  = txt("projCrea");
      const execNome = txt("projExecutor");
      const execCrea = txt("projCreaExec");
      const clienteNome = txt("projClienteAssinatura") || txt("projCliente") || "";
      const clienteCnpj = txt("projCnpj") || "";

      // Campos vazios contam como pessoas distintas (txt() já aplica trim)
      const mesmaPessoa =
        engNome !== "" &&
        engNome.toLowerCase() === execNome.toLowerCase();

      const sigBlock = (titulo, nome, complemento) => `
        <div class="sig-block">
          <div class="sig-line"></div>
          <p class="sig-titulo">${titulo}</p>
          <p class="sig-nome">${nome || "—"}</p>
          ${complemento ? `<p class="sig-complemento">${complemento}</p>` : ""}
        </div>`;

      if (mesmaPessoa) {
        // Mesmo profissional: Responsável Técnico + Cliente
        return `
          <div class="print-signatures cols-2">
            ${sigBlock("Responsável Técnico", engNome, engCrea ? `CREA: ${engCrea}` : "")}
            ${sigBlock("Cliente", clienteNome, clienteCnpj ? `CNPJ: ${clienteCnpj}` : "")}
          </div>`;
      }
      // Profissionais diferentes: Projeto + Execução + Cliente
      return `
        <div class="print-signatures cols-3">
          ${sigBlock("Responsável pelo Projeto", engNome, engCrea ? `CREA: ${engCrea}` : "")}
          ${sigBlock("Responsável pela Execução", execNome, execCrea ? `CREA: ${execCrea}` : "")}
          ${sigBlock("Cliente", clienteNome, clienteCnpj ? `CNPJ: ${clienteCnpj}` : "")}
        </div>`;
    })()}
    </div>
    </td></tr></tbody>
    <tfoot><tr><td>
      <div class="print-footer-empresa">
        <p>Schimanski Engenharia e Soluções LTDA</p>
        <p>CNPJ: 44.930.777/0001-20</p>
        <p>schimanskiengenharia@outlook.com.br</p>
      </div>
    </td></tr></tfoot>
    </table>
  `;
  report.hidden = false;
}

// Aguarda todas as imagens do relatório serem decodificadas antes do print.
// Sem isso, os PNGs dos coordenogramas (data URLs grandes inseridos no DOM um
// instante antes do window.print) ainda não estão prontos quando o navegador
// tira o snapshot de impressão — e saem em branco no PDF.
async function waitForImages(rootEl) {
  const images = [...rootEl.querySelectorAll("img")];
  await Promise.all(images.map(async (img) => {
    try {
      if (img.decode) await img.decode();
      else if (!img.complete) await new Promise((resolve) => { img.onload = img.onerror = resolve; });
    } catch { /* imagem indisponível: imprime sem ela */ }
  }));
}

async function generatePdf() {
  if (!calc) {
    if (!runCalculation()) return;
  }
  const selectivity = renderBadge();
  // Logo em base64: garante a imagem renderizada no PDF sem corrida de rede.
  const logoSrc = await loadLogoBase64();
  buildPrintReport(selectivity, logoSrc);
  await waitForImages(qs("printReport"));
  const previousTitle = document.title;
  document.title = `Seletividade - ${txt("projNome") || "ObraSync"}`;
  window.print();
  document.title = previousTitle;
}

// ── Fluxo principal ─────────────────────────────────────────────────────────

function runCalculation() {
  const result = computeStudy();
  if (!result) return false;
  calc = result;
  renderResults();
  renderBadge();
  renderScreenChart();
  saveDraft();
  return true;
}

// Clique no botão Calcular: estado de loading visível antes do cálculo.
// Wrapper separado para runCalculation() continuar síncrona — generatePdf()
// e a primeira renderização dependem do retorno imediato dela.
function runCalculationWithFeedback() {
  const btn = qs("btnCalcular");
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Calculando…";
  btn.style.opacity = "0.75";
  // Micro delay para o browser renderizar o estado de loading
  setTimeout(() => {
    try {
      runCalculation();
    } finally {
      btn.disabled = false;
      btn.textContent = "Calcular";
      btn.style.opacity = "";
    }
  }, 30);
}

function clearAll() {
  if (!confirm("Limpar todos os dados informados?")) return;
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* sem armazenamento */ }
  location.reload();
}

async function init() {
  const user = await checkObraSyncSession();
  if (!user) return; // redirecionado para o login
  applyUserTheme(user.id);

  qs("userBadge").textContent = `${user.name} — ${ROLE_LABELS[user.role] || user.role}`;
  document.body.classList.remove("checking");
  qs("app").classList.remove("hidden");

  // Pré-carrega a logo em paralelo: o primeiro PDF já sai com a imagem pronta.
  loadLogoBase64();

  restoreDraft();

  // Botões BLOQ — alternam o campo entre "BLOQ" e vazio
  document.querySelectorAll(".btn-bloq").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = qs(btn.dataset.target);
      if (!input) return;
      const isBloq = input.value.trim().toUpperCase() === "BLOQ";
      input.value = isBloq ? "" : "BLOQ";
      input.classList.toggle("is-bloq", !isBloq);
      saveDraft();
      if (calc) runCalculation(); // recalcula e replota se já houve cálculo
    });
  });

  // Classe visual .is-bloq: reaplicada após o restoreDraft e ao digitar
  ["retFaseInst", "retNeutroInst"].forEach((id) => {
    const el = qs(id);
    if (!el) return;
    const syncBloqClass = () => el.classList.toggle("is-bloq", el.value.trim().toUpperCase() === "BLOQ");
    syncBloqClass();
    el.addEventListener("input", syncBloqClass);
  });

  qs("btnCalcular").addEventListener("click", runCalculationWithFeedback);
  qs("btnLimpar").addEventListener("click", clearAll);
  qs("btnPdf").addEventListener("click", generatePdf);
  window.addEventListener("afterprint", () => { qs("printReport").hidden = true; });

  document.querySelectorAll(".mode-btn").forEach((button) => {
    button.addEventListener("click", () => {
      chartMode = button.dataset.mode;
      document.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b === button));
      renderScreenChart();
    });
  });

  document.querySelectorAll(".panel-left input, .panel-left select").forEach((el) => {
    el.addEventListener("change", saveDraft);
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderScreenChart, 150);
  });

  // Sombra dinâmica no topbar ao rolar
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    window.addEventListener("scroll", () => {
      topbar.style.boxShadow = window.scrollY > 8
        ? "0 4px 24px rgba(0,0,0,0.13)"
        : "4px 0 24px rgba(0,0,0,0.08)";
    }, { passive: true });
  }

  // Primeira renderização com os valores padrão/rascunho.
  runCalculation();
}

init();
