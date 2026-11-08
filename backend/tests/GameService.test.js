
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

  const createMockTable = (overrides = {}) => ({
    _id: tableId,
    Status: 'Waiting',
    Level: 'Low',
    UserIds: ['user1', 'user2'],
    BotCount: 0,
    PlayerStacks: [
      { PlayerId: 'user1', Chips: 200 },
      { PlayerId: 'user2', Chips: 200 }
    ],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();

    TableDao.findById.mockResolvedValue(createMockTable());

    TableDao.reserveForGame.mockResolvedValue({
      Status: 'In Progress'
    });

    TableDao.deductPlayerChips.mockResolvedValue({});

    GameDao.create.mockImplementation(async (gameData) => ({
      _id: 'game123',
      ...gameData
    }));

    TableDao.setCurrentGame.mockResolvedValue({});
  });

  // -----------------------------------------
  // Existing Game Service tests
  // -----------------------------------------

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

    expect(TableDao.setCurrentGame).toHaveBeenCalledWith(
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
    TableDao.findById.mockResolvedValue(
      createMockTable({ Status: 'In Progress' })
    );

    await expect(startGame(tableId))
      .rejects.toThrow('Table is not waiting for a game');

    expect(GameDao.create).not.toHaveBeenCalled();
  });

  test('should reject a table with fewer than two players', async () => {
    TableDao.findById.mockResolvedValue(
      createMockTable({ UserIds: ['user1'] })
    );

    await expect(startGame(tableId))
      .rejects.toThrow('A game must have between 2 and 6 players');
  });

  test('should include bots as players', async () => {
    TableDao.findById.mockResolvedValue(
      createMockTable({
        UserIds: ['user1'],
        BotCount: 2,
        PlayerStacks: [
          { PlayerId: 'user1', Chips: 200 }
        ]
      })
    );

    const game = await startGame(tableId);

    expect(game.Players).toHaveLength(3);
    expect(game.Players.map((player) => player.PlayerId)).toEqual(
      expect.arrayContaining([
        'user1',
        `bot-${tableId}-1`,
        `bot-${tableId}-2`,
      ])
    );
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

  // -----------------------------------------
  // P42 - Player Ante and Bring-In tests
  // -----------------------------------------

  test('should collect an ante from every player', async () => {
    await startGame(tableId);

    expect(TableDao.deductPlayerChips).toHaveBeenCalledWith(
      tableId,
      'user1',
      1,
      expect.anything()
    );

    expect(TableDao.deductPlayerChips).toHaveBeenCalledWith(
      tableId,
      'user2',
      1,
      expect.anything()
    );
  });

  test('should collect bring-in from the selected player', async () => {
    const game = await startGame(tableId);

    expect(['user1', 'user2']).toContain(
      game.BringInPlayerId
    );

    expect(TableDao.deductPlayerChips).toHaveBeenCalledWith(
      tableId,
      game.BringInPlayerId,
      2,
      expect.anything()
    );

    // Two antes and one bring-in
    expect(TableDao.deductPlayerChips).toHaveBeenCalledTimes(3);
  });

  test('should calculate the pot correctly', async () => {
    const game = await startGame(tableId);

    // Two players pay 1 ante each,
    // and one player pays 2 bring-in.
    expect(game.Ante).toBe(1);
    expect(game.BringIn).toBe(2);
    expect(game.Pot).toBe(4);
  });

  test('should record player contributions correctly', async () => {
    const game = await startGame(tableId);

    const bringInPlayer = game.Players.find(
      player => player.PlayerId === game.BringInPlayerId
    );

    const otherPlayer = game.Players.find(
      player => player.PlayerId !== game.BringInPlayerId
    );

    expect(bringInPlayer.TotalContribution).toBe(3);
    expect(bringInPlayer.RoundContribution).toBe(2);

    expect(otherPlayer.TotalContribution).toBe(1);
    expect(otherPlayer.RoundContribution).toBe(0);
  });

  test('should reject a player with insufficient chips', async () => {
    TableDao.findById.mockResolvedValue(
      createMockTable({
        PlayerStacks: [
          { PlayerId: 'user1', Chips: 2 },
          { PlayerId: 'user2', Chips: 200 }
        ]
      })
    );

    await expect(startGame(tableId))
      .rejects.toThrow('does not have enough chips to start');

    expect(TableDao.deductPlayerChips).not.toHaveBeenCalled();
    expect(GameDao.create).not.toHaveBeenCalled();
  });

  test('should not create a game if ante deduction fails', async () => {
    TableDao.deductPlayerChips.mockResolvedValueOnce(null);

    await expect(startGame(tableId))
      .rejects.toThrow('Failed to collect ante');

    expect(GameDao.create).not.toHaveBeenCalled();
  });

  test('should not create a game if bring-in deduction fails', async () => {
    TableDao.deductPlayerChips
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(null);

    await expect(startGame(tableId))
      .rejects.toThrow('Failed to collect bring-in');

    expect(GameDao.create).not.toHaveBeenCalled();
  });
});
