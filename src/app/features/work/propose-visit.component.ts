import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VisitKind, VisitResponse } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { errorMessage, toLocalInput } from '../../shared/format';

export interface FixerChoice {
  id: string;
  name: string;
}

@Component({
  selector: 'app-propose-visit',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="stack-sm" (ngSubmit)="submit()">
      <div class="form-grid">
        @if (fixers().length > 1) {
          <div class="field">
            <label for="visit-fixer">Técnico</label>
            <select id="visit-fixer" class="select" name="fixer" [(ngModel)]="fixerId" required>
              @for (f of fixers(); track f.id) { <option [value]="f.id">{{ f.name }}</option> }
            </select>
          </div>
        }
        <div class="field">
          <label for="visit-kind">Tipo de visita</label>
          <select id="visit-kind" class="select" name="kind" [(ngModel)]="kind">
            @for (k of kinds(); track k.value) { <option [value]="k.value">{{ k.label }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="visit-date">Fecha y hora</label>
          <input id="visit-date" type="datetime-local" class="input" name="date" required [(ngModel)]="date" />
        </div>
        <div class="field">
          <label for="visit-duration">Duración</label>
          <select id="visit-duration" class="select" name="duration" [(ngModel)]="duration">
            <option [ngValue]="30">30 min</option>
            <option [ngValue]="60">1 hora</option>
            <option [ngValue]="90">1 h 30 min</option>
            <option [ngValue]="120">2 horas</option>
            <option [ngValue]="180">3 horas</option>
          </select>
        </div>
        <div class="field span-all">
          <label for="visit-notes">Indicaciones</label>
          <input id="visit-notes" class="input" name="notes" maxlength="500" [(ngModel)]="notes" placeholder="Torre 2, apto 503. Avisar en portería." />
        </div>
      </div>
      <span class="text-xs text-muted">Las visitas se hacen entre 7:00 a. m. y 7:00 p. m. y se agendan con al menos dos horas de anticipación. La otra parte debe confirmarla.</span>
      @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
      <div class="cluster">
        <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ busy() ? 'Enviando…' : 'Proponer visita' }}</button>
        <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">Cancelar</button>
      </div>
    </form>
  `
})
export class ProposeVisitComponent implements OnInit {
  private readonly api = inject(WorkApi);

  readonly requestId = input.required<string>();
  readonly fixers = input<FixerChoice[]>([]);
  readonly kinds = input<{ value: VisitKind; label: string }[]>([
    { value: 'DIAGNOSTIC', label: 'Diagnóstico' },
    { value: 'KITCHEN_ASSESSMENT', label: 'Valoración de cocina' }
  ]);
  readonly created = output<VisitResponse>();
  readonly cancelled = output<void>();

  fixerId = '';
  kind: VisitKind = 'DIAGNOSTIC';
  date = '';
  duration = 60;
  notes = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.fixerId = this.fixers()[0]?.id ?? '';
    this.kind = this.kinds()[0]?.value ?? 'DIAGNOSTIC';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    this.date = toLocalInput(tomorrow);
  }

  submit(): void {
    if (!this.date) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .proposeVisit({
        requestId: this.requestId(),
        fixerUserId: this.fixerId || undefined,
        kind: this.kind,
        scheduledAt: new Date(this.date).toISOString(),
        durationMinutes: Number(this.duration),
        notes: this.notes.trim() || undefined
      })
      .subscribe({
        next: (visit) => {
          this.busy.set(false);
          this.created.emit(visit);
        },
        error: (failure) => {
          this.busy.set(false);
          this.error.set(errorMessage(failure, 'No pudimos proponer la visita.'));
        }
      });
  }
}
