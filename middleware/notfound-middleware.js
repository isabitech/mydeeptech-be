

const notFoundMiddleware = (req, res) => {
  // Don't intercept Socket.IO routes - let Socket.IO handle them
  if (req.originalUrl.startsWith('/socket.io')) {
    return; // Skip this middleware, let it pass through
  }
  
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    data: null,
  });
};

module.exports = notFoundMiddleware;