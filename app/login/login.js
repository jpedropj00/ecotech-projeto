// ═══════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════
const USUARIOS = { 
    admin: "ecotech" 
};
let usuarioLogado = null;
let API = "http://localhost:5000";
let dadosGlobais = [];
let plantas = [];
let plantaAtiva = null;
let intervaloMS = 10000;
let timerBusca = null;
let paginaAtual = "overview";

// ═══════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════
document.getElementById("loginPass").addEventListener("keydown", e => { if (e.key === "Enter") fazerLogin(); });
document.getElementById("loginUser").addEventListener("keydown", e => { if (e.key === "Enter") fazerLogin(); });

function fazerLogin() {
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value;
    const err = document.getElementById("loginErr");
    if (!USUARIOS[user] || USUARIOS[user] !== pass) {
        err.textContent = "Usuário ou senha incorretos.";
        document.getElementById("loginPass").value = "";
        return;
    }
    usuarioLogado = user;
    err.textContent = "";
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appShell").classList.add("visible");
    document.getElementById("userName").textContent = user;
    document.getElementById("userAvatar").textContent = user.slice(0, 2).toUpperCase();
    document.getElementById("cfgUserName").textContent = user;
    carregarPlantas();
    renderPlantGrid();
    atualizarBadge();
    iniciarBusca();
}

function logout() {
    clearInterval(timerBusca);
    usuarioLogado = null;
    document.getElementById("appShell").classList.remove("visible");
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("loginUser").value = "";
    document.getElementById("loginPass").value = "";
}

// ═══════════════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════════════
const titulos = {
    overview: ["Visão Geral", "Resumo do sistema"],
    dashboard: ["Dashboard", "Leituras e gráficos"],
    monitor: ["Monitor", "Umidade em tempo real por planta"],
    plantas: ["Plantas", "Gerenciamento de espécies"],
    config: ["Configurações", "Parâmetros do sistema"],
};

