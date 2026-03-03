const axios = require('axios');

const resolveMessage = (err) => {
  return (
    err?.response?.data?.data?.message ||
    err?.response?.data?.message ||
    err?.response?.statusText ||
    err?.message ||
    "An unknown error occurred."
  );
};

const ErrorMessage = (error) => {
  if (axios.isAxiosError(error)) {
    // Axios-specific handling, e.g. include status code
    const status = error?.response?.status;
    const message = resolveMessage(error);
    return status ? `[${status}] ${message}` : message;
  }

  if (error instanceof Error) {
    return error.message || "An unknown error occurred.";
  }

  return resolveMessage(error);
};

module.exports = ErrorMessage;