import { app } from '../../app.js';
import mongoose from 'mongoose';

describe('Integration Test: Health Check', () => {
    test('GET /health should return 200 and ok status', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.services.mongodb.status).toBe('connected');
        expect(response.body.services.redis.status).toBe('connected');

        // Safety check verification
        expect(mongoose.connection.host).toBe('127.0.0.1');
    });

    test('GET / should return welcome message', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.text).toBe('Welcome to My Deep Tech');
    });
});
