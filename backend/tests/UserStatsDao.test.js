
const User = require('../model/UserDao');

describe('UserDao player statistics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('increments all statistics for a winning game', async () => {
    const updatedUser = {
      _id: 'user123',
      stats: {
        wins: 1,
        losses: 0,
        gamesPlayed: 1,
        totalChipsWon: 500,
        netWinnings: 300,
      },
    };

    const session = { id: 'test-session' };

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(updatedUser);

    const result = await User.updateGameStats(
      'user123',
      {
        wins: 1,
        losses: 0,
        totalChipsWon: 500,
        netWinnings: 300,
      },
      session,
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user123',
      {
        $inc: {
          'stats.wins': 1,
          'stats.losses': 0,
          'stats.gamesPlayed': 1,
          'stats.totalChipsWon': 500,
          'stats.netWinnings': 300,
        },
      },
      {
        new: true,
        session,
        runValidators: true,
      },
    );

    expect(result).toEqual(updatedUser);
  });

  test('increments statistics correctly for a loss', async () => {
    const session = {};

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue({ _id: 'user123' });

    await User.updateGameStats(
      'user123',
      {
        wins: 0,
        losses: 1,
        totalChipsWon: 0,
        netWinnings: -200,
      },
      session,
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user123',
      {
        $inc: {
          'stats.wins': 0,
          'stats.losses': 1,
          'stats.gamesPlayed': 1,
          'stats.totalChipsWon': 0,
          'stats.netWinnings': -200,
        },
      },
      {
        new: true,
        session,
        runValidators: true,
      },
    );
  });

  test('passes zero winnings correctly', async () => {
    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue({ _id: 'user123' });

    await User.updateGameStats(
      'user123',
      {
        wins: 0,
        losses: 1,
        totalChipsWon: 0,
        netWinnings: 0,
      },
      null,
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalled();
  });
});
