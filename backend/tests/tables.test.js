
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const TableDao = require('../model/TableDao');
const UserDao = require('../model/UserDao');
const TableController = require('../controller/TableController');
const TABLE_LEVELS = require('../model/tableLevels');

// Mock the database functions so tests don't access MongoDB
jest.mock('../model/TableDao');
jest.mock('../model/UserDao');

describe('P9 - View Available Tables', () => {

  // Sample public tables returned by the DAO
  const mockTables = [
    {
      _id: 'table1',
      Name: 'High Rollers',
      Capacity: 6,
      UserIds: [],
      BotCount: 2,
      IsPublic: true,
      Level: 'High',
      Status: 'Waiting',
    },
    {
      _id: 'table2',
      Name: 'Midnight Poker',
      Capacity: 6,
      UserIds: [],
      BotCount: 3,
      IsPublic: true,
      Level: 'Medium',
      Status: 'In Progress',
    },
    {
      _id: 'table3',
      Name: 'Study Break',
      Capacity: 2,
      UserIds: [],
      BotCount: 2,
      IsPublic: true,
      Level: 'Low',
      Status: 'In Progress',
    },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Joining a table', () => {
    let session;
    let table;
    let req;
    let res;

    beforeEach(() => {
      session = {
        withTransaction: jest.fn(async (callback) => callback()),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);

      table = {
        UserIds: [],
        PlayerStacks: [],
        BotCount: 0,
        Capacity: 6,
        Status: 'Waiting',
        Level: 'Low',
        JoinCode: 'ABCD1234',
        save: jest.fn().mockResolvedValue(true),
      };
      TableDao.findById.mockResolvedValue(table);
      UserDao.deductChips.mockResolvedValue({ _id: 'player-1' });

      req = {
        session: { userId: 'player-1' },
        params: { tableId: '507f1f77bcf86cd799439011' },
        body: { buyIn: TABLE_LEVELS.Low.minBuyIn },
      };
      res = {
        status: jest.fn(function(statusCode) {
          this.statusCode = statusCode;
          return this;
        }),
        json: jest.fn(function(body) {
          this.body = body;
          return this;
        }),
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('deducts the buy-in, seats the player, and returns the table code', async () => {
      await TableController.joinTable(req, res);

      expect(UserDao.deductChips).toHaveBeenCalledWith(
        'player-1',
        TABLE_LEVELS.Low.minBuyIn,
        session
      );
      expect(table.UserIds).toContain('player-1');
      expect(table.PlayerStacks).toContainEqual({
        PlayerId: 'player-1',
        Chips: TABLE_LEVELS.Low.minBuyIn,
      });
      expect(table.save).toHaveBeenCalledWith({ session });
      expect(res.statusCode).toBe(200);
      expect(res.body.joinCode).toBe('ABCD1234');
    });

    test('rejects invalid buy-ins without charging the player', async () => {
      req.body.buyIn = 1;

      await TableController.joinTable(req, res);

      expect(UserDao.deductChips).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Invalid buy-in amount');
    });

    test('does not charge a player who is already seated', async () => {
      table.UserIds.push('player-1');

      await TableController.joinTable(req, res);

      expect(UserDao.deductChips).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body.alreadySeated).toBe(true);
    });
  });

  // TEST 1: Successfully retrieve public tables
  test('GET /api/tables returns status 200', async () => {
    TableDao.findPublicTables.mockResolvedValue(mockTables);

    const response = await request(app).get('/api/tables');

    expect(response.statusCode).toBe(200);
  });

  // TEST 2: Return formatted table data
  test('GET /api/tables returns formatted table records', async () => {
    TableDao.findPublicTables.mockResolvedValue(mockTables);

    const response = await request(app).get('/api/tables');

    expect(response.body).toHaveLength(3);

    expect(response.body[0]).toMatchObject({
      id: 'table1',
      name: 'High Rollers',
      level: 'High',
      capacity: 6,
      playerCount: 2,
      status: 'Waiting',
    });
  });

  // TEST 3: Use the public-table DAO query
  test('GET /api/tables requests public, non-closed tables', async () => {
    TableDao.findPublicTables.mockResolvedValue(mockTables);

    await request(app).get('/api/tables');

    expect(TableDao.findPublicTables).toHaveBeenCalledTimes(1);
    expect(TableDao.findAll).not.toHaveBeenCalled();
  });

  // TEST 4: Return an empty array when no tables exist
  test('GET /api/tables returns an empty array when no tables exist', async () => {
    TableDao.findPublicTables.mockResolvedValue([]);

    const response = await request(app).get('/api/tables');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  // TEST 5: Return the fields needed by the Lobby
  test('GET /api/tables returns the required Lobby fields', async () => {
    TableDao.findPublicTables.mockResolvedValue(mockTables);

    const response = await request(app).get('/api/tables');

    const table = response.body[0];

    expect(table).toHaveProperty('id');
    expect(table).toHaveProperty('name');
    expect(table).toHaveProperty('level');
    expect(table).toHaveProperty('capacity');
    expect(table).toHaveProperty('playerCount');
    expect(table).toHaveProperty('status');
    expect(table).toHaveProperty('stakes');
  });

  // TEST 6: Calculate occupied seats from players and bots
  test('GET /api/tables calculates occupied seats correctly', async () => {
    TableDao.findPublicTables.mockResolvedValue([
      {
        ...mockTables[0],
        UserIds: ['user1', 'user2'],
        BotCount: 2,
      },
    ]);

    const response = await request(app).get('/api/tables');

    expect(response.body[0].playerCount).toBe(4);
    expect(response.body[0].capacity).toBe(6);
  });

  // TEST 7: Include waiting and in-progress tables
  test('GET /api/tables includes waiting and in-progress tables', async () => {
    TableDao.findPublicTables.mockResolvedValue(mockTables);

    const response = await request(app).get('/api/tables');

    const statuses = response.body.map((table) => table.status);

    expect(statuses).toContain('Waiting');
    expect(statuses).toContain('In Progress');
  });

  // TEST 8: Return correct betting information
  test('GET /api/tables returns stakes for each level', async () => {
    TableDao.findPublicTables.mockResolvedValue(mockTables);

    const response = await request(app).get('/api/tables');

    const highTable = response.body.find(
      (table) => table.level === 'High'
    );

    const mediumTable = response.body.find(
      (table) => table.level === 'Medium'
    );

    const lowTable = response.body.find(
      (table) => table.level === 'Low'
    );

    for (const [table, level] of [
      [highTable, 'High'],
      [mediumTable, 'Medium'],
      [lowTable, 'Low'],
    ]) {
      expect(table.stakes).toEqual({
        smallBet: TABLE_LEVELS[level].smallBet,
        bigBet: TABLE_LEVELS[level].bigBet,
        minBuyIn: TABLE_LEVELS[level].minBuyIn,
        maxBuyIn: TABLE_LEVELS[level].maxBuyIn,
      });
    }
  });

  // TEST 9: Do not expose private table join codes
  test('GET /api/tables does not expose join codes', async () => {
    TableDao.findPublicTables.mockResolvedValue([
      {
        ...mockTables[0],
        JoinCode: 'SECRET123',
      },
    ]);

    const response = await request(app).get('/api/tables');

    expect(response.body[0]).not.toHaveProperty('JoinCode');
    expect(response.body[0]).not.toHaveProperty('joinCode');
  });

  // TEST 10: Handle database errors
  test('GET /api/tables returns 500 when database retrieval fails', async () => {
    TableDao.findPublicTables.mockRejectedValue(
      new Error('Database connection failed')
    );

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await request(app).get('/api/tables');

      expect(response.statusCode).toBe(500);

      expect(response.body).toEqual({
        message: 'Unable to retrieve tables',
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  // TEST 11: Don't expose internal database errors
  test('GET /api/tables does not expose internal database errors', async () => {
    TableDao.findPublicTables.mockRejectedValue(
      new Error('Sensitive internal database details')
    );

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await request(app).get('/api/tables');

      expect(response.statusCode).toBe(500);

      expect(JSON.stringify(response.body))
        .not.toContain('Sensitive internal database details');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  // TEST 12: Full tables are still returned
  test('GET /api/tables includes full tables', async () => {
    TableDao.findPublicTables.mockResolvedValue(mockTables);

    const response = await request(app).get('/api/tables');

    const fullTable = response.body.find(
      (table) => table.name === 'Study Break'
    );

    expect(fullTable.playerCount).toBe(2);
    expect(fullTable.capacity).toBe(2);
    expect(fullTable.status).toBe('In Progress');
  });

});
