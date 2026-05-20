# Plano: UGA BUGA Ancestral Theme Overhaul (Phase 3)

## TL;DR
Redesign total com tema ancestral/cavernas do Udyr. 6 fases cobrindo: Home (hover wallpaper + animação de abertura), overlay (Uga/Buga flutuantes + texto ancestral + Udyr correndo), Profile (skeleton state), nav botões temáticos, Mastery (busca própria + redesign remainder), Synergy (grid de cards de maestria + select dropdown).

---

## FASE A — index.html (fundação global)

**A1. Título**
- `<title>` → `"UGA BUGA Infos + Caverna do Time Perfeito"`
- Header `<h1>` span → `"UGA BUGA Infos + Caverna do Time Perfeito"`

**A2. Bloco `<style>` (após cdn tailwind)**
Adicionar keyframes:
- `@keyframes float-fade` — para palavras Uga/Buga (opacity 0→1→0 com translateY subindo + scale)
- `@keyframes udyr-run` — translateX de -250px até 110vw, fade in rápido, fade out no final
- `@keyframes card-ripple-expand` — translate(-50%,-50%) scale(0→200), border-radius 50%→0

**A3. Cinematic overlay**
- Texto mudar: `"Buscando as informações com os espiritos ancestrais. UGA BUGA"` (substituir "EXTRAINDO DADOS TÁTICOS...")
- Adicionar 10 spans absolutos com posições % aleatórias, textos variando "Uga", "Buga", "UGA", "BUGA", "UGA BUGA" com `animation: float-fade Xs ease-in-out infinite` com `animation-delay` escalonado

**A4. Udyr runner div**
```html
<div id="udyr-runner" class="pointer-events-none fixed bottom-0 z-[60] hidden h-64 w-64" style="...">
  <img src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_4.jpg" class="h-full w-full object-cover object-left" />
</div>
```

**A5. Card ripple overlay**
```html
<div id="card-ripple" class="pointer-events-none fixed z-[55] hidden" style="border-radius:50%; transform:translate(-50%,-50%) scale(0)"></div>
```

---

## FASE B — Home.js

**B1. Camadas de fundo (4 divs)**
- `id="home-bg-0"` → Udyr_0.jpg — opacity 40%, transition-opacity 500ms, sempre visível por padrão
- `id="home-bg-1"` → Udyr_2.jpg (Spirit Guard, Perfil)
- `id="home-bg-2"` → Udyr_3.jpg (Maestria)
- `id="home-bg-3"` → Udyr_4.jpg (Sinergia)
- Todos `absolute inset-0 bg-cover bg-center opacity-0 transition-[opacity] duration-500`
- `home-bg-0` starts `opacity-40`

**B2. Cards maiores**
- Padding: `p-8 sm:p-10` (era `p-6`)
- Min-height do container: `min-h-[80vh]`
- Cards: `min-h-[220px]` com `gap-6 lg:gap-8`
- Fontes maiores: título card `text-4xl → text-5xl`

**B3. Novos títulos dos cards**
- Card 1: `"Uga Perfil"` + `"Informações do Jogador"`
- Card 2: `"Buga Especialidades"` + `"Maestrias do Jogador"`
- Card 3: `"UGA BUGA Time Perfeito"` + `"Monte sua composição com sinergia ancestral"`

**B4. data-action="nav-card" nos cards**
Cada card: trocar `data-action="switch-tab"` → `data-action="nav-card"`, manter `data-tab="..."`, adicionar `data-color` hex para o ripple:
- perfil: `#1e3a5f`
- maestria: `#3b1f05`
- sinergia: `#0f2e1e`

