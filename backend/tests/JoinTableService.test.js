
const mongoose = require('mongoose');

const { joinTable } = require('../service/JoinTableService');
const UserDao = require('../model/UserDao');
const TableDao = require('../model/TableDao');
const TABLE_LEVELS = require('../model/tableLevels');

jest.mock('mongoose', () => ({
  startSession: jest.fn()
}));

jest.mock('../model/UserDao', () => ({
  deductChips: jest.fn()
}));

jest.mock('../model/TableDao', () => ({
  findById: jest.fn(),
  addPlayer: jest.fn()
}));

describe('JoinTableService', () => {
  let session;
  let table;

  const tableId = 'table-123';
  const userId = 'user-456';
  const buyIn = TABLE_LEVELS.Low.minBuyIn;

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined)
    };

    mongoose.startSession.mockResolvedValue(session);

    table = {
      _id: tableId,
      JoinCode: 'ABC123',
      Status: 'Waiting',
      Level: 'Low',
      Capacity: 6,
      UserIds: ['existing-player'],
      BotCount: 5
    };

    TableDao.findById.mockResolvedValue(table);
    TableDao.addPlayer.mockImplementation(async () => ({
      ...table,
      UserIds: [...table.UserIds, userId]
    }));

    UserDao.deductChips.mockResolvedValue({
      _id: userId
    });
  });

  afterEach(() => {
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('joins a waiting table and deducts the buy-in', async () => {
    const result = await joinTable(tableId, userId, buyIn);

    expect(result).toEqual({
      joinCode: 'ABC123',
      alreadySeated: false,
      waitingForNextHand: false
    });

    expect(UserDao.deductChips).toHaveBeenCalledWith(
      userId,
      buyIn,
      session
    );

    expect(TableDao.addPlayer).toHaveBeenCalledWith(
      tableId,
      userId,
      buyIn,
      session
    );
  });

  test('allows joining a table during an active hand', async () => {
    table.Status = 'In Progress';

    const result = await joinTable(tableId, userId, buyIn);

    expect(result.waitingForNextHand).toBe(true);
    expect(result.alreadySeated).toBe(false);
    expect(TableDao.addPlayer).toHaveBeenCalledTimes(1);
  });

  test('allows joining when bots occupy all remaining seats', async () => {
    table.BotCount = 5;

    const result = await joinTable(tableId, userId, buyIn);

    expect(result.alreadySeated).toBe(false);
    expect(TableDao.addPlayer).toHaveBeenCalledTimes(1);
  });

  test('does not deduct chips when reconnecting', async () => {
    table.UserIds.push(userId);

    const result = await joinTable(tableId, userId, buyIn);

    expect(result).toEqual({
      joinCode: 'ABC123',
      alreadySeated: true
    });

    expect(UserDao.deductChips).not.toHaveBeenCalled();
    expect(TableDao.addPlayer).not.toHaveBeenCalled();
  });

  test('rejects a table containing the maximum number of humans', async () => {
    table.UserIds = [
      'player-1', 'player-2', 'player-3',
      'player-4', 'player-5', 'player-6'
    ];
    table.BotCount = 0;

    await expect(
      joinTable(tableId, userId, buyIn)
    ).rejects.toThrow('Table is full');

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects a closed table', async () => {
    table.Status = 'Closed';

    await expect(
      joinTable(tableId, userId, buyIn)
    ).rejects.toThrow('Table is closed');

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects a nonexistent table', async () => {
    TableDao.findById.mockResolvedValue(null);

    await expect(
      joinTable(tableId, userId, buyIn)
    ).rejects.toThrow('Table not found');
  });

  test('rejects an invalid table status', async () => {
    table.Status = 'Paused';

    await expect(
      joinTable(tableId, userId, buyIn)
    ).rejects.toThrow('Table is not available');
  });

  test('rejects an invalid table level', async () => {
    table.Level = 'Invalid';

    await expect(
      joinTable(tableId, userId, buyIn)
    ).rejects.toThrow('Invalid table level');
  });

  test.each([
    ['below minimum', TABLE_LEVELS.Low.minBuyIn - 1],
    ['above maximum', TABLE_LEVELS.Low.maxBuyIn + 1],
    ['fractional amount', 250.5],
    ['missing amount', undefined]
  ])('rejects a %s buy-in', async (_, amount) => {
    await expect(
      joinTable(tableId, userId, amount)
    ).rejects.toThrow(/Buy-in must be between/);

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects users with insufficient chips', async () => {
    UserDao.deductChips.mockResolvedValue(null);

    await expect(
      joinTable(tableId, userId, buyIn)
    ).rejects.toThrow('Insufficient account chips');

    expect(TableDao.addPlayer).not.toHaveBeenCalled();
  });

  test('rejects when the table cannot be updated', async () => {
    TableDao.addPlayer.mockResolvedValue(null);

    await expect(
      joinTable(tableId, userId, buyIn)
    ).rejects.toThrow('Unable to join table');
  });

  test('passes the transaction session to the DAO methods', async () => {
    await joinTable(tableId, userId, buyIn);

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(TableDao.findById).toHaveBeenCalledWith(
      tableId,
      session
    );
    expect(UserDao.deductChips).toHaveBeenCalledWith(
      userId,
      buyIn,
      session
    );
    expect(TableDao.addPlayer).toHaveBeenCalledWith(
      tableId,
      userId,
      buyIn,
      session
    );
  });

  test('ends the session when joining fails', async () => {
    TableDao.findById.mockRejectedValue(
      new Error('Database error')
    );

    await expect(
      joinTable(tableId, userId, buyIn)
    ).rejects.toThrow('Database error');
  });
});
