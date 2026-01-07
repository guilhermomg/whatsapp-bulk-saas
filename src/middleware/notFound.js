const { NotFoundError } = require('../utils/errors');

const notFound = (req, res, next) => {
  next(new NotFoundError(`Not Found - ${req.originalUrl}`));
};

module.exports = notFound;
