
const mongoose = require('mongoose');
const TableDao = require('../model/TableDao');

describe('TableDao - Public Table Queries', () => {
  let findSpy;

  beforeEach(() => {
    // Mock Mongoose's find method so we don't connect to MongoDB
    findSpy = jest.spyOn(mongoose.Model, 'find');
  });

  afterEach(() => {
    // Restore the original Mongoose method after each test
    jest.restoreAllMocks();
  });

  // TEST 1: Only request public, non-closed tables
  test('findPublicTables uses the correct MongoDB query', async () => {
    const mockTables = [
      {
        Name: 'Royal Flush',
        IsPublic: true,
        Status: 'Waiting',
      },
      {
        Name: 'Midnight Poker',
        IsPublic: true,
        Status: 'In Progress',
      },
    ];

    const selectMock = jest.fn().mockResolvedValue(mockTables);

    findSpy.mockReturnValue({
      select: selectMock,
    });

    const result = await TableDao.findPublicTables();

    expect(findSpy).toHaveBeenCalledWith({
      IsPublic: true,
      Status: { $ne: 'Closed' },
    });

    expect(selectMock).toHaveBeenCalledWith(
      'Name Capacity UserIds BotCount Level Status'
    );

    expect(result).toEqual(mockTables);
  });

  // TEST 2: Return an empty array when no tables match
  test('findPublicTables returns an empty array when no tables match', async () => {
    const selectMock = jest.fn().mockResolvedValue([]);

    findSpy.mockReturnValue({
      select: selectMock,
    });

    const result = await TableDao.findPublicTables();

    expect(result).toEqual([]);
  });

  // TEST 3: Propagate database errors
  test('findPublicTables propagates database errors', async () => {
    const selectMock = jest.fn().mockRejectedValue(
      new Error('Database connection failed')
    );

    findSpy.mockReturnValue({
      select: selectMock,
    });

    await expect(
      TableDao.findPublicTables()
    ).rejects.toThrow('Database connection failed');
  });
});

