# 🚀 Socket.IO Cloud Deployment Guide

## Overview
Deploying Socket.IO applications requires special consideration for WebSocket connections, sticky sessions, and scaling. Here's a comprehensive guide for various cloud platforms.

## 🏗️ Cloud Platform Options

### 1. Railway (Recommended - Easiest)

Railway is excellent for Node.js applications with WebSocket support.

#### Setup Steps:

1. **Install Railway CLI**:
```bash
npm install -g @railway/cli
railway login
```

2. **Initialize Railway Project**:
```bash
railway init
railway link
```

3. **Add Environment Variables**:
```bash
railway variables set NODE_ENV=production
railway variables set PORT=5000
railway variables set MONGO_URI="your_mongo_connection_string"
railway variables set JWT_SECRET="your_jwt_secret"
railway variables set BREVO_API_KEY="your_brevo_key"
railway variables set SMTP_LOGIN="your_smtp_login"
railway variables set SMTP_KEY="your_smtp_password"
railway variables set FRONTEND_URL="https://your-frontend-domain.com"
```

4. **Create Railway Configuration**:
```json
// railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

5. **Deploy**:
```bash
railway deploy
```

#### Railway Benefits:
- ✅ Automatic WebSocket support
- ✅ No configuration needed for sticky sessions
- ✅ Automatic HTTPS/SSL
- ✅ Easy environment variable management
- ✅ Built-in monitoring and logs

---

### 2. Render (Great Alternative)

#### Setup Steps:

1. **Create `render.yaml`**:
```yaml
# render.yaml
services:
  - type: web
    name: mydeeptech-api
    env: node
    buildCommand: npm install
    startCommand: node index.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5000
      - key: MONGO_URI
        fromDatabase:
          name: mydeeptech-mongodb
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: BREVO_API_KEY
        sync: false
      - key: SMTP_LOGIN
        sync: false
      - key: SMTP_KEY
        sync: false
      - key: FRONTEND_URL
        value: https://your-frontend-domain.com

databases:
  - name: mydeeptech-mongodb
    databaseName: mydeeptech
    user: admin
