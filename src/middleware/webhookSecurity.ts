import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Webhook security middleware
 * Adds additional security checks for webhook endpoints
 */

/**
 * Check if IP is whitelisted (if whitelist is configured)
 * Set WEBHOOK_IP_WHITELIST environment variable with comma-separated IPs
 */
export const ipWhitelist = (req: Request, res: Response, next: NextFunction): void => {
  const whitelist = process.env.WEBHOOK_IP_WHITELIST;

  if (!whitelist) {
    // No whitelist configured, allow all IPs
    next();
    return;
  }

  const allowedIPs = whitelist.split(',').map((ip) => ip.trim());
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';

  if (allowedIPs.includes(clientIP)) {
    logger.debug(`Webhook request from whitelisted IP: ${clientIP}`);
    next();
  } else {
    logger.warn(`Webhook request from non-whitelisted IP: ${clientIP}`);
    res.status(403).json({
      success: false,
      error: 'Forbidden: IP not whitelisted',
    });
  }
};

/**
 * Add security headers specific to webhooks
 */
export const webhookSecurityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Prevent caching of webhook responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Content Security Policy - very restrictive for webhooks
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  // Prevent content type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  next();
};
