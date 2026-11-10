
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

const {
  runBotTurns
} = require('../service/BotService');

const {
  scheduleTurnTimer,
  cancelTurnTimer,
  clearAllTurnTimers
} = require('../service/PlayerActivityService');

function createGame(overrides = {}) {
  return {
    _id: 'game-1',
    Status: 'In Progress',
    CurrentTurnPlayerId: 'player-1',
    BettingRoundComplete: false,
    AwaitingNextRound: false,
    Players: [
      {
        PlayerId: 'player-1',
        HasFolded: false
      }
    ],
    ...overrides
  };
}

beforeEach(() => {
  jest.useFakeTimers();

  clearAllTurnTimers();
  jest.clearAllMocks();

  process.env.PLAYER_TURN_TIMEOUT_MS = '1000';
});

afterEach(() => {
  clearAllTurnTimers();

  jest.useRealTimers();

  delete process.env.PLAYER_TURN_TIMEOUT_MS;
});

describe('P31 - Player Turn Timeout', () => {

  test('schedules a timer for the current human player', () => {
    scheduleTurnTimer(createGame());

    expect(jest.getTimerCount()).toBe(1);
  });

  test('does not schedule timers for bots or completed games', () => {
    scheduleTurnTimer(
      createGame({
        CurrentTurnPlayerId: 'bot-table-1'
      })
    );

    scheduleTurnTimer(
      createGame({
        Status: 'Completed'
      })
    );

    expect(jest.getTimerCount()).toBe(0);
  });

  test('cancels an existing timer', () => {
    scheduleTurnTimer(createGame());

    cancelTurnTimer('game-1');

    expect(jest.getTimerCount()).toBe(0);
  });

  test('automatically folds a player when their timer expires', async () => {
    const updatedGame = createGame({
      CurrentTurnPlayerId: 'player-2'
    });

    GameDao.findById.mockResolvedValue(createGame());

    runBotTurns.mockResolvedValue({
      game: updatedGame,
      actions: []
    });

    scheduleTurnTimer(createGame());

    await jest.advanceTimersByTimeAsync(1000);

    expect(performBettingAction).toHaveBeenCalledWith(
      'game-1',
      'player-1',
      'fold'
    );

    expect(runBotTurns).toHaveBeenCalledWith('game-1');
  });

  test('does not fold if the player turn has already changed', async () => {
    GameDao.findById.mockResolvedValue(
      createGame({
        CurrentTurnPlayerId: 'player-2'
      })
    );

    scheduleTurnTimer(createGame());

    await jest.advanceTimersByTimeAsync(1000);

    expect(performBettingAction).not.toHaveBeenCalled();
  });

});
