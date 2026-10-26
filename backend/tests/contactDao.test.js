
const mongoose = require('mongoose');
const ContactDao = require('../model/ContactDao');

describe('P8 - Contact Admin DAO', () => {
  let createSpy;

  beforeEach(() => {
    createSpy = jest.spyOn(mongoose.Model, 'create');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const contactData = {
    Name: 'Test User',
    Email: 'test@example.com',
    Subject: 'Gameplay Issue',
    Message: 'I need help with Poker Face.',
  };

  // TEST 1: Save contact information
  test('createContact saves the correct information', async () => {
    const savedContact = {
      _id: 'contact123',
      ...contactData,
      Status: 'Unread',
    };

    createSpy.mockResolvedValue(savedContact);

    const result = await ContactDao.createContact(contactData);

    expect(createSpy).toHaveBeenCalledWith(contactData);
    expect(result).toEqual(savedContact);
  });

  // TEST 2: Database errors propagate
  test('createContact propagates database errors', async () => {
    createSpy.mockRejectedValue(
      new Error('Database connection failed')
    );

    await expect(
      ContactDao.createContact(contactData)
    ).rejects.toThrow('Database connection failed');
  });

  // TEST 3: Status defaults to Unread
  test('new contact messages default to Unread', () => {
    const ContactModel = mongoose.model('Contact');

    const contact = new ContactModel(contactData);

    expect(contact.Status).toBe('Unread');
  });

  // TEST 4: Required fields
  test('contact messages require all four fields', () => {
    const ContactModel = mongoose.model('Contact');

    const contact = new ContactModel({
      Name: 'Test User',
      Email: 'test@example.com',
    });

    const error = contact.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.Subject).toBeDefined();
    expect(error.errors.Message).toBeDefined();
  });

  // TEST 5: Status only accepts allowed values
  test('contact status must be Unread or Read', () => {
    const ContactModel = mongoose.model('Contact');

    const contact = new ContactModel({
      ...contactData,
      Status: 'Deleted',
    });

    const error = contact.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.Status).toBeDefined();
  });
});
