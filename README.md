# My Deep Tech Backend

Professional Node.js backend for the My Deep Tech platform, built with Express, Mongoose, and Socket.io.

## Project Purpose
My Deep Tech is a platform for data annotation, multimedia assessments, and chat support. This backend handles user authentication, project management, assessment processing, and real-time communication.

## Architecture & Folder Structure
The project follows a modular architecture based on the **Controller-Service-Repository** pattern:

- `controller/`: Request handling and response orchestration.
- `services/`: Core business logic and external integrations.
- `repositories/`: Data access layer (Mongoose models interaction).
- `models/`: Mongoose schemas and database structure.
- `routes/`: Express route definitions.
- `middleware/`: Custom middleware (auth, error handling, rate limiting).
- `utils/`: Helper functions and shared utilities.
- `config/`: Configuration files (Redis, Swagger, Database).
- `scripts/`: Maintenance and seeding scripts.
- `tests/`: Automated test suite (Jest and Supertest).

## Setup & Environment Configuration
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/isabitech/mydeeptech-be.git
    cd mydeeptech-be
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    Create a `.env` file based on `.env.example`:
    ```env
    MONGO_URI=your_mongodb_uri
    JWT_SECRET=your_jwt_secret
    REDIS_URL=your_redis_url
    PORT=5000
    ... etc
    ```

## How to Run
### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## Running Tests
The project uses **Jest** with an in-memory MongoDB for safe testing.

### Run all tests
```bash
npm test
```

### View coverage
```bash
npm test -- --coverage
```

## API Documentation
Swagger documentation is available at `/api-docs` when the server is running.
Example: `http://localhost:5000/api-docs`
