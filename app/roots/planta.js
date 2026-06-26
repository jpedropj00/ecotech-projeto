// ─── Estado global ──────────────────────────────────────────────────────────
let API = "http://192.168.137.97:5000";
let dadosGlobais = [];
let plantaAtiva = null; // objeto planta selecionada
let plantas = [];   // lista salva no localStorage

// ─── Plantas: localStorage ──────────────────────────────────────────────────
function carregarPlantas() {
    try { plantas = JSON.parse(localStorage.getItem("ecotech_plantas") || "[]"); }
    catch { plantas = []; }
}

function salvarPlantasLS() {
    localStorage.setItem("ecotech_plantas", JSON.stringify(plantas));
}

// ─── Modal ──────────────────────────────────────────────────────────────────
function abrirModal() {
    document.getElementById("mNome").value = "";
    document.getElementById("mEspecie").value = "";
    document.getElementById("mIcone").value = "🌱";
    document.getElementById("mMin").value = "40";
    document.getElementById("mMax").value = "70";
    document.getElementById("modalOverlay").classList.add("open");
}

function fecharModal() {
    document.getElementById("modalOverlay").classList.remove("open");
}

document.getElementById("modalOverlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) fecharModal();
});

function salvarPlanta() {
    const nome = document.getElementById("mNome").value.trim();
    const especie = document.getElementById("mEspecie").value.trim();
    const icone = document.getElementById("mIcone").value;
    const min = parseFloat(document.getElementById("mMin").value);
    const max = parseFloat(document.getElementById("mMax").value);

    if (!nome) { document.getElementById("mNome").focus(); return; }
    if (!especie) { document.getElementById("mEspecie").focus(); return; }
    if (isNaN(min) || isNaN(max) || min >= max) {
        alert("A umidade mínima deve ser menor que a máxima."); return;
    }

    const nova = { id: Date.now(), nome, especie, icone, min, max };
    plantas.push(nova);
    salvarPlantasLS();
    renderPlantGrid();
    fecharModal();

    // seleciona automaticamente se for a primeira
    if (plantas.length === 1) selecionarPlanta(nova.id);
}

function deletarPlanta(id, e) {
    e.stopPropagation();
    if (!confirm("Remover esta planta?")) return;
    plantas = plantas.filter(p => p.id !== id);
    salvarPlantasLS();
    if (plantaAtiva?.id === id) {
        plantaAtiva = null;
        renderBanner();
    }
    renderPlantGrid();
}

function selecionarPlanta(id) {
    plantaAtiva = plantas.find(p => p.id === id) || null;
    renderPlantGrid();
    renderBanner();
    if (dadosGlobais.length) {
        renderCards(dadosGlobais);
        renderGrafico(dadosGlobais);
        renderTabela(dadosGlobais);
    }
}

// ─── Render grid de plantas ─────────────────────────────────────────────────
function renderPlantGrid() {
    const grid = document.getElementById("plantGrid");
    if (!plantas.length) {
        grid.innerHTML = '<p class="no-plants">Nenhuma planta cadastrada. Clique em "+ Cadastrar planta".</p>';
        return;
    }
    grid.innerHTML = plantas.map(p => `
    <div class="plant-chip ${plantaAtiva?.id === p.id ? 'active' : ''}" onclick="selecionarPlanta(${p.id})">
      <span style="font-size:1.3rem">${p.icone}</span>
      <span class="plant-chip-nome">${p.nome}</span>
      <span class="plant-chip-esp">${p.especie}</span>
      <span class="plant-chip-faixa">${p.min}% – ${p.max}%</span>
      <span class="plant-chip-del" onclick="deletarPlanta(${p.id}, event)">✕ remover</span>
    </div>
  `).join("");
}

