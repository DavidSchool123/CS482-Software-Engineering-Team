
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

    // Fake the result of calling .select() on the query
    const selectMock = jest.fn().mockResolvedValue(mockTables);

    findSpy.mockReturnValue({
      select: selectMock,
    });

    const result = await TableDao.findPublicTables();

    // Only public tables that are not closed should be requested
    expect(findSpy).toHaveBeenCalledWith({
      IsPublic: true,
      Status: { $ne: 'Closed' },
    });

    // Check which fields the DAO requests
    expect(selectMock).toHaveBeenCalledWith(
      'Name Capacity UserIds BotCount Level Status'
    );

    // Check that the DAO returns the query results
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
