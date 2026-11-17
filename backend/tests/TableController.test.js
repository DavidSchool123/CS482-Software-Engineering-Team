
const mongoose = require('mongoose');
const TableDao = require('../model/TableDao');
const UserDao = require('../model/UserDao');
const TABLE_LEVELS = require('../model/tableLevels');
const { joinTable } = require('../service/JoinTableService');
const TableController = require('../controller/TableController');

jest.mock('../model/TableDao');
jest.mock('../model/UserDao');
jest.mock('../service/JoinTableService', () => ({
  joinTable: jest.fn()
}));

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
    buyIn: 500
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
    IsPublic: true,
    CurrentGameID: null
  };

  function mockResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {
      withTransaction: jest.fn(async callback => callback()),
      endSession: jest.fn().mockResolvedValue(undefined)
    };

    jest.spyOn(mongoose, 'startSession')
      .mockResolvedValue(mockSession);

    consoleErrorSpy = jest.spyOn(console, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --------------------------------------------------
  // TABLE CREATION TESTS
  // --------------------------------------------------

  test('rejects table creation when user is not logged in', async () => {
    const req = {
      body: validTableBody,
      session: {}
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'You must be logged in to create a table'
    });

    expect(TableDao.create).not.toHaveBeenCalled();
    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects table creation with an invalid level', async () => {
    const req = {
      body: {
        ...validTableBody,
        Level: 'Invalid'
      },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid table level'
    });

    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('rejects a buy-in below the minimum', async () => {
    const req = {
      body: {
        ...validTableBody,
        buyIn: TABLE_LEVELS.Low.minBuyIn - 1
      },
      session: { userId }
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
        buyIn: TABLE_LEVELS.Low.maxBuyIn + 1
      },
      session: { userId }
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
        buyIn: 500.5
      },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TableDao.create).not.toHaveBeenCalled();
  });

  test('rejects invalid table capacity', async () => {
    const req = {
      body: {
        ...validTableBody,
        Capacity: 7
      },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TableDao.create).not.toHaveBeenCalled();
  });

  test('rejects bot count exceeding available seats', async () => {
    const req = {
      body: {
        ...validTableBody,
        BotCount: 6
      },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TableDao.create).not.toHaveBeenCalled();
  });

  test('creates a table and deducts host buy-in', async () => {
    const createdTable = {
      _id: new mongoose.Types.ObjectId(),
      Name: validTableBody.Name,
      JoinCode: 'ABC12345'
    };

    UserDao.deductChips.mockResolvedValue({
      _id: userId,
      chipBalance: 500
    });

    TableDao.create.mockResolvedValue(createdTable);

    const req = {
      body: validTableBody,
      session: { userId }
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
            Chips: validTableBody.buyIn
          }
        ]
      }),
      mockSession
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: createdTable._id.toString(),
      name: validTableBody.Name,
      joinCode: 'ABC12345',
      buyIn: validTableBody.buyIn
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  test('does not create table with insufficient chips', async () => {
    UserDao.deductChips.mockResolvedValue(null);

    const req = {
      body: validTableBody,
      session: { userId }
    };
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(TableDao.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Insufficient chips or user not found'
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  // --------------------------------------------------
  // TABLE JOINING TESTS
  // --------------------------------------------------

  test('rejects joining when user is not logged in', async () => {
    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: {}
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(joinTable).not.toHaveBeenCalled();
  });

  test('rejects an invalid table ID', async () => {
    const req = {
      params: { tableId: 'invalid-id' },
      body: { buyIn: 500 },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid table ID'
    });
    expect(joinTable).not.toHaveBeenCalled();
  });

  test('joins a table successfully', async () => {
    joinTable.mockResolvedValue({
      joinCode: 'ABC12345',
      alreadySeated: false
    });

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(joinTable).toHaveBeenCalledWith(
      tableId,
      userId,
      500
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      joinCode: 'ABC12345',
      alreadySeated: false
    });
  });

  test('allows an already-seated player to rejoin', async () => {
    joinTable.mockResolvedValue({
      joinCode: 'ABC12345',
      alreadySeated: true
    });

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      joinCode: 'ABC12345',
      alreadySeated: true
    });
  });

  test('returns 404 when table does not exist', async () => {
    joinTable.mockRejectedValue(
      new Error('Table not found')
    );

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Table not found'
    });
  });

  test('rejects joining a game already in progress', async () => {
    joinTable.mockRejectedValue(
      new Error('Cannot join a game already in progress')
    );

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Cannot join a game already in progress'
    });
  });

  test('rejects invalid buy-in', async () => {
    joinTable.mockRejectedValue(
      new Error('Buy-in must be between 200 and 1000 chips')
    );

    const req = {
      params: { tableId },
      body: { buyIn: 100 },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects insufficient account chips', async () => {
    joinTable.mockRejectedValue(
      new Error('Insufficient account chips')
    );

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Insufficient account chips'
    });
  });

  test('rejects a failed table join', async () => {
    joinTable.mockRejectedValue(
      new Error(
        'Unable to join table. It may be full or already started.'
      )
    );

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('handles unexpected service errors', async () => {
    joinTable.mockRejectedValue(
      new Error('Database connection failed')
    );

    const req = {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId }
    };
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to join table'
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // --------------------------------------------------
  // JOIN-CODE LOOKUP TESTS
  // --------------------------------------------------

  test('finds a table by join code', async () => {
    TableDao.findTableByCode.mockResolvedValue({
      ...waitingTable,
      UserIds: ['user1', 'user2'],
      BotCount: 1
    });

    const req = {
      params: { joinCode: 'ABC12345' },
      session: {}
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
        filledSeats: 3,
        playerCount: 3,
        status: 'Waiting',
        joinCode: 'ABC12345',
        isPlayer: false,
        isPublic: true,
        currentGameId: null,
        stakes: TABLE_LEVELS.Low
      })
    );
  });

  test('returns 404 when join code does not match', async () => {
    TableDao.findTableByCode.mockResolvedValue(null);

    const req = {
      params: { joinCode: 'NOTFOUND' },
      session: {}
    };
    const res = mockResponse();

    await TableController.findTableByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Table not found'
    });
  });
});
