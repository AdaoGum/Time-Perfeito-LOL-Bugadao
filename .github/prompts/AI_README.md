# 🗺️ Mapa de Contexto Técnico - bUGAdão Analytics (Time Perfeito LoL)

Este documento é a Fonte Única de Verdade (SSOT) de contexto técnico para Modelos de Linguagem (LLMs), Copilots, Cursor e agentes de IA. Ele descreve detalhadamente a arquitetura atualizada do ecossistema, regras de negócio e o modelo relacional de banco de dados para evitar alucinações, quebras de build ou regressões lógicas.

---

## 🛠️ 1. Stack Tecnológica & Infraestrutura

- **Frontend:** Vue 3 (Composition API com `<script setup>`) + Vite + Tailwind CSS v4.
- **Roteamento Interno:** Gerenciado via estado reativo de abas (`state.currentTab` na store global) ou integrado nativamente com `vue-router` conforme regras do `AI_ROUTING_PLANNER.md`.
- **Estado Global:** Objeto reativo nativo do Vue em `src/store.js`. **PROIBIDO** introduzir Pinia, Vuex ou outras dependências de estado sem autorização.
- **Backend/API:** Cloudflare Worker (`worker.js`) atuando como Proxy Reverso Seguro. Protege a `RIOT_API_KEY`, gerencia o CORS e centraliza requisições para as rotas da Riot Games (`br1` e `americas`).
- **Banco de Dados:** Cloudflare D1 (Motor SQLite nativo serverless de alta performance).
- **Automação/Ingestão:** GitHub Actions rodando o script "Trator da Madrugada" (`cron/sync.js`).

---

## 📂 2. Árvore de Diretórios e Fluxo de Dependências

```text
raiz-do-projeto/
├── assets/                     # Recursos estáticos de imagem (Brasões de elo, etc.)
├── src/                        # Código-fonte da aplicação Vue
│   ├── components/             # Componentes modulares da interface
│   │   ├── Home.vue            # Templo Ancestral (Homepage com as posturas do Udyr)
│   │   ├── Profile.vue         # Caçada (Painel do jogador, histórico e abas Solo/Flex/Outros)
│   │   ├── Mastery.vue         # Caverna dos Monos (Grades de maestrias e tooltips)
│   │   └── Tribo.vue           # Planejador de Equipes (Sinergia Engine v2 e Lobbies 5v5)
│   ├── App.vue                 # Orquestrador da Interface, Overlays e Widgets
│   ├── store.js                # Estado global compartilhado reativo (state)
│   ├── api.js                  # Handler assíncrono de requisições para o Worker
│   └── utils.js                # Helpers do Data Dragon, conversão de KDA e tempo
├── cron/
│   └── sync.js                 # O "Trator" (Script oficial de sincronização da madrugada)
├── worker.js                   # Back-end oficial rodando na Cloudflare (Proxy + D1 SQL)
└── AI_README.md                # Este documento (Contexto do Agente de IA)