**B5. Hover logic (JS após innerHTML)**
Após `section.innerHTML = ...`:
```js
const cards = section.querySelectorAll('[data-action="nav-card"]');
const bgs = [0,1,2,3].map(i => section.querySelector(`#home-bg-${i}`));
const cardBgMap = { perfil: 1, maestria: 2, sinergia: 3 };
cards.forEach(card => {
  card.addEventListener('mouseenter', () => {
    bgs[0].style.opacity = '0';
    bgs[cardBgMap[card.dataset.tab]].style.opacity = '0.45';
  });
  card.addEventListener('mouseleave', () => {
    bgs[0].style.opacity = '0.4';
    bgs[cardBgMap[card.dataset.tab]].style.opacity = '0';
  });
});
```

---

## FASE C — main.js

**C1. Handler "nav-card" (animação ripple + mudança de tab)**
```js
if (action === 'nav-card') {
  const rect = target.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const ripple = document.getElementById('card-ripple');
  ripple.style.cssText = `left:${cx}px; top:${cy}px; width:10px; height:10px; background:${target.dataset.color || '#1e3a5f'}; border-radius:50%; transform:translate(-50%,-50%) scale(0); transition: transform 450ms ease-in, border-radius 450ms ease-in;`;
  ripple.classList.remove('hidden');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ripple.style.transform = 'translate(-50%,-50%) scale(250)';
      ripple.style.borderRadius = '0';
    });
  });
  setTimeout(() => {
    updateState('currentTab', target.dataset.tab);
    ripple.classList.add('hidden');
    ripple.style.transform = 'translate(-50%,-50%) scale(0)';
    ripple.style.borderRadius = '50%';
  }, 420);
}
```

**C2. renderTabsNav — botões temáticos**
Cada tab recebe cor distinta + emoji:
- 🏠 home: `border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-700`
- ⚔️ perfil: `border-cyan-700/50 bg-blue-900/50 text-cyan-200 hover:bg-blue-800/60`
- 🏆 maestria: `border-amber-700/50 bg-orange-950/50 text-amber-200 hover:bg-orange-900/60`
- 🔮 sinergia: `border-lime-700/50 bg-emerald-950/50 text-lime-200 hover:bg-emerald-900/60`
- Ativo: borda sólida + shadow glow + `scale-[1.05]`

**C3. Adicionar `change` listener para dropdown Sinergia**
```js
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.action === 'slot-select-dropdown') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === Number(t.dataset.id));
    if (idx >= 0 && t.value) updateState(`teamPlanner.slots.${idx}.championSelected`, t.value);
  }
});
```

**C4. Submit listener para mastery-search-form**
```js
if (e.target.id === 'mastery-search-form') handleMasteryOnlySearch(e);
```
Import `handleMasteryOnlySearch` from `./components/Mastery.js`

---

## FASE D — Profile.js

**D1. searchProfile.loading em handleProfileSearch**
- Adicionar `updateState('searchProfile.loading', true)` ANTES do Promise.all
- `updateState('searchProfile.loading', false)` já existe no finally

**D2. Formulário de busca sempre visível (não condicional)**
Remover a lógica de `flex min-h-[60vh] items-center justify-center`. O form fica sempre no topo.

**D3. Skeleton state (3 situações)**
- `loading=true`: form grande + banner cyan pulsante "Buscando as informações com os espiritos ancestrais. UGA BUGA" + layout esqueleto `animate-pulse bg-slate-800` (header card, stats card, 5 match placeholders)
- `!hasProfile && !loading`: form grande + mesmo skeleton sem banner, em `bg-slate-900/30` mais escuro
- `hasProfile`: layout normal atual

**D4. Trigger Udyr runner**
Em `handleProfileSearch`, após `await Promise.all([...])` e antes de fechar o overlay:
```js
const runner = document.getElementById('udyr-runner');
runner.style.cssText = 'left: -260px; bottom: 60px; animation: udyr-run 1.6s ease-in-out forwards;';
runner.classList.remove('hidden');
setTimeout(() => runner.classList.add('hidden'), 1700);
```

---

## FASE E — Mastery.js

**E1. Nova função exportada `handleMasteryOnlySearch(event)`**
- `event.preventDefault()`
- Parse `gameName#tagLine` do input `#mastery-summoner`
- `updateState('masteryDashboard.loading', true)`
- `await workerRequest('masteries', { gameName, tagLine })`
- `state.masteryDashboard.allMasteries = data.masteries.map(fromStaticChamp)`
- `updateState('masteryDashboard.loading', false)`
- **Não altera `searchProfile`**

**E2. Formulário no topo da aba Maestria**
- Quando `!searchProfile.puuid`: mostrar formulário `id="mastery-search-form"` como tela principal (em vez da mensagem de erro)
- Quando `searchProfile.puuid` existe: form menor/colapsado acima dos cards de dados

**E3. Top 15 cards maiores**
De: `p-3 h-12 w-12 text-sm`
Para: `p-4 h-16 w-16 text-base` + nome `text-sm font-semibold` + pontos `text-xs`

