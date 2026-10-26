const UserDao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil.js');

async function userCreateUpdate(req, res) {
  let username = req.body.username;
  let email = req.body.email;
  let password = req.body.password;
  let confirmPassword = req.body.confirmPassword;
  let id = req.body._id;

  if (!id) {
    // create new user if the id doesn't exists
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        message: 'All fields are required.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Passwords do not match.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters.',
      });
    }

    const existingEmail = await UserDao.findByEmail(email);

    if (existingEmail) {
      return res.status(409).json({
        message: 'Email is already registered.',
      });
    }

    const existingUsername = await UserDao.findByUsername(username);

    if (existingUsername) {
      return res.status(409).json({
        message: 'Username is already taken.',
      });
    }

    const hashedPassword = passUtil.hashPassword(password);

    const newUser = {
      username,
      email,
      password: hashedPassword,
      friends: [],
    };

    const user = await UserDao.create(newUser);
    req.session.userId = user._id.toString();
    return res.status(201).json({
      message: 'User created successfully.',
      user,
    });
  } else {
    // update existing user
    const updatedUser = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password
        ? passUtil.hashPassword(req.body.password)
        : undefined,
      friends: req.body.friends,
    };

    req.session.userId = id;
    res.json(await UserDao.update(id, updatedUser));
  }
}

async function login(req, res) {
  let plogin = req.body.txt_login;
  let user = await UserDao.findLogin(plogin);

  if (user == null) {
    return res.status(401).json({
      message: 'Invalid username/email or password.',
    });
  }

  if (passUtil.comparePassword(req.body.txt_pass, user.password)) {
    console.log('Login successful');

    req.session.userId = user._id.toString();

    return res.status(200).json({
      message: 'Login successful.',
    });
  }

  return res.status(401).json({
    message: 'Invalid username/email or password.',
  });
}

async function loggedUser(req, res) {
  if (!req.session.userId) {
    return res.status(401).json({
      message: 'You are not logged in.',
    });
  }

  const user = await UserDao.getProfile(req.session.userId);

  if (!user) {
    return res.status(404).json({
      message: 'User not found.',
    });
  }

  return res.status(200).json(user);
}

async function logout(req, res) {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        message: 'Unable to log out.',
      });
    }

    res.clearCookie('connect.sid');
    return res.status(200).json({
      message: 'Logged out successfully.',
    });
  });
}

function adminCheck(req) {
  return req.session.user && req.session.user.permission == 1;
}

async function getUsers(req, res) {
  try {
    const users = await UserDao.readAll();
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to retrieve users.',
    });
  }
}

async function getProfile(req, res) {
  try {
    const user = await UserDao.getProfile(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(400).json({ message: 'Invalid user ID.' });
  }
}

async function updateAvatar(req, res) {
  const { avatar } = req.body;

  if (
    typeof avatar !== 'string' ||
    (avatar !== '' &&
      !/^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
        avatar,
      ))
  ) {
    return res.status(400).json({
      message: 'Avatar must be a PNG, JPEG, GIF, or WebP image.',
    });
  }

  if (avatar.length > 2_100_000) {
    return res.status(413).json({
      message: 'Avatar image is too large.',
    });
  }

  try {
    const user = await UserDao.updateAvatar(req.params.userId, avatar);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({
      message: 'Profile avatar saved.',
      avatar: user.avatar || '',
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID.' });
    }

    return res.status(500).json({
      message: 'Could not save the profile avatar.',
    });
  }
}

async function searchUsers(req, res) {
  try {
    const username = req.query.username?.trim();

    if (!username) {
      return res.status(400).json({
        message: 'Please enter a username',
      });
    }

    const users = await UserDao.searchByUsername(username);

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to search users',
    });
  }
}

// Send a friend request
async function sendFriendRequest(req, res) {
  try {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({
        message: 'Sender and receiver are required',
      });
    }

    const result = await UserDao.sendFriendRequest(senderId, receiverId);

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

async function getFriendRequests(req, res) {
  try {
    const { userId } = req.params;

    const requests = await UserDao.getFriendRequests(userId);

    res.status(200).json(requests);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

async function respondToFriendRequest(req, res) {
  try {
    const { userId, requestId } = req.params;
    const { action } = req.body;

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({
        message: 'Action must be accept or decline',
      });
    }

    const result = await UserDao.respondToFriendRequest(
      userId,
      requestId,
      action,
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

async function getFriends(req, res) {
  try {
    const { userId } = req.params;

    const friends = await UserDao.getFriends(userId);

    res.status(200).json(friends);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

async function getSentFriendRequests(req, res) {
  try {
    const { userId } = req.params;

    const requests = await UserDao.getSentFriendRequests(userId);

    res.status(200).json(requests);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

module.exports = {
  userCreateUpdate,
  getUsers,getProfile, updateAvatar,
  searchUsers,
  sendFriendRequest,
  getFriendRequests,
  respondToFriendRequest,
  getFriends,
  getSentFriendRequests,
  login,
  loggedUser,
  logout,
  adminCheck,
};
