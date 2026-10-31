const mockSave = jest.fn();
const mockFind = jest.fn();

jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');

  return {
    ...actualMongoose,
    model: jest.fn(() => {
      return class MockTable {
        constructor(data) {
          Object.assign(this, data);
        }

        save() {
          return mockSave();
        }

        static find(...args) {
          return mockFind(...args);
        }
      };
    }),
  };
});

const TableDao = require('../model/TableDao');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Additional TableDao tests', () => {
  test('create saves a new table', async () => {
    const tableData = {
      Name: 'Beginner Table',
      JoinCode: 'ABC123',
      Capacity: 6,
      UserIds: [],
      BotCount: 0,
      IsPublic: true,
      Level: 'Low',
      Status: 'Waiting',
    };

    mockSave.mockResolvedValue(undefined);

    const result = await TableDao.create(tableData);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining(tableData),
    );
  });

  test('findAll retrieves all tables', async () => {
    const tables = [
      { Name: 'Table 1', Capacity: 4 },
      { Name: 'Table 2', Capacity: 6 },
    ];

    const mockSelect = jest.fn().mockResolvedValue(tables);
    mockFind.mockReturnValue({ select: mockSelect });

    const result = await TableDao.findAll();

    expect(mockFind).toHaveBeenCalledWith();
    expect(mockSelect).toHaveBeenCalledWith(
      'Name Capacity UserIds BotCount IsPublic Level Status',
    );
    expect(result).toEqual(tables);
  });

  test('findAll returns an empty array when no tables exist', async () => {
    const mockSelect = jest.fn().mockResolvedValue([]);
    mockFind.mockReturnValue({ select: mockSelect });

    const result = await TableDao.findAll();

    expect(result).toEqual([]);
  });

  test('create propagates database save errors', async () => {
    mockSave.mockRejectedValue(new Error('Database unavailable'));

    await expect(
      TableDao.create({
        Name: 'Test Table',
        JoinCode: 'XYZ123',
        Capacity: 4,
        UserIds: [],
        BotCount: 0,
        IsPublic: true,
        Level: 'Low',
      }),
    ).rejects.toThrow('Database unavailable');
  });
});