import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Silence unused variable warning while keeping Express's 4-parameter error handler signature intact
  void _next;

  if (err instanceof AppError) {
    logger.warn({
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      url: req.url,
      method: req.method,
    }, 'Application error');
    
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  // Translate known PostgreSQL constraints into 4xx AppErrors
  if (err && typeof err === 'object' && 'code' in err) {
    const pgErr = err as { code: unknown; constraint?: unknown; detail?: unknown; message?: string };
    if (typeof pgErr.code === 'string' && pgErr.code.length === 5) {
      let statusCode = 400;
      let code = 'BAD_REQUEST';
      let message = pgErr.message || 'Database constraint violation.';

      if (pgErr.code === '23505') {
        code = 'CONFLICT';
        statusCode = 409;
        message = 'A record with this identifier already exists.';
        if (typeof pgErr.detail === 'string' && pgErr.detail.includes('already exists')) {
          message = pgErr.detail;
        }
      } else if (pgErr.code === '23514') {
        code = 'BAD_REQUEST';
        statusCode = 400;
        if (typeof pgErr.constraint === 'string') {
          if (pgErr.constraint === 'from_date_less_to_date_check') {
            message = 'The start date must be less than or equal to the end date.';
          } else if (pgErr.constraint === 'number_of_events_positive_check') {
            message = 'The number of events must be greater than 0.';
          } else {
            message = `Check constraint violation: ${pgErr.constraint}`;
          }
        }
      } else if (pgErr.code === '23503') {
        code = 'BAD_REQUEST';
        statusCode = 400;
        message = 'Referenced entity does not exist.';
      }

      logger.warn({
        code,
        message,
        statusCode,
        url: req.url,
        method: req.method,
        pgCode: pgErr.code,
        pgConstraint: pgErr.constraint,
      }, 'Database constraint error translated');

      return res.status(statusCode).json({
        error: {
          code,
          message
        }
      });
    }
  }

  logger.error({
    err,
    url: req.url,
    method: req.method,
  }, 'Unhandled server error');

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred on the server.'
    }
  });
};
