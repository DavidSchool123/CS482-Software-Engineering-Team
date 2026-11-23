const User = require('../model/UserDao');

describe('UserDao account and profile operations', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('readAll retrieves users with admin dashboard fields', async () => {
    const users = [
      {
        _id: '1',
        username: 'alice',
        email: 'alice@example.com',
        userType: 'registered',
        isAdmin: false,
        isBanned: false,
        stats: {
          wins: 3,
          losses: 2,
          gamesPlayed: 5,
          totalChipsWon: 1500,
          netWinnings: 300,
        },
        createdAt: new Date('2026-01-01'),
      },
    ];

    const select = jest.fn().mockResolvedValue(users);
    jest.spyOn(User, 'find').mockReturnValue({ select });

    const result = await User.readAll();

    expect(User.find).toHaveBeenCalledWith();

    expect(select).toHaveBeenCalledWith(
      '_id username email userType isAdmin isBanned stats createdAt'
    );

    expect(result).toEqual(users);
  });

  test('getProfile returns formatted profile information', async () => {
    const user = {
      _id: 'user123',
      username: 'alice',
      email: 'alice@example.com',
      friends: ['friend1', 'friend2'],
      avatar: 'avatar-data',
      stats: {
        wins: 5,
        losses: 3,
        gamesPlayed: 8,
        totalChipsWon: 2500,
        netWinnings: 1200,
      },
    };

    const select = jest.fn().mockResolvedValue(user);
    jest.spyOn(User, 'findById').mockReturnValue({ select });

    const result = await User.getProfile('user123');

    expect(select).toHaveBeenCalledWith(
          '_id username email friends avatar userType chipBalance isAdmin stats',
        );

    expect(result).toEqual({
      _id: 'user123',
      username: 'alice',
      email: 'alice@example.com',
      friendCount: 2,
      avatar: 'avatar-data',
      stats: {
        wins: 5,
        losses: 3,
        gamesPlayed: 8,
        totalChipsWon: 2500,
        netWinnings: 1200,
      },
    });
  });

  test('getProfile returns null when user does not exist', async () => {
    const select = jest.fn().mockResolvedValue(null);
    jest.spyOn(User, 'findById').mockReturnValue({ select });

    const result = await User.getProfile('missing');

    expect(result).toBeNull();
  });

  test('updateAvatar updates and returns the user', async () => {
    const updated = { _id: 'user123', avatar: 'image-data' };

    jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updated);

    const result = await User.updateAvatar('user123', 'image-data');

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user123',
      { avatar: 'image-data' },
      {
        returnDocument: 'after',
        runValidators: true,
        select: '_id avatar',
      },
    );
    expect(result).toEqual(updated);
  });


test('getProfile defaults statistics to zero when stats are missing', async () => {
  const user = {
    _id: 'user123',
    username: 'alice',
    email: 'alice@example.com',
    friends: [],
    avatar: '',
    userType: 'registered',
    chipBalance: 1000,
  };

  const select = jest.fn().mockResolvedValue(user);
  jest.spyOn(User, 'findById').mockReturnValue({ select });

  const result = await User.getProfile('user123');

  expect(result.stats).toEqual({
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    totalChipsWon: 0,
    netWinnings: 0,
  });
});


  test('creditChips returns settled chips to the account', async () => {
    const updatedUser = { _id: 'user123', chipBalance: 1_100 };
    const session = {};
    jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updatedUser);

    const result = await User.creditChips('user123', 100, session);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user123',
      { $inc: { chipBalance: 100 } },
      {
        new: true,
        session,
        runValidators: true,
      },
    );
    expect(result).toEqual(updatedUser);
  });

  test('updateUser updates an existing user', async () => {
    const updatedData = { username: 'newname' };
    const user = { _id: 'user123', ...updatedData };

    jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(user);

    const result = await User.updateUser('user123', updatedData);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user123',
      updatedData,
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    expect(result).toEqual(user);
  });

  test('deleteUser removes an existing user', async () => {
    const deleted = { _id: 'user123' };

    jest.spyOn(User, 'findByIdAndDelete').mockResolvedValue(deleted);

    const result = await User.deleteUser('user123');

    expect(User.findByIdAndDelete).toHaveBeenCalledWith('user123');
    expect(result).toEqual(deleted);
  });

  test('findUserByLogin trims login and normalizes email', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    await User.findUserByLogin('  Alice@Example.COM  ');

    expect(User.findOne).toHaveBeenCalledWith({
      $or: [{ username: 'Alice@Example.COM' }, { email: 'alice@example.com' }],
    });
  });

  test('findUserByEmail normalizes email', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    await User.findUserByEmail('  Alice@Example.COM  ');

    expect(User.findOne).toHaveBeenCalledWith({
      email: 'alice@example.com',
    });
  });

  test('findUserByUsername trims username', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    await User.findUserByUsername('  alice  ');

    expect(User.findOne).toHaveBeenCalledWith({
      username: 'alice',
    });
  });

  test('searchByUsername performs case-insensitive search', async () => {
    const users = [{ _id: '1', username: 'Alice' }];

    const limit = jest.fn().mockResolvedValue(users);
    const select = jest.fn().mockReturnValue({ limit });

    jest.spyOn(User, 'find').mockReturnValue({ select });

    const result = await User.searchByUsername('ali');

    expect(User.find).toHaveBeenCalledWith({
      username: {
        $regex: 'ali',
        $options: 'i',
      },
    });
    expect(select).toHaveBeenCalledWith('_id username');
    expect(limit).toHaveBeenCalledWith(20);
    expect(result).toEqual(users);
  });

  test('searchByUsername escapes regex characters', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const select = jest.fn().mockReturnValue({ limit });

    jest.spyOn(User, 'find').mockReturnValue({ select });

    await User.searchByUsername('alice.test');

    expect(User.find).toHaveBeenCalledWith({
      username: {
        $regex: 'alice\\.test',
        $options: 'i',
      },
    });
  });

  test('setAdminStatus promotes or demotes a user', async () => {
    const updatedUser = {
      _id: 'user123',
      username: 'alice',
      email: 'alice@example.com',
      isAdmin: true,
      isBanned: false,
    };

    const select = jest.fn().mockResolvedValue(updatedUser);

    jest.spyOn(User, 'findByIdAndUpdate').mockReturnValue({
      select,
    });

    const result = await User.setAdminStatus('user123', true);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user123',
      { isAdmin: true },
      { new: true, runValidators: true }
    );

    expect(select).toHaveBeenCalledWith(
      '_id username email isAdmin isBanned'
    );

    expect(result).toEqual(updatedUser);
  });

  test('setBanStatus bans or unbans a user', async () => {
    const updatedUser = {
      _id: 'user123',
      username: 'alice',
      email: 'alice@example.com',
      isAdmin: false,
      isBanned: true,
    };

    const select = jest.fn().mockResolvedValue(updatedUser);

    jest.spyOn(User, 'findByIdAndUpdate').mockReturnValue({
      select,
    });

    const result = await User.setBanStatus('user123', true);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user123',
      { isBanned: true },
      { new: true, runValidators: true }
    );

    expect(select).toHaveBeenCalledWith(
      '_id username email isAdmin isBanned'
    );

    expect(result).toEqual(updatedUser);
  });

});
