# 🗺️ Mapa de Contexto Técnico - Time Perfeito LoL (Uga Buga Analytics)

Este documento serve como fonte única de verdade (SSOT) de contexto para Modelos de Linguagem (LLMs), Copilots e assistentes de código. Ele descreve a arquitetura do projeto e estabelece regras restritas para evitar quebras de build no Vite ou regressões lógicas.

---

## 🛠️ Stack Tecnológica & Infraestrutura
- **Frontend:** Vue 3 (Composition API com `<script setup>`) + Vite + Tailwind CSS.
- **Roteamento Interno:** Atualmente gerenciado via estado reativo de abas (`state.currentTab` na store). Não utiliza Vue Router ainda.
- **Estado Global:** Objeto reativo nativo do Vue em `src/store.js` (Não utiliza Pinia ou Vuex).
- **Backend/API:** Cloudflare Worker (`worker.js`) consumindo diretamente a API Oficial da Riot Games (Rotas Americas e BR1).

---

## 📂 Árvore de Diretórios e Fluxo de Dependências

```text
raiz-do-projeto/
├── assets/                     # Pasta de recursos estáticos na raiz (brasões de elo)
├── src/                        # Código fonte da aplicação Vue
│   ├── components/             # Componentes modulares da interface
│   │   ├── Home.vue            # Templo Ancestral (Homepage com as 4 posturas do Udyr)
│   │   ├── Profile.vue         # Caçada (Painel principal do jogador e histórico avançado)
│   │   ├── ProfileCard.Vue     # Card persistente flutuante (Superior Esquerdo)
│   │   ├── Mastery.vue         # Caverna Monos (Painel tático de maestrias e rankings)
│   │   ├── Synergy.vue         # Tribo Perfeita (Simulador de composições e rotas)
│   │   └── SearchBar.vue       # Barra de busca global com monitor de telemetria
│   ├── App.vue                 # Orquestrador da Interface, Overlays, Widgets e Animações
│   ├── store.js                # Estado global compartilhado reativo (state)
│   ├── api.js                  # Handler assíncrono de requisições para o Worker
│   ├── utils.js                # Helpers de imagens do DDragon, constantes de versão e KDA
│   └── main.js                 # Inicializador padrão da aplicação Vue 3
└── worker.js                   # Código JavaScript implantado na infraestrutura Cloudflare