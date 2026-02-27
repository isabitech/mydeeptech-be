const envConfig = require("../config/envConfig");

const formatErrorMessage = (error) => {
 if(error instanceof Error) {
  return error.message;
 }

 if(error && typeof error === 'object' && "message" in error) {
  return String(error.message);
 }

 if(error && typeof error === "string") {
   return error;
 }
 
 return "An unexpected error occurred";
}

const errorMiddleware =  (err, _req, res, _next) => {

  if(envConfig.NODE_ENV === "development") {
    console.error("Error =>", err);
  }

  return res.status(err.statusCode || 500).json({
    message: formatErrorMessage(err) || "Internal Server Error",
    statusCode: err.statusCode || 500,
    data: err.data || {},
  });

};

module.exports = errorMiddleware;