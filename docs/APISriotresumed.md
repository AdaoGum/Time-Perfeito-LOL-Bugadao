
# Compêndio Ancestral: Endpoints da Riot Games (LoL)

## Categoria: ACCOUNT-V1 (Contas Riot)
### 1. `/riot/account/v1/accounts/by-puuid/{puuid}`
* **Entrada:** `puuid` (String).
* **Retorno:** Riot ID (gameName e tagLine) e o próprio PUUID.
* **Significado:** Busca o nome atual do jogador usando o ID imutável dele.

### 2. `/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`
* **Entrada:** `gameName` e `tagLine`.
* **Retorno:** PUUID, gameName e tagLine.
* **Significado:** Ponto de entrada padrão do sistema. Converte o Nickname+TAG no PUUID da conta.

### 3. `/riot/account/v1/accounts/me`
* **Entrada:** Token de autorização (RSO - Riot Sign On).
* **Retorno:** PUUID e Riot ID.
* **Significado:** Retorna os dados do jogador que está logado no seu aplicativo (requer login via Riot).

### 4. `/riot/account/v1/active-shards/by-game/{game}/by-puuid/{puuid}`
* **Entrada:** `game` (ex: "val" ou "lor") e `puuid`.
* **Retorno:** O shard (região base) do jogador, como `br1` ou `na1`.
* **Significado:** Usado para saber em qual servidor do mundo aquele PUUID joga Valorant ou Legends of Runeterra.

## Categoria: SUMMONER-V4 (Dados Base do LoL)
### 5. `/lol/summoner/v4/summoners/by-puuid/{puuid}`
* **Entrada:** `puuid`.
* **Retorno:** `id` (SummonerID), `accountId`, `profileIconId`, `summonerLevel`.
* **Significado:** A API mais importante do LoL. Pega o ícone, nível da conta e os IDs antigos necessários para ver o Elo.

### 6. `/lol/summoner/v4/summoners/{encryptedSummonerId}`
* **Entrada:** `encryptedSummonerId` (String curta).
* **Retorno:** Dados completos do invocador (ícone, nível, puuid).
* **Significado:** Busca a conta usando o ID antigo (útil quando outras APIs te retornam apenas o SummonerID e você precisa do PUUID).

### 7. `/lol/summoner/v4/summoners/by-account/{encryptedAccountId}`
* **Entrada:** `encryptedAccountId`.
* **Retorno:** Dados completos do invocador.
* **Significado:** Rota legada para buscar contas usando o ID de Conta (AccountId).

## Categoria: LOL-STATUS-V4 (Saúde do Servidor)
### 8. `/lol/status/v4/platform-data`
* **Entrada:** Nenhuma.
* **Retorno:** Um array detalhado de incidentes, manutenções, e status de serviços (Client, LoL, Loja).
* **Significado:** Permite criar um alerta no site caso o servidor BR esteja fora do ar ou em manutenção.


## Categoria: MATCH-V5 (Histórico e Detalhes)
### 9. `/lol/match/v5/matches/by-puuid/{puuid}/ids`
* **Entrada:** `puuid`. Opcionais: `startTime`, `endTime`, `queue`, `type`, `start`, `count`.
* **Retorno:** Array de strings (ex: `["BR1_123", "BR1_124"]`).
* **Significado:** Retorna a lista de "códigos" das partidas que o jogador jogou.

### 10. `/lol/match/v5/matches/{matchId}`
* **Entrada:** `matchId`.
* **Retorno:** JSON massivo com todos os dados: quem jogou, quem venceu, KDA, dano, ouro, dragões.
* **Significado:** Abre a partida. É daqui que extraímos se foi vitória ou derrota e quem estava no time.

### 11. `/lol/match/v5/matches/{matchId}/timeline`
* **Entrada:** `matchId`.
* **Retorno:** O log evento-por-evento de tudo que aconteceu, minuto a minuto (mortes, torres, itens comprados e coordenadas X/Y no mapa).
* **Significado:** Permite recriar a partida ou desenhar gráficos de ouro/dano ao longo do tempo.

## Categoria: SPECTATOR-V5 (Partidas ao Vivo)
### 12. `/lol/spectator/v5/active-games/by-summoner/{puuid}`
* **Entrada:** `puuid`.
* **Retorno:** Dados da partida em andamento (Modo, Campeões escolhidos, Feitiços, Runas e tempo decorrido). Erro 404 se não estiver jogando.
* **Significado:** Cria ferramentas de "Olheiro" para ver se o amigo está em partida.