```

2. **Deploy via Git**:
- Connect your GitHub repository
- Render auto-deploys on push to main branch

#### Render Benefits:
- ✅ WebSocket support included
- ✅ Free tier available
- ✅ Automatic SSL certificates
- ✅ MongoDB hosting included
- ✅ Git-based deployments

---

### 3. AWS (Production Scale)

#### Using AWS Elastic Beanstalk:

1. **Create `.ebextensions/websockets.config`**:
```yaml
# .ebextensions/websockets.config
option_settings:
  aws:elasticbeanstalk:environment:proxy:
    ProxyServer: nginx
  aws:elasticbeanstalk:environment:proxy:staticfiles:
    /static: public
    
  # Enable sticky sessions for WebSockets
  aws:elbv2:loadbalancer:
    IdleTimeout: 4000
    
  # Environment variables
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
```

2. **Create `Procfile`**:
```
web: node index.js
```

3. **Update package.json**:
```json
{
  "scripts": {
    "start": "node index.js",
    "deploy": "eb deploy"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### AWS Benefits:
- ✅ Enterprise-grade scaling
- ✅ Load balancer with sticky sessions
- ✅ Auto-scaling groups
- ✅ Detailed monitoring

---

### 4. Heroku (Simple but Limited)

⚠️ **Note**: Heroku has limitations with WebSockets on free tier.

1. **Create `Procfile`**:
```
web: node index.js
```

2. **Set Environment Variables**:
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET="your_secret"
heroku config:set MONGO_URI="your_mongo_uri"
# ... other variables
```

3. **Configure WebSocket Support**:
```bash
heroku features:enable http-session-affinity
```

#### Heroku Limitations:
- ❌ WebSocket timeouts on free tier
- ❌ Limited concurrent connections
- ✅ Easy deployment process

---

## 🔧 Code Modifications for Cloud Deployment

### 1. Update Socket.IO CORS Configuration

```javascript
// utils/chatSocketService.js
const initializeSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://your-frontend-domain.com', // Add your production frontend
        'https://www.your-frontend-domain.com',
        process.env.FRONTEND_URL
      ],
      credentials: true,
      methods: ['GET', 'POST']
    },
    // Important for cloud deployment
    transports: ['websocket', 'polling'],
    allowEIO3: true, // Allow Engine.IO v3 clients
    pingTimeout: 60000, // Increase for cloud environments
    pingInterval: 25000
  });
  // ... rest of your code
};
```

### 2. Update Express CORS

```javascript
// index.js
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173', 
    'https://your-frontend-domain.com',
    'https://www.your-frontend-domain.com',
    process.env.FRONTEND_URL
  ].filter(Boolean), // Remove undefined values
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'token']
};
```

### 3. Add Health Check for Load Balancers

```javascript
// index.js - Add this before your existing routes
app.get("/health", async (req, res) => {
  try {
    const redisStatus = await redisHealthCheck();
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: {
          status: mongoStatus,
          connection: mongoose.connection.host || 'unknown'
        },
        redis: redisStatus,
        socketio: {
          status: 'active',
          connections: io ? io.sockets.sockets.size : 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### 4. Environment Configuration

```javascript
// config/environment.js (Create this file)
const config = {
  development: {
    port: process.env.PORT || 5000,
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/mydeeptech',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  },
  production: {
    port: process.env.PORT || 8080,
    mongoUri: process.env.MONGO_URI,
    jwtSecret: process.env.JWT_SECRET,
    frontendUrl: process.env.FRONTEND_URL
  }
};

const environment = process.env.NODE_ENV || 'development';
module.exports = config[environment];
```

---

## 🌐 Frontend Configuration for Production

### Update Frontend Socket.IO Connection

```typescript
// services/ChatSocketService.ts
class ChatSocketService {
  connect(token: string, userType: 'user' | 'admin' = 'user'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Use environment-based URL
        const serverUrl = import.meta.env.PROD 
          ? import.meta.env.VITE_API_URL || 'https://your-api-domain.com'
          : 'http://localhost:5000';
        
        console.log('🔗 Connecting to Socket.IO server:', serverUrl);

        this.socket = io(serverUrl, {
          auth: { token, userType },
          transports: ['websocket', 'polling'], // Important: Include both
          timeout: 20000,
          forceNew: true,
          autoConnect: false,
          // Important for cloud deployment
          upgrade: true,
          rememberUpgrade: true
        });

        // ... rest of your connection logic
      }
    });
  }
}
```

### Environment Variables for Frontend

```env
# .env.production (Frontend)
VITE_API_URL=https://your-api-domain.railway.app
VITE_WS_URL=https://your-api-domain.railway.app

# .env.development (Frontend)
VITE_API_URL=http://localhost:5000
VITE_WS_URL=http://localhost:5000
```

---

## 🔒 SSL/HTTPS Configuration

### For Custom Domains (Railway/Render handle this automatically):

```javascript
// For manual SSL setup (advanced)
const https = require('https');
const fs = require('fs');

if (process.env.NODE_ENV === 'production' && process.env.SSL_KEY) {
  const options = {
    key: fs.readFileSync(process.env.SSL_KEY),
    cert: fs.readFileSync(process.env.SSL_CERT)
  };
  
  const server = https.createServer(options, app);
  initializeSocketIO(server);
} else {
  const server = createServer(app);
  initializeSocketIO(server);
}
```

---

## 📊 Scaling Considerations

### 1. Redis Adapter for Multiple Instances

```bash
npm install @socket.io/redis-adapter redis
```

```javascript
// utils/chatSocketService.js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const initializeSocketIO = (server) => {
  io = new Server(server, { /* your options */ });

  // For scaling across multiple instances
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Redis adapter configured for Socket.IO scaling');
    });
  }
  
  // ... rest of your code
};
```

### 2. Load Balancer Configuration

```nginx
# nginx.conf (if using custom setup)
upstream socketio_backend {
    ip_hash; # Sticky sessions
    server backend1.example.com:5000;
    server backend2.example.com:5000;
    server backend3.example.com:5000;
}

server {
    listen 443 ssl;
    server_name api.mydeeptech.ng;
    
    location /socket.io/ {
        proxy_pass http://socketio_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🔧 Deployment Checklist

### Pre-Deployment:
- [ ] Environment variables configured
- [ ] MongoDB connection string updated
- [ ] CORS origins include production domains
- [ ] Health check endpoint working
- [ ] SSL certificates configured (if manual)
- [ ] Frontend API URLs updated

### Post-Deployment:
- [ ] Health check responds correctly
- [ ] WebSocket connections working
- [ ] Chat messages send/receive
- [ ] Email notifications functional
- [ ] Password reset emails working
- [ ] Admin features accessible
- [ ] Database operations successful

### Testing in Production:
```bash
# Test health endpoint
curl https://your-api-domain.com/health

# Test WebSocket connection
# Use browser developer tools or WebSocket test tools
```

---

## 🎯 Recommended Deployment: Railway

**Why Railway is the best choice:**

1. **Zero Configuration**: WebSockets work out of the box
2. **Automatic SSL**: HTTPS enabled automatically  
3. **Easy Environment Variables**: Simple web interface
4. **Git Integration**: Deploy on push
5. **Affordable**: Great pricing for startups
6. **Excellent Support**: Active community and support

### Quick Railway Deployment:

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and initialize
railway login
railway init

# 3. Add environment variables via Railway dashboard
# 4. Deploy
railway deploy

# Your API will be available at:
# https://your-project-name.railway.app
```

Your Socket.IO chat system will be production-ready with this setup! The WebSocket connections will work seamlessly, and your frontend can connect using the same code with just the URL change.

Would you like me to help you set up any specific platform or configure the deployment files?