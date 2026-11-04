
const { createDeck, shuffleDeck } = require('../service/DeckService');
const {
  dealInitialCards,
  dealNextStreet
} = require('../service/DealingService');

describe('P15 - Initial Card Dealing', () => {
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

describe('P40 - New Cards', () => {
  const players = [
    { id: 'alice' },
    { id: 'bob' },
    { id: 'charlie' }
  ];

  function setupGame() {
    const deck = shuffleDeck(createDeck());
    const hands = dealInitialCards(deck, players);

    const gamePlayers = hands.map(hand => ({
      PlayerId: hand.playerId,
      Cards: hand.cards,
      HasFolded: false
    }));

    return { deck, gamePlayers };
  }

  test('should deal one face-up card on fourth street', () => {
    const { deck, gamePlayers } = setupGame();

    dealNextStreet(deck, gamePlayers, 4);

    for (const player of gamePlayers) {
      expect(player.Cards).toHaveLength(4);
      expect(player.Cards[3].faceUp).toBe(true);
    }

    expect(deck).toHaveLength(40);
  });

  test('should deal face-up cards on fifth and sixth streets', () => {
    const { deck, gamePlayers } = setupGame();

    dealNextStreet(deck, gamePlayers, 4);
    dealNextStreet(deck, gamePlayers, 5);
    dealNextStreet(deck, gamePlayers, 6);

    for (const player of gamePlayers) {
      expect(player.Cards).toHaveLength(6);

      expect(player.Cards.map(card => card.faceUp))
        .toEqual([
          false,
          false,
          true,
          true,
          true,
          true
        ]);
    }

    expect(deck).toHaveLength(34);
  });

  test('should deal the final card face-down on seventh street', () => {
    const { deck, gamePlayers } = setupGame();

    dealNextStreet(deck, gamePlayers, 4);
    dealNextStreet(deck, gamePlayers, 5);
    dealNextStreet(deck, gamePlayers, 6);
    dealNextStreet(deck, gamePlayers, 7);

    for (const player of gamePlayers) {
      expect(player.Cards).toHaveLength(7);

      expect(player.Cards.map(card => card.faceUp))
        .toEqual([
          false,
          false,
          true,
          true,
          true,
          true,
          false
        ]);
    }

    expect(deck).toHaveLength(31);
  });

  test('should not deal new cards to folded players', () => {
    const { deck, gamePlayers } = setupGame();

    gamePlayers[2].HasFolded = true;

    dealNextStreet(deck, gamePlayers, 4);

    expect(gamePlayers[0].Cards).toHaveLength(4);
    expect(gamePlayers[1].Cards).toHaveLength(4);

    // Charlie folded and keeps the original three cards
    expect(gamePlayers[2].Cards).toHaveLength(3);

    // Only two cards were removed
    expect(deck).toHaveLength(41);
  });

  test('should not deal duplicate cards across streets', () => {
    const { deck, gamePlayers } = setupGame();

    dealNextStreet(deck, gamePlayers, 4);
    dealNextStreet(deck, gamePlayers, 5);
    dealNextStreet(deck, gamePlayers, 6);
    dealNextStreet(deck, gamePlayers, 7);

    const allCards = gamePlayers.flatMap(
      player => player.Cards
    );

    const uniqueCards = new Set(
      allCards.map(card => `${card.rank}-${card.suit}`)
    );

    expect(allCards).toHaveLength(21);
    expect(uniqueCards.size).toBe(21);
  });

  test('should reject an invalid street', () => {
    const { deck, gamePlayers } = setupGame();

    expect(() => dealNextStreet(deck, gamePlayers, 3))
      .toThrow('Invalid street for dealing');

    expect(() => dealNextStreet(deck, gamePlayers, 8))
      .toThrow('Invalid street for dealing');
  });

  test('should reject dealing when the deck has insufficient cards', () => {
    const { gamePlayers } = setupGame();

    const shortDeck = createDeck().slice(0, 2);

    expect(() => dealNextStreet(shortDeck, gamePlayers, 4))
      .toThrow('Not enough cards in the deck');

    // No player should receive an extra card
    for (const player of gamePlayers) {
      expect(player.Cards).toHaveLength(3);
    }

    expect(shortDeck).toHaveLength(2);
  });

  test('should reject dealing when fewer than two players remain', () => {
    const { deck, gamePlayers } = setupGame();

    gamePlayers[1].HasFolded = true;
    gamePlayers[2].HasFolded = true;

    expect(() => dealNextStreet(deck, gamePlayers, 4))
      .toThrow('Not enough active players to deal');

    expect(deck).toHaveLength(43);
  });
});
