
const mongoose = require('mongoose');

jest.mock('../model/UserDao', () => ({
  deductChips: jest.fn()
}));

jest.mock('../model/TableDao', () => ({
  findById: jest.fn(),
  addPlayer: jest.fn()
}));

const UserDao = require('../model/UserDao');
const TableDao = require('../model/TableDao');
const { joinTable } = require('../service/JoinTableService');

describe('P52 - Player Starting Chips and Table Buy-In', () => {
  const tableId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  let session;

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      withTransaction: jest.fn(async callback => callback()),
      endSession: jest.fn()
    };

    jest.spyOn(mongoose, 'startSession')
      .mockResolvedValue(session);

    TableDao.findById.mockResolvedValue({
      _id: tableId,
      JoinCode: 'ABC123',
      Status: 'Waiting',
      Level: 'Low',
      UserIds: [],
      BotCount: 0,
      Capacity: 4
    });

    UserDao.deductChips.mockResolvedValue({
      _id: userId,
      chipBalance: 800
    });

    TableDao.addPlayer.mockResolvedValue({
      _id: tableId,
      JoinCode: 'ABC123',
      UserIds: [userId],
      PlayerStacks: [
        { PlayerId: userId, Chips: 200 }
      ]
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('joins a table with a valid buy-in', async () => {
    const result = await joinTable(tableId, userId, 200);

    expect(result).toEqual({
      joinCode: 'ABC123',
      alreadySeated: false
    });

    expect(UserDao.deductChips).toHaveBeenCalledWith(
      userId, 200, session
    );

    expect(TableDao.addPlayer).toHaveBeenCalledWith(
      tableId, userId, 200, session
    );

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('does not charge a player already seated', async () => {
    TableDao.findById.mockResolvedValue({
      JoinCode: 'ABC123',
      Status: 'Waiting',
      Level: 'Low',
      UserIds: [new mongoose.Types.ObjectId(userId)]
    });

    const result = await joinTable(tableId, userId, 200);

    expect(result).toEqual({
      joinCode: 'ABC123',
      alreadySeated: true
    });

    expect(UserDao.deductChips).not.toHaveBeenCalled();
    expect(TableDao.addPlayer).not.toHaveBeenCalled();
  });

  test('rejects insufficient account chips', async () => {
    UserDao.deductChips.mockResolvedValue(null);

    await expect(
      joinTable(tableId, userId, 200)
    ).rejects.toThrow('Insufficient account chips');

    expect(TableDao.addPlayer).not.toHaveBeenCalled();
  });

  test('rejects a buy-in below the table minimum', async () => {
    await expect(
      joinTable(tableId, userId, 100)
    ).rejects.toThrow('Buy-in must be between');

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects a buy-in above the table maximum', async () => {
    await expect(
      joinTable(tableId, userId, 1500)
    ).rejects.toThrow('Buy-in must be between');

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects joining a game in progress', async () => {
    TableDao.findById.mockResolvedValue({
      JoinCode: 'ABC123',
      Status: 'In Progress',
      Level: 'Low',
      UserIds: []
    });

    await expect(
      joinTable(tableId, userId, 200)
    ).rejects.toThrow(
      'Cannot join a game already in progress'
    );

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects a table that does not exist', async () => {
    TableDao.findById.mockResolvedValue(null);

    await expect(
      joinTable(tableId, userId, 200)
    ).rejects.toThrow('Table not found');

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects a failed table join', async () => {
    TableDao.addPlayer.mockResolvedValue(null);

    await expect(
      joinTable(tableId, userId, 200)
    ).rejects.toThrow('Unable to join table');

    expect(UserDao.deductChips).toHaveBeenCalledTimes(1);
    expect(TableDao.addPlayer).toHaveBeenCalledTimes(1);
  });
});
