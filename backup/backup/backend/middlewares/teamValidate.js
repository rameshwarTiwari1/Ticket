const teamSchema = require('../validators/teamValidator');

module.exports = (req, res, next) => {
  const { error } = teamSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message
    });
  }

  next();
};