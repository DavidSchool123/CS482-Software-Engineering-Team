
const {
  evaluateSevenCardHand,
  compareHandRanks,
  findWinners
} = require('../service/HandEvaluationService');

// Helper to create a card
const card = (rank, suit) => ({ rank, suit });

describe('P50 - Winning Hand Determination', () => {
  test('straight flush beats four of a kind', () => {
    const straightFlush = [
      card('9', 'hearts'),
      card('10', 'hearts'),
      card('J', 'hearts'),
      card('Q', 'hearts'),
      card('K', 'hearts'),
      card('2', 'clubs'),
      card('3', 'diamonds')
    ];

    const fourOfAKind = [
      card('A', 'clubs'),
      card('A', 'diamonds'),
      card('A', 'hearts'),
      card('A', 'spades'),
      card('K', 'clubs'),
      card('2', 'diamonds'),
      card('3', 'hearts')
    ];

    expect(
      compareHandRanks(
        evaluateSevenCardHand(straightFlush),
        evaluateSevenCardHand(fourOfAKind)
      )
    ).toBeGreaterThan(0);
  });

  test('ace-low straight is recognized', () => {
    const cards = [
      card('A', 'spades'),
      card('2', 'clubs'),
      card('3', 'hearts'),
      card('4', 'diamonds'),
      card('5', 'spades'),
      card('9', 'clubs'),
      card('J', 'hearts')
    ];

    expect(evaluateSevenCardHand(cards)).toEqual([4, 5]);
  });

  test('folded players cannot win', () => {
    const players = [
      {
        PlayerId: 'player-1',
        HasFolded: true,
        Cards: [
          card('A', 'hearts'),
          card('K', 'hearts'),
          card('Q', 'hearts'),
          card('J', 'hearts'),
          card('10', 'hearts'),
          card('2', 'clubs'),
          card('3', 'diamonds')
        ]
      },
      {
        PlayerId: 'player-2',
        HasFolded: false,
        Cards: [
          card('2', 'hearts'),
          card('4', 'clubs'),
          card('6', 'diamonds'),
          card('8', 'spades'),
          card('10', 'clubs'),
          card('J', 'diamonds'),
          card('K', 'spades')
        ]
      }
    ];

    expect(findWinners(players)).toEqual(['player-2']);
  });

  test('players with equal hands split the win', () => {
    const players = [
      {
        PlayerId: 'player-1',
        HasFolded: false,
        Cards: [
          card('A', 'hearts'),
          card('A', 'clubs'),
          card('K', 'spades'),
          card('Q', 'diamonds'),
          card('J', 'clubs'),
          card('9', 'hearts'),
          card('2', 'spades')
        ]
      },
      {
        PlayerId: 'player-2',
        HasFolded: false,
        Cards: [
          card('A', 'diamonds'),
          card('A', 'spades'),
          card('K', 'hearts'),
          card('Q', 'clubs'),
          card('J', 'diamonds'),
          card('8', 'clubs'),
          card('3', 'spades')
        ]
      }
    ];

    expect(findWinners(players)).toEqual([
      'player-1',
      'player-2'
    ]);
  });

  test('remaining player wins when everyone else folds', () => {
    const players = [
      {
        PlayerId: 'player-1',
        HasFolded: true,
        Cards: []
      },
      {
        PlayerId: 'player-2',
        HasFolded: false,
        Cards: []
      }
    ];

    expect(findWinners(players)).toEqual(['player-2']);
  });
});
