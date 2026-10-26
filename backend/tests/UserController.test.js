const controller = require('../controller/UserController');
const userDao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil');

jest.mock('../model/UserDao');
jest.mock('../util/PasswordUtil');

beforeEach(function () {
  jest.clearAllMocks();
});

test('Controller New User', async function () {
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

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  await controller.userCreateUpdate(req, res);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(userDao.createUser).toHaveBeenCalled();
  expect(userDao.updateUser).not.toHaveBeenCalled();
});

test('Delete User Account', async function () {
  let req = {
    session: {
      userId: 'user123',
      destroy: jest.fn((callback) => callback(null)),
    },
  };

  let res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    clearCookie: jest.fn(),
  };

  userDao.deleteUser.mockResolvedValue({
    _id: 'user123',
    username: 'testuser',
  });

  await controller.userDelete(req, res);

  expect(userDao.deleteUser).toHaveBeenCalledWith('user123');
  expect(req.session.destroy).toHaveBeenCalled();
  expect(res.clearCookie).toHaveBeenCalledWith('connect.sid');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    message: 'Account deleted successfully.',
  });
});

test('Controller Successful Login', async function () {
  let req = {
    body: {
      txt_login: 'test@example.com',
      txt_pass: '123456',
    },
    session: {},
  };

  let res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  userDao.findUserByLogin.mockResolvedValue({
    _id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
  });

  passUtil.comparePassword.mockReturnValue(true);

  await controller.login(req, res);

  expect(userDao.findUserByLogin).toHaveBeenCalledWith('test@example.com');
  expect(passUtil.comparePassword).toHaveBeenCalledWith(
    '123456',
    'hashedPassword',
  );
  expect(req.session.userId).toBe('user123');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    message: 'Login successful.',
  });
});

test('Controller Incorrect Login', async function () {
  let req = {
    body: {
      txt_login: 'test@example.com',
      txt_pass: '123456',
    },
    session: {},
  };

  let res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  userDao.findUserByLogin.mockResolvedValue({
    _id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
  });

  passUtil.comparePassword.mockReturnValue(false);

  await controller.login(req, res);

  expect(userDao.findUserByLogin).toHaveBeenCalledWith('test@example.com');
  expect(passUtil.comparePassword).toHaveBeenCalledWith(
    '123456',
    'hashedPassword',
  );
  expect(req.session.userId).toBeUndefined();
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith({
    message: 'Invalid username/email or password.',
  });
});

test('Fetch Logged User', async function () {
  let req = {
    session: {
      userId: 'user123',
    },
  };

  let res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  userDao.getProfile.mockResolvedValue({
    _id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
  });

  await controller.loggedUser(req, res);

  expect(userDao.getProfile).toHaveBeenCalledWith('user123');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    _id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
  });
});

test('Logout User', async function () {
  let req = {
    session: {
      userId: 'user123',
      destroy: jest.fn((callback) => callback(null)),
    },
  };

  let res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    clearCookie: jest.fn(),
  };

  await controller.logout(req, res);

  expect(req.session.destroy).toHaveBeenCalled();
  expect(res.clearCookie).toHaveBeenCalledWith('connect.sid');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    message: 'Logged out successfully.',
  });
});

test('Admin Security Check passes', function () {
  let req = { session: { user: { _id: 'a1', permission: 1 } } };
  let pass = controller.adminCheck(req);
  expect(pass).toBeTruthy();
});

test('Admin Security Check fails', function () {
  let req = { session: { user: { _id: 'c1', permission: 2 } } };
  let pass = controller.adminCheck(req);
  expect(pass).toBeFalsy();
});

test('Admin Security Check unlogged user', function () {
  let req = { session: { user: undefined } };
  let pass = controller.adminCheck(req);
  expect(pass).toBeFalsy();
});

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn(),
    clearCookie: jest.fn(),
  };
}

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
      body: { ...validBody, confirmPassword: 'different' },
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
    userDao.findUserByEmail.mockResolvedValue({ _id: 'existing' });

    const req = { body: { ...validBody }, session: {} };
    const res = mockResponse();

    await controller.userCreateUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Email is already registered.',
    });
  });

  test('Rejects duplicate usernames', async () => {
    userDao.findUserByEmail.mockResolvedValue(null);
    userDao.findUserByUsername.mockResolvedValue({ _id: 'existing' });

    const req = { body: { ...validBody }, session: {} };
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
      }),
    );
    expect(req.session.userId).toBe('user123');
  });

  test('Rejects deletion when not logged in', async () => {
    const req = { session: {} };
    const res = mockResponse();

    await controller.userDelete(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(userDao.deleteUser).not.toHaveBeenCalled();
  });

  test('Returns 404 when deleting a missing user', async () => {
    userDao.deleteUser.mockResolvedValue(null);

    const req = { session: { userId: 'missing' } };
    const res = mockResponse();

    await controller.userDelete(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('Handles session destruction failure during deletion', async () => {
    userDao.deleteUser.mockResolvedValue({ _id: 'user123' });

    const req = {
      session: {
        userId: 'user123',
        destroy: jest.fn((callback) =>
          callback(new Error('Session error')),
        ),
      },
    };
    const res = mockResponse();

    await controller.userDelete(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  test('Handles database errors during deletion', async () => {
    userDao.deleteUser.mockRejectedValue(new Error('Database error'));

    const req = { session: { userId: 'user123' } };
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
      body: { txt_login: 'missing', txt_pass: 'password' },
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

    const req = { session: { userId: 'missing' } };
    const res = mockResponse();

    await controller.loggedUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('Handles logout session errors', async () => {
    const req = {
      session: {
        destroy: jest.fn((callback) =>
          callback(new Error('Session error')),
        ),
      },
    };
    const res = mockResponse();

    await controller.logout(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  test('Retrieves a user profile', async () => {
    const profile = { _id: 'user123', username: 'testuser' };
    userDao.getProfile.mockResolvedValue(profile);

    const req = { params: { userId: 'user123' } };
    const res = mockResponse();

    await controller.getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(profile);
  });

  test('Returns 404 for a missing profile', async () => {
    userDao.getProfile.mockResolvedValue(null);

    const req = { params: { userId: 'missing' } };
    const res = mockResponse();

    await controller.getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('Handles invalid profile IDs', async () => {
    userDao.getProfile.mockRejectedValue(new Error('Invalid ID'));

    const req = { params: { userId: 'invalid' } };
    const res = mockResponse();

    await controller.getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});