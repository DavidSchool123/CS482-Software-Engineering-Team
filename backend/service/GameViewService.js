
function getVisiblePlayers(players, viewerId) {
  return players.map((player) => {
    const isCurrentPlayer =
      player.PlayerId.toString() === viewerId.toString();

    return {
      playerId: player.PlayerId,
      isCurrentPlayer,

      // P16: Betting information
      roundContribution: player.RoundContribution,
      totalContribution: player.TotalContribution,
      hasFolded: player.HasFolded,
      hasActed: player.HasActed,

      // P37: Protect opponents' private cards
      cards: player.Cards.map((card) => {
        if (isCurrentPlayer || card.faceUp) {
          return {
            rank: card.rank,
            suit: card.suit,
            faceUp: card.faceUp,
          };
        }

        return { faceUp: false };
      }),
    };
  });
}

module.exports = { getVisiblePlayers };
