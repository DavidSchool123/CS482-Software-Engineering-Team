
const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];

const RANKS = [
  '2', '3', '4', '5', '6', '7', '8',
  '9', '10', 'J', 'Q', 'K', 'A'
];

function createDeck() {
  const deck = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        rank: rank,
        suit: suit
      });
    }
  }

  return deck;
}


function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    // Swap the cards at positions i and j
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}


module.exports = { createDeck, shuffleDeck };
