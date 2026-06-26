from flask import Flask, request, jsonify
from flask_cors import CORS
import csv
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

ARQUIVO_CSV = "umidade.csv"


def garantir_csv():
    if not os.path.exists(ARQUIVO_CSV) or os.path.getsize(ARQUIVO_CSV) == 0:
        with open(ARQUIVO_CSV, "w", newline="", encoding="utf-8") as arquivo:
            escritor = csv.writer(arquivo)
            escritor.writerow(["data_hora", "umidade"])


@app.route("/receber", methods=["GET"])
def receber():
    garantir_csv()

    umidade = request.args.get("umidade")

    if umidade is None:
        return "Parametro 'umidade' nao informado", 400

    with open(ARQUIVO_CSV, "a", newline="", encoding="utf-8") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            umidade
        ])

    return "Dados salvos com sucesso", 200


@app.route("/dados", methods=["GET"])
def dados():
    garantir_csv()

    lista = []

    with open(ARQUIVO_CSV, "r", encoding="utf-8") as arquivo:
        leitor = csv.DictReader(arquivo)

        for linha in leitor:
            if "data_hora" in linha and "umidade" in linha:
                lista.append({
                    "data_hora": linha["data_hora"],
                    "umidade": linha["umidade"]
                })

    return jsonify(lista)


@app.route("/ultima", methods=["GET"])
def ultima():
    garantir_csv()

    lista = []

    with open(ARQUIVO_CSV, "r", encoding="utf-8") as arquivo:
        leitor = csv.DictReader(arquivo)

        for linha in leitor:
            if "data_hora" in linha and "umidade" in linha:
                lista.append({
                    "data_hora": linha["data_hora"],
                    "umidade": linha["umidade"]
                })

    if len(lista) == 0:
        return jsonify({
            "erro": "sem dados"
        }), 404

    return jsonify(lista[-1])


if __name__ == "__main__":
    garantir_csv()
    app.run(host="0.0.0.0", port=5000, debug=True)