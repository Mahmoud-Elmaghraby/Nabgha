import { AppError } from '../../../../core/errors/app.error';

export class UserNotFoundException extends AppError {
  constructor() {
    super('المستخدم غير موجود', 'USER_NOT_FOUND', 404);
  }
}

export class UsernameAlreadyExistsException extends AppError {
  constructor() {
    super('اسم المستخدم مستخدم بالفعل', 'USERNAME_ALREADY_EXISTS', 409);
  }
}

export class CannotDeleteSelfException extends AppError {
  constructor() {
    super('لا يمكنك حذف حسابك الخاص', 'CANNOT_DELETE_SELF', 400);
  }
}

export class CannotDeactivateSelfException extends AppError {
  constructor() {
    super('لا يمكنك تعطيل حسابك الخاص', 'CANNOT_DEACTIVATE_SELF', 400);
  }
}

export class InvalidPasswordException extends AppError {
  constructor() {
    super('كلمة المرور الحالية غير صحيحة', 'INVALID_PASSWORD', 400);
  }
}
