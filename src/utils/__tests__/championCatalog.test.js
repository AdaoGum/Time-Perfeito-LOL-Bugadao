import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalChampionList, getChampionIdFromName } from '../../utils.js';

// O champion.json do patch 16.15 publica cópias dos campeões (Jade_*, key 60000+key)
// com o MESMO nome de exibição. Elas viravam card repetido no Panteão, podiam ganhar
// o índice por nome e levavam a URL da ficha para /ficha/Jade_Brand.
test('canonicalChampionList: cópia com key inflada não entra na lista', () => {
  const bruto = [
    { id: 'Brand', key: '63', name: 'Brand' },
    { id: 'Jade_Brand', key: '60063', name: 'Brand' },
    { id: 'Ahri', key: '103', name: 'Ahri' }
  ];

  const lista = canonicalChampionList(bruto);

  assert.equal(lista.length, 2);
  assert.deepEqual(lista.map((c) => c.id).sort(), ['Ahri', 'Brand']);
});

test('canonicalChampionList: fica a entrada de MENOR key, venha na ordem que vier', () => {
  const copiaPrimeiro = canonicalChampionList([
    { id: 'Jade_Ahri', key: '60103', name: 'Ahri' },
    { id: 'Ahri', key: '103', name: 'Ahri' }
  ]);

  assert.equal(copiaPrimeiro.length, 1);
  assert.equal(copiaPrimeiro[0].id, 'Ahri');
});

test('canonicalChampionList: entrada furada é descartada em vez de quebrar', () => {
  const lista = canonicalChampionList([{ id: 'Vazio', key: '1' }, null, { id: 'Ahri', key: '103', name: 'Ahri' }]);

  assert.deepEqual(lista.map((c) => c.id), ['Ahri']);
  assert.deepEqual(canonicalChampionList(null), []);
});

// As URLs de arte são montadas a partir do NOME, então o id derivado precisa bater
// com o do DDragon; os nomes que divergem têm override.
test('getChampionIdFromName: nomes com espaço/apóstrofo viram id do DDragon', () => {
  assert.equal(getChampionIdFromName('Wukong'), 'MonkeyKing');
  assert.equal(getChampionIdFromName("Cho'Gath"), 'Chogath');
  assert.equal(getChampionIdFromName('Dr. Mundo'), 'DrMundo');
  assert.equal(getChampionIdFromName('Lee Sin'), 'LeeSin');
  assert.equal(getChampionIdFromName('Brand'), 'Brand');
});

// Rótulos pt_BR que não viram o id do DDragon só tirando espaço/pontuação — sem o
// override a arte deles dá 404 em todo card e ficha.
test('getChampionIdFromName: rótulos pt_BR divergentes têm override', () => {
  assert.equal(getChampionIdFromName('Bardo'), 'Bard');
  assert.equal(getChampionIdFromName('Nunu e Willump'), 'Nunu');
  assert.equal(getChampionIdFromName('Renata Glasc'), 'Renata');
});
