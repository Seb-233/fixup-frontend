import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { MediaService } from '../../data/media.service';
import { PaymentMethod, UrgencyLevel } from '../../data/models';
import { PropertiesApi } from '../../data/properties.api';
import { RequestsApi } from '../../data/requests.api';
import { errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoPickerComponent } from '../../shared/ui/photo-picker.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

interface Option {
  id: string;
  label: string;
}

const URGENCY_HELP: Record<UrgencyLevel, string> = {
  LOW: 'Puede esperar unos días (un detalle estético, una puerta que roza).',
  MEDIUM: 'Molesta el uso normal del inmueble (una llave que gotea).',
  HIGH: 'Impide usar una parte del inmueble (sin agua caliente, un tomacorriente quemado).',
  URGENT: 'Riesgo para personas o daño mayor (fuga fuerte, olor a gas, cables expuestos).'
};

@Component({
  selector: 'app-new-request-page',
  imports: [FormsModule, RouterLink, IconComponent, PhotoPickerComponent, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <a routerLink="/requests" class="back-link"><app-icon name="chevron-left" [size]="16" />Solicitudes</a>
      <header class="page-header">
        <div>
          @if (fromIdea()) {
            <h1>Pedir una obra parecida</h1>
            <p class="lede">Cuenta qué quieres hacer y en qué inmueble. Los técnicos verificados de esa especialidad en tu ciudad te enviarán su cotización.</p>
          } @else {
            <h1>Reportar un daño</h1>
            <p class="lede">Describe qué pasó y adjunta fotos. Fix&amp;Rent detecta la especialidad y la solicitud les aparece a los técnicos verificados de esa especialidad en la ciudad del inmueble.</p>
          }
        </div>
      </header>

      @if (options.isLoading()) {
        <app-loading text="Cargando tus inmuebles…" />
      } @else if (options.error()) {
        <app-error (retry)="options.reload()" />
      } @else if (options.hasValue() && !options.value().length) {
        <app-empty [title]="isTenant() ? 'No tienes un inmueble para reportar' : 'Primero registra un inmueble'"
                   [text]="isTenant() ? 'Solo se reportan daños del inmueble que arriendas con un contrato vigente en Fix&Rent.' : 'Las solicitudes se asocian a uno de tus inmuebles.'">
          @if (!isTenant()) { <a routerLink="/properties/new" class="btn btn-primary">Crear inmueble</a> }
        </app-empty>
      } @else if (options.hasValue()) {
        <form #f="ngForm" class="panel stack" (ngSubmit)="submit(f.valid ?? false)" novalidate>
          <div class="field">
            <label for="property">Inmueble *</label>
            <select id="property" name="property" class="select" required [(ngModel)]="propertyId" #property="ngModel"
                    [attr.aria-invalid]="submitted() && property.invalid">
              <option value="" disabled>Elige el inmueble</option>
              @for (o of options.value(); track o.id) {
                <option [value]="o.id">{{ o.label }}</option>
              }
            </select>
            @if (submitted() && property.invalid) { <span class="error">Elige el inmueble del daño.</span> }
          </div>

          <div class="field">
            <label for="title">{{ fromIdea() ? '¿Qué quieres hacer?' : '¿Qué se dañó?' }} *</label>
            <input id="title" name="title" class="input" required minlength="5" maxlength="150" [(ngModel)]="title" #titleRef="ngModel"
                   placeholder="Fuga en el lavaplatos de la cocina" [attr.aria-invalid]="submitted() && titleRef.invalid" />
            @if (submitted() && titleRef.invalid) { <span class="error">Escribe un título de al menos 5 caracteres.</span> }
          </div>

          <div class="field">
            <label for="description">Descripción *</label>
            <textarea id="description" name="description" class="textarea" rows="5" required minlength="15" maxlength="2000"
                      [(ngModel)]="description" #descriptionRef="ngModel" [attr.aria-invalid]="submitted() && descriptionRef.invalid"
                      placeholder="Desde cuándo pasa, dónde exactamente, si ya intentaste algo…"></textarea>
            <span class="hint">Las palabras que uses (tubo, enchufe, pintura, puerta) definen qué técnicos reciben la solicitud.</span>
            @if (submitted() && descriptionRef.invalid) { <span class="error">Describe el daño con al menos 15 caracteres.</span> }
          </div>

          <fieldset class="stack-sm">
            <legend class="text-base">Urgencia</legend>
            <div class="segmented">
              @for (u of urgencies; track u.value) {
                <label><input type="radio" name="urgency" [value]="u.value" [(ngModel)]="urgency" />{{ u.label }}</label>
              }
            </div>
            <span class="hint text-sm text-muted">{{ urgencyHelp[urgency] }}</span>
          </fieldset>

          @if (!isTenant()) {
            <fieldset class="stack-sm">
              <legend class="text-base">¿Cómo se paga el trabajo?</legend>
              <div class="segmented">
                @for (m of methods; track m.value) {
                  <label><input type="radio" name="paymentMethod" [value]="m.value" [(ngModel)]="paymentMethod" />{{ m.label }}</label>
                }
              </div>
              <span class="hint text-sm text-muted">{{ methodHelp[paymentMethod] }}</span>
            </fieldset>
          } @else {
            <p class="hint text-sm text-muted">El propietario paga el arreglo por transferencia en la pasarela de Fix&amp;Rent.</p>
          }
          <div class="field">
            <span class="field-label">Fotos del daño</span>
            <app-photo-picker [max]="6" (changed)="files.set($event)" />
          </div>

          @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }

          <div class="form-actions">
            <a routerLink="/requests" class="btn btn-ghost">Cancelar</a>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? step() : 'Enviar solicitud' }}</button>
          </div>
        </form>
      }
    </div>
  `
})
export class NewRequestPage implements OnInit {
  private readonly requests = inject(RequestsApi);
  private readonly properties = inject(PropertiesApi);
  private readonly media = inject(MediaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly user = inject(CurrentUserStore);

  readonly isTenant = computed(() => this.user.activeRole() === 'TENANT');
  readonly urgencyHelp = URGENCY_HELP;
  // FR-UC-05: lo acuerda quien paga al abrir la solicitud; un arrendatario no lo elige.
  readonly methods: { value: PaymentMethod; label: string }[] = [
    { value: 'TRANSFER', label: 'Transferencia' },
    { value: 'CASH', label: 'Efectivo' }
  ];
  readonly methodHelp: Record<PaymentMethod, string> = {
    TRANSFER: 'Pagas en la pasarela de prueba al elegir la cotización; el técnico empieza cuando el pago queda aprobado.',
    CASH: 'Le pagas al técnico al terminar. Si queda un saldo, lo pagas antes de abrir otra solicitud.'
  };
  readonly urgencies: { value: UrgencyLevel; label: string }[] = [
    { value: 'LOW', label: 'Baja' },
    { value: 'MEDIUM', label: 'Media' },
    { value: 'HIGH', label: 'Alta' },
    { value: 'URGENT', label: 'Urgente' }
  ];

  // Arrendatarios: solo inmuebles con contrato vigente (lo decide el backend). Propietarios e
  // inmobiliarias: los inmuebles que administran.
  readonly options = rxResource({
    params: () => this.user.activeRole(),
    stream: ({ params }) =>
      params === 'TENANT'
        ? this.requests.reportableProperties().pipe(
            switchMap((list) => of<Option[]>(list.map((p) => ({ id: p.propertyId, label: `${p.name} · ${p.address}, ${p.city}` }))))
          )
        : this.properties.mine().pipe(
            switchMap((list) => of<Option[]>(list.map((p) => ({ id: p.id, label: `${p.name} · ${p.address}, ${p.city}` }))))
          )
  });

  propertyId = '';
  title = '';
  readonly fromIdea = signal(false);
  description = '';
  urgency: UrgencyLevel = 'MEDIUM';
  paymentMethod: PaymentMethod = 'TRANSFER';
  readonly files = signal<File[]>([]);
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly step = signal('');
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    this.propertyId = query.get('propertyId') ?? '';
    // Desde una idea del feed llega el título de la obra que la persona quiere replicar.
    this.title = (query.get('title') ?? '').slice(0, 150);
    this.fromIdea.set(!!this.title);
  }

  submit(valid: boolean): void {
    this.submitted.set(true);
    if (!valid) {
      this.error.set('Revisa los campos marcados.');
      return;
    }
    this.error.set(null);
    this.saving.set(true);
    const files = this.files();
    this.step.set(files.length ? 'Subiendo fotos…' : 'Enviando…');
    (files.length ? this.media.uploadAll(files, 'REPAIR_REQUEST') : of<string[]>([]))
      .pipe(
        switchMap((mediaIds) => {
          this.step.set('Enviando…');
          return this.requests.create({
            propertyId: this.propertyId,
            title: this.title.trim(),
            description: this.description.trim(),
            mediaIds,
            urgencyLevel: this.urgency,
            paymentMethod: this.isTenant() ? undefined : this.paymentMethod
          });
        })
      )
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.router.navigate(['/requests', created.requestId]);
        },
        error: (failure) => {
          this.saving.set(false);
          this.error.set(errorMessage(failure, 'No pudimos enviar la solicitud. Inténtalo de nuevo.'));
        }
      });
  }
}
