
const { getVisiblePlayers } = require('../service/GameViewService');

describe('P15 - Game Card Visibility', () => {
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
  });

  test('shows opponents face-up cards', () => {
    const result = getVisiblePlayers(players, 'alice');

    expect(result[1].cards[2]).toEqual({
      rank: '9',
      suit: 'Spades',
      faceUp: true,
    });
  });

  test('changes visible cards based on the viewer', () => {
    const result = getVisiblePlayers(players, 'bob');

    expect(result[1].cards).toEqual(players[1].Cards);
    expect(result[0].cards[0]).toEqual({ faceUp: false });
    expect(result[0].cards[1]).toEqual({ faceUp: false });
  });

  test('does not modify the original player cards', () => {
    const original = JSON.stringify(players);

    getVisiblePlayers(players, 'alice');

    expect(JSON.stringify(players)).toBe(original);
  });
});
