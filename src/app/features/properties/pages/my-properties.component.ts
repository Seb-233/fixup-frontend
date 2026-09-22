import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PropertyControllerService, PropertySummary } from '../../../api/generated';

@Component({
  selector: 'app-my-properties',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="properties-page">
      <header>
        <h1>Mis propiedades</h1>
        <p>Registra tus propiedades para crear solicitudes de reparación con información precisa.</p>
      </header>

      <article class="block">
        <h2>Registrar propiedad</h2>
        <form [formGroup]="form" (ngSubmit)="create()" class="form">
          <label>
            <span>Nombre</span>
            <input type="text" formControlName="name" maxlength="150" placeholder="Apartamento 301" />
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <small>Escribe un nombre.</small>
            }
          </label>
          <label>
            <span>Dirección</span>
            <input type="text" formControlName="address" maxlength="250" placeholder="Carrera 7 # 40-62" />
            @if (form.controls.address.touched && form.controls.address.invalid) {
              <small>Escribe una dirección.</small>
            }
          </label>
          <label>
            <span>Ciudad</span>
            <input type="text" formControlName="city" maxlength="120" placeholder="Bogotá" />
            @if (form.controls.city.touched && form.controls.city.invalid) {
              <small>Escribe una ciudad.</small>
            }
          </label>
          <label>
            <span>Área (m²)</span>
            <input type="number" formControlName="areaM2" min="0.01" step="0.01" />
            @if (form.controls.areaM2.touched && form.controls.areaM2.invalid) {
              <small>Indica un área mayor que cero.</small>
            }
          </label>

          @if (createError()) {
            <p class="error">{{ createError() }}</p>
          }
          @if (createSuccess()) {
            <p class="success">{{ createSuccess() }}</p>
          }

          <button type="submit" [disabled]="form.invalid || creating()">
            {{ creating() ? 'Registrando…' : 'Registrar propiedad' }}
          </button>
        </form>
      </article>

      <article class="block">
        <h2>Propiedades registradas</h2>
        @if (loading()) {
          <p> Cargando propiedades… </p>
        } @else if (loadError()) {
          <p class="error">{{ loadError() }}</p>
        } @else if (properties().length === 0) {
          <p>Aún no tienes propiedades registradas. Registra una antes de crear solicitudes.</p>
        } @else {
          <ul class="properties-list">
            @for (property of properties(); track property.id) {
              <li class="property-card">
                <div>
                  <h3>{{ property.name }}</h3>
                  <p>{{ property.address }}</p>
                  <p>{{ property.city }} · {{ property.areaM2 }} m²</p>
                </div>
                @if (property.id) {
                  <a [routerLink]="['/requests']" [queryParams]="{ propertyId: property.id }">Crear solicitud</a>
                }
              </li>
            }
          </ul>
        }
      </article>
    </section>
  `,
  styles: [`
    .properties-page { display: flex; flex-direction: column; gap: 1.25rem; max-width: 860px; margin: 0 auto; }
    h1, h2, h3 { color: var(--fixup-color-primary); font-family: var(--fixup-font-heading); }
    h1 { margin: 0; font-size: 1.5rem; }
    header p, .property-card p { color: #666; margin: 0.25rem 0; }
    .block { background: #fff; border: 1px solid rgba(154, 148, 141, 0.2); border-radius: var(--fixup-radius-lg); padding: 1.25rem; }
    h2 { font-size: 1.05rem; margin: 0 0 0.85rem; }
    .form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; }
    label { display: flex; flex-direction: column; gap: 0.3rem; color: #666; font-size: 0.82rem; }
    input { border: 1px solid rgba(154, 148, 141, 0.4); border-radius: var(--fixup-radius-md); padding: 0.55rem 0.7rem; font: inherit; }
    small, .error { color: #b91c1c; }
    .error, .success, button { grid-column: 1 / -1; margin: 0; }
    .success { color: #047857; }
    button { justify-self: start; background: var(--fixup-color-primary); color: #fff; border: 0; border-radius: var(--fixup-radius-md); padding: 0.65rem 1.4rem; font: inherit; font-weight: 700; }
    button:disabled { opacity: 0.5; }
    .properties-list { display: grid; gap: 0.75rem; list-style: none; margin: 0; padding: 0; }
    .property-card { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 0.85rem; background: #faf9f6; border: 1px solid #efece5; border-radius: var(--fixup-radius-md); }
    .property-card h3 { margin: 0; font-size: 0.95rem; }
    a { color: var(--fixup-color-accent); font-weight: 700; }
    @media (max-width: 640px) { .form { grid-template-columns: 1fr; } .property-card { align-items: flex-start; flex-direction: column; } }
  `]
})
export class MyPropertiesComponent implements OnInit {
  private readonly propertyApi = inject(PropertyControllerService);
  private readonly fb = inject(FormBuilder);

  readonly properties = signal<PropertySummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly createSuccess = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    address: ['', Validators.required],
    city: ['', Validators.required],
    areaM2: [0, [Validators.required, Validators.min(0.01)]]
  });

  ngOnInit(): void {
    this.load();
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, address, city, areaM2 } = this.form.getRawValue();
    this.creating.set(true);
    this.createError.set(null);
    this.createSuccess.set(null);
    this.propertyApi.create({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      areaM2
    }, 'body', false, { httpHeaderAccept: 'application/json' } as never).subscribe({
      next: (property) => {
        this.properties.update((current) => [property, ...current]);
        this.form.reset({ name: '', address: '', city: '', areaM2: 0 });
        this.createSuccess.set('Propiedad registrada correctamente.');
        this.creating.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.createError.set(
          error.status === 400
            ? 'Los datos de la propiedad son inválidos.'
            : error.status === 403
              ? 'Tu cuenta no tiene autorización para registrar propiedades.'
              : 'No pudimos registrar la propiedad. Intenta nuevamente.'
        );
        this.creating.set(false);
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.propertyApi.listOwn('body', false, { httpHeaderAccept: 'application/json' } as never).subscribe({
      next: (properties) => {
        this.properties.set(properties);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No pudimos cargar tus propiedades.');
        this.loading.set(false);
      }
    });
  }
}
