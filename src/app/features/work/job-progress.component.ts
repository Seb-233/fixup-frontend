import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { JobDetail } from '../../data/models';
import { EVIDENCE_STAGE, JOB_STATUS } from '../../shared/format';
import { PhotoComponent } from '../../shared/ui/photo.component';
import { LabelPipe, WhenPipe } from '../../shared/ui/pipes';
import { StatusComponent } from '../../shared/ui/status.component';

// Avance de un trabajo: fecha acordada, fotos de antes, durante y después, y la bitácora de estados.
@Component({
  selector: 'app-job-progress',
  imports: [PhotoComponent, StatusComponent, LabelPipe, WhenPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <div class="spread">
        <p class="text-sm">
          @if (detail().job.scheduledFor) { Fecha acordada: <strong>{{ detail().job.scheduledFor | when }}</strong> }
          @else { Aún sin fecha acordada. }
        </p>
        <app-status [map]="status" [value]="detail().job.status" />
      </div>
      @if (detail().job.progressNote) {
        <p class="text-sm"><strong>Último avance:</strong> {{ detail().job.progressNote }}</p>
      }

      @for (group of groups(); track group.stage) {
        @if (group.items.length) {
          <div class="stack-sm">
            <h4 class="text-sm">{{ group.stage | label: stage }}</h4>
            <ul class="gallery evidence">
              @for (e of group.items; track e.id) {
                <li>
                  <figure>
                    <app-photo [src]="e.url" [alt]="e.caption || 'Foto ' + (group.stage | label: stage).toLowerCase()" />
                    @if (e.caption) { <figcaption class="text-xs text-muted">{{ e.caption }}</figcaption> }
                  </figure>
                </li>
              }
            </ul>
          </div>
        }
      }

      @if (detail().log.length) {
        <details>
          <summary class="text-sm">Bitácora del trabajo ({{ detail().log.length }})</summary>
          <ol class="timeline log">
            @for (entry of detail().log; track $index) {
              <li class="done">
                <div class="spread">
                  <strong class="text-sm">{{ entry.status | label: statusText }}</strong>
                  <span class="text-xs text-muted">{{ entry.changedAt | when }}</span>
                </div>
                @if (entry.note) { <p class="text-sm text-muted">{{ entry.note }}</p> }
              </li>
            }
          </ol>
        </details>
      }
    </div>
  `,
  styles: `
    .evidence { list-style: none; margin: 0; padding: 0; }
    figure { margin: 0; display: grid; gap: 4px; }
    summary { cursor: pointer; font-weight: 600; min-height: var(--tap); display: flex; align-items: center; }
    .log { margin-top: var(--s-3); }
  `
})
export class JobProgressComponent {
  readonly detail = input.required<JobDetail>();
  readonly status = JOB_STATUS;
  readonly stage = EVIDENCE_STAGE;
  readonly statusText = Object.fromEntries(Object.entries(JOB_STATUS).map(([k, v]) => [k, v.text]));

  readonly groups = computed(() =>
    (['BEFORE', 'DURING', 'AFTER'] as const).map((stage) => ({
      stage,
      items: this.detail().evidence.filter((e) => e.stage === stage)
    }))
  );
}
