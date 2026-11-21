
const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');
const UserDao = require('../model/UserDao');
const GameActionEvent = require('../model/GameActionEvent');
const GameService = require('../service/GameService');
const { performBettingAction } = require('../service/BettingService');
const { runBotTurns } = require('../service/BotService');
const { getVisiblePlayers } = require('../service/GameViewService');
const {
  scheduleTurnTimer,
  cancelTurnTimer,
  getTurnDeadline
} = require('../service/PlayerActivityService');
const GameController = require('../controller/GameController');

jest.mock('../model/GameDao');
jest.mock('../model/TableDao');
jest.mock('../model/UserDao');
jest.mock('../model/GameActionEvent');
jest.mock('../service/GameService');
jest.mock('../service/BettingService');
jest.mock('../service/BotService');
jest.mock('../service/GameViewService');
jest.mock('../service/PlayerActivityService');

describe('GameController', () => {
  const gameId = '507f1f77bcf86cd799439011';
  const tableId = '507f1f77bcf86cd799439012';
  const userId = '507f191e810c19729de860ea';
  const outsiderId = '507f191e810c19729de860eb';
  const botId = 'bot-table-1';

  let req;
  let res;
  let game;
  let table;

  beforeEach(() => {
    jest.resetAllMocks();

    req = {
      session: { userId },
      params: { gameId, tableId },
      body: { action: 'call' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    game = {
      _id: gameId,
      TableId: tableId,
      Players: [
        {
          PlayerId: userId,
          HasFolded: false,
          Cards: []
        },
        {
          PlayerId: botId,
          HasFolded: false,
          Cards: []
        }
      ],
      WinnerIds: [],
      Street: 3,
      Status: 'In Progress',
      Pot: 10,
      CurrentBet: 2,
      CurrentTurnPlayerId: userId,
      BettingRoundComplete: false,
      RaiseCount: 0,
      HandResults: []
    };

    table = {
      _id: tableId,
      UserIds: [userId],
      IsPublic: false,
      CurrentGameID: gameId,
      PlayerStacks: [
        { PlayerId: userId, Chips: 100 }
      ]
    };

    GameDao.findById.mockResolvedValue(game);
    TableDao.findById.mockResolvedValue(table);

    GameService.startGame.mockResolvedValue(game);

    GameService.startNextHand.mockResolvedValue({
      game,
      sittingOutPlayerIds: []
    });

    performBettingAction.mockResolvedValue(game);

    runBotTurns.mockResolvedValue({
      game,
      actions: []
    });

    getVisiblePlayers.mockImplementation(players => players);
    getTurnDeadline.mockReturnValue(null);

    UserDao.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        { _id: userId, username: 'Tester' }
      ])
    });

    GameActionEvent.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([])
        })
      })
    });
  });

  // -----------------------------------------
  // Start game
  // -----------------------------------------

  describe('startGame', () => {
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

    test('starts a game and runs bot turns', async () => {
      await GameController.startGame(req, res);

      expect(GameService.startGame)
        .toHaveBeenCalledWith(tableId);

      expect(runBotTurns)
        .toHaveBeenCalledWith(gameId);

      expect(scheduleTurnTimer)
        .toHaveBeenCalledWith(game);

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Game started successfully',
          gameId,
          botActions: []
        })
      );
    });

    test('does not schedule a timer if bots finish the hand', async () => {
      runBotTurns.mockResolvedValue({
        game: { ...game, Status: 'Completed' },
        actions: []
      });

      await GameController.startGame(req, res);

      expect(scheduleTurnTimer)
        .not.toHaveBeenCalled();
    });

    test.each([
      ['Table not found', 404],
      ['Table is not waiting for a game', 409],
      ['A game must have between 2 and 6 players', 400]
    ])('maps "%s" to HTTP %i', async (message, status) => {
      GameService.startGame.mockRejectedValue(
        new Error(message)
      );

      await GameController.startGame(req, res);

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({
        error: message
      });
    });
  });

  // -----------------------------------------
  // Get game
  // -----------------------------------------

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

    test('rejects outsiders from private tables', async () => {
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
            { playerId: userId, chips: 100 }
          ],
          playerNames: [
            { playerId: userId, username: 'Tester' },
            { playerId: botId, username: 'Bot 1' }
          ],
          actionEvents: [],
          sittingOutPlayerIds: []
        })
      );

      expect(getVisiblePlayers).toHaveBeenCalledWith(
        game.Players,
        userId,
        []
      );

      expect(getTurnDeadline)
        .toHaveBeenCalledWith(gameId);
    });

    test('allows spectators at public tables', async () => {
      table.IsPublic = true;
      req.session.userId = outsiderId;

      await GameController.getGame(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(getVisiblePlayers).toHaveBeenCalledWith(
        game.Players,
        outsiderId,
        []
      );
    });

    test('reveals non-folded players at completed showdown', async () => {
      game.Status = 'Completed';

      await GameController.getGame(req, res);

      expect(getVisiblePlayers).toHaveBeenCalledWith(
        game.Players,
        userId,
        [userId, botId]
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isShowdown: true
        })
      );
    });

    test('does not reveal private cards when only one player remains', async () => {
      game.Status = 'Completed';
      game.Players[1].HasFolded = true;

      await GameController.getGame(req, res);

      expect(getVisiblePlayers).toHaveBeenCalledWith(
        game.Players,
        userId,
        []
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isShowdown: false
        })
      );
    });

    test('returns recent actions in chronological order', async () => {
      const newer = {
        _id: 'event2',
        playerId: botId,
        action: 'call',
        amount: 2,
        street: 3,
        createdAt: new Date('2026-11-21T10:01:00Z')
      };

      const older = {
        _id: 'event1',
        playerId: userId,
        action: 'bet',
        amount: 5,
        street: 3,
        createdAt: new Date('2026-11-21T10:00:00Z')
      };

      const lean = jest.fn().mockResolvedValue([
        newer,
        older
      ]);

      const limit = jest.fn().mockReturnValue({ lean });
      const sort = jest.fn().mockReturnValue({ limit });

      GameActionEvent.find.mockReturnValue({ sort });

      await GameController.getGame(req, res);

      expect(GameActionEvent.find).toHaveBeenCalledWith({
        gameId
      });

      expect(sort).toHaveBeenCalledWith({ _id: -1 });
      expect(limit).toHaveBeenCalledWith(40);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          actionEvents: [
            expect.objectContaining({
              id: 'event1',
              action: 'bet'
            }),
            expect.objectContaining({
              id: 'event2',
              action: 'call'
            })
          ]
        })
      );
    });

    test('identifies sitting-out players', async () => {
      table.UserIds.push(outsiderId);

      await GameController.getGame(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sittingOutPlayerIds: [outsiderId]
        })
      );
    });
  });

  // -----------------------------------------
  // Perform betting action
  // -----------------------------------------

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
        error: 'Invalid betting action'
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

    test('runs bot turns after a human action and reports them', async () => {
      runBotTurns.mockResolvedValue({
        game,
        actions: [
          { playerId: botId, action: 'call' }
        ]
      });

      await GameController.performBettingAction(req, res);

      expect(performBettingAction).toHaveBeenCalledWith(
        gameId,
        userId,
        'call'
      );

      expect(cancelTurnTimer)
        .toHaveBeenCalledWith(gameId);

      expect(runBotTurns)
        .toHaveBeenCalledWith(gameId);

      expect(scheduleTurnTimer)
        .toHaveBeenCalledWith(game);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          botActions: [
            { playerId: botId, action: 'call' }
          ]
        })
      );
    });

    test('does not schedule a turn timer for a completed game', async () => {
      runBotTurns.mockResolvedValue({
        game: { ...game, Status: 'Completed' },
        actions: []
      });

      await GameController.performBettingAction(req, res);

      expect(cancelTurnTimer)
        .toHaveBeenCalledWith(gameId);

      expect(scheduleTurnTimer)
        .not.toHaveBeenCalled();
    });

    test.each([
      'Cannot check when facing a bet',
      'Nothing to call',
      'Insufficient chips',
      'Player cannot act'
    ])('returns 400 for "%s"', async message => {
      performBettingAction.mockRejectedValue(
        new Error(message)
      );

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        error: message
      });
    });

    test.each([
      'Game is not in progress',
      'Betting round is complete',
      'Maximum raises reached'
    ])('returns 409 for "%s"', async message => {
      performBettingAction.mockRejectedValue(
        new Error(message)
      );

      await GameController.performBettingAction(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        error: message
      });
    });
  });

  // -----------------------------------------
  // Start next hand
  // -----------------------------------------

  describe('startNextHand', () => {
    test('rejects invalid table IDs', async () => {
      req.params.tableId = 'invalid';

      await GameController.startNextHand(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('starts the next hand and runs bots', async () => {
      await GameController.startNextHand(req, res);

      expect(GameService.startNextHand)
        .toHaveBeenCalledWith(tableId);

      expect(runBotTurns)
        .toHaveBeenCalledWith(gameId);

      expect(scheduleTurnTimer)
        .toHaveBeenCalledWith(game);

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Next hand started successfully',
          gameId,
          sittingOutPlayerIds: []
        })
      );
    });

    test('does not schedule timer when hand already completed', async () => {
      runBotTurns.mockResolvedValue({
        game: { ...game, Status: 'Completed' },
        actions: []
      });

      await GameController.startNextHand(req, res);

      expect(scheduleTurnTimer)
        .not.toHaveBeenCalled();
    });

    test.each([
      'Table is not in progress',
      'Table has no current game',
      'Previous hand is not completed',
      'Next hand countdown has not finished',
      'Not enough players with chips to start another hand',
      'Another request has already started the next hand'
    ])('returns 409 for "%s"', async message => {
      GameService.startNextHand.mockRejectedValue(
        new Error(message)
      );

      await GameController.startNextHand(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        error: message
      });
    });
  });
});
