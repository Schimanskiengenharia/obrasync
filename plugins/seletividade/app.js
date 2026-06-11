// ─────────────────────────────────────────────────────────────────────────────
// Estudo de Seletividade — plugin do ObraSync (Schimanski Engenharia)
// HTML + CSS + JS puro, canvas próprio (sem CDN). Sessão validada na API do
// ObraSync via token Bearer compartilhado pelo localStorage (mesma origem).
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
    // Token nos headers e na query (?token=): cobre servidores Apache/PHP-CGI
    // que removem o header Authorization.
    const res = await fetch(`${API_BASE}/check-session?token=${encodeURIComponent(session.token)}`, {
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
      fase: { ip: num("retFaseIp"), dial: num("retFaseDial"), curva: txt("retFaseCurva") || "NI", inst: num("retFaseInst") },
      neutro: { ip: num("retNeutroIp"), dial: num("retNeutroDial"), curva: txt("retNeutroCurva") || "NI", inst: num("retNeutroInst") },
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
  if (inst > 0 && I >= inst) t = Math.min(t, 0.1);
  return t;
}

// Tempo de atuação da retaguarda Energisa em corrente primária.
function tripTimeRetaguarda(I, fase) {
  const ret = fase ? calc.ret.fase : calc.ret.neutro;
  let t = calcTime(I, ret.ip, ret.dial, ret.curva);
  if (ret.inst > 0 && I >= ret.inst) t = Math.min(t, 0.1);
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
  qs("resultados").classList.remove("hidden");
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

function drawChart(canvas, mode, options = {}) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const pad = { left: 78, right: 24, top: options.title ? 56 : 28, bottom: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const x = (I) => pad.left + ((Math.log10(I) - Math.log10(CHART.iMin)) / (Math.log10(CHART.iMax) - Math.log10(CHART.iMin))) * plotW;
  const y = (t) => pad.top + (1 - (Math.log10(t) - Math.log10(CHART.tMin)) / (Math.log10(CHART.tMax) - Math.log10(CHART.tMin))) * plotH;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Título (versões para PDF)
  if (options.title) {
    ctx.fillStyle = "#134e4a";
    ctx.font = "bold 22px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(options.title, W / 2, 30);
  }

  // ── Grade log-log ──
  const decadeLabel = (v) => (v >= 1000 ? `${nf.format(v / 1000)}k` : nf.format(v));
  ctx.lineWidth = 1;
  for (let e = 0; e <= 5; e++) {
    const base = Math.pow(10, e);
    // menores (2..9)
    if (e < 5) {
      for (let m = 2; m <= 9; m++) {
        const xi = x(base * m);
        ctx.strokeStyle = COLORS.gridMinor;
        ctx.beginPath(); ctx.moveTo(xi, pad.top); ctx.lineTo(xi, pad.top + plotH); ctx.stroke();
      }
    }
    const xi = x(base);
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath(); ctx.moveTo(xi, pad.top); ctx.lineTo(xi, pad.top + plotH); ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(decadeLabel(base), xi, pad.top + plotH + 18);
  }
  for (let e = -2; e <= 3; e++) {
    const base = Math.pow(10, e);
    if (e < 3) {
      for (let m = 2; m <= 9; m++) {
        const yi = y(base * m);
        ctx.strokeStyle = COLORS.gridMinor;
        ctx.beginPath(); ctx.moveTo(pad.left, yi); ctx.lineTo(pad.left + plotW, yi); ctx.stroke();
      }
    }
    const yi = y(base);
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath(); ctx.moveTo(pad.left, yi); ctx.lineTo(pad.left + plotW, yi); ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "right";
    ctx.fillText(base.toLocaleString("pt-BR"), pad.left - 8, yi + 4);
  }

  // Moldura + títulos dos eixos
  ctx.strokeStyle = "#9ca3af";
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 13px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Corrente (A) — primário", pad.left + plotW / 2, H - 14);
  ctx.save();
  ctx.translate(20, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Tempo (s)", 0, 0);
  ctx.restore();

  if (!calc) return;

  const clip = () => { ctx.save(); ctx.beginPath(); ctx.rect(pad.left, pad.top, plotW, plotH); ctx.clip(); };

  // Curva 51 (instalação ou retaguarda) em corrente primária.
  const plotCurve = (Ip, dial, curve, instLevel, color, dashed) => {
    if (!(Ip > 0) || !(dial > 0)) return;
    clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(dashed ? [9, 6] : []);
    ctx.beginPath();
    let started = false;
    const steps = 400;
    const logStart = Math.log10(Ip * 1.02);
    const logEnd = Math.log10(CHART.iMax);
    for (let i = 0; i <= steps; i++) {
      const I = Math.pow(10, logStart + (i / steps) * (logEnd - logStart));
      let t = calcTime(I, Ip, dial, curve);
      if (instLevel > 0 && I >= instLevel) t = Math.min(t, 0.1);
      if (!Number.isFinite(t)) continue;
      const tc = Math.min(Math.max(t, CHART.tMin), CHART.tMax);
      if (!started) { ctx.moveTo(x(I), y(tc)); started = true; }
      else ctx.lineTo(x(I), y(tc));
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
    ctx.lineWidth = 1.6;
    ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x(I), pad.top); ctx.lineTo(x(I), pad.top + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (label) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = "11px Inter, Arial, sans-serif";
      ctx.translate(x(I) - 4, pad.top + 8);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = "left";
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  };

  const point = (I, t, color, shape, label) => {
    if (!(I > 0) || !(t > 0)) return;
    const px = x(Math.min(Math.max(I, CHART.iMin), CHART.iMax));
    const py = y(Math.min(Math.max(t, CHART.tMin), CHART.tMax));
    ctx.fillStyle = color;
    if (shape === "tri") {
      ctx.beginPath();
      ctx.moveTo(px - 6, py - 6); ctx.lineTo(px + 7, py); ctx.lineTo(px - 6, py + 6);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = "11px Inter, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, px + 9, py - 6);
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
    point(calc.inrushFase, 0.1, COLORS.inrush, "dot", "INRUSH F");
    point(calc.ansi.fase.i, calc.ansi.fase.t, COLORS.ansi, "tri", "ANSI F");
  }
  if (showNeutro) {
    point(calc.inrushNeutro, 0.1, COLORS.inrush, "dot", "INRUSH N");
    point(calc.ansi.neutro.i, calc.ansi.neutro.t, COLORS.ansi, "tri", "ANSI N");
  }

  // ── Legenda (canto superior direito) ──
  const legend = [];
  if (showFase) {
    legend.push({ color: COLORS.inst, dash: [], label: `51F instalação (${calc.curvaFase})` });
    legend.push({ color: COLORS.ret, dash: [], label: `51F retaguarda (${calc.ret.fase.curva})` });
    legend.push({ color: COLORS.inst, dash: [2, 4], label: "50F instantâneo" });
  }
  if (showNeutro) {
    legend.push({ color: COLORS.inst, dash: [9, 6], label: `51N instalação (${calc.curvaNeutro})` });
    legend.push({ color: COLORS.ret, dash: [9, 6], label: `51N retaguarda (${calc.ret.neutro.curva})` });
    legend.push({ color: COLORS.inst, dash: [2, 4], label: "50N instantâneo" });
  }
  legend.push({ color: COLORS.icc, dash: [8, 5], label: "Icc (máx/mín)" });
  legend.push({ color: COLORS.inrush, dot: true, label: "INRUSH @ 0,1 s" });
  legend.push({ color: COLORS.ansi, tri: true, label: "Ponto ANSI" });

  const lw = 235;
  const lh = legend.length * 19 + 14;
  const lx = pad.left + plotW - lw - 10;
  const ly = pad.top + 10;
  ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
  ctx.strokeStyle = "#d1d5db";
  ctx.fillRect(lx, ly, lw, lh);
  ctx.strokeRect(lx, ly, lw, lh);
  legend.forEach((item, index) => {
    const iy = ly + 16 + index * 19;
    if (item.dot) {
      ctx.fillStyle = item.color;
      ctx.beginPath(); ctx.arc(lx + 22, iy - 3, 5, 0, Math.PI * 2); ctx.fill();
    } else if (item.tri) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(lx + 16, iy - 8); ctx.lineTo(lx + 28, iy - 3); ctx.lineTo(lx + 16, iy + 2);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2.4;
      ctx.setLineDash(item.dash);
      ctx.beginPath(); ctx.moveTo(lx + 10, iy - 3); ctx.lineTo(lx + 34, iy - 3); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = COLORS.text;
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(item.label, lx + 42, iy);
  });
}

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
  // drawChart usa canvas.width/height lógicos: desenha em coordenadas CSS.
  const logical = { width: cssWidth, height: cssHeight, getContext: () => ctx };
  drawChart(logical, chartMode);
}

// ── PDF (window.print + @media print) ──────────────────────────────────────

function chartImage(mode, title) {
  const canvas = document.createElement("canvas");
  canvas.width = 1500;
  canvas.height = 1080;
  drawChart(canvas, mode, { title });
  return canvas.toDataURL("image/png");
}

function tableHtml(rows) {
  return `<table><tbody>${rows.map(([label, value]) =>
    `<tr><th>${label}</th><td>${value || "—"}</td></tr>`).join("")}</tbody></table>`;
}

function buildPrintReport(selectivity) {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Campo_Grande" });
  const c = calc;
  const report = qs("printReport");
  report.innerHTML = `
    <div class="print-head">
      <img src="../../assets/logo.png" alt="" />
      <div>
        <h1>Estudo de Seletividade</h1>
        <p><strong>${txt("projNome") || "Empreendimento não informado"}</strong></p>
        <p>Cliente: ${txt("projCliente") || "—"} ${txt("projCnpj") ? `· CNPJ: ${txt("projCnpj")}` : ""}</p>
        <p>Endereço: ${txt("projEndereco") || "—"}</p>
        <p>Engenheiro responsável: ${txt("projEngenheiro") || "—"} ${txt("projCrea") ? `· ${txt("projCrea")}` : ""} · Data: ${now}</p>
      </div>
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
      ["Retaguarda Fase", `Ip ${fmt(c.ret.fase.ip, 1)} A · Dial ${fmt(c.ret.fase.dial, 2)} · Curva ${c.ret.fase.curva} · Inst. ${fmt(c.ret.fase.inst, 0)} A`],
      ["Retaguarda Neutro", `Ip ${fmt(c.ret.neutro.ip, 1)} A · Dial ${fmt(c.ret.neutro.dial, 2)} · Curva ${c.ret.neutro.curva} · Inst. ${fmt(c.ret.neutro.inst, 0)} A`],
    ])}

    <h2>2. Dados da instalação</h2>
    ${tableHtml([
      ["Potência do transformador", `${fmt(c.kva, 1)} kVA`],
      ["Demanda prevista", `${fmt(c.kw, 1)} kW`],
      ["Fator de potência", fmt(c.fp, 2)],
      ["Tipo de isolação", `${qs("instIsolacao").selectedOptions[0].textContent}`],
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

    <div class="print-signatures">
      <div>${txt("projEngenheiro") || "Engenheiro responsável"}<br />${txt("projCrea") || "CREA"}</div>
      <div>${txt("projExecutor") || "Responsável pela execução"}<br />${txt("projCreaExec") || "CREA"}</div>
    </div>
  `;
  report.hidden = false;
}

function generatePdf() {
  if (!calc) {
    if (!runCalculation()) return;
  }
  const selectivity = renderBadge();
  buildPrintReport(selectivity);
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

  restoreDraft();

  qs("btnCalcular").addEventListener("click", runCalculation);
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

  // Primeira renderização com os valores padrão/rascunho.
  runCalculation();
}

init();
