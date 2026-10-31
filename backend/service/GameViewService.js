
function getVisiblePlayers(players, viewerId) {
  return players.map((player) => {
    const isCurrentPlayer =
      player.PlayerId.toString() === viewerId.toString();

    return {
      playerId: player.PlayerId,
      isCurrentPlayer,
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
