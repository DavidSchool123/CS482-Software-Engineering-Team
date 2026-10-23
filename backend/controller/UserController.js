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

    res.json(await UserDao.update(id, updatedUser));
  }
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

module.exports = { userCreateUpdate, getUsers };
