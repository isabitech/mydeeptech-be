const Joi = require('joi');
const mongoose = require('mongoose');

const validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      if (schema.body) {
        req.body = await schema.body.validateAsync(req.body, { abortEarly: true });
      }

      if (schema.query) {
        req.query = await schema.query.validateAsync(req.query, { abortEarly: true });
      }

      if (schema.params) {
        req.params = await schema.params.validateAsync(req.params, { abortEarly: true });

        if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
          const err = new Error("Invalid ID format");
          err.statusCode = 400;
          return next(err);
        }
      }

      next();
    } catch (error) {

  if (error instanceof Joi.ValidationError) {
      const field = error.details[0].context.key;
      const type = error.details[0].type;

      let message = "Invalid request";

      if (type === "any.required") {
        message = `${field} is required`;
      } else {
        message = error.details[0].message.replace(/"/g, "");
      }

      const err = new Error(message);
      err.statusCode = 400;
      return next(err);
  }

      next(error);
    }
  };
};

module.exports = validateRequest;