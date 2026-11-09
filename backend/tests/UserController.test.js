
jest.mock('../service/EmailService', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../model/UserDao');
jest.mock('../util/PasswordUtil');
jest.mock('../model/MessageDao', () => ({
  deleteMany: jest.fn(),
}));
jest.mock('../service/MessageEvents', () => ({
  publish: jest.fn(),
}));

const controller = require('../controller/UserController');
const userDao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil');
const MessageDao = require('../model/MessageDao');
const MessageEvents = require('../service/MessageEvents');
const { sendEmail } = require('../service/EmailService');

beforeEach(() => {
  jest.clearAllMocks();
  MessageDao.deleteMany.mockResolvedValue({ deletedCount: 0 });
});

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn(),
    clearCookie: jest.fn(),
  };
}

test('Controller New User', async () => {
  userDao.findUserByEmail.mockResolvedValue(null);
  userDao.findUserByUsername.mockResolvedValue(null);
  passUtil.hashPassword.mockReturnValue('hashedPassword');

  userDao.createUser.mockResolvedValue({
    _id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
  });

  const req = {
    body: {
      username: 'testuser',
      email: 'test@example.com',
      password: '123456',
      confirmPassword: '123456',
    },
    session: {},
  };

  const res = mockResponse();

  await controller.userCreateUpdate(req, res);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(userDao.createUser).toHaveBeenCalled();
  expect(userDao.updateUser).not.toHaveBeenCalled();
  expect(req.session.userId).toBe('user123');
});

test('Delete User Account', async () => {
  const req = {
    session: {
      userId: 'user123',
      destroy: jest.fn((callback) => callback(null)),
    },
  };

  const res = mockResponse();

  userDao.deleteUser.mockResolvedValue({
    _id: 'user123',
    username: 'testuser',
  });

  await controller.userDelete(req, res);

  expect(MessageDao.deleteMany).toHaveBeenCalledWith({
    $or: [
      { sender: 'user123' },
      { recipient: 'user123' },
    ],
  });

  expect(userDao.deleteUser).toHaveBeenCalledWith('user123');
  expect(MessageEvents.publish).toHaveBeenCalledWith({
    type: 'user-logged-out',
    userId: 'user123',
  });

  expect(req.session.destroy).toHaveBeenCalled();
  expect(res.clearCookie).toHaveBeenCalledWith('connect.sid');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    message: 'Account deleted successfully.',
  });
});

test('Controller Successful Login', async () => {
  const req = {
    body: {
      txt_login: 'test@example.com',
      txt_pass: '123456',
    },
    session: {},
  };

  const res = mockResponse();

  userDao.findUserByLogin.mockResolvedValue({
    _id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
  });

  passUtil.comparePassword.mockReturnValue(true);

  await controller.login(req, res);

  expect(userDao.findUserByLogin).toHaveBeenCalledWith(
    'test@example.com'
  );
  expect(passUtil.comparePassword).toHaveBeenCalledWith(
    '123456',
    'hashedPassword'
  );
  expect(req.session.userId).toBe('user123');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    message: 'Login successful.',
  });
});

test('Controller Incorrect Login', async () => {
  const req = {
    body: {
      txt_login: 'test@example.com',
      txt_pass: '123456',
    },
    session: {},
  };

  const res = mockResponse();

  userDao.findUserByLogin.mockResolvedValue({
    _id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
  });

  passUtil.comparePassword.mockReturnValue(false);

  await controller.login(req, res);

  expect(userDao.findUserByLogin).toHaveBeenCalledWith(
    'test@example.com'
  );
  expect(passUtil.comparePassword).toHaveBeenCalledWith(
    '123456',
    'hashedPassword'
  );
  expect(req.session.userId).toBeUndefined();
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith({
    message: 'Invalid username/email or password.',
  });
});

test('Fetch Logged User', async () => {
  const req = {
    session: {
      userId: 'user123',
    },
  };

  const res = mockResponse();

  const profile = {
    _id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
  };

  userDao.getProfile.mockResolvedValue(profile);

  await controller.loggedUser(req, res);

  expect(userDao.getProfile).toHaveBeenCalledWith('user123');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(profile);
});

test('Logout User', async () => {
  const req = {
    session: {
      userId: 'user123',
      destroy: jest.fn((callback) => callback(null)),
    },
  };

  const res = mockResponse();

  await controller.logout(req, res);

  expect(req.session.destroy).toHaveBeenCalled();
  expect(MessageEvents.publish).toHaveBeenCalledWith({
    type: 'user-logged-out',
    userId: 'user123',
  });
  expect(res.clearCookie).toHaveBeenCalledWith('connect.sid');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    message: 'Logged out successfully.',
  });
});

