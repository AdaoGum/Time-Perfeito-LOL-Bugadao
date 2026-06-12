Pesquise na web o tier list atual de League of Legends para Ranked Solo Queue,
no patch mais recente disponível. Consulte fontes de referência de meta
(ex.: u.gg, op.gg, lolalytics, Mobalytics) e consolide num consenso.

Me devolva um ARQUIVO CSV para download com EXATAMENTE este formato:

champion,role,tier
Aatrox,TOP,A
Ahri,MID,S
...

Regras obrigatórias:
- Coluna "champion": nome em inglês EXATAMENTE como no Data Dragon da Riot
  (ex.: "Kai'Sa", "Wukong", "Nunu & Willump", "Bel'Veth", "Dr. Mundo").
- Coluna "role": uma de TOP, JUNGLE, MID, ADC, SUP.
  Mapeie BOTTOM->ADC, UTILITY/SUPPORT->SUP, MIDDLE->MID.
- Coluna "tier": uma de S, A, B, C, D (S = melhor do patch).
- Uma linha por combinação campeão+rota. Se um campeão é forte em mais de
  uma rota, gere uma linha para cada rota.
- Inclua apenas campeões com tier razoavelmente conhecido no patch.
- Não inclua texto fora do CSV no arquivo. Sem markdown, sem comentários.

Antes do arquivo, me diga em uma linha qual é o número do patch que você usou
como referência (ex.: "Patch 16.11") e a data da consulta.