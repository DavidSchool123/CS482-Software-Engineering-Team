
const RANK_VALUES = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

const SUIT_VALUES = {
  clubs: 1,
  diamonds: 2,
  hearts: 3,
  spades: 4
};

function determineBringInPlayer(hands) {
  if (!hands.length) {
    throw new Error('No players available');
  }

  let lowestPlayer = null;
  let lowestRank = Infinity;
  let lowestSuit = Infinity;

  for (const hand of hands) {
    const exposedCard = hand.cards.find(card => card.faceUp);

    if (!exposedCard) {
      throw new Error('Player has no exposed card');
    }

    const rank = RANK_VALUES[String(exposedCard.rank).toUpperCase()];
    const suit = SUIT_VALUES[String(exposedCard.suit).toLowerCase()];

    if (rank === undefined || suit === undefined) {
      throw new Error('Invalid card rank or suit');
    }

    if (
      rank < lowestRank ||
      (rank === lowestRank && suit < lowestSuit)
    ) {
      lowestRank = rank;
      lowestSuit = suit;
      lowestPlayer = hand.playerId;
    }
  }

  return lowestPlayer;
}

module.exports = { determineBringInPlayer };
