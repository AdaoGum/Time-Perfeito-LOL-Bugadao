# 🗺️ AI Agent Planner: Migração para Rotas Dinâmicas (Vue Router)

Este plano estruturado foi projetado para ser consumido e executado por Agentes de IA ou Copilots. Ele instrui o agente a quebrar a refatoração do estado reativo estático (`state.currentTab`) para uma arquitetura de rotas legítima usando `vue-router` no projeto **Time Perfeito LoL (Bugadão)**.

---

## 🛠️ Visão Geral do Estado Atual vs. Estado Alvo

### Atual:
O ecossistema utiliza troca de abas baseada em estado reativo na store (`src/store.js` -> `state.currentTab`), impedindo o uso dos botões de avançar/voltar do navegador e impossibilitando o compartilhamento de URLs diretas para perfis ou ferramentas.

### Alvo:
- `/` -> `Home.vue` (Templo Ancestral)
- `/profile` -> `Profile.vue` (A Caçada) com sub-rotas ou parâmetros reativos.
- `/mastery` -> `Mastery.vue` (Caverna dos Monos)
- `/synergy` -> `Synergy.vue` (A Tribo Perfeita)

---

## 📅 Sequência do Plano de Execução (Fases de Engenharia)

### FASE 1: Instalação e Infraestrutura de Rotas
1. **Instalar Dependência:** Executar `npm install vue-router@4`.
2. **Criar Configuração de Rotas:** Criar o arquivo `src/router.js` com o seguinte mapeamento de componentes:
   - `path: '/'`, `component: Home`
   - `path: '/profile'`, `component: Profile`
   - `path: '/mastery'`, `component: Mastery`
   - `path: '/synergy'`, `component: Synergy`
3. **Acoplamento no Entrypoint:** Modificar `src/main.js` para importar o roteador e acoplá-lo na instância do Vue através de `.use(router)`.

### FASE 2: Adaptação do Estado Global (`src/store.js`)
1. **Eliminação de Acoplamento:** Remover ou depreciar gradativamente a propriedade `currentTab` de dentro do objeto `state`.
2. **Adaptação Tática:** Onde houver checagem de `state.currentTab`, ela deve ser substituída por lógicas nativas do `useRoute()`.

### FASE 3: Refatoração do Orquestrador (`src/App.vue`)
1. **Substituição do Renderizador Condicional:** Substituir as diretivas estruturais `v-if="store.currentTab === '... '"` pelo componente global `<router-view />`.
2. **Gerenciamento de Transição de Fundo:** Mover os gatilhos visuais das posturas do Udyr para reagirem ao gancho `watch` observando as mudanças em `$route.path`, mantendo o efeito imersivo de troca de opacidade dos backgrounds.

### FASE 4: Correção de Navegação nos Componentes Infantis
1. Substituir os disparadores manuais de clique (Ex: `@click="store.currentTab = 'profile'"`) em todos os botões por tags semânticas `<router-link to="/profile">` ou navegação programática via `router.push()`.

---

## 🛑 Regras de Restrição Técnicas (Travas de Segurança)
- **Não quebrar os imports relativos:** Mantenha a convenção de imports já mapeada no `AI_README.md`.
- **Manter Reatividade da Telemetria:** O componente `SearchBar.vue` injeta dados na store global para alimentar o painel de limites de requisições (`store.telemetry`). A navegação não pode resetar esse estado.
- **Evitar Perda de Estado de Busca:** Ao mudar de rota para `/mastery`, o componente deve conseguir ler o invocador pesquisado anteriormente se ele estiver salvo em `store.searchProfile.puuid`.

---
*Assinado pelo Arquiteto de Sistemas - Pronto para Consumo por Agentes de IA.*
