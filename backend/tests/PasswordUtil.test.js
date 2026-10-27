const bcrypt = require('bcrypt');
const passUtil = require('../util/PasswordUtil');

describe('PasswordUtil tests', () => {
  test('hashPassword returns a hashed password', () => {
    const password = 'MyPassword123';

    const hash = passUtil.hashPassword(password);

    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$06\$/);
  });

  test('hashPassword generates different hashes for the same password', () => {
    const password = 'MyPassword123';

    const hash1 = passUtil.hashPassword(password);
    const hash2 = passUtil.hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  test('comparePassword returns true for the correct password', () => {
    const password = 'MyPassword123';
    const hash = passUtil.hashPassword(password);

    const result = passUtil.comparePassword(password, hash);

    expect(result).toBe(true);
  });

  test('comparePassword returns false for an incorrect password', () => {
    const hash = passUtil.hashPassword('CorrectPassword123');

    const result = passUtil.comparePassword('WrongPassword123', hash);

    expect(result).toBe(false);
  });

  test('comparePassword returns false for an invalid hash', () => {
    const result = passUtil.comparePassword(
      'MyPassword123',
      'not-a-valid-bcrypt-hash',
    );

    expect(result).toBe(false);
  });

  test('hashPassword produces a hash that bcrypt can verify', () => {
    const password = 'SecurePassword456';

    const hash = passUtil.hashPassword(password);

    expect(bcrypt.compareSync(password, hash)).toBe(true);
  });
});