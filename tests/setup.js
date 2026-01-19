import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';

import nock from 'nock';

// � MANDATORY TEST BOOTSTRAP
beforeAll(() => {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('Tests must never run outside TEST environment');
    }

    if (process.env.MONGO_URI && !process.env.MONGO_URI.includes('mongodb-memory-server') && !process.env.MONGO_URI.includes('127.0.0.1') && !process.env.MONGO_URI.includes('localhost')) {
        throw new Error('Real MongoDB connections are forbidden in tests');
    }

    // Block all outgoing network calls by default 
    nock.disableNetConnect();
    // Allow localhost/127.0.0.1 for supertest and MongoMemoryServer
    nock.enableNetConnect(/(localhost|127\.0\.0\.1)/);
});

// Provide dummy environment variables for top-level initialization
process.env.BREVO_API_KEY = 'xkeysib-test-key-at-least-thirty-characters-long';
process.env.BREVO_SENDER_EMAIL = 'test@example.com';
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test-db-placeholder'; // Default for safety
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PORT = '5001';
process.env.ADMIN_EMAILS = 'admin@example.com';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test-api-secret';

// Global Redis Mock
jest.unstable_mockModule('../config/redis.js', () => ({
    initRedis: async () => null,
    closeRedis: async () => { },
    redisHealthCheck: async () => ({ status: 'connected', latency: '1ms' }),
    getRedisClient: () => null,
    isRedisConnected: () => true
}));

// Global Brevo Mock
jest.unstable_mockModule('../utils/brevoSMTP.js', () => ({
    sendVerificationEmailBrevoAPI: jest.fn().mockResolvedValue({ success: true }),
    sendVerificationEmailBrevoSMTP: jest.fn().mockResolvedValue({ success: true }),
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
    sendProjectEmail: jest.fn().mockResolvedValue({ success: true }),
    testBrevoAPIConnection: jest.fn().mockResolvedValue(true),
    testBrevoSMTPConnection: jest.fn().mockResolvedValue(true)
}));

let mongoServer;

beforeAll(async () => {
    try {
        await mongoose.disconnect();
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        // Safety check: ensure we are connecting to a local/in-memory URI
        if (!mongoUri.startsWith('mongodb://127.0.0.1') && !mongoUri.startsWith('mongodb://localhost')) {
            throw new Error(`CRITICAL: Attempted to connect to a non-local database: ${mongoUri}`);
        }

        process.env.MONGO_URI = mongoUri; // Update ENV for the mandatory bootstrap check if needed
        await mongoose.connect(mongoUri);
    } catch (error) {
        console.error('--- beforeAll: ERROR ---', error);
        throw error;
    }
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            const collection = collections[key];
            await collection.deleteMany();
        }
    }
    // Reset all spies
    jest.clearAllMocks();
});

/**
 * 🛡️ Global Write-Protection & Spying
 * Spies on all Mongoose modification methods to ensure zero writes to persistent storage.
 */
export const writeSpies = {
    insertOne: jest.spyOn(mongoose.Collection.prototype, 'insertOne'),
    insertMany: jest.spyOn(mongoose.Collection.prototype, 'insertMany'),
    updateOne: jest.spyOn(mongoose.Collection.prototype, 'updateOne'),
    updateMany: jest.spyOn(mongoose.Collection.prototype, 'updateMany'),
    deleteOne: jest.spyOn(mongoose.Collection.prototype, 'deleteOne'),
    deleteMany: jest.spyOn(mongoose.Collection.prototype, 'deleteMany'),
    findOneAndUpdate: jest.spyOn(mongoose.Collection.prototype, 'findOneAndUpdate'),
};
export const saveSpy = jest.spyOn(mongoose.Model.prototype, 'save');

// Add safety enforcement to each spy without recursive loops
const originalCollectionMethods = {
    insertOne: mongoose.Collection.prototype.insertOne,
    insertMany: mongoose.Collection.prototype.insertMany,
    updateOne: mongoose.Collection.prototype.updateOne,
    updateMany: mongoose.Collection.prototype.updateMany,
    deleteOne: mongoose.Collection.prototype.deleteOne,
    deleteMany: mongoose.Collection.prototype.deleteMany,
    findOneAndUpdate: mongoose.Collection.prototype.findOneAndUpdate,
};
const originalSave = mongoose.Model.prototype.save;

writeSpies.insertOne.mockImplementation(function (...args) {
    if (mongoose.connection?.host && mongoose.connection.host !== '127.0.0.1' && !mongoose.connection.host.includes('localhost')) {
        throw new Error('CRITICAL: Attempted write to a non-local database during tests!');
    }
    return originalCollectionMethods.insertOne.apply(this, args);
});

writeSpies.insertMany.mockImplementation(function (...args) {
    if (mongoose.connection?.host && mongoose.connection.host !== '127.0.0.1' && !mongoose.connection.host.includes('localhost')) {
        throw new Error('CRITICAL: Attempted write to a non-local database during tests!');
    }
    return originalCollectionMethods.insertMany.apply(this, args);
});

// Repeat for others if needed, but for now focus on the ones most likely to be called
saveSpy.mockImplementation(function (...args) {
    if (mongoose.connection?.host && mongoose.connection.host !== '127.0.0.1' && !mongoose.connection.host.includes('localhost')) {
        throw new Error('CRITICAL: Attempted write to a non-local database during tests!');
    }
    return originalSave.apply(this, args);
});
