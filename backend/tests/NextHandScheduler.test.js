
const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');
const GameService = require('../service/GameService');

const { runBotTurns } = require('../service/BotService');

const {
  scheduleTurnTimer
} = require('../service/PlayerActivityService');

const {
  checkCompletedHands,
  startNextHandScheduler,
  stopNextHandScheduler
} = require('../service/NextHandScheduler');

jest.mock('../model/GameDao');
jest.mock('../model/TableDao');
jest.mock('../service/GameService');
jest.mock('../service/BotService');
jest.mock('../service/PlayerActivityService');

describe('P53 - Next Hand Scheduler', () => {
  const tableId = '507f1f77bcf86cd799439011';
  const previousGameId = '507f1f77bcf86cd799439012';
  const nextGameId = '507f1f77bcf86cd799439013';

  const activeTable = {
    _id: tableId,
    Status: 'In Progress',
    CurrentGameID: previousGameId
  };

  const completedGame = {
    _id: previousGameId,
    TableId: tableId,
    NextHandAt: new Date(Date.now() - 1000)
  };

  const activeGame = {
    _id: nextGameId,
    TableId: tableId,
    Status: 'In Progress',
    Street: 3
  };

  function mockActiveTables(tables) {
    TableDao.TableModel.find.mockReturnValue({
      select: jest.fn().mockResolvedValue(tables)
    });
  }

  function mockCompletedGames(games) {
    GameDao.GameModel.find.mockReturnValue({
      select: jest.fn().mockResolvedValue(games)
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // First query: find active tables.
    mockActiveTables([activeTable]);

    // Second query: find completed current games.
    mockCompletedGames([completedGame]);

    // Confirm that the table still references the game.
    TableDao.findById.mockResolvedValue({
      ...activeTable
    });

    GameService.startNextHand.mockResolvedValue({
      game: activeGame,
      sittingOutPlayerIds: []
    });

    runBotTurns.mockResolvedValue({
      game: activeGame,
      actions: []
    });

    scheduleTurnTimer.mockImplementation(() => {});

    jest.spyOn(console, 'log')
      .mockImplementation(() => {});

    jest.spyOn(console, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    stopNextHandScheduler();
    jest.restoreAllMocks();
  });

  // -----------------------------------------
  // Finding active tables
  // -----------------------------------------

  test('finds active tables with a current game', async () => {
    await checkCompletedHands();

    expect(TableDao.TableModel.find).toHaveBeenCalledWith({
      Status: 'In Progress',
      CurrentGameID: { $ne: null }
    });

    expect(TableDao.TableModel.find)
      .toHaveBeenCalledTimes(1);
  });

  test('does nothing when no active tables exist', async () => {
    mockActiveTables([]);

    await checkCompletedHands();

    expect(GameDao.GameModel.find)
      .not.toHaveBeenCalled();

    expect(GameService.startNextHand)
      .not.toHaveBeenCalled();

    expect(runBotTurns)
      .not.toHaveBeenCalled();
  });

  // -----------------------------------------
  // Finding completed hands
  // -----------------------------------------

  test('finds completed current games whose countdown expired', async () => {
    await checkCompletedHands();

    expect(GameDao.GameModel.find).toHaveBeenCalledWith({
      _id: {
        $in: [previousGameId]
      },
      Status: 'Completed',
      NextHandAt: {
        $lte: expect.any(Date)
      }
    });

    expect(GameDao.GameModel.find)
      .toHaveBeenCalledTimes(1);
  });

  test('selects only the required game fields', async () => {
    const select = jest.fn()
      .mockResolvedValue([completedGame]);

    GameDao.GameModel.find.mockReturnValue({
      select
    });

    await checkCompletedHands();

    expect(select).toHaveBeenCalledWith(
      '_id TableId NextHandAt'
    );
  });

  test('does nothing when no completed hands are due', async () => {
    mockCompletedGames([]);

    await checkCompletedHands();

    expect(GameService.startNextHand)
      .not.toHaveBeenCalled();

    expect(runBotTurns)
      .not.toHaveBeenCalled();

    expect(scheduleTurnTimer)
      .not.toHaveBeenCalled();
  });

  // -----------------------------------------
  // Starting the next hand
  // -----------------------------------------

  test('automatically starts the next hand', async () => {
    await checkCompletedHands();

    expect(GameService.startNextHand)
      .toHaveBeenCalledWith(tableId);

    expect(GameService.startNextHand)
      .toHaveBeenCalledTimes(1);
  });

  test('runs bot turns after creating the next hand', async () => {
    await checkCompletedHands();

    expect(runBotTurns)
      .toHaveBeenCalledWith(nextGameId);
  });

  test('schedules the next human player turn', async () => {
    await checkCompletedHands();

    expect(scheduleTurnTimer)
      .toHaveBeenCalledWith(activeGame);

    expect(scheduleTurnTimer)
      .toHaveBeenCalledTimes(1);
  });

  test('does not schedule a timer for a completed game', async () => {
    runBotTurns.mockResolvedValue({
      game: {
        ...activeGame,
        Status: 'Completed'
      },
      actions: []
    });

    await checkCompletedHands();

    expect(scheduleTurnTimer)
      .not.toHaveBeenCalled();
  });

  test('starts the next hand before running bot turns', async () => {
    const callOrder = [];

    GameService.startNextHand.mockImplementation(async () => {
      callOrder.push('startNextHand');

      return {
        game: activeGame,
        sittingOutPlayerIds: []
      };
    });

    runBotTurns.mockImplementation(async () => {
      callOrder.push('runBotTurns');

      return {
        game: activeGame,
        actions: []
      };
    });

    await checkCompletedHands();

    expect(callOrder).toEqual([
      'startNextHand',
      'runBotTurns'
    ]);
  });

  // -----------------------------------------
  // Preventing invalid progression
  // -----------------------------------------

  test('ignores a completed game that is no longer current', async () => {
    TableDao.findById.mockResolvedValue({
      ...activeTable,
      CurrentGameID: 'different-game'
    });

    await checkCompletedHands();

    expect(GameService.startNextHand)
      .not.toHaveBeenCalled();
  });

  test('ignores a table that is no longer in progress', async () => {
    TableDao.findById.mockResolvedValue({
      ...activeTable,
      Status: 'Closed'
    });

    await checkCompletedHands();

    expect(GameService.startNextHand)
      .not.toHaveBeenCalled();
  });

  test('ignores a deleted table', async () => {
    TableDao.findById.mockResolvedValue(null);

    await checkCompletedHands();

    expect(GameService.startNextHand)
      .not.toHaveBeenCalled();
  });

  test('handles insufficient eligible players without crashing', async () => {
    GameService.startNextHand.mockRejectedValue(
      new Error(
        'Not enough players with chips to start another hand'
      )
    );

    await expect(
      checkCompletedHands()
    ).resolves.toBeUndefined();

    expect(runBotTurns)
      .not.toHaveBeenCalled();

    expect(scheduleTurnTimer)
      .not.toHaveBeenCalled();
  });

  test('handles duplicate hand advancement safely', async () => {
    GameService.startNextHand.mockRejectedValue(
      new Error(
        'Another request has already started the next hand'
      )
    );

    await expect(
      checkCompletedHands()
    ).resolves.toBeUndefined();

    expect(runBotTurns)
      .not.toHaveBeenCalled();
  });

  test('handles unexpected errors without crashing', async () => {
    GameService.startNextHand.mockRejectedValue(
      new Error('Unexpected database error')
    );

    await expect(
      checkCompletedHands()
    ).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      '[Next Hand] Error advancing game:',
      previousGameId,
      expect.any(Error)
    );
  });

  // -----------------------------------------
  // Multiple tables
  // -----------------------------------------

  test('processes multiple completed hands', async () => {
    const secondTableId = '507f1f77bcf86cd799439014';
    const secondPreviousGameId =
      '507f1f77bcf86cd799439015';

    mockActiveTables([
      activeTable,
      {
        _id: secondTableId,
        CurrentGameID: secondPreviousGameId
      }
    ]);

    mockCompletedGames([
      completedGame,
      {
        _id: secondPreviousGameId,
        TableId: secondTableId
      }
    ]);

    TableDao.findById.mockImplementation(async id => {
      if (String(id) === secondTableId) {
        return {
          _id: secondTableId,
          Status: 'In Progress',
          CurrentGameID: secondPreviousGameId
        };
      }

      return { ...activeTable };
    });

    GameService.startNextHand.mockImplementation(
      async id => ({
        game: {
          ...activeGame,
          _id: id === secondTableId
            ? '507f1f77bcf86cd799439016'
            : nextGameId
        },
        sittingOutPlayerIds: []
      })
    );

    await checkCompletedHands();

    expect(GameService.startNextHand)
      .toHaveBeenCalledTimes(2);

    expect(GameService.startNextHand)
      .toHaveBeenCalledWith(tableId);

    expect(GameService.startNextHand)
      .toHaveBeenCalledWith(secondTableId);

    expect(runBotTurns)
      .toHaveBeenCalledTimes(2);
  });

  // -----------------------------------------
  // Scheduler lifecycle
  // -----------------------------------------

  test('starts and stops the scheduler', () => {
    const intervalSpy = jest.spyOn(global, 'setInterval');
    const clearSpy = jest.spyOn(global, 'clearInterval');

    startNextHandScheduler();

    expect(intervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      1000
    );

    stopNextHandScheduler();

    expect(clearSpy).toHaveBeenCalled();
  });

  test('does not start duplicate scheduler intervals', () => {
    const intervalSpy = jest.spyOn(global, 'setInterval');

    startNextHandScheduler();
    startNextHandScheduler();

    expect(intervalSpy).toHaveBeenCalledTimes(1);
  });

});
