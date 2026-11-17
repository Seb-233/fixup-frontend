import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FixerVerificationDocumentType, Specialty } from '../../data/models';
import { rejectFile } from '../../data/media.service';
import { SPECIALTY, SPECIALTIES, VERIFICATION_STATUS } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, LabelPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';
import { FixerVerificationStore } from './pages/verification/fixer-verification.store';
import { CONSENT_VERSION, VERIFICATION_DOCUMENT_TYPES } from './utils/fixer-verification-ui.helpers';

// Verificación del técnico (FR-UC-23): especialidades, documentos y estado de la revisión.
@Component({
  selector: 'app-verification-page',
  imports: [RouterLink, IconComponent, StatusComponent, LabelPipe, DayPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <header class="page-header">
        <div>
          <h1>Verificación</h1>
          <p class="lede">Para cotizar y aparecer en el directorio, Fix&amp;Rent revisa tu identidad y tu oficio una sola vez. Los documentos solo los ve el equipo de soporte.</p>
        </div>
      </header>

      @if (store.loading() && !store.verification()) {
        <app-loading text="Cargando tu verificación…" />
      } @else if (store.error() && !store.verification()) {
        <app-error [message]="store.error()!" (retry)="store.load()" />
      } @else if (store.verification(); as v) {
        <section class="panel stack-sm status-panel" [class.ok]="v.status === 'VERIFIED'">
          <div class="spread">
            <h2 class="text-lg">Estado</h2>
            <app-status [map]="statusMap" [value]="v.status" />
          </div>
          @switch (v.status) {
            @case ('VERIFIED') {
              <p class="text-sm">Estás verificado desde el {{ v.decidedAt | day }}. Ya puedes cotizar solicitudes y publicar tu portafolio.</p>
              <div class="cluster">
                <a routerLink="/requests/inbox" class="btn btn-primary">Ver solicitudes disponibles</a>
                <a routerLink="/fixers/portfolio" class="btn btn-secondary">Mi portafolio</a>
              </div>
            }
            @case ('REJECTED') {
              <p class="text-sm">La revisión no fue aprobada: {{ v.rejectionReason || 'sin motivo registrado' }}. Corrige los documentos y vuelve a enviarlos.</p>
            }
            @case ('SUSPENDED') {
              <p class="text-sm">Tu perfil está suspendido. Escribe a soporte para revisar tu caso.</p>
            }
            @default {
              @if (v.underReview) {
                <p class="text-sm">Recibimos tus documentos el {{ v.submittedAt | day }}. El equipo de soporte los está revisando.</p>
              } @else {
                <p class="text-sm">Completa tus especialidades y sube la cédula y el certificado del oficio. La revisión empieza sola cuando estén los dos.</p>
              }
            }
          }
        </section>

        <section class="panel stack" aria-labelledby="spec-title">
          <div class="stack-sm">
            <h2 id="spec-title" class="text-lg">Especialidades</h2>
            <p class="text-sm text-muted">Recibes solicitudes de estas especialidades en tu ciudad.</p>
          </div>
          <div class="specialties">
            @for (s of specialties; track s) {
              <label class="check">
                <input type="checkbox" [checked]="chosen().includes($any(s))" (change)="toggleSpecialty($any(s), $any($event.target).checked)" [disabled]="v.status === 'SUSPENDED'" />
                <span>{{ s | label: specialtyNames }}</span>
              </label>
            }
          </div>
          <div class="cluster">
            <button type="button" class="btn btn-secondary" (click)="saveSpecialties()" [disabled]="store.submitting() || !specialtiesChanged() || !chosen().length">Guardar especialidades</button>
            @if (!chosen().length) { <span class="text-sm" style="color: var(--danger)">Elige al menos una.</span> }
          </div>
        </section>

        <section class="panel stack" aria-labelledby="docs-title">
          <h2 id="docs-title" class="text-lg">Documentos</h2>
          <ul class="list docs">
            @for (doc of documents; track doc.type) {
              <li class="doc">
                <span class="stack-sm grow">
                  <span class="row-title">{{ doc.label }}{{ doc.required ? '' : ' (opcional)' }}</span>
                  <span class="row-meta">
                    @if (submitted(doc.type)) { Entregado } @else { {{ doc.required ? 'Pendiente, obligatorio' : 'Pendiente' }} }
                  </span>
                </span>
                @if (store.uploadingType() === doc.type) {
                  <span class="text-sm" role="status"><span class="spinner inline" aria-hidden="true"></span> {{ store.uploadStep() }}</span>
                } @else if (v.status !== 'VERIFIED' && v.status !== 'SUSPENDED') {
                  <label class="btn" [class.btn-secondary]="!submitted(doc.type)" [class.btn-ghost]="submitted(doc.type)">
                    <app-icon name="upload" />{{ submitted(doc.type) ? 'Reemplazar' : 'Subir foto' }}
                    <input type="file" class="visually-hidden" accept="image/jpeg,image/png,image/webp" (change)="upload(doc.type, $event)" [disabled]="store.uploadingType() !== null" />
                  </label>
                } @else if (submitted(doc.type)) {
                  <app-icon name="check" />
                }
              </li>
            }
          </ul>
          @if (v.status !== 'VERIFIED') {
            <label class="check">
              <input type="checkbox" [checked]="consent()" (change)="consent.set($any($event.target).checked)" />
              <span class="text-sm">Autorizo a Fix&amp;Rent a tratar mis datos personales y documentos solo para verificar mi identidad y mi oficio (versión {{ consentVersion }}).</span>
            </label>
          }
          @if (fileError()) { <div class="alert alert-danger" role="alert">{{ fileError() }}</div> }
          @if (store.uploadError()) { <div class="alert alert-danger" role="alert">{{ store.uploadError() }}</div> }
          @if (store.error()) { <div class="alert alert-danger" role="alert">{{ store.error() }}</div> }
        </section>
      }
    </div>
  `,
  styles: `
    .status-panel.ok { border-color: var(--success); }
    .specialties { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0 var(--s-4); }
    .doc { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) 0; }
    .grow { flex: 1; min-width: 0; }
    .btn:has(input:focus-visible) { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
    .spinner.inline { display: inline-block; vertical-align: middle; width: 14px; height: 14px; }
  `
})
export class VerificationPage implements OnInit {
  readonly store = inject(FixerVerificationStore);
  readonly statusMap = VERIFICATION_STATUS;
  readonly specialties = SPECIALTIES;
  readonly specialtyNames = SPECIALTY;
  readonly documents = VERIFICATION_DOCUMENT_TYPES;
  readonly consentVersion = CONSENT_VERSION;
  readonly consent = signal(false);
  readonly fileError = signal<string | null>(null);
  readonly chosen = signal<Specialty[]>([]);
  readonly specialtiesChanged = computed(() => {
    const saved = [...this.store.specialties()].sort().join();
    return saved !== [...this.chosen()].sort().join();
  });

  constructor() {
    effect(() => this.chosen.set([...this.store.specialties()]));
  }

  ngOnInit(): void {
    this.store.load();
  }

  submitted(type: FixerVerificationDocumentType): boolean {
    return this.store.submittedDocuments().includes(type);
  }

  toggleSpecialty(specialty: Specialty, on: boolean): void {
    this.chosen.update((list) => (on ? [...new Set([...list, specialty])] : list.filter((s) => s !== specialty)));
  }

  saveSpecialties(): void {
    this.store.updateSpecialties(this.chosen());
  }

  upload(type: FixerVerificationDocumentType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const problem = rejectFile(file);
    if (problem) {
      this.fileError.set(problem);
      return;
    }
    this.fileError.set(null);
    this.store.uploadDocument(type, file, this.consent() ? CONSENT_VERSION : undefined);
  }
}
