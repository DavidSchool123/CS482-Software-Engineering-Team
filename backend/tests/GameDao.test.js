
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');

  const saveMock = jest.fn();
  const sessionMock = jest.fn();
  const findByIdMock = jest.fn();
  const findOneAndUpdateMock = jest.fn();

  class MockGameModel {
    constructor(data) {
      Object.assign(this, data);
      this.save = saveMock;
    }

    static findById(...args) {
      return findByIdMock(...args);
    }

    static findOneAndUpdate(...args) {
      return findOneAndUpdateMock(...args);
    }
  }

  return {
    ...actual,
    model: jest.fn(() => MockGameModel),
    __mocks: {
      saveMock,
      sessionMock,
      findByIdMock,
      findOneAndUpdateMock
    }
  };
});

const mongoose = require('mongoose');
const GameDao = require('../model/GameDao');

const {
  saveMock,
  sessionMock,
  findByIdMock,
  findOneAndUpdateMock
} = mongoose.__mocks;

describe('GameDao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('creates and saves a game', async () => {
      const gameData = {
        TableId: 'table123',
        Status: 'Waiting'
      };

      saveMock.mockResolvedValue(undefined);

      const result = await GameDao.create(gameData);

      expect(result.TableId).toBe('table123');
      expect(result.Status).toBe('Waiting');
      expect(saveMock).toHaveBeenCalledWith({
        session: undefined
      });
    });

    test('saves a game using a session', async () => {
      const session = { id: 'session1' };

      saveMock.mockResolvedValue(undefined);

      await GameDao.create(
        { Status: 'Waiting' },
        session
      );

      expect(saveMock).toHaveBeenCalledWith({
        session
      });
    });

    test('propagates database save errors', async () => {
      saveMock.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        GameDao.create({ Status: 'Waiting' })
      ).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    test('finds a game by ID', async () => {
      const game = { _id: 'game123' };

      sessionMock.mockResolvedValue(game);
      findByIdMock.mockReturnValue({
        session: sessionMock
      });

      const result = await GameDao.findById('game123');

      expect(findByIdMock).toHaveBeenCalledWith(
        'game123'
      );
      expect(sessionMock).toHaveBeenCalledWith(null);
      expect(result).toEqual(game);
    });

    test('finds a game using a session', async () => {
      const session = { id: 'session1' };

      sessionMock.mockResolvedValue({
        _id: 'game123'
      });

      findByIdMock.mockReturnValue({
        session: sessionMock
      });

      await GameDao.findById('game123', session);

      expect(sessionMock).toHaveBeenCalledWith(
        session
      );
    });

    test('returns null when game is not found', async () => {
      sessionMock.mockResolvedValue(null);
      findByIdMock.mockReturnValue({
        session: sessionMock
      });

      const result = await GameDao.findById(
        'missingGame'
      );

      expect(result).toBeNull();
    });
  });

  describe('advanceStreet', () => {
    test('atomically advances to the next street', async () => {
      const players = [{ PlayerId: 'player1' }];
      const deck = [{ rank: 'A', suit: 'Spades' }];
      const updatedGame = { Street: 4 };

      findOneAndUpdateMock.mockResolvedValue(
        updatedGame
      );

      const result = await GameDao.advanceStreet(
        'game123',
        3,
        players,
        deck
      );

      expect(findOneAndUpdateMock).toHaveBeenCalledWith(
        {
          _id: 'game123',
          Street: 3,
          Status: 'In Progress',
          BettingRoundComplete: true,
          AwaitingNextRound: false
        },
        {
          $set: {
            Players: players,
            Deck: deck,
            Street: 4,
            BettingRoundComplete: true,
            AwaitingNextRound: true,
            CurrentTurnPlayerId: null
          }
        },
        {
          new: true,
          runValidators: true,
          session: null
        }
      );

      expect(result).toEqual(updatedGame);
    });

    test('passes the session to the update', async () => {
      const session = { id: 'session1' };

      findOneAndUpdateMock.mockResolvedValue({
        Street: 5
      });

      await GameDao.advanceStreet(
        'game123',
        4,
        [],
        [],
        session
      );

      expect(findOneAndUpdateMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({ session })
      );
    });

    test('returns null when update conditions do not match', async () => {
      findOneAndUpdateMock.mockResolvedValue(null);

      const result = await GameDao.advanceStreet(
        'game123',
        3,
        [],
        []
      );

      expect(result).toBeNull();
    });
  });
});
