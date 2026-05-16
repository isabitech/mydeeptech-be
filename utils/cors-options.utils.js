const envConfig = require("../config/envConfig");

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://mydeeptech.ng",
  "https://www.mydeeptech.ng",
  "https://mydeeptech.onrender.com",
  "https://mydeeptech-frontend.onrender.com",
  "https://mydeeptech-be.onrender.com",
  "https://mydeeptech-be-lmrk.onrender.com",
];

const DEFAULT_ALLOWED_HEADERS = [
  "Accept",
  "Authorization",
  "Cache-Control",
  "Content-Type",
  "Origin",
  "Pragma",
  "Range",
  "X-Requested-With",
  "baggage",
  "sentry-trace",
  "token",
];

const DEFAULT_EXPOSED_HEADERS = [
  "Content-Disposition",
  "Content-Length",
  "X-Export-Mode",
  "X-Exported-Failed-Image-Count",
  "X-Exported-Image-Count",
  "X-Exported-Submission-Count",
  "X-Exported-Submission-Id",
  "X-Exported-Task-Id",
  "X-Exported-Task-Status",
];

function normalizeOrigin(origin = "") {
  return String(origin || "").trim().replace(/\/$/, "");
}

const allowedOrigins = new Set(
  [
    ...DEFAULT_ALLOWED_ORIGINS,
    envConfig.FRONTEND_URL,
    envConfig.BACKEND_URL,
  ]
    .filter(Boolean)
    .map((origin) => normalizeOrigin(origin)),
);

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  return allowedOrigins.has(normalizeOrigin(origin));
}

function setCorsHeaders(req, res) {
  const requestOrigin = normalizeOrigin(req.headers.origin || "");

  if (!requestOrigin || !isAllowedOrigin(requestOrigin)) {
    return false;
  }

  const requestHeaders = req.headers["access-control-request-headers"];

  res.header("Access-Control-Allow-Origin", requestOrigin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.header(
    "Access-Control-Allow-Headers",
    requestHeaders || DEFAULT_ALLOWED_HEADERS.join(", "),
  );
  res.header(
    "Access-Control-Expose-Headers",
    DEFAULT_EXPOSED_HEADERS.join(", "),
  );
  res.header("Access-Control-Max-Age", "86400");
  res.append("Vary", "Origin");
  res.append("Vary", "Access-Control-Request-Headers");

  return true;
}

const corsPreflightHeaders = (req, res, next) => {
  const requestOrigin = normalizeOrigin(req.headers.origin || "");

  if (requestOrigin && !isAllowedOrigin(requestOrigin)) {
    console.warn(`Blocked CORS origin: ${requestOrigin}`);
  }

  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    console.warn(`Blocked CORS origin: ${normalizedOrigin}`);
    return callback(new Error(`Not allowed by CORS: ${normalizedOrigin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: DEFAULT_ALLOWED_HEADERS,
  exposedHeaders: DEFAULT_EXPOSED_HEADERS,
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 86400,
};

module.exports = {
  corsOptions,
  corsPreflightHeaders,
  isAllowedOrigin,
};
