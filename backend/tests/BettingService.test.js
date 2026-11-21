
const mongoose = require('mongoose');

jest.mock('../model/GameDao');
jest.mock('../model/TableDao');
jest.mock('../model/GameActionEvent', () => ({
  create: jest.fn()
}));

jest.mock('../service/NextStreetService', () => ({
  advanceRoundInGame: jest.fn()
}));

jest.mock('../service/HandEvaluationService', () => ({
  findWinners: jest.fn()
}));

jest.mock('../service/SettlementService', () => ({
  settleHand: jest.fn()
}));

const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');
const GameActionEvent = require('../model/GameActionEvent');

const {
  advanceRoundInGame
} = require('../service/NextStreetService');

const {
  findWinners
} = require('../service/HandEvaluationService');

const {
  settleHand
} = require('../service/SettlementService');

const {
  performBettingAction,
  getBetSize,
  nextPlayer,
  isBettingRoundComplete
} = require('../service/BettingService');

describe('BettingService - P16 and P49', () => {
  const gameId = '507f1f77bcf86cd799439011';
  const tableId = '507f1f77bcf86cd799439012';

  let session;
  let startSessionSpy;
  let consoleSpy;

  function createPlayer(id, overrides = {}) {
    return {
      PlayerId: id,
      Cards: [],
      HasFolded: false,
      HasActed: false,
      RoundContribution: 0,
      TotalContribution: 0,
      ...overrides
    };
  }

  function createMockGame(overrides = {}) {
    return {
      _id: gameId,
      TableId: tableId,
      Status: 'In Progress',
      Street: 3,
      CurrentBet: 2,
      CurrentTurnPlayerId: 'user2',
      RaiseCount: 0,
      Pot: 4,
      BettingRoundComplete: false,
      AwaitingNextRound: false,
      Players: [
        createPlayer('user1', {
          RoundContribution: 2,
          TotalContribution: 3,
          HasActed: true
        }),
        createPlayer('user2', {
          RoundContribution: 0,
          TotalContribution: 1
        })
      ],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides
    };
  }

  function createMockTable(overrides = {}) {
    return {
      _id: tableId,
      Level: 'Low',
      Status: 'In Progress',
      PlayerStacks: [
        { PlayerId: 'user1', Chips: 200 },
        { PlayerId: 'user2', Chips: 200 }
      ],
      ...overrides
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      withTransaction: jest.fn(async callback => {
        await callback();
      }),
      endSession: jest.fn().mockResolvedValue(undefined)
    };

    startSessionSpy = jest.spyOn(
      mongoose,
      'startSession'
    ).mockResolvedValue(session);

    consoleSpy = jest.spyOn(
      console,
      'log'
    ).mockImplementation(() => {});

    GameDao.findById.mockImplementation(
      async () => createMockGame()
    );

    TableDao.findById.mockResolvedValue(
      createMockTable()
    );

    TableDao.deductPlayerChips.mockResolvedValue({});

    GameActionEvent.create.mockResolvedValue([]);

    advanceRoundInGame.mockImplementation(game => {
      game.Street += 1;
      game.CurrentBet = 0;
      game.RaiseCount = 0;
      game.BettingRoundComplete = false;
      game.AwaitingNextRound = false;

      game.Players.forEach(player => {
        player.RoundContribution = 0;
        player.HasActed = false;
      });

      const nextActive = game.Players.find(
        player => !player.HasFolded
      );

      game.CurrentTurnPlayerId =
        nextActive?.PlayerId || null;
    });

    findWinners.mockReturnValue(['user1']);

    settleHand.mockImplementation(async game => {
      game.Status = 'Completed';
      game.CurrentTurnPlayerId = null;
    });
  });

  afterEach(() => {
    startSessionSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  // -----------------------------------------
  // Helper functions
  // -----------------------------------------

  describe('Helper functions', () => {
    test('getBetSize uses small bets on streets 3 and 4', () => {
      const stakes = {
        smallBet: 5,
        bigBet: 10
      };

      expect(getBetSize(stakes, 3)).toBe(5);
      expect(getBetSize(stakes, 4)).toBe(5);
    });

    test('getBetSize uses big bets on streets 5 through 7', () => {
      const stakes = {
        smallBet: 5,
        bigBet: 10
      };

      expect(getBetSize(stakes, 5)).toBe(10);
      expect(getBetSize(stakes, 6)).toBe(10);
      expect(getBetSize(stakes, 7)).toBe(10);
    });

    test('nextPlayer skips folded players', () => {
      const players = [
        createPlayer('user1', { HasFolded: true }),
        createPlayer('user2', { HasActed: true }),
        createPlayer('user3')
      ];

      expect(
        nextPlayer(players, 'user2', 0)
      ).toBe('user3');
    });

    test('nextPlayer returns null when no action is needed', () => {
      const players = [
        createPlayer('user1', {
          HasActed: true,
          RoundContribution: 5
        }),
        createPlayer('user2', {
          HasActed: true,
          RoundContribution: 5
        })
      ];

      expect(
        nextPlayer(players, 'user1', 5)
      ).toBeNull();
    });

    test('nextPlayer rejects an unknown current player', () => {
      expect(() => nextPlayer(
        [createPlayer('user1')],
        'missing-player',
        0
      )).toThrow('Current player not found');
    });

    test('isBettingRoundComplete returns true when everyone has acted and matched', () => {
      const players = [
        createPlayer('user1', {
          HasActed: true,
          RoundContribution: 5
        }),
        createPlayer('user2', {
          HasActed: true,
          RoundContribution: 5
        })
      ];

      expect(
        isBettingRoundComplete(players, 5)
      ).toBe(true);
    });

    test('isBettingRoundComplete ignores folded players', () => {
      const players = [
        createPlayer('user1', {
          HasActed: true,
          RoundContribution: 5
        }),
        createPlayer('user2', {
          HasFolded: true
        })
      ];

      expect(
        isBettingRoundComplete(players, 5)
      ).toBe(true);
    });

    test('isBettingRoundComplete returns false when a player still owes chips', () => {
      const players = [
        createPlayer('user1', {
          HasActed: true,
          RoundContribution: 5
        }),
        createPlayer('user2', {
          HasActed: true,
          RoundContribution: 2
        })
      ];

      expect(
        isBettingRoundComplete(players, 5)
      ).toBe(false);
    });
  });

  // -----------------------------------------
  // Validation
  // -----------------------------------------

  describe('Action validation', () => {
    test('rejects invalid actions before opening a transaction', async () => {
      await expect(
        performBettingAction(gameId, 'user2', 'dance')
      ).rejects.toThrow('Invalid betting action');

      expect(startSessionSpy).not.toHaveBeenCalled();
    });

    test('rejects a missing game', async () => {
      GameDao.findById.mockResolvedValue(null);

      await expect(
        performBettingAction(gameId, 'user2', 'fold')
      ).rejects.toThrow('Game not found');
    });

    test('rejects a completed game', async () => {
      GameDao.findById.mockResolvedValue(
        createMockGame({
          Status: 'Completed'
        })
      );

      await expect(
        performBettingAction(gameId, 'user2', 'fold')
      ).rejects.toThrow('Game is not in progress');
    });

    test('rejects actions during a completed betting round', async () => {
      GameDao.findById.mockResolvedValue(
        createMockGame({
          BettingRoundComplete: true
        })
      );

      await expect(
        performBettingAction(gameId, 'user2', 'fold')
      ).rejects.toThrow(
        'Betting round is not accepting actions'
      );
    });

    test('rejects actions while awaiting the next round', async () => {
      GameDao.findById.mockResolvedValue(
        createMockGame({
          AwaitingNextRound: true
        })
      );

      await expect(
        performBettingAction(gameId, 'user2', 'fold')
      ).rejects.toThrow(
        'Betting round is not accepting actions'
      );
    });

    test('rejects actions from the wrong player', async () => {
      await expect(
        performBettingAction(gameId, 'user1', 'fold')
      ).rejects.toThrow(
        'It is not this player’s turn'
      );
    });

    test('rejects a player missing from the game', async () => {
      GameDao.findById.mockResolvedValue(
        createMockGame({
          CurrentTurnPlayerId: 'missing-player'
        })
      );

      await expect(
        performBettingAction(
          gameId,
          'missing-player',
          'fold'
        )
      ).rejects.toThrow('Player cannot act');
    });

    test('rejects a folded player', async () => {
      GameDao.findById.mockResolvedValue(
        createMockGame({
          Players: [
            createPlayer('user1'),
            createPlayer('user2', {
              HasFolded: true
            })
          ]
        })
      );

      await expect(
        performBettingAction(gameId, 'user2', 'fold')
      ).rejects.toThrow('Player cannot act');
    });

    test('rejects a missing table', async () => {
      TableDao.findById.mockResolvedValue(null);

      await expect(
        performBettingAction(gameId, 'user2', 'fold')
      ).rejects.toThrow('Table not found');
    });

    test('rejects an invalid table level', async () => {
      TableDao.findById.mockResolvedValue(
        createMockTable({
          Level: 'Invalid'
        })
      );

      await expect(
        performBettingAction(gameId, 'user2', 'fold')
      ).rejects.toThrow('Invalid table level');
    });
  });

  // -----------------------------------------
  // Fold
  // -----------------------------------------

  describe('Fold', () => {
    test('fold marks the player as folded', async () => {
      const game = createMockGame({
        Players: [
          createPlayer('user1'),
          createPlayer('user2'),
          createPlayer('user3')
        ]
      });

      GameDao.findById.mockResolvedValue(game);

      const result = await performBettingAction(
        gameId,
        'user2',
        'fold'
      );

      expect(
        result.Players.find(p => p.PlayerId === 'user2')
          .HasFolded
      ).toBe(true);

      expect(result.Players.find(
        p => p.PlayerId === 'user2'
      ).HasActed).toBe(true);

      expect(result.save).toHaveBeenCalled();
    });

    test('folding to one player settles the hand', async () => {
      const game = createMockGame();

      GameDao.findById.mockResolvedValue(game);

      const result = await performBettingAction(
        gameId,
        'user2',
        'fold'
      );

      expect(settleHand).toHaveBeenCalledWith(
        game,
        expect.anything(),
        ['user1'],
        session
      );

      expect(result.Status).toBe('Completed');
      expect(result.CurrentTurnPlayerId).toBeNull();
    });

    test('fold does not deduct chips', async () => {
      await performBettingAction(
        gameId,
        'user2',
        'fold'
      );

      expect(
        TableDao.deductPlayerChips
      ).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------
  // Check
  // -----------------------------------------

  describe('Check', () => {
    test('check succeeds when nothing is owed', async () => {
      const game = createMockGame({
        CurrentBet: 0,
        Players: [
          createPlayer('user1'),
          createPlayer('user2')
        ]
      });

      GameDao.findById.mockResolvedValue(game);

      const result = await performBettingAction(
        gameId,
        'user2',
        'check'
      );

      expect(
        TableDao.deductPlayerChips
      ).not.toHaveBeenCalled();

      expect(result.Players[1].HasActed).toBe(true);
    });

    test('check rejects when facing a bet', async () => {
      await expect(
        performBettingAction(gameId, 'user2', 'check')
      ).rejects.toThrow(
        'Cannot check when facing a bet'
      );
    });
  });

  // -----------------------------------------
  // Call
  // -----------------------------------------

  describe('Call', () => {
    test('call deducts the amount owed', async () => {
      const game = createMockGame();

      GameDao.findById.mockResolvedValue(game);

      const result = await performBettingAction(
        gameId,
        'user2',
        'call'
      );

      expect(
        TableDao.deductPlayerChips
      ).toHaveBeenCalledWith(
        tableId,
        'user2',
        2,
        session
      );

      expect(result.Players[1].TotalContribution)
        .toBe(3);

      expect(result.Pot).toBe(6);

      expect(advanceRoundInGame).toHaveBeenCalledWith(game);
      expect(result.Street).toBe(4);

      expect(game.save).toHaveBeenCalledWith({ session });

      expect(GameActionEvent.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            gameId,
            playerId: 'user2',
            action: 'call',
            amount: 2,
            street: 3,
            createdAt: expect.any(Date)
          })
        ],
        { session }
      );
    });

    test('call rejects when nothing is owed', async () => {
      GameDao.findById.mockResolvedValue(
        createMockGame({
          CurrentBet: 0
        })
      );

      await expect(
        performBettingAction(gameId, 'user2', 'call')
      ).rejects.toThrow('Nothing to call');
    });

    test('call rejects insufficient chips', async () => {
      TableDao.deductPlayerChips.mockResolvedValue(null);

      await expect(
        performBettingAction(gameId, 'user2', 'call')
      ).rejects.toThrow('Insufficient chips');

      expect(GameActionEvent.create)
        .not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------
  // Bet
  // -----------------------------------------

  describe('Bet', () => {
    test('bet opens betting when CurrentBet is zero', async () => {
      const game = createMockGame({
        CurrentBet: 0,
        Players: [
          createPlayer('user1', {
            HasActed: true
          }),
          createPlayer('user2')
        ]
      });

      GameDao.findById.mockResolvedValue(game);

      const result = await performBettingAction(
        gameId,
        'user2',
        'bet'
      );

      expect(result.CurrentBet).toBe(5);
      expect(result.Pot).toBe(9);
      expect(result.Players[0].HasActed).toBe(false);

      expect(
        TableDao.deductPlayerChips
      ).toHaveBeenCalledWith(
        tableId,
        'user2',
        5,
        session
      );
    });

    test('bet rejects when a bet already exists', async () => {
      await expect(
        performBettingAction(gameId, 'user2', 'bet')
      ).rejects.toThrow(
        'Cannot bet when a bet already exists'
      );
    });
  });

  // -----------------------------------------
  // Raise
  // -----------------------------------------

  describe('Raise', () => {
    test('raise completes the Third Street bring-in', async () => {
      const game = createMockGame();

      GameDao.findById.mockResolvedValue(game);

      const result = await performBettingAction(
        gameId,
        'user2',
        'raise'
      );

      expect(result.CurrentBet).toBe(5);
      expect(result.RaiseCount).toBe(0);

      expect(
        TableDao.deductPlayerChips
      ).toHaveBeenCalledWith(
        tableId,
        'user2',
        5,
        session
      );
    });

    test('raise increases an existing full bet', async () => {
      const game = createMockGame({
        CurrentBet: 5,
        Players: [
          createPlayer('user1', {
            RoundContribution: 5,
            HasActed: true
          }),
          createPlayer('user2')
        ]
      });

      GameDao.findById.mockResolvedValue(game);

      const result = await performBettingAction(
        gameId,
        'user2',
        'raise'
      );

      expect(result.CurrentBet).toBe(10);
      expect(result.RaiseCount).toBe(1);

      expect(
        TableDao.deductPlayerChips
      ).toHaveBeenCalledWith(
        tableId,
        'user2',
        10,
        session
      );
    });

    test('raise rejects when no bet exists', async () => {
      GameDao.findById.mockResolvedValue(
        createMockGame({
          CurrentBet: 0
        })
      );

      await expect(
        performBettingAction(gameId, 'user2', 'raise')
      ).rejects.toThrow(
        'Cannot raise without an existing bet'
      );
    });

    test('raise rejects after reaching the maximum', async () => {
      GameDao.findById.mockResolvedValue(
        createMockGame({
          CurrentBet: 5,
          RaiseCount: 3
        })
      );

      await expect(
        performBettingAction(gameId, 'user2', 'raise')
      ).rejects.toThrow('Maximum raises reached');
    });

    test('raise makes previous players act again', async () => {
      const game = createMockGame();

      GameDao.findById.mockResolvedValue(game);

      const result = await performBettingAction(
        gameId,
        'user2',
        'raise'
      );

      expect(result.Players[0].HasActed).toBe(false);
      expect(result.Players[1].HasActed).toBe(true);
      expect(result.CurrentTurnPlayerId).toBe('user1');
    });
  });

  // -----------------------------------------
  // Betting round progression
  // -----------------------------------------

  describe('Round progression', () => {
    test('advances when everyone has acted and matched', async () => {
      const game = createMockGame();

      GameDao.findById.mockResolvedValue(game);

      await performBettingAction(
        gameId,
        'user2',
        'call'
      );

      expect(advanceRoundInGame)
        .toHaveBeenCalledWith(game);

      expect(game.Street).toBe(4);
    });

    test('does not advance when betting is incomplete', async () => {
      const game = createMockGame({
        Players: [
          createPlayer('user1', {
            RoundContribution: 2,
            HasActed: false
          }),
          createPlayer('user2')
        ]
      });

      GameDao.findById.mockResolvedValue(game);

      await performBettingAction(
        gameId,
        'user2',
        'call'
      );

      expect(advanceRoundInGame)
        .not.toHaveBeenCalled();

      expect(game.CurrentTurnPlayerId).toBe('user1');
    });

    test('seventh street finishes at showdown', async () => {
      const game = createMockGame({
        Street: 7,
        CurrentBet: 10,
        Players: [
          createPlayer('user1', {
            RoundContribution: 10,
            HasActed: true
          }),
          createPlayer('user2', {
            RoundContribution: 0
          })
        ]
      });

      GameDao.findById.mockResolvedValue(game);

      const result = await performBettingAction(
        gameId,
        'user2',
        'call'
      );

      expect(findWinners)
        .toHaveBeenCalledWith(game.Players);

      expect(settleHand).toHaveBeenCalledWith(
        game,
        expect.anything(),
        ['user1'],
        session
      );

      expect(result.Status).toBe('Completed');
    });
  });

  // -----------------------------------------
  // Action events and transactions
  // -----------------------------------------

  describe('Transactions and action events', () => {
    test('saves an action event in the same transaction', async () => {
      await performBettingAction(
        gameId,
        'user2',
        'call'
      );

      expect(GameActionEvent.create)
        .toHaveBeenCalledWith(
          [
            expect.objectContaining({
              gameId,
              playerId: 'user2',
              action: 'call',
              amount: 2,
              street: 3,
              createdAt: expect.any(Date)
            })
          ],
          { session }
        );
    });

    test('records the original street even after advancing', async () => {
      const game = createMockGame();

      GameDao.findById.mockResolvedValue(game);

      await performBettingAction(
        gameId,
        'user2',
        'call'
      );

      expect(game.Street).toBe(4);

      expect(GameActionEvent.create)
        .toHaveBeenCalledWith(
          [
            expect.objectContaining({
              street: 3
            })
          ],
          { session }
        );
    });

    test('does not record an event for an invalid action', async () => {
      await expect(
        performBettingAction(gameId, 'user2', 'check')
      ).rejects.toThrow();

      expect(GameActionEvent.create)
        .not.toHaveBeenCalled();
    });

    test('propagates action event database errors', async () => {
      GameActionEvent.create.mockRejectedValue(
        new Error('Action event write failed')
      );

      await expect(
        performBettingAction(gameId, 'user2', 'call')
      ).rejects.toThrow('Action event write failed');
    });

    test('ends the session after a successful action', async () => {
      await performBettingAction(
        gameId,
        'user2',
        'call'
      );

      expect(session.endSession)
        .toHaveBeenCalledTimes(1);
    });

    test('ends the session after a failed action', async () => {
      await expect(
        performBettingAction(gameId, 'user2', 'check')
      ).rejects.toThrow();

      expect(session.endSession)
        .toHaveBeenCalledTimes(1);
    });

    test('does not save the game when chip deduction fails', async () => {
      const game = createMockGame();

      GameDao.findById.mockResolvedValue(game);

      TableDao.deductPlayerChips.mockResolvedValue(null);

      await expect(
        performBettingAction(gameId, 'user2', 'call')
      ).rejects.toThrow('Insufficient chips');

      expect(game.save).not.toHaveBeenCalled();
      expect(GameActionEvent.create)
        .not.toHaveBeenCalled();
    });
  });
});
