
/**
 * P37 / View Results
 *
 * Returns the cards and betting information that
 * a particular viewer is allowed to see.
 *
 * During gameplay:
 * - Players see their own cards.
 * - Everyone sees exposed cards.
 * - Opponents' private cards remain hidden.
 *
 * At showdown:
 * - The controller specifies which players'
 *   private cards should be revealed.
 */
function getVisiblePlayers(players, viewerId, revealPlayerIds = []) {
  // Normalize IDs so MongoDB ObjectIds and strings
  // can be compared consistently.
  const revealedPlayers = new Set(
    revealPlayerIds.map(id => String(id))
  );

  return players.map(player => {
    const playerId = String(player.PlayerId);

    const isCurrentPlayer =
      viewerId != null &&
      playerId === String(viewerId);

    const revealCards =
      isCurrentPlayer ||
      revealedPlayers.has(playerId);

    return {
      playerId: player.PlayerId,
      isCurrentPlayer,

      // P16 - Betting information
      roundContribution: player.RoundContribution,
      totalContribution: player.TotalContribution,
      hasFolded: player.HasFolded,
      hasActed: player.HasActed,

      // P37 - Card visibility
      cards: player.Cards.map(card => {
        if (revealCards || card.faceUp) {
          return {
            rank: card.rank,
            suit: card.suit,
            faceUp: card.faceUp
          };
        }

        // Never expose the rank or suit
        // of another player's hidden card.
        return {
          faceUp: false
        };
      })
    };
  });
}

module.exports = {
  getVisiblePlayers
};
