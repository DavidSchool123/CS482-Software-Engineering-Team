
const mongoose = require('mongoose');
const TableDao = require('../model/TableDao');
const UserDao = require('../model/UserDao');
const TABLE_LEVELS = require('../model/tableLevels');
const TableController = require('../controller/TableController');

jest.mock('../model/TableDao');
jest.mock('../model/UserDao');

describe('TableController - Creation and Joining', () => {
  let mockSession;
  let consoleErrorSpy;

  const userId = new mongoose.Types.ObjectId().toString();
  const tableId = new mongoose.Types.ObjectId().toString();

  const validTableBody = {
    Name: 'Test Poker Table',
    Capacity: 6,
    BotCount: 0,
    IsPublic: true,
    Level: 'Low',
    buyIn: 500,
  };

  const waitingTable = {
    _id: tableId,
    Name: 'Test Poker Table',
    JoinCode: 'ABC12345',
    Capacity: 6,
    UserIds: [new mongoose.Types.ObjectId().toString()],
    PlayerStacks: [],
    BotCount: 0,
    Level: 'Low',
    Status: 'Waiting',
  };

  function mockResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(mongoose, 'startSession')
      .mockResolvedValue(mockSession);

    consoleErrorSpy = jest.spyOn(console, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // TABLE CREATION TESTS

  test('rejects table creation when the user is not logged in', async () => {
    const req = {
      body: validTableBody,
      session: {},
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'You must be logged in to create a table',
    });

    expect(TableDao.create).not.toHaveBeenCalled();
    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects table creation with an invalid level', async () => {
    const req = {
      body: {
        ...validTableBody,
        Level: 'Invalid',
      },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid table level',
    });

    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('rejects a buy-in below the minimum', async () => {
    const req = {
      body: {
        ...validTableBody,
        buyIn: TABLE_LEVELS.Low.minBuyIn - 1,
      },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TableDao.create).not.toHaveBeenCalled();
  });

  test('rejects a buy-in above the maximum', async () => {
    const req = {
      body: {
        ...validTableBody,
        buyIn: TABLE_LEVELS.Low.maxBuyIn + 1,
      },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TableDao.create).not.toHaveBeenCalled();
  });

  test('rejects a non-integer buy-in', async () => {
    const req = {
      body: {
        ...validTableBody,
        buyIn: 500.5,
      },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TableDao.create).not.toHaveBeenCalled();
  });

  test('creates a table and deducts the host buy-in successfully', async () => {
    const createdTable = {
      _id: new mongoose.Types.ObjectId(),
      Name: validTableBody.Name,
      JoinCode: 'ABC12345',
    };

    UserDao.deductChips.mockResolvedValue({ _id: userId });
    TableDao.create.mockResolvedValue(createdTable);

    const req = {
      body: validTableBody,
      session: { userId },
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(UserDao.deductChips).toHaveBeenCalledWith(
      userId,
      validTableBody.buyIn,
      mockSession
    );

    expect(TableDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        Name: validTableBody.Name,
        Capacity: validTableBody.Capacity,
        UserIds: [userId],
        Level: validTableBody.Level,
        IsPublic: validTableBody.IsPublic,
        JoinCode: expect.stringMatching(/^[A-F0-9]{8}$/),
        PlayerStacks: [
          {
            PlayerId: userId,
            Chips: validTableBody.buyIn,
          },
        ],
      }),
      mockSession
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: createdTable._id.toString(),
      name: validTableBody.Name,
      joinCode: 'ABC12345',
      buyIn: validTableBody.buyIn,
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  test('does not create a table when the host has insufficient chips', async () => {
    UserDao.deductChips.mockResolvedValue(null);

    const req = {
      body: validTableBody,
      session: { userId },
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(TableDao.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Insufficient chips or user not found',
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  // TABLE JOINING TESTS

  test('rejects joining when the user is not logged in', async () => {
    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: {},
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(TableDao.findById).not.toHaveBeenCalled();
    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('returns 404 when the table does not exist', async () => {
    TableDao.findById.mockResolvedValue(null);

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Table not found',
    });

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects joining a table that is not waiting', async () => {
    TableDao.findById.mockResolvedValue({
      ...waitingTable,
      Status: 'In Progress',
    });

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'This table is no longer waiting for players',
    });

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('allows an already-seated user to rejoin without another deduction', async () => {
    TableDao.findById.mockResolvedValue({
      ...waitingTable,
      UserIds: [userId],
    });

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      joinCode: waitingTable.JoinCode,
      alreadySeated: true,
    });

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects a buy-in below the table minimum', async () => {
    TableDao.findById.mockResolvedValue(waitingTable);

    const req = {
      params: { tableId },
      body: { buyIn: TABLE_LEVELS.Low.minBuyIn - 1 },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects a buy-in above the table maximum', async () => {
    TableDao.findById.mockResolvedValue(waitingTable);

    const req = {
      params: { tableId },
      body: { buyIn: TABLE_LEVELS.Low.maxBuyIn + 1 },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects joining when the user has insufficient chips', async () => {
    TableDao.findById.mockResolvedValue(waitingTable);
    UserDao.deductChips.mockResolvedValue(null);

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Insufficient chips or user not found',
    });

    expect(TableDao.addPlayer).not.toHaveBeenCalled();
  });

  test('rejects joining if the table is full', async () => {
    TableDao.findById.mockResolvedValue({
      ...waitingTable,
      UserIds: [new mongoose.Types.ObjectId().toString()],
      BotCount: 5,
    });

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'This table is full',
    });

    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('joins a table and deducts the buy-in successfully', async () => {
    const table = {
      ...waitingTable,
      UserIds: [new mongoose.Types.ObjectId().toString()],
      PlayerStacks: [],
      save: jest.fn().mockResolvedValue(undefined),
    };

    TableDao.findById.mockResolvedValue(table);
    UserDao.deductChips.mockResolvedValue({ _id: userId });

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId },
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(TableDao.findById).toHaveBeenCalledWith(
      tableId,
      mockSession
    );

    expect(UserDao.deductChips).toHaveBeenCalledWith(
      userId,
      500,
      mockSession
    );

    expect(table.UserIds).toContain(userId);
    expect(table.PlayerStacks).toContainEqual({
      PlayerId: userId,
      Chips: 500,
    });

    expect(table.save).toHaveBeenCalledWith({
      session: mockSession,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      joinCode: waitingTable.JoinCode,
      alreadySeated: false,
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  // JOIN-CODE LOOKUP TESTS

  test('finds a table by join code and returns its joining information', async () => {
    TableDao.findTableByCode.mockResolvedValue({
      ...waitingTable,
      UserIds: ['user1', 'user2'],
      BotCount: 1,
      _id: {
        toString: () => tableId,
      },
    });

    const req = {
      params: { joinCode: 'ABC12345' },
    };
    const res = mockResponse();

    await TableController.findTableByCode(req, res);

    expect(TableDao.findTableByCode).toHaveBeenCalledWith(req);
    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: tableId,
        name: 'Test Poker Table',
        level: 'Low',
        capacity: 6,
        playerCount: 3,
        status: 'Waiting',
        joinCode: 'ABC12345',
        stakes: {
          smallBet: TABLE_LEVELS.Low.smallBet,
          bigBet: TABLE_LEVELS.Low.bigBet,
          minBuyIn: TABLE_LEVELS.Low.minBuyIn,
          maxBuyIn: TABLE_LEVELS.Low.maxBuyIn,
        },
      })
    );
  });

  test('returns 404 when a join code does not match a table', async () => {
    TableDao.findTableByCode.mockResolvedValue(null);

    const req = {
      params: { joinCode: 'NOTFOUND' },
    };
    const res = mockResponse();

    await TableController.findTableByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Table not found',
    });
  });
});
