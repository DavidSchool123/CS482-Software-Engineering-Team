const UserDao = require('../model/UserDao');
const { settleHand } = require('../service/SettlementService');

jest.mock('../model/UserDao');

describe('SettlementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    UserDao.creditChips.mockResolvedValue({ _id: 'user' });
  });

  test('splits a tied pot, cashes out human stacks, and closes the table', async () => {
    const session = {};
    const game = {
      Pot: 5,
      Players: [],
    };
    const table = {
      UserIds: ['player-1', 'player-2'],
      PlayerStacks: [
        { PlayerId: 'player-1', Chips: 100 },
        { PlayerId: 'player-2', Chips: 50 },
        { PlayerId: 'bot-table-1', Chips: 200 },
      ],
      Status: 'In Progress',
      save: jest.fn().mockResolvedValue(undefined),
    };

    await settleHand(
      game,
      table,
      ['player-1', 'player-2'],
      session
    );

    expect(UserDao.creditChips).toHaveBeenNthCalledWith(
      1,
      'player-1',
      103,
      session
    );
    expect(UserDao.creditChips).toHaveBeenNthCalledWith(
      2,
      'player-2',
      52,
      session
    );
    expect(table.PlayerStacks.every((stack) => stack.Chips === 0)).toBe(true);
    expect(table.Status).toBe('Closed');
    expect(game.Status).toBe('Completed');
    expect(game.WinnerIds).toEqual(['player-1', 'player-2']);
    expect(table.save).toHaveBeenCalledWith({ session });
  });
});