### 13. `/lol/spectator/v5/featured-games`
* **Entrada:** Nenhuma.
* **Retorno:** Lista com 5 partidas de High Elo (Desafiantes/Mestres) acontecendo agora no servidor.
* **Significado:** Mostra partidas recomendadas para os usuários do site assistirem.

## Categoria: CHAMPION-V3 (Rotação Semanal)
### 14. `/lol/platform/v3/champion-rotations`
* **Entrada:** Nenhuma.
* **Retorno:** Array numérico de `freeChampionIds` e `freeChampionIdsForNewPlayers`, além do `maxNewPlayerLevel`.
* **Significado:** Diz quais campeões estão disponíveis de graça nesta semana para todos e para contas iniciantes.


## Categoria: CHAMPION-MASTERY-V4 (Maestria)
### 15. `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}`
* **Entrada:** `puuid`.
* **Retorno:** Lista completa de maestrias do jogador, de todos os campeões, em ordem decrescente de pontos.
* **Significado:** Monta a "Caverna da Maestria" completa do invocador.

### 16. `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/by-champion/{championId}`
* **Entrada:** `puuid` e `championId`.
* **Retorno:** Apenas a maestria (Nível, Pontos, Baús ganhos) de um único campeão.
* **Significado:** Pesquisa rápida se você quer saber se o jogador é mono Yasuo, sem precisar baixar a lista toda.

### 17. `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top`
* **Entrada:** `puuid` e `count` (ex: 3).
* **Retorno:** Os X campeões mais jogados do invocador.
* **Significado:** Atalho para poupar dados quando você só quer mostrar o Top 3 no perfil.

### 18. `/lol/champion-mastery/v4/scores/by-puuid/{puuid}`
* **Entrada:** `puuid`.
* **Retorno:** Um único número inteiro (ex: 450).
* **Significado:** O "Score Total de Maestria" do jogador (a soma dos níveis de maestria de todos os campeões).

## Categoria: LOL-CHALLENGES-V1 (Desafios In-Game)
### 19. `/lol/challenges/v1/player-data/{puuid}`
* **Entrada:** `puuid`.
* **Retorno:** Progresso, pontos totais (Cristal, Ferro, Ouro) e títulos que o jogador escolheu mostrar no banner.
* **Significado:** Renderiza as conquistas novas do jogador na tela de Perfil.

### 20. `/lol/challenges/v1/challenges/config`
* **Entrada:** Nenhuma.
* **Retorno:** Dicionário com as regras, nomes e limiares de todos os milhares de desafios do LoL.
* **Significado:** Dicionário estático para traduzir os IDs de desafios que o endpoint 19 retorna.

### 21. `/lol/challenges/v1/challenges/percentiles`
* **Entrada:** Nenhuma.
* **Retorno:** Porcentagem de jogadores que possuem cada rank em cada desafio.
* **Significado:** Serve para você dizer ao usuário "Você está no Top 5% do servidor em Roubos de Barão".

### 22. `/lol/challenges/v1/challenges/{challengeId}/config`
* **Entrada:** `challengeId`.
* **Retorno:** Dados de um desafio específico.
* **Significado:** Igual ao endpoint 20, mas focado em um só desafio.

### 23. `/lol/challenges/v1/challenges/{challengeId}/leaderboards/by-level/{level}`
* **Entrada:** `challengeId` e `level` (ex: CHALLENGER, GRANDMASTER).
* **Retorno:** A tabela de líderes daquele desafio no servidor.
* **Significado:** Mostra quem é o Top 1 do Brasil no desafio "Invencível" (Vencer sem morrer).

### 24. `/lol/challenges/v1/challenges/{challengeId}/percentiles`
* **Entrada:** `challengeId`.
* **Retorno:** Percentis de um desafio específico.
* **Significado:** Variante direta do endpoint 21.


## Categoria: LEAGUE-V4 (Elos e Ligas)
### 25. `/lol/league/v4/entries/by-summoner/{encryptedSummonerId}`
* **Entrada:** `encryptedSummonerId`.
* **Retorno:** Array com o Elo do jogador (Tier, Rank, LP, Vitórias, Derrotas) em filas Solo/Duo e Flex.
* **Significado:** Mostra se o jogador é Bronze, Ouro, Mestre, etc.

### 26. `/lol/league/v4/challengerleagues/by-queue/{queue}`
* **Entrada:** `queue` (ex: RANKED_SOLO_5x5).
* **Retorno:** A liga "Challenger" (Desafiante) e todos os jogadores que estão nela atualmente (até 300).
* **Significado:** Para criar Rankings e "Top Players do Servidor".

