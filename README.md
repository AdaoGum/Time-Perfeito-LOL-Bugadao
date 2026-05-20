# UGA BUGA Infos + Caverna dos Monos + Tribo Perfeita

SPA em **Vue 3 + Vite + Pinia + Tailwind CSS** para consultar perfil, maestrias e sinergia de composições de League of Legends com uma identidade visual cavernosa.

## 🛠️ Stack

- **Vue 3** com `<script setup>`
- **Vite** para desenvolvimento e build
- **Pinia** para estado global
- **Tailwind CSS** para o tema ancestral/cavernoso
- **Cloudflare Worker** como ponte para a Riot API

## 🧱 Estrutura

- `src/store/ugaStore.js` centraliza `currentTab`, `searchProfile`, `masteryDashboard`, `teamPlanner` e `telemetry`
- `src/utils/api.js` isola chamadas ao Worker e registra telemetria
- `src/components/ui/` contém wrappers e componentes genéricos (`StoneCard`, `ErrorBanner`, `LoadingOverlay`, `TelemetryWidget`, `ChampionAvatar`)
- `src/components/profile/`, `src/components/mastery/` e `src/components/synergy/` concentram os microcomponentes de domínio
- `src/views/` orquestra as abas `Home`, `Profile`, `Mastery` e `Synergy`

## ⚙️ Como rodar localmente

```bash
npm install
npm run dev
```

## �� Build de produção

```bash
npm run build
```

O deploy para GitHub Pages está configurado em `.github/workflows/deploy.yml`, e o domínio customizado é exportado via `public/CNAME`.

## 🔒 Worker / Riot API

O front-end usa o Worker configurado em `src/utils/helpers.js` (`WORKER_URL`) para evitar expor a chave da Riot API no navegador.
