const ResponseClass = require("../utils/response-handler");


const errorMiddleware =  (err, req, res, next) => {
  return ResponseClass.Error(res, {
    message: err.message  || "Internal Server Error",
    statusCode: err.statusCode || 500,
    data: err.data || {},
  });
};

module.exports = errorMiddleware;