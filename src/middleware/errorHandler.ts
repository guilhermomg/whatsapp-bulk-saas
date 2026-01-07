import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { AppError } from '../utils/errors';

interface ErrorWithCode extends Error {
  code?: number;
  isJoi?: boolean;
  details?: Array<{ message: string }>;
  errors?: Record<string, { message: string }>;
}

const errorHandler = (
  err: ErrorWithCode,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let error: AppError | ErrorWithCode = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error: ${err.message} | Request ID: ${req.id}`);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = new AppError(message, 400);
  }

  // Joi validation error
  if (err.isJoi && err.details) {
    const message = err.details.map((detail) => detail.message).join(', ');
    error = new AppError(message, 400);
  }

  const statusCode = (error as AppError).statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: error.message || 'Server Error',
    requestId: req.id,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