function irPara(pagina, el) {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    if (el) el.classList.add("active");
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById("page-" + pagina).classList.add("active");
    const [titulo, sub] = titulos[pagina] || ["EcoTech", ""];
    document.getElementById("topbarTitle").textContent = titulo;
    document.getElementById("topbarSub").textContent = sub;
    paginaAtual = pagina;
    if (window.innerWidth <= 640) document.getElementById("sidebar").classList.remove("open");

    // re-renderiza gráficos ao trocar de aba
    if (dadosGlobais.length) {
        if (pagina === "overview") renderGrafico(dadosGlobais, "graficoOv");
        if (pagina === "dashboard") renderGrafico(dadosGlobais, "graficoDash");
        if (pagina === "plantas") renderGrafico(dadosGlobais, "graficoPlanta", true);
        if (pagina === "monitor") { renderMonitor(dadosGlobais); }
    }
    if (pagina === "monitor") renderMonPlantGrid();
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

// ═══════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════
function conectar() {
    API = document.getElementById("apiUrl").value.trim().replace(/\/$/, "");
    document.getElementById("cfgApi").value = API;
    buscar();
}

function iniciarBusca() {
    buscar();
    clearInterval(timerBusca);
    timerBusca = setInterval(buscar, intervaloMS);
}

async function buscar() {
    const dot = document.getElementById("statusDot");
    const txt = document.getElementById("statusText");
    const bar = document.getElementById("statusBar");
    try {
        const res = await fetch(`${API}/dados`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        dadosGlobais = await res.json();

        dot.className = "status-dot ok";
        txt.textContent = `${dadosGlobais.length} registros`;
        bar.innerHTML = `<span class="ok">● Conectado — ${dadosGlobais.length} registros</span>`;

        const vals = dadosGlobais.map(d => parseFloat(d.umidade)).filter(v => !isNaN(v));
        const atual = vals.length ? vals[vals.length - 1] : undefined;

        atualizarOverview(vals, atual);
        renderBanner(atual);
        renderStats(dadosGlobais);
        renderTabela(dadosGlobais);
        document.getElementById("btnPdf").disabled = dadosGlobais.length === 0;

        if (paginaAtual === "overview") renderGrafico(dadosGlobais, "graficoOv");
        if (paginaAtual === "dashboard") renderGrafico(dadosGlobais, "graficoDash");
        if (paginaAtual === "plantas") renderGrafico(dadosGlobais, "graficoPlanta", true);
        if (paginaAtual === "monitor") renderMonitor(dadosGlobais);

    } catch {
        dot.className = "status-dot erro";
        txt.textContent = "Sem conexão";
        bar.innerHTML = `<span class="erro">● Sem conexão com a API (${API})</span>`;
        document.getElementById("btnPdf").disabled = true;
    }
}

// ═══════════════════════════════════════════════════════
// VISÃO GERAL
// ═══════════════════════════════════════════════════════
function atualizarOverview(vals, atual) {
    if (atual !== undefined) document.getElementById("ovAtual").innerHTML = atual.toFixed(1) + '<span class="ov-unit">%</span>';
    document.getElementById("ovTotal").textContent = dadosGlobais.length;
    document.getElementById("ovPlantas").textContent = plantas.length;
    if (plantaAtiva) {
        document.getElementById("ovPlantaAtiva").textContent = plantaAtiva.icone + " " + plantaAtiva.nome;
        document.getElementById("ovPlantaSub").textContent = plantaAtiva.especie;
    } else {
        document.getElementById("ovPlantaAtiva").textContent = "—";
        document.getElementById("ovPlantaSub").textContent = "Nenhuma selecionada";
    }
}

// ═══════════════════════════════════════════════════════
// STATS CARDS
// ═══════════════════════════════════════════════════════
function renderStats(dados) {
    if (!dados.length) return;
    const vals = dados.map(d => parseFloat(d.umidade)).filter(v => !isNaN(v));
    if (!vals.length) return;
    const atual = vals[vals.length - 1];
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const amp = max - min;
    const t5 = vals.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, vals.length);
    const t10 = vals.slice(-10, -5).length ? vals.slice(-10, -5).reduce((a, b) => a + b, 0) / vals.slice(-10, -5).length : t5;
    const tend = t5 > t10 + 1 ? "↑ Subindo" : t5 < t10 - 1 ? "↓ Caindo" : "→ Estável";

    let stPlanta = "";
    if (plantaAtiva) {
        if (atual < plantaAtiva.min) stPlanta = `<div style="font-size:.7rem;color:var(--orange);margin-top:6px">⚠ Abaixo do ideal</div>`;
        else if (atual > plantaAtiva.max) stPlanta = `<div style="font-size:.7rem;color:var(--accent2);margin-top:6px">💧 Acima do ideal</div>`;
        else stPlanta = `<div style="font-size:.7rem;color:var(--accent);margin-top:6px">✓ Faixa ideal</div>`;
    }

    document.getElementById("statsCards").innerHTML = `
    <div class="stat-card"><div class="label">Atual</div><div class="value c-green">${atual.toFixed(1)}<span class="unit">%</span></div><div class="sub">Última leitura${stPlanta}</div></div>
    <div class="stat-card"><div class="label">Média</div><div class="value c-blue">${media.toFixed(1)}<span class="unit">%</span></div><div class="sub">${vals.length} amostras</div></div>
    <div class="stat-card"><div class="label">Máxima</div><div class="value c-pink">${max.toFixed(1)}<span class="unit">%</span></div><div class="sub">Pico registrado</div></div>
    <div class="stat-card"><div class="label">Mínima</div><div class="value c-yellow">${min.toFixed(1)}<span class="unit">%</span></div><div class="sub">Menor registro</div></div>
    <div class="stat-card"><div class="label">Amplitude</div><div class="value c-orange">${amp.toFixed(1)}<span class="unit">%</span></div><div class="sub">Max − Min</div></div>
    <div class="stat-card"><div class="label">Tendência</div><div class="value" style="font-size:1.2rem;color:#e2eaf6;margin-top:4px">${tend}</div><div class="sub">Últimas leituras</div></div>
  `;
}

// ═══════════════════════════════════════════════════════
// GRÁFICO (reutilizável para 3 canvas)
// ═══════════════════════════════════════════════════════
function renderGrafico(dados, canvasId, comFaixaIdeal = false) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 600) * dpr;
    canvas.height = 180 * dpr;
    ctx.scale(dpr, dpr);
    const W = canvas.width / dpr, H = canvas.height / dpr;
    ctx.clearRect(0, 0, W, H);
    if (!dados.length) return;

    const slice = dados.slice(-60);
    const vals = slice.map(d => parseFloat(d.umidade)).filter(v => !isNaN(v));
    const labels = slice.map(d => d.data_hora.slice(11, 16));

    let vMin = Math.min(...vals) - 3, vMax = Math.max(...vals) + 3;
    if (comFaixaIdeal && plantaAtiva) {
        vMin = Math.min(vMin, plantaAtiva.min - 3);
        vMax = Math.max(vMax, plantaAtiva.max + 3);
    }

    const pad = { top: 14, right: 16, bottom: 30, left: 38 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
    const xOf = i => pad.left + (i / Math.max(1, slice.length - 1)) * cW;
    const yOf = v => pad.top + (1 - (v - vMin) / Math.max(1, vMax - vMin)) * cH;

    // grades
    ctx.strokeStyle = "#243050"; ctx.lineWidth = 0.7;
    for (let i = 0; i <= 4; i++) {
        const v = vMin + (vMax - vMin) * (i / 4), y = yOf(v);
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
        ctx.fillStyle = "#7a8fab"; ctx.font = "9px system-ui"; ctx.textAlign = "right";
        ctx.fillText(v.toFixed(0) + "%", pad.left - 4, y + 3);
    }

    // faixa ideal
    if (comFaixaIdeal && plantaAtiva) {
        ctx.fillStyle = "rgba(74,222,128,.08)";
        ctx.fillRect(pad.left, yOf(plantaAtiva.max), cW, yOf(plantaAtiva.min) - yOf(plantaAtiva.max));
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "rgba(74,222,128,.4)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, yOf(plantaAtiva.min)); ctx.lineTo(W - pad.right, yOf(plantaAtiva.min)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad.left, yOf(plantaAtiva.max)); ctx.lineTo(W - pad.right, yOf(plantaAtiva.max)); ctx.stroke();
        ctx.setLineDash([]);
    }

    // área
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    grad.addColorStop(0, "rgba(74,222,128,.35)");
    grad.addColorStop(1, "rgba(74,222,128,.02)");
    ctx.beginPath(); ctx.moveTo(xOf(0), yOf(vals[0]));
    for (let i = 1; i < vals.length; i++) ctx.lineTo(xOf(i), yOf(vals[i]));
    ctx.lineTo(xOf(vals.length - 1), pad.top + cH); ctx.lineTo(xOf(0), pad.top + cH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    // linha
    ctx.beginPath(); ctx.moveTo(xOf(0), yOf(vals[0]));
    for (let i = 1; i < vals.length; i++) ctx.lineTo(xOf(i), yOf(vals[i]));
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();

    // pontos + labels X
    const step = Math.max(1, Math.floor(slice.length / 8));
    for (let i = 0; i < vals.length; i++) {
        ctx.beginPath(); ctx.arc(xOf(i), yOf(vals[i]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#4ade80"; ctx.fill();
        if (i % step === 0 || i === vals.length - 1) {
            ctx.fillStyle = "#7a8fab"; ctx.font = "8px system-ui"; ctx.textAlign = "center";
            ctx.fillText(labels[i], xOf(i), H - pad.bottom + 12);
        }
    }

    // legenda planta
    const legEl = document.getElementById(canvasId === "graficoPlanta" ? "legendaPlanta" : "chartLegend");
    if (legEl) legEl.innerHTML = `<span><span class="legend-dot" style="background:#4ade80"></span>Umidade</span>`
        + (comFaixaIdeal && plantaAtiva ? `<span><span class="legend-dot" style="background:rgba(74,222,128,.4)"></span>Faixa ideal (${plantaAtiva.min}%–${plantaAtiva.max}%)</span>` : "");
}

// ═══════════════════════════════════════════════════════
// TABELA
// ═══════════════════════════════════════════════════════
function renderTabela(dados) {
    if (!dados.length) { document.getElementById("tabelaDiv").innerHTML = '<p class="empty">Sem dados</p>'; return; }
    const ultimas = [...dados].reverse().slice(0, 15);
    const vals = dados.map(d => parseFloat(d.umidade));
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    let html = `<table><thead><tr><th>#</th><th>Data / Hora</th><th>Umidade</th><th>Status</th></tr></thead><tbody>`;
    ultimas.forEach((r, i) => {
        const v = parseFloat(r.umidade);
        let badge, label;
        if (plantaAtiva) { if (v < plantaAtiva.min) { badge = "badge-baixo"; label = "Baixo"; } else if (v > plantaAtiva.max) { badge = "badge-alto"; label = "Alto"; } else { badge = "badge-med"; label = "Ideal"; } }
        else { if (v >= media + 5) { badge = "badge-alto"; label = "Alto"; } else if (v <= media - 5) { badge = "badge-baixo"; label = "Baixo"; } else { badge = "badge-med"; label = "Normal"; } }
        html += `<tr><td style="color:#7a8fab">${i + 1}</td><td>${r.data_hora}</td><td style="color:#4ade80;font-weight:600">${v}%</td><td><span class="badge ${badge}">${label}</span></td></tr>`;
    });
    html += "</tbody></table>";
    document.getElementById("tabelaDiv").innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// PLANTAS
// ═══════════════════════════════════════════════════════
function carregarPlantas() {
    try { plantas = JSON.parse(localStorage.getItem("ecotech_plantas") || "[]"); } catch { plantas = []; }
}
function salvarPlantasLS() { localStorage.setItem("ecotech_plantas", JSON.stringify(plantas)); }

function abrirModalPlanta() {
    ["mNome", "mEspecie"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("mIcone").value = "🌱";
    document.getElementById("mMin").value = "40";
    document.getElementById("mMax").value = "70";
    document.getElementById("modalPlanta").classList.add("open");
}
function fecharModalPlanta() { document.getElementById("modalPlanta").classList.remove("open"); }
document.getElementById("modalPlanta").addEventListener("click", e => { if (e.target === e.currentTarget) fecharModalPlanta(); });

function salvarPlanta() {
    const nome = document.getElementById("mNome").value.trim();
    const especie = document.getElementById("mEspecie").value.trim();
    const icone = document.getElementById("mIcone").value;
    const min = parseFloat(document.getElementById("mMin").value);
    const max = parseFloat(document.getElementById("mMax").value);
    if (!nome) { document.getElementById("mNome").focus(); return; }
    if (!especie) { document.getElementById("mEspecie").focus(); return; }
    if (isNaN(min) || isNaN(max) || min >= max) { alert("Umidade mínima deve ser menor que a máxima."); return; }
    const nova = { id: Date.now(), nome, especie, icone, min, max };
    plantas.push(nova);
    salvarPlantasLS();
    renderPlantGrid();
    atualizarBadge();
    renderMonPlantGrid();
    fecharModalPlanta();
    if (plantas.length === 1) selecionarPlanta(nova.id);
}

function deletarPlanta(id, e) {
    e.stopPropagation();
    if (!confirm("Remover esta planta?")) return;
    plantas = plantas.filter(p => p.id !== id);
    salvarPlantasLS();
    if (plantaAtiva?.id === id) { plantaAtiva = null; renderBanner(); }
    renderPlantGrid();
    renderMonPlantGrid();
    atualizarBadge();
}

function selecionarPlanta(id) {
    plantaAtiva = plantas.find(p => p.id === id) || null;
    renderPlantGrid();
    renderBanner(dadosGlobais.length ? parseFloat(dadosGlobais[dadosGlobais.length - 1].umidade) : undefined);
    if (dadosGlobais.length) {
        renderStats(dadosGlobais);
        renderGrafico(dadosGlobais, "graficoPlanta", true);
        renderGrafico(dadosGlobais, "graficoDash");
        renderTabela(dadosGlobais);
    }
    atualizarOverview(dadosGlobais.map(d => parseFloat(d.umidade)).filter(v => !isNaN(v)), dadosGlobais.length ? parseFloat(dadosGlobais[dadosGlobais.length - 1].umidade) : undefined);
}

function renderPlantGrid() {
    const grid = document.getElementById("plantGrid");
    if (!plantas.length) { grid.innerHTML = '<p class="no-plants">Nenhuma planta cadastrada. Clique em "+ Cadastrar planta".</p>'; return; }
    grid.innerHTML = plantas.map(p => `
    <div class="plant-chip ${plantaAtiva?.id === p.id ? 'active' : ''}" onclick="selecionarPlanta(${p.id})">
      <span style="font-size:1.3rem">${p.icone}</span>
      <span class="plant-chip-nome">${p.nome}</span>
      <span class="plant-chip-esp">${p.especie}</span>
      <span class="plant-chip-faixa">${p.min}% – ${p.max}%</span>
      <span class="plant-chip-del" onclick="deletarPlanta(${p.id},event)">✕ remover</span>
    </div>
  `).join("");
}

function renderBanner(umidadeAtual) {
    const banner = document.getElementById("plantaBanner");
    if (!plantaAtiva) {
        banner.className = "planta-banner sem-planta";
        banner.innerHTML = `<div class="planta-banner-icon">🪴</div><div class="planta-banner-info"><div class="planta-banner-nome" style="color:var(--muted)">Nenhuma planta selecionada</div><div class="planta-banner-especie">Selecione uma planta abaixo</div></div><span class="planta-banner-alerta alerta-none">— sem dados —</span>`;
        return;
    }
    let cls = "alerta-none", txt = "Aguardando...";
    if (umidadeAtual !== undefined) {
        if (umidadeAtual < plantaAtiva.min) { cls = "alerta-baixo"; txt = `⚠ Baixo (${umidadeAtual.toFixed(1)}%)`; }
        else if (umidadeAtual > plantaAtiva.max) { cls = "alerta-alto"; txt = `💧 Alto (${umidadeAtual.toFixed(1)}%)`; }
        else { cls = "alerta-ok"; txt = `✓ Ideal (${umidadeAtual.toFixed(1)}%)`; }
    }
    banner.className = "planta-banner";
    banner.innerHTML = `<div class="planta-banner-icon">${plantaAtiva.icone}</div><div class="planta-banner-info"><div class="planta-banner-nome">${plantaAtiva.nome}</div><div class="planta-banner-especie">${plantaAtiva.especie}</div><div class="planta-banner-faixa">Faixa ideal: ${plantaAtiva.min}% – ${plantaAtiva.max}%</div></div><span class="planta-banner-alerta ${cls}">${txt}</span>`;
}

function atualizarBadge() {
    document.getElementById("navBadgePlantas").textContent = plantas.length;
    document.getElementById("ovPlantas").textContent = plantas.length;
}

function limparPlantas() {
    if (!confirm("Apagar todas as plantas cadastradas?")) return;
    plantas = []; plantaAtiva = null;
    salvarPlantasLS(); renderPlantGrid(); renderMonPlantGrid(); renderBanner(); atualizarBadge();
}

// ═══════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════
function salvarConfig() {
    API = document.getElementById("cfgApi").value.trim().replace(/\/$/, "");
    document.getElementById("apiUrl").value = API;
    const iv = parseInt(document.getElementById("cfgIntervalo").value) || 10;
    intervaloMS = Math.max(3, Math.min(60, iv)) * 1000;
    clearInterval(timerBusca);
    timerBusca = setInterval(buscar, intervaloMS);
    buscar();
    const msg = document.getElementById("cfgMsg");
    msg.textContent = "✓ Salvo!"; msg.style.opacity = "1";
    setTimeout(() => msg.style.opacity = "0", 2000);
}

// ═══════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════
function gerarPDF() {
    if (!dadosGlobais.length) return;
    const btn = document.getElementById("btnPdf");
    btn.disabled = true; btn.textContent = "⏳ Gerando PDF...";
    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
            const now = new Date(), agora = now.toLocaleString("pt-BR");
            const vals = dadosGlobais.map(d => parseFloat(d.umidade)).filter(v => !isNaN(v));
            const media = vals.reduce((a, b) => a + b, 0) / vals.length;
            const maxi = Math.max(...vals), mini = Math.min(...vals);
            const atual = vals[vals.length - 1];
            const t5 = vals.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, vals.length);
            const t10 = vals.slice(-10, -5).length ? vals.slice(-10, -5).reduce((a, b) => a + b, 0) / vals.slice(-10, -5).length : t5;
            const tend = t5 > t10 + 1 ? "Subindo" : t5 < t10 - 1 ? "Caindo" : "Estavel";

            doc.setFillColor(11, 18, 32); doc.rect(0, 0, W, H, "F");
            doc.setFillColor(19, 30, 53); doc.rect(0, 0, W, 22, "F");
            doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.5); doc.line(0, 22, W, 22);
            doc.setTextColor(74, 222, 128); doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("EcoTech", 12, 14);
            doc.setTextColor(226, 234, 246); doc.setFontSize(11); doc.text("Relatorio de Umidade", 38, 14);
            doc.setTextColor(122, 143, 171); doc.setFontSize(7.5); doc.text(`${agora}   |   ${vals.length} registros`, W - 12, 14, { align: "right" });

            let y = 28;
            if (plantaAtiva) {
                doc.setFillColor(13, 40, 24); doc.roundedRect(12, y, W - 24, 18, 2, 2, "F");
                doc.setTextColor(74, 222, 128); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text(`Planta: ${plantaAtiva.nome}`, 18, y + 7);
                doc.setTextColor(134, 239, 172); doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.text(plantaAtiva.especie, 18, y + 13);
                doc.setTextColor(187, 247, 208); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text(`Faixa ideal: ${plantaAtiva.min}% – ${plantaAtiva.max}%`, W - 18, y + 7, { align: "right" });
                let stColor = [74, 222, 128], stText = "Umidade dentro da faixa ideal";
                if (atual < plantaAtiva.min) { stColor = [251, 146, 60]; stText = "ABAIXO do ideal"; }
                else if (atual > plantaAtiva.max) { stColor = [125, 211, 252]; stText = "ACIMA do ideal"; }
                doc.setTextColor(...stColor); doc.setFontSize(7); doc.text(stText, W - 18, y + 13, { align: "right" });
                y += 22;
            }

            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text("ESTATISTICAS", 12, y + 6);
            doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3); doc.line(12, y + 7.5, W - 12, y + 7.5);

            const stats = [
                { label: "ATUAL", value: atual.toFixed(1) + "%", cor: [74, 222, 128], sub: "Ultima leitura" },
                { label: "MEDIA", value: media.toFixed(1) + "%", cor: [56, 189, 248], sub: `${vals.length} amostras` },
                { label: "MAXIMA", value: maxi.toFixed(1) + "%", cor: [244, 114, 182], sub: "Pico" },
                { label: "MINIMA", value: mini.toFixed(1) + "%", cor: [250, 204, 21], sub: "Menor" },
                { label: "AMPLITUDE", value: (maxi - mini).toFixed(1) + "%", cor: [251, 146, 60], sub: "Max-Min" },
                { label: "TENDENCIA", value: tend, cor: [226, 234, 246], sub: "Ultimas leituras" },
            ];
            const cW2 = (W - 24 - 10) / 3, cH2 = 22;
            stats.forEach((s, i) => {
                const col = i % 3, row = Math.floor(i / 3);
                const cx = 12 + col * (cW2 + 5), cy = y + 11 + row * (cH2 + 4);
                doc.setFillColor(26, 40, 68); doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3); doc.roundedRect(cx, cy, cW2, cH2, 2, 2, "FD");
                doc.setFontSize(6); doc.setTextColor(122, 143, 171); doc.setFont("helvetica", "normal"); doc.text(s.label, cx + 4, cy + 6);
                doc.setFontSize(13); doc.setTextColor(...s.cor); doc.setFont("helvetica", "bold"); doc.text(s.value, cx + 4, cy + 16);
                doc.setFontSize(6); doc.setTextColor(122, 143, 171); doc.setFont("helvetica", "normal"); doc.text(s.sub, cx + 4, cy + 20.5);
            });

            const yG = y + 65;
            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text("HISTORICO", 12, yG);
            doc.setDrawColor(36, 48, 80); doc.line(12, yG + 1.5, W - 12, yG + 1.5);

            // gráfico PDF
            const slice = vals.slice(-70), slabels = dadosGlobais.slice(-70).map(d => d.data_hora.slice(11, 16));
            if (slice.length >= 2) {
                let vMin = Math.min(...slice) - 2, vMax = Math.max(...slice) + 2;
                if (plantaAtiva) { vMin = Math.min(vMin, plantaAtiva.min - 2); vMax = Math.max(vMax, plantaAtiva.max + 2); }
                const ox = 12, oy = yG + 3, gcW = W - 24, gcH = 62;
                const pL = 16, pR = 6, pT = 4, pB = 14, gW = gcW - pL - pR, gH = gcH - pT - pB;
                const xOf = i => ox + pL + (i / Math.max(1, slice.length - 1)) * gW;
                const yOf = v => oy + pT + (1 - (v - vMin) / Math.max(1, vMax - vMin)) * gH;
                doc.setFillColor(16, 26, 46); doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.2); doc.roundedRect(ox, oy, gcW, gcH, 2, 2, "FD");
                if (plantaAtiva) {
                    const yIM = yOf(plantaAtiva.max), yIm = yOf(plantaAtiva.min);
                    doc.setFillColor(20, 50, 30); doc.rect(ox + pL, yIM, gW, yIm - yIM, "F");
                    doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.3);
                    doc.setLineDashPattern([1, 1], 0); doc.line(ox + pL, yIM, ox + pL + gW, yIM); doc.line(ox + pL, yIm, ox + pL + gW, yIm); doc.setLineDashPattern([], 0);
                }
                doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.25);
                for (let i = 0; i <= 4; i++) { const v = vMin + (vMax - vMin) * (i / 4), yy = yOf(v); doc.line(ox + pL, yy, ox + pL + gW, yy); doc.setTextColor(100, 120, 150); doc.setFontSize(5.5); doc.text(v.toFixed(0) + "%", ox + pL - 2, yy + 1.5, { align: "right" }); }
                for (let i = 0; i < slice.length - 1; i++) { const x1 = xOf(i), x2 = xOf(i + 1), y1 = yOf(slice[i]), y2 = yOf(slice[i + 1]), yb = yOf(vMin), yt = Math.min(y1, y2); doc.setFillColor(20, 40, 28); doc.rect(x1, yt, x2 - x1, yb - yt, "F"); }
                doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.9);
                for (let i = 0; i < slice.length - 1; i++) doc.line(xOf(i), yOf(slice[i]), xOf(i + 1), yOf(slice[i + 1]));
                doc.setFillColor(255, 255, 255); doc.circle(xOf(slice.length - 1), yOf(slice[slice.length - 1]), 1.2, "F");
                const xSt = Math.max(1, Math.floor(slice.length / 7)); doc.setFontSize(5.5); doc.setTextColor(100, 120, 150);
                for (let i = 0; i < slice.length; i++) { if (i % xSt === 0 || i === slice.length - 1) doc.text(slabels[i], xOf(i), oy + gcH - 1.5, { align: "center" }); }
            }

            const yT = yG + 70;
            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text("ULTIMAS LEITURAS", 12, yT);
            doc.setDrawColor(36, 48, 80); doc.line(12, yT + 1.5, W - 12, yT + 1.5);
            const rows = [...dadosGlobais].reverse().slice(0, 15).map((r, i) => {
                const v = parseFloat(r.umidade);
                const st = plantaAtiva ? (v < plantaAtiva.min ? "Baixo" : v > plantaAtiva.max ? "Alto" : "Ideal") : (v >= media + 5 ? "Alto" : v <= media - 5 ? "Baixo" : "Normal");
                return [i + 1, r.data_hora, v.toFixed(1) + "%", st];
            });
            doc.autoTable({
                startY: yT + 3, head: [["#", "Data / Hora", "Umidade", "Status"]], body: rows, theme: "plain",
                styles: { fontSize: 7.5, textColor: [200, 210, 226], fillColor: [11, 18, 32], cellPadding: 2.2, lineColor: [36, 48, 80], lineWidth: 0.2 },
                headStyles: { fillColor: [19, 30, 53], textColor: [122, 143, 171], fontStyle: "bold", fontSize: 6.5 },
                alternateRowStyles: { fillColor: [16, 26, 46] },
                columnStyles: { 0: { halign: "center", cellWidth: 8, textColor: [122, 143, 171] }, 1: { cellWidth: 60 }, 2: { halign: "center", cellWidth: 24, textColor: [74, 222, 128], fontStyle: "bold" }, 3: { halign: "center", cellWidth: 20 } },
                didParseCell(d) { if (d.column.index === 3 && d.section === "body") { const v = d.cell.text[0]; if (v === "Alto") d.cell.styles.textColor = [125, 211, 252]; else if (v === "Baixo") d.cell.styles.textColor = [251, 146, 60]; else d.cell.styles.textColor = [74, 222, 128]; } },
                margin: { left: 12, right: 12 }
            });

            // rodapé
            const pgs = doc.internal.getNumberOfPages();
            for (let p = 1; p <= pgs; p++) {
                doc.setPage(p);
                doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3); doc.line(12, H - 12, W - 12, H - 12);
                doc.setTextColor(74, 222, 128); doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text("EcoTech", 12, H - 6);
                doc.setTextColor(122, 143, 171); doc.setFont("helvetica", "normal"); doc.text(`Gerado por ${usuarioLogado} — ${agora}`, W / 2, H - 6, { align: "center" });
                doc.text(`${p}/${pgs}`, W - 12, H - 6, { align: "right" });
            }

            const nome = `ecotech${plantaAtiva ? "_" + plantaAtiva.nome.toLowerCase().replace(/\s+/g, "_") : ""}_${now.toISOString().slice(0, 10)}.pdf`;
            doc.save(nome);
        } catch (e) { alert("Erro ao gerar PDF: " + e.message); console.error(e); }
        finally { btn.disabled = false; btn.innerHTML = "📄 Gerar Relatório PDF"; }
    }, 50);
}

