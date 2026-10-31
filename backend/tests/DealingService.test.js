
const { createDeck, shuffleDeck } = require('../service/DeckService');
const { dealInitialCards } = require('../service/DealingService');

describe('Dealing Service', () => {
  const players = [
    { id: 'alice' },
    { id: 'bob' },
    { id: 'charlie' }
  ];

  test('should deal three cards to each player', () => {
    const deck = shuffleDeck(createDeck());
    const hands = dealInitialCards(deck, players);

    expect(hands).toHaveLength(3);

    for (const hand of hands) {
      expect(hand.cards).toHaveLength(3);
    }
  });

  test('should deal two face-down cards and one face-up card', () => {
    const deck = shuffleDeck(createDeck());
    const hands = dealInitialCards(deck, players);

    for (const hand of hands) {
      expect(hand.cards.map(card => card.faceUp))
        .toEqual([false, false, true]);
    }
  });

  test('should remove dealt cards from the deck', () => {
    const deck = shuffleDeck(createDeck());

    dealInitialCards(deck, players);

    expect(deck).toHaveLength(43);
  });

  test('should not deal duplicate cards', () => {
    const deck = shuffleDeck(createDeck());
    const hands = dealInitialCards(deck, players);

    const allCards = hands.flatMap(hand => hand.cards);
    const uniqueCards = new Set(
      allCards.map(card => `${card.rank}-${card.suit}`)
    );

    expect(uniqueCards.size).toBe(9);
  });

  test('should reject fewer than two players', () => {
    const deck = createDeck();

    expect(() => dealInitialCards(deck, [{ id: 'alice' }]))
      .toThrow('A game must have between 2 and 6 players');
  });

  test('should reject more than six players', () => {
    const deck = createDeck();

    const tooManyPlayers = Array.from(
      { length: 7 },
      (_, i) => ({ id: `player${i}` })
    );

    expect(() => dealInitialCards(deck, tooManyPlayers))
      .toThrow('A game must have between 2 and 6 players');
  });

  test('should reject a deck with insufficient cards', () => {
    const deck = createDeck().slice(0, 5);

    expect(() => dealInitialCards(deck, players))
      .toThrow('Not enough cards in the deck');
  });
});
