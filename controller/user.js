const User = require('../models/user');
const { signupSchema, loginSchema } = require('../utils/authValidator');
const bcrypt = require('bcrypt');

// Signup controller
const signup = async (req, res) => {
    try {
        const { error } = signupSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { firstname, lastname, username, email, password, phone } = req.body;

        const existingUser = await User.findOne({email: req.body.email})
        if (existingUser) return res.status(400).json({ message: 'Email already in use' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ firstname, lastname, username, email, password: hashedPassword, phone });
        await newUser.save();

        res.status(200).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error during signup:', error); // Log the error
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Login controller
const login = async (req, res) => {
    try {
        const { error } = loginSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: 'Invalid credentials' });

        res.status(200).json({ message: 'Login successful', user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
const getUser = async (req, res) => {
    const user = await User.find({});
    try {
        if (!user) {
            return res.status(400).send({
              responseCode: "90",
              responseMessage: "No user found",
              data: null,
            });
          }
    
          res.status(200).send({
            responseCode: "90",
            responseMessage: "User retrieved successfully",
            data: user
          });
        } catch (error) {
          res.status(500).send({
            responseCode: "90",
            responseMessage: "Internal server error",
            data: error.message,
          });
    
          console.log(error);
        }
    };

module.exports = { signup, login, getUser };
