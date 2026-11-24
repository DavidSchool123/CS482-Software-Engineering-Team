
const mongoose = require('mongoose');
const TableDao = require('../model/TableDao');
const UserDao = require('../model/UserDao');
const TABLE_LEVELS = require('../model/tableLevels');

const { joinTable } = require('../service/JoinTableService');
const { leaveTable } = require('../service/LeaveTableService');
const { runBotTurns } = require('../service/BotService');

const {
  cancelTurnTimer,
  scheduleTurnTimer
} = require('../service/PlayerActivityService');

const TableController = require('../controller/TableController');

// --------------------------------------------------
// MOCK DEPENDENCIES
// --------------------------------------------------

jest.mock('../model/TableDao');
jest.mock('../model/UserDao');

jest.mock('../service/JoinTableService', () => ({
  joinTable: jest.fn()
}));

jest.mock('../service/LeaveTableService', () => ({
  leaveTable: jest.fn()
}));

jest.mock('../service/BotService', () => ({
  runBotTurns: jest.fn()
}));

jest.mock('../service/PlayerActivityService', () => ({
  cancelTurnTimer: jest.fn(),
  scheduleTurnTimer: jest.fn()
}));

describe('TableController', () => {
  let mockSession;
  let consoleErrorSpy;

  const userId = new mongoose.Types.ObjectId().toString();
  const tableId = new mongoose.Types.ObjectId().toString();
  const gameId = new mongoose.Types.ObjectId().toString();

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

  // --------------------------------------------------
  // TEST HELPERS AND SETUP
  // --------------------------------------------------

  function mockResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  }

  function createRequest(overrides = {}) {
    return {
      body: { ...validTableBody },
      session: { userId },
      ...overrides
    };
  }

  function tableRequest(overrides = {}) {
    return {
      params: { tableId },
      body: { buyIn: 500 },
      session: { userId },
      ...overrides
    };
  }

  function codeRequest(overrides = {}) {
    return {
      params: { joinCode: 'ABC12345' },
      session: {},
      ...overrides
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();

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
  // PUBLIC TABLE RETRIEVAL TESTS
  // --------------------------------------------------

  test('returns formatted public tables', async () => {
    const createdAt = new Date('2026-11-01');

    TableDao.findPublicTables.mockResolvedValue([
      {
        ...waitingTable,
        createdAt,
        UserIds: ['user1', 'user2'],
        BotCount: 2
      }
    ]);

    const res = mockResponse();

    await TableController.getAllTables({}, res);

    expect(TableDao.findPublicTables).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith([
      {
        id: tableId,
        name: waitingTable.Name,
        createdAt,
        level: 'Low',
        capacity: 6,
        humanCount: 2,
        botCount: 2,
        playerCount: 4,
        status: 'Waiting',
        stakes: {
          smallBet: TABLE_LEVELS.Low.smallBet,
          bigBet: TABLE_LEVELS.Low.bigBet,
          minBuyIn: TABLE_LEVELS.Low.minBuyIn,
          maxBuyIn: TABLE_LEVELS.Low.maxBuyIn
        }
      }
    ]);
  });

  test('returns an empty list when no public tables exist', async () => {
    TableDao.findPublicTables.mockResolvedValue([]);

    const res = mockResponse();

    await TableController.getAllTables({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('handles missing optional public table information', async () => {
    TableDao.findPublicTables.mockResolvedValue([
      {
        ...waitingTable,
        createdAt: undefined,
        UserIds: undefined,
        BotCount: undefined,
        Level: 'Unknown'
      }
    ]);

    const res = mockResponse();

    await TableController.getAllTables({}, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        createdAt: null,
        humanCount: 0,
        botCount: 0,
        playerCount: 0,
        stakes: null
      })
    ]);
  });

  test('handles errors when retrieving public tables', async () => {
    TableDao.findPublicTables.mockRejectedValue(
      new Error('Database connection failed')
    );

    const res = mockResponse();

    await TableController.getAllTables({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to retrieve tables'
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // --------------------------------------------------
  // TABLE CREATION TESTS
  // --------------------------------------------------

  test('rejects table creation when user is not logged in', async () => {
    const req = createRequest({ session: {} });
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'You must be logged in to create a table'
    });

    expect(TableDao.create).not.toHaveBeenCalled();
    expect(UserDao.deductChips).not.toHaveBeenCalled();
  });

  test('rejects table creation without a session', async () => {
    const req = createRequest({ session: undefined });
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('rejects table creation with an invalid level', async () => {
    const req = createRequest({
      body: {
        ...validTableBody,
        Level: 'Invalid'
      }
    });

    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid table level'
    });

    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('rejects a buy-in below the minimum', async () => {
    const req = createRequest({
      body: {
        ...validTableBody,
        buyIn: TABLE_LEVELS.Low.minBuyIn - 1
      }
    });

    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TableDao.create).not.toHaveBeenCalled();
  });

  test('rejects a buy-in above the maximum', async () => {
    const req = createRequest({
      body: {
        ...validTableBody,
        buyIn: TABLE_LEVELS.Low.maxBuyIn + 1
      }
    });

    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TableDao.create).not.toHaveBeenCalled();
  });

  test.each([500.5, '500', undefined])(
    'rejects an invalid buy-in: %p',
    async (buyIn) => {
      const req = createRequest({
        body: {
          ...validTableBody,
          buyIn
        }
      });

      const res = mockResponse();

      await TableController.createTable(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message:
          `Buy-in must be between ${TABLE_LEVELS.Low.minBuyIn} ` +
          `and ${TABLE_LEVELS.Low.maxBuyIn} chips`
      });

      expect(TableDao.create).not.toHaveBeenCalled();
      expect(mongoose.startSession).not.toHaveBeenCalled();
    }
  );

  test.each([1, 7, 2.5, '6', undefined])(
    'rejects invalid table capacity: %p',
    async (capacity) => {
      const req = createRequest({
        body: {
          ...validTableBody,
          Capacity: capacity
        }
      });

      const res = mockResponse();

      await TableController.createTable(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Table capacity must be between 2 and 6 players'
      });

      expect(TableDao.create).not.toHaveBeenCalled();
      expect(mongoose.startSession).not.toHaveBeenCalled();
    }
  );

  test.each([-1, 6, 1.5, '2', undefined])(
    'rejects invalid bot count: %p',
    async (botCount) => {
      const req = createRequest({
        body: {
          ...validTableBody,
          BotCount: botCount
        }
      });

      const res = mockResponse();

      await TableController.createTable(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Bot count must fit in the table after the host is seated'
      });

      expect(TableDao.create).not.toHaveBeenCalled();
      expect(mongoose.startSession).not.toHaveBeenCalled();
    }
  );

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

    const req = createRequest();
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
        BotCount: validTableBody.BotCount,
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

    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  test.each([
    TABLE_LEVELS.Low.minBuyIn,
    TABLE_LEVELS.Low.maxBuyIn
  ])(
    'accepts a valid boundary buy-in of %i chips',
    async (buyIn) => {
      UserDao.deductChips.mockResolvedValue({
        _id: userId
      });

      TableDao.create.mockResolvedValue({
        _id: tableId,
        Name: validTableBody.Name,
        JoinCode: 'ABC12345'
      });

      const req = createRequest({
        body: {
          ...validTableBody,
          buyIn
        }
      });

      const res = mockResponse();

      await TableController.createTable(req, res);

      expect(UserDao.deductChips).toHaveBeenCalledWith(
        userId,
        buyIn,
        mockSession
      );

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ buyIn })
      );

      expect(mockSession.endSession).toHaveBeenCalled();
    }
  );

  test('creates a private table with bots', async () => {
    UserDao.deductChips.mockResolvedValue({
      _id: userId
    });

    TableDao.create.mockResolvedValue({
      _id: tableId,
      Name: 'Private Poker Table',
      JoinCode: 'ABC12345'
    });

    const req = createRequest({
      body: {
        ...validTableBody,
        Name: 'Private Poker Table',
        Capacity: 2,
        BotCount: 1,
        IsPublic: false
      }
    });

    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(TableDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        Name: 'Private Poker Table',
        Capacity: 2,
        BotCount: 1,
        IsPublic: false,
        UserIds: [userId]
      }),
      mockSession
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  test('does not create table with insufficient chips', async () => {
    UserDao.deductChips.mockResolvedValue(null);

    const req = createRequest();
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(TableDao.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Insufficient chips or user not found'
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  test('rejects duplicate table names using key pattern', async () => {
    UserDao.deductChips.mockResolvedValue({
      _id: userId
    });

    const error = new Error('Duplicate table name');
    error.code = 11000;
    error.keyPattern = { Name: 1 };

    TableDao.create.mockRejectedValue(error);

    const req = createRequest();
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'A table with this name already exists'
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  test('rejects duplicate names using the unique index name', async () => {
    UserDao.deductChips.mockResolvedValue({
      _id: userId
    });

    const error = new Error(
      'Duplicate key: unique_active_table_name'
    );

    error.code = 11000;

    TableDao.create.mockRejectedValue(error);

    const req = createRequest();
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'A table with this name already exists'
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  test('handles duplicate keys unrelated to table names', async () => {
    UserDao.deductChips.mockResolvedValue({
      _id: userId
    });

    const error = new Error('Duplicate join code');
    error.code = 11000;
    error.keyPattern = { JoinCode: 1 };

    TableDao.create.mockRejectedValue(error);

    const req = createRequest();
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to create table'
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  test('handles duplicate key errors without a message', async () => {
    UserDao.deductChips.mockResolvedValue({
      _id: userId
    });

    TableDao.create.mockRejectedValue({
      code: 11000
    });

    const req = createRequest();
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to create table'
    });

    expect(mockSession.endSession).toHaveBeenCalled();
  });

  test('handles unexpected table creation errors', async () => {
    UserDao.deductChips.mockResolvedValue({
      _id: userId
    });

    TableDao.create.mockRejectedValue(
      new Error('Database unavailable')
    );

    const req = createRequest();
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to create table'
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  test('handles errors while deducting host chips', async () => {
    UserDao.deductChips.mockRejectedValue(
      new Error('Unable to update account')
    );

    const req = createRequest();
    const res = mockResponse();

    await TableController.createTable(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to create table'
    });

    expect(TableDao.create).not.toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  // --------------------------------------------------
  // TABLE JOINING TESTS
  // --------------------------------------------------

  test('rejects joining when user is not logged in', async () => {
    const req = tableRequest({ session: {} });
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'You must be logged in to join a table'
    });

    expect(joinTable).not.toHaveBeenCalled();
  });

  test('rejects joining without a session', async () => {
    const req = tableRequest({ session: undefined });
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(joinTable).not.toHaveBeenCalled();
  });

  test('rejects an invalid table ID', async () => {
    const req = tableRequest({
      params: { tableId: 'invalid-id' }
    });

    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid table ID'
    });

    expect(joinTable).not.toHaveBeenCalled();
  });

  test('joins a table successfully', async () => {
    const result = {
      joinCode: 'ABC12345',
      alreadySeated: false
    };

    joinTable.mockResolvedValue(result);

    const req = tableRequest();
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(joinTable).toHaveBeenCalledWith(
      tableId,
      userId,
      500
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('allows an already-seated player to rejoin', async () => {
    const result = {
      joinCode: 'ABC12345',
      alreadySeated: true
    };

    joinTable.mockResolvedValue(result);

    const req = tableRequest();
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('passes an undefined buy-in when request body is missing', async () => {
    const result = {
      joinCode: 'ABC12345',
      alreadySeated: true
    };

    joinTable.mockResolvedValue(result);

    const req = tableRequest({
      body: undefined
    });

    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(joinTable).toHaveBeenCalledWith(
      tableId,
      userId,
      undefined
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test.each([
    ['Table not found', 404],
    ['Invalid buy-in amount', 400],
    ['Invalid table level', 400],
    ['Insufficient account chips', 400],
    ['Cannot join a game already in progress', 409],
    ['Unable to join table. It may be full or already started.', 409],
    ['Table is closed', 409],
    ['Table is not available', 409],
    ['Table is full', 409],
    ['Please wait until the current hand finishes', 409],
    ['Unable to join table. Please try again between hands.', 409],
    ['Unable to join table', 409]
  ])(
    'handles joining error: %s',
    async (message, status) => {
      joinTable.mockRejectedValue(new Error(message));

      const req = tableRequest();
      const res = mockResponse();

      await TableController.joinTable(req, res);

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({ message });
    }
  );

  test('rejects a buy-in outside the permitted range', async () => {
    const message = 'Buy-in must be between 200 and 1000 chips';

    joinTable.mockRejectedValue(new Error(message));

    const req = tableRequest({
      body: { buyIn: 100 }
    });

    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message });
  });

  test('uses an explicit status supplied by the join service', async () => {
    const error = new Error('Joining is forbidden');
    error.status = 403;

    joinTable.mockRejectedValue(error);

    const req = tableRequest();
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Joining is forbidden'
    });
  });

  test('handles unexpected join service errors', async () => {
    joinTable.mockRejectedValue(
      new Error('Database connection failed')
    );

    const req = tableRequest();
    const res = mockResponse();

    await TableController.joinTable(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to join table'
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('does not expose internal errors with an explicit 500 status', async () => {
    const error = new Error('Sensitive database information');
    error.status = 500;

    joinTable.mockRejectedValue(error);

    const req = tableRequest();
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

    const req = codeRequest();
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
        humanCount: 2,
        botCount: 1,
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

    const req = codeRequest({
      params: { joinCode: 'NOTFOUND' }
    });

    const res = mockResponse();

    await TableController.findTableByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Table not found'
    });
  });

  test('identifies a seated player and the current game', async () => {
    TableDao.findTableByCode.mockResolvedValue({
      ...waitingTable,
      UserIds: [new mongoose.Types.ObjectId(userId)],
      CurrentGameID: new mongoose.Types.ObjectId(gameId),
      Status: 'In Progress'
    });

    const req = codeRequest({
      session: { userId }
    });

    const res = mockResponse();

    await TableController.findTableByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        isPlayer: true,
        currentGameId: gameId,
        status: 'In Progress',
        joinCode: 'ABC12345'
      })
    );
  });

  test('identifies a logged-in user who is not seated', async () => {
    TableDao.findTableByCode.mockResolvedValue({
      ...waitingTable,
      UserIds: ['another-player']
    });

    const req = codeRequest({
      session: { userId }
    });

    const res = mockResponse();

    await TableController.findTableByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        isPlayer: false
      })
    );
  });

  test('handles join-code lookup without a session', async () => {
    TableDao.findTableByCode.mockResolvedValue(waitingTable);

    const req = codeRequest({
      session: undefined
    });

    const res = mockResponse();

    await TableController.findTableByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        isPlayer: false,
        joinCode: 'ABC12345'
      })
    );
  });

  test('handles missing optional fields during join-code lookup', async () => {
    TableDao.findTableByCode.mockResolvedValue({
      ...waitingTable,
      UserIds: undefined,
      BotCount: undefined
    });

    const req = codeRequest({
      session: { userId }
    });

    const res = mockResponse();

    await TableController.findTableByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        humanCount: 0,
        botCount: 0,
        filledSeats: 0,
        playerCount: 0,
        isPlayer: false
      })
    );
  });

  test('handles errors during join-code lookup', async () => {
    TableDao.findTableByCode.mockRejectedValue(
      new Error('Database unavailable')
    );

    const req = codeRequest();
    const res = mockResponse();

    await TableController.findTableByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to find table'
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // --------------------------------------------------
  // TABLE DEPARTURE TESTS
  // --------------------------------------------------

  test('rejects leaving when user is not logged in', async () => {
    const req = tableRequest({
      session: {}
    });

    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'You must be logged in to leave a table'
    });

    expect(leaveTable).not.toHaveBeenCalled();
  });

  test('rejects leaving without a session', async () => {
    const req = tableRequest({
      session: undefined
    });

    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(leaveTable).not.toHaveBeenCalled();
  });

  test('rejects leaving with an invalid table ID', async () => {
    const req = tableRequest({
      params: { tableId: 'invalid-id' }
    });

    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid table ID'
    });

    expect(leaveTable).not.toHaveBeenCalled();
  });

  test('allows a player to leave a waiting table', async () => {
    const result = {
      tableClosed: false,
      gameId: null
    };

    leaveTable.mockResolvedValue(result);

    const req = tableRequest();
    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(leaveTable).toHaveBeenCalledWith(tableId, userId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);

    expect(cancelTurnTimer).not.toHaveBeenCalled();
    expect(runBotTurns).not.toHaveBeenCalled();
    expect(scheduleTurnTimer).not.toHaveBeenCalled();
  });

  test('cancels the timer when departure closes the table', async () => {
    const result = {
      gameId,
      tableClosed: true,
      gameStatus: 'In Progress'
    };

    leaveTable.mockResolvedValue(result);

    const req = tableRequest();
    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(cancelTurnTimer).toHaveBeenCalledWith(gameId);
    expect(runBotTurns).not.toHaveBeenCalled();
    expect(scheduleTurnTimer).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('resumes an active game after a player leaves', async () => {
    const result = {
      gameId,
      tableClosed: false,
      gameStatus: 'In Progress'
    };

    const game = {
      _id: gameId,
      Status: 'In Progress'
    };

    leaveTable.mockResolvedValue(result);
    runBotTurns.mockResolvedValue({ game });

    const req = tableRequest();
    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(cancelTurnTimer).toHaveBeenCalledWith(gameId);
    expect(runBotTurns).toHaveBeenCalledWith(gameId);
    expect(scheduleTurnTimer).toHaveBeenCalledWith(game);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('does not resume bot turns when the game is no longer active', async () => {
    const result = {
      gameId,
      tableClosed: false,
      gameStatus: 'Completed'
    };

    leaveTable.mockResolvedValue(result);

    const req = tableRequest();
    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(cancelTurnTimer).toHaveBeenCalledWith(gameId);
    expect(runBotTurns).not.toHaveBeenCalled();
    expect(scheduleTurnTimer).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('does not schedule a timer when bot turns complete the game', async () => {
    const result = {
      gameId,
      tableClosed: false,
      gameStatus: 'In Progress'
    };

    leaveTable.mockResolvedValue(result);

    runBotTurns.mockResolvedValue({
      game: {
        _id: gameId,
        Status: 'Completed'
      }
    });

    const req = tableRequest();
    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(cancelTurnTimer).toHaveBeenCalledWith(gameId);
    expect(runBotTurns).toHaveBeenCalledWith(gameId);
    expect(scheduleTurnTimer).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('still returns successful departure when bot continuation fails', async () => {
    const result = {
      gameId,
      tableClosed: false,
      gameStatus: 'In Progress'
    };

    leaveTable.mockResolvedValue(result);

    runBotTurns.mockRejectedValue(
      new Error('Unable to process bot turn')
    );

    const req = tableRequest();
    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(cancelTurnTimer).toHaveBeenCalledWith(gameId);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unable to resume game after departure:',
      expect.any(Error)
    );

    expect(scheduleTurnTimer).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('returns an explicit error status from the leave service', async () => {
    const error = new Error('Table not found');
    error.status = 404;

    leaveTable.mockRejectedValue(error);

    const req = tableRequest();
    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Table not found'
    });

    expect(cancelTurnTimer).not.toHaveBeenCalled();
    expect(runBotTurns).not.toHaveBeenCalled();
  });

  test('handles unexpected errors when leaving a table', async () => {
    leaveTable.mockRejectedValue(
      new Error('Database connection failed')
    );

    const req = tableRequest();
    const res = mockResponse();

    await TableController.leaveTable(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to leave table'
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // --------------------------------------------------
  // SPECTATOR ACCESS TESTS
  // --------------------------------------------------

  test('rejects unauthenticated spectators', async () => {
    const req = tableRequest({
      session: {}
    });

    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'You must be logged in to observe a table'
    });

    expect(TableDao.findById).not.toHaveBeenCalled();
  });

  test('rejects spectator requests without a session', async () => {
    const req = tableRequest({
      session: undefined
    });

    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(TableDao.findById).not.toHaveBeenCalled();
  });

  test('rejects an invalid spectator table ID', async () => {
    const req = tableRequest({
      params: { tableId: 'invalid-id' }
    });

    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid table ID'
    });

    expect(TableDao.findById).not.toHaveBeenCalled();
  });

  test('returns 404 when the spectator table does not exist', async () => {
    TableDao.findById.mockResolvedValue(null);

    const req = tableRequest();
    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Table not found'
    });
  });

  test('allows non-players to observe a public table', async () => {
    TableDao.findById.mockResolvedValue({
      ...waitingTable,
      UserIds: ['another-player'],
      IsPublic: true
    });

    const req = tableRequest();
    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(TableDao.findById).toHaveBeenCalledWith(tableId);
    expect(res.status).toHaveBeenCalledWith(200);

    const payload = res.json.mock.calls[0][0];

    expect(payload).toEqual(
      expect.objectContaining({
        id: tableId,
        isPlayer: false,
        isPublic: true,
        name: waitingTable.Name,
        capacity: waitingTable.Capacity,
        stakes: TABLE_LEVELS.Low
      })
    );

    expect(payload).not.toHaveProperty('joinCode');
  });

  test('allows spectators to retrieve an active public game', async () => {
    TableDao.findById.mockResolvedValue({
      ...waitingTable,
      UserIds: ['another-player'],
      BotCount: 2,
      Status: 'In Progress',
      CurrentGameID: new mongoose.Types.ObjectId(gameId),
      IsPublic: true
    });

    const req = tableRequest();
    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const payload = res.json.mock.calls[0][0];

    expect(payload).toEqual(
      expect.objectContaining({
        currentGameId: gameId,
        status: 'In Progress',
        humanCount: 1,
        botCount: 2,
        filledSeats: 3,
        playerCount: 3,
        isPlayer: false
      })
    );

    expect(payload).not.toHaveProperty('joinCode');
  });

  test('prevents non-players from observing private tables', async () => {
    TableDao.findById.mockResolvedValue({
      ...waitingTable,
      UserIds: ['another-player'],
      IsPublic: false
    });

    const req = tableRequest();
    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'You cannot observe this private table'
    });
  });

  test('allows seated players to access their private table', async () => {
    TableDao.findById.mockResolvedValue({
      ...waitingTable,
      UserIds: [new mongoose.Types.ObjectId(userId)],
      IsPublic: false
    });

    const req = tableRequest();
    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const payload = res.json.mock.calls[0][0];

    expect(payload).toEqual(
      expect.objectContaining({
        id: tableId,
        isPlayer: true,
        isPublic: false
      })
    );

    expect(payload).not.toHaveProperty('joinCode');
  });

  test('identifies seated players accessing a public table', async () => {
    TableDao.findById.mockResolvedValue({
      ...waitingTable,
      UserIds: [userId],
      IsPublic: true
    });

    const req = tableRequest();
    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        isPlayer: true,
        isPublic: true
      })
    );
  });

  test('handles unexpected spectator retrieval errors', async () => {
    TableDao.findById.mockRejectedValue(
      new Error('Database unavailable')
    );

    const req = tableRequest();
    const res = mockResponse();

    await TableController.getTableForSpectating(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to retrieve table'
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // --------------------------------------------------
  // PLAYER HEARTBEAT TESTS
  // --------------------------------------------------

  test('rejects heartbeat requests from unauthenticated users', async () => {
    const req = tableRequest({
      session: {}
    });

    const res = mockResponse();

    await TableController.heartbeat(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'You must be logged in.'
    });

    expect(TableDao.updatePlayerPresence).not.toHaveBeenCalled();
  });

  test('rejects heartbeat requests without a session', async () => {
    const req = tableRequest({
      session: undefined
    });

    const res = mockResponse();

    await TableController.heartbeat(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(TableDao.updatePlayerPresence).not.toHaveBeenCalled();
  });

  test('rejects heartbeat requests with an invalid table ID', async () => {
    const req = tableRequest({
      params: { tableId: 'invalid-id' }
    });

    const res = mockResponse();

    await TableController.heartbeat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid table ID.'
    });

    expect(TableDao.updatePlayerPresence).not.toHaveBeenCalled();
  });

  test('successfully updates a seated player presence', async () => {
    TableDao.updatePlayerPresence.mockResolvedValue({
      ...waitingTable,
      UserIds: [userId]
    });

    const req = tableRequest();
    const res = mockResponse();

    await TableController.heartbeat(req, res);

    expect(TableDao.updatePlayerPresence).toHaveBeenCalledWith(
      tableId,
      userId
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Heartbeat received.'
    });
  });

  test('rejects heartbeat requests from players not seated at the table', async () => {
    TableDao.updatePlayerPresence.mockResolvedValue(null);

    const req = tableRequest();
    const res = mockResponse();

    await TableController.heartbeat(req, res);

    expect(TableDao.updatePlayerPresence).toHaveBeenCalledWith(
      tableId,
      userId
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'You are not seated at this table.'
    });
  });

  test('handles unexpected heartbeat errors', async () => {
    TableDao.updatePlayerPresence.mockRejectedValue(
      new Error('Database unavailable')
    );

    const req = tableRequest();
    const res = mockResponse();

    await TableController.heartbeat(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unable to update player presence.'
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
