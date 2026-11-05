
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

/**
 * P40 - New Cards
 *
 * Deals one additional card to each active player.
 *
 * Streets 4, 5, 6: Face-up cards
 * Street 7: Face-down card
 *
 * Modifies the supplied deck and player hands.
 */
function dealNextStreet(deck, players, street) {
  // Validate the street
  if (![4, 5, 6, 7].includes(street)) {
    throw new Error('Invalid street for dealing');
  }

  // Only players who have not folded receive new cards
  const activePlayers = players.filter(
    player => !player.HasFolded
  );

  if (activePlayers.length < 2) {
    throw new Error('Not enough active players to deal');
  }

  // Ensure enough cards remain
  if (deck.length < activePlayers.length) {
    throw new Error('Not enough cards in the deck');
  }

  // Seventh Street is dealt face-down
  const faceUp = street !== 7;

  // Deal one card to each active player
  for (const player of activePlayers) {
    const card = deck.pop();

    player.Cards.push({
        rank: card.rank,
        suit: card.suit,
        faceUp: faceUp
    });
  }


  return players;
}

module.exports = {
  dealInitialCards,
  dealNextStreet
};
