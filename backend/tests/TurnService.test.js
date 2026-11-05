
const {
  evaluateVisibleHand,
  compareHands,
  determineFirstPlayer,
  initializeBettingRound
} = require('../service/TurnService');

function card(rank, suit = 'Hearts', faceUp = true) {
  return { rank, suit, faceUp };
}

function player(id, cards, hasFolded = false) {
  return {
    PlayerId: id,
    Cards: cards,
    HasFolded: hasFolded,
    HasActed: true,
    RoundContribution: 10,
    TotalContribution: 30
  };
}

describe('P49 - Visible Hand Evaluation', () => {
  test('should ignore face-down cards', () => {
    const hand = evaluateVisibleHand([
      card('A', 'Hearts', false),
      card('A', 'Spades', false),
      card('7')
    ]);

    expect(hand).toEqual([0, 7]);
  });

  test('should rank a pair above high card', () => {
    const pair = evaluateVisibleHand([
      card('Q', 'Hearts'),
      card('Q', 'Spades')
    ]);

    const highCard = evaluateVisibleHand([
      card('A', 'Hearts'),
      card('K', 'Spades')
    ]);

    expect(compareHands(pair, highCard)).toBeGreaterThan(0);
  });

  test('should rank two pair above one pair', () => {
    const twoPair = evaluateVisibleHand([
      card('J', 'Hearts'),
      card('J', 'Spades'),
      card('8', 'Clubs'),
      card('8', 'Diamonds')
    ]);

    const onePair = evaluateVisibleHand([
      card('A', 'Hearts'),
      card('A', 'Spades'),
      card('K', 'Clubs'),
      card('7', 'Diamonds')
    ]);

    expect(compareHands(twoPair, onePair)).toBeGreaterThan(0);
  });

  test('should rank three of a kind above two pair', () => {
    const threeKind = evaluateVisibleHand([
      card('5', 'Hearts'),
      card('5', 'Spades'),
      card('5', 'Clubs')
    ]);

    const twoPair = evaluateVisibleHand([
      card('K', 'Hearts'),
      card('K', 'Spades'),
      card('Q', 'Clubs'),
      card('Q', 'Diamonds')
    ]);

    expect(compareHands(threeKind, twoPair)).toBeGreaterThan(0);
  });

  test('should rank four of a kind above three of a kind', () => {
    const fourKind = evaluateVisibleHand([
      card('3', 'Hearts'),
      card('3', 'Spades'),
      card('3', 'Clubs'),
      card('3', 'Diamonds')
    ]);

    const threeKind = evaluateVisibleHand([
      card('A', 'Hearts'),
      card('A', 'Spades'),
      card('A', 'Clubs')
    ]);

    expect(compareHands(fourKind, threeKind)).toBeGreaterThan(0);
  });

  test('should not count three consecutive cards as a straight', () => {
    const hand = evaluateVisibleHand([
      card('7'),
      card('8'),
      card('9')
    ]);

    expect(hand).toEqual([0, 9, 8, 7]);
  });

  test('should not count three cards of one suit as a flush', () => {
    const hand = evaluateVisibleHand([
      card('A', 'Spades'),
      card('J', 'Spades'),
      card('5', 'Spades')
    ]);

    expect(hand).toEqual([0, 14, 11, 5]);
  });

  test('should compare equal hands as a tie', () => {
    const first = evaluateVisibleHand([
      card('K', 'Hearts'),
      card('8', 'Clubs')
    ]);

    const second = evaluateVisibleHand([
      card('K', 'Spades'),
      card('8', 'Diamonds')
    ]);

    expect(compareHands(first, second)).toBe(0);
  });
});

describe('P49 - First Player Selection', () => {
  test('should select the strongest exposed hand', () => {
    const players = [
      player('alice', [
        card('A'),
        card('K')
      ]),
      player('bob', [
        card('Q', 'Hearts'),
        card('Q', 'Spades')
      ]),
      player('charlie', [
        card('J'),
        card('9')
      ])
    ];

    expect(determineFirstPlayer(players)).toBe('bob');
  });

  test('should skip folded players', () => {
    const players = [
      player('alice', [
        card('A', 'Hearts'),
        card('A', 'Spades')
      ], true),
      player('bob', [
        card('K'),
        card('8')
      ]),
      player('charlie', [
        card('Q'),
        card('7')
      ])
    ];

    expect(determineFirstPlayer(players)).toBe('bob');
  });

  test('should use seating order when exposed hands tie', () => {
    const players = [
      player('alice', [
        card('K', 'Hearts'),
        card('8', 'Clubs')
      ]),
      player('bob', [
        card('K', 'Spades'),
        card('8', 'Diamonds')
      ])
    ];

    expect(determineFirstPlayer(players)).toBe('alice');
  });

  test('should reject a game with no active players', () => {
    const players = [
      player('alice', [card('A')], true),
      player('bob', [card('K')], true)
    ];

    expect(() => determineFirstPlayer(players))
      .toThrow('No active players');
  });
});

describe('P49 - Betting Round Initialization', () => {
  function createGame() {
    return {
      Street: 4,
      AwaitingNextRound: true,
      BettingRoundComplete: true,
      CurrentBet: 20,
      RaiseCount: 2,
      LastRaiseAmount: 10,
      CurrentTurnPlayerId: null,
      Players: [
        player('alice', [
          card('A'),
          card('K')
        ]),
        player('bob', [
          card('Q', 'Hearts'),
          card('Q', 'Spades')
        ])
      ]
    };
  }

  test('should reset betting state for the new street', () => {
    const game = createGame();

    initializeBettingRound(game);

    expect(game.CurrentBet).toBe(0);
    expect(game.RaiseCount).toBe(0);
    expect(game.LastRaiseAmount).toBe(0);
    expect(game.BettingRoundComplete).toBe(false);
    expect(game.AwaitingNextRound).toBe(false);
  });

  test('should reset each player without changing total contributions', () => {
    const game = createGame();

    initializeBettingRound(game);

    for (const p of game.Players) {
      expect(p.RoundContribution).toBe(0);
      expect(p.HasActed).toBe(false);
      expect(p.TotalContribution).toBe(30);
    }
  });

  test('should select the strongest exposed hand to act first', () => {
    const game = createGame();

    initializeBettingRound(game);

    expect(game.CurrentTurnPlayerId).toBe('bob');
  });

  test('should reject initialization when no round is pending', () => {
    const game = createGame();
    game.AwaitingNextRound = false;

    expect(() => initializeBettingRound(game))
      .toThrow('No new betting round is pending');
  });

  test('should reject invalid streets', () => {
    const game = createGame();
    game.Street = 3;

    expect(() => initializeBettingRound(game))
      .toThrow('Invalid street for betting initialization');
  });
});
