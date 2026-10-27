import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RemodelingGoal, UrgencyLevel } from '../../data/models';
import { ProjectsApi } from '../../data/projects.api';
import { PropertiesApi } from '../../data/properties.api';
import { errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

interface RequirementDraft {
  title: string;
  description: string;
  urgencyLevel: UrgencyLevel;
  /** FixUp es 100 % digital: cada requerimiento se tramita como transferencia digital. */
  paymentMethod: 'TRANSFER';
}

@Component({
  selector: 'app-remodeling-form-page',
  imports: [FormsModule, RouterLink, IconComponent, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <a routerLink="/remodelings" class="back-link"><app-icon name="chevron-left" [size]="16" />Remodelaciones</a>
      <header class="page-header">
        <div>
          <h1>Nueva remodelación</h1>
          <p class="lede">Describe la obra y divídela en requerimientos por oficio. Cada uno se publica como una solicitud para que coticen los técnicos de esa especialidad.</p>
        </div>
      </header>

      @if (properties.isLoading()) {
        <app-loading />
      } @else if (properties.error()) {
        <app-error (retry)="properties.reload()" />
      } @else if (properties.hasValue() && !properties.value().length) {
        <app-empty title="Primero registra un inmueble" text="La remodelación se hace sobre uno de tus inmuebles.">
          <a routerLink="/properties/new" class="btn btn-primary">Crear inmueble</a>
        </app-empty>
      } @else if (properties.hasValue()) {
        <form class="stack" (ngSubmit)="save()">
          <fieldset class="panel stack">
            <legend>La obra</legend>
            <div class="field">
              <label for="property">Inmueble *</label>
              <select id="property" class="select" name="property" required [(ngModel)]="propertyId">
                <option value="" disabled>Elige el inmueble</option>
                @for (p of properties.value(); track p.id) { <option [value]="p.id">{{ p.name }} · {{ p.city }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="title">Nombre de la obra *</label>
              <input id="title" class="input" name="title" required maxlength="150" [(ngModel)]="title" placeholder="Renovación de cocina y baño" />
            </div>
            <div class="field">
              <label for="description">Descripción general</label>
              <textarea id="description" class="textarea" rows="3" name="description" maxlength="2000" [(ngModel)]="description"></textarea>
            </div>
            <fieldset class="stack-sm">
              <legend class="text-base">Objetivo</legend>
              <div class="segmented">
                <label><input type="radio" name="goal" value="IMPROVEMENT" [(ngModel)]="goal" />Mejorar el inmueble</label>
                <label><input type="radio" name="goal" value="PRE_RENTAL" [(ngModel)]="goal" />Dejarlo listo para arrendar</label>
              </div>
            </fieldset>
            @if (goal === 'PRE_RENTAL') {
              <div class="form-grid">
                <div class="field">
                  <label for="rent">Canon meta (COP) *</label>
                  <input id="rent" type="number" class="input" name="rent" min="1" step="10000" inputmode="numeric" [(ngModel)]="targetRent" />
                  <span class="hint">Al terminar la obra puedes publicar el aviso de arriendo con este canon.</span>
                </div>
                <div class="field">
                  <label for="ready">Fecha objetivo</label>
                  <input id="ready" type="date" class="input" name="ready" [(ngModel)]="targetReadyDate" />
                </div>
              </div>
            }
          </fieldset>

          <fieldset class="panel stack">
            <legend>Requerimientos</legend>
            @for (req of requirements(); track $index; let i = $index) {
              <div class="requirement stack-sm">
                <div class="spread">
                  <strong>{{ i + 1 }}.</strong>
                  @if (requirements().length > 1) {
                    <button type="button" class="btn btn-ghost" (click)="removeRequirement(i)" [attr.aria-label]="'Quitar requerimiento ' + (i + 1)"><app-icon name="trash" />Quitar</button>
                  }
                </div>
                <div class="field">
                  <label [for]="'req-title-' + i">Qué hay que hacer *</label>
                  <input [id]="'req-title-' + i" class="input" [name]="'reqTitle' + i" required maxlength="150" [(ngModel)]="req.title" placeholder="Pintar paredes y techo de la sala" />
                </div>
                <div class="field">
                  <label [for]="'req-desc-' + i">Detalle *</label>
                  <textarea [id]="'req-desc-' + i" class="textarea" rows="2" [name]="'reqDesc' + i" required maxlength="2000" [(ngModel)]="req.description"
                            placeholder="Metros aproximados, materiales, estado actual."></textarea>
                </div>
                <div class="field">
                  <label [for]="'req-urg-' + i">Urgencia</label>
                  <select [id]="'req-urg-' + i" class="select" [name]="'reqUrg' + i" [(ngModel)]="req.urgencyLevel">
                    <option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option>
                  </select>
                </div>
                <div class="hint text-xs text-muted">
                  Pago 100 % digital por transferencia simulada al aprobar la cotización.
                </div>
              </div>
            }
            <div><button type="button" class="btn btn-secondary" (click)="addRequirement()"><app-icon name="plus" />Agregar requerimiento</button></div>
          </fieldset>

          @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
          <div class="form-actions">
            <a routerLink="/remodelings" class="btn btn-ghost">Cancelar</a>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Creando…' : 'Crear remodelación' }}</button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `.requirement { padding-bottom: var(--s-4); border-bottom: 1px solid var(--border); }`
})
export class RemodelingFormPage {
  private readonly api = inject(ProjectsApi);
  private readonly propertiesApi = inject(PropertiesApi);
  private readonly router = inject(Router);

  readonly properties = rxResource({ stream: () => this.propertiesApi.mine() });
  propertyId = '';
  title = '';
  description = '';
  goal: RemodelingGoal = 'IMPROVEMENT';
  targetRent: number | null = null;
  targetReadyDate = '';
  readonly requirements = signal<RequirementDraft[]>([{ title: '', description: '', urgencyLevel: 'MEDIUM', paymentMethod: 'TRANSFER' }]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  addRequirement(): void {
    this.requirements.update((list) => [...list, { title: '', description: '', urgencyLevel: 'MEDIUM', paymentMethod: 'TRANSFER' }]);
  }

  removeRequirement(index: number): void {
    this.requirements.update((list) => list.filter((_, i) => i !== index));
  }

  save(): void {
    this.error.set(null);
    const requirements = this.requirements().map((r) => ({ ...r, title: r.title.trim(), description: r.description.trim() }));
    if (!this.propertyId || !this.title.trim()) {
      this.error.set('Elige el inmueble y escribe el nombre de la obra.');
      return;
    }
    if (requirements.some((r) => !r.title || !r.description)) {
      this.error.set('Cada requerimiento necesita qué hacer y un detalle.');
      return;
    }
    if (this.goal === 'PRE_RENTAL' && !this.targetRent) {
      this.error.set('Indica el canon meta de la remodelación pre-arriendo.');
      return;
    }
    this.saving.set(true);
    this.api
      .createRemodeling({
        propertyId: this.propertyId,
        title: this.title.trim(),
        description: this.description.trim() || undefined,
        requirements,
        goal: this.goal,
        targetRent: this.goal === 'PRE_RENTAL' ? Number(this.targetRent) : undefined,
        targetReadyDate: this.goal === 'PRE_RENTAL' && this.targetReadyDate ? this.targetReadyDate : undefined
      })
      .subscribe({
        next: (project) => {
          this.saving.set(false);
          this.router.navigate(['/remodelings', project.id]);
        },
        error: (failure) => {
          this.saving.set(false);
          this.error.set(errorMessage(failure, 'No pudimos crear la remodelación.'));
        }
      });
  }
}
