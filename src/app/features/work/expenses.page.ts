import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PropertiesApi } from '../../data/properties.api';
import { WorkApi } from '../../data/work.api';
import { SPECIALTY, errorMessage, isoDate, money, month } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, LabelPipe, MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

interface Range {
  from: string;
  to: string;
  propertyId: string;
}

@Component({
  selector: 'app-expenses-page',
  imports: [FormsModule, RouterLink, IconComponent, MoneyPipe, DayPipe, LabelPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expenses.page.html',
  styleUrl: './expenses.page.scss'
})
export class ExpensesPage {
  private readonly api = inject(WorkApi);
  private readonly propertiesApi = inject(PropertiesApi);

  readonly specialty = SPECIALTY;
  readonly month = month;
  form: Range = { from: `${new Date().getFullYear()}-01-01`, to: isoDate(new Date()), propertyId: '' };
  readonly range = signal<Range>({ ...this.form });

  readonly properties = rxResource({ stream: () => this.propertiesApi.mine() });
  readonly report = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.api.expenses(params.from, params.to, params.propertyId || undefined)
  });

  readonly change = computed(() => {
    if (!this.report.hasValue()) return null;
    const r = this.report.value();
    const previous = r.previousPeriodTotal ?? 0;
    if (!previous) return null;
    const delta = ((r.total ?? 0) - previous) / previous;
    return { up: delta > 0, text: `${Math.abs(Math.round(delta * 100))} %`, previous: money(previous) };
  });

  readonly months = computed(() => {
    if (!this.report.hasValue()) return [];
    const rows = this.report.value().byMonth ?? [];
    const max = Math.max(1, ...rows.map((m) => m.total ?? 0));
    return rows.map((m) => ({ label: month(m.month ?? ''), total: m.total ?? 0, width: Math.round(((m.total ?? 0) / max) * 100) }));
  });

  readonly specialties = computed(() => {
    if (!this.report.hasValue()) return [];
    const rows = this.report.value().bySpecialty ?? [];
    const sum = rows.reduce((total, s) => total + (s.total ?? 0), 0) || 1;
    return [...rows]
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .map((s) => ({ key: s.specialty ?? '', total: s.total ?? 0, share: Math.round(((s.total ?? 0) / sum) * 100) }));
  });

  readonly downloading = signal(false);
  readonly downloadError = signal<string | null>(null);

  apply(): void {
    if (this.form.from > this.form.to) return;
    this.range.set({ ...this.form });
  }

  downloadCsv(): void {
    const r = this.range();
    this.downloading.set(true);
    this.downloadError.set(null);
    this.api.expensesCsv(r.from, r.to, r.propertyId || undefined).subscribe({
      next: (csv) => {
        this.downloading.set(false);
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `gastos-mantenimiento-${r.from}-a-${r.to}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (failure) => {
        this.downloading.set(false);
        this.downloadError.set(errorMessage(failure, 'No pudimos generar el archivo.'));
      }
    });
  }
}
