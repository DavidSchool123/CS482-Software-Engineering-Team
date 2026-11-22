
jest.mock('../model/UserDao', () => ({
  updateGameStats: jest.fn().mockResolvedValue({}),
}));

jest.mock('../service/HandEvaluationService', () => ({
  evaluateSevenCardHand: jest.fn(),
  getHandName: jest.fn(),
}));

const UserDao = require('../model/UserDao');
const {
  evaluateSevenCardHand,
  getHandName,
} = require('../service/HandEvaluationService');

const { settleHand } = require('../service/SettlementService');

const WINNER_ID = '507f1f77bcf86cd799439011';
const LOSER_ID = '507f1f77bcf86cd799439012';

function createTable() {
  return {
    PlayerStacks: [
      { PlayerId: WINNER_ID, Chips: 900 },
      { PlayerId: LOSER_ID, Chips: 900 },
    ],
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function createGame() {
  return {
    Pot: 200,
    Status: 'In Progress',
    Players: [
      {
        PlayerId: WINNER_ID,
        HasFolded: false,
        Cards: [],
        TotalContribution: 100,
      },
      {
        PlayerId: LOSER_ID,
        HasFolded: false,
        Cards: [],
        TotalContribution: 100,
      },
    ],
    WinnerIds: [],
    HandResults: [],
    CompletedAt: null,
    NextHandAt: null,
    CurrentTurnPlayerId: WINNER_ID,
    BettingRoundComplete: false,
    AwaitingNextRound: false,
  };
}

describe('Player statistics during settlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    evaluateSevenCardHand.mockReturnValue([6, 14, 13]);
    getHandName.mockReturnValue('Full House');
  });

  test('records a win and loss with correct net winnings', async () => {
    const game = createGame();
    const table = createTable();

    await settleHand(game, table, [WINNER_ID], null);

    expect(UserDao.updateGameStats).toHaveBeenCalledTimes(2);

    expect(UserDao.updateGameStats).toHaveBeenCalledWith(
      WINNER_ID,
      {
        wins: 1,
        losses: 0,
        totalChipsWon: 200,
        netWinnings: 100,
      },
      null,
    );

    expect(UserDao.updateGameStats).toHaveBeenCalledWith(
      LOSER_ID,
      {
        wins: 0,
        losses: 1,
        totalChipsWon: 0,
        netWinnings: -100,
      },
      null,
    );
  });

  test('records both players as winners in a split pot', async () => {
    const game = createGame();
    game.Pot = 201;

    const table = createTable();

    await settleHand(
      game,
      table,
      [WINNER_ID, LOSER_ID],
      null,
    );

    expect(UserDao.updateGameStats).toHaveBeenCalledWith(
      WINNER_ID,
      {
        wins: 1,
        losses: 0,
        totalChipsWon: 101,
        netWinnings: 1,
      },
      null,
    );

    expect(UserDao.updateGameStats).toHaveBeenCalledWith(
      LOSER_ID,
      {
        wins: 1,
        losses: 0,
        totalChipsWon: 100,
        netWinnings: 0,
      },
      null,
    );
  });

  test('does not record statistics for bot players', async () => {
    const game = createGame();

    game.Players.push({
      PlayerId: 'bot-1',
      HasFolded: false,
      Cards: [],
      TotalContribution: 100,
    });

    const table = createTable();

    table.PlayerStacks.push({
      PlayerId: 'bot-1',
      Chips: 900,
    });

    await settleHand(game, table, [WINNER_ID], null);

    expect(UserDao.updateGameStats).not.toHaveBeenCalledWith(
      'bot-1',
      expect.anything(),
      null,
    );
  });
});
