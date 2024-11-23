const express = require('express');
const { signup, login } = require('../controller/user.js'); // Ensure this path is correct
const router = express.Router()

router.post('/signup', signup);
router.get('/login', login);

module.exports = router;
