import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useTilt3d } from '../tilt3d.js';

// Elemento falso: só precisa do rect e da API de captura de ponteiro.
function fakeAlvo(w = 300, h = 500) {
  const capturas = [];
  return {
    capturas,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    setPointerCapture: (id) => capturas.push(['capturou', id]),
    releasePointerCapture: (id) => capturas.push(['soltou', id])
  };
}
const ev = (alvo, x, y, pointerId = 1) => ({ currentTarget: alvo, clientX: x, clientY: y, pointerId });
const grau = (style, eixo) => Number((style.transform || '').match(new RegExp(`${eixo}\\(([-\\d.]+)deg`))?.[1] ?? 0);

test('hover (default): move o card só de passar o cursor', () => {
  const t = useTilt3d();
  const alvo = fakeAlvo();
  t.onMove(ev(alvo, 300, 0));                 // canto superior direito
  assert.ok(t.style.value.transform, 'inclinou no hover');
  assert.ok(grau(t.style.value, 'rotateY') > 0, 'gira para a direita');
  assert.ok(grau(t.style.value, 'rotateX') > 0, 'gira para cima');
  t.onLeave();
  assert.deepEqual(t.style.value, {}, 'volta ao lugar ao sair');
});

test('arrasto: passar o cursor NÃO move — só segurando', () => {
  const t = useTilt3d({ gesto: 'arrasto' });
  const alvo = fakeAlvo();

  t.onMove(ev(alvo, 300, 0));
  assert.deepEqual(t.style.value, {}, 'sem pressionar, o cursor não gira nada');

  t.onDown(ev(alvo, 150, 250));               // segurou no centro
  assert.equal(t.arrastando.value, true);
  assert.deepEqual(alvo.capturas[0], ['capturou', 1], 'captura o ponteiro ao segurar');
  assert.equal(grau(t.style.value, 'rotateY'), 0, 'no centro não há giro');

  t.onMove(ev(alvo, 300, 500));               // arrastou para o canto inferior direito
  assert.ok(grau(t.style.value, 'rotateY') > 0, 'segurando e arrastando, gira');
  assert.ok(grau(t.style.value, 'rotateX') < 0, 'arrastar para baixo inclina para baixo');
  assert.equal(t.style.value.transitionDuration, '0ms', 'segurando, o giro cola no ponteiro');

  t.onUp(ev(alvo, 300, 500));
  assert.equal(t.arrastando.value, false);
  assert.deepEqual(t.style.value, {}, 'ao soltar, volta ao lugar');
  assert.deepEqual(alvo.capturas[1], ['soltou', 1], 'devolve o ponteiro');
});

test('arrasto: sair do elemento segurando não solta a imagem', () => {
  const t = useTilt3d({ gesto: 'arrasto' });
  const alvo = fakeAlvo();
  t.onDown(ev(alvo, 150, 250));
  t.onMove(ev(alvo, 290, 40));
  const girado = t.style.value.transform;
  t.onLeave();
  assert.equal(t.style.value.transform, girado, 'continua girado enquanto segura');
  t.onUp(ev(alvo, 290, 40));
  assert.deepEqual(t.style.value, {});
});

test('arrasto: `arrastou` separa clique de giro (o clique não abre a arte à toa)', () => {
  const t = useTilt3d({ gesto: 'arrasto' });
  const alvo = fakeAlvo();

  // Clique seco: pressiona e solta no mesmo ponto.
  t.onDown(ev(alvo, 150, 250));
  t.onMove(ev(alvo, 151, 251));               // tremida da mão, abaixo do limiar
  t.onUp(ev(alvo, 151, 251));
  assert.equal(t.arrastou.value, false, 'tremida não conta como arrasto → clique vale');

  // Giro de verdade.
  t.onDown(ev(alvo, 150, 250));
  t.onMove(ev(alvo, 250, 250));
  t.onUp(ev(alvo, 250, 250));
  assert.equal(t.arrastou.value, true, 'arrastou → o clique deve ser ignorado');

  // Novo gesto zera a marca (senão o clique seguinte herdaria o arrasto anterior).
  t.onDown(ev(alvo, 150, 250));
  assert.equal(t.arrastou.value, false);
});

test('arrasto: soltar sem ter segurado não quebra nem zera à toa', () => {
  const t = useTilt3d({ gesto: 'arrasto' });
  const alvo = fakeAlvo();
  t.onUp(ev(alvo, 10, 10));                   // pointerup órfão
  assert.deepEqual(t.style.value, {});
  assert.equal(t.arrastando.value, false);
});

test('brilho: só acompanha o ponteiro quando pedido', () => {
  const alvo = fakeAlvo();
  const comBrilho = useTilt3d({ gesto: 'arrasto' });
  comBrilho.onDown(ev(alvo, 300, 500));
  assert.equal(comBrilho.style.value['--brilho-x'], '100.0%');
  assert.equal(comBrilho.style.value['--brilho-y'], '100.0%');

  const semBrilho = useTilt3d({ gesto: 'arrasto', brilho: false });
  semBrilho.onDown(ev(alvo, 300, 500));
  assert.equal(semBrilho.style.value['--brilho-x'], undefined);
});
