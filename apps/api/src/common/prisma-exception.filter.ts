/** Converts known database errors into clean 4xx responses. */
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Turns database errors into clean 4xx responses instead of 500s. */
// Only handles known Prisma errors (unknown ones stay 500)
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    // Raw HTTP response object
    const res = host.switchToHttp().getResponse();
    // Prisma error code -> [HTTP status, friendly message]
    const map: Record<string, [number, string]> = {
      // Unique constraint violated (duplicate)
      P2002: [HttpStatus.CONFLICT, 'That record already exists'],
      // Record to update/delete not found
      P2025: [HttpStatus.NOT_FOUND, 'Record not found'],
      // Foreign key violation (record is referenced elsewhere)
      P2003: [HttpStatus.BAD_REQUEST, 'This record is linked to other data'],
    };
    // Unknown code falls back to a generic 500
    const [status, message] = map[e.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Database error'];
    // Send the clean JSON error
    res.status(status).json({ statusCode: status, message, error: e.code });
  }
}
