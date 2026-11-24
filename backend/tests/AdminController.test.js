jest.mock('../model/UserDao');

jest.mock('../model/TableDao', () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../model/GameDao', () => ({
  GameModel: {
    aggregate: jest.fn(),
  },
  findById: jest.fn(),
}));

jest.mock('../service/MessageEvents', () => ({
  publish: jest.fn(),
}));

const controller = require('../controller/UserController');
const UserDao = require('../model/UserDao');
const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
const MessageEvents = require('../service/MessageEvents');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('Admin Dashboard Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAdminDashboard', () => {
    test('returns dashboard data for an admin', async () => {
      UserDao.findById.mockResolvedValue({
        _id: 'admin123',
        isAdmin: true,
      });

      const users = [
        {
          _id: 'user1',
          username: 'alice',
          email: 'alice@example.com',
          userType: 'registered',
          isAdmin: false,
          isBanned: false,
          createdAt: new Date(),
          stats: {
            wins: 10,
            losses: 5,
            gamesPlayed: 15,
            totalChipsWon: 5000,
            netWinnings: 2500,
          },
        },
        {
          _id: 'user2',
          username: 'bob',
          email: 'bob@example.com',
          userType: 'registered',
          isAdmin: false,
          isBanned: true,
          createdAt: new Date(),
          stats: {
            wins: 2,
            losses: 8,
            gamesPlayed: 10,
            totalChipsWon: 1000,
            netWinnings: -500,
          },
        },
      ];

      const tables = [
        {
          _id: 'table1',
          Name: 'Active Table',
          UserIds: ['user1', 'user2'],
          BotCount: 1,
          Capacity: 6,
          Status: 'In Progress',
          IsPublic: true,
          CurrentGameID: 'game1',
          createdAt: new Date(),
        },
        {
          _id: 'table2',
          Name: 'Closed Table',
          UserIds: [],
          BotCount: 0,
          Capacity: 6,
          Status: 'Closed',
          IsPublic: false,
          CurrentGameID: null,
          createdAt: new Date(),
        },
      ];

      UserDao.readAll.mockResolvedValue(users);
      TableDao.findAll.mockResolvedValue(tables);

      GameDao.GameModel.aggregate.mockResolvedValue([
        { _id: 'Waiting', count: 2 },
        { _id: 'In Progress', count: 3 },
        { _id: 'Completed', count: 5 },
      ]);

      const req = {
        session: {
          userId: 'admin123',
        },
      };

      const res = createResponse();

      await controller.getAdminDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      const payload = res.json.mock.calls[0][0];

      expect(payload.metrics.registeredUsers).toBe(2);
      expect(payload.metrics.activePlayers).toBe(2);
      expect(payload.metrics.gamesPlayed).toBe(10);

      expect(payload.users).toHaveLength(2);

      expect(payload.users[0]).toEqual(
        expect.objectContaining({
          username: 'alice',
          wins: 10,
          losses: 5,
          gamesPlayed: 15,
          winRate: 10 / 15,
          netWinnings: 2500,
        })
      );

      expect(payload.users[1]).toEqual(
        expect.objectContaining({
          username: 'bob',
          isBanned: true,
          winRate: 2 / 10,
        })
      );

      expect(payload.playerStatistics.topPlayers[0].username)
        .toBe('alice');

      expect(payload.playerStatistics.mostGamesPlayed[0].username)
        .toBe('alice');

      expect(payload.playerStatistics.highestWinRate[0].username)
        .toBe('alice');

      expect(payload.games).toHaveLength(2);

      expect(payload.gameStatusCounts).toEqual({
        Waiting: 2,
        'In Progress': 3,
        Completed: 5,
      });
    });

    test('rejects non-admin users', async () => {
      UserDao.findById.mockResolvedValue({
        _id: 'user123',
        isAdmin: false,
      });

      const req = {
        session: {
          userId: 'user123',
        },
      };

      const res = createResponse();

      await controller.getAdminDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Admin access required.',
      });

      expect(UserDao.readAll).not.toHaveBeenCalled();
      expect(TableDao.findAll).not.toHaveBeenCalled();
      expect(GameDao.GameModel.aggregate).not.toHaveBeenCalled();
    });

    test('rejects requests without a session', async () => {
      const req = {
        session: {},
      };

      const res = createResponse();

      await controller.getAdminDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(UserDao.findById).not.toHaveBeenCalled();
    });

    test('returns zero metrics for empty data', async () => {
      UserDao.findById.mockResolvedValue({
        _id: 'admin123',
        isAdmin: true,
      });

      UserDao.readAll.mockResolvedValue([]);
      TableDao.findAll.mockResolvedValue([]);
      GameDao.GameModel.aggregate.mockResolvedValue([]);

      const req = {
        session: {
          userId: 'admin123',
        },
      };

      const res = createResponse();

      await controller.getAdminDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      const payload = res.json.mock.calls[0][0];

      expect(payload.metrics).toEqual({
        registeredUsers: 0,
        activePlayers: 0,
        gamesPlayed: 0,
        newSignups: 0,
      });

      expect(payload.users).toEqual([]);
      expect(payload.games).toEqual([]);
      expect(payload.gameStatusCounts).toEqual({});
    });

    test('returns 500 when dashboard data retrieval fails', async () => {
      UserDao.findById.mockResolvedValue({
        _id: 'admin123',
        isAdmin: true,
      });

      UserDao.readAll.mockRejectedValue(
        new Error('Database unavailable')
      );

      const req = {
        session: {
          userId: 'admin123',
        },
      };

      const res = createResponse();

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await controller.getAdminDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to load admin dashboard data.',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('adminUpdateUser', () => {
    const adminId = 'admin123';
    const targetId = 'player456';

    function adminRequest(body = {}) {
      return {
        params: {
          userId: targetId,
        },
        session: {
          userId: adminId,
        },
        body,
      };
    }

    test('promotes a player to admin', async () => {
      const target = {
        _id: targetId,
        username: 'alice',
        isAdmin: false,
        isBanned: false,
      };

      const updatedUser = {
        _id: targetId,
        username: 'alice',
        isAdmin: true,
        isBanned: false,
      };

      const select = jest.fn().mockResolvedValue(updatedUser);

      UserDao.findById
        .mockResolvedValueOnce({
          _id: adminId,
          isAdmin: true,
        })
        .mockResolvedValueOnce(target)
        .mockReturnValueOnce({ select });

      UserDao.setAdminStatus.mockResolvedValue(updatedUser);

      const req = adminRequest({
        isAdmin: true,
      });

      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(UserDao.setAdminStatus).toHaveBeenCalledWith(
        targetId,
        true
      );

      expect(UserDao.setBanStatus).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedUser);
    });

    test('bans a player and publishes logout event', async () => {
      const target = {
        _id: targetId,
        username: 'alice',
        isAdmin: false,
        isBanned: false,
      };

      const updatedUser = {
        _id: targetId,
        username: 'alice',
        isAdmin: false,
        isBanned: true,
      };

      const select = jest.fn().mockResolvedValue(updatedUser);

      UserDao.findById
        .mockResolvedValueOnce({
          _id: adminId,
          isAdmin: true,
        })
        .mockResolvedValueOnce(target)
        .mockReturnValueOnce({ select });

      UserDao.setBanStatus.mockResolvedValue(updatedUser);

      const req = adminRequest({
        isBanned: true,
      });

      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(UserDao.setBanStatus).toHaveBeenCalledWith(
        targetId,
        true
      );

      expect(MessageEvents.publish).toHaveBeenCalledWith({
        type: 'user-logged-out',
        userId: targetId,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedUser);
    });

    test('unbans a player without publishing logout event', async () => {
      const target = {
        _id: targetId,
        username: 'alice',
        isAdmin: false,
        isBanned: true,
      };

      const updatedUser = {
        _id: targetId,
        username: 'alice',
        isAdmin: false,
        isBanned: false,
      };

      const select = jest.fn().mockResolvedValue(updatedUser);

      UserDao.findById
        .mockResolvedValueOnce({
          _id: adminId,
          isAdmin: true,
        })
        .mockResolvedValueOnce(target)
        .mockReturnValueOnce({ select });

      UserDao.setBanStatus.mockResolvedValue(updatedUser);

      const req = adminRequest({
        isBanned: false,
      });

      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(UserDao.setBanStatus).toHaveBeenCalledWith(
        targetId,
        false
      );

      expect(MessageEvents.publish).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedUser);
    });

    test('returns 403 when the requester is not an admin', async () => {
      UserDao.findById.mockResolvedValue({
        _id: adminId,
        isAdmin: false,
      });

      const req = adminRequest({
        isBanned: true,
      });

      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(UserDao.setBanStatus).not.toHaveBeenCalled();
      expect(UserDao.setAdminStatus).not.toHaveBeenCalled();
    });

    test('returns 404 when the target user does not exist', async () => {
      UserDao.findById
        .mockResolvedValueOnce({
          _id: adminId,
          isAdmin: true,
        })
        .mockResolvedValueOnce(null);

      const req = adminRequest({
        isBanned: true,
      });

      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found.',
      });

      expect(UserDao.setBanStatus).not.toHaveBeenCalled();
    });

    test('prevents admin from banning themselves', async () => {
      UserDao.findById
        .mockResolvedValueOnce({
          _id: adminId,
          isAdmin: true,
        })
        .mockResolvedValueOnce({
          _id: adminId,
          username: 'admin',
          isAdmin: true,
        });

      const req = {
        params: {
          userId: adminId,
        },
        session: {
          userId: adminId,
        },
        body: {
          isBanned: true,
        },
      };

      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(UserDao.setBanStatus).not.toHaveBeenCalled();
      expect(UserDao.setAdminStatus).not.toHaveBeenCalled();
    });

    test('prevents admin from removing their own admin role', async () => {
      UserDao.findById
        .mockResolvedValueOnce({
          _id: adminId,
          isAdmin: true,
        })
        .mockResolvedValueOnce({
          _id: adminId,
          username: 'admin',
          isAdmin: true,
        });

      const req = {
        params: {
          userId: adminId,
        },
        session: {
          userId: adminId,
        },
        body: {
          isAdmin: false,
        },
      };

      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(UserDao.setAdminStatus).not.toHaveBeenCalled();
    });

    test('returns 500 when updating admin status fails', async () => {
      UserDao.findById
        .mockResolvedValueOnce({
          _id: adminId,
          isAdmin: true,
        })
        .mockResolvedValueOnce({
          _id: targetId,
          username: 'alice',
        });

      UserDao.setAdminStatus.mockRejectedValue(
        new Error('Database update failed')
      );

      const req = adminRequest({
        isAdmin: true,
      });

      const res = createResponse();

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await controller.adminUpdateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to update user.',
      });

      consoleSpy.mockRestore();
    });

    test('rejects an empty update request', async () => {
      UserDao.findById.mockResolvedValue({
        _id: adminId,
        isAdmin: true,
      });

      const req = adminRequest({});
      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Provide a valid admin or ban status update.',
      });

      expect(UserDao.setAdminStatus).not.toHaveBeenCalled();
      expect(UserDao.setBanStatus).not.toHaveBeenCalled();
    });

    test('rejects non-boolean ban values', async () => {
      UserDao.findById.mockResolvedValue({
        _id: adminId,
        isAdmin: true,
      });

      const req = adminRequest({
        isBanned: 'true',
      });

      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(UserDao.setBanStatus).not.toHaveBeenCalled();
    });

    test('rejects unsupported properties', async () => {
      UserDao.findById.mockResolvedValue({
        _id: adminId,
        isAdmin: true,
      });

      const req = adminRequest({
        isAdmin: true,
        username: 'hacker',
      });

      const res = createResponse();

      await controller.adminUpdateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(UserDao.setAdminStatus).not.toHaveBeenCalled();
      expect(UserDao.setBanStatus).not.toHaveBeenCalled();
    });
  });

  describe('getAdminUserDetails', () => {
    test('returns the requested profile with current statistics', async () => {
      const profile = {
        _id: 'player456',
        username: 'alice',
        email: 'alice@example.com',
        friendCount: 4,
        avatar: '',
        userType: 'registered',
        chipBalance: 1500,
        isAdmin: false,
        stats: {
          wins: 10,
          losses: 5,
          gamesPlayed: 15,
          totalChipsWon: 5000,
          netWinnings: 2500,
        },
      };

      UserDao.findById.mockResolvedValue({
        _id: 'admin123',
        isAdmin: true,
      });

      UserDao.getProfile.mockResolvedValue(profile);

      const req = {
        params: {
          userId: 'player456',
        },
        session: {
          userId: 'admin123',
        },
      };

      const res = createResponse();

      await controller.getAdminUserDetails(req, res);

      expect(UserDao.getProfile).toHaveBeenCalledWith(
        'player456'
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(profile);
    });

    test('returns 403 for non-admin profile access', async () => {
      UserDao.findById.mockResolvedValue({
        _id: 'player123',
        isAdmin: false,
      });

      const req = {
        params: {
          userId: 'player456',
        },
        session: {
          userId: 'player123',
        },
      };

      const res = createResponse();

      await controller.getAdminUserDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(UserDao.getProfile).not.toHaveBeenCalled();
    });

    test('returns 404 if profile does not exist', async () => {
      UserDao.findById.mockResolvedValue({
        _id: 'admin123',
        isAdmin: true,
      });

      UserDao.getProfile.mockResolvedValue(null);

      const req = {
        params: {
          userId: 'missing123',
        },
        session: {
          userId: 'admin123',
        },
      };

      const res = createResponse();

      await controller.getAdminUserDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found.',
      });
    });
  });

  describe('getAdminTable', () => {
    test('returns private table and game details to an admin', async () => {
      const table = {
        _id: 'table123',
        Name: 'Private Table',
        Capacity: 6,
        UserIds: ['player456'],
        BotCount: 1,
        IsPublic: false,
        Level: 'High',
        Status: 'In Progress',
        CurrentGameID: 'game789',
        PlayerStacks: [
          {
            PlayerId: 'player456',
            Chips: 2500,
          },
        ],
      };

      const game = {
        _id: 'game789',
        Status: 'In Progress',
        Street: 3,
        Pot: 500,
        Ante: 50,
        BringIn: 100,
        CurrentBet: 200,
        CurrentTurnPlayerId: 'player456',
        WinnerIds: [],
        CompletedAt: null,
        Players: [
          {
            PlayerId: 'player456',
            Cards: [
              { rank: 'A', suit: 'Spades', faceUp: false },
              { rank: 'K', suit: 'Hearts', faceUp: false },
            ],
            HasFolded: false,
            TotalContribution: 200,
            RoundContribution: 100,
            HasActed: true,
          },
        ],
      };

      UserDao.findById.mockReset();

      UserDao.findById.mockImplementation((id) => {
        if (id === 'admin123') {
          return Promise.resolve({
            _id: 'admin123',
            isAdmin: true,
          });
        }
        if (id === 'player456') {
          return {
            select: jest.fn().mockResolvedValue({
              _id: 'player456',
              username: 'alice',
            }),
          };
        }

        return Promise.resolve(null);
      });

      TableDao.findById.mockResolvedValue(table);
      GameDao.findById.mockResolvedValue(game);

      const req = {
        params: {
          tableId: 'table123',
        },
        session: {
          userId: 'admin123',
        },
      };

      const res = createResponse();

      await controller.getAdminTable(req, res);

      expect(TableDao.findById).toHaveBeenCalledWith(
        'table123'
      );

      expect(GameDao.findById).toHaveBeenCalledWith(
        'game789'
      );

      expect(res.status).toHaveBeenCalledWith(200);

      const payload = res.json.mock.calls[0][0];

      expect(payload.table).toEqual(
        expect.objectContaining({
          name: 'Private Table',
          isPublic: false,
          status: 'In Progress',
        })
      );

      expect(payload.table.players[0]).toEqual(
        expect.objectContaining({
          username: 'alice',
          chips: 2500,
          hasFolded: false,
          totalContribution: 200,
        })
      );

      expect(payload.game).toEqual(
        expect.objectContaining({
          pot: 500,
          currentBet: 200,
          currentTurnUsername: 'alice',
        })
      );
    });

    test('returns 403 to a non-admin attempting table observation', async () => {
      UserDao.findById.mockResolvedValue({
        _id: 'player123',
        isAdmin: false,
      });

      const req = {
        params: {
          tableId: 'table123',
        },
        session: {
          userId: 'player123',
        },
      };

      const res = createResponse();

      await controller.getAdminTable(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(TableDao.findById).not.toHaveBeenCalled();
      expect(GameDao.findById).not.toHaveBeenCalled();
    });

    test('returns 404 if table does not exist', async () => {
      UserDao.findById.mockResolvedValue({
        _id: 'admin123',
        isAdmin: true,
      });

      TableDao.findById.mockResolvedValue(null);

      const req = {
        params: {
          tableId: 'missing123',
        },
        session: {
          userId: 'admin123',
        },
      };

      const res = createResponse();

      await controller.getAdminTable(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Table not found.',
      });
    });
  });
});