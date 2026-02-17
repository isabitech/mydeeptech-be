

// CORS Configuration - Development and Production
const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://mydeeptech.ng',
        // Frontend URLs
        'https://www.mydeeptech.ng',
        'https://mydeeptech.onrender.com',
        'https://mydeeptech-frontend.onrender.com',

        // Backend URLs
        'https://mydeeptech-be.onrender.com',
        'https://mydeeptech-be-lmrk.onrender.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'token']
};

module.exports = {
  corsOptions,
};