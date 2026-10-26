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