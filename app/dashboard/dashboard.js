let API = "http://localhost:5000";
let dadosGlobais = [];

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
        renderCards(dadosGlobais);
        renderGrafico(dadosGlobais);
        renderTabela(dadosGlobais);
        document.getElementById("btnPdf").disabled = dadosGlobais.length === 0;
    } catch {
        bar.innerHTML = `<span class="erro">● Sem conexão com a API (${API})</span>`;
        document.getElementById("btnPdf").disabled = true;
    }
}

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
    document.getElementById("cards").innerHTML = `
    <div class="card"><div class="label">Atual</div><div class="value c-green">${atual.toFixed(1)}<span class="unit">%</span></div><div class="sub">Última leitura</div></div>
    <div class="card"><div class="label">Média</div><div class="value c-blue">${media.toFixed(1)}<span class="unit">%</span></div><div class="sub">${vals.length} amostras</div></div>
    <div class="card"><div class="label">Máxima</div><div class="value c-pink">${max.toFixed(1)}<span class="unit">%</span></div><div class="sub">Pico registrado</div></div>
    <div class="card"><div class="label">Mínima</div><div class="value c-yellow">${min.toFixed(1)}<span class="unit">%</span></div><div class="sub">Menor registro</div></div>
    <div class="card"><div class="label">Amplitude</div><div class="value c-orange">${amp.toFixed(1)}<span class="unit">%</span></div><div class="sub">Max − Min</div></div>
    <div class="card"><div class="label">Tendência</div><div class="value" style="font-size:1.2rem;color:#e2eaf6;margin-top:4px">${tend}</div><div class="sub">Últimas leituras</div></div>
  `;
}

