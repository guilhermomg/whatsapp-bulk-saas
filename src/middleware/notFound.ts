import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../utils/errors';

const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Not Found - ${req.originalUrl}`));
};

export default notFound;
