# LoL Synergy & Profile Tracker

Uma aplicação web moderna e de alta performance para jogadores de League of Legends. Este projeto permite a busca detalhada de perfis, análise profunda de maestrias e conta com uma ferramenta tática para planejamento de sinergia de equipes.

O projeto foi construído com foco absoluto em performance no front-end e segurança no back-end, utilizando uma arquitetura modular sem a necessidade de ferramentas de build complexas.

---

## 🚀 Funcionalidades

* **Dashboard de Perfil:** Busca em tempo real de estatísticas ranqueadas, taxa de vitória e histórico detalhado das últimas 20 partidas (KDA, itens, duração).
* **Gráfico de Maestrias Avançado:** Visualização do Top 10 campeões mais jogados em formato de lista progressiva e uma grade densa interativa para o restante do arsenal.
* **Planejador de Sinergia (Team Planner):** Simulador de composições para Solo/Duo ou Flex. Permite adicionar jogadores anônimos ou puxar o perfil de amigos para travar campeões com base na maestria real.
* **Análise Tática:** Feedback visual simulado sobre a composição da equipe (Dano, Controle de Grupo, Linha de Frente e Ritmo).
* **Telemetria de API Integrada:** Um widget em tempo real que monitora os limites da API da Riot Games (Rate Limits), prevenindo bloqueios de chave (429 Too Many Requests) através de um cálculo de janela deslizante (Rolling Window).
* **Overlay Cinematográfico:** Sistema de carregamento em segundo plano (Perceived Performance) para mascarar o tempo de resposta da API com uma contagem regressiva elegante.

---

## 🛠️ Tecnologias Utilizadas

* **Front-end:** HTML5, CSS3, Vanilla JavaScript (ES Modules).
* **Estilização:** Tailwind CSS (via CDN).
* **Back-end / Proxy:** Cloudflare Workers (Serverless).
* **API de Dados:** Riot Games API & Data Dragon (Imagens e Assets).

---

## 🏗️ Arquitetura do Projeto

O projeto utiliza **ES Modules** nativos do navegador para manter o código modular e organizado, eliminando a necessidade de instaladores de pacotes (NPM) ou bundlers (Webpack/Vite).

* `index.html`: Ponto de entrada limpo e estrutura do DOM.
* `js/main.js`: Maestro da aplicação, gerencia eventos e abas.
* `js/state.js`: Gerenciamento de estado global e reatividade simulada.
* `js/api.js`: Comunicação com o proxy da Cloudflare.
* `js/utils.js`: Ferramentas globais (formatação de tempo, URLs de imagens).
* `js/components/`: Componentes isolados responsáveis por renderizar cada aba (Profile, Mastery, Synergy, Telemetry).

---

## ⚙️ Como rodar localmente

Como o projeto utiliza ES Modules (`<script type="module">`), ele não funcionará se o arquivo `index.html` for aberto diretamente no navegador por causa das políticas de segurança (CORS).

1. Clone este repositório.
2. Abra a pasta do projeto no **Visual Studio Code**.
3. Instale a extensão **Live Server**.
4. Clique no botão **"Go Live"** no canto inferior direito do VS Code.
5. O projeto abrirá automaticamente no seu navegador local.

---

## 🔒 Configuração do Cloudflare Worker (Back-end)

Para proteger a chave oficial da Riot Games e contornar erros de CORS do navegador, as requisições não são feitas diretamente do front-end. O projeto depende de uma "ponte" construída no Cloudflare Workers.

1. Crie um Worker gratuito na Cloudflare.
2. Configure a variável de ambiente secreta `RIOT_API_KEY` no painel da Cloudflare.
3. Implante o código de proxy reverso no Worker (responsável por tratar as rotas `profile_overview` e `masteries`).
4. Atualize a constante `WORKER_URL` no arquivo `js/utils.js` deste projeto com o link gerado pela Cloudflare.

---

## 📝 Licença

Este projeto é de uso pessoal e educacional. Desenvolvido de acordo com as diretrizes do **Riot Games Developer Portal**.