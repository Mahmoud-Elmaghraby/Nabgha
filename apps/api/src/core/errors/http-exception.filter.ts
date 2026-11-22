import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from './app.error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: unknown = undefined;

    if (exception instanceof AppError) {
      statusCode = exception.statusCode;
      message = exception.message;
      code = exception.code;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message;
      code = 'HTTP_ERROR';
    } else if (this.isPgError(exception)) {
      // أخطاء PostgreSQL المتوقعة من بيانات المستخدم — بدل "Internal server error" غامض
      const mapped = this.mapPgError(exception as any);
      statusCode = mapped.statusCode;
      code = mapped.code;
      message = mapped.message;
      if (statusCode >= 500) {
        this.logger.error(`DB ERROR: ${request.method} ${request.url}`, (exception as any).stack);
      } else {
        this.logger.warn(`DB ${(exception as any).code} on ${request.method} ${request.url}: ${(exception as any).message}`);
      }
    } else {
      this.logger.error(
        `UNHANDLED EXCEPTION: ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: any = {
      success: false,
      error: {
        code,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    };

    if (details) body.error.details = details;

    response.status(statusCode).json(body);
  }

  private isPgError(e: unknown): boolean {
    const code = (e as any)?.code;
    return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) && typeof (e as any)?.severity === 'string';
  }

  private mapPgError(e: { code: string }): { statusCode: number; code: string; message: string } {
    switch (e.code) {
      case '22P02': // invalid_text_representation (مثلاً UUID غلط في الرابط)
      case '22007': // invalid_datetime_format
      case '22008': // datetime_field_overflow
        return { statusCode: 400, code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' };
      case '23505': // unique_violation
        return { statusCode: 409, code: 'CONFLICT', message: 'البيانات دي موجودة بالفعل' };
      case '23503': // foreign_key_violation
        return { statusCode: 409, code: 'RELATED_DATA', message: 'العملية مش ممكنة — فيه بيانات مرتبطة غير موجودة أو مستخدمة في مكان تاني' };
      case '23502': // not_null_violation
      case '23514': // check_violation
        return { statusCode: 400, code: 'VALIDATION_ERROR', message: 'بيانات ناقصة أو غير مسموح بها' };
      case '40P01': // deadlock_detected
      case '40001': // serialization_failure
        return { statusCode: 409, code: 'RETRY', message: 'العملية اتعارضت مع عملية تانية في نفس اللحظة — حاول تاني' };
      case 'XX001': // data_corrupted — تلف في ملفات قاعدة البيانات على الديسك (FINANCE-001)
      case 'XX002': // index_corrupted
        return { statusCode: 500, code: 'DB_CORRUPTED', message: 'فيه تلف في ملفات قاعدة البيانات على الجهاز — أوقف الشغل واتصل بالدعم الفني فورًا' };
      default:
        return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
    }
  }
}
