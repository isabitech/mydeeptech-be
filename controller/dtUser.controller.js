const DTUser = require("../models/dtUser.model");

// Create DT User
const createDTUser = async (req, res) => {
    try {
        const { fullName, phone, email, domains, socialsFollowed, consent } = req.body;

        // Basic validation (can later replace with Joi like taskSchema)
        if (!fullName || !phone || !email || consent === undefined) {
            return res.status(400).json({ message: "Required fields are missing" });
        }

        const newUser = new DTUser({
            fullName,
            phone,
            email,
            domains,
            socialsFollowed,
            consent,
        });

        await newUser.save();

        res.status(200).send({
            responseCode: "90",
            responseMessage: "DT User created successfully",
            data: newUser,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Internal server error" });
    }
};

// Get single DT User
const getDTUser = async (req, res) => {
    try {
        const user = await DTUser.findById(req.params.id);
        if (!user) {
            return res.status(404).send("DT User not found");
        }

        res.status(200).send({
            responseCode: "90",
            responseMessage: "DT User found successfully",
            data: user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Internal server error" });
    }
};

// Get all DT Users
const getAllDTUsers = async (req, res) => {
    try {
        const users = await DTUser.find();
        if (!users || users.length === 0) {
            return res.status(404).send("No DT Users found");
        }

        res.status(200).send({
            responseCode: "90",
            responseMessage: "All DT Users fetched successfully",
            data: users,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Internal server error" });
    }
};

module.exports = { createDTUser, getDTUser, getAllDTUsers };
