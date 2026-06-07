// backend/middlewares/validate.js
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly:   false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(e => ({
          field:   e.path.join('.'),
          message: e.message,
        })),
      });
    }

    req[property] = value;
    next();
  };
};

module.exports = { validate };