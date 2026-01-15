import { jest } from '@jest/globals';

describe('Unit Test Example', () => {
    test('should pass a simple truthy check', () => {
        expect(true).toBe(true);
    });

    test('should mock a function correctly', () => {
        const mockFn = jest.fn((x) => x + 42);
        expect(mockFn(0)).toBe(42);
        expect(mockFn).toHaveBeenCalledWith(0);
    });
});
