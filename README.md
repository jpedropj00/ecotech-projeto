# data-capture

API de captação de dados de umidade do solo — **Projeto EcoTech** 🌱

Repositório de teste de uma API simples, feita em Python com Flask, que recebe leituras de umidade de um sensor (como um ESP32), salva os dados em um arquivo CSV e os disponibiliza para visualização em uma página web.

---

## Visão geral

O fluxo do projeto é:

```
Sensor (ESP32)  ──HTTP──>  API Flask (main.py)  ──salva──>  umidade.csv
                                   │
                                   └──HTTP──>  Página web (index.html)
```

O sensor envia a umidade lida para a API, a API guarda cada leitura com data e hora, e a página web lê esses dados de volta para exibir o valor atual e o histórico.

---

## Estrutura do repositório

| Arquivo | Descrição |
|---|---|
| `main.py` | A API Flask. Recebe, salva e disponibiliza as leituras de umidade. |
| `popular_dados.py` | Script de teste que envia leituras aleatórias para a API, simulando o sensor. |
| `index.html` | Página web que exibe a umidade atual e o histórico, atualizando automaticamente. |
| `umidade.csv` | Arquivo onde as leituras são salvas (criado automaticamente). |
| `LICENSE` | Licença MIT. |

---

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/receber?umidade=VALOR` | Recebe e salva uma leitura de umidade. |
| `GET` | `/dados` | Retorna todas as leituras em formato JSON. |
| `GET` | `/ultima` | Retorna a leitura mais recente em formato JSON. |

---

## Como rodar

### 1. Instale as dependências

```bash
pip install flask flask-cors requests
```

### 2. Inicie a API

```bash
python main.py
```

A API ficará disponível em `http://0.0.0.0:5000`. Deixe essa janela do terminal aberta enquanto usa o projeto.

### 3. Gere dados de teste (opcional)

Em **outra** janela de terminal, com a API rodando, execute o script que simula o sensor:

```bash
python popular_dados.py
```

Ele envia 20 leituras aleatórias de umidade, uma a cada 2 segundos.

### 4. Veja os dados

Abra o arquivo `index.html` no navegador. A página mostra a umidade atual e o histórico das últimas leituras, atualizando sozinha a cada poucos segundos.

---

## Configuração do endereço (IP)

O endereço da API depende de **onde** está rodando o programa que se conecta a ela:

- **Testando tudo no mesmo computador:** use `http://127.0.0.1:5000`. Esse endereço sempre aponta para a própria máquina e nunca muda.
- **Conectando de outro aparelho** (celular, ESP32): use o IP real do computador na rede local (algo como `http://192.168.x.x:5000`). Descubra esse IP com `ipconfig` (Windows) ou `ip addr` (Linux). Os dois aparelhos precisam estar na **mesma rede Wi-Fi**.

---

## Observações

- A API funciona na rede local e **não precisa de internet** para operar.
- Na primeira execução, o Windows pode pedir permissão de firewall para a porta 5000 — é necessário permitir o acesso.
- O armazenamento em CSV é adequado para testes. Para uso prolongado, recomenda-se migrar para um banco de dados (por exemplo, SQLite).
- Esta é uma API de teste, sem autenticação. Evite expô-la em redes públicas.

---

## Tecnologias

- Python
- Flask + Flask-CORS
- HTML / CSS / JavaScript

---

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

Projeto desenvolvido como parte do **EcoTech**, com a intenção de melhorar a qualidade da sua horta. 🌾
