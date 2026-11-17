
jest.mock('../service/HandEvaluationService', () => ({
  evaluateSevenCardHand: jest.fn(),
  getHandName: jest.fn()
}));

const {
  evaluateSevenCardHand,
  getHandName
} = require('../service/HandEvaluationService');

const { settleHand } = require('../service/SettlementService');

function createTable(stacks) {
  return {
    PlayerStacks: stacks.map(([PlayerId, Chips]) => ({
      PlayerId,
      Chips
    })),
    Status: 'In Progress',
    save: jest.fn().mockResolvedValue(undefined)
  };
}

function createGame(pot, players) {
  return {
    Pot: pot,
    Status: 'In Progress',

    Players: players.map(
      ([PlayerId, HasFolded = false, Cards = []]) => ({
        PlayerId,
        HasFolded,
        Cards
      })
    ),

    WinnerIds: [],
    HandResults: [],
    CompletedAt: null,
    NextHandAt: null,

    CurrentTurnPlayerId: 'player-1',
    BettingRoundComplete: false,
    AwaitingNextRound: false
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  evaluateSevenCardHand.mockReturnValue([6, 14, 13]);
  getHandName.mockReturnValue('Full House');
  });

describe('P51 - Player Pot Distribution', () => {
  test('awards the entire pot to one winner', async () => {
    const table = createTable([
      ['player-1', 90],
      ['player-2', 80]
    ]);

    const game = createGame(30, [
      ['player-1'],
      ['player-2']
    ]);

    const result = await settleHand(
      game, table, ['player-1'], null
    );

    expect(table.PlayerStacks[0].Chips).toBe(120);
    expect(table.PlayerStacks[1].Chips).toBe(80);

    expect(result.pot).toBe(30);
    expect(result.payouts).toEqual([
      { playerId: 'player-1', amount: 30 }
    ]);
  });

  test('splits the pot evenly between tied winners', async () => {
    const table = createTable([
      ['player-1', 90],
      ['player-2', 90]
    ]);

    const game = createGame(20, [
      ['player-1'],
      ['player-2']
    ]);

    await settleHand(
      game, table, ['player-1', 'player-2'], null
    );

    expect(table.PlayerStacks[0].Chips).toBe(100);
    expect(table.PlayerStacks[1].Chips).toBe(100);
  });

  test('distributes remainder chips without losing chips', async () => {
    const table = createTable([
      ['player-1', 90],
      ['player-2', 90]
    ]);

    const game = createGame(21, [
      ['player-1'],
      ['player-2']
    ]);

    await settleHand(
      game, table, ['player-1', 'player-2'], null
    );

    expect(table.PlayerStacks[0].Chips).toBe(101);
    expect(table.PlayerStacks[1].Chips).toBe(100);
  });

  test('keeps the table open and preserves chip stacks', async () => {
    const table = createTable([
      ['player-1', 90],
      ['player-2', 80]
    ]);

    const game = createGame(30, [
      ['player-1'],
      ['player-2']
    ]);

    await settleHand(game, table, ['player-1'], null);

    expect(table.Status).toBe('In Progress');
    expect(table.PlayerStacks[0].Chips).toBe(120);
    expect(table.PlayerStacks[1].Chips).toBe(80);

    expect(game.Status).toBe('Completed');
    expect(game.WinnerIds).toEqual(['player-1']);

    expect(table.save).toHaveBeenCalledTimes(1);
  });

  test('rejects a second settlement of the same hand', async () => {
    const table = createTable([
      ['player-1', 90]
    ]);

    const game = createGame(10, [
      ['player-1']
    ]);

    await settleHand(game, table, ['player-1'], null);

    await expect(
      settleHand(game, table, ['player-1'], null)
    ).rejects.toThrow('Hand has already been settled');

    expect(table.PlayerStacks[0].Chips).toBe(100);
  });

  test('rejects a folded player as a winner', async () => {
    const table = createTable([
      ['player-1', 90],
      ['player-2', 90]
    ]);

    const game = createGame(20, [
      ['player-1', true],
      ['player-2', false]
    ]);

    await expect(
      settleHand(game, table, ['player-1'], null)
    ).rejects.toThrow('Invalid winner IDs');
  });
});

describe('P53 - Continuous Gameplay Settlement', () => {
  test('saves winner payout in HandResults', async () => {
    const table = createTable([
      ['player-1', 90],
      ['player-2', 80]
    ]);

    const game = createGame(30, [
      ['player-1'],
      ['player-2']
    ]);

    const result = await settleHand(
      game, table, ['player-1'], null
    );

    expect(game.HandResults).toEqual([
      {
        PlayerId: 'player-1',
        AmountWon: 30,
        HandName: null
      }
    ]);

    expect(result.handResults).toEqual(game.HandResults);
  });

  test('records winning hand name when seven cards exist', async () => {
    const cards = Array.from(
      { length: 7 },
      (_, index) => ({
        rank: String(index + 2),
        suit: 'Hearts',
        faceUp: index >= 2
      })
    );

    const table = createTable([
      ['player-1', 90],
      ['player-2', 80]
    ]);

    const game = createGame(30, [
      ['player-1', false, cards],
      ['player-2']
    ]);

    await settleHand(
      game, table, ['player-1'], null
    );

    expect(evaluateSevenCardHand).toHaveBeenCalledWith(cards);

    expect(game.HandResults).toEqual([
      {
        PlayerId: 'player-1',
        AmountWon: 30,
        HandName: 'Full House'
      }
    ]);
  });

  test('sets the next hand countdown to 30 seconds', async () => {
    const table = createTable([
      ['player-1', 90],
      ['player-2', 80]
    ]);

    const game = createGame(30, [
      ['player-1'],
      ['player-2']
    ]);

    const before = Date.now();

    const result = await settleHand(
      game, table, ['player-1'], null
    );

    const after = Date.now();

    expect(game.CompletedAt).toBeInstanceOf(Date);
    expect(game.NextHandAt).toBeInstanceOf(Date);

    expect(game.CompletedAt.getTime())
      .toBeGreaterThanOrEqual(before);

    expect(game.CompletedAt.getTime())
      .toBeLessThanOrEqual(after);

    expect(
      game.NextHandAt.getTime() -
      game.CompletedAt.getTime()
    ).toBe(30000);

    expect(result.completedAt).toEqual(game.CompletedAt);
    expect(result.nextHandAt).toEqual(game.NextHandAt);
  });

  test('stores results for tied winners', async () => {
    const table = createTable([
      ['player-1', 90],
      ['player-2', 90]
    ]);

    const game = createGame(21, [
      ['player-1'],
      ['player-2']
    ]);

    await settleHand(
      game, table, ['player-1', 'player-2'], null
    );

    expect(game.HandResults).toEqual([
      {
        PlayerId: 'player-1',
        AmountWon: 11,
        HandName: null
      },
      {
        PlayerId: 'player-2',
        AmountWon: 10,
        HandName: null
      }
    ]);

    expect(game.WinnerIds).toEqual([
      'player-1',
      'player-2'
    ]);
  });

  test('does not reset countdown after duplicate settlement', async () => {
    const table = createTable([
      ['player-1', 90]
    ]);

    const game = createGame(10, [
      ['player-1']
    ]);

    await settleHand(game, table, ['player-1'], null);

    const originalDeadline = game.NextHandAt;

    await expect(
      settleHand(game, table, ['player-1'], null)
    ).rejects.toThrow('Hand has already been settled');

    expect(game.NextHandAt).toBe(originalDeadline);
    expect(table.PlayerStacks[0].Chips).toBe(100);
    expect(table.save).toHaveBeenCalledTimes(1);
  });
});
