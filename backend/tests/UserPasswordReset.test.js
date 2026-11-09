require('dotenv').config();

const mongoose = require('mongoose');
const controller = require('../controller/UserController');
const UserDao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil');

jest.mock('../service/EmailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
}));

const { sendEmail } = require('../service/EmailService');

describe('UserController - Password Reset', () => {
  const testEmail = 'passwordtest@example.com';
  const oldPassword = 'oldpassword123';

  let testUser;

  function createResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  }

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI);
  });

  beforeEach(async () => {
    await UserDao.deleteMany({});

    jest.clearAllMocks();

    testUser = await UserDao.create({
      username: 'passwordtest',
      email: testEmail,
      password: passUtil.hashPassword(oldPassword),
    });
  });

  afterEach(async () => {
    await UserDao.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('forgotPassword sends a reset email to an existing user', async () => {
    const req = {
      body: { email: testEmail },
    };

    const res = createResponse();

    await controller.forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith({
      message:
        'If an account exists with that email, a reset link has been sent.',
    });

    // Check that the email was sent to the correct user.
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const emailData = sendEmail.mock.calls[0][0];

    expect(emailData.to).toBe(testEmail);
    expect(emailData.subject).toBe('Poker Face - Password Reset');
    expect(emailData.html).toContain('Reset My Password');

    // Check that the reset token was saved in MongoDB.
    const savedUser = await UserDao.findById(testUser._id);

    expect(savedUser.resetPasswordToken).toBeDefined();
    expect(savedUser.resetPasswordExpires).toBeInstanceOf(Date);
    expect(savedUser.resetPasswordExpires.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  test('forgotPassword does not send an email for an unknown address', async () => {
    const req = {
      body: { email: 'unknown@example.com' },
    };

    const res = createResponse();

    await controller.forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('forgotPassword handles a missing email address', async () => {
    const req = {
      body: {},
    };

    const res = createResponse();

    await controller.forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('resetPassword updates the password with a valid token', async () => {
    const resetToken = 'valid-reset-token';

    const tokenHash = require('node:crypto')
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    await UserDao.setPasswordResetToken(
      testUser._id,
      tokenHash,
      new Date(Date.now() + 15 * 60 * 1000),
    );

    const req = {
      body: {
        token: resetToken,
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      },
    };

    const res = createResponse();

    await controller.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Your password has been reset successfully.',
    });

    const updatedUser = await UserDao.findById(testUser._id);

    expect(
      passUtil.comparePassword('newpassword123', updatedUser.password),
    ).toBe(true);

    expect(passUtil.comparePassword(oldPassword, updatedUser.password)).toBe(
      false,
    );

    expect(updatedUser.resetPasswordToken).toBeNull();
    expect(updatedUser.resetPasswordExpires).toBeNull();
  });

  test('resetPassword rejects an invalid token', async () => {
    const req = {
      body: {
        token: 'invalid-token',
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      },
    };

    const res = createResponse();

    await controller.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      message: 'This password-reset link is invalid or has expired.',
    });

    const savedUser = await UserDao.findById(testUser._id);

    expect(passUtil.comparePassword(oldPassword, savedUser.password)).toBe(
      true,
    );
  });

  test('resetPassword rejects an expired token', async () => {
    const resetToken = 'expired-reset-token';

    const tokenHash = require('node:crypto')
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    await UserDao.setPasswordResetToken(
      testUser._id,
      tokenHash,
      new Date(Date.now() - 1000),
    );

    const req = {
      body: {
        token: resetToken,
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      },
    };

    const res = createResponse();

    await controller.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      message: 'This password-reset link is invalid or has expired.',
    });
  });

  test('resetPassword rejects passwords that do not match', async () => {
    const req = {
      body: {
        token: 'valid-reset-token',
        password: 'newpassword123',
        confirmPassword: 'differentpassword',
      },
    };

    const res = createResponse();

    await controller.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Passwords do not match.',
    });

    // The original password should remain unchanged.
    const savedUser = await UserDao.findById(testUser._id);

    expect(passUtil.comparePassword(oldPassword, savedUser.password)).toBe(
      true,
    );
  });

  test('resetPassword rejects missing fields', async () => {
    const req = {
      body: {
        token: 'valid-reset-token',
        password: 'newpassword123',
      },
    };

    const res = createResponse();

    await controller.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      message: 'All fields are required.',
    });
  });

  test('resetPassword rejects passwords shorter than six characters', async () => {
    const req = {
      body: {
        token: 'valid-reset-token',
        password: '123',
        confirmPassword: '123',
      },
    };

    const res = createResponse();

    await controller.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Password must be at least 6 characters.',
    });
  });
});
