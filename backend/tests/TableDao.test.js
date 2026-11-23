const mongoose = require('mongoose');

const TableDao = require('../model/TableDao');
const { TableModel } = TableDao;

describe('TableDao - Table Operations', () => {
  const tableId = new mongoose.Types.ObjectId();
  const user1 = new mongoose.Types.ObjectId();
  const user2 = new mongoose.Types.ObjectId();
  const user3 = new mongoose.Types.ObjectId();
  const previousGameId = new mongoose.Types.ObjectId();
  const nextGameId = new mongoose.Types.ObjectId();

  const session = { id: 'mock-session' };

  function createMockTable(overrides = {}) {
    return {
      _id: tableId,
      Name: 'Test Table',
      JoinCode: 'ABC123',
      Capacity: 3,
      UserIds: [user1],
      BotCount: 0,
      IsPublic: true,
      Level: 'Low',
      Status: 'Waiting',
      CurrentGameID: null,
      PlayerStacks: [
        {
          PlayerId: String(user1),
          Chips: 200,
        },
      ],
      PlayerPresence: [],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  function mockFindById(table) {
    return jest.spyOn(TableModel, 'findById').mockReturnValue({
      session: jest.fn().mockResolvedValue(table),
    });
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  // -----------------------------------------
  // Table retrieval
  // -----------------------------------------

  test('findAll retrieves tables with selected fields', async () => {
    const tables = [createMockTable()];

    const select = jest.fn().mockResolvedValue(tables);

    const find = jest.spyOn(TableModel, 'find').mockReturnValue({ select });

    const result = await TableDao.findAll();

    expect(find).toHaveBeenCalledWith();

    expect(select).toHaveBeenCalledWith(
      'Name Capacity UserIds BotCount IsPublic Level Status CurrentGameID createdAt updatedAt'
    );

    expect(result).toEqual(tables);
  });

  test('findPublicTables excludes closed and private tables', async () => {
    const sort = jest.fn().mockResolvedValue([]);
    const select = jest.fn().mockReturnValue({ sort });

    const find = jest.spyOn(TableModel, 'find').mockReturnValue({ select });

    await TableDao.findPublicTables();

    expect(find).toHaveBeenCalledWith({
      IsPublic: true,
      Status: {
        $in: ['Waiting', 'In Progress'],
      },
    });

    expect(select).toHaveBeenCalledWith(
      'Name Capacity UserIds BotCount Level Status createdAt',
    );

    expect(sort).toHaveBeenCalledWith({
      createdAt: -1,
      _id: -1,
    });
  });

  test('findTableByCode searches using the join code', async () => {
    const table = createMockTable();

    const select = jest.fn().mockResolvedValue(table);

    const findOne = jest
      .spyOn(TableModel, 'findOne')
      .mockReturnValue({ select });

    const result = await TableDao.findTableByCode({
      params: { joinCode: 'ABC123' },
    });

    expect(findOne).toHaveBeenCalledWith({
      JoinCode: 'ABC123',
    });

    expect(select).toHaveBeenCalledWith(
      'Name Capacity UserIds BotCount Level Status JoinCode CurrentGameID PlayerStacks',
    );

    expect(result).toBe(table);
  });

  test('deleteTableByCode deletes the matching table', async () => {
    const table = createMockTable();

    const deleteMock = jest
      .spyOn(TableModel, 'findOneAndDelete')
      .mockResolvedValue(table);

    const result = await TableDao.deleteTableByCode({
      params: { joinCode: 'ABC123' },
    });

    expect(deleteMock).toHaveBeenCalledWith({
      JoinCode: 'ABC123',
    });

    expect(result).toBe(table);
  });

  test('findById retrieves a table using the session', async () => {
    const table = createMockTable();

    const findSpy = mockFindById(table);

    const result = await TableDao.findById(tableId, session);

    expect(findSpy).toHaveBeenCalledWith(tableId);
    expect(result).toBe(table);
  });

  // -----------------------------------------
  // Table creation
  // -----------------------------------------

  test('create saves a new table', async () => {
    const save = jest
      .spyOn(TableModel.prototype, 'save')
      .mockResolvedValue(undefined);

    const tableData = {
      Name: 'New Table',
      JoinCode: 'NEW123',
      Capacity: 3,
      UserIds: [],
      BotCount: 2,
      IsPublic: true,
      Level: 'Low',
    };

    const result = await TableDao.create(tableData, session);

    expect(save).toHaveBeenCalledWith({ session });
    expect(result.Name).toBe('New Table');
    expect(result.JoinCode).toBe('NEW123');
  });

  test('create propagates database errors', async () => {
    jest
      .spyOn(TableModel.prototype, 'save')
      .mockRejectedValue(new Error('Database save failed'));

    await expect(
      TableDao.create({
        Name: 'Test',
        JoinCode: 'ERR123',
        Capacity: 3,
        BotCount: 0,
        IsPublic: true,
        Level: 'Low',
      }),
    ).rejects.toThrow('Database save failed');
  });

  // -----------------------------------------
  // First game and next-hand linking
  // -----------------------------------------

  test('setCurrentGame links a game to its table', async () => {
    const updatedTable = createMockTable({
      CurrentGameID: previousGameId,
    });

    const update = jest
      .spyOn(TableModel, 'findByIdAndUpdate')
      .mockResolvedValue(updatedTable);

    const result = await TableDao.setCurrentGame(
      tableId,
      previousGameId,
      session,
    );

    expect(update).toHaveBeenCalledWith(
      tableId,
      {
        $set: {
          CurrentGameID: previousGameId,
        },
      },
      {
        new: true,
        session,
      },
    );

    expect(result).toBe(updatedTable);
  });

  test('reserveForGame only reserves waiting tables', async () => {
    const update = jest.spyOn(TableModel, 'findOneAndUpdate').mockResolvedValue(
      createMockTable({
        Status: 'In Progress',
      }),
    );

    await TableDao.reserveForGame(tableId, session);

    expect(update).toHaveBeenCalledWith(
      {
        _id: tableId,
        Status: 'Waiting',
      },
      {
        $set: {
          Status: 'In Progress',
        },
      },
      {
        new: true,
        session,
      },
    );
  });

  test('setNextGame atomically links the next hand', async () => {
    const update = jest.spyOn(TableModel, 'findOneAndUpdate').mockResolvedValue(
      createMockTable({
        CurrentGameID: nextGameId,
      }),
    );

    await TableDao.setNextGame(tableId, previousGameId, nextGameId, session);

    expect(update).toHaveBeenCalledWith(
      {
        _id: tableId,
        Status: 'In Progress',
        CurrentGameID: previousGameId,
      },
      {
        $set: {
          CurrentGameID: nextGameId,
        },
      },
      {
        new: true,
        session,
        runValidators: true,
      },
    );
  });

  test('setNextGame returns null when the previous game changed', async () => {
    jest.spyOn(TableModel, 'findOneAndUpdate').mockResolvedValue(null);

    const result = await TableDao.setNextGame(
      tableId,
      previousGameId,
      nextGameId,
      session,
    );

    expect(result).toBeNull();
  });

  // -----------------------------------------
  // Joining tables
  // -----------------------------------------

  test('addPlayer adds a human to a waiting table', async () => {
    const table = createMockTable();

    mockFindById(table);

    const result = await TableDao.addPlayer(tableId, user2, 200, session);

    expect(result).toBe(table);

    expect(table.UserIds).toContain(user2);

    expect(table.PlayerStacks).toContainEqual({
      PlayerId: String(user2),
      Chips: 200,
    });

    expect(table.PlayerPresence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          PlayerId: String(user2),
          LastSeenAt: expect.any(Date),
        }),
      ]),
    );

    expect(table.save).toHaveBeenCalledWith({
      session,
    });
  });

  test('addPlayer immediately replaces a bot at a full waiting table', async () => {
    const bot1 = `bot-${tableId}-1`;
    const bot2 = `bot-${tableId}-2`;

    const table = createMockTable({
      Capacity: 3,
      UserIds: [user1],
      BotCount: 2,
      PlayerStacks: [
        { PlayerId: String(user1), Chips: 200 },
        { PlayerId: bot1, Chips: 200 },
        { PlayerId: bot2, Chips: 200 },
      ],
    });

    mockFindById(table);

    await TableDao.addPlayer(tableId, user2, 200, session);

    expect(table.BotCount).toBe(1);

    expect(table.PlayerStacks.map((stack) => stack.PlayerId)).not.toContain(
      bot2,
    );

    expect(table.PlayerStacks.map((stack) => stack.PlayerId)).toContain(bot1);

    expect(table.UserIds).toContain(user2);
    expect(table.save).toHaveBeenCalled();
  });

  test('addPlayer defers bot replacement during an active hand', async () => {
    const bot1 = `bot-${tableId}-1`;
    const bot2 = `bot-${tableId}-2`;

    const table = createMockTable({
      Status: 'In Progress',
      Capacity: 3,
      UserIds: [user1],
      BotCount: 2,
      PlayerStacks: [
        { PlayerId: String(user1), Chips: 200 },
        { PlayerId: bot1, Chips: 200 },
        { PlayerId: bot2, Chips: 200 },
      ],
    });

    mockFindById(table);

    const result = await TableDao.addPlayer(tableId, user2, 200, session);

    expect(result).toBe(table);

    expect(table.BotCount).toBe(2);

    expect(table.PlayerStacks.map((stack) => stack.PlayerId)).toEqual(
      expect.arrayContaining([bot1, bot2, String(user2)]),
    );

    expect(table.UserIds).toContain(user2);
    expect(table.save).toHaveBeenCalled();
  });

  test('addPlayer rejects duplicate players', async () => {
    const table = createMockTable();

    mockFindById(table);

    const result = await TableDao.addPlayer(tableId, user1, 200, session);

    expect(result).toBeNull();
    expect(table.save).not.toHaveBeenCalled();
  });

  test('addPlayer rejects a table at human capacity', async () => {
    const table = createMockTable({
      Capacity: 2,
      UserIds: [user1, user2],
    });

    mockFindById(table);

    const result = await TableDao.addPlayer(tableId, user3, 200, session);

    expect(result).toBeNull();
    expect(table.save).not.toHaveBeenCalled();
  });

  test('addPlayer rejects closed tables', async () => {
    const table = createMockTable({
      Status: 'Closed',
    });

    mockFindById(table);

    const result = await TableDao.addPlayer(tableId, user2, 200, session);

    expect(result).toBeNull();
    expect(table.save).not.toHaveBeenCalled();
  });

  test('addPlayer rejects nonexistent tables', async () => {
    mockFindById(null);

    const result = await TableDao.addPlayer(tableId, user2, 200, session);

    expect(result).toBeNull();
  });

  test('addPlayer propagates database errors', async () => {
    const table = createMockTable();

    table.save.mockRejectedValue(new Error('Database update failed'));

    mockFindById(table);

    await expect(
      TableDao.addPlayer(tableId, user2, 200, session),
    ).rejects.toThrow('Database update failed');
  });

  // -----------------------------------------
  // Chip deductions
  // -----------------------------------------

  test('deductPlayerChips atomically deducts chips', async () => {
    const update = jest
      .spyOn(TableModel, 'findOneAndUpdate')
      .mockResolvedValue({});

    await TableDao.deductPlayerChips(tableId, String(user1), 10, session);

    expect(update).toHaveBeenCalledWith(
      {
        _id: tableId,
        PlayerStacks: {
          $elemMatch: {
            PlayerId: String(user1),
            Chips: { $gte: 10 },
          },
        },
      },
      {
        $inc: {
          'PlayerStacks.$.Chips': -10,
        },
      },
      {
        new: true,
        session,
        runValidators: true,
      },
    );
  });

  test('deductPlayerChips returns null when chips are insufficient', async () => {
    jest.spyOn(TableModel, 'findOneAndUpdate').mockResolvedValue(null);

    const result = await TableDao.deductPlayerChips(
      tableId,
      String(user1),
      500,
      session,
    );

    expect(result).toBeNull();
  });

  test.each([-1, 1.5, NaN, '10'])(
    'deductPlayerChips rejects invalid amount %s',
    async (amount) => {
      await expect(
        TableDao.deductPlayerChips(tableId, String(user1), amount, session),
      ).rejects.toThrow('Invalid chip amount');
    },
  );

  // -----------------------------------------
  // Player presence / reconnect tracking
  // -----------------------------------------

  test('updatePlayerPresence refreshes an existing timestamp', async () => {
    const table = createMockTable();

    const update = jest
      .spyOn(TableModel, 'findOneAndUpdate')
      .mockResolvedValue(table);

    const result = await TableDao.updatePlayerPresence(tableId, user1);

    expect(update).toHaveBeenCalledWith(
      {
        _id: tableId,
        UserIds: user1,
        'PlayerPresence.PlayerId': String(user1),
        Status: { $ne: 'Closed' },
      },
      {
        $set: {
          'PlayerPresence.$.LastSeenAt': expect.any(Date),
        },
      },
      { new: true },
    );

    expect(result).toBe(table);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test('updatePlayerPresence initializes missing presence records', async () => {
    const table = createMockTable();

    const update = jest
      .spyOn(TableModel, 'findOneAndUpdate')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(table);

    const result = await TableDao.updatePlayerPresence(tableId, user1);

    expect(update).toHaveBeenCalledTimes(2);

    expect(update).toHaveBeenNthCalledWith(
      2,
      {
        _id: tableId,
        UserIds: user1,
        Status: { $ne: 'Closed' },
        'PlayerPresence.PlayerId': {
          $ne: String(user1),
        },
      },
      {
        $push: {
          PlayerPresence: {
            PlayerId: String(user1),
            LastSeenAt: expect.any(Date),
          },
        },
      },
      { new: true },
    );

    expect(result).toBe(table);
  });

  test('updatePlayerPresence returns null when player is not seated', async () => {
    jest.spyOn(TableModel, 'findOneAndUpdate').mockResolvedValue(null);

    const result = await TableDao.updatePlayerPresence(tableId, user3);

    expect(result).toBeNull();
  });

  test('findTablesWithInactivePlayers uses the cutoff timestamp', async () => {
    const cutoff = new Date('2026-11-21T12:00:00.000Z');

    const find = jest.spyOn(TableModel, 'find').mockResolvedValue([]);

    await TableDao.findTablesWithInactivePlayers(cutoff);

    expect(find).toHaveBeenCalledWith({
      Status: { $ne: 'Closed' },
      PlayerPresence: {
        $elemMatch: {
          LastSeenAt: { $lte: cutoff },
        },
      },
    });
  });
});
