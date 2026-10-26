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
