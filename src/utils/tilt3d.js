import { ref } from 'vue';

/**
 * Inclinação 3D no hover, acompanhando o cursor (efeito "hover-3d").
 *
 * Equivale ao componente hover-3d do daisyUI, mas SEM a dependência e sem o limite
 * que ele tem: o daisyUI faz o efeito com 8 divs de zona sobrepostos ao conteúdo e a
 * própria doc dele avisa para não colocar nada clicável dentro. Nossos cards são
 * `<button>` com clique e popover no hover — as zonas comeriam os dois eventos.
 * Com o mousemove aqui o card continua clicável e o giro é contínuo, em vez de
 * quantizado nas 8 direções da grade 3x3.
 *
 * Devolve `{ style, onMove, onLeave }`: ligue `@mousemove="onMove"`,
 * `@mouseleave="onLeave"` e `:style="style"` no elemento.
 */
export function useTilt3d({ max = 10, scale = 1.04, brilho = true } = {}) {
  const style = ref({});

  // Respeita quem pediu menos animação no sistema (acessibilidade).
  const reduzido = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function onMove(event) {
    if (reduzido) return;
    const el = event.currentTarget;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;

    // -0.5 (topo/esquerda) .. +0.5 (base/direita)
    const px = (event.clientX - r.left) / r.width - 0.5;
    const py = (event.clientY - r.top) / r.height - 0.5;

    style.value = {
      transform: `perspective(75rem) rotateX(${(-py * 2 * max).toFixed(2)}deg) rotateY(${(px * 2 * max).toFixed(2)}deg) scale(${scale})`,
      ...(brilho ? { '--brilho-x': `${((px + 0.5) * 100).toFixed(1)}%`, '--brilho-y': `${((py + 0.5) * 100).toFixed(1)}%` } : {})
    };
  }

  function onLeave() {
    style.value = {};
  }

  return { style, onMove, onLeave };
}
