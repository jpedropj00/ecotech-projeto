from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import csv
import os
import io
from datetime import datetime

app = Flask(__name__)
CORS(app)

ARQUIVO_CSV = "umidade.csv"

if not os.path.exists(ARQUIVO_CSV):
    with open(ARQUIVO_CSV, "w", newline="", encoding="utf-8") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow(["data_hora", "umidade"])


def ler_todos():
    lista = []
    with open(ARQUIVO_CSV, "r", encoding="utf-8") as arquivo:
        leitor = csv.DictReader(arquivo)
        for linha in leitor:
            lista.append({"data_hora": linha["data_hora"], "umidade": linha["umidade"]})
    return lista


@app.route("/receber", methods=["GET"])
def receber():
    umidade = request.args.get("umidade")
    if umidade is None:
        return "Parametro 'umidade' nao informado", 400
    with open(ARQUIVO_CSV, "a", newline="", encoding="utf-8") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), umidade])
    return "Dados salvos com sucesso", 200


@app.route("/dados", methods=["GET"])
def dados():
    return jsonify(ler_todos())


@app.route("/ultima", methods=["GET"])
def ultima():
    lista = ler_todos()
    if not lista:
        return jsonify({"erro": "sem dados"}), 404
    return jsonify(lista[-1])


# ─── EXPORTAR PDF ────────────────────────────────────────────────────────────

@app.route("/exportar/pdf", methods=["GET"])
def exportar_pdf():
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    except ImportError:
        return jsonify({"erro": "reportlab não instalado. Execute: pip install reportlab"}), 500

    lista = ler_todos()
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # Título
    titulo_style = ParagraphStyle(
        "Titulo",
        parent=styles["Title"],
        fontSize=18,
        textColor=colors.HexColor("#1a2540"),
        spaceAfter=6,
    )
    sub_style = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#8a9bb3"),
        spaceAfter=16,
    )

    story.append(Paragraph("EcoTech — Relatório de Umidade", titulo_style))
    story.append(
        Paragraph(
            f"Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}  |  Total de registros: {len(lista)}",
            sub_style,
        )
    )
    story.append(Spacer(1, 0.4 * cm))

    if not lista:
        story.append(Paragraph("Nenhum dado registrado ainda.", styles["Normal"]))
    else:
        # Cabeçalho + linhas
        tabela_dados = [["#", "Data / Hora", "Umidade (%)"]]
        for i, row in enumerate(reversed(lista), 1):
            tabela_dados.append([str(i), row["data_hora"], row["umidade"] + "%"])

        col_widths = [1.2 * cm, 10 * cm, 4 * cm]
        tabela = Table(tabela_dados, colWidths=col_widths, repeatRows=1)

        COR_HEADER = colors.HexColor("#1a2540")
        COR_PAR    = colors.HexColor("#f0f4ff")
        COR_IMPAR  = colors.white
        COR_VERDE  = colors.HexColor("#4ade80")

        estilo = TableStyle([
            # Cabeçalho
            ("BACKGROUND", (0, 0), (-1, 0), COR_HEADER),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, 0), 10),
            ("ALIGN",      (0, 0), (-1, 0), "CENTER"),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("TOPPADDING",    (0, 0), (-1, 0), 8),
            # Corpo
            ("FONTNAME",   (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE",   (0, 1), (-1, -1), 9),
            ("ALIGN",      (2, 1), (2, -1), "CENTER"),
            ("ALIGN",      (0, 1), (0, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [COR_IMPAR, COR_PAR]),
            # Coluna umidade em verde
            ("TEXTCOLOR",  (2, 1), (2, -1), colors.HexColor("#16a34a")),
            ("FONTNAME",   (2, 1), (2, -1), "Helvetica-Bold"),
            # Grade
            ("GRID",       (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d9e6")),
            ("LINEBELOW",  (0, 0), (-1, 0),  1.5, COR_VERDE),
            # Padding corpo
            ("TOPPADDING",    (0, 1), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ])
        tabela.setStyle(estilo)
        story.append(tabela)

    doc.build(story)
    buffer.seek(0)

    nome_arquivo = f"umidade_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return send_file(
        buffer,
        as_attachment=True,
        download_name=nome_arquivo,
        mimetype="application/pdf",
    )


# ─── EXPORTAR GOOGLE SHEETS (via CSV) ────────────────────────────────────────

@app.route("/exportar/csv", methods=["GET"])
def exportar_csv():
    """
    Retorna um CSV formatado para importar direto no Google Sheets.
    Abra sheets.google.com > Arquivo > Importar > Fazer upload > selecione este CSV.
    """
    lista = ler_todos()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Data / Hora", "Umidade (%)"])
    for row in lista:
        writer.writerow([row["data_hora"], row["umidade"]])

    output.seek(0)
    nome_arquivo = f"umidade_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return send_file(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),  # utf-8-sig = BOM para Excel/Sheets
        as_attachment=True,
        download_name=nome_arquivo,
        mimetype="text/csv; charset=utf-8",
    )


# ─── EXPORTAR DIRETO PARA GOOGLE SHEETS (API) ────────────────────────────────

@app.route("/exportar/sheets", methods=["POST"])
def exportar_sheets():
    """
    Envia dados direto para uma planilha Google via API.
    Body JSON esperado: { "spreadsheet_id": "...", "credentials_json": {...} }

    Pré-requisito:
      pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client

    Como obter credenciais:
      1. Acesse console.cloud.google.com
      2. Crie um projeto > Ative a Google Sheets API
      3. Crie uma Service Account > Baixe o JSON de credenciais
      4. Compartilhe sua planilha com o e-mail da service account
    """
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError:
        return jsonify({
            "erro": "Biblioteca Google não instalada.",
            "solucao": "Execute: pip install google-auth google-api-python-client"
        }), 500

    body = request.get_json()
    if not body or "spreadsheet_id" not in body or "credentials_json" not in body:
        return jsonify({
            "erro": "Informe 'spreadsheet_id' e 'credentials_json' no body da requisição."
        }), 400

    spreadsheet_id  = body["spreadsheet_id"]
    credentials_json = body["credentials_json"]

    try:
        SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
        creds  = Credentials.from_service_account_info(credentials_json, scopes=SCOPES)
        service = build("sheets", "v4", credentials=creds)

        lista = ler_todos()

        valores = [["Data / Hora", "Umidade (%)"]]
        for row in lista:
            valores.append([row["data_hora"], row["umidade"]])

        body_req = {"values": valores}
        service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range="A1",
            valueInputOption="RAW",
            body=body_req,
        ).execute()

        return jsonify({
            "sucesso": True,
            "registros_enviados": len(lista),
            "planilha": f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
        })

    except Exception as e:
        return jsonify({"erro": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)