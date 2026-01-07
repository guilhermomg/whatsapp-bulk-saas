import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

const requestId = (req: Request, res: Response, next: NextFunction): void => {
  req.id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

export default requestId;
