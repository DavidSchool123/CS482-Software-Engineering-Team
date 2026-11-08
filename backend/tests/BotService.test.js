const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');
const { performBettingAction } = require('../service/BettingService');
const {
  chooseBotAction,
  runBotTurns,
} = require('../service/BotService');

jest.mock('../model/GameDao');
jest.mock('../model/TableDao');
jest.mock('../service/BettingService');

describe('BotService', () => {
  const botId = 'bot-table-1';

  const table = {
    Level: 'Low',
    PlayerStacks: [{ PlayerId: botId, Chips: 100 }],
  };

  function makeBotGame(overrides = {}) {
    return {
      _id: 'game-1',
      TableId: 'table-1',
      Status: 'In Progress',
      Street: 3,
      CurrentBet: 2,
      CurrentTurnPlayerId: botId,
      Pot: 10,
      RaiseCount: 0,
      Players: [
        {
          PlayerId: botId,
          Cards: [
            { rank: 'A', suit: 'Hearts', faceUp: false },
            { rank: 'A', suit: 'Clubs', faceUp: false },
            { rank: '4', suit: 'Spades', faceUp: true },
          ],
          RoundContribution: 0,
          HasFolded: false,
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('chooses a call with a pair', () => {
    const game = makeBotGame();

    expect(chooseBotAction(game, game.Players[0], table)).toBe('call');
  });

  test('folds a weak hand when the call is expensive', () => {
    const game = makeBotGame({
      CurrentBet: 20,
      Pot: 10,
      Players: [
        {
          PlayerId: botId,
          Cards: [
            { rank: '2', suit: 'Hearts', faceUp: false },
            { rank: '5', suit: 'Clubs', faceUp: false },
            { rank: '8', suit: 'Spades', faceUp: true },
          ],
          RoundContribution: 0,
          HasFolded: false,
        },
      ],
    });

    expect(chooseBotAction(game, game.Players[0], table)).toBe('fold');
  });

  test('bets a strong hand only when no bet is outstanding', () => {
    const game = makeBotGame({
      CurrentBet: 0,
      Players: [
        {
          PlayerId: botId,
          Cards: [
            { rank: 'A', suit: 'Hearts', faceUp: false },
            { rank: 'A', suit: 'Clubs', faceUp: false },
            { rank: 'K', suit: 'Spades', faceUp: true },
            { rank: 'K', suit: 'Diamonds', faceUp: true },
          ],
          RoundContribution: 0,
          HasFolded: false,
        },
      ],
    });

    expect(chooseBotAction(game, game.Players[0], table)).toBe('bet');
    game.CurrentBet = 5;
    game.Players[0].RoundContribution = 5;
    expect(chooseBotAction(game, game.Players[0], table)).toBe('check');
  });

  test('automatically acts for bots until a human has the turn', async () => {
    const botTurn = makeBotGame();
    const humanTurn = makeBotGame({
      CurrentTurnPlayerId: 'human-1',
    });
    GameDao.findById
      .mockResolvedValueOnce(botTurn)
      .mockResolvedValueOnce(humanTurn);
    TableDao.findById.mockResolvedValue(table);

    const result = await runBotTurns('game-1');

    expect(performBettingAction).toHaveBeenCalledWith(
      'game-1',
      botId,
      'call'
    );
    expect(result.game.CurrentTurnPlayerId).toBe('human-1');
    expect(result.actions).toEqual([
      { playerId: botId, action: 'call' },
    ]);
  });
});
