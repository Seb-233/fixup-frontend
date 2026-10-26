import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ChecklistResult, VisitResponse } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { CHECKLIST_RESULT, VISIT_KIND, VISIT_STATUS, errorMessage, toLocalInput } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { LabelPipe, WhenPipe } from '../../shared/ui/pipes';
import { StatusComponent } from '../../shared/ui/status.component';

type Mode = 'idle' | 'reschedule' | 'cancel' | 'complete';

// Una visita técnica con las acciones que le corresponden a quien la mira: confirma la contraparte
// de quien propuso, cualquiera de los dos mueve o cancela, y solo el técnico la da por realizada.
@Component({
  selector: 'app-visit-card',
  imports: [FormsModule, RouterLink, IconComponent, StatusComponent, LabelPipe, WhenPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './visit-card.component.html',
  styles: `
    :host { display: block; }
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--s-2); align-items: flex-start; }
    .when { font-weight: 700; }
    .checklist { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-3); }
    .checklist li { display: grid; gap: var(--s-1); }
    .answers { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  `
})
export class VisitCardComponent {
  private readonly api = inject(WorkApi);

  readonly visit = input.required<VisitResponse>();
  readonly me = input<string | undefined>();
  readonly showRequestLink = input(false);
  /** Solicitud cerrada: la visita queda como registro, sin acciones. */
  readonly readonly = input(false);
  readonly changed = output<VisitResponse>();

  readonly kind = VISIT_KIND;
  readonly status = VISIT_STATUS;
  readonly checklistResult = CHECKLIST_RESULT;
  readonly results: ChecklistResult[] = ['OK', 'NEEDS_WORK', 'NOT_APPLICABLE'];

  readonly mode = signal<Mode>('idle');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  newDate = '';
  newDuration = 60;
  reason = '';
  outcome = '';
  answers: Record<number, { result: ChecklistResult | null; note: string }> = {};

  readonly isFixer = computed(() => this.visit().fixerUserId === this.me());
  readonly open = computed(() => !this.readonly() && (this.visit().status === 'PROPOSED' || this.visit().status === 'CONFIRMED'));
  readonly canConfirm = computed(() => this.visit().status === 'PROPOSED' && this.visit().proposedByUserId !== this.me());
  readonly started = computed(() => new Date(this.visit().scheduledAt).getTime() <= Date.now());
  readonly canComplete = computed(() => this.isFixer() && this.visit().status === 'CONFIRMED' && this.started());
  readonly canMarkNoShow = computed(() => this.visit().status === 'CONFIRMED' && this.started());
  readonly waitingOther = computed(() => this.open() && this.visit().status === 'PROPOSED' && this.visit().proposedByUserId === this.me());
  readonly counterpart = computed(() => (this.isFixer() ? this.visit().ownerName : this.visit().fixerName));

  start(mode: Mode): void {
    this.error.set(null);
    this.mode.set(mode);
    if (mode === 'reschedule') {
      const next = new Date(this.visit().scheduledAt);
      if (next.getTime() < Date.now()) next.setTime(Date.now() + 24 * 3600 * 1000);
      this.newDate = toLocalInput(next);
      this.newDuration = this.visit().durationMinutes;
    }
    if (mode === 'complete') {
      this.answers = {};
      for (const item of this.visit().checklist) this.answers[item.position] = { result: null, note: '' };
    }
  }

  confirm(): void {
    this.run(this.api.confirmVisit(this.visit().id));
  }

  noShow(): void {
    this.run(this.api.noShow(this.visit().id));
  }

  submitReschedule(): void {
    if (!this.newDate) return;
    this.run(this.api.rescheduleVisit(this.visit().id, new Date(this.newDate).toISOString(), Number(this.newDuration)));
  }

  submitCancel(): void {
    if (!this.reason.trim()) {
      this.error.set('Cuéntale a la otra parte por qué cancelas.');
      return;
    }
    this.run(this.api.cancelVisit(this.visit().id, this.reason.trim()));
  }

  submitComplete(): void {
    if (!this.outcome.trim()) {
      this.error.set('Escribe qué encontraste en la visita.');
      return;
    }
    const checklist = this.visit().checklist.map((item) => ({
      position: item.position,
      result: this.answers[item.position]?.result ?? '',
      note: this.answers[item.position]?.note || undefined
    }));
    if (checklist.some((item) => !item.result)) {
      this.error.set('Responde todos los puntos de la lista de chequeo.');
      return;
    }
    this.run(this.api.completeVisit(this.visit().id, this.outcome.trim(), checklist.length ? checklist : undefined));
  }

  private run(action: Observable<VisitResponse>): void {
    this.busy.set(true);
    this.error.set(null);
    action.subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.mode.set('idle');
        this.reason = '';
        this.outcome = '';
        this.changed.emit(updated);
      },
      error: (failure) => {
        this.busy.set(false);
        this.error.set(errorMessage(failure, 'No pudimos actualizar la visita.'));
      }
    });
  }
}
