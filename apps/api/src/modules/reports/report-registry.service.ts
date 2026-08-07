import { Injectable } from '@nestjs/common';
import { ReportDefinition } from './report.types';

@Injectable()
export class ReportRegistryService {
  private readonly reports = new Map<string, ReportDefinition>();

  register(definition: ReportDefinition): void {
    this.reports.set(definition.key, definition);
  }

  get(key: string): ReportDefinition | undefined {
    return this.reports.get(key);
  }

  getAll(): Array<{ key: string; title: string; description?: string; category: string }> {
    return Array.from(this.reports.values()).map(({ key, title, description, category }) => ({
      key, title, description, category,
    }));
  }
}
