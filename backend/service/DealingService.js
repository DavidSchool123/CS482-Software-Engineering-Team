
function dealInitialCards(deck, players) {
  if (players.length < 2 || players.length > 6) {
    throw new Error('A game must have between 2 and 6 players');
  }

  if (deck.length < players.length * 3) {
    throw new Error('Not enough cards in the deck');
  }

  const playerHands = players.map(player => ({
    playerId: player.id,
    cards: []
  }));

  // Deal two face-down cards to each player
  for (let round = 0; round < 2; round++) {
    for (const hand of playerHands) {
      hand.cards.push({
        ...deck.pop(),
        faceUp: false
      });
    }
  }

  // Deal one face-up card to each player
  for (const hand of playerHands) {
    hand.cards.push({
      ...deck.pop(),
      faceUp: true
    });
  }

  return playerHands;
}

module.exports = { dealInitialCards };
