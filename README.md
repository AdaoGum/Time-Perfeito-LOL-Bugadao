# LoL Synergy & Profile Tracker

Uma aplicação web moderna e de alta performance para jogadores de League of Legends. Este projeto permite a busca detalhada de perfis, análise profunda de maestrias e conta com uma ferramenta tática para planejamento de sinergia de equipes.

O projeto foi migrado de Vanilla JS para **Vue 3 (Composition API com `<script setup>`) + Vite**, mantendo o design 100% intacto.

---

## 🚀 Funcionalidades

* **Dashboard de Perfil:** Busca em tempo real de estatísticas ranqueadas, taxa de vitória e histórico detalhado das últimas 20 partidas (KDA, itens, duração).
* **Gráfico de Maestrias Avançado:** Visualização do Top 20 campeões mais jogados em formato de lista progressiva e uma grade densa interativa para o restante do arsenal.
* **Planejador de Sinergia (Team Planner):** Simulador de composições para Solo/Duo ou Flex. Permite adicionar jogadores anônimos ou puxar o perfil de amigos para travar campeões com base na maestria real.
* **Análise Tática:** Feedback visual simulado sobre a composição da equipe (Dano, Controle de Grupo, Linha de Frente e Ritmo).
* **Telemetria de API Integrada:** Um widget em tempo real que monitora os limites da API da Riot Games (Rate Limits), prevenindo bloqueios de chave (429 Too Many Requests) através de um cálculo de janela deslizante (Rolling Window).
* **Overlay Cinematográfico:** Sistema de carregamento em segundo plano (Perceived Performance) para mascarar o tempo de resposta da API com uma contagem regressiva elegante.

---

## 🛠️ Tecnologias Utilizadas

* **Front-end:** Vue 3 (Composition API, `<script setup>`).
* **Build Tool:** Vite.
* **Estilização:** Tailwind CSS v4.
* **Back-end / Proxy:** Cloudflare Workers (Serverless).
* **API de Dados:** Riot Games API & Data Dragon (Imagens e Assets).

---

## 🏗️ Arquitetura do Projeto

* `index.html`: Ponto de entrada do Vite com `<div id="app">`.
* `src/main.js`: Inicializa o app Vue e importa estilos globais.
* `src/App.vue`: Componente raiz — cabeçalho, roteamento de abas por `v-if`, telemetria, overlay, tooltip.
* `src/store.js`: Estado global reativo usando `reactive()` do Vue.
* `src/api.js`: Comunicação com o proxy da Cloudflare.
* `src/utils.js`: Ferramentas globais (formatação de tempo, URLs de imagens).
* `src/style.css`: Estilos globais com Tailwind e animações customizadas.
* `src/components/`: Componentes Vue para cada aba (`Home.vue`, `Profile.vue`, `Mastery.vue`, `Synergy.vue`).

---

## ⚙️ Como rodar localmente

1. Clone este repositório.
2. Instale as dependências: `npm install`
3. Inicie o servidor de desenvolvimento: `npm run dev`
4. O projeto abrirá em `http://localhost:5173`

Para gerar o build de produção: `npm run build`

---

## 🔒 Configuração do Cloudflare Worker (Back-end)

Para proteger a chave oficial da Riot Games e contornar erros de CORS do navegador, as requisições não são feitas diretamente do front-end. O projeto depende de uma "ponte" construída no Cloudflare Workers.

1. Crie um Worker gratuito na Cloudflare.
2. Configure a variável de ambiente secreta `RIOT_API_KEY` no painel da Cloudflare.
3. Implante o código de proxy reverso no Worker (responsável por tratar as rotas `profile_overview` e `masteries`).
4. Atualize a constante `WORKER_URL` no arquivo `src/utils.js` deste projeto com o link gerado pela Cloudflare.

---

## 🧠 Como funciona o motor de sinergia v2

O Planejador de Sinergia ranqueia cada candidato com um score **normalizado 0–1**:

```
scoreIndividual = 0.40·proficiência + 0.20·metaScore + 0.10·roleFit
scoreDeTime     = Σ scoreIndividual + 0.30·(aderênciaArquétipo + sinergiaDePares + balanceamento)
```

- **Proficiência:** força real do jogador no campeão — winrate bayesiano, recência
  (último jogo), maestria e desempenho (KDA/CS/min). Vem de `src/utils/proficiencia.js`.
- **Meta:** tier list manual em `src/data/meta-tiers.csv` (S/A/B/C/D → 1.0/0.8/0.6/0.4/0.25).
  Campeão fora do CSV = 0.5 (neutro); o meta **pondera, nunca domina**.
- **Vetores táticos:** 8 dimensões + `cc`, `scaling` e `mechTags` em `src/data/sinergia-champs.csv`.
- **Arquétipos** (ENGAGE/POKE/PROTECT/PICK/SPLITPUSH) e **pares sinérgicos**
  (ex.: `fornece_knockup` + `aproveita_knockup`) medem o encaixe do time inteiro.
- A composição é resolvida por **otimização global** (produto cartesiano dos top 8 por slot),
  e a UI mostra o arquétipo do time, os pares encontrados e os Planos A/B/C.

Dados ausentes (sem partidas, sem maestria, sem meta) degradam para neutro — nunca quebram.

## 🗺️ Como atualizar o meta (tier list)

O sistema lê `src/data/meta-tiers.csv` para ponderar as recomendações pela
força de cada campeão no patch atual. A atualização é manual:

1. Abra o Claude (web, com busca) e cole o prompt padrão (`.github/prompts/PLANNER-FINAL-sinergia-v2.md`, Anexo A).
2. Salve a resposta como `src/data/meta-tiers.csv` (substituindo o anterior).
3. Confira a 1ª linha: `# patch: X | atualizado: YYYY-MM-DD`.
4. Commit + deploy. A UI exibe o novo patch automaticamente.

Se o CSV passar de 30 dias, a UI avisa "meta desatualizado" e o peso do meta
nas recomendações cai pela metade automaticamente.

---

## 📝 Licença

Este projeto é de uso pessoal e educacional. Desenvolvido de acordo com as diretrizes do **Riot Games Developer Portal**.