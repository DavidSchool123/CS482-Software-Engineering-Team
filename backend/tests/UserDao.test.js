const User = require('../model/UserDao');

describe('UserDao account and profile operations', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('readAll retrieves user IDs and usernames', async () => {
    const users = [{ _id: '1', username: 'alice' }];

    const select = jest.fn().mockResolvedValue(users);
    jest.spyOn(User, 'find').mockReturnValue({ select });

    const result = await User.readAll();

    expect(User.find).toHaveBeenCalledWith();
    expect(select).toHaveBeenCalledWith('_id username');
    expect(result).toEqual(users);
  });

  test('getProfile returns formatted profile information', async () => {
    const user = {
      _id: 'user123',
      username: 'alice',
      email: 'alice@example.com',
      friends: ['friend1', 'friend2'],
      avatar: 'avatar-data',
    };

    const select = jest.fn().mockResolvedValue(user);
    jest.spyOn(User, 'findById').mockReturnValue({ select });

    const result = await User.getProfile('user123');

    expect(result).toEqual({
      _id: 'user123',
      username: 'alice',
      email: 'alice@example.com',
      friendCount: 2,
      avatar: 'avatar-data',
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

  test('updateUser updates an existing user', async () => {
    const updatedData = { username: 'newname' };
    const user = { _id: 'user123', ...updatedData };

    jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(user);

    const result = await User.updateUser('user123', updatedData);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user123',
      updatedData,
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
      $or: [
        { username: 'Alice@Example.COM' },
        { email: 'alice@example.com' },
      ],
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
});