describe('TableDao - Creation and Joining Operations', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // TEST 4: Create a table using the provided transaction session
  test('create saves a table using the provided session', async () => {
    const session = { id: 'mock-session' };
    const testUserId = new mongoose.Types.ObjectId();

    const tableData = {
      Name: 'Private Poker Table',
      JoinCode: 'ABC12345',
      Capacity: 6,
      UserIds: [testUserId],
      BotCount: 0,
      IsPublic: false,
      Level: 'Low',
      Status: 'Waiting',
      PlayerStacks: [
        {
          PlayerId: testUserId.toString(),
          Chips: 500,
        },
      ],
    };

    const saveSpy = jest
      .spyOn(TableDao.TableModel.prototype, 'save')
      .mockResolvedValue(undefined);

    const result = await TableDao.create(tableData, session);

    expect(saveSpy).toHaveBeenCalledWith({ session });

    // Convert the Mongoose document to a plain object
    const savedTable = result.toObject();

    expect(savedTable).toEqual(
      expect.objectContaining({
        Name: tableData.Name,
        JoinCode: tableData.JoinCode,
        Capacity: tableData.Capacity,
        BotCount: tableData.BotCount,
        IsPublic: tableData.IsPublic,
        Level: tableData.Level,
        Status: tableData.Status,
      })
    );

    expect(savedTable.UserIds.map(String)).toEqual([
      testUserId.toString(),
    ]);

    expect(savedTable.PlayerStacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          PlayerId: testUserId.toString(),
          Chips: 500,
        }),
      ])
    );
  });

  // TEST 5: Find a table using its join code
  test('findTableByCode searches using the supplied join code', async () => {
    const mockTable = {
      Name: 'Private Poker Table',
      JoinCode: 'ABC12345',
    };

    const selectMock = jest.fn().mockResolvedValue(mockTable);

    const findOneSpy = jest
      .spyOn(TableDao.TableModel, 'findOne')
      .mockReturnValue({
        select: selectMock,
      });

    const req = {
      params: {
        joinCode: 'ABC12345',
      },
    };

    const result = await TableDao.findTableByCode(req);

    expect(findOneSpy).toHaveBeenCalledWith({
      JoinCode: 'ABC12345',
    });

    expect(selectMock).toHaveBeenCalledWith(
      'Name Capacity UserIds BotCount Level Status JoinCode CurrentGameID PlayerStacks'
    );

    expect(result).toEqual(mockTable);
  });

  // TEST 6: Return null when no table matches the join code
  test('findTableByCode returns null when the code does not match', async () => {
    const selectMock = jest.fn().mockResolvedValue(null);

    jest
      .spyOn(TableDao.TableModel, 'findOne')
      .mockReturnValue({
        select: selectMock,
      });

    const req = {
      params: {
        joinCode: 'NOTFOUND',
      },
    };

    const result = await TableDao.findTableByCode(req);

    expect(result).toBeNull();
  });

  // TEST 7: Find a table by ID using a transaction session
  test('findById uses the supplied transaction session', async () => {
    const session = { id: 'mock-session' };
    const mockTable = { Name: 'Test Table' };

    const sessionMock = jest.fn().mockResolvedValue(mockTable);

    const findByIdSpy = jest
      .spyOn(TableDao.TableModel, 'findById')
      .mockReturnValue({
        session: sessionMock,
      });

    const result = await TableDao.findById('table123', session);

    expect(findByIdSpy).toHaveBeenCalledWith('table123');
    expect(sessionMock).toHaveBeenCalledWith(session);
    expect(result).toEqual(mockTable);
  });

  // TEST 8: Find a table by ID without a transaction session
  test('findById uses null when no session is provided', async () => {
    const mockTable = { Name: 'Test Table' };
    const sessionMock = jest.fn().mockResolvedValue(mockTable);

    jest
      .spyOn(TableDao.TableModel, 'findById')
      .mockReturnValue({
        session: sessionMock,
      });

    const result = await TableDao.findById('table123');

    expect(sessionMock).toHaveBeenCalledWith(null);
    expect(result).toEqual(mockTable);
  });

  // TEST 9: Add a player using the correct atomic update
  test('addPlayer uses the correct conditions and updates', async () => {
    const session = { id: 'mock-session' };
    const mockUpdatedTable = {
      Name: 'Test Table',
      UserIds: ['user123'],
    };

    const findOneAndUpdateSpy = jest
      .spyOn(TableDao.TableModel, 'findOneAndUpdate')
      .mockResolvedValue(mockUpdatedTable);

    const result = await TableDao.addPlayer(
      'table123',
      'user123',
      500,
      session
    );

    expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
      {
        _id: 'table123',
        Status: 'Waiting',
        UserIds: { $ne: 'user123' },
        $expr: {
          $lt: [
            {
              $add: [
                { $size: '$UserIds' },
                '$BotCount',
              ],
            },
            '$Capacity',
          ],
        },
      },
      {
        $addToSet: {
          UserIds: 'user123',
        },
        $push: {
          PlayerStacks: {
            PlayerId: 'user123',
            Chips: 500,
          },
        },
      },
      {
        new: true,
        session,
        runValidators: true,
      }
    );

    expect(result).toEqual(mockUpdatedTable);
  });

  // TEST 10: Return null when a player cannot be added
  test('addPlayer returns null when the table cannot accept the player', async () => {
    jest
      .spyOn(TableDao.TableModel, 'findOneAndUpdate')
      .mockResolvedValue(null);

    const result = await TableDao.addPlayer(
      'table123',
      'user123',
      500,
      null
    );

    expect(result).toBeNull();
  });

  // TEST 11: Propagate database errors when adding a player
  test('addPlayer propagates database errors', async () => {
    jest
      .spyOn(TableDao.TableModel, 'findOneAndUpdate')
      .mockRejectedValue(
        new Error('Database update failed')
      );

    await expect(
      TableDao.addPlayer('table123', 'user123', 500, null)
    ).rejects.toThrow('Database update failed');
  });
});


