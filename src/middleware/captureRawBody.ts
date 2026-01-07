import { Request, Response, json } from 'express';

/**
 * Middleware to capture raw body for webhook signature verification
 * This must be applied before express.json() middleware
 */
const captureRawBody = json({
  verify: (req: Request, _res: Response, buf: Buffer) => {
    // Store the raw body buffer on the request object
    // This is needed for webhook signature verification
    (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
});

export default captureRawBody;
