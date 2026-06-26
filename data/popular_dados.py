import requests
import random
import time


<<<<<<<< HEAD:app/api/popular_dados.py
API_URL = "http://localhost:5000"
========
API_URL = "http://192.168.137.97:5000"
>>>>>>>> c4b7eb2fde4e8ab1732a74f9160010964ac847c3:data/popular_dados.py


QUANTIDADE = 20
INTERVALO = 2

print(f"Enviando {QUANTIDADE} leituras para {API_URL}/receber\n")

for i in range(1, QUANTIDADE + 1):
    umidade = random.randint(30, 90)  
    try:
        resposta = requests.get(f"{API_URL}/receber", params={"umidade": umidade})
        print(f"[{i}/{QUANTIDADE}] umidade={umidade}%  ->  {resposta.status_code} {resposta.text}")
    except Exception as e:
        print(f"[{i}/{QUANTIDADE}] ERRO ao conectar: {e}")
    time.sleep(INTERVALO)

print("\nPronto! Abra o umidade.html para ver os dados.")