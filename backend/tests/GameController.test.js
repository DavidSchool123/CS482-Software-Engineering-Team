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
