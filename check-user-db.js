const mongoose = require('mongoose');
require('dotenv').config();

async function checkUserInDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const DTUser = require('./models/dtUser.model');
        
        const userId = '68df5000a2d6ed7b2d2ff57a';
        const email = 'damilolamiraclek@gmail.com';
        
        console.log(`🔍 Checking user in database...`);
        
        // Check by ID
        const userById = await DTUser.findById(userId);
        console.log('User by ID:', {
            found: !!userById,
            email: userById?.email,
            annotatorStatus: userById?.annotatorStatus,
            isEmailVerified: userById?.isEmailVerified,
            hasSetPassword: userById?.hasSetPassword
        });
        
        // Check by email
        const userByEmail = await DTUser.findOne({ email });
        console.log('User by email:', {
            found: !!userByEmail,
            id: userByEmail?._id.toString(),
            annotatorStatus: userByEmail?.annotatorStatus,
            isEmailVerified: userByEmail?.isEmailVerified,
            hasSetPassword: userByEmail?.hasSetPassword
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    }
}

checkUserInDB();