import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, switchMap } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { MediaService } from '../../data/media.service';
import { WorkApi } from '../../data/work.api';
import { SPECIALTY, errorMessage, toLocalInput } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoPickerComponent } from '../../shared/ui/photo-picker.component';
import { LabelPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { JobProgressComponent } from './job-progress.component';

type Panel = 'none' | 'schedule' | 'start' | 'evidence' | 'complete';

@Component({
  selector: 'app-job-detail-page',
  imports: [FormsModule, RouterLink, IconComponent, PhotoPickerComponent, LabelPipe, LoadingComponent, ErrorStateComponent, JobProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-detail.page.html'
})
export class JobDetailPage {
  private readonly api = inject(WorkApi);
  private readonly media = inject(MediaService);
  private readonly user = inject(CurrentUserStore);

  readonly jobId = input.required<string>();
  readonly specialty = SPECIALTY;
  readonly detail = rxResource({ params: () => this.jobId(), stream: ({ params }) => this.api.job(params) });
  private readonly picker = viewChild(PhotoPickerComponent);

  readonly isFixer = computed(() => this.user.activeRole() === 'FIXER');
  readonly status = computed(() => (this.detail.hasValue() ? this.detail.value().job.status : null));
  readonly canSchedule = computed(() => this.isFixer() && (this.status() === 'ASSIGNED' || this.status() === 'SCHEDULED'));
  readonly canStart = computed(() => this.canSchedule());
  readonly running = computed(() => this.status() === 'IN_PROGRESS' || this.status() === 'SLA_AT_RISK');
  readonly canAddEvidence = computed(() => this.isFixer() && this.status() !== null && this.status() !== 'COMPLETED');

  readonly panel = signal<Panel>('none');
  readonly busy = signal(false);
  readonly step = signal('');
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  scheduledFor = '';
  note = '';
  stage: 'BEFORE' | 'DURING' | 'AFTER' = 'DURING';
  caption = '';
  readonly files = signal<File[]>([]);

  open(panel: Panel): void {
    this.error.set(null);
    this.notice.set(null);
    this.note = '';
    this.panel.set(panel);
    if (panel === 'schedule') {
      const current = this.detail.hasValue() ? this.detail.value().job.scheduledFor : null;
      const next = current ? new Date(current) : new Date(Date.now() + 24 * 3600 * 1000);
      if (!current) next.setHours(9, 0, 0, 0);
      this.scheduledFor = toLocalInput(next);
    }
    if (panel === 'evidence') this.stage = this.status() === 'ASSIGNED' || this.status() === 'SCHEDULED' ? 'BEFORE' : 'DURING';
  }

  schedule(): void {
    if (!this.scheduledFor) return;
    this.run(this.api.schedule(this.jobId(), new Date(this.scheduledFor).toISOString(), this.note.trim() || undefined), 'Fecha guardada. Le avisamos al cliente.');
  }

  start(): void {
    this.run(this.api.start(this.jobId(), this.note.trim() || undefined), 'Trabajo en curso. Registra fotos del avance.');
  }

  complete(): void {
    this.run(this.api.complete(this.jobId(), this.note.trim() || undefined), 'Trabajo terminado. El cliente ya puede calificarlo.');
  }

  uploadEvidence(): void {
    const files = this.files();
    if (!files.length) {
      this.error.set('Elige al menos una foto.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.step.set(`Subiendo ${files.length} ${files.length === 1 ? 'foto' : 'fotos'}…`);
    this.media
      .uploadAll(files, 'JOB_EVIDENCE')
      .pipe(switchMap((mediaIds) => this.api.addEvidence(this.jobId(), mediaIds, this.stage, this.caption.trim() || undefined)))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.caption = '';
          this.picker()?.clear();
          this.files.set([]);
          this.panel.set('none');
          this.notice.set('Fotos agregadas al historial del trabajo.');
          this.detail.reload();
        },
        error: (failure) => {
          this.busy.set(false);
          this.error.set(errorMessage(failure, 'No pudimos subir las fotos.'));
        }
      });
  }

  private run(action: Observable<unknown>, success: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.step.set('Guardando…');
    action.subscribe({
      next: () => {
        this.busy.set(false);
        this.panel.set('none');
        this.notice.set(success);
        this.detail.reload();
      },
      error: (failure) => {
        this.busy.set(false);
        this.error.set(errorMessage(failure, 'No pudimos actualizar el trabajo.'));
      }
    });
  }
}