// ═══════════════════════════════════════════════════════
// MONITOR — funções da aba
// ═══════════════════════════════════════════════════════
function renderMonitor(dados) {
    renderMonBanner(dados.length ? parseFloat(dados[dados.length - 1].umidade) : undefined);
    renderMonCards(dados);
    renderGrafico(dados, "graficoMon", true);
    renderMonTabela(dados);
    document.getElementById("monBtnPdf").disabled = dados.length === 0;
    const leg = document.getElementById("legendaMon");
    if (leg) leg.innerHTML = `<span><span class="legend-dot" style="background:#4ade80"></span>Umidade</span>`
        + (plantaAtiva ? `<span><span class="legend-dot" style="background:rgba(74,222,128,.4)"></span>Faixa ideal (${plantaAtiva.min}%–${plantaAtiva.max}%)</span>` : "");
}

function renderMonBanner(umidadeAtual) {
    const banner = document.getElementById("monBanner");
    if (!plantaAtiva) {
        banner.className = "planta-banner sem-planta";
        banner.innerHTML = `<div class="planta-banner-icon">🪴</div><div class="planta-banner-info"><div class="planta-banner-nome" style="color:var(--muted)">Nenhuma planta selecionada</div><div class="planta-banner-especie">Selecione uma planta abaixo para monitorar</div></div><span class="planta-banner-alerta alerta-none">— sem dados —</span>`;
        return;
    }
    let cls = "alerta-none", txt = "Aguardando...";
    if (umidadeAtual !== undefined) {
        if (umidadeAtual < plantaAtiva.min) { cls = "alerta-baixo"; txt = `⚠ Umidade baixa (${umidadeAtual.toFixed(1)}%)`; }
        else if (umidadeAtual > plantaAtiva.max) { cls = "alerta-alto"; txt = `💧 Umidade alta (${umidadeAtual.toFixed(1)}%)`; }
        else { cls = "alerta-ok"; txt = `✓ Faixa ideal (${umidadeAtual.toFixed(1)}%)`; }
    }
    banner.className = "planta-banner";
    banner.innerHTML = `
    <div class="planta-banner-icon">${plantaAtiva.icone}</div>
    <div class="planta-banner-info">
      <div class="planta-banner-nome">${plantaAtiva.nome}</div>
      <div class="planta-banner-especie">${plantaAtiva.especie}</div>
      <div class="planta-banner-faixa">Faixa ideal: ${plantaAtiva.min}% – ${plantaAtiva.max}%</div>
    </div>
    <span class="planta-banner-alerta ${cls}">${txt}</span>`;
}

