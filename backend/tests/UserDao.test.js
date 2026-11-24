
const mongoose = require('mongoose');
const User = require('../model/UserDao');
const MessageDao = require('../model/MessageDao');
const MessageEvents = require('../service/MessageEvents');

// --------------------------------------------------
// MOCK DEPENDENCIES
// --------------------------------------------------

jest.mock('../model/MessageDao', () => ({
  deleteConversation: jest.fn()
}));

jest.mock('../service/MessageEvents', () => ({
  publish: jest.fn()
}));

describe('UserDao account and profile operations', () => {
  const userId = new mongoose.Types.ObjectId();
  const friendId = new mongoose.Types.ObjectId();
  const otherId = new mongoose.Types.ObjectId();
  const requestId = new mongoose.Types.ObjectId();

  const emptyStats = {
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    totalChipsWon: 0,
    netWinnings: 0
  };

  // --------------------------------------------------
  // TEST HELPERS AND SETUP
  // --------------------------------------------------

  function mockUser(overrides = {}) {
    return {
      _id: userId,
      username: 'alice',
      email: 'alice@example.com',
      userType: 'registered',
      chipBalance: 1000,
      isAdmin: false,
      isBanned: false,
      avatar: '',
      friends: [],
      friendRequests: [],
      stats: { ...emptyStats },
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides
    };
  }

  function mockFriend(overrides = {}) {
    return mockUser({
      _id: friendId,
      username: 'bob',
      email: 'bob@example.com',
      ...overrides
    });
  }

  function mockSelect(value) {
    return {
      select: jest.fn().mockResolvedValue(value)
    };
  }

  function mockPopulateSelect(value) {
    const select = jest.fn().mockResolvedValue(value);
    const populate = jest.fn().mockReturnValue({ select });

    return { populate, select };
  }

  function mockFriendRequests(request) {
    const requests = request ? [request] : [];

    requests.id = jest.fn().mockReturnValue(request);

    return requests;
  }

  function mockFriends(ids = []) {
    const friends = [...ids];

    friends.pull = jest.fn((id) => {
      const index = friends.findIndex(
        friend => friend.toString() === id.toString()
      );

      if (index !== -1) {
        friends.splice(index, 1);
      }
    });

    return friends;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    MessageDao.deleteConversation.mockResolvedValue(undefined);
    MessageEvents.publish.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --------------------------------------------------
  // USER SCHEMA TESTS
  // --------------------------------------------------

  test('registered users receive 1000 starting chips', () => {
    const user = new User({
      username: 'alice',
      email: 'alice@example.com',
      password: 'hashed-password',
      userType: 'registered'
    });

    expect(user.chipBalance).toBe(1000);
    expect(user.isAdmin).toBe(false);
    expect(user.isBanned).toBe(false);
    expect(user.validateSync()).toBeUndefined();
  });

  test('guest users receive 500 starting chips', () => {
    const user = new User({
      username: 'Guest_123',
      userType: 'guest'
    });

    expect(user.chipBalance).toBe(500);
    expect(user.validateSync()).toBeUndefined();
  });

  test('defaults user type to registered', () => {
    const user = new User({
      username: 'alice',
      email: 'alice@example.com',
      password: 'hashed-password'
    });

    expect(user.userType).toBe('registered');
    expect(user.chipBalance).toBe(1000);
  });

  test('requires email and password for registered users', () => {
    const user = new User({
      username: 'alice',
      userType: 'registered'
    });

    const error = user.validateSync();

    expect(error.errors.email).toBeDefined();
    expect(error.errors.password).toBeDefined();
  });

  test('rejects an invalid user type', () => {
    const user = new User({
      username: 'alice',
      userType: 'invalid'
    });

    expect(user.validateSync().errors.userType).toBeDefined();
  });

  test('rejects negative chip balances', () => {
    const user = new User({
      username: 'Guest_123',
      userType: 'guest',
      chipBalance: -100
    });

    expect(user.validateSync().errors.chipBalance).toBeDefined();
  });

  test('initializes statistics to zero', () => {
    const user = new User({
      username: 'Guest_123',
      userType: 'guest'
    });

    expect(user.stats.toObject()).toEqual(emptyStats);
  });

  test('allows negative net winnings', () => {
    const user = new User({
      username: 'Guest_123',
      userType: 'guest',
      stats: {
        netWinnings: -500
      }
    });

    expect(user.validateSync()).toBeUndefined();
    expect(user.stats.netWinnings).toBe(-500);
  });

  test('rejects negative win statistics', () => {
    const user = new User({
      username: 'Guest_123',
      userType: 'guest',
      stats: {
        wins: -1
      }
    });

    expect(user.validateSync().errors['stats.wins']).toBeDefined();
  });

  // --------------------------------------------------
  // ACCOUNT RETRIEVAL TESTS
  // --------------------------------------------------

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
          netWinnings: 300
        },
        createdAt: new Date('2026-01-01')
      }
    ];

    const query = mockSelect(users);

    jest.spyOn(User, 'find').mockReturnValue(query);

    const result = await User.readAll();

    expect(User.find).toHaveBeenCalledWith();

    expect(query.select).toHaveBeenCalledWith(
      '_id username email userType isAdmin isBanned stats createdAt'
    );

    expect(result).toEqual(users);
  });

  test('readAll returns an empty list when no users exist', async () => {
    jest.spyOn(User, 'find').mockReturnValue(mockSelect([]));

    await expect(User.readAll()).resolves.toEqual([]);
  });

  // --------------------------------------------------
  // PROFILE TESTS
  // --------------------------------------------------

  test('getProfile returns formatted profile information', async () => {
    const user = mockUser({
      friends: [friendId, otherId],
      avatar: 'avatar-data',
      stats: {
        wins: 5,
        losses: 3,
        gamesPlayed: 8,
        totalChipsWon: 2500,
        netWinnings: 1200
      }
    });

    const query = mockSelect(user);

    jest.spyOn(User, 'findById').mockReturnValue(query);

    const result = await User.getProfile(userId);

    expect(User.findById).toHaveBeenCalledWith(userId);

    expect(query.select).toHaveBeenCalledWith(
      '_id username email friends avatar userType chipBalance isAdmin stats'
    );

    expect(result).toEqual({
      _id: userId,
      username: 'alice',
      email: 'alice@example.com',
      friendCount: 2,
      avatar: 'avatar-data',
      userType: 'registered',
      chipBalance: 1000,
      isAdmin: false,
      stats: {
        wins: 5,
        losses: 3,
        gamesPlayed: 8,
        totalChipsWon: 2500,
        netWinnings: 1200
      }
    });
  });

  test('getProfile returns null when user does not exist', async () => {
    jest.spyOn(User, 'findById')
      .mockReturnValue(mockSelect(null));

    const result = await User.getProfile('missing');

    expect(result).toBeNull();
  });

  test('getProfile defaults statistics to zero when missing', async () => {
    const user = mockUser({
      stats: undefined
    });

    jest.spyOn(User, 'findById')
      .mockReturnValue(mockSelect(user));

    const result = await User.getProfile(userId);

    expect(result.stats).toEqual(emptyStats);
  });

  test('getProfile defaults missing avatar to an empty string', async () => {
    const user = mockUser({
      avatar: undefined
    });

    jest.spyOn(User, 'findById')
      .mockReturnValue(mockSelect(user));

    const result = await User.getProfile(userId);

    expect(result.avatar).toBe('');
    expect(result.friendCount).toBe(0);
  });

  test('getProfile returns guest account information', async () => {
    const user = mockUser({
      username: 'Guest_123',
      email: undefined,
      userType: 'guest',
      chipBalance: 500
    });

    jest.spyOn(User, 'findById')
      .mockReturnValue(mockSelect(user));

    const result = await User.getProfile(userId);

    expect(result.userType).toBe('guest');
    expect(result.chipBalance).toBe(500);
    expect(result.friendCount).toBe(0);
  });

  test('getProfile does not expose sensitive account fields', async () => {
    const user = mockUser({
      password: 'hashed-password',
      resetPasswordToken: 'secret-token',
      resetPasswordExpires: new Date()
    });

    jest.spyOn(User, 'findById')
      .mockReturnValue(mockSelect(user));

    const result = await User.getProfile(userId);

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('resetPasswordToken');
    expect(result).not.toHaveProperty('resetPasswordExpires');
  });

  // --------------------------------------------------
  // ACCOUNT CREATION, UPDATE AND DELETION TESTS
  // --------------------------------------------------

  test('createUser creates and saves a new user', async () => {
    const userData = {
      username: 'alice',
      email: 'alice@example.com',
      password: 'hashed-password',
      userType: 'registered'
    };

    const save = jest.spyOn(User.prototype, 'save')
      .mockImplementation(async function () {
        return this;
      });

    const result = await User.createUser(userData);

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.username).toBe('alice');
    expect(result.email).toBe('alice@example.com');
    expect(result.chipBalance).toBe(1000);
  });

  test('createUser propagates database errors', async () => {
    jest.spyOn(User.prototype, 'save')
      .mockRejectedValue(new Error('Database unavailable'));

    await expect(
      User.createUser({
        username: 'Guest_123',
        userType: 'guest'
      })
    ).rejects.toThrow('Database unavailable');
  });

  test('updateAvatar updates and returns the user', async () => {
    const updated = {
      _id: userId,
      avatar: 'image-data'
    };

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(updated);

    const result = await User.updateAvatar(
      userId,
      'image-data'
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      { avatar: 'image-data' },
      {
        returnDocument: 'after',
        runValidators: true,
        select: '_id avatar'
      }
    );

    expect(result).toEqual(updated);
  });

  test('updateAvatar returns null for a missing user', async () => {
    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(null);

    await expect(
      User.updateAvatar(userId, 'image-data')
    ).resolves.toBeNull();
  });

  test('updateUser updates an existing user', async () => {
    const updatedData = {
      username: 'newname'
    };

    const user = {
      _id: userId,
      ...updatedData
    };

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(user);

    const result = await User.updateUser(
      userId,
      updatedData
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      updatedData,
      {
        returnDocument: 'after',
        runValidators: true
      }
    );

    expect(result).toEqual(user);
  });

  test('updateUser returns null for a missing user', async () => {
    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(null);

    await expect(
      User.updateUser(userId, { username: 'newname' })
    ).resolves.toBeNull();
  });

  test('deleteUser removes an existing user', async () => {
    const deleted = { _id: userId };

    jest.spyOn(User, 'findByIdAndDelete')
      .mockResolvedValue(deleted);

    const result = await User.deleteUser(userId);

    expect(User.findByIdAndDelete)
      .toHaveBeenCalledWith(userId);

    expect(result).toEqual(deleted);
  });

  test('deleteUser returns null when user does not exist', async () => {
    jest.spyOn(User, 'findByIdAndDelete')
      .mockResolvedValue(null);

    await expect(
      User.deleteUser(userId)
    ).resolves.toBeNull();
  });

  // --------------------------------------------------
  // LOGIN AND USER SEARCH TESTS
  // --------------------------------------------------

  test('findUserByLogin trims login and normalizes email', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    await User.findUserByLogin('  Alice@Example.COM  ');

    expect(User.findOne).toHaveBeenCalledWith({
      $or: [
        { username: 'Alice@Example.COM' },
        { email: 'alice@example.com' }
      ]
    });
  });

  test('findUserByLogin preserves username capitalization', async () => {
    const user = mockUser({
      username: 'Alice'
    });

    jest.spyOn(User, 'findOne').mockResolvedValue(user);

    const result = await User.findUserByLogin(' Alice ');

    expect(User.findOne).toHaveBeenCalledWith({
      $or: [
        { username: 'Alice' },
        { email: 'alice' }
      ]
    });

    expect(result).toEqual(user);
  });

  test('findUserByEmail normalizes email', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    await User.findUserByEmail('  Alice@Example.COM  ');

    expect(User.findOne).toHaveBeenCalledWith({
      email: 'alice@example.com'
    });
  });

  test('findUserByUsername trims username', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    await User.findUserByUsername('  alice  ');

    expect(User.findOne).toHaveBeenCalledWith({
      username: 'alice'
    });
  });

  test('searchByUsername performs case-insensitive search', async () => {
    const users = [
      { _id: '1', username: 'Alice' }
    ];

    const limit = jest.fn().mockResolvedValue(users);
    const select = jest.fn().mockReturnValue({ limit });

    jest.spyOn(User, 'find').mockReturnValue({ select });

    const result = await User.searchByUsername('ali');

    expect(User.find).toHaveBeenCalledWith({
      username: {
        $regex: 'ali',
        $options: 'i'
      }
    });

    expect(select).toHaveBeenCalledWith('_id username');
    expect(limit).toHaveBeenCalledWith(20);
    expect(result).toEqual(users);
  });

  test.each([
    ['alice.test', 'alice\\.test'],
    ['alice*', 'alice\\*'],
    ['alice+', 'alice\\+'],
    ['alice?', 'alice\\?'],
    ['[alice]', '\\[alice\\]'],
    ['(alice)', '\\(alice\\)'],
    ['alice|bob', 'alice\\|bob'],
    ['^alice$', '\\^alice\\$'],
    ['alice\\bob', 'alice\\\\bob'],
    ['{alice}', '\\{alice\\}']
  ])(
    'searchByUsername escapes regex characters in %s',
    async (input, escaped) => {
      const limit = jest.fn().mockResolvedValue([]);
      const select = jest.fn().mockReturnValue({ limit });

      jest.spyOn(User, 'find').mockReturnValue({ select });

      await User.searchByUsername(input);

      expect(User.find).toHaveBeenCalledWith({
        username: {
          $regex: escaped,
          $options: 'i'
        }
      });
    }
  );

  // --------------------------------------------------
  // PASSWORD RESET TESTS
  // --------------------------------------------------

  test('setPasswordResetToken saves token and expiration', async () => {
    const expires = new Date('2027-01-01');
    const tokenHash = 'hashed-reset-token';

    const updatedUser = {
      _id: userId,
      resetPasswordToken: tokenHash,
      resetPasswordExpires: expires
    };

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(updatedUser);

    const result = await User.setPasswordResetToken(
      userId,
      tokenHash,
      expires
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: expires
      },
      {
        returnDocument: 'after'
      }
    );

    expect(result).toEqual(updatedUser);
  });

  test('findUserByResetToken searches for an unexpired token', async () => {
    const user = mockUser();

    jest.spyOn(User, 'findOne').mockResolvedValue(user);

    const before = Date.now();

    const result = await User.findUserByResetToken(
      'hashed-reset-token'
    );

    const after = Date.now();

    expect(User.findOne).toHaveBeenCalledWith({
      resetPasswordToken: 'hashed-reset-token',
      resetPasswordExpires: {
        $gt: expect.any(Date)
      }
    });

    const query = User.findOne.mock.calls[0][0];
    const cutoff = query.resetPasswordExpires.$gt.getTime();

    expect(cutoff).toBeGreaterThanOrEqual(before);
    expect(cutoff).toBeLessThanOrEqual(after);
    expect(result).toEqual(user);
  });

  test('findUserByResetToken returns null for an invalid or expired token', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    const result = await User.findUserByResetToken(
      'invalid-token'
    );

    expect(result).toBeNull();
  });

  test('updatePasswordAndClearResetToken updates password and removes token', async () => {
    const updatedUser = {
      _id: userId,
      password: 'new-hashed-password'
    };

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(updatedUser);

    const result = await User.updatePasswordAndClearResetToken(
      userId,
      'new-hashed-password'
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      {
        $set: {
          password: 'new-hashed-password'
        },
        $unset: {
          resetPasswordToken: 1,
          resetPasswordExpires: 1
        }
      },
      {
        returnDocument: 'after',
        runValidators: true
      }
    );

    expect(result).toEqual(updatedUser);
  });

  // --------------------------------------------------
  // ADMIN STATUS TESTS
  // --------------------------------------------------

  test.each([true, false])(
    'setAdminStatus updates administrator status to %p',
    async (isAdmin) => {
      const updatedUser = {
        _id: userId,
        username: 'alice',
        email: 'alice@example.com',
        isAdmin,
        isBanned: false
      };

      const query = mockSelect(updatedUser);

      jest.spyOn(User, 'findByIdAndUpdate')
        .mockReturnValue(query);

      const result = await User.setAdminStatus(
        userId,
        isAdmin
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { isAdmin },
        { new: true, runValidators: true }
      );

      expect(query.select).toHaveBeenCalledWith(
        '_id username email isAdmin isBanned'
      );

      expect(result).toEqual(updatedUser);
    }
  );

  test.each([true, false])(
    'setBanStatus updates banned status to %p',
    async (isBanned) => {
      const updatedUser = {
        _id: userId,
        username: 'alice',
        email: 'alice@example.com',
        isAdmin: false,
        isBanned
      };

      const query = mockSelect(updatedUser);

      jest.spyOn(User, 'findByIdAndUpdate')
        .mockReturnValue(query);

      const result = await User.setBanStatus(
        userId,
        isBanned
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { isBanned },
        { new: true, runValidators: true }
      );

      expect(query.select).toHaveBeenCalledWith(
        '_id username email isAdmin isBanned'
      );

      expect(result).toEqual(updatedUser);
    }
  );

  // --------------------------------------------------
  // SEND FRIEND REQUEST TESTS
  // --------------------------------------------------

  test('rejects sending a friend request to oneself', async () => {
    const findById = jest.spyOn(User, 'findById');

    await expect(
      User.sendFriendRequest(userId, userId)
    ).rejects.toThrow(
      'You cannot send a friend request to yourself'
    );

    expect(findById).not.toHaveBeenCalled();
  });

  test('rejects a friend request when sender does not exist', async () => {
    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockFriend());

    await expect(
      User.sendFriendRequest(userId, friendId)
    ).rejects.toThrow('User not found');
  });

  test('rejects a friend request when receiver does not exist', async () => {
    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(mockUser())
      .mockResolvedValueOnce(null);

    await expect(
      User.sendFriendRequest(userId, friendId)
    ).rejects.toThrow('User not found');
  });

  test('rejects friend requests between existing friends', async () => {
    const sender = mockUser({
      friends: [friendId]
    });

    const receiver = mockFriend();

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(sender)
      .mockResolvedValueOnce(receiver);

    await expect(
      User.sendFriendRequest(userId, friendId)
    ).rejects.toThrow('You are already friends');

    expect(receiver.save).not.toHaveBeenCalled();
  });

  test('rejects duplicate pending friend requests', async () => {
    const sender = mockUser();

    const receiver = mockFriend({
      friendRequests: [
        {
          from: userId,
          status: 'pending'
        }
      ]
    });

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(sender)
      .mockResolvedValueOnce(receiver);

    await expect(
      User.sendFriendRequest(userId, friendId)
    ).rejects.toThrow('Friend request already sent');

    expect(receiver.save).not.toHaveBeenCalled();
  });

  test('rejects requests when receiver already sent a pending request', async () => {
    const sender = mockUser({
      friendRequests: [
        {
          from: friendId,
          status: 'pending'
        }
      ]
    });

    const receiver = mockFriend();

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(sender)
      .mockResolvedValueOnce(receiver);

    await expect(
      User.sendFriendRequest(userId, friendId)
    ).rejects.toThrow(
      'This player has already sent you a friend request'
    );

    expect(receiver.save).not.toHaveBeenCalled();
  });

  test('successfully sends a friend request', async () => {
    const sender = mockUser();
    const receiver = mockFriend();

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(sender)
      .mockResolvedValueOnce(receiver);

    const result = await User.sendFriendRequest(
      userId,
      friendId
    );

    expect(receiver.friendRequests).toContainEqual({
      from: userId,
      status: 'pending'
    });

    expect(receiver.save).toHaveBeenCalledTimes(1);
    expect(sender.save).not.toHaveBeenCalled();

    expect(result).toEqual({
      message: 'Friend request sent successfully'
    });
  });

  test('allows a new request after a previous request was declined', async () => {
    const sender = mockUser({
      friendRequests: [
        {
          from: friendId,
          status: 'declined'
        }
      ]
    });

    const receiver = mockFriend({
      friendRequests: [
        {
          from: userId,
          status: 'declined'
        }
      ]
    });

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(sender)
      .mockResolvedValueOnce(receiver);

    const result = await User.sendFriendRequest(
      userId,
      friendId
    );

    expect(receiver.friendRequests).toHaveLength(2);

    expect(receiver.friendRequests[1]).toEqual({
      from: userId,
      status: 'pending'
    });

    expect(result).toEqual({
      message: 'Friend request sent successfully'
    });
  });

  test('ignores pending requests belonging to unrelated users', async () => {
    const sender = mockUser({
      friends: [otherId],
      friendRequests: [
        {
          from: otherId,
          status: 'pending'
        }
      ]
    });

    const receiver = mockFriend({
      friendRequests: [
        {
          from: otherId,
          status: 'pending'
        }
      ]
    });

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(sender)
      .mockResolvedValueOnce(receiver);

    const result = await User.sendFriendRequest(
      userId,
      friendId
    );

    expect(receiver.friendRequests).toHaveLength(2);
    expect(receiver.save).toHaveBeenCalled();

    expect(result).toEqual({
      message: 'Friend request sent successfully'
    });
  });

  // --------------------------------------------------
  // INCOMING FRIEND REQUEST TESTS
  // --------------------------------------------------

  test('getFriendRequests returns only pending requests', async () => {
    const user = mockUser({
      friendRequests: [
        {
          _id: requestId,
          from: {
            _id: friendId,
            username: 'bob'
          },
          status: 'pending'
        },
        {
          _id: new mongoose.Types.ObjectId(),
          from: {
            _id: otherId,
            username: 'charlie'
          },
          status: 'accepted'
        },
        {
          _id: new mongoose.Types.ObjectId(),
          from: {
            _id: otherId,
            username: 'charlie'
          },
          status: 'declined'
        }
      ]
    });

    const query = mockPopulateSelect(user);

    jest.spyOn(User, 'findById').mockReturnValue(query);

    const result = await User.getFriendRequests(userId);

    expect(User.findById).toHaveBeenCalledWith(userId);

    expect(query.populate).toHaveBeenCalledWith(
      'friendRequests.from',
      'username'
    );

    expect(query.select).toHaveBeenCalledWith(
      'friendRequests'
    );

    expect(result).toEqual([
      {
        requestId,
        senderId: friendId,
        username: 'bob',
        status: 'pending'
      }
    ]);
  });

  test('getFriendRequests handles a missing populated sender', async () => {
    const user = mockUser({
      friendRequests: [
        {
          _id: requestId,
          from: null,
          status: 'pending'
        }
      ]
    });

    jest.spyOn(User, 'findById')
      .mockReturnValue(mockPopulateSelect(user));

    const result = await User.getFriendRequests(userId);

    expect(result).toEqual([
      {
        requestId,
        senderId: undefined,
        username: undefined,
        status: 'pending'
      }
    ]);
  });

  test('getFriendRequests returns an empty list when none exist', async () => {
    jest.spyOn(User, 'findById')
      .mockReturnValue(mockPopulateSelect(mockUser()));

    const result = await User.getFriendRequests(userId);

    expect(result).toEqual([]);
  });

  test('getFriendRequests rejects a missing user', async () => {
    jest.spyOn(User, 'findById')
      .mockReturnValue(mockPopulateSelect(null));

    await expect(
      User.getFriendRequests(userId)
    ).rejects.toThrow('User not found');
  });

  // --------------------------------------------------
  // RESPOND TO FRIEND REQUEST TESTS
  // --------------------------------------------------

  test('rejects an invalid friend request action', async () => {
    const findById = jest.spyOn(User, 'findById');

    await expect(
      User.respondToFriendRequest(
        userId,
        requestId,
        'invalid'
      )
    ).rejects.toThrow('Invalid action');

    expect(findById).not.toHaveBeenCalled();
  });

  test('rejects a response when user does not exist', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(null);

    await expect(
      User.respondToFriendRequest(
        userId,
        requestId,
        'accept'
      )
    ).rejects.toThrow('User not found');
  });

  test('rejects a response when request does not exist', async () => {
    const user = mockUser({
      friendRequests: mockFriendRequests(null)
    });

    jest.spyOn(User, 'findById').mockResolvedValue(user);

    await expect(
      User.respondToFriendRequest(
        userId,
        requestId,
        'accept'
      )
    ).rejects.toThrow(
      'Pending friend request not found'
    );
  });

  test.each(['accepted', 'declined'])(
    'rejects a response to an already %s request',
    async (status) => {
      const request = {
        _id: requestId,
        from: friendId,
        status
      };

      const user = mockUser({
        friendRequests: mockFriendRequests(request)
      });

      jest.spyOn(User, 'findById')
        .mockResolvedValue(user);

      await expect(
        User.respondToFriendRequest(
          userId,
          requestId,
          'accept'
        )
      ).rejects.toThrow(
        'Pending friend request not found'
      );

      expect(user.save).not.toHaveBeenCalled();
    }
  );

  test('rejects a response when sender no longer exists', async () => {
    const request = {
      _id: requestId,
      from: friendId,
      status: 'pending'
    };

    const user = mockUser({
      friendRequests: mockFriendRequests(request)
    });

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);

    await expect(
      User.respondToFriendRequest(
        userId,
        requestId,
        'accept'
      )
    ).rejects.toThrow('Sender not found');

    expect(user.save).not.toHaveBeenCalled();
  });

  test('accepts a friend request and updates both friends lists', async () => {
    const request = {
      _id: requestId,
      from: friendId,
      status: 'pending'
    };

    const user = mockUser({
      friendRequests: mockFriendRequests(request)
    });

    const sender = mockFriend();

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(sender);

    const result = await User.respondToFriendRequest(
      userId,
      requestId,
      'accept'
    );

    expect(user.friendRequests.id)
      .toHaveBeenCalledWith(requestId);

    expect(user.friends).toContainEqual(friendId);
    expect(sender.friends).toContainEqual(userId);
    expect(request.status).toBe('accepted');

    expect(user.save).toHaveBeenCalledTimes(1);
    expect(sender.save).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      message: 'Friend request accepted'
    });
  });

  test('does not duplicate existing friends when accepting a request', async () => {
    const request = {
      _id: requestId,
      from: friendId,
      status: 'pending'
    };

    const user = mockUser({
      friends: [friendId],
      friendRequests: mockFriendRequests(request)
    });

    const sender = mockFriend({
      friends: [userId]
    });

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(sender);

    await User.respondToFriendRequest(
      userId,
      requestId,
      'accept'
    );

    expect(user.friends).toHaveLength(1);
    expect(sender.friends).toHaveLength(1);
    expect(request.status).toBe('accepted');
  });

  test('preserves unrelated friends when accepting a request', async () => {
    const request = {
      _id: requestId,
      from: friendId,
      status: 'pending'
    };

    const user = mockUser({
      friends: [otherId],
      friendRequests: mockFriendRequests(request)
    });

    const sender = mockFriend({
      friends: [otherId]
    });

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(sender);

    await User.respondToFriendRequest(
      userId,
      requestId,
      'accept'
    );

    expect(user.friends).toEqual([
      otherId,
      friendId
    ]);

    expect(sender.friends).toEqual([
      otherId,
      userId
    ]);
  });

  test('declines a friend request without modifying friends lists', async () => {
    const request = {
      _id: requestId,
      from: friendId,
      status: 'pending'
    };

    const user = mockUser({
      friendRequests: mockFriendRequests(request)
    });

    const sender = mockFriend();

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(sender);

    const result = await User.respondToFriendRequest(
      userId,
      requestId,
      'decline'
    );

    expect(request.status).toBe('declined');
    expect(user.friends).toEqual([]);
    expect(sender.friends).toEqual([]);

    expect(user.save).toHaveBeenCalledTimes(1);
    expect(sender.save).not.toHaveBeenCalled();

    expect(result).toEqual({
      message: 'Friend request declined'
    });
  });

  // --------------------------------------------------
  // FRIEND LIST TESTS
  // --------------------------------------------------

  test('getFriends returns populated friend information', async () => {
    const friends = [
      {
        _id: friendId,
        username: 'bob',
        avatar: 'avatar-data'
      }
    ];

    const query = mockPopulateSelect(
      mockUser({ friends })
    );

    jest.spyOn(User, 'findById').mockReturnValue(query);

    const result = await User.getFriends(userId);

    expect(User.findById).toHaveBeenCalledWith(userId);

    expect(query.populate).toHaveBeenCalledWith(
      'friends',
      '_id username avatar'
    );

    expect(query.select).toHaveBeenCalledWith('friends');
    expect(result).toEqual(friends);
  });

  test('getFriends returns an empty list when user has no friends', async () => {
    jest.spyOn(User, 'findById')
      .mockReturnValue(mockPopulateSelect(mockUser()));

    await expect(
      User.getFriends(userId)
    ).resolves.toEqual([]);
  });

  test('getFriends rejects a missing user', async () => {
    jest.spyOn(User, 'findById')
      .mockReturnValue(mockPopulateSelect(null));

    await expect(
      User.getFriends(userId)
    ).rejects.toThrow('User not found');
  });

  // --------------------------------------------------
  // REMOVE FRIEND TESTS
  // --------------------------------------------------

  test('removeFriend rejects a missing current user', async () => {
    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockFriend());

    await expect(
      User.removeFriend(userId, friendId)
    ).rejects.toThrow('User not found');

    expect(MessageDao.deleteConversation)
      .not.toHaveBeenCalled();
  });

  test('removeFriend rejects a missing friend', async () => {
    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(mockUser())
      .mockResolvedValueOnce(null);

    await expect(
      User.removeFriend(userId, friendId)
    ).rejects.toThrow('User not found');

    expect(MessageDao.deleteConversation)
      .not.toHaveBeenCalled();
  });

  test('removeFriend rejects a user who is not a friend', async () => {
    const user = mockUser({
      friends: [otherId]
    });

    const friend = mockFriend();

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(friend);

    await expect(
      User.removeFriend(userId, friendId)
    ).rejects.toThrow(
      'This player is not on your friends list'
    );

    expect(user.save).not.toHaveBeenCalled();
    expect(friend.save).not.toHaveBeenCalled();

    expect(MessageDao.deleteConversation)
      .not.toHaveBeenCalled();

    expect(MessageEvents.publish)
      .not.toHaveBeenCalled();
  });

  test('removeFriend removes both friendship entries and deletes conversation', async () => {
    const user = mockUser({
      friends: mockFriends([friendId, otherId])
    });

    const friend = mockFriend({
      friends: mockFriends([userId])
    });

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(friend);

    const result = await User.removeFriend(
      userId,
      friendId
    );

    expect(user.friends.pull)
      .toHaveBeenCalledWith(friendId);

    expect(friend.friends.pull)
      .toHaveBeenCalledWith(userId);

    expect(user.friends).toHaveLength(1);
    expect(user.friends[0]).toEqual(otherId);
    expect(friend.friends).toHaveLength(0);

    expect(user.save).toHaveBeenCalledTimes(1);
    expect(friend.save).toHaveBeenCalledTimes(1);

    expect(MessageDao.deleteConversation)
      .toHaveBeenCalledWith(userId, friendId);

    expect(MessageEvents.publish).toHaveBeenCalledWith({
      type: 'conversation-deleted',
      userA: userId,
      userB: friendId
    });

    expect(result).toEqual({
      message: 'Friend removed successfully'
    });
  });

  test('removeFriend does not publish deletion if conversation deletion fails', async () => {
    const user = mockUser({
      friends: mockFriends([friendId])
    });

    const friend = mockFriend({
      friends: mockFriends([userId])
    });

    jest.spyOn(User, 'findById')
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(friend);

    MessageDao.deleteConversation.mockRejectedValueOnce(
      new Error('Unable to delete conversation')
    );

    await expect(
      User.removeFriend(userId, friendId)
    ).rejects.toThrow('Unable to delete conversation');

    expect(MessageEvents.publish)
      .not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // SENT FRIEND REQUEST TESTS
  // --------------------------------------------------

  test('getSentFriendRequests retrieves pending outgoing requests', async () => {
    const user = mockUser();

    const receivers = [
      {
        _id: friendId,
        username: 'bob'
      }
    ];

    const query = mockSelect(receivers);

    jest.spyOn(User, 'findById').mockResolvedValue(user);
    jest.spyOn(User, 'find').mockReturnValue(query);

    const result = await User.getSentFriendRequests(userId);

    expect(User.find).toHaveBeenCalledWith({
      friendRequests: {
        $elemMatch: {
          from: userId,
          status: 'pending'
        }
      }
    });

    expect(query.select).toHaveBeenCalledWith(
      '_id username'
    );

    expect(result).toEqual(receivers);
  });

  test('getSentFriendRequests returns an empty list', async () => {
    jest.spyOn(User, 'findById')
      .mockResolvedValue(mockUser());

    jest.spyOn(User, 'find')
      .mockReturnValue(mockSelect([]));

    await expect(
      User.getSentFriendRequests(userId)
    ).resolves.toEqual([]);
  });

  test('getSentFriendRequests rejects a missing user', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(null);

    const find = jest.spyOn(User, 'find');

    await expect(
      User.getSentFriendRequests(userId)
    ).rejects.toThrow('User not found');

    expect(find).not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // CHIP DEDUCTION TESTS
  // --------------------------------------------------

  test('deductChips deducts a valid table buy-in', async () => {
    const updatedUser = {
      _id: userId,
      chipBalance: 500
    };

    const session = {};

    jest.spyOn(User, 'findOneAndUpdate')
      .mockResolvedValue(updatedUser);

    const result = await User.deductChips(
      userId,
      500,
      session
    );

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: userId,
        chipBalance: { $gte: 500 }
      },
      {
        $inc: { chipBalance: -500 }
      },
      {
        new: true,
        session,
        runValidators: true
      }
    );

    expect(result).toEqual(updatedUser);
  });

  test('deductChips returns null when balance is insufficient', async () => {
    jest.spyOn(User, 'findOneAndUpdate')
      .mockResolvedValue(null);

    const result = await User.deductChips(
      userId,
      1000,
      {}
    );

    expect(result).toBeNull();
  });

  test.each([-1, 1.5, '100', NaN, Infinity, undefined])(
    'deductChips rejects invalid amount: %p',
    async (amount) => {
      const update = jest.spyOn(User, 'findOneAndUpdate');

      await expect(
        User.deductChips(userId, amount, {})
      ).rejects.toThrow('Invalid chip amount');

      expect(update).not.toHaveBeenCalled();
    }
  );

  test('deductChips accepts a zero amount', async () => {
    const updatedUser = {
      _id: userId,
      chipBalance: 1000
    };

    jest.spyOn(User, 'findOneAndUpdate')
      .mockResolvedValue(updatedUser);

    const result = await User.deductChips(userId, 0, {});

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: userId,
        chipBalance: { $gte: 0 }
      },
      {
        $inc: { chipBalance: -0 }
      },
      {
        new: true,
        session: {},
        runValidators: true
      }
    );

    expect(result).toEqual(updatedUser);
  });

  // --------------------------------------------------
  // CHIP CREDIT TESTS
  // --------------------------------------------------

  test('creditChips returns settled chips to the account', async () => {
    const updatedUser = {
      _id: userId,
      chipBalance: 1100
    };

    const session = {};

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(updatedUser);

    const result = await User.creditChips(
      userId,
      100,
      session
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      {
        $inc: { chipBalance: 100 }
      },
      {
        new: true,
        session,
        runValidators: true
      }
    );

    expect(result).toEqual(updatedUser);
  });

  test.each([-1, 1.5, '100', NaN, Infinity, undefined])(
    'creditChips rejects invalid amount: %p',
    async (amount) => {
      const update = jest.spyOn(User, 'findByIdAndUpdate');

      await expect(
        User.creditChips(userId, amount, {})
      ).rejects.toThrow('Invalid chip amount');

      expect(update).not.toHaveBeenCalled();
    }
  );

  test('creditChips accepts a zero amount', async () => {
    const updatedUser = {
      _id: userId,
      chipBalance: 1000
    };

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(updatedUser);

    const result = await User.creditChips(userId, 0, {});

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      {
        $inc: { chipBalance: 0 }
      },
      {
        new: true,
        session: {},
        runValidators: true
      }
    );

    expect(result).toEqual(updatedUser);
  });

  test('creditChips returns null for a missing user', async () => {
    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(null);

    await expect(
      User.creditChips(userId, 100, {})
    ).resolves.toBeNull();
  });

  // --------------------------------------------------
  // GAME STATISTICS TESTS
  // --------------------------------------------------

  test('updateGameStats records a completed winning game', async () => {
    const stats = {
      wins: 1,
      losses: 0,
      totalChipsWon: 500,
      netWinnings: 300
    };

    const session = {};

    const updatedUser = {
      _id: userId,
      stats: {
        ...stats,
        gamesPlayed: 1
      }
    };

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue(updatedUser);

    const result = await User.updateGameStats(
      userId,
      stats,
      session
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      {
        $inc: {
          'stats.wins': 1,
          'stats.losses': 0,
          'stats.gamesPlayed': 1,
          'stats.totalChipsWon': 500,
          'stats.netWinnings': 300
        }
      },
      {
        new: true,
        session,
        runValidators: true
      }
    );

    expect(result).toEqual(updatedUser);
  });

  test('updateGameStats records a losing game and negative net winnings', async () => {
    const stats = {
      wins: 0,
      losses: 1,
      totalChipsWon: 0,
      netWinnings: -200
    };

    const session = {};

    jest.spyOn(User, 'findByIdAndUpdate')
      .mockResolvedValue({
        _id: userId
      });

    await User.updateGameStats(
      userId,
      stats,
      session
    );

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      {
        $inc: {
          'stats.wins': 0,
          'stats.losses': 1,
          'stats.gamesPlayed': 1,
          'stats.totalChipsWon': 0,
          'stats.netWinnings': -200
        }
      },
      {
        new: true,
        session,
        runValidators: true
      }
    );
  });

  // --------------------------------------------------
  // LEADERBOARD TEST HELPERS
  // --------------------------------------------------

  function leaderboardPlayer(id, username, stats) {
    return {
      _id: id,
      username,
      avatar: '',
      stats
    };
  }

  function setupLeaderboard(players, friends = []) {
    const userQuery = mockSelect({
      _id: userId,
      friends
    });

    const playersQuery = mockSelect([...players]);

    jest.spyOn(User, 'findById')
      .mockReturnValue(userQuery);

    jest.spyOn(User, 'find')
      .mockReturnValue(playersQuery);

    return {
      userQuery,
      playersQuery
    };
  }

  // --------------------------------------------------
  // LEADERBOARD TESTS
  // --------------------------------------------------

  test('getLeaderboard rejects a missing current user', async () => {
    jest.spyOn(User, 'findById')
      .mockReturnValue(mockSelect(null));

    const find = jest.spyOn(User, 'find');

    await expect(
      User.getLeaderboard(userId)
    ).rejects.toThrow('User not found');

    expect(find).not.toHaveBeenCalled();
  });

  test('getLeaderboard returns an empty leaderboard', async () => {
    setupLeaderboard([]);

    const result = await User.getLeaderboard(userId);

    expect(result).toEqual({
      leaderboard: [],
      totalPlayers: 0,
      myRank: null,
      friends: []
    });
  });

  test('getLeaderboard retrieves only players with completed games', async () => {
    const { userQuery, playersQuery } = setupLeaderboard([]);

    await User.getLeaderboard(userId);

    expect(User.findById).toHaveBeenCalledWith(userId);

    expect(userQuery.select).toHaveBeenCalledWith(
      '_id friends'
    );

    expect(User.find).toHaveBeenCalledWith({
      'stats.gamesPlayed': { $gt: 0 }
    });

    expect(playersQuery.select).toHaveBeenCalledWith(
      '_id username avatar stats'
    );
  });

  test('getLeaderboard sorts players by win rate by default', async () => {
    const players = [
      leaderboardPlayer(userId, 'alice', {
        wins: 5,
        losses: 5,
        gamesPlayed: 10,
        netWinnings: 100
      }),
      leaderboardPlayer(friendId, 'bob', {
        wins: 8,
        losses: 2,
        gamesPlayed: 10,
        netWinnings: 300
      }),
      leaderboardPlayer(otherId, 'charlie', {
        wins: 2,
        losses: 8,
        gamesPlayed: 10,
        netWinnings: -100
      })
    ];

    setupLeaderboard(players, [friendId]);

    const result = await User.getLeaderboard(userId);

    expect(
      result.leaderboard.map(player => player.username)
    ).toEqual([
      'bob',
      'alice',
      'charlie'
    ]);

    expect(
      result.leaderboard.map(player => player.rank)
    ).toEqual([1, 2, 3]);

    expect(result.leaderboard[0].winRate).toBe(0.8);
    expect(result.totalPlayers).toBe(3);

    expect(result.myRank).toEqual(
      expect.objectContaining({
        _id: userId,
        username: 'alice',
        rank: 2,
        winRate: 0.5
      })
    );

    expect(result.friends).toHaveLength(1);
    expect(result.friends[0].username).toBe('bob');
  });

  test('getLeaderboard sorts by net winnings when requested', async () => {
    const players = [
      leaderboardPlayer(userId, 'alice', {
        wins: 8,
        gamesPlayed: 10,
        netWinnings: 100
      }),
      leaderboardPlayer(friendId, 'bob', {
        wins: 5,
        gamesPlayed: 10,
        netWinnings: 500
      }),
      leaderboardPlayer(otherId, 'charlie', {
        wins: 9,
        gamesPlayed: 10,
        netWinnings: -100
      })
    ];

    setupLeaderboard(players);

    const result = await User.getLeaderboard(
      userId,
      'netWinnings'
    );

    expect(
      result.leaderboard.map(player => player.username)
    ).toEqual([
      'bob',
      'alice',
      'charlie'
    ]);

    expect(result.leaderboard[0].netWinnings).toBe(500);
  });

  test('getLeaderboard breaks equal win rates using total wins', async () => {
    const players = [
      leaderboardPlayer(userId, 'alice', {
        wins: 5,
        gamesPlayed: 10,
        netWinnings: 500
      }),
      leaderboardPlayer(friendId, 'bob', {
        wins: 10,
        gamesPlayed: 20,
        netWinnings: 100
      })
    ];

    setupLeaderboard(players);

    const result = await User.getLeaderboard(userId);

    expect(result.leaderboard[0].username).toBe('bob');
    expect(result.leaderboard[1].username).toBe('alice');
  });

  test('getLeaderboard breaks equal win rates and wins using net winnings', async () => {
    const players = [
      leaderboardPlayer(userId, 'alice', {
        wins: 5,
        gamesPlayed: 10,
        netWinnings: 100
      }),
      leaderboardPlayer(friendId, 'bob', {
        wins: 5,
        gamesPlayed: 10,
        netWinnings: 300
      })
    ];

    setupLeaderboard(players);

    const result = await User.getLeaderboard(userId);

    expect(result.leaderboard[0].username).toBe('bob');
    expect(result.leaderboard[1].username).toBe('alice');
  });

  test('getLeaderboard breaks equal net winnings using total wins', async () => {
    const players = [
      leaderboardPlayer(userId, 'alice', {
        wins: 3,
        gamesPlayed: 5,
        netWinnings: 200
      }),
      leaderboardPlayer(friendId, 'bob', {
        wins: 7,
        gamesPlayed: 20,
        netWinnings: 200
      })
    ];

    setupLeaderboard(players);

    const result = await User.getLeaderboard(
      userId,
      'netWinnings'
    );

    expect(result.leaderboard[0].username).toBe('bob');
    expect(result.leaderboard[1].username).toBe('alice');
  });

  test('getLeaderboard handles completely tied players', async () => {
    const stats = {
      wins: 5,
      losses: 5,
      gamesPlayed: 10,
      netWinnings: 100
    };

    setupLeaderboard([
      leaderboardPlayer(userId, 'alice', { ...stats }),
      leaderboardPlayer(friendId, 'bob', { ...stats })
    ]);

    const result = await User.getLeaderboard(
      userId,
      'netWinnings'
    );

    expect(
      result.leaderboard.map(player => player.username)
    ).toEqual(['alice', 'bob']);

    expect(result.totalPlayers).toBe(2);
  });

  test('getLeaderboard handles missing statistics', async () => {
    const players = [
      leaderboardPlayer(userId, 'alice', undefined),
      leaderboardPlayer(friendId, 'bob', {
        wins: 2,
        gamesPlayed: 5,
        netWinnings: 100
      })
    ];

    setupLeaderboard(players);

    const result = await User.getLeaderboard(userId);

    expect(result.myRank).toEqual(
      expect.objectContaining({
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        winRate: 0,
        netWinnings: 0
      })
    );

    expect(result.leaderboard[0].username).toBe('bob');
  });

  test('getLeaderboard handles partially missing statistics', async () => {
    const players = [
      leaderboardPlayer(userId, 'alice', {
        gamesPlayed: 5
      }),
      leaderboardPlayer(friendId, 'bob', {
        gamesPlayed: 3
      })
    ];

    setupLeaderboard(players);

    const result = await User.getLeaderboard(userId);

    expect(result.myRank).toEqual(
      expect.objectContaining({
        wins: 0,
        losses: 0,
        gamesPlayed: 5,
        winRate: 0,
        netWinnings: 0
      })
    );
  });

  test('getLeaderboard handles zero completed games without division by zero', async () => {
    setupLeaderboard([
      leaderboardPlayer(userId, 'alice', {
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        netWinnings: 0
      })
    ]);

    const result = await User.getLeaderboard(userId);

    expect(result.myRank.winRate).toBe(0);
    expect(Number.isFinite(result.myRank.winRate)).toBe(true);
  });

  test('getLeaderboard defaults missing net winnings during sorting', async () => {
    setupLeaderboard([
      leaderboardPlayer(userId, 'alice', {
        wins: 1,
        gamesPlayed: 5
      }),
      leaderboardPlayer(friendId, 'bob', {
        wins: 2,
        gamesPlayed: 5,
        netWinnings: 100
      })
    ]);

    const result = await User.getLeaderboard(
      userId,
      'netWinnings'
    );

    expect(result.leaderboard[0].username).toBe('bob');
    expect(result.myRank.netWinnings).toBe(0);
  });

  test('getLeaderboard handles missing net winnings for both players', async () => {
    setupLeaderboard([
      leaderboardPlayer(userId, 'alice', undefined),
      leaderboardPlayer(friendId, 'bob', undefined)
    ]);

    const result = await User.getLeaderboard(
      userId,
      'netWinnings'
    );

    expect(result.leaderboard).toHaveLength(2);

    expect(
      result.leaderboard.every(
        player => player.netWinnings === 0
      )
    ).toBe(true);
  });

  test('getLeaderboard applies pagination while preserving global ranks', async () => {
    const players = [
      leaderboardPlayer(userId, 'alice', {
        wins: 9,
        gamesPlayed: 10
      }),
      leaderboardPlayer(friendId, 'bob', {
        wins: 7,
        gamesPlayed: 10
      }),
      leaderboardPlayer(otherId, 'charlie', {
        wins: 3,
        gamesPlayed: 10
      })
    ];

    setupLeaderboard(players, [otherId]);

    const result = await User.getLeaderboard(
      userId,
      'winRate',
      1,
      1
    );

    expect(result.leaderboard).toHaveLength(1);

    expect(result.leaderboard[0]).toEqual(
      expect.objectContaining({
        username: 'bob',
        rank: 2
      })
    );

    expect(result.totalPlayers).toBe(3);
    expect(result.myRank.rank).toBe(1);

    expect(result.friends).toEqual([
      expect.objectContaining({
        username: 'charlie',
        rank: 3
      })
    ]);
  });

  test('getLeaderboard returns an empty page when offset exceeds total players', async () => {
    setupLeaderboard([
      leaderboardPlayer(userId, 'alice', {
        wins: 5,
        gamesPlayed: 10
      })
    ]);

    const result = await User.getLeaderboard(
      userId,
      'winRate',
      100,
      10
    );

    expect(result.leaderboard).toEqual([]);
    expect(result.totalPlayers).toBe(1);
    expect(result.myRank.rank).toBe(1);
  });

  test('getLeaderboard defaults to a maximum of 50 players per page', async () => {
    const players = Array.from(
      { length: 55 },
      (_, index) => leaderboardPlayer(
        new mongoose.Types.ObjectId(),
        `player${index}`,
        {
          wins: 1,
          gamesPlayed: 2,
          netWinnings: index
        }
      )
    );

    setupLeaderboard(players);

    const result = await User.getLeaderboard(userId);

    expect(result.leaderboard).toHaveLength(50);
    expect(result.totalPlayers).toBe(55);
  });

  test('getLeaderboard returns null rank when current user is not ranked', async () => {
    setupLeaderboard([
      leaderboardPlayer(friendId, 'bob', {
        wins: 5,
        gamesPlayed: 10
      })
    ]);

    const result = await User.getLeaderboard(userId);

    expect(result.myRank).toBeNull();
    expect(result.totalPlayers).toBe(1);
  });

  test('getLeaderboard identifies current user using string IDs', async () => {
    setupLeaderboard([
      leaderboardPlayer(userId, 'alice', {
        wins: 5,
        gamesPlayed: 10
      })
    ]);

    const result = await User.getLeaderboard(
      userId.toString()
    );

    expect(result.myRank.username).toBe('alice');
    expect(result.myRank.rank).toBe(1);
  });

  test('getLeaderboard excludes friends who are not ranked', async () => {
    setupLeaderboard([
      leaderboardPlayer(userId, 'alice', {
        wins: 5,
        gamesPlayed: 10
      }),
      leaderboardPlayer(friendId, 'bob', {
        wins: 8,
        gamesPlayed: 10
      })
    ], [friendId, otherId]);

    const result = await User.getLeaderboard(userId);

    expect(result.friends).toHaveLength(1);
    expect(result.friends[0].username).toBe('bob');
  });
});
