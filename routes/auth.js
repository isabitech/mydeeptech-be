const express = require('express');
const { signup, login, getAllUsers, getUsers } = require('../controller/user.js'); // Ensure this path is correct
const router = express.Router()

router.post('/signup', signup);
router.post('/login', login);
router.get('/getAllUsers', getAllUsers);
router.get('/getUsers/:role', getUsers)

module.exports = router;
