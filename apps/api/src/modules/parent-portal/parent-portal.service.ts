import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import { AppError } from '../../core/errors/app.error';
import { normalizePhone } from '../../shared/utils/phone.util';
import { ParentPortalRepository } from './parent-portal.repository';
import { IWaProvider, WA_PROVIDER } from '../whatsapp/domain/interfaces/wa-provider.interface';
import type { ParentJwtPayload } from '../../shared/infrastructure/auth/jwt.strategy';
import { StudentUseCase } from '../students/application/use-cases/student.usecase';
import { FinanceUseCase } from '../finance/application/use-cases/finance.usecase';

const OTP_TTL_MINUTES = 5;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const PARENT_TOKEN_EXPIRY = '30d';

function generateOtpCode(): string {
  // 6 أرقام، من 100000 لـ 999999 — دايمًا 6 خانات
  return String(Math.floor(100000 + Math.random() * 900000));
}

@Injectable()
export class ParentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ParentPortalRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly studentUseCase: StudentUseCase,
    private readonly financeUseCase: FinanceUseCase,
    @Inject(WA_PROVIDER) private readonly waProvider: IWaProvider,
  ) {}

  /** يرجّع المستأجر النشط بالـ slug أو يرمي خطأ لو مش موجود */
  async resolveTenant(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug, isActive: true } });
    if (!tenant) {
      throw AppError.notFound('TENANT_NOT_FOUND', 'المركز غير موجود أو غير نشط');
    }
    return tenant;
  }

  async requestOtp(slug: string, rawPhone: string): Promise<{ sent: true }> {
    const tenant = await this.resolveTenant(slug);
    const phone = normalizePhone(rawPhone);

    const students = await this.repo.findStudentsByParentPhone(tenant.id, phone);
    if (students.length === 0) {
      throw AppError.notFound('PHONE_NOT_FOUND', 'رقم الهاتف غير مسجل لدى أي طالب في هذا المركز');
    }

    // منع إرسال أكواد متكررة بسرعة (cooldown)
    const latest = await this.repo.findLatestOtp(tenant.id, phone);
    if (latest) {
      const secondsSinceLast = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
      if (secondsSinceLast < OTP_COOLDOWN_SECONDS) {
        const wait = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLast);
        throw AppError.badRequest('OTP_COOLDOWN', `من فضلك انتظر ${wait} ثانية قبل طلب كود جديد`);
      }
    }

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await this.repo.createOtp(tenant.id, phone, codeHash, expiresAt);

    const message = `كود الدخول لبوابة أولياء الأمور: ${code}\nصالح لمدة ${OTP_TTL_MINUTES} دقائق. برجاء عدم مشاركة هذا الكود مع أي شخص.`;
    // إرسال مباشر عبر الـ provider — عمدًا من غير المرور بنظام القوالب/حدود الإرسال
    // اليومية (SendNotificationUseCase)، لأن كود دخول لازم يوصل فورًا بصرف النظر
    // عن ساعات الإرسال المسموحة أو سقف الرسائل اليومي المخصص للتنبيهات العادية.
    // كود الدخول عاجل — ولي الأمر مستنيه على الشاشة، فمايستناش الفاصل بين الرسايل
    const result = await this.waProvider.sendMessage(tenant.id, phone, message, { priority: true });
    if (!result.success) {
      throw AppError.internal('OTP_SEND_FAILED', 'تعذر إرسال كود الدخول، حاول مرة أخرى لاحقًا');
    }

    return { sent: true };
  }

  async verifyOtp(slug: string, rawPhone: string, code: string): Promise<{ accessToken: string; students: { id: string; fullName: string; grade: string | null }[] }> {
    const tenant = await this.resolveTenant(slug);
    const phone = normalizePhone(rawPhone);

    const otp = await this.repo.findLatestOtp(tenant.id, phone);
    if (!otp || otp.consumed_at) {
      throw AppError.badRequest('OTP_INVALID', 'الكود غير صحيح أو منتهي، اطلب كود جديد');
    }
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      throw AppError.badRequest('OTP_EXPIRED', 'انتهت صلاحية الكود، اطلب كود جديد');
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw AppError.badRequest('OTP_LOCKED', 'تم إيقاف هذا الكود لعدد محاولات كبير، اطلب كود جديد');
    }

    const isValid = await bcrypt.compare(code, otp.code_hash);
    if (!isValid) {
      await this.repo.incrementAttempts(tenant.id, otp.id);
      throw AppError.badRequest('OTP_INVALID', 'الكود غير صحيح');
    }

    await this.repo.consumeOtp(tenant.id, otp.id);

    const students = await this.repo.findStudentsByParentPhone(tenant.id, phone);
    if (students.length === 0) {
      throw AppError.notFound('PHONE_NOT_FOUND', 'رقم الهاتف غير مسجل لدى أي طالب في هذا المركز');
    }

    const payload: ParentJwtPayload = {
      sub: phone,
      tenantId: tenant.id,
      studentIds: students.map((s) => s.id),
      type: 'parent',
    };
    const secret = this.config.get<string>('PARENT_JWT_SECRET') as string;
    const accessToken = this.jwt.sign(payload, { secret, expiresIn: PARENT_TOKEN_EXPIRY });

    return {
      accessToken,
      students: students.map((s) => ({ id: s.id, fullName: s.full_name, grade: s.grade })),
    };
  }

  /** بيانات الملف الأساسية لولي الأمر بعد التحقق من الـ JWT — لإعادة تحميل بيانات الطلاب عند فتح البوابة */
  async getMe(tenantId: string, studentIds: string[]) {
    const students = await this.repo.findStudentsByIds(tenantId, studentIds);
    return {
      students: students.map((s) => ({ id: s.id, fullName: s.full_name, grade: s.grade, studentCode: s.student_code })),
    };
  }

  /**
   * صفحة تفصيلية لطالب واحد: بيانات أساسية + حصص قادمة + سجل حضور/درجات + ملخص مالي.
   * ملحوظة أمان: التحقق من إن الطالب فعلاً ابن ولي الأمر ده (studentId ∈ JWT.studentIds)
   * بيحصل في الـ Controller قبل ما يوصل هنا — مش مسؤولية الدالة دي.
   * بنستخدم نفس الـ use-cases اللي شغالة في لوحة الموظفين (StudentUseCase/FinanceUseCase)
   * بدل ما نعيد كتابة الاستعلامات، وبنفلتر/نبسّط الحقول اللي مالهاش لازمة لولي الأمر
   * (زي notes الموظفين، سبب الإلغاء، تفاصيل الخزنة الداخلية).
   */
  async getStudentDetail(tenantId: string, studentId: string) {
    const student = await this.studentUseCase.getById(tenantId, studentId);

    const [attendance, upcomingSessions, financialProfile] = await Promise.all([
      this.studentUseCase.getAttendance(tenantId, studentId),
      this.repo.findUpcomingSessionsForStudent(tenantId, studentId),
      this.financeUseCase.getStudentFinancialProfile(tenantId, studentId),
    ]);

    const dues = (financialProfile.dues as any[])
      .filter((d) => d.status !== 'cancelled')
      .map((d) => {
        const netDue = Math.max(0, d.dueAmount - d.discountApplied);
        const remaining = d.status === 'waived' ? 0 : Math.max(0, netDue - d.paidAmount);
        return {
          id: d.id,
          month: d.month,
          subjectName: d.subjectName ?? null,
          gradeName: d.gradeName ?? null,
          dueAmount: d.dueAmount,
          discountApplied: d.discountApplied,
          paidAmount: d.paidAmount,
          netDue,
          remaining,
          status: d.status,
        };
      });

    const payments = (financialProfile.payments as any[])
      .filter((p) => p.status !== 'cancelled')
      .map((p) => ({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        receiptNumber: p.receiptNumber,
        status: p.status,
        paidAt: p.paidAt,
        month: p.month ?? null,
        subjectName: p.subjectName ?? null,
      }));

    const totalRemaining = dues.reduce((sum, d) => sum + d.remaining, 0);

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        grade: student.grade,
        studentCode: student.studentCode,
      },
      upcomingSessions,
      attendance,
      finance: { dues, payments, totalRemaining },
    };
  }
}
