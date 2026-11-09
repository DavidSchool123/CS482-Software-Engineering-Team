
jest.mock('resend', () => ({
  Resend: jest.fn(),
}));

const { Resend } = require('resend');
const { sendEmail } = require('../service/EmailService');

describe('EmailService', () => {
  const originalApiKey = process.env.RESEND_API_KEY;

  const email = {
    to: 'test@example.com',
    subject: 'Password Reset',
    html: '<p>Reset your password</p>',
  };

  let mockSend;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.RESEND_API_KEY = 'test-api-key';

    mockSend = jest.fn();

    Resend.mockImplementation(() => ({
      emails: {
        send: mockSend,
      },
    }));
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalApiKey;
    }
  });

  test('rejects sending an email without an API key', async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendEmail(email)).rejects.toThrow(
      'RESEND_API_KEY is missing from .env'
    );

    expect(Resend).not.toHaveBeenCalled();
  });

  test('sends an email successfully', async () => {
    const responseData = {
      id: 'email123',
    };

    mockSend.mockResolvedValue({
      data: responseData,
      error: null,
    });

    const result = await sendEmail(email);

    expect(Resend).toHaveBeenCalledWith('test-api-key');

    expect(mockSend).toHaveBeenCalledWith({
      from: 'Poker Face <onboarding@resend.dev>',
      to: 'test@example.com',
      subject: 'Password Reset',
      html: '<p>Reset your password</p>',
    });

    expect(result).toEqual(responseData);
  });

  test('throws an error when Resend returns an error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: {
        message: 'Invalid recipient',
      },
    });

    await expect(sendEmail(email)).rejects.toThrow(
      'Invalid recipient'
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('propagates unexpected Resend failures', async () => {
    mockSend.mockRejectedValue(
      new Error('Network connection failed')
    );

    await expect(sendEmail(email)).rejects.toThrow(
      'Network connection failed'
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
