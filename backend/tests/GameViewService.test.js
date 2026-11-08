
const { getVisiblePlayers } = require('../service/GameViewService');

describe('P37 - View Cards', () => {
  const players = [
    {
      PlayerId: 'alice',
      Cards: [
        { rank: 'A', suit: 'Spades', faceUp: false },
        { rank: '7', suit: 'Hearts', faceUp: false },
        { rank: 'K', suit: 'Diamonds', faceUp: true },
      ],
    },
    {
      PlayerId: 'bob',
      Cards: [
        { rank: 'Q', suit: 'Hearts', faceUp: false },
        { rank: '5', suit: 'Clubs', faceUp: false },
        { rank: '9', suit: 'Spades', faceUp: true },
      ],
    },
  ];

  test('shows all cards to their owner', () => {
    const result = getVisiblePlayers(players, 'alice');

    expect(result[0].isCurrentPlayer).toBe(true);
    expect(result[0].cards).toEqual(players[0].Cards);
  });

  test('hides opponents private card values', () => {
    const result = getVisiblePlayers(players, 'alice');

    expect(result[1].isCurrentPlayer).toBe(false);
    expect(result[1].cards[0]).toEqual({ faceUp: false });
    expect(result[1].cards[1]).toEqual({ faceUp: false });

    // Ensure rank and suit are not exposed
    expect(result[1].cards[0]).not.toHaveProperty('rank');
    expect(result[1].cards[0]).not.toHaveProperty('suit');
  });

  test('shows opponents face-up cards', () => {
    const result = getVisiblePlayers(players, 'alice');

    expect(result[1].cards[2]).toEqual({
      rank: '9',
      suit: 'Spades',
      faceUp: true,
    });
  });

  test('reveals winning hands after the hand is settled', () => {
    const result = getVisiblePlayers(players, 'alice', ['bob']);

    expect(result[1].cards).toEqual(players[1].Cards);
  });

  test('changes visible cards based on the viewer', () => {
    const result = getVisiblePlayers(players, 'bob');

    expect(result[1].isCurrentPlayer).toBe(true);
    expect(result[1].cards).toEqual(players[1].Cards);

    expect(result[0].isCurrentPlayer).toBe(false);
    expect(result[0].cards[0]).toEqual({ faceUp: false });
    expect(result[0].cards[1]).toEqual({ faceUp: false });
  });

  test('does not modify the original player cards', () => {
    const original = JSON.stringify(players);

    getVisiblePlayers(players, 'alice');

    expect(JSON.stringify(players)).toBe(original);
  });

  test('hides private cards when no viewer is provided', () => {
    const result = getVisiblePlayers(players, null);

    expect(result[0].isCurrentPlayer).toBe(false);
    expect(result[1].isCurrentPlayer).toBe(false);

    // Alice's private cards remain hidden
    expect(result[0].cards[0]).toEqual({ faceUp: false });
    expect(result[0].cards[1]).toEqual({ faceUp: false });

    // Bob's private cards remain hidden
    expect(result[1].cards[0]).toEqual({ faceUp: false });
    expect(result[1].cards[1]).toEqual({ faceUp: false });

    // Public cards remain visible
    expect(result[0].cards[2]).toEqual({
      rank: 'K',
      suit: 'Diamonds',
      faceUp: true,
    });

    expect(result[1].cards[2]).toEqual({
      rank: '9',
      suit: 'Spades',
      faceUp: true,
    });
  });
});