test('Admin Security Check passes', () => {
  const req = {
    session: {
      user: { _id: 'a1', permission: 1 },
    },
  };

  expect(controller.adminCheck(req)).toBeTruthy();
});

test('Admin Security Check fails', () => {
  const req = {
    session: {
      user: { _id: 'c1', permission: 2 },
    },
  };

  expect(controller.adminCheck(req)).toBeFalsy();
});

test('Admin Security Check unlogged user', () => {
  const req = {
    session: { user: undefined },
  };

  expect(controller.adminCheck(req)).toBeFalsy();
});

describe('Update User Account', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: { _id: 'user123' },
      session: {},
    };

    res = mockResponse();

    userDao.updateUser.mockResolvedValue({
      _id: 'user123',
      username: 'newusername',
      email: 'newemail@example.com',
    });
  });

  test('Updates a user username', async () => {
    req.body.username = 'newusername';

    await controller.userCreateUpdate(req, res);

    expect(userDao.updateUser).toHaveBeenCalledWith(
      'user123',
      expect.objectContaining({
        username: 'newusername',
      })
    );

    expect(req.session.userId).toBe('user123');
    expect(res.json).toHaveBeenCalled();
  });

  test('Updates a user email', async () => {
    req.body.email = 'newemail@example.com';

    await controller.userCreateUpdate(req, res);

    expect(userDao.updateUser).toHaveBeenCalledWith(
      'user123',
      expect.objectContaining({
        email: 'newemail@example.com',
      })
    );

    expect(res.json).toHaveBeenCalled();
  });

  test('Updates a user password', async () => {
    req.body.password = 'newpassword123';
    passUtil.hashPassword.mockReturnValue('hashed-password');

    await controller.userCreateUpdate(req, res);

    expect(passUtil.hashPassword).toHaveBeenCalledWith(
      'newpassword123'
    );

    expect(userDao.updateUser).toHaveBeenCalledWith(
      'user123',
      expect.objectContaining({
        password: 'hashed-password',
      })
    );

    expect(res.json).toHaveBeenCalled();
  });

  test('Does not save the plain text password', async () => {
    req.body.password = 'newpassword123';
    passUtil.hashPassword.mockReturnValue('hashed-password');

    await controller.userCreateUpdate(req, res);

    const updatedUser = userDao.updateUser.mock.calls[0][1];

    expect(updatedUser.password).toBe('hashed-password');
    expect(updatedUser.password).not.toBe('newpassword123');
  });

  test('Returns the updated user', async () => {
    const updatedUser = {
      _id: 'user123',
      username: 'newusername',
      email: 'newemail@example.com',
    };

    userDao.updateUser.mockResolvedValue(updatedUser);

    await controller.userCreateUpdate(req, res);

    expect(res.json).toHaveBeenCalledWith(updatedUser);
  });

  test('Handles an error when updating a user', async () => {
    userDao.updateUser.mockRejectedValue(
      new Error('Database error')
    );

    await expect(
      controller.userCreateUpdate(req, res)
    ).rejects.toThrow('Database error');
  });
});

