
jest.mock('../model/GameDao', () => ({
  findById: jest.fn()
}));

jest.mock('../service/BettingService', () => ({
  performBettingAction: jest.fn()
}));

jest.mock('../service/BotService', () => ({
  runBotTurns: jest.fn()
}));

const GameDao = require('../model/GameDao');
const {
  performBettingAction
} = require('../service/BettingService');
const { runBotTurns } = require('../service/BotService');

const {
  scheduleTurnTimer,
  cancelTurnTimer,
  clearAllTurnTimers,
  getTurnTimeoutMs,
  getTurnDeadline
} = require('../service/PlayerActivityService');

describe('PlayerActivityService', () => {
  let game;
  let consoleLogSpy;
  let consoleErrorSpy;

  const gameId = 'game-123';
  const playerId = 'player-1';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(
      new Date('2026-11-20T12:00:00.000Z')
    );

    delete process.env.PLAYER_TURN_TIMEOUT_MS;

    jest.clearAllMocks();
    clearAllTurnTimers();

    consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    game = {
      _id: gameId,
      Status: 'In Progress',
      Street: 3,
      CurrentTurnPlayerId: playerId,
      CurrentBet: 10,
      BettingRoundComplete: false,
      AwaitingNextRound: false,
      Players: [
        {
          PlayerId: playerId,
          HasFolded: false,
          HasActed: false,
          RoundContribution: 0
        },
        {
          PlayerId: 'bot-123',
          HasFolded: false,
          HasActed: true,
          RoundContribution: 10
        }
      ]
    };

    GameDao.findById.mockImplementation(async () => game);

    performBettingAction.mockResolvedValue({});

    runBotTurns.mockResolvedValue({
      game: {
        ...game,
        Status: 'Completed',
        CurrentTurnPlayerId: null
      }
    });
  });

  afterEach(() => {
    clearAllTurnTimers();
    jest.useRealTimers();

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    delete process.env.PLAYER_TURN_TIMEOUT_MS;
  });

  test('uses a default 30-second timeout', () => {
    expect(getTurnTimeoutMs()).toBe(30000);
  });

  test('accepts a configured timeout', () => {
    process.env.PLAYER_TURN_TIMEOUT_MS = '5000';

    expect(getTurnTimeoutMs()).toBe(5000);
  });

  test.each([
    ['too short', '500'],
    ['negative', '-1000'],
    ['not a number', 'abc']
  ])('uses default timeout for %s configuration', (_, value) => {
    process.env.PLAYER_TURN_TIMEOUT_MS = value;

    expect(getTurnTimeoutMs()).toBe(30000);
  });

  test('schedules a timer for an active human turn', () => {
    scheduleTurnTimer(game);

    expect(getTurnDeadline(gameId)).toBe(
      '2026-11-20T12:00:30.000Z'
    );

    expect(jest.getTimerCount()).toBe(1);
  });

  test('does not schedule a timer for a bot turn', () => {
    game.CurrentTurnPlayerId = 'bot-123';

    scheduleTurnTimer(game);

    expect(getTurnDeadline(gameId)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('does not schedule a timer for a completed game', () => {
    game.Status = 'Completed';

    scheduleTurnTimer(game);

    expect(getTurnDeadline(gameId)).toBeNull();
  });

  test('does not schedule a timer when the betting round is complete', () => {
    game.BettingRoundComplete = true;

    scheduleTurnTimer(game);

    expect(getTurnDeadline(gameId)).toBeNull();
  });

  test('does not schedule a timer while awaiting the next round', () => {
    game.AwaitingNextRound = true;

    scheduleTurnTimer(game);

    expect(getTurnDeadline(gameId)).toBeNull();
  });

  test('does not schedule a timer for a folded player', () => {
    game.Players[0].HasFolded = true;

    scheduleTurnTimer(game);

    expect(getTurnDeadline(gameId)).toBeNull();
  });

  test('does not schedule a timer for a missing player', () => {
    game.CurrentTurnPlayerId = 'unknown-player';

    scheduleTurnTimer(game);

    expect(getTurnDeadline(gameId)).toBeNull();
  });

  test('does not schedule a timer for a missing game ID', () => {
    delete game._id;

    scheduleTurnTimer(game);

    expect(jest.getTimerCount()).toBe(0);
  });

  test('preserves the deadline when scheduling the same turn again', () => {
    scheduleTurnTimer(game);

    const originalDeadline = getTurnDeadline(gameId);

    jest.advanceTimersByTime(10000);

    scheduleTurnTimer(game);

    expect(getTurnDeadline(gameId)).toBe(
      originalDeadline
    );

    expect(jest.getTimerCount()).toBe(1);
  });

  test('replaces the timer when the turn changes', () => {
    scheduleTurnTimer(game);

    jest.advanceTimersByTime(10000);

    game.CurrentTurnPlayerId = 'player-2';
    game.Players.push({
      PlayerId: 'player-2',
      HasFolded: false,
      HasActed: false,
      RoundContribution: 0
    });

    scheduleTurnTimer(game);

    expect(getTurnDeadline(gameId)).toBe(
      '2026-11-20T12:00:40.000Z'
    );

    expect(jest.getTimerCount()).toBe(1);
  });

  test('cancels an active timer', async () => {
    scheduleTurnTimer(game);

    cancelTurnTimer(gameId);

    expect(getTurnDeadline(gameId)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(30000);

    expect(performBettingAction).not.toHaveBeenCalled();
  });

  test('automatically folds a human after 30 seconds', async () => {
    scheduleTurnTimer(game);

    await jest.advanceTimersByTimeAsync(29999);

    expect(performBettingAction).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);

    expect(GameDao.findById).toHaveBeenCalledWith(gameId);

    expect(performBettingAction).toHaveBeenCalledWith(
      gameId,
      playerId,
      'fold'
    );

    expect(runBotTurns).toHaveBeenCalledWith(gameId);
    expect(getTurnDeadline(gameId)).toBeNull();
  });

  test('does not fold if the game has already completed', async () => {
    scheduleTurnTimer(game);

    game.Status = 'Completed';

    await jest.advanceTimersByTimeAsync(30000);

    expect(performBettingAction).not.toHaveBeenCalled();
    expect(getTurnDeadline(gameId)).toBeNull();
  });

  test('does not fold if another player has taken the turn', async () => {
    scheduleTurnTimer(game);

    game.CurrentTurnPlayerId = 'bot-123';

    await jest.advanceTimersByTimeAsync(30000);

    expect(performBettingAction).not.toHaveBeenCalled();
  });

  test('does not fold when the betting state changes', async () => {
    scheduleTurnTimer(game);

    game.CurrentBet = 20;

    await jest.advanceTimersByTimeAsync(30000);

    expect(performBettingAction).not.toHaveBeenCalled();
  });

  test('does not fold after clearing all timers', async () => {
    scheduleTurnTimer(game);

    clearAllTurnTimers();

    expect(getTurnDeadline(gameId)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(30000);

    expect(performBettingAction).not.toHaveBeenCalled();
  });

  test('handles a database lookup failure', async () => {
    GameDao.findById.mockRejectedValue(
      new Error('Database unavailable')
    );

    scheduleTurnTimer(game);

    await jest.advanceTimersByTimeAsync(30000);

    expect(performBettingAction).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('handles a failed automatic fold', async () => {
    performBettingAction.mockRejectedValue(
      new Error('Fold failed')
    );

    scheduleTurnTimer(game);

    await jest.advanceTimersByTimeAsync(30000);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(runBotTurns).not.toHaveBeenCalled();
  });

  test('schedules the next human turn after bot actions', async () => {
    const nextGame = {
      ...game,
      CurrentTurnPlayerId: 'player-2',
      Players: [
        ...game.Players,
        {
          PlayerId: 'player-2',
          HasFolded: false,
          HasActed: false,
          RoundContribution: 0
        }
      ]
    };

    runBotTurns.mockResolvedValue({
      game: nextGame
    });

    scheduleTurnTimer(game);

    await jest.advanceTimersByTimeAsync(30000);

    expect(getTurnDeadline(gameId)).toBe(
      '2026-11-20T12:01:00.000Z'
    );
  });
});
