
const { getVisiblePlayers } = require('../service/GameViewService');

describe('P37 - View Cards / View Results', () => {
  const players = [
    {
      PlayerId: 'alice',
      Cards: [
        { rank: 'A', suit: 'Spades', faceUp: false },
        { rank: '7', suit: 'Hearts', faceUp: false },
        { rank: 'K', suit: 'Diamonds', faceUp: true },
      ],
      RoundContribution: 5,
      TotalContribution: 10,
      HasFolded: false,
      HasActed: true,
    },
    {
      PlayerId: 'bob',
      Cards: [
        { rank: 'Q', suit: 'Hearts', faceUp: false },
        { rank: '5', suit: 'Clubs', faceUp: false },
        { rank: '9', suit: 'Spades', faceUp: true },
      ],
      RoundContribution: 5,
      TotalContribution: 10,
      HasFolded: false,
      HasActed: true,
    },
    {
      PlayerId: 'charlie',
      Cards: [
        { rank: 'J', suit: 'Clubs', faceUp: false },
        { rank: '3', suit: 'Diamonds', faceUp: false },
        { rank: '8', suit: 'Hearts', faceUp: true },
      ],
      RoundContribution: 0,
      TotalContribution: 5,
      HasFolded: true,
      HasActed: true,
    },
  ];

  // -----------------------------------------
  // P37 - Normal gameplay visibility
  // -----------------------------------------

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

    expect(result.every(player => !player.isCurrentPlayer))
      .toBe(true);

    expect(result[0].cards[0]).toEqual({ faceUp: false });
    expect(result[1].cards[0]).toEqual({ faceUp: false });

    expect(result[0].cards[2]).toEqual({
      rank: 'K',
      suit: 'Diamonds',
      faceUp: true,
    });
  });

  // -----------------------------------------
  // View Results - Showdown visibility
  // -----------------------------------------

  test('reveals a specified player after showdown', () => {
    const result = getVisiblePlayers(
      players,
      'alice',
      ['bob']
    );

    expect(result[1].cards).toEqual(players[1].Cards);
  });

  test('reveals both winner and loser at showdown', () => {
    const result = getVisiblePlayers(
      players,
      null,
      ['alice', 'bob']
    );

    expect(result[0].cards).toEqual(players[0].Cards);
    expect(result[1].cards).toEqual(players[1].Cards);
  });

  test('keeps folded players private cards hidden', () => {
    // Charlie folded, so the controller excludes
    // Charlie from the reveal list.
    const result = getVisiblePlayers(
      players,
      null,
      ['alice', 'bob']
    );

    expect(result[2].cards[0]).toEqual({ faceUp: false });
    expect(result[2].cards[1]).toEqual({ faceUp: false });

    expect(result[2].cards[2]).toEqual({
      rank: '8',
      suit: 'Hearts',
      faceUp: true,
    });
  });

  test('does not reveal a fold-only winner automatically', () => {
    // The controller passes an empty reveal list
    // when only one player remains.
    const result = getVisiblePlayers(
      players,
      null,
      []
    );

    expect(result[0].cards[0]).toEqual({ faceUp: false });
    expect(result[0].cards[1]).toEqual({ faceUp: false });
  });

  test('supports MongoDB ObjectId-like player IDs', () => {
    const objectIdLike = {
      toString: () => 'alice'
    };

    const result = getVisiblePlayers(
      players,
      null,
      [objectIdLike]
    );

    expect(result[0].cards).toEqual(players[0].Cards);
  });

  test('does not reveal unlisted opponents', () => {
    const result = getVisiblePlayers(
      players,
      null,
      ['bob']
    );

    expect(result[1].cards).toEqual(players[1].Cards);

    expect(result[0].cards[0]).toEqual({ faceUp: false });
    expect(result[2].cards[0]).toEqual({ faceUp: false });
  });

  // -----------------------------------------
  // Betting information
  // -----------------------------------------

  test('returns player betting information', () => {
    const result = getVisiblePlayers(players, 'alice');

    expect(result[0]).toMatchObject({
      playerId: 'alice',
      roundContribution: 5,
      totalContribution: 10,
      hasFolded: false,
      hasActed: true,
    });
  });

  test('preserves folded status in results', () => {
    const result = getVisiblePlayers(players, null);

    expect(result[2].hasFolded).toBe(true);
  });
});