function renderGrafico(dados) {
    const canvas = document.getElementById("grafico");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr || 600 * dpr;
    canvas.height = 180 * dpr;
    ctx.scale(dpr, dpr);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.clearRect(0, 0, W, H);
    if (!dados.length) return;
    const slice = dados.slice(-60);
    const vals = slice.map(d => parseFloat(d.umidade)).filter(v => !Number.isNaN(v));
    const labels = slice.map(d => d.data_hora.slice(11, 16));
    const vMin = Math.min(...vals) - 3;
    const vMax = Math.max(...vals) + 3;
    const pad = { top: 14, right: 16, bottom: 30, left: 38 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const xOf = i => pad.left + (i / Math.max(1, slice.length - 1)) * cW;
    const yOf = v => pad.top + (1 - (v - vMin) / Math.max(1, vMax - vMin)) * cH;
    ctx.strokeStyle = "#243050"; ctx.lineWidth = 0.7;
    const nLines = 4;
    for (let i = 0; i <= nLines; i++) {
        const v = vMin + (vMax - vMin) * (i / nLines);
        const y = yOf(v);
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
        ctx.fillStyle = "#7a8fab"; ctx.font = "9px system-ui"; ctx.textAlign = "right";
        ctx.fillText(v.toFixed(0) + "%", pad.left - 4, y + 3);
    }
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    grad.addColorStop(0, "rgba(74,222,128,.35)");
    grad.addColorStop(1, "rgba(74,222,128,.02)");
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(vals[0]));
    for (let i = 1; i < vals.length; i++) ctx.lineTo(xOf(i), yOf(vals[i]));
    ctx.lineTo(xOf(vals.length - 1), pad.top + cH);
    ctx.lineTo(xOf(0), pad.top + cH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(vals[0]));
    for (let i = 1; i < vals.length; i++) ctx.lineTo(xOf(i), yOf(vals[i]));
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
    const step = Math.max(1, Math.floor(slice.length / 8));
    for (let i = 0; i < vals.length; i++) {
        ctx.beginPath(); ctx.arc(xOf(i), yOf(vals[i]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#4ade80"; ctx.fill();
        if (i % step === 0 || i === vals.length - 1) {
            ctx.fillStyle = "#7a8fab"; ctx.font = "8px system-ui"; ctx.textAlign = "center";
            ctx.fillText(labels[i], xOf(i), H - pad.bottom + 12);
        }
    }
}

function renderTabela(dados) {
    if (!dados.length) { document.getElementById("tabelaDiv").innerHTML = '<p class="empty">Sem dados</p>'; return; }
    const ultimas = [...dados].reverse().slice(0, 15);
    const vals = dados.map(d => parseFloat(d.umidade));
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    let html = `<table><thead><tr><th>#</th><th>Data / Hora</th><th>Umidade</th><th>Status</th></tr></thead><tbody>`;
    ultimas.forEach((r, i) => {
        const v = parseFloat(r.umidade);
        let badge, label;
        if (v >= media + 5) { badge = "badge-alto"; label = "Alto"; }
        else if (v <= media - 5) { badge = "badge-baixo"; label = "Baixo"; }
        else { badge = "badge-med"; label = "Normal"; }
        html += `<tr><td style="color:#7a8fab">${i + 1}</td><td>${r.data_hora}</td><td style="color:#4ade80;font-weight:600">${v}%</td><td><span class="badge ${badge}">${label}</span></td></tr>`;
    });
    html += "</tbody></table>";
    document.getElementById("tabelaDiv").innerHTML = html;
}

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

            doc.setFillColor(11, 18, 32); doc.rect(0, 0, W, H, "F");
            doc.setFillColor(19, 30, 53); doc.rect(0, 0, W, 22, "F");
            doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.5); doc.line(0, 22, W, 22);
            doc.setTextColor(74, 222, 128); doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("EcoTech", 12, 14);
            doc.setTextColor(226, 234, 246); doc.setFontSize(11); doc.text("Relatorio de Umidade — Dashboard", 38, 14);
            doc.setTextColor(122, 143, 171); doc.setFontSize(7.5); doc.text(`Gerado em: ${agora}   |   ${vals.length} registros`, W - 12, 14, { align: "right" });
            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text("ESTATISTICAS GERAIS", 12, 32);
            doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3); doc.line(12, 33.5, W - 12, 33.5);

            const statsData = [
                { label: "ATUAL", value: atual.toFixed(1) + "%", cor: [74, 222, 128], sub: "Ultima leitura" },
                { label: "MEDIA", value: media.toFixed(1) + "%", cor: [56, 189, 248], sub: `${vals.length} amostras` },
                { label: "MAXIMA", value: maxi.toFixed(1) + "%", cor: [244, 114, 182], sub: "Pico registrado" },
                { label: "MINIMA", value: mini.toFixed(1) + "%", cor: [250, 204, 21], sub: "Menor registro" },
                { label: "AMPLITUDE", value: amp.toFixed(1) + "%", cor: [251, 146, 60], sub: "Max - Min" },
                { label: "TENDENCIA", value: tend, cor: [226, 234, 246], sub: "Ultimas leituras" },
            ];
            const cW2 = (W - 24 - 10) / 3; const cH2 = 22;
            statsData.forEach((s, i) => {
                const col = i % 3; const row = Math.floor(i / 3);
                const cx = 12 + col * (cW2 + 5); const cy = 37 + row * (cH2 + 4);
                doc.setFillColor(26, 40, 68); doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3);
                doc.roundedRect(cx, cy, cW2, cH2, 2, 2, "FD");
                doc.setFontSize(6); doc.setTextColor(122, 143, 171); doc.setFont("helvetica", "normal"); doc.text(s.label, cx + 4, cy + 6);
                doc.setFontSize(13); doc.setTextColor(...s.cor); doc.setFont("helvetica", "bold"); doc.text(s.value, cx + 4, cy + 16);
                doc.setFontSize(6); doc.setTextColor(122, 143, 171); doc.setFont("helvetica", "normal"); doc.text(s.sub, cx + 4, cy + 20.5);
            });

            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text("HISTORICO DE UMIDADE", 12, 100);
            doc.setDrawColor(36, 48, 80); doc.line(12, 101.5, W - 12, 101.5);
            drawChartPDF(doc, vals.slice(-60), dadosGlobais.slice(-60).map(d => d.data_hora.slice(11, 16)), 12, 104, W - 24, 68);

            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text("ULTIMAS LEITURAS", 12, 178);
            doc.setDrawColor(36, 48, 80); doc.line(12, 179.5, W - 12, 179.5);

            const slice15 = [...dadosGlobais].reverse().slice(0, 15);
            const rows15 = slice15.map((r, i) => {
                const v = parseFloat(r.umidade);
                const st = v >= media + 5 ? "Alto" : v <= media - 5 ? "Baixo" : "Normal";
                return [i + 1, r.data_hora, v.toFixed(1) + "%", st];
            });
            doc.autoTable({
                startY: 181, head: [["#", "Data / Hora", "Umidade", "Status"]], body: rows15, theme: "plain",
                styles: { fontSize: 7.5, textColor: [200, 210, 226], fillColor: [11, 18, 32], cellPadding: 2.2, lineColor: [36, 48, 80], lineWidth: 0.2 },
                headStyles: { fillColor: [19, 30, 53], textColor: [122, 143, 171], fontStyle: "bold", fontSize: 6.5 },
                alternateRowStyles: { fillColor: [16, 26, 46] },
                columnStyles: { 0: { halign: "center", cellWidth: 8, textColor: [122, 143, 171] }, 1: { cellWidth: 60 }, 2: { halign: "center", cellWidth: 24, textColor: [74, 222, 128], fontStyle: "bold" }, 3: { halign: "center", cellWidth: 20 } },
                didParseCell(data) {
                    if (data.column.index === 3 && data.section === "body") {
                        const v = data.cell.text[0];
                        if (v === "Alto") data.cell.styles.textColor = [74, 222, 128];
                        else if (v === "Baixo") data.cell.styles.textColor = [251, 146, 60];
                        else data.cell.styles.textColor = [125, 211, 252];
                    }
                },
                margin: { left: 12, right: 12 },
            });
            addRodape(doc, W, H, 1, 2, agora);

            doc.addPage();
            doc.setFillColor(11, 18, 32); doc.rect(0, 0, W, H, "F");
            doc.setFillColor(19, 30, 53); doc.rect(0, 0, W, 22, "F");
            doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.5); doc.line(0, 22, W, 22);
            doc.setTextColor(74, 222, 128); doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("EcoTech", 12, 14);
            doc.setTextColor(226, 234, 246); doc.setFontSize(11); doc.text("Grafico Completo + Analise", 38, 14);
            doc.setTextColor(122, 143, 171); doc.setFontSize(7.5); doc.text(`Pagina 2   |   ${agora}`, W - 12, 14, { align: "right" });
            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text("SERIE COMPLETA DE LEITURAS", 12, 32);
            doc.setDrawColor(36, 48, 80); doc.line(12, 33.5, W - 12, 33.5);

            const allLabels = dadosGlobais.map(d => d.data_hora.slice(11, 16));
            drawChartPDF(doc, vals, allLabels, 12, 36, W - 24, 90);

            doc.setTextColor(122, 143, 171); doc.setFontSize(7); doc.text("ANALISE DOS DADOS", 12, 134);
            doc.setDrawColor(36, 48, 80); doc.line(12, 135.5, W - 12, 135.5);

            const analise = buildAnalise(vals, dadosGlobais, media, maxi, mini, tend);
            let y = 142;
            analise.forEach(bloco => {
                doc.setFillColor(19, 30, 53); doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3);
                doc.roundedRect(12, y - 5, W - 24, 7, 1.5, 1.5, "FD");
                doc.setTextColor(56, 189, 248); doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.text(bloco.titulo, 16, y);
                y += 6;
                bloco.linhas.forEach(linha => {
                    doc.setTextColor(200, 210, 226); doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
                    const wrapped = doc.splitTextToSize("• " + linha, W - 32);
                    doc.text(wrapped, 16, y); y += wrapped.length * 4.5;
                });
                y += 4;
            });
            addRodape(doc, W, H, 2, 2, agora);

            const nome = `ecotech_dashboard_${now.toISOString().slice(0, 10)}.pdf`;
            doc.save(nome);
        } catch (e) {
            alert("Erro ao gerar PDF: " + e.message); console.error(e);
        } finally {
            btn.disabled = false; btn.innerHTML = "📄 Gerar PDF do Dashboard";
        }
    }, 50);
}

