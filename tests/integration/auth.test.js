import request from 'supertest';
import { app, server } from '../../app.js';
import mongoose from 'mongoose';
import DTUser from '../../models/dtUser.model.js';
import bcrypt from 'bcrypt';
import { closeSocketIO } from '../../utils/chatSocketService.js';

describe('Integration Test: Authentication', () => {
    let testUser;

    beforeAll(async () => {
        // Create a test user directly in the DB
        const hashedPassword = await bcrypt.hash('Password123!', 10);
        testUser = await DTUser.create({
            fullName: 'Test User',
            email: 'test@example.com',
            password: hashedPassword,
            phone: '1234567890',
            isEmailVerified: true,
            hasSetPassword: true,
            annotatorStatus: 'approved',
            consent: true
        });
    });

    afterAll(async () => {
        await DTUser.deleteMany({});
        closeSocketIO();
        await new Promise(resolve => server.close(resolve));
    });

    test('POST /api/auth/dtuser/login should return 200 and token', async () => {
        const response = await request(app)
            .post('/api/auth/dtuser/login')
            .send({
                email: 'test@example.com',
                password: 'Password123!'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
        expect(response.body.data.user.email).toBe('test@example.com');
    });

    test('POST /api/auth/dtuser/login with invalid credentials should return 401', async () => {
        const response = await request(app)
            .post('/api/auth/dtuser/login')
            .send({
                email: 'test@example.com',
                password: 'WrongPassword'
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
    });
});