function renderMonCards(dados) {
    if (!dados.length) return;
    const vals = dados.map(d => parseFloat(d.umidade)).filter(v => !isNaN(v));
    if (!vals.length) return;
    const atual = vals[vals.length - 1];
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    const max = Math.max(...vals), min = Math.min(...vals), amp = max - min;
    const t5 = vals.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, vals.length);
    const t10 = vals.slice(-10, -5).length ? vals.slice(-10, -5).reduce((a, b) => a + b, 0) / vals.slice(-10, -5).length : t5;
    const tend = t5 > t10 + 1 ? "↑ Subindo" : t5 < t10 - 1 ? "↓ Caindo" : "→ Estável";
    let stPlanta = "";
    if (plantaAtiva) {
        if (atual < plantaAtiva.min) stPlanta = `<div style="font-size:.7rem;color:var(--orange);margin-top:6px">⚠ Abaixo do ideal (${plantaAtiva.min}%)</div>`;
        else if (atual > plantaAtiva.max) stPlanta = `<div style="font-size:.7rem;color:var(--accent2);margin-top:6px">💧 Acima do ideal (${plantaAtiva.max}%)</div>`;
        else stPlanta = `<div style="font-size:.7rem;color:var(--accent);margin-top:6px">✓ Dentro da faixa ideal</div>`;
    }
    document.getElementById("monCards").innerHTML = `
    <div class="card"><div class="label">Atual</div><div class="value c-green">${atual.toFixed(1)}<span class="unit">%</span></div><div class="sub">Última leitura${stPlanta}</div></div>
    <div class="card"><div class="label">Média</div><div class="value c-blue">${media.toFixed(1)}<span class="unit">%</span></div><div class="sub">${vals.length} amostras</div></div>
    <div class="card"><div class="label">Máxima</div><div class="value c-pink">${max.toFixed(1)}<span class="unit">%</span></div><div class="sub">Pico registrado</div></div>
    <div class="card"><div class="label">Mínima</div><div class="value c-yellow">${min.toFixed(1)}<span class="unit">%</span></div><div class="sub">Menor registro</div></div>
    <div class="card"><div class="label">Amplitude</div><div class="value c-orange">${amp.toFixed(1)}<span class="unit">%</span></div><div class="sub">Max − Min</div></div>
    <div class="card"><div class="label">Tendência</div><div class="value" style="font-size:1.2rem;color:#e2eaf6;margin-top:4px">${tend}</div><div class="sub">Últimas leituras</div></div>`;
}

