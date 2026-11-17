
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

  const completedGame = {
    _id: previousGameId,
    TableId: tableId
  };

  const activeGame = {
    _id: nextGameId,
    TableId: tableId,
    Status: 'In Progress',
    Street: 3
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // The scheduler queries completed games and
    // selects only their IDs and table IDs.
    GameDao.GameModel.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([completedGame])
    });

    TableDao.findById.mockResolvedValue({
      _id: tableId,
      Status: 'In Progress',
      CurrentGameID: previousGameId
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
  });

  afterEach(() => {
    stopNextHandScheduler();
    jest.restoreAllMocks();
  });

  // -----------------------------------------
  // Finding completed hands
  // -----------------------------------------

  test('finds completed hands whose countdown has expired', async () => {
    await checkCompletedHands();

    expect(GameDao.GameModel.find).toHaveBeenCalledWith({
      Status: 'Completed',
      NextHandAt: {
        $lte: expect.any(Date)
      }
    });

    expect(GameDao.GameModel.find)
      .toHaveBeenCalledTimes(1);
  });

  test('does nothing when no completed hands are due', async () => {
    GameDao.GameModel.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([])
    });

    await checkCompletedHands();

    expect(GameService.startNextHand)
      .not.toHaveBeenCalled();

    expect(runBotTurns)
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

  // -----------------------------------------
  // Preventing invalid hand progression
  // -----------------------------------------

  test('ignores a completed hand that is no longer current', async () => {
    TableDao.findById.mockResolvedValue({
      _id: tableId,
      Status: 'In Progress',
      CurrentGameID: 'different-game'
    });

    await checkCompletedHands();

    expect(GameService.startNextHand)
      .not.toHaveBeenCalled();
  });

  test('ignores a table that is no longer in progress', async () => {
    TableDao.findById.mockResolvedValue({
      _id: tableId,
      Status: 'Closed',
      CurrentGameID: previousGameId
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