function drawChartPDF(doc, vals, labels, ox, oy, cW, cH) {
    const slice = vals.slice(-80);
    const slabels = labels.slice(-80);
    if (slice.length < 2) return;
    const vMin = Math.min(...slice) - 2;
    const vMax = Math.max(...slice) + 2;
    const padL = 16, padR = 6, padT = 4, padB = 14;
    const gW = cW - padL - padR;
    const gH = cH - padT - padB;
    const xOf = i => ox + padL + (i / Math.max(1, slice.length - 1)) * gW;
    const yOf = v => oy + padT + (1 - (v - vMin) / Math.max(1, vMax - vMin)) * gH;
    doc.setFillColor(16, 26, 46); doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.2);
    doc.roundedRect(ox, oy, cW, cH, 2, 2, "FD");
    doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.25);
    const nG = 5;
    for (let i = 0; i <= nG; i++) {
        const v = vMin + (vMax - vMin) * (i / nG); const y = yOf(v);
        doc.line(ox + padL, y, ox + padL + gW, y);
        doc.setTextColor(100, 120, 150); doc.setFontSize(5.5);
        doc.text(v.toFixed(0) + "%", ox + padL - 2, y + 1.5, { align: "right" });
    }
    for (let i = 0; i < slice.length - 1; i++) {
        const x1 = xOf(i), x2 = xOf(i + 1);
        const y1 = yOf(slice[i]), y2 = yOf(slice[i + 1]);
        const yb = yOf(vMin); const ytop = Math.min(y1, y2);
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

function buildAnalise(vals, dados, media, maxi, mini, tend) {
    const desvio = Math.sqrt(vals.reduce((s, v) => s + (v - media) ** 2, 0) / vals.length).toFixed(2);
    const primeiroTs = dados[0]?.data_hora || "—";
    const ultimoTs = dados[dados.length - 1]?.data_hora || "—";
    let altaCount = 0, baixaCount = 0;
    vals.forEach(v => { if (v > media + 5) altaCount++; if (v < media - 5) baixaCount++; });
    return [
        {
            titulo: "Resumo Geral", linhas: [
                `Periodo analisado: ${primeiroTs} ate ${ultimoTs}`,
                `Total de amostras: ${vals.length} leituras`,
                `Valor atual: ${vals[vals.length - 1].toFixed(1)}%   |   Tendencia: ${tend}`,
            ]
        },
        {
            titulo: "Estatisticas", linhas: [
                `Media: ${media.toFixed(2)}%   Maxima: ${maxi.toFixed(1)}%   Minima: ${mini.toFixed(1)}%`,
                `Amplitude: ${(maxi - mini).toFixed(1)}%   Desvio padrao: ${desvio}%`,
                `Leituras acima da media (+5%): ${altaCount} (${(altaCount / vals.length * 100).toFixed(1)}%)`,
                `Leituras abaixo da media (-5%): ${baixaCount} (${(baixaCount / vals.length * 100).toFixed(1)}%)`,
            ]
        },
        {
            titulo: "Interpretacao", linhas: [
                media < 40 ? "Umidade media BAIXA — ambiente seco. Considere monitorar para evitar ressecamento."
                    : media > 70 ? "Umidade media ALTA — ambiente umido. Verifique ventilacao e possibilidade de mofo."
                        : "Umidade media dentro da faixa de conforto (40–70%). Condicoes normais.",
                tend === "Subindo" ? "Tendencia de aumento de umidade nas ultimas leituras. Fique atento a possiveis picos."
                    : tend === "Caindo" ? "Tendencia de queda de umidade. Monitorar se atingira niveis criticos baixos."
                        : "Umidade estavel nas ultimas leituras. Sem variacao significativa recente.",
                `Variabilidade ${parseFloat(desvio) > 5 ? "ALTA (desvio > 5%) — leituras muito oscilantes" : "BAIXA — sensor estavel e leituras consistentes"}.`,
            ]
        },
    ];
}

function addRodape(doc, W, H, pagAtual, pagTotal, agora) {
    doc.setDrawColor(36, 48, 80); doc.setLineWidth(0.3); doc.line(12, H - 12, W - 12, H - 12);
    doc.setTextColor(74, 222, 128); doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text("EcoTech", 12, H - 6);
    doc.setTextColor(122, 143, 171); doc.setFont("helvetica", "normal");
    doc.text(`Relatorio gerado automaticamente — ${agora}`, W / 2, H - 6, { align: "center" });
    doc.text(`${pagAtual} / ${pagTotal}`, W - 12, H - 6, { align: "right" });
}

buscar();
setInterval(buscar, 10000);