function renderMonTabela(dados) {
    const el = document.getElementById("monTabelaDiv");
    if (!dados.length) { el.innerHTML = '<p class="empty">Sem dados</p>'; return; }
    const ultimas = [...dados].reverse().slice(0, 15);
    const vals = dados.map(d => parseFloat(d.umidade));
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    let html = `<table><thead><tr><th>#</th><th>Data / Hora</th><th>Umidade</th><th>Status</th></tr></thead><tbody>`;
    ultimas.forEach((r, i) => {
        const v = parseFloat(r.umidade);
        let badge, label;
        if (plantaAtiva) {
            if (v < plantaAtiva.min) { badge = "badge-baixo"; label = "Baixo"; }
            else if (v > plantaAtiva.max) { badge = "badge-alto"; label = "Alto"; }
            else { badge = "badge-med"; label = "Ideal"; }
        } else {
            if (v >= media + 5) { badge = "badge-alto"; label = "Alto"; }
            else if (v <= media - 5) { badge = "badge-baixo"; label = "Baixo"; }
            else { badge = "badge-med"; label = "Normal"; }
        }
        html += `<tr><td style="color:#7a8fab">${i + 1}</td><td>${r.data_hora}</td><td style="color:#4ade80;font-weight:600">${v}%</td><td><span class="badge ${badge}">${label}</span></td></tr>`;
    });
    html += "</tbody></table>";
    el.innerHTML = html;
}

