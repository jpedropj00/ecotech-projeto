from flask import Flask, request
import csv
import os
from datetime import datetime

app = Flask(__name__)

ARQUIVO_CSV = "umidade.csv"

# Cria o arquivo com cabeçalho se não existir
if not os.path.exists(ARQUIVO_CSV):
    with open(ARQUIVO_CSV, "w", newline="", encoding="utf-8") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow(["data_hora", "umidade"])

@app.route("/receber", methods=["GET"])
def receber():
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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)