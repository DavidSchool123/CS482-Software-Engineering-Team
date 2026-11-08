const {
  evaluateSevenCardHand,
  findWinners,
} = require('../service/HandEvaluationService');

const card = (rank, suit) => ({ rank, suit });

describe('HandEvaluationService', () => {
  test('selects a seven-card straight flush over other cards', () => {
    const hand = [
      card('10', 'Hearts'),
      card('J', 'Hearts'),
      card('Q', 'Hearts'),
      card('K', 'Hearts'),
      card('A', 'Hearts'),
      card('2', 'Clubs'),
      card('3', 'Spades'),
    ];

    expect(evaluateSevenCardHand(hand)).toEqual([8, 14]);
  });

  test('recognizes an ace-low straight', () => {
    const hand = [
      card('A', 'Hearts'),
      card('2', 'Clubs'),
      card('3', 'Diamonds'),
      card('4', 'Spades'),
      card('5', 'Hearts'),
      card('9', 'Clubs'),
      card('K', 'Spades'),
    ];

    expect(evaluateSevenCardHand(hand)).toEqual([4, 5]);
  });

  test('splits the pot for tied hands and ignores folded players', () => {
    const players = [
      {
        PlayerId: 'player-1',
        HasFolded: false,
        Cards: [
          card('5', 'Hearts'),
          card('6', 'Clubs'),
          card('7', 'Diamonds'),
          card('8', 'Spades'),
          card('9', 'Hearts'),
          card('A', 'Clubs'),
          card('2', 'Spades'),
        ],
      },
      {
        PlayerId: 'player-2',
        HasFolded: false,
        Cards: [
          card('5', 'Clubs'),
          card('6', 'Diamonds'),
          card('7', 'Spades'),
          card('8', 'Hearts'),
          card('9', 'Clubs'),
          card('Q', 'Diamonds'),
          card('3', 'Hearts'),
        ],
      },
      {
        PlayerId: 'folded-player',
        HasFolded: true,
        Cards: [],
      },
    ];

    expect(findWinners(players)).toEqual(['player-1', 'player-2']);
  });
});