describe('TableDao - Additional Operations', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('findAll retrieves tables with the expected fields', async () => {
    const mockTables = [
      { Name: 'Table One' },
      { Name: 'Table Two' },
    ];

    const selectMock = jest.fn().mockResolvedValue(mockTables);

    const findSpy = jest
      .spyOn(TableDao.TableModel, 'find')
      .mockReturnValue({ select: selectMock });

    const result = await TableDao.findAll();

    expect(findSpy).toHaveBeenCalledWith();
    expect(selectMock).toHaveBeenCalledWith(
      'Name Capacity UserIds BotCount IsPublic Level Status'
    );
    expect(result).toEqual(mockTables);
  });

  test('deleteTableByCode deletes a table using its join code', async () => {
    const deletedTable = { JoinCode: 'ABC12345' };

    const deleteSpy = jest
      .spyOn(TableDao.TableModel, 'findOneAndDelete')
      .mockResolvedValue(deletedTable);

    const result = await TableDao.deleteTableByCode({
      params: { joinCode: 'ABC12345' },
    });

    expect(deleteSpy).toHaveBeenCalledWith({
      JoinCode: 'ABC12345',
    });
    expect(result).toEqual(deletedTable);
  });

  test('deleteTableByCode returns null when table is missing', async () => {
    jest
      .spyOn(TableDao.TableModel, 'findOneAndDelete')
      .mockResolvedValue(null);

    const result = await TableDao.deleteTableByCode({
      params: { joinCode: 'NOTFOUND' },
    });

    expect(result).toBeNull();
  });

  test('setCurrentGame associates a game with a table', async () => {
    const session = { id: 'mock-session' };
    const updatedTable = { CurrentGameID: 'game123' };

    const updateSpy = jest
      .spyOn(TableDao.TableModel, 'findByIdAndUpdate')
      .mockResolvedValue(updatedTable);

    const result = await TableDao.setCurrentGame(
      'table123',
      'game123',
      session
    );

    expect(updateSpy).toHaveBeenCalledWith(
      'table123',
      {
        $set: { CurrentGameID: 'game123' },
      },
      {
        new: true,
        session,
      }
    );
    expect(result).toEqual(updatedTable);
  });

  test('reserveForGame reserves only a waiting table', async () => {
    const session = { id: 'mock-session' };
    const updatedTable = { Status: 'In Progress' };

    const updateSpy = jest
      .spyOn(TableDao.TableModel, 'findOneAndUpdate')
      .mockResolvedValue(updatedTable);

    const result = await TableDao.reserveForGame(
      'table123',
      session
    );

    expect(updateSpy).toHaveBeenCalledWith(
      {
        _id: 'table123',
        Status: 'Waiting',
      },
      {
        $set: { Status: 'In Progress' },
      },
      {
        new: true,
        session,
      }
    );
    expect(result).toEqual(updatedTable);
  });

  test('reserveForGame returns null when table is unavailable', async () => {
    jest
      .spyOn(TableDao.TableModel, 'findOneAndUpdate')
      .mockResolvedValue(null);

    const result = await TableDao.reserveForGame(
      'table123',
      null
    );

    expect(result).toBeNull();
  });

  test('deductPlayerChips deducts the correct amount', async () => {
    const session = { id: 'mock-session' };
    const updatedTable = {
      PlayerStacks: [
        { PlayerId: 'player1', Chips: 450 },
      ],
    };

    const updateSpy = jest
      .spyOn(TableDao.TableModel, 'findOneAndUpdate')
      .mockResolvedValue(updatedTable);

    const result = await TableDao.deductPlayerChips(
      'table123',
      'player1',
      50,
      session
    );

    expect(updateSpy).toHaveBeenCalledWith(
      {
        _id: 'table123',
        PlayerStacks: {
          $elemMatch: {
            PlayerId: 'player1',
            Chips: { $gte: 50 },
          },
        },
      },
      {
        $inc: {
          'PlayerStacks.$.Chips': -50,
        },
      },
      {
        new: true,
        session,
        runValidators: true,
      }
    );

    expect(result).toEqual(updatedTable);
  });

  test.each([-1, 2.5, NaN, '50', null])(
    'deductPlayerChips rejects invalid amount %s',
    async (amount) => {
      const updateSpy = jest.spyOn(
        TableDao.TableModel,
        'findOneAndUpdate'
      );

      await expect(
        TableDao.deductPlayerChips(
          'table123',
          'player1',
          amount,
          null
        )
      ).rejects.toThrow('Invalid chip amount');

      expect(updateSpy).not.toHaveBeenCalled();
    }
  );

  test('deductPlayerChips returns null for insufficient chips', async () => {
    jest
      .spyOn(TableDao.TableModel, 'findOneAndUpdate')
      .mockResolvedValue(null);

    const result = await TableDao.deductPlayerChips(
      'table123',
      'player1',
      1000,
      null
    );

    expect(result).toBeNull();
  });
});

