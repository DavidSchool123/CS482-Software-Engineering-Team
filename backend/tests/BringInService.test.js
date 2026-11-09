
const { determineBringInPlayer } = require('../service/BringInService');

// Helper to create a player with two hidden cards
// and one exposed card.
function createHand(playerId, rank, suit) {
  return {
    playerId,
    cards: [
      { rank: 'A', suit: 'Spades', faceUp: false },
      { rank: 'K', suit: 'Hearts', faceUp: false },
      { rank, suit, faceUp: true }
    ]
  };
}

describe('P42 - Player Ante and Bring-In: BringInService', () => {
  test('selects the player with the lowest exposed card', () => {
    const hands = [
      createHand('player1', 'Q', 'Hearts'),
      createHand('player2', '4', 'Spades'),
      createHand('player3', '9', 'Clubs')
    ];

    expect(determineBringInPlayer(hands)).toBe('player2');
  });

  test('breaks rank ties using suit order', () => {
    const hands = [
      createHand('player1', '5', 'Spades'),
      createHand('player2', '5', 'Diamonds'),
      createHand('player3', '5', 'Clubs'),
      createHand('player4', '5', 'Hearts')
    ];

    expect(determineBringInPlayer(hands)).toBe('player3');
  });

  test('ignores hidden cards when selecting the bring-in', () => {
    const hands = [
      {
        playerId: 'player1',
        cards: [
          { rank: '2', suit: 'Clubs', faceUp: false },
          { rank: '3', suit: 'Clubs', faceUp: false },
          { rank: 'J', suit: 'Hearts', faceUp: true }
        ]
      },
      createHand('player2', '7', 'Spades')
    ];

    expect(determineBringInPlayer(hands)).toBe('player2');
  });

  test('handles lowercase and uppercase suit names', () => {
    const hands = [
      createHand('player1', '6', 'SPADES'),
      createHand('player2', '6', 'clubs')
    ];

    expect(determineBringInPlayer(hands)).toBe('player2');
  });

  test('throws an error when there are no players', () => {
    expect(() => determineBringInPlayer([]))
      .toThrow('No players available');
  });

  test('throws an error when a player has no exposed card', () => {
    const hands = [{
      playerId: 'player1',
      cards: [
        { rank: '4', suit: 'Hearts', faceUp: false }
      ]
    }];

    expect(() => determineBringInPlayer(hands))
      .toThrow('Player has no exposed card');
  });

  test('throws an error for an invalid card rank', () => {
    const hands = [createHand('player1', '15', 'Hearts')];

    expect(() => determineBringInPlayer(hands))
      .toThrow('Invalid card rank or suit');
  });

  test('throws an error for an invalid card suit', () => {
    const hands = [createHand('player1', '5', 'Stars')];

    expect(() => determineBringInPlayer(hands))
      .toThrow('Invalid card rank or suit');
  });

  test('returns the only player when one hand is provided', () => {
    const hands = [createHand('player1', '8', 'Diamonds')];

    expect(determineBringInPlayer(hands)).toBe('player1');
  });
});
