import { ref } from 'vue';

/**
 * Inclinação 3D acompanhando o cursor (efeito "hover-3d").
 *
 * Equivale ao componente hover-3d do daisyUI, mas SEM a dependência e sem o limite
 * que ele tem: o daisyUI faz o efeito com 8 divs de zona sobrepostos ao conteúdo e a
 * própria doc dele avisa para não colocar nada clicável dentro. Nossos cards são
 * `<button>` com clique e popover no hover — as zonas comeriam os dois eventos.
 * Com o pointermove aqui o card continua clicável e o giro é contínuo, em vez de
 * quantizado nas 8 direções da grade 3x3.
 *
 * Dois gestos (`gesto`):
 *   'hover'   (default) — gira só de passar o mouse; solta ao sair. É o do card de
 *                         skin da ficha, que gira sozinho sob o cursor.
 *   'arrasto'           — gira só enquanto o ponteiro está PRESSIONADO em cima, como
 *                         se estivesse segurando a imagem; ao soltar, volta ao lugar.
 *                         É o da arte ampliada, onde girar é ação deliberada.
 *
 * Devolve `{ style, onMove, onLeave, onDown, onUp, arrastando, arrastou }`:
 *   hover:   `:style="style"` + `@mousemove="onMove"` + `@mouseleave="onLeave"`.
 *   arrasto: `:style="style"` + `@pointerdown="onDown"` + `@pointermove="onMove"` +
 *            `@pointerup="onUp"` + `@pointercancel="onUp"`.
 * `arrastou` diz se o último gesto teve movimento de verdade — serve para o elemento
 * não disparar o `click` quando a intenção era só girar.
 */
export function useTilt3d({ max = 10, scale = 1.04, brilho = true, gesto = 'hover' } = {}) {
  const style = ref({});
  const arrastando = ref(false);
  const arrastou = ref(false);
  const soArrastando = gesto === 'arrasto';
  // Folga em px antes de considerar "arrastou" (tremida da mão não vira arrasto).
  const LIMIAR = 4;
  let inicioX = 0;
  let inicioY = 0;

  // Respeita quem pediu menos animação no sistema (acessibilidade).
  const reduzido = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function aplicar(event) {
    const el = event.currentTarget;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;

    // -0.5 (topo/esquerda) .. +0.5 (base/direita)
    const px = (event.clientX - r.left) / r.width - 0.5;
    const py = (event.clientY - r.top) / r.height - 0.5;

    style.value = {
      transform: `perspective(75rem) rotateX(${(-py * 2 * max).toFixed(2)}deg) rotateY(${(px * 2 * max).toFixed(2)}deg) scale(${scale})`,
      // Segurando, o giro tem de colar no ponteiro — a transição da classe só vale
      // para a volta ao lugar, quando soltar.
      ...(soArrastando ? { transitionDuration: '0ms' } : {}),
      ...(brilho ? { '--brilho-x': `${((px + 0.5) * 100).toFixed(1)}%`, '--brilho-y': `${((py + 0.5) * 100).toFixed(1)}%` } : {})
    };
  }

  function onMove(event) {
    if (reduzido) return;
    if (soArrastando && !arrastando.value) return;
    if (arrastando.value && !arrastou.value
      && Math.hypot(event.clientX - inicioX, event.clientY - inicioY) > LIMIAR) {
      arrastou.value = true;
    }
    aplicar(event);
  }

  // Pega o ponteiro: continua girando mesmo se o cursor sair do elemento, e só
  // devolve no soltar — é o que dá a sensação de estar segurando a imagem.
  function onDown(event) {
    if (reduzido || !soArrastando) return;
    arrastando.value = true;
    arrastou.value = false;
    inicioX = event.clientX;
    inicioY = event.clientY;
    try { event.currentTarget?.setPointerCapture?.(event.pointerId); } catch { /* sem captura, tudo bem */ }
    aplicar(event);
  }

  function onUp(event) {
    if (!soArrastando || !arrastando.value) return;
    arrastando.value = false;
    try { event?.currentTarget?.releasePointerCapture?.(event.pointerId); } catch { /* já solto */ }
    style.value = {};
  }

  function onLeave() {
    if (arrastando.value) return;   // segurando: sair do elemento não solta
    style.value = {};
  }

  return { style, onMove, onLeave, onDown, onUp, arrastando, arrastou };
}