describe('Additional account tests', () => {
  const validBody = {
    username: 'testuser',
    email: 'test@example.com',
    password: '123456',
    confirmPassword: '123456',
  };

  test('Rejects missing registration fields', async () => {
    const req = {
      body: { ...validBody, email: '' },
      session: {},
    };

    const res = mockResponse();

    await controller.userCreateUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'All fields are required.',
    });
    expect(userDao.createUser).not.toHaveBeenCalled();
  });

  test('Rejects mismatched passwords', async () => {
    const req = {
      body: {
        ...validBody,
        confirmPassword: 'different',
      },
      session: {},
    };

    const res = mockResponse();

    await controller.userCreateUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Passwords do not match.',
    });
  });

  test('Rejects short passwords', async () => {
    const req = {
      body: {
        ...validBody,
        password: '123',
        confirmPassword: '123',
      },
      session: {},
    };

    const res = mockResponse();

    await controller.userCreateUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Password must be at least 6 characters.',
    });
  });

  test('Rejects duplicate emails', async () => {
    userDao.findUserByEmail.mockResolvedValue({
      _id: 'existing',
    });

    const req = {
      body: { ...validBody },
      session: {},
    };

    const res = mockResponse();

    await controller.userCreateUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Email is already registered.',
    });
  });

  test('Rejects duplicate usernames', async () => {
    userDao.findUserByEmail.mockResolvedValue(null);
    userDao.findUserByUsername.mockResolvedValue({
      _id: 'existing',
    });

    const req = {
      body: { ...validBody },
      session: {},
    };

    const res = mockResponse();

    await controller.userCreateUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Username is already taken.',
    });
  });

  test('Updates an existing account', async () => {
    userDao.updateUser.mockResolvedValue({
      _id: 'user123',
      username: 'updateduser',
    });

    passUtil.hashPassword.mockReturnValue('newHash');

    const req = {
      body: {
        _id: 'user123',
        username: 'updateduser',
        email: 'updated@example.com',
        password: 'newpassword',
        friends: [],
      },
      session: {},
    };

    const res = mockResponse();

    await controller.userCreateUpdate(req, res);

    expect(userDao.updateUser).toHaveBeenCalledWith(
      'user123',
      expect.objectContaining({
        username: 'updateduser',
        password: 'newHash',
      })
    );

    expect(req.session.userId).toBe('user123');
  });

  test('Rejects deletion when not logged in', async () => {
    const req = { session: {} };
    const res = mockResponse();

    await controller.userDelete(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(userDao.deleteUser).not.toHaveBeenCalled();
    expect(MessageDao.deleteMany).not.toHaveBeenCalled();
  });

  test('Returns 404 when deleting a missing user', async () => {
    userDao.deleteUser.mockResolvedValue(null);

    const req = {
      session: { userId: 'missing' },
    };

    const res = mockResponse();

    await controller.userDelete(req, res);

    expect(MessageDao.deleteMany).toHaveBeenCalled();
    expect(userDao.deleteUser).toHaveBeenCalledWith('missing');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User not found.',
    });
  });

  test('Handles session destruction failure during deletion', async () => {
    userDao.deleteUser.mockResolvedValue({
      _id: 'user123',
    });

    const req = {
      session: {
        userId: 'user123',
        destroy: jest.fn((callback) =>
          callback(new Error('Session error'))
        ),
      },
    };

    const res = mockResponse();

    await controller.userDelete(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: 'Account deleted, but failed to end the session.',
    });
  });

  test('Handles database errors during deletion', async () => {
    userDao.deleteUser.mockRejectedValue(
      new Error('Database error')
    );

    const req = {
      session: { userId: 'user123' },
    };

    const res = mockResponse();

    await controller.userDelete(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Failed to delete user.',
    });
  });
});

