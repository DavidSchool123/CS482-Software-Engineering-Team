
const request = require('supertest');
const app = require('../app');
const TableDao = require('../model/TableDao');

// Mock the database functions so tests don't access MongoDB
jest.mock('../model/TableDao');

describe('P9 - View Available Tables', () => {

  // Sample tables used for testing
  const mockTables = [
    {
      _id: 'table1',
      Name: 'High Rollers',
      Capacity: 6,
      UserIds: [],
      BotCount: 2,
      IsPublic: true,
      MaxBet: 1000,
      Status: 'Waiting',
    },
    {
      _id: 'table2',
      Name: 'Ravens Table',
      Capacity: 4,
      UserIds: [],
      BotCount: 1,
      IsPublic: false,
      MaxBet: 300,
      Status: 'Waiting',
    },
    {
      _id: 'table3',
      Name: 'Study Break',
      Capacity: 2,
      UserIds: [],
      BotCount: 2,
      IsPublic: true,
      MaxBet: 50,
      Status: 'In Progress',
    },
  ];

  // Reset mocks before each test
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // TEST 1: Successfully retrieve tables
  test('GET /api/tables returns status 200', async () => {
    TableDao.findAll.mockResolvedValue(mockTables);

    const response = await request(app)
      .get('/api/tables');

    expect(response.statusCode).toBe(200);
  });

  // TEST 2: Return the correct table data
  test('GET /api/tables returns all table records', async () => {
    TableDao.findAll.mockResolvedValue(mockTables);

    const response = await request(app)
      .get('/api/tables');

    expect(response.body).toEqual(mockTables);
    expect(response.body).toHaveLength(3);
  });

  // TEST 3: Include public and private tables
  test('GET /api/tables includes both public and private tables', async () => {
    TableDao.findAll.mockResolvedValue(mockTables);

    const response = await request(app)
      .get('/api/tables');

    const publicTables = response.body.filter(
      (table) => table.IsPublic === true
    );

    const privateTables = response.body.filter(
      (table) => table.IsPublic === false
    );

    expect(publicTables).toHaveLength(2);
    expect(privateTables).toHaveLength(1);
  });

  // TEST 4: Return an empty array when no tables exist
  test('GET /api/tables returns an empty array when no tables exist', async () => {
    TableDao.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/tables');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  // TEST 5: Return important table information
  test('GET /api/tables returns the fields needed by the Lobby', async () => {
    TableDao.findAll.mockResolvedValue(mockTables);

    const response = await request(app)
      .get('/api/tables');

    const table = response.body[0];

    expect(table).toHaveProperty('Name');
    expect(table).toHaveProperty('Capacity');
    expect(table).toHaveProperty('UserIds');
    expect(table).toHaveProperty('BotCount');
    expect(table).toHaveProperty('IsPublic');
    expect(table).toHaveProperty('MaxBet');
    expect(table).toHaveProperty('Status');
  });

  // TEST 6: Return correct player and bot information
  test('GET /api/tables returns player and bot counts', async () => {
    TableDao.findAll.mockResolvedValue(mockTables);

    const response = await request(app)
      .get('/api/tables');

    const table = response.body[0];

    const occupiedSeats =
      table.UserIds.length + table.BotCount;

    expect(occupiedSeats).toBe(2);
    expect(table.Capacity).toBe(6);
  });

  // TEST 7: Return tables with different game statuses
  test('GET /api/tables includes waiting and in-progress tables', async () => {
    TableDao.findAll.mockResolvedValue(mockTables);

    const response = await request(app)
      .get('/api/tables');

    const statuses = response.body.map(
      (table) => table.Status
    );

    expect(statuses).toContain('Waiting');
    expect(statuses).toContain('In Progress');
  });

  // TEST 8: Call the DAO function exactly once
  test('GET /api/tables calls TableDao.findAll once', async () => {
    TableDao.findAll.mockResolvedValue(mockTables);

    await request(app).get('/api/tables');

    expect(TableDao.findAll).toHaveBeenCalledTimes(1);
  });

  // TEST 9: Handle database errors
  test('GET /api/tables returns 500 when database retrieval fails', async () => {
    TableDao.findAll.mockRejectedValue(
      new Error('Database connection failed')
    );

    // Hide expected error messages during this test
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await request(app)
        .get('/api/tables');

      expect(response.statusCode).toBe(500);

      expect(response.body).toEqual({
        message: 'Unable to retrieve tables',
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  // TEST 10: Don't expose database error details to users
  test('GET /api/tables does not expose internal database errors', async () => {
    TableDao.findAll.mockRejectedValue(
      new Error('Sensitive internal database details')
    );

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await request(app)
        .get('/api/tables');

      expect(response.statusCode).toBe(500);
      expect(JSON.stringify(response.body))
        .not.toContain('Sensitive internal database details');
    } finally {
      consoleSpy.mockRestore();
    }
  });

});