### 27. `/lol/league/v4/grandmasterleagues/by-queue/{queue}`
* **Entrada:** `queue`.
* **Retorno:** A liga Grão-Mestre e todos os seus jogadores (até 700).
* **Significado:** Ranking da segunda maior liga do jogo.

### 28. `/lol/league/v4/masterleagues/by-queue/{queue}`
* **Entrada:** `queue`.
* **Retorno:** A liga Mestre e seus milhares de jogadores.
* **Significado:** Ranking do tier Mestre.

### 29. `/lol/league/v4/leagues/{leagueId}`
* **Entrada:** `leagueId` (String).
* **Retorno:** Todos os invocadores que pertencem a uma mesma liga/divisão específica.
* **Significado:** Você pode mostrar a um jogador "Prata 2" quem são os outros 99 jogadores que estão competindo na mesma sub-liga que ele.

## Categoria: LEAGUE-EXP-V4 (Extração de Dados em Massa)
### 30. `/lol/league-exp/v4/entries/{queue}/{tier}/{division}`
* **Entrada:** `queue`, `tier` (ex: DIAMOND), `division` (ex: I) e página (`page`).
* **Retorno:** Uma página contendo os invocadores que estão naquele elo exato.
* **Significado:** API pesada usada por sites de estatística para raspar todos os jogadores do servidor (varrendo do Ferro ao Diamante) e calcular metadados.

## Categoria: CLASH-V1 (Campeonatos Oficiais Internos)
### 31. `/lol/clash/v1/players/by-puuid/{puuid}`
* **Entrada:** `puuid`.
* **Retorno:** ID da equipe de Clash atual do jogador (se ele estiver em uma) e a role/posição dele.
* **Significado:** Descobre em qual time o jogador vai competir no Clash deste final de semana.

### 32. `/lol/clash/v1/teams/{teamId}`
* **Entrada:** `teamId`.
* **Retorno:** Nome do time, ícone, tier, e a lista completa dos 5 membros e substitutos.
* **Significado:** Monta o painel completo de um time de Clash no seu site.

### 33. `/lol/clash/v1/tournaments`
* **Entrada:** Nenhuma.
* **Retorno:** Lista de todos os torneios de Clash (passados e ativos) e as datas oficiais de inicio.
* **Significado:** Cria um calendário de torneios Clash no seu site.

### 34. `/lol/clash/v1/tournaments/by-team/{teamId}`
* **Entrada:** `teamId`.
* **Retorno:** O torneio em que o time específico está competindo.
* **Significado:** Ajuda a linkar um time com o evento oficial dele.

### 35. `/lol/clash/v1/tournaments/{tournamentId}`
* **Entrada:** `tournamentId`.
* **Retorno:** Detalhes de um torneio específico de Clash.
* **Significado:** Retorna detalhes finos de fases e chaves do evento.

## Categoria: TOURNAMENT-STUB-V5 (Provedores de Torneio Personalizado)
*Usado APENAS se você vai hospedar torneios amadores com chaves especiais da Riot.*

### 36. `/lol/tournament-stub/v5/providers`
* **Entrada:** Dados do organizador e URL do seu site.
* **Retorno:** `providerId`.
* **Significado:** Registra o seu site como um organizador oficial de torneios de LoL.

### 37. `/lol/tournament-stub/v5/tournaments`
* **Entrada:** `providerId` e nome do torneio.
* **Retorno:** `tournamentId`.
* **Significado:** Registra um novo campeonato seu (ex: Copa bUGAdão).

### 38. `/lol/tournament-stub/v5/codes`
* **Entrada:** Quantidade de códigos, `tournamentId` e regras (draft, blind).
* **Retorno:** Lista de `Tournament Codes` (ex: `BR1-1234-5678-ABCD`).
* **Significado:** Gera os códigos de torneio que os jogadores colam dentro do LoL para entrar na sala personalizada automaticamente (Draft, Bloqueio de specs, etc).

### 39. `/lol/tournament-stub/v5/lobby-events/by-code/{tournamentCode}`
* **Entrada:** `tournamentCode`.
* **Retorno:** Todos os eventos do lobby (ex: "Jogador X entrou", "Jogador Y tomou kick").
* **Significado:** Permite ao seu site saber o que está acontecendo na sala de criação de jogo antes da partida começar.

### 40. *[Rotas Extras de Tournament-V5 API]*
* **Rotas de Produção Real:** As APIs reais de torneio espelham as de `stub` (36 a 39), mas geram dados reais.
* **Significado:** Apenas liberadas após o seu site ser aprovado pela equipe de eSports da Riot.