/* eslint-disable max-classes-per-file */
// Multiple error classes are grouped here for consistency and ease of maintenance
export class AppError extends Error {
  public statusCode: number;

  public status: string;

  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation Error') {
    super(message, 422);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500);
  }
}

export class WhatsAppError extends AppError {
  public code?: string;

  public errorData?: unknown;

  constructor(message: string, statusCode: number = 500, code?: string, errorData?: unknown) {
    super(message, statusCode);
    this.code = code;
    this.errorData = errorData;
  }
}

export class WhatsAppAuthError extends WhatsAppError {
  constructor(message: string = 'WhatsApp authentication failed', code?: string) {
    super(message, 401, code);
  }
}

export class WhatsAppRateLimitError extends WhatsAppError {
  constructor(message: string = 'WhatsApp rate limit exceeded', code?: string) {
    super(message, 429, code);
  }
}

export class WhatsAppTemplateError extends WhatsAppError {
  constructor(message: string = 'WhatsApp template error', code?: string) {
    super(message, 400, code);
  }
}

export class WhatsAppInvalidRecipientError extends WhatsAppError {
  constructor(message: string = 'Invalid recipient phone number', code?: string) {
    super(message, 400, code);
  }
}