// ─── Banner planta ativa ────────────────────────────────────────────────────
function renderBanner(umidadeAtual) {
    const banner = document.getElementById("plantaBanner");

    if (!plantaAtiva) {
        banner.className = "planta-banner sem-planta";
        banner.innerHTML = `
      <div class="planta-banner-icon">🪴</div>
      <div class="planta-banner-info">
        <div class="planta-banner-nome" style="color:var(--muted)">Nenhuma planta selecionada</div>
        <div class="planta-banner-especie">Selecione uma planta acima para monitorar</div>
      </div>
      <span class="planta-banner-alerta alerta-none">— sem dados —</span>
    `;
        return;
    }

    let alertaClass = "alerta-none", alertaText = "Aguardando...";
    if (umidadeAtual !== undefined) {
        if (umidadeAtual < plantaAtiva.min) {
            alertaClass = "alerta-baixo";
            alertaText = `⚠ Umidade baixa (${umidadeAtual.toFixed(1)}%)`;
        } else if (umidadeAtual > plantaAtiva.max) {
            alertaClass = "alerta-alto";
            alertaText = `💧 Umidade alta (${umidadeAtual.toFixed(1)}%)`;
        } else {
            alertaClass = "alerta-ok";
            alertaText = `✓ Faixa ideal (${umidadeAtual.toFixed(1)}%)`;
        }
    }

    banner.className = "planta-banner";
    banner.innerHTML = `
    <div class="planta-banner-icon">${plantaAtiva.icone}</div>
    <div class="planta-banner-info">
      <div class="planta-banner-nome">${plantaAtiva.nome}</div>
      <div class="planta-banner-especie">${plantaAtiva.especie}</div>
      <div class="planta-banner-faixa">Faixa ideal: ${plantaAtiva.min}% – ${plantaAtiva.max}% de umidade</div>
    </div>
    <span class="planta-banner-alerta ${alertaClass}">${alertaText}</span>
  `;
}

// ─── API ────────────────────────────────────────────────────────────────────
function conectar() {
    API = document.getElementById("apiUrl").value.trim().replace(/\/$/, "");
    buscar();
}

async function buscar() {
    const bar = document.getElementById("statusBar");
    try {
        const res = await fetch(`${API}/dados`);
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        dadosGlobais = await res.json();
        bar.innerHTML = `<span class="ok">● Conectado — ${dadosGlobais.length} registros</span>`;

        const vals = dadosGlobais.map(d => parseFloat(d.umidade)).filter(v => !isNaN(v));
        const atual = vals.length ? vals[vals.length - 1] : undefined;

        renderBanner(atual);
        renderCards(dadosGlobais);
        renderGrafico(dadosGlobais);
        renderTabela(dadosGlobais);
        document.getElementById("btnPdf").disabled = dadosGlobais.length === 0;
    } catch {
        bar.innerHTML = `<span class="erro">● Sem conexão com a API (${API})</span>`;
        document.getElementById("btnPdf").disabled = true;
    }
}

