# Simple Rate Limiting

A clean and effective rate limiting system for your Node.js Express app.

## Features

✅ **Redis-backed** - Scales across multiple servers  
✅ **Memory fallback** - Works without Redis  
✅ **Proxy-aware** - Handles load balancers correctly  
✅ **User-aware** - Different limits for authenticated users  
✅ **Simple setup** - Just a few lines of code

## Quick Setup

### 1. Install Dependencies

```bash
npm install express-rate-limit rate-limit-redis
```

### 2. Apply Rate Limiting

```javascript
const rateLimit = require("./middleware/simpleRateLimit");

// General API protection (100 req/15min)
app.use("/api", rateLimit.api);

// Strict auth protection (5 req/15min)
app.use("/api/auth", rateLimit.auth);

// Upload protection (5 uploads/hour)
app.use("/api/upload", rateLimit.upload);

// For authenticated users (500 req/15min)
app.use("/api/user", authenticate, rateLimit.user);
```

### 3. Configure Redis (Optional)

Set these environment variables:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
```

If Redis is not available, it automatically uses memory storage.

## Rate Limits

| Type     | Window | Limit | Use Case                     |
| -------- | ------ | ----- | ---------------------------- |
| `auth`   | 15 min | 5     | Login/register endpoints     |
| `api`    | 15 min | 100   | General API endpoints        |
| `upload` | 60 min | 5     | File upload endpoints        |
| `user`   | 15 min | 500   | Authenticated user endpoints |

## How It Works

1. **IP-based limiting** for anonymous users
2. **User+IP limiting** for authenticated users
3. **Redis storage** for distributed apps (with memory fallback)
4. **Proxy header support** (X-Forwarded-For, X-Real-IP)
5. **JSON error responses** with retry information

## Error Response Format

```json
{
  "success": false,
  "error": "Too many login attempts, please try again later",
  "retryAfter": "15 minutes"
}
```

## Monitoring

Check if Redis is working:

```bash
redis-cli ping
```

View rate limit keys in Redis:

```bash
redis-cli keys "rate_limit:*"
```

## Customization

Create custom rate limits:

```javascript
const rateLimit = require("express-rate-limit");
const { getRedisClient } = require("../config/redis");

const customLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // 50 requests
  message: "Custom rate limit exceeded",
});

app.use("/api/special", customLimit);
```

That's it! Simple, effective rate limiting in under 60 lines of code.
