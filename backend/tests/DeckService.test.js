
const { createDeck, shuffleDeck } = require('../service/DeckService');

describe('Deck Service', () => {

  test('should create a deck with 52 cards', () => {
    const deck = createDeck();

    expect(deck).toHaveLength(52);
  });

  test('should create 52 unique cards', () => {
    const deck = createDeck();

    const uniqueCards = new Set(
      deck.map(card => `${card.rank}-${card.suit}`)
    );

    expect(uniqueCards.size).toBe(52);
  });

  test('should shuffle without losing or duplicating cards', () => {
    const originalDeck = createDeck();
    const shuffledDeck = shuffleDeck(createDeck());

    expect(shuffledDeck).toHaveLength(52);

    const cardKey = card => `${card.rank}-${card.suit}`;

    expect(shuffledDeck.map(cardKey).sort())
      .toEqual(originalDeck.map(cardKey).sort());
  });

});