function renderMonPlantGrid() {
    const grid = document.getElementById("monPlantGrid");
    if (!grid) return;
    if (!plantas.length) { grid.innerHTML = '<p class="no-plants">Nenhuma planta cadastrada ainda.</p>'; return; }
    grid.innerHTML = plantas.map(p => `
    <div class="plant-chip ${plantaAtiva?.id === p.id ? 'active' : ''}" onclick="selecionarPlantaMon(${p.id})">
      <span style="font-size:1.3rem">${p.icone}</span>
      <span class="plant-chip-nome">${p.nome}</span>
      <span class="plant-chip-esp">${p.especie}</span>
      <span class="plant-chip-faixa">${p.min}% – ${p.max}%</span>
    </div>`).join("");
}

function selecionarPlantaMon(id) {
    plantaAtiva = plantas.find(p => p.id === id) || null;
    renderMonPlantGrid();
    renderPlantGrid();
    if (dadosGlobais.length) {
        renderMonitor(dadosGlobais);
        renderStats(dadosGlobais);
        renderTabela(dadosGlobais);
    }
    atualizarOverview(
        dadosGlobais.map(d => parseFloat(d.umidade)).filter(v => !isNaN(v)),
        dadosGlobais.length ? parseFloat(dadosGlobais[dadosGlobais.length - 1].umidade) : undefined
    );
}

function gerarPDFMonitor() { gerarPDF(); }