// ─── Cards ──────────────────────────────────────────────────────────────────
function renderCards(dados) {
    if (!dados.length) return;
    const vals = dados.map(d => parseFloat(d.umidade)).filter(v => !Number.isNaN(v));
    if (!vals.length) return;
    const atual = vals[vals.length - 1];
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const amp = max - min;
    const t5 = vals.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, vals.length);
    const t10 = vals.slice(-10, -5).length ? vals.slice(-10, -5).reduce((a, b) => a + b, 0) / vals.slice(-10, -5).length : t5;
    const tend = t5 > t10 + 1 ? "↑ Subindo" : t5 < t10 - 1 ? "↓ Caindo" : "→ Estável";

    // status em relação à planta
    let statusPlanta = "";
    if (plantaAtiva) {
        if (atual < plantaAtiva.min) statusPlanta = `<div style="font-size:.7rem;color:var(--orange);margin-top:6px">⚠ Abaixo do ideal (${plantaAtiva.min}%)</div>`;
        else if (atual > plantaAtiva.max) statusPlanta = `<div style="font-size:.7rem;color:var(--accent2);margin-top:6px">💧 Acima do ideal (${plantaAtiva.max}%)</div>`;
        else statusPlanta = `<div style="font-size:.7rem;color:var(--accent);margin-top:6px">✓ Dentro da faixa ideal</div>`;
    }

    document.getElementById("cards").innerHTML = `
    <div class="card">
      <div class="label">Atual</div>
      <div class="value c-green">${atual.toFixed(1)}<span class="unit">%</span></div>
      <div class="sub">Última leitura${statusPlanta}</div>
    </div>
    <div class="card">
      <div class="label">Média</div>
      <div class="value c-blue">${media.toFixed(1)}<span class="unit">%</span></div>
      <div class="sub">${vals.length} amostras</div>
    </div>
    <div class="card">
      <div class="label">Máxima</div>
      <div class="value c-pink">${max.toFixed(1)}<span class="unit">%</span></div>
      <div class="sub">Pico registrado</div>
    </div>
    <div class="card">
      <div class="label">Mínima</div>
      <div class="value c-yellow">${min.toFixed(1)}<span class="unit">%</span></div>
      <div class="sub">Menor registro</div>
    </div>
    <div class="card">
      <div class="label">Amplitude</div>
      <div class="value c-orange">${amp.toFixed(1)}<span class="unit">%</span></div>
      <div class="sub">Max − Min</div>
    </div>
    <div class="card">
      <div class="label">Tendência</div>
      <div class="value" style="font-size:1.2rem;color:#e2eaf6;margin-top:4px">${tend}</div>
      <div class="sub">Últimas leituras</div>
    </div>
  `;
}

