import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { MonthlyWhatsappController } from './monthly-whatsapp.controller';
import { SendMonthlyReportsUseCase } from './send-monthly-reports.usecase';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { ReportRegistryService } from './report-registry.service';
import { StudentsReportsProvider } from './providers/students-reports.provider';
import { StudentStatementReportProvider } from './providers/student-statement-report.provider';
import { StudentsAbsenceReportProvider } from './providers/students-absence-report.provider';
import { GroupAttendanceReportProvider } from './providers/group-attendance-report.provider';
import { SessionsListReportProvider } from './providers/sessions-list-report.provider';
import { OverdueDuesReportProvider } from './providers/overdue-dues-report.provider';
import { MonthlyCollectionsReportProvider } from './providers/monthly-collections-report.provider';
import { GroupGradesReportProvider } from './providers/group-grades-report.provider';
import { ExamResultReportProvider } from './providers/exam-result-report.provider';
import { HonorBoardReportProvider } from './providers/honor-board-report.provider';
import { StudentAttendanceReportProvider } from './providers/student-attendance-report.provider';
import { StudentGradesReportProvider } from './providers/student-grades-report.provider';
import { StudentMonthlyReportProvider } from './providers/student-monthly-report.provider';
import { StudentsModule } from '../students/students.module';
import { FinanceModule } from '../finance/finance.module';
import { ExportModule } from '../../shared/infrastructure/export/export.module';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { TenantCapabilitiesModule } from '../../shared/infrastructure/tenant-capabilities/tenant-capabilities.module';

@Module({
  imports: [StudentsModule, FinanceModule, ExportModule, DatabaseModule, WhatsAppModule, TenantCapabilitiesModule],
  controllers: [ReportsController, MonthlyWhatsappController],
  providers: [ReportRegistryService, StudentsReportsProvider, StudentStatementReportProvider, StudentsAbsenceReportProvider, StudentAttendanceReportProvider, StudentGradesReportProvider, StudentMonthlyReportProvider, SendMonthlyReportsUseCase, GroupAttendanceReportProvider, SessionsListReportProvider, OverdueDuesReportProvider, MonthlyCollectionsReportProvider, GroupGradesReportProvider, ExamResultReportProvider, HonorBoardReportProvider],
})
export class ReportsModule {}