describe('Additional session and profile tests', () => {
  test('Rejects login when user does not exist', async () => {
    userDao.findUserByLogin.mockResolvedValue(null);

    const req = {
      body: {
        txt_login: 'missing',
        txt_pass: 'password',
      },
      session: {},
    };

    const res = mockResponse();

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(passUtil.comparePassword).not.toHaveBeenCalled();
  });

  test('Rejects access to logged user without a session', async () => {
    const req = { session: {} };
    const res = mockResponse();

    await controller.loggedUser(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(userDao.getProfile).not.toHaveBeenCalled();
  });

  test('Returns 404 when logged-in user no longer exists', async () => {
    userDao.getProfile.mockResolvedValue(null);

    const req = {
      session: { userId: 'missing' },
    };

    const res = mockResponse();

    await controller.loggedUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('Handles logout session errors', async () => {
    const req = {
      session: {
        destroy: jest.fn((callback) =>
          callback(new Error('Session error'))
        ),
      },
    };

    const res = mockResponse();

    await controller.logout(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  test('Retrieves a user profile', async () => {
    const userId = 'user123';

    const user = {
      _id: userId,
      username: 'testuser',
      email: 'test@example.com',
      friends: ['friend1', 'friend2'],
      avatar: '',
      userType: 'registered',
      chipBalance: 1000,
    };

    const selectMock = jest.fn().mockResolvedValue(user);

    userDao.findById.mockReturnValue({
      select: selectMock,
    });

    const profile = await controller.getProfile(userId);

    expect(userDao.findById).toHaveBeenCalledWith(userId);
    expect(selectMock).toHaveBeenCalledWith(
      '_id username email friends avatar userType chipBalance'
    );

    expect(profile).toEqual({
      _id: userId,
      username: 'testuser',
      email: 'test@example.com',
      friendCount: 2,
      avatar: '',
      userType: 'registered',
      chipBalance: 1000,
    });
  });

  test('Returns null for a missing profile', async () => {
    const selectMock = jest.fn().mockResolvedValue(null);

    userDao.findById.mockReturnValue({
      select: selectMock,
    });

    const profile = await controller.getProfile('missing');

    expect(userDao.findById).toHaveBeenCalledWith('missing');
    expect(profile).toBeNull();
  });

  test('Propagates database errors when retrieving a profile', async () => {
    const selectMock = jest.fn().mockRejectedValue(
      new Error('Invalid ID')
    );

    userDao.findById.mockReturnValue({
      select: selectMock,
    });

    await expect(
      controller.getProfile('invalid')
    ).rejects.toThrow('Invalid ID');
  });
});

// Password recovery tests

describe('Password recovery', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {},
    };
    res = mockResponse();
  });

  describe('forgotPassword', () => {
    const genericResponse = {
      message:
        'If an account exists with that email, a reset link has been sent.',
    };

    test('does not reveal whether an email is registered', async () => {
      req.body.email = 'missing@example.com';
      userDao.findUserByEmail.mockResolvedValue(null);

      await controller.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(genericResponse);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    test('handles a missing email without querying the database', async () => {
      await controller.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(genericResponse);
      expect(userDao.findUserByEmail).not.toHaveBeenCalled();
    });

    test('creates a reset token and sends an email', async () => {
      req.body.email = 'test@example.com';

      userDao.findUserByEmail.mockResolvedValue({
        _id: 'user123',
        email: 'test@example.com',
      });

      userDao.setPasswordResetToken.mockResolvedValue({});

      await controller.forgotPassword(req, res);

      expect(userDao.setPasswordResetToken).toHaveBeenCalledWith(
        'user123',
        expect.stringMatching(/^[a-f0-9]{64}$/),
        expect.any(Date)
      );

      const [userId, tokenHash, expires] =
        userDao.setPasswordResetToken.mock.calls[0];

      expect(userId).toBe('user123');
      expect(tokenHash).toHaveLength(64);

      const minutesUntilExpiry =
        (expires.getTime() - Date.now()) / 60000;

      expect(minutesUntilExpiry).toBeGreaterThan(14);
      expect(minutesUntilExpiry).toBeLessThanOrEqual(15);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Poker Face - Password Reset',
          html: expect.stringContaining('/resetPassword?token='),
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(genericResponse);
    });

    test('returns 500 if the database fails', async () => {
      req.body.email = 'test@example.com';

      userDao.findUserByEmail.mockRejectedValue(
        new Error('Database unavailable')
      );

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        await controller.forgotPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Unable to process your password reset request.',
        });
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      req.body = {
        token: 'valid-reset-token',
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      };
    });

    test('rejects missing fields', async () => {
      delete req.body.token;

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All fields are required.',
      });
    });

    test('rejects mismatched passwords', async () => {
      req.body.confirmPassword = 'differentpassword';

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Passwords do not match.',
      });
    });

    test('rejects short passwords', async () => {
      req.body.password = '123';
      req.body.confirmPassword = '123';

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password must be at least 6 characters.',
      });
    });

    test('rejects invalid or expired reset tokens', async () => {
      userDao.findUserByResetToken.mockResolvedValue(null);

      await controller.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'This password-reset link is invalid or has expired.',
      });

      expect(
        userDao.updatePasswordAndClearResetToken
      ).not.toHaveBeenCalled();
    });

    test('hashes the new password and clears the reset token', async () => {
      userDao.findUserByResetToken.mockResolvedValue({
        _id: 'user123',
      });

      passUtil.hashPassword.mockReturnValue('new-hashed-password');

      userDao.updatePasswordAndClearResetToken.mockResolvedValue({});

      await controller.resetPassword(req, res);

      expect(userDao.findUserByResetToken).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{64}$/)
      );

      expect(passUtil.hashPassword).toHaveBeenCalledWith(
        'newpassword123'
      );

      expect(
        userDao.updatePasswordAndClearResetToken
      ).toHaveBeenCalledWith(
        'user123',
        'new-hashed-password'
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Your password has been reset successfully.',
      });
    });

    test('returns 500 if updating the password fails', async () => {
      userDao.findUserByResetToken.mockResolvedValue({
        _id: 'user123',
      });

      passUtil.hashPassword.mockReturnValue('hashed-password');

      userDao.updatePasswordAndClearResetToken.mockRejectedValue(
        new Error('Database unavailable')
      );

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        await controller.resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Unable to reset your password.',
        });
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});
