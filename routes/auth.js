const express = require('express');
const { signup, login, getUser } = require('../controller/user.js'); // Ensure this path is correct
const router = express.Router()

router.post('/signup', signup);
router.post('/login', login);
router.get('/getUser', getUser)

module.exports = router;
