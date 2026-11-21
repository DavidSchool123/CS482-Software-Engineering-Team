
const mongoose = require('mongoose');

jest.mock('mongoose', () => ({
  startSession: jest.fn()
}));

jest.mock('../model/TableDao', () => ({
  findById: jest.fn()
}));

jest.mock('../model/GameDao', () => ({
  findById: jest.fn()
}));

jest.mock('../model/UserDao', () => ({
  creditChips: jest.fn()
}));

jest.mock('../model/GameActionEvent', () => ({
  create: jest.fn()
}));

jest.mock('../service/BettingService', () => ({
  nextPlayer: jest.fn(),
  isBettingRoundComplete: jest.fn()
}));

jest.mock('../service/NextStreetService', () => ({
  advanceRoundInGame: jest.fn()
}));

jest.mock('../service/HandEvaluationService', () => ({
  findWinners: jest.fn()
}));

jest.mock('../service/SettlementService', () => ({
  settleHand: jest.fn()
}));

const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
const UserDao = require('../model/UserDao');
const GameActionEvent = require('../model/GameActionEvent');

const {
  nextPlayer,
  isBettingRoundComplete
} = require('../service/BettingService');

const {
  advanceRoundInGame
} = require('../service/NextStreetService');

const {
  findWinners
} = require('../service/HandEvaluationService');

const {
  settleHand
} = require('../service/SettlementService');

const { leaveTable } = require('../service/LeaveTableService');

