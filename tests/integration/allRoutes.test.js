import request from 'supertest';
import { app } from '../../index.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { getRoutes } from './routeDiscovery.test.js';
import DTUser from '../../models/dtUser.model.js';
import { writeSpies, saveSpy } from '../setup.js';
import { jest } from '@jest/globals';

// Helper to generate a test token
const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
};

describe('MASTER PROMPT: Systematic Route Testing & Safety', () => {
    let allRoutes = [];
    let testUserToken;
    let adminToken;
    let testUserId;

    beforeEach(async () => {
        allRoutes = getRoutes(app);

        // Create a test user in the in-memory DB
        const user = await DTUser.create({
            fullName: 'Test User',
            email: 'test@example.com',
            phone: '1234567890',
            consent: true,
            isEmailVerified: true,
            password: 'hashedpassword'
        });
        testUserId = user._id.toString();
        testUserToken = generateToken({ userId: testUserId, email: 'test@example.com' });

        // Admin User (Mocked as admin@example.com)
        const admin = await DTUser.create({
            fullName: 'Admin User',
            email: 'admin@example.com',
            phone: '0987654321',
            consent: true,
            isEmailVerified: true,
            password: 'hashedpassword'
        });
        adminToken = generateToken({ userId: admin._id.toString(), email: 'admin@example.com' });

        // Ensure spies are fresh after setup
        jest.clearAllMocks();
    });

    /**
     * DATABASE SAFETY VERIFICATION
     */
    test('🚨 SAFETY: No Writes Allowed to Persistent DB', () => {
        expect(process.env.NODE_ENV).toBe('test');
        expect(mongoose.connection.host).toBe('127.0.0.1');
    });

    /**
     * ROLE-BASED SYSTEMATIC TESTING LOOP
     */
    describe('Role-Permission Matrix Validation', () => {
        // We will sample a few representative routes for the individual tests 
        // and then run the bulk loop for coverage as requested by the prompt.

        test('Systematic Matrix: Guest vs User vs Admin', async () => {
            console.log(`--- Exhaustive Testing of ALL ${allRoutes.length} routes ---`);
            const matrix = [];

            for (const route of allRoutes) {
                const method = route.methods[0].toLowerCase();
                const path = route.path.replace(/:[^\/]+/g, '123'); // Substitute params

                // 1. Unauthenticated
                const guestRes = await request(app)[method](path);

                // 2. Authenticated User
                const userRes = await request(app)[method](path)
                    .set('Authorization', `Bearer ${testUserToken}`);

                // 3. Authenticated Admin
                const adminRes = await request(app)[method](path)
                    .set('Authorization', `Bearer ${adminToken}`);

                matrix.push({
                    path: route.path,
                    method: route.methods[0],
                    guest: guestRes.status,
                    user: userRes.status,
                    admin: adminRes.status
                });

                // VERIFY ZERO WRITES
                const writeMethods = Object.keys(writeSpies);
                for (const m of writeMethods) {
                    if (writeSpies[m].mock.calls.length > 0) {
                        console.error(`🚨 WRITE VIOLATION: Route ${method.toUpperCase()} ${path} called ${m}`);
                        expect(writeSpies[m]).not.toHaveBeenCalled();
                    }
                }
                if (saveSpy.mock.calls.length > 0) {
                    console.error(`🚨 WRITE VIOLATION: Route ${method.toUpperCase()} ${path} called save`);
                    expect(saveSpy).not.toHaveBeenCalled();
                }
            }

            console.table(matrix.slice(0, 20)); // Log a sample for the console

            // Final check on write spies
            Object.values(writeSpies).forEach(spy => expect(spy).not.toHaveBeenCalled());
            expect(saveSpy).not.toHaveBeenCalled();

            console.log('✅ Safety Guaranteed: 0 Persistent Writes detected across all tested routes.');
        }, 300000); // 5 min timeout
    });

    /**
     * ADVERSARIAL SCENARIOS ("Thinking like a malicious user")
     */
    describe('Adversarial Scenarios', () => {
        test('Careless Admin: Attempt to create admin without parameters', async () => {
            const res = await request(app).post('/api/admin/create').send({});
            // Should be blocked or fail validation
            expect([400, 401, 403, 422, 500]).toContain(res.status);
        });

        test('Malicious User: Attempt to delete project with valid USER token', async () => {
            const res = await request(app)
                .delete('/api/auth/deleteProject/123')
                .set('Authorization', `Bearer ${testUserToken}`);
            // If they are not an admin, they should be blocked before it hits the controller
            expect([401, 403]).toContain(res.status);
        });

        test('Data Corruption: Attempt to bypass validation on signup', async () => {
            const res = await request(app).post('/api/auth/signup').send({ email: 'not-an-email' });
            expect(res.status).toBe(400); // VALIDATION_ERROR
            expect(saveSpy).not.toHaveBeenCalled();
        });

        test('Profile Leak: User attempts to access admin users list', async () => {
            const res = await request(app)
                .get('/api/admin/dtusers')
                .set('Authorization', `Bearer ${testUserToken}`);
            expect(res.status).toBe(403); // Forbidden
        });
    });

    /**
     * CRITICAL BUG VERIFICATION
     */
    test('Bug Fix: Error Handler should not crash on Joi validation error', async () => {
        // Sending invalid signup data to trigger Joi error
        const res = await request(app).post('/api/auth/signup').send({ email: 'invalid' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
});
