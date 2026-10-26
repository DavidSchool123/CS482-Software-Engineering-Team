
const request = require('supertest');
const app = require('../app');
const ContactDao = require('../model/ContactDao');

// Mock the DAO so tests don't write to MongoDB
jest.mock('../model/ContactDao');

describe('P8 - Player Admin Contact', () => {
  const validContact = {
    name: 'Test User',
    email: 'test@example.com',
    subject: 'Gameplay Issue',
    message: 'I encountered an issue while playing Poker Face.',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  // TEST 1: Successful submission
  test('POST /api/contact returns 201 for a valid message', async () => {
    ContactDao.createContact.mockResolvedValue({
      _id: 'contact123',
    });

    const response = await request(app)
      .post('/api/contact')
      .send(validContact);

    expect(response.status).toBe(201);
    expect(response.body.message).toBe(
      'Your message has been submitted successfully.'
    );
    expect(response.body.id).toBe('contact123');
  });

  // TEST 2: Correct data is passed to the DAO
  test('saves the correct contact information', async () => {
    ContactDao.createContact.mockResolvedValue({
      _id: 'contact123',
    });

    await request(app)
      .post('/api/contact')
      .send(validContact);

    expect(ContactDao.createContact).toHaveBeenCalledWith({
      Name: 'Test User',
      Email: 'test@example.com',
      Subject: 'Gameplay Issue',
      Message: 'I encountered an issue while playing Poker Face.',
    });
  });

  // TEST 3: Missing name
  test('rejects a submission with a missing name', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        ...validContact,
        name: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('All fields are required.');
    expect(ContactDao.createContact).not.toHaveBeenCalled();
  });

  // TEST 4: Missing email
  test('rejects a submission with a missing email', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        ...validContact,
        email: '',
      });

    expect(response.status).toBe(400);
    expect(ContactDao.createContact).not.toHaveBeenCalled();
  });

  // TEST 5: Missing subject
  test('rejects a submission with a missing subject', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        ...validContact,
        subject: '',
      });

    expect(response.status).toBe(400);
    expect(ContactDao.createContact).not.toHaveBeenCalled();
  });

  // TEST 6: Missing message
  test('rejects a submission with a missing message', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        ...validContact,
        message: '',
      });

    expect(response.status).toBe(400);
    expect(ContactDao.createContact).not.toHaveBeenCalled();
  });

  // TEST 7: Invalid email
  test('rejects an invalid email address', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        ...validContact,
        email: 'not-an-email',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Please enter a valid email address.'
    );
    expect(ContactDao.createContact).not.toHaveBeenCalled();
  });

  // TEST 8: Whitespace-only fields
  test('rejects fields containing only whitespace', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        ...validContact,
        message: '   ',
      });

    expect(response.status).toBe(400);
    expect(ContactDao.createContact).not.toHaveBeenCalled();
  });

  // TEST 9: Trims whitespace before saving
  test('trims contact information before saving', async () => {
    ContactDao.createContact.mockResolvedValue({
      _id: 'contact123',
    });

    await request(app)
      .post('/api/contact')
      .send({
        name: '  Test User  ',
        email: '  test@example.com  ',
        subject: '  Gameplay Issue  ',
        message: '  Please help!  ',
      });

    expect(ContactDao.createContact).toHaveBeenCalledWith({
      Name: 'Test User',
      Email: 'test@example.com',
      Subject: 'Gameplay Issue',
      Message: 'Please help!',
    });
  });

  // TEST 10: Database failure
  test('returns 500 if MongoDB fails to save the message', async () => {
    ContactDao.createContact.mockRejectedValue(
      new Error('Database connection failed')
    );

    const response = await request(app)
      .post('/api/contact')
      .send(validContact);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe(
      'Unable to submit your message. Please try again.'
    );
  });

  // TEST 11: Do not expose database errors
  test('does not expose internal database errors to users', async () => {
    ContactDao.createContact.mockRejectedValue(
      new Error('Sensitive database details')
    );

    const response = await request(app)
      .post('/api/contact')
      .send(validContact);

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(
      'Sensitive database details'
    );
  });

  // TEST 12: Reject non-string input
  test('rejects non-string form fields', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        ...validContact,
        name: 12345,
      });

    expect(response.status).toBe(400);
    expect(ContactDao.createContact).not.toHaveBeenCalled();
  });

  test('rejects messages exceeding the character limit', async () => {
  const response = await request(app)
    .post('/api/contact')
    .send({
      ...validContact,
      message: 'A'.repeat(2001),
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    'One or more fields exceed the maximum allowed length.'
  );
  expect(ContactDao.createContact).not.toHaveBeenCalled();
});

});