**E4. Remainder grid redesign**
De: `grid grid-cols-10 gap-1.5` com `h-8 w-8` icon button only
Para: `grid grid-cols-10 gap-1.5`, cada item é `<article>` com:
```html
<article data-action="show-tooltip" data-name="..." data-level="..." data-points="..."
  class="flex flex-col items-center gap-0.5 rounded-md border border-slate-800/70 bg-slate-950/60 p-1.5 cursor-pointer hover:border-slate-600">
  <img class="h-8 w-8 rounded object-cover" src="..." />
  <p class="w-full truncate text-center text-[9px] text-slate-200">${name}</p>
  <p class="text-[8px] font-bold text-amber-400">M${level}</p>
</article>
```

---

## FASE F — Synergy.js

**F1. `handleSlotFetch` — top 15**
`.slice(0, 10)` → `.slice(0, 15)`

**F2. `renderComfortZone` — grid 5×3 mastery cards + select dropdown**
```html
<div class="col-span-5 space-y-2">
  <div class="grid grid-cols-5 gap-1.5">
    ${slot.masteryChoices.map((entry, idx) => `
      <button type="button"
        data-action="slot-select-mastery"
        data-id="${slot.id}"
        data-name="${entry.championName}"
        class="flex flex-col items-center gap-0.5 rounded-lg border p-1.5 transition
          ${slot.championSelected === entry.championName
            ? 'border-cyan-500 bg-cyan-950/40 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
            : 'border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-800/60'}">
        <img class="h-10 w-10 rounded-md border border-slate-700 object-cover"
          src="${championImage(entry.championName)}" loading="lazy" />
        <p class="w-full truncate text-center text-[9px] font-semibold text-slate-200">${entry.championName}</p>
        <p class="text-[8px] font-bold text-amber-400">M${entry.championLevel}</p>
      </button>
    `).join('')}
  </div>
  <select data-action="slot-select-dropdown" data-id="${slot.id}"
    class="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none">
    <option value="">Escolher outro campeão...</option>
    ${state.staticData.championList
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${c.name}" ${slot.championSelected === c.name ? 'selected' : ''}>${c.name}</option>`)
      .join('')}
  </select>
</div>
```

---

## Arquivos Modificados

| Arquivo | Principais mudanças |
|---|---|
| `index.html` | Title, h1, `<style>` keyframes, overlay texto+spans UgaBuga, `#udyr-runner`, `#card-ripple` |
| `js/components/Home.js` | 4 bg layers, cards maiores, novos títulos, `nav-card` action, hover JS |
| `js/main.js` | `nav-card` ripple handler, `renderTabsNav` temático, `change` listener, import `handleMasteryOnlySearch` |
| `js/components/Profile.js` | `loading=true` no início, skeleton 3 estados, form sempre visível, trigger Udyr runner |
| `js/components/Mastery.js` | `handleMasteryOnlySearch` export, form no topo, top15 maiores, remainder redesign |
| `js/components/Synergy.js` | `slice(0,15)`, grid 5×3 mastery cards, `<select>` dropdown |

---

## Checklist de Verificação

- [ ] Home: hover card → wallpaper muda suavemente (500ms transition)
- [ ] Home: click card → ripple expande cobrindo tela (~450ms) → tab muda
- [ ] Buscar perfil → overlay mostra "Buscando com espíritos ancestrais" + Uga/Buga flutuantes
- [ ] Após busca → Udyr_4.jpg corre da esquerda para direita (1.6s)
- [ ] Profile sem perfil → form + skeleton escuro
- [ ] Profile carregando → form + skeleton + banner pulsante cyan
- [ ] Mastery tab: busca própria atualiza só `masteryDashboard`
- [ ] Top 15 cards: `h-16 w-16` visivelmente maiores
- [ ] Remainder: 10 por linha, ícone + nome + M level
- [ ] Nav: gradientes coloridos por tab + emojis + scale no ativo
- [ ] Synergy profile mode: grid 5×3 mastery cards + select com todos os campeões

---

## Decisões Tomadas

| Decisão | Escolha |
|---|---|
| Skins Udyr por estado | `_0`=default, `_2`=Spirit Guard(Perfil), `_3`=Maestria, `_4`=Primal/antigo(Sinergia) |
| Animação ao clicar card | Zoom-to-fill ripple ~450ms |
| Udyr ao carregar dados | translateX left→right 1.6s |
| Busca na aba Maestria | Atualiza só `masteryDashboard` (não `searchProfile`) |
| Float-fade Uga/Buga | Dentro do `#cinematic-overlay` (não solto na página) |
