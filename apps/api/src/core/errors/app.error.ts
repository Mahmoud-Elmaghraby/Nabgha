export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string) {
    return new AppError(code, message, 400);
  }

  static unauthorized(code: string, message: string) {
    return new AppError(code, message, 401);
  }

  static forbidden(code: string, message: string) {
    return new AppError(code, message, 403);
  }

  static notFound(code: string, message: string) {
    return new AppError(code, message, 404);
  }

  static conflict(code: string, message: string) {
    return new AppError(code, message, 409);
  }

  static internal(code: string, message: string) {
    return new AppError(code, message, 500);
  }
}
