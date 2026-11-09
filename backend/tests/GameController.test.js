const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');
const { performBettingAction } = require('../service/BettingService');
const { runBotTurns } = require('../service/BotService');
const GameController = require('../controller/GameController');

jest.mock('../model/GameDao');
jest.mock('../model/TableDao');
jest.mock('../service/GameService');
jest.mock('../service/BettingService');
jest.mock('../service/BotService');

describe('GameController bot turns', () => {
  const gameId = '507f1f77bcf86cd799439011';
  const userId = '507f191e810c19729de860ea';
  const botId = 'bot-table-1';
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      session: { userId },
      params: { gameId },
      body: { action: 'call' },
    };
    res = {
      status: jest.fn(function(statusCode) {
        this.statusCode = statusCode;
        return this;
      }),
      json: jest.fn(function(body) {
        this.body = body;
        return this;
      }),
    };

    GameDao.findById.mockResolvedValue({
      _id: gameId,
      TableId: 'table-1',
    });
    TableDao.findById.mockResolvedValue({
      UserIds: [userId],
    });
    runBotTurns.mockResolvedValue({
      game: {
        _id: gameId,
        Status: 'In Progress',
        Pot: 8,
        CurrentBet: 2,
        CurrentTurnPlayerId: userId,
        BettingRoundComplete: false,
        RaiseCount: 0,
      },
      actions: [{ playerId: botId, action: 'call' }],
    });
  });

  test('runs bot turns after a human action and reports what they did', async () => {
    await GameController.performBettingAction(req, res);

    expect(performBettingAction).toHaveBeenCalledWith(
      gameId,
      userId,
      'call'
    );
    expect(runBotTurns).toHaveBeenCalledWith(gameId);
    expect(res.statusCode).toBe(200);
    expect(res.body.botActions).toEqual([
      { playerId: botId, action: 'call' },
    ]);
  });
});


describe('GameController additional coverage', () => {
  const gameId = '507f1f77bcf86cd799439011';
  const tableId = '507f1f77bcf86cd799439012';
  const userId = '507f191e810c19729de860ea';
  const outsiderId = '507f191e810c19729de860eb';

  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      session: { userId },
      params: { gameId, tableId },
      body: { action: 'call' },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    GameDao.findById.mockResolvedValue({
      _id: gameId,
      TableId: tableId,
      Players: [],
      WinnerIds: [],
      Street: 3,
      Status: 'In Progress',
    });

    TableDao.findById.mockResolvedValue({
      UserIds: [userId],
      PlayerStacks: [{ PlayerId: userId, Chips: 100 }],
    });

    runBotTurns.mockResolvedValue({
      game: {
        _id: gameId,
        TableId: tableId,
        Street: 3,
        Status: 'In Progress',
        Pot: 10,
        CurrentBet: 2,
        CurrentTurnPlayerId: userId,
        BettingRoundComplete: false,
        RaiseCount: 0,
        WinnerIds: [],
      },
      actions: [],
    });
  });

  describe('startGame', () => {
    const GameService = require('../service/GameService');

    test('rejects unauthenticated users', async () => {
      req.session = {};

      await GameController.startGame(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('rejects invalid table IDs', async () => {
      req.params.tableId = 'invalid';

      await GameController.startGame(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 404 when table does not exist', async () => {
      TableDao.findById.mockResolvedValue(null);

      await GameController.startGame(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('rejects users who are not seated', async () => {
      req.session.userId = outsiderId;

      await GameController.startGame(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('starts a game successfully and runs bot turns', async () => {
      GameService.startGame.mockResolvedValue({ _id: gameId });

      await GameController.startGame(req, res);

      expect(GameService.startGame).toHaveBeenCalledWith(tableId);
      expect(runBotTurns).toHaveBeenCalledWith(gameId);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Game started successfully',
          gameId,
          botActions: [],
        })
      );
    });

    test.each([
      ['Table not found', 404],
      ['Table is not waiting for a game', 409],
      ['A game must have between 2 and 6 players', 400],
    ])('maps "%s" to HTTP %i', async (message, status) => {
      GameService.startGame.mockRejectedValue(new Error(message));

      await GameController.startGame(req, res);

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({ error: message });
    });
  });

  describe('getGame', () => {
    test('rejects unauthenticated users', async () => {
      req.session = {};

      await GameController.getGame(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('rejects invalid game IDs', async () => {
      req.params.gameId = 'invalid';

      await GameController.getGame(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 404 when game does not exist', async () => {
      GameDao.findById.mockResolvedValue(null);

      await GameController.getGame(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 404 when table does not exist', async () => {
      TableDao.findById.mockResolvedValue(null);

      await GameController.getGame(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('rejects users who are not seated', async () => {
      req.session.userId = outsiderId;

      await GameController.getGame(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('returns game state for a seated player', async () => {
      await GameController.getGame(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          gameId,
          tableId,
          status: 'In Progress',
          playerStacks: [
            { playerId: userId, chips: 100 },
          ],
        })
      );
    });
  });

  describe('performBettingAction', () => {
    test('rejects unauthenticated users', async () => {
      req.session = {};

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('rejects invalid game IDs', async () => {
      req.params.gameId = 'invalid';

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects invalid betting actions', async () => {
      req.body.action = 'dance';

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid betting action',
      });
    });

    test('returns 404 when game does not exist', async () => {
      GameDao.findById.mockResolvedValue(null);

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 404 when table does not exist', async () => {
      TableDao.findById.mockResolvedValue(null);

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('rejects users who are not seated', async () => {
      req.session.userId = outsiderId;

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test.each([
      'Cannot check when facing a bet',
      'Nothing to call',
      'Insufficient chips',
      'Player cannot act',
    ])('returns 400 for "%s"', async (message) => {
      performBettingAction.mockRejectedValue(new Error(message));

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: message });
    });

    test.each([
      'Game is not in progress',
      'Betting round is complete',
      'Maximum raises reached',
    ])('returns 409 for "%s"', async (message) => {
      performBettingAction.mockRejectedValue(new Error(message));

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: message });
    });
  });
});