// ─── Gráfico ─────────────────────────────────────────────────────────────────
function renderGrafico(dados) {
    const canvas = document.getElementById("grafico");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 600) * dpr;
    canvas.height = 180 * dpr;
    ctx.scale(dpr, dpr);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.clearRect(0, 0, W, H);
    if (!dados.length) return;

    const slice = dados.slice(-60);
    const vals = slice.map(d => parseFloat(d.umidade)).filter(v => !Number.isNaN(v));
    const labels = slice.map(d => d.data_hora.slice(11, 16));

    // expandir range para incluir faixa ideal se houver
    let vMin = Math.min(...vals) - 3;
    let vMax = Math.max(...vals) + 3;
    if (plantaAtiva) {
        vMin = Math.min(vMin, plantaAtiva.min - 3);
        vMax = Math.max(vMax, plantaAtiva.max + 3);
    }

    const pad = { top: 14, right: 16, bottom: 30, left: 38 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const xOf = i => pad.left + (i / Math.max(1, slice.length - 1)) * cW;
    const yOf = v => pad.top + (1 - (v - vMin) / Math.max(1, vMax - vMin)) * cH;

    // grades
    ctx.strokeStyle = "#243050"; ctx.lineWidth = 0.7;
    for (let i = 0; i <= 4; i++) {
        const v = vMin + (vMax - vMin) * (i / 4);
        const y = yOf(v);
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
        ctx.fillStyle = "#7a8fab"; ctx.font = "9px system-ui"; ctx.textAlign = "right";
        ctx.fillText(v.toFixed(0) + "%", pad.left - 4, y + 3);
    }

    // ── faixa ideal da planta (banda verde claro) ──
    if (plantaAtiva) {
        const yIdealMax = yOf(plantaAtiva.max);
        const yIdealMin = yOf(plantaAtiva.min);
        ctx.fillStyle = "rgba(74,222,128,.08)";
        ctx.fillRect(pad.left, yIdealMax, cW, yIdealMin - yIdealMax);

        // linha min ideal
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "rgba(74,222,128,.4)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, yIdealMin); ctx.lineTo(W - pad.right, yIdealMin); ctx.stroke();
        // linha max ideal
        ctx.beginPath(); ctx.moveTo(pad.left, yIdealMax); ctx.lineTo(W - pad.right, yIdealMax); ctx.stroke();
        ctx.setLineDash([]);
    }

    // área preenchida
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    grad.addColorStop(0, "rgba(74,222,128,.35)");
    grad.addColorStop(1, "rgba(74,222,128,.02)");
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(vals[0]));
    for (let i = 1; i < vals.length; i++) ctx.lineTo(xOf(i), yOf(vals[i]));
    ctx.lineTo(xOf(vals.length - 1), pad.top + cH);
    ctx.lineTo(xOf(0), pad.top + cH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    // linha principal
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(vals[0]));
    for (let i = 1; i < vals.length; i++) ctx.lineTo(xOf(i), yOf(vals[i]));
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();

    // pontos + labels X
    const step = Math.max(1, Math.floor(slice.length / 8));
    for (let i = 0; i < vals.length; i++) {
        ctx.beginPath();
        ctx.arc(xOf(i), yOf(vals[i]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#4ade80"; ctx.fill();
        if (i % step === 0 || i === vals.length - 1) {
            ctx.fillStyle = "#7a8fab"; ctx.font = "8px system-ui"; ctx.textAlign = "center";
            ctx.fillText(labels[i], xOf(i), H - pad.bottom + 12);
        }
    }

    // legenda
    const legend = document.getElementById("chartLegend");
    legend.innerHTML = `<span><span class="legend-dot" style="background:#4ade80"></span>Umidade</span>`
        + (plantaAtiva ? `<span><span class="legend-dot" style="background:rgba(74,222,128,.4);border:1px dashed #4ade80"></span>Faixa ideal (${plantaAtiva.min}%–${plantaAtiva.max}%)</span>` : "");
}

// ─── Tabela ──────────────────────────────────────────────────────────────────
function renderTabela(dados) {
    if (!dados.length) {
        document.getElementById("tabelaDiv").innerHTML = '<p class="empty">Sem dados</p>';
        return;
    }
    const ultimas = [...dados].reverse().slice(0, 15);
    const vals = dados.map(d => parseFloat(d.umidade));
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;

    let html = `<table><thead><tr><th>#</th><th>Data / Hora</th><th>Umidade</th><th>Status</th></tr></thead><tbody>`;
    ultimas.forEach((r, i) => {
        const v = parseFloat(r.umidade);
        let badge, label;
        // se há planta ativa, usa a faixa dela; senão usa desvio da média
        if (plantaAtiva) {
            if (v < plantaAtiva.min) { badge = "badge-baixo"; label = "Baixo"; }
            else if (v > plantaAtiva.max) { badge = "badge-alto"; label = "Alto"; }
            else { badge = "badge-med"; label = "Ideal"; }
        } else {
            if (v >= media + 5) { badge = "badge-alto"; label = "Alto"; }
            else if (v <= media - 5) { badge = "badge-baixo"; label = "Baixo"; }
            else { badge = "badge-med"; label = "Normal"; }
        }
        html += `<tr>
      <td style="color:#7a8fab">${i + 1}</td>
      <td>${r.data_hora}</td>
      <td style="color:#4ade80;font-weight:600">${v}%</td>
      <td><span class="badge ${badge}">${label}</span></td>
    </tr>`;
    });
    html += "</tbody></table>";
    document.getElementById("tabelaDiv").innerHTML = html;
}

// ─── PDF ─────────────────────────────────────────────────────────────────────
function gerarPDF() {
    if (!dadosGlobais.length) return;
    const btn = document.getElementById("btnPdf");
    btn.disabled = true; btn.textContent = "⏳ Gerando PDF...";

    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            const now = new Date();
            const agora = now.toLocaleString("pt-BR");
            const vals = dadosGlobais.map(d => parseFloat(d.umidade)).filter(v => !isNaN(v));
            const media = vals.reduce((a, b) => a + b, 0) / vals.length;
            const maxi = Math.max(...vals);
            const mini = Math.min(...vals);
            const amp = maxi - mini;
            const atual = vals[vals.length - 1];
            const t5 = vals.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, vals.length);
            const t10 = vals.slice(-10, -5).length ? vals.slice(-10, -5).reduce((a, b) => a + b, 0) / vals.slice(-10, -5).length : t5;
            const tend = t5 > t10 + 1 ? "Subindo" : t5 < t10 - 1 ? "Caindo" : "Estavel";

            // fundo
            doc.setFillColor(11, 18, 32); doc.rect(0, 0, W, H, "F");

            // barra topo
            doc.setFillColor(19, 30, 53); doc.rect(0, 0, W, 22, "F");
            doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.5); doc.line(0, 22, W, 22);
            doc.setTextColor(74, 222, 128); doc.setFontSize(14); doc.setFont("helvetica", "bold");
            doc.text("EcoTech", 12, 14);
            doc.setTextColor(226, 234, 246); doc.setFontSize(11);
            doc.text("Relatorio de Umidade", 38, 14);
            doc.setTextColor(122, 143, 171); doc.setFontSize(7.5);
            doc.text(`Gerado em: ${agora}   |   ${vals.length} registros`, W - 12, 14, { align: "right" });

            // info da planta
            let yStart = 28;
            if (plantaAtiva) {
                doc.setFillColor(13, 40, 24);
                doc.roundedRect(12, yStart, W - 24, 18, 2, 2, "F");
                doc.setTextColor(74, 222, 128); doc.setFontSize(9); doc.setFont("helvetica", "bold");
                doc.text(`Planta: ${plantaAtiva.nome}`, 18, yStart + 7);
                doc.setTextColor(134, 239, 172); doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
                doc.text(plantaAtiva.especie, 18, yStart + 13);
                doc.setTextColor(187, 247, 208); doc.setFontSize(7); doc.setFont("helvetica", "normal");
                doc.text(`Faixa ideal: ${plantaAtiva.min}% – ${plantaAtiva.max}%`, W - 18, yStart + 7, { align: "right" });
                // status atual
                let stColor = [74, 222, 128], stText = "Umidade dentro da faixa ideal";
                if (atual < plantaAtiva.min) { stColor = [251, 146, 60]; stText = "Umidade ABAIXO do ideal"; }
                else if (atual > plantaAtiva.max) { stColor = [125, 211, 252]; stText = "Umidade ACIMA do ideal"; }
                doc.setTextColor(...stColor); doc.setFontSize(7);
                doc.text(stText, W - 18, yStart + 13, { align: "right" });
                yStart += 22;
            }

            // seção stats
            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal");
            doc.text("ESTATISTICAS GERAIS", 12, yStart + 6);
            doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3);
            doc.line(12, yStart + 7.5, W - 12, yStart + 7.5);

            const statsData = [
                { label: "ATUAL", value: atual.toFixed(1) + "%", cor: [74, 222, 128], sub: "Ultima leitura" },
                { label: "MEDIA", value: media.toFixed(1) + "%", cor: [56, 189, 248], sub: `${vals.length} amostras` },
                { label: "MAXIMA", value: maxi.toFixed(1) + "%", cor: [244, 114, 182], sub: "Pico registrado" },
                { label: "MINIMA", value: mini.toFixed(1) + "%", cor: [250, 204, 21], sub: "Menor registro" },
                { label: "AMPLITUDE", value: amp.toFixed(1) + "%", cor: [251, 146, 60], sub: "Max - Min" },
                { label: "TENDENCIA", value: tend, cor: [226, 234, 246], sub: "Ultimas leituras" },
            ];
            const cW2 = (W - 24 - 10) / 3, cH2 = 22;
            statsData.forEach((s, i) => {
                const col = i % 3, row = Math.floor(i / 3);
                const cx = 12 + col * (cW2 + 5), cy = yStart + 11 + row * (cH2 + 4);
                doc.setFillColor(26, 40, 68); doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3);
                doc.roundedRect(cx, cy, cW2, cH2, 2, 2, "FD");
                doc.setFontSize(6); doc.setTextColor(122, 143, 171); doc.setFont("helvetica", "normal");
                doc.text(s.label, cx + 4, cy + 6);
                doc.setFontSize(13); doc.setTextColor(...s.cor); doc.setFont("helvetica", "bold");
                doc.text(s.value, cx + 4, cy + 16);
                doc.setFontSize(6); doc.setTextColor(122, 143, 171); doc.setFont("helvetica", "normal");
                doc.text(s.sub, cx + 4, cy + 20.5);
            });

            const yGraf = yStart + 65;
            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal");
            doc.text("HISTORICO DE UMIDADE", 12, yGraf);
            doc.setDrawColor(36, 48, 80); doc.line(12, yGraf + 1.5, W - 12, yGraf + 1.5);
            drawChartPDF(doc, vals.slice(-60), dadosGlobais.slice(-60).map(d => d.data_hora.slice(11, 16)),
                12, yGraf + 4, W - 24, 65);

            const yTab = yGraf + 75;
            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal");
            doc.text("ULTIMAS LEITURAS", 12, yTab);
            doc.setDrawColor(36, 48, 80); doc.line(12, yTab + 1.5, W - 12, yTab + 1.5);

            const slice15 = [...dadosGlobais].reverse().slice(0, 15);
            const rows15 = slice15.map((r, i) => {
                const v = parseFloat(r.umidade);
                let st;
                if (plantaAtiva) {
                    st = v < plantaAtiva.min ? "Baixo" : v > plantaAtiva.max ? "Alto" : "Ideal";
                } else {
                    st = v >= media + 5 ? "Alto" : v <= media - 5 ? "Baixo" : "Normal";
                }
                return [i + 1, r.data_hora, v.toFixed(1) + "%", st];
            });
            doc.autoTable({
                startY: yTab + 3,
                head: [["#", "Data / Hora", "Umidade", "Status"]], body: rows15, theme: "plain",
                styles: { fontSize: 7.5, textColor: [200, 210, 226], fillColor: [11, 18, 32], cellPadding: 2.2, lineColor: [36, 48, 80], lineWidth: 0.2 },
                headStyles: { fillColor: [19, 30, 53], textColor: [122, 143, 171], fontStyle: "bold", fontSize: 6.5 },
                alternateRowStyles: { fillColor: [16, 26, 46] },
                columnStyles: { 0: { halign: "center", cellWidth: 8, textColor: [122, 143, 171] }, 1: { cellWidth: 60 }, 2: { halign: "center", cellWidth: 24, textColor: [74, 222, 128], fontStyle: "bold" }, 3: { halign: "center", cellWidth: 20 } },
                didParseCell(data) {
                    if (data.column.index === 3 && data.section === "body") {
                        const v = data.cell.text[0];
                        if (v === "Alto" || v === "Acima") data.cell.styles.textColor = [125, 211, 252];
                        else if (v === "Baixo") data.cell.styles.textColor = [251, 146, 60];
                        else data.cell.styles.textColor = [74, 222, 128];
                    }
                },
                margin: { left: 12, right: 12 },
            });

            addRodape(doc, W, H, 1, 1, agora);

            doc.save(`ecotech_${plantaAtiva ? plantaAtiva.nome.toLowerCase().replace(/\s+/g, "_") + "_" : ""}_${now.toISOString().slice(0, 10)}.pdf`);
        } catch (e) {
            alert("Erro ao gerar PDF: " + e.message); console.error(e);
        } finally {
            btn.disabled = false; btn.innerHTML = "📄 Gerar Relatório PDF";
        }
    }, 50);
}

