Pesquise na web o tier list atual de League of Legends para Ranked Solo Queue,
no patch mais recente disponível. Consulte fontes de referência de meta
(ex.: u.gg, op.gg, lolalytics, Mobalytics) e consolide num consenso.

Me devolva um ARQUIVO CSV para download com EXATAMENTE este formato (cabeçalho de
6 colunas; as 3 últimas são as estatísticas do campeão):

champion,role,tier,winrate,pickrate,banrate
Aatrox,TOP,A,49.8,6.2,3.1
Ahri,MID,S,51.2,7.1,3.4
...

Regras obrigatórias:
- Coluna "champion": nome em inglês EXATAMENTE como no Data Dragon da Riot
  (ex.: "Kai'Sa", "Wukong", "Nunu & Willump", "Bel'Veth", "Dr. Mundo").
- Coluna "role": uma de TOP, JUNGLE, MID, ADC, SUP.
  Mapeie BOTTOM->ADC, UTILITY/SUPPORT->SUP, MIDDLE->MID.
- Coluna "tier": uma de S, A, B, C, D (S = melhor do patch).
- Colunas "winrate", "pickrate", "banrate": percentuais SEM o símbolo "%"
  (ex.: 52.3). Se não encontrar o dado de uma célula, DEIXE VAZIA — nunca invente
  um número. (O app aceita o formato antigo de 3 colunas e mostra "—" quando falta.)
- Uma linha por combinação campeão+rota. Se um campeão é forte em mais de
  uma rota, gere uma linha para cada rota.
- Inclua apenas campeões com tier razoavelmente conhecido no patch.
- Não inclua texto fora do CSV no arquivo. Sem markdown, sem comentários.

Além do CSV, para os campeões de tier S e A, me diga (em uma seção à parte, fora do
CSV) a BUILD PRINCIPAL do meta no patch: os itens mirados (na ordem: item mítico/core →
botas → situacionais, ~6 itens) e as runas principais. Use os nomes de item EXATAMENTE
como no Data Dragon (pt_BR) para eu conseguir mapear para os IDs depois.

Antes de tudo, me diga em uma linha qual é o número do patch que você usou
como referência (ex.: "Patch 16.11") e a data da consulta.
