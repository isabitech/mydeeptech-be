import { jest } from '@jest/globals';
import mongoose from 'mongoose';

describe('Simple Test with Setup', () => {
    test('should have a working mongoose connection', async () => {
        expect(mongoose.connection.readyState).toBe(1);
        expect(mongoose.connection.host).toBe('127.0.0.1');
    });
});