function drawChartPDF(doc, vals, labels, ox, oy, cW, cH) {
    const slice = vals.slice(-80), slabels = labels.slice(-80);
    if (slice.length < 2) return;
    let vMin = Math.min(...slice) - 2, vMax = Math.max(...slice) + 2;
    if (plantaAtiva) { vMin = Math.min(vMin, plantaAtiva.min - 2); vMax = Math.max(vMax, plantaAtiva.max + 2); }
    const padL = 16, padR = 6, padT = 4, padB = 14;
    const gW = cW - padL - padR, gH = cH - padT - padB;
    const xOf = i => ox + padL + (i / Math.max(1, slice.length - 1)) * gW;
    const yOf = v => oy + padT + (1 - (v - vMin) / Math.max(1, vMax - vMin)) * gH;

    doc.setFillColor(16, 26, 46); doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.2);
    doc.roundedRect(ox, oy, cW, cH, 2, 2, "FD");

    // faixa ideal
    if (plantaAtiva) {
        const yIMax = yOf(plantaAtiva.max), yIMin = yOf(plantaAtiva.min);
        doc.setFillColor(20, 50, 30); doc.rect(ox + padL, yIMax, gW, yIMin - yIMax, "F");
        doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.3);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(ox + padL, yIMin, ox + padL + gW, yIMin);
        doc.line(ox + padL, yIMax, ox + padL + gW, yIMax);
        doc.setLineDashPattern([], 0);
    }

    doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.25);
    for (let i = 0; i <= 5; i++) {
        const v = vMin + (vMax - vMin) * (i / 5), y = yOf(v);
        doc.line(ox + padL, y, ox + padL + gW, y);
        doc.setTextColor(100, 120, 150); doc.setFontSize(5.5);
        doc.text(v.toFixed(0) + "%", ox + padL - 2, y + 1.5, { align: "right" });
    }
    for (let i = 0; i < slice.length - 1; i++) {
        const x1 = xOf(i), x2 = xOf(i + 1), y1 = yOf(slice[i]), y2 = yOf(slice[i + 1]), yb = yOf(vMin), ytop = Math.min(y1, y2);
        doc.setFillColor(20, 40, 28); doc.rect(x1, ytop, x2 - x1, yb - ytop, "F");
    }
    doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.9);
    for (let i = 0; i < slice.length - 1; i++) doc.line(xOf(i), yOf(slice[i]), xOf(i + 1), yOf(slice[i + 1]));
    doc.setFillColor(74, 222, 128);
    const dotStep = Math.max(1, Math.floor(slice.length / 20));
    for (let i = 0; i < slice.length; i += dotStep) doc.circle(xOf(i), yOf(slice[i]), 0.8, "F");
    doc.setFillColor(255, 255, 255);
    doc.circle(xOf(slice.length - 1), yOf(slice[slice.length - 1]), 1.2, "F");
    const xStep = Math.max(1, Math.floor(slice.length / 7));
    doc.setFontSize(5.5); doc.setTextColor(100, 120, 150);
    for (let i = 0; i < slice.length; i++) {
        if (i % xStep === 0 || i === slice.length - 1) doc.text(slabels[i], xOf(i), oy + cH - 1.5, { align: "center" });
    }
}

function addRodape(doc, W, H, pagAtual, pagTotal, agora) {
    doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3); doc.line(12, H - 12, W - 12, H - 12);
    doc.setTextColor(74, 222, 128); doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text("EcoTech", 12, H - 6);
    doc.setTextColor(122, 143, 171); doc.setFont("helvetica", "normal");
    doc.text(`Relatorio gerado automaticamente — ${agora}`, W / 2, H - 6, { align: "center" });
    doc.text(`${pagAtual}/${pagTotal}`, W - 12, H - 6, { align: "right" });
}

// ─── Init ────────────────────────────────────────────────────────────────────
carregarPlantas();
renderPlantGrid();
buscar();
setInterval(buscar, 10000);