
const mongoose = require('mongoose');

const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
const { startGame } = require('../service/GameService');

jest.mock('../model/TableDao');
jest.mock('../model/GameDao');

jest.spyOn(mongoose, 'startSession').mockImplementation(async () => ({
  withTransaction: async (callback) => callback(),
  endSession: jest.fn().mockResolvedValue(undefined)
}));

describe('Game Service', () => {
  const tableId = '507f1f77bcf86cd799439011';

  const mockTable = {
    _id: tableId,
    Status: 'Waiting',
    UserIds: ['user1', 'user2'],
    BotCount: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();

    TableDao.findById.mockResolvedValue({ ...mockTable });

    TableDao.reserveForGame.mockResolvedValue({
      ...mockTable,
      Status: 'In Progress'
    });

    GameDao.create.mockImplementation(async (gameData) => ({
      _id: 'game123',
      ...gameData
    }));

    TableDao.setCurrentGame.mockResolvedValue({});
  });

  test('should start a game and deal three cards to each player', async () => {
    const game = await startGame(tableId);

    expect(game.Players).toHaveLength(2);
    expect(game.Players[0].Cards).toHaveLength(3);
    expect(game.Players[1].Cards).toHaveLength(3);
    expect(game.Deck).toHaveLength(46);
    expect(game.Street).toBe(3);
    expect(game.Status).toBe('In Progress');
  });

  test('should link the new game to its table', async () => {
    await startGame(tableId);

    expect(TableDao.setCurrentGame)
      .toHaveBeenCalledWith(
        tableId,
        'game123',
        expect.anything()
      );
  });

  test('should reject a nonexistent table', async () => {
    TableDao.findById.mockResolvedValue(null);

    await expect(startGame(tableId))
      .rejects.toThrow('Table not found');

    expect(GameDao.create).not.toHaveBeenCalled();
  });

  test('should reject a table already in progress', async () => {
    TableDao.findById.mockResolvedValue({
      ...mockTable,
      Status: 'In Progress'
    });

    await expect(startGame(tableId))
      .rejects.toThrow('Table is not waiting for a game');

    expect(GameDao.create).not.toHaveBeenCalled();
  });

  test('should reject a table with fewer than two players', async () => {
    TableDao.findById.mockResolvedValue({
      ...mockTable,
      UserIds: ['user1']
    });

    await expect(startGame(tableId))
      .rejects.toThrow('A game must have between 2 and 6 players');
  });

  test('should include bots as players', async () => {
    TableDao.findById.mockResolvedValue({
      ...mockTable,
      UserIds: ['user1'],
      BotCount: 2
    });

    const game = await startGame(tableId);

    expect(game.Players).toHaveLength(3);
    expect(game.Players[1].PlayerId).toBe(`bot-${tableId}-1`);
    expect(game.Players[2].PlayerId).toBe(`bot-${tableId}-2`);
    expect(game.Deck).toHaveLength(43);
  });

  test('should not update the table if game creation fails', async () => {
    GameDao.create.mockRejectedValue(
      new Error('Database error')
    );

    await expect(startGame(tableId))
      .rejects.toThrow('Database error');

    expect(TableDao.setCurrentGame).not.toHaveBeenCalled();
  });

  test('should reject a table that cannot be reserved', async () => {
    TableDao.reserveForGame.mockResolvedValue(null);

    await expect(startGame(tableId))
      .rejects.toThrow('Table is not waiting for a game');

    expect(GameDao.create).not.toHaveBeenCalled();
  });
});
