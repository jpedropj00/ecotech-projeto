let API_BASE_URL = "http://localhost:5000";
let dadosCache = [];

function salvarUrl() {
    API_BASE_URL = document.getElementById("url").value.trim();
    buscarDados();
}

async function buscarUltima() {
    const res = await fetch(`${API_BASE_URL}/ultima`);
    if (!res.ok) throw new Error("sem dados");
    return res.json();
}

async function buscarTodos() {
    const res = await fetch(`${API_BASE_URL}/dados`);
    if (!res.ok) throw new Error("erro ao buscar");
    return res.json();
}

async function buscarDados() {
    const status = document.getElementById("status");
    try {
        const ultima = await buscarUltima();
        document.getElementById("atual").textContent = ultima.umidade;
        document.getElementById("dataAtual").textContent = ultima.data_hora;
        const todos = await buscarTodos();
        dadosCache = todos;
        renderHistorico(todos);
        status.textContent = "● Conectado";
        status.className = "status ok";
    } catch (e) {
        status.textContent = "● Sem conexão com a API (" + API_BASE_URL + ")";
        status.className = "status erro";
    }
}

function renderHistorico(dados) {
    const div = document.getElementById("historico");
    if (!dados || dados.length === 0) {
        div.innerHTML = '<p class="empty">Nenhuma leitura ainda.</p>';
        return;
    }
    const ultimos = dados.slice(-10).reverse();
    let html =
        "<table><thead><tr><th>Data / Hora</th><th>Umidade</th></tr></thead><tbody>";
    for (const linha of ultimos) {
        html += `<tr><td>${linha.data_hora}</td><td>${linha.umidade}%</td></tr>`;
    }
    html += "</tbody></table>";
    div.innerHTML = html;
}

function exportarPDF() {
    if (dadosCache.length === 0) {
        alert("Nenhum dado disponível. Conecte-se à API primeiro.");
        return;
    }

    const btn = document.getElementById("btnPdf");
    btn.disabled = true;
    btn.textContent = "⏳ Gerando...";

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        const pageW = doc.internal.pageSize.getWidth();
        const agora = new Date().toLocaleString("pt-BR");

        doc.setFillColor(26, 37, 64);
        doc.rect(0, 0, pageW, 28, "F");

        doc.setTextColor(74, 222, 128);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("EcoTech — Relatório de Umidade", 14, 13);

        doc.setTextColor(138, 155, 179);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(
            `Gerado em: ${agora}   |   Total de registros: ${dadosCache.length}`,
            14,
            22,
        );

        const linhas = [...dadosCache]
            .reverse()
            .map((r, i) => [i + 1, r.data_hora, r.umidade + "%"]);

        doc.autoTable({
            startY: 34,
            head: [["#", "Data / Hora", "Umidade (%)"]],
            body: linhas,
            styles: {
                fontSize: 9,
                cellPadding: 3,
                textColor: [40, 50, 70],
            },
            headStyles: {
                fillColor: [26, 37, 64],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                halign: "center",
            },
            columnStyles: {
                0: { halign: "center", cellWidth: 14 },
                1: { cellWidth: "auto" },
                2: {
                    halign: "center",
                    cellWidth: 30,
                    textColor: [22, 163, 74],
                    fontStyle: "bold",
                },
            },
            alternateRowStyles: { fillColor: [240, 244, 255] },
            tableLineColor: [209, 217, 230],
            tableLineWidth: 0.3,
        });

        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            const pageH = doc.internal.pageSize.getHeight();
            doc.setDrawColor(42, 58, 92);
            doc.line(14, pageH - 12, pageW - 14, pageH - 12);
            doc.setTextColor(138, 155, 179);
            doc.setFontSize(7);
            doc.text(`Página ${p} de ${totalPages}`, pageW / 2, pageH - 6, {
                align: "center",
            });
            doc.text("EcoTech", 14, pageH - 6);
        }

        const nomeArquivo = `umidade_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(nomeArquivo);
    } catch (e) {
        alert("Erro ao gerar PDF: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "⬇ Exportar PDF";
    }
}

function exportarCSV() {
    if (dadosCache.length === 0) {
        alert("Nenhum dado disponível. Conecte-se à API primeiro.");
        return;
    }

    let csv = "\uFEFFData / Hora,Umidade (%)\n";
    for (const row of dadosCache) {
        csv += `${row.data_hora},${row.umidade}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `umidade_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function toggleSheets() {
    document.getElementById("sheetsPanel").classList.toggle("visible");
}

async function enviarSheets() {
    const msg = document.getElementById("sheetsMsg");
    const sheetId = document.getElementById("sheetId").value.trim();
    const credRaw = document.getElementById("credJson").value.trim();

    if (!sheetId || !credRaw) {
        msg.className = "sheets-msg erro";
        msg.textContent =
            "Preencha o ID da planilha e o JSON de credenciais.";
        return;
    }

    let credentials_json;
    try {
        credentials_json = JSON.parse(credRaw);
    } catch {
        msg.className = "sheets-msg erro";
        msg.textContent = "JSON de credenciais inválido.";
        return;
    }

    msg.className = "sheets-msg info";
    msg.textContent = "⏳ Enviando dados...";

    try {
        const res = await fetch(`${API_BASE_URL}/exportar/sheets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spreadsheet_id: sheetId, credentials_json }),
        });
        const data = await res.json();
        if (!res.ok) {
            msg.className = "sheets-msg erro";
            msg.textContent = "Erro: " + (data.erro || res.status);
            return;
        }
        msg.className = "sheets-msg ok";
        msg.innerHTML = `✅ ${data.registros_enviados} registros enviados! <a href="${data.planilha}" target="_blank" style="color:#4ade80">Abrir planilha →</a>`;
    } catch (e) {
        msg.className = "sheets-msg erro";
        msg.textContent = "Não foi possível conectar na API.";
    }
}

buscarDados();
setInterval(buscarDados, 5000);