describe('LeaveTableService', () => {
  const tableId = 'table-123';
  const userId = 'player-1';
  const otherPlayerId = 'player-2';
  const gameId = 'game-123';

  let session;
  let table;
  let game;

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      withTransaction: jest.fn(async callback => callback()),
      endSession: jest.fn().mockResolvedValue(undefined)
    };

    mongoose.startSession.mockResolvedValue(session);

    table = {
      _id: tableId,
      Status: 'Waiting',
      CurrentGameID: null,
      UserIds: [userId, otherPlayerId],
      PlayerStacks: [
        { PlayerId: userId, Chips: 350 },
        { PlayerId: otherPlayerId, Chips: 500 }
      ],
      PlayerPresence: [
        {
          PlayerId: userId,
          LastSeenAt: new Date('2026-11-20T10:00:00Z')
        },
        {
          PlayerId: otherPlayerId,
          LastSeenAt: new Date('2026-11-20T10:00:00Z')
        }
      ],
      save: jest.fn().mockResolvedValue(undefined)
    };

    game = {
      _id: gameId,
      Status: 'In Progress',
      Street: 3,
      Pot: 20,
      CurrentBet: 10,
      CurrentTurnPlayerId: userId,
      Players: [
        {
          PlayerId: userId,
          HasFolded: false,
          HasActed: false,
          TotalContribution: 10
        },
        {
          PlayerId: otherPlayerId,
          HasFolded: false,
          HasActed: false,
          TotalContribution: 10
        }
      ],
      save: jest.fn().mockResolvedValue(undefined)
    };

    TableDao.findById.mockResolvedValue(table);
    GameDao.findById.mockResolvedValue(game);

    UserDao.creditChips.mockResolvedValue({
      chipBalance: 850
    });

    GameActionEvent.create.mockResolvedValue([]);

    isBettingRoundComplete.mockReturnValue(false);
    nextPlayer.mockReturnValue(otherPlayerId);

    findWinners.mockReturnValue([otherPlayerId]);

    settleHand.mockImplementation(async currentGame => {
      currentGame.Status = 'Completed';
    });
  });

  afterEach(() => {
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('leaves a waiting table and refunds the remaining chips', async () => {
    const result = await leaveTable(tableId, userId);

    expect(result).toEqual({
      message: 'Left table successfully',
      tableId,
      gameId: null,
      refundedChips: 350,
      accountBalance: 850,
      tableClosed: false,
      gameStatus: null
    });

    expect(UserDao.creditChips).toHaveBeenCalledWith(
      userId,
      350,
      session
    );

    expect(table.UserIds).toEqual([otherPlayerId]);
    expect(table.PlayerStacks).toEqual([
      { PlayerId: otherPlayerId, Chips: 500 }
    ]);

    expect(table.PlayerPresence).toHaveLength(1);
    expect(table.PlayerPresence[0].PlayerId)
      .toBe(otherPlayerId);

    expect(table.save).toHaveBeenCalledWith({ session });
  });

  test('closes a waiting table when the last human leaves', async () => {
    table.UserIds = [userId];

    const result = await leaveTable(tableId, userId);

    expect(result.tableClosed).toBe(true);
    expect(table.Status).toBe('Closed');
    expect(table.UserIds).toEqual([]);
    expect(result.refundedChips).toBe(350);
  });

  test('rejects a nonexistent table with status 404', async () => {
    TableDao.findById.mockResolvedValue(null);

    await expect(
      leaveTable(tableId, userId)
    ).rejects.toMatchObject({
      message: 'Table not found',
      status: 404
    });

    expect(UserDao.creditChips).not.toHaveBeenCalled();
  });

  test('rejects a player who is not seated', async () => {
    table.UserIds = [otherPlayerId];

    await expect(
      leaveTable(tableId, userId)
    ).rejects.toMatchObject({
      message: 'You are not seated at this table',
      status: 403
    });

    expect(UserDao.creditChips).not.toHaveBeenCalled();
  });

  test('rejects a missing player chip stack', async () => {
    table.PlayerStacks = table.PlayerStacks.filter(
      stack => stack.PlayerId !== userId
    );

    await expect(
      leaveTable(tableId, userId)
    ).rejects.toThrow('Player chip stack not found');
  });

  test('rejects when the current game cannot be found', async () => {
    table.CurrentGameID = gameId;
    GameDao.findById.mockResolvedValue(null);

    await expect(
      leaveTable(tableId, userId)
    ).rejects.toThrow('Current game not found');

    expect(UserDao.creditChips).not.toHaveBeenCalled();
  });

  test('folds a departing player during an active hand', async () => {
    table.Status = 'In Progress';
    table.CurrentGameID = gameId;

    const result = await leaveTable(tableId, userId);

    expect(game.Players[0].HasFolded).toBe(true);
    expect(game.Players[0].HasActed).toBe(true);

    expect(GameActionEvent.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          gameId,
          playerId: userId,
          action: 'fold',
          amount: 0,
          street: 3
        })
      ],
      { session }
    );

    expect(game.save).toHaveBeenCalledWith({ session });
    expect(result.gameId).toBe(gameId);
  });

  test('advances the turn when the departing player was acting', async () => {
    table.Status = 'In Progress';
    table.CurrentGameID = gameId;

    // Keep at least two active players after the fold.
    game.Players.push({
      PlayerId: 'player-3',
      HasFolded: false,
      HasActed: false,
      TotalContribution: 10
    });

    await leaveTable(tableId, userId);

    expect(nextPlayer).toHaveBeenCalledWith(
      game.Players,
      userId,
      game.CurrentBet
    );

    expect(game.CurrentTurnPlayerId).toBe(otherPlayerId);
  });

  test('preserves another player’s turn when departing out of turn', async () => {
    table.Status = 'In Progress';
    table.CurrentGameID = gameId;
    game.CurrentTurnPlayerId = otherPlayerId;

    game.Players.push({
      PlayerId: 'player-3',
      HasFolded: false,
      HasActed: false,
      TotalContribution: 10
    });

    await leaveTable(tableId, userId);

    expect(nextPlayer).not.toHaveBeenCalled();
    expect(game.CurrentTurnPlayerId).toBe(otherPlayerId);
  });

  test('settles the hand when one active player remains', async () => {
    table.Status = 'In Progress';
    table.CurrentGameID = gameId;

    const result = await leaveTable(tableId, userId);

    expect(settleHand).toHaveBeenCalledWith(
      game,
      table,
      [otherPlayerId],
      session
    );

    expect(result.gameStatus).toBe('Completed');
  });

  test('advances the street when folding completes a betting round', async () => {
    table.Status = 'In Progress';
    table.CurrentGameID = gameId;

    game.Players.push({
      PlayerId: 'player-3',
      HasFolded: false,
      HasActed: true,
      TotalContribution: 10
    });

    isBettingRoundComplete.mockReturnValue(true);

    await leaveTable(tableId, userId);

    expect(advanceRoundInGame).toHaveBeenCalledWith(game);
    expect(game.BettingRoundComplete).toBe(true);
    expect(game.CurrentTurnPlayerId).toBeNull();
  });

  test('evaluates winners on seventh street when folding ends betting', async () => {
    table.Status = 'In Progress';
    table.CurrentGameID = gameId;
    game.Street = 7;

    game.Players.push({
      PlayerId: 'player-3',
      HasFolded: false,
      HasActed: true,
      TotalContribution: 10
    });

    isBettingRoundComplete.mockReturnValue(true);

    await leaveTable(tableId, userId);

    expect(findWinners).toHaveBeenCalledWith(game.Players);

    expect(settleHand).toHaveBeenCalledWith(
      game,
      table,
      [otherPlayerId],
      session
    );
  });

  test('cancels an unfinished hand when the last human leaves', async () => {
    table.Status = 'In Progress';
    table.CurrentGameID = gameId;
    table.UserIds = [userId];

    const result = await leaveTable(tableId, userId);

    expect(game.Status).toBe('Completed');
    expect(game.Pot).toBe(0);
    expect(game.NextHandAt).toBeNull();
    expect(game.CurrentTurnPlayerId).toBeNull();
    expect(game.WinnerIds).toEqual([]);
    expect(game.HandResults).toEqual([]);

    // The departing player's contribution is returned
    // to their stack before the account refund.
    expect(result.refundedChips).toBe(360);

    expect(UserDao.creditChips).toHaveBeenCalledWith(
      userId,
      360,
      session
    );

    expect(table.Status).toBe('Closed');
    expect(settleHand).not.toHaveBeenCalled();
  });

  test('does not remove an inactive player who has reconnected', async () => {
    const cutoff = new Date('2026-11-20T09:59:00Z');

    const result = await leaveTable(tableId, userId, {
      inactiveBefore: cutoff
    });

    expect(result).toBeNull();
    expect(UserDao.creditChips).not.toHaveBeenCalled();
    expect(table.save).not.toHaveBeenCalled();
  });

  test('removes a player whose heartbeat is older than the cutoff', async () => {
    const cutoff = new Date('2026-11-20T10:01:00Z');

    const result = await leaveTable(tableId, userId, {
      inactiveBefore: cutoff
    });

    expect(result.refundedChips).toBe(350);
    expect(table.UserIds).not.toContain(userId);
  });

  test('does not remove an inactive player without a presence record', async () => {
    table.PlayerPresence = [];

    const result = await leaveTable(tableId, userId, {
      inactiveBefore: new Date('2026-11-20T10:01:00Z')
    });

    expect(result).toBeNull();
    expect(UserDao.creditChips).not.toHaveBeenCalled();
  });

  test('rejects an invalid remaining chip stack', async () => {
    table.PlayerStacks[0].Chips = -1;

    await expect(
      leaveTable(tableId, userId)
    ).rejects.toThrow('Invalid remaining chip stack');

    expect(UserDao.creditChips).not.toHaveBeenCalled();
  });

  test('rejects when the account cannot be credited', async () => {
    UserDao.creditChips.mockResolvedValue(null);

    await expect(
      leaveTable(tableId, userId)
    ).rejects.toThrow('User not found');

    expect(table.save).not.toHaveBeenCalled();
  });

  test('ends the session when a database operation fails', async () => {
    TableDao.findById.mockRejectedValue(
      new Error('Database failure')
    );

    await expect(
      leaveTable(tableId, userId)
    ).rejects.toThrow('Database failure');
  });
});
