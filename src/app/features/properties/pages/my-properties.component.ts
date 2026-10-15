import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LocationControllerService, PropertyControllerService, PropertySummary } from '../../../api/generated';
import { GeocodingCandidate } from '../models/geocoding.models';
import { GeocodingStore } from '../services/geocoding.store';
import { PropertyConfirmMapComponent } from '../components/property-confirm-map/property-confirm-map.component';

export type PropertyLocationState = 'UNRESOLVED' | 'RESOLVING' | 'CONFIRMED';

@Component({
  selector: 'app-my-properties',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PropertyConfirmMapComponent],
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

          <div class="location-section">
            <div class="location-header">
              <span class="location-label">Validación geográfica obligatoria</span>
              <button
                type="button"
                id="btn-lookup-location"
                class="btn-lookup"
                (click)="lookupLocation()"
                [disabled]="!canLookupLocation() || locationState() === 'RESOLVING' || geocodingStore.isGeocoding()"
              >
                {{ locationState() === 'RESOLVING' || geocodingStore.isGeocoding() ? 'Buscando en el mapa…' : 'Ubicar en el mapa' }}
              </button>
            </div>

            @if (locationState() === 'RESOLVING' || geocodingStore.isGeocoding()) {
              <p class="lookup-status">Geocodificando dirección y localizando en el mapa…</p>
            }

            @if (lookupError()) {
              <p class="error location-error">{{ lookupError() }}</p>
            }

            @if (geocodingStore.errorMessage()) {
              <p class="error location-error">{{ geocodingStore.errorMessage() }}</p>
            }

            @if (locationState() === 'CONFIRMED' && confirmedLocation(); as loc) {
              <div class="confirmed-location-card">
                <div class="confirmed-header">
                  <div class="selected-icon-badge" aria-hidden="true">✓</div>
                  <div class="confirmed-info">
                    <strong>Punto confirmado en el mapa</strong>
                    <p class="selected-display-name">{{ loc.displayName }}</p>
                  </div>
                </div>

                @if (reverseGeocodeWarning()) {
                  <p class="reverse-warning">{{ reverseGeocodeWarning() }}</p>
                }

                <div class="map-container-box">
                  <app-property-confirm-map
                    [latitude]="loc.latitude"
                    [longitude]="loc.longitude"
                    [addressLabel]="loc.displayName"
                    [isReverseGeocoding]="isReverseGeocoding()"
                    (positionChanged)="onMarkerPositionChanged($event)"
                  />
                </div>
              </div>
            } @else if (locationState() === 'UNRESOLVED') {
              <p class="location-hint">Debes escribir la dirección y confirmar el punto en el mapa antes de registrar la propiedad.</p>
            }
          </div>

          @if (createError()) {
            <p class="error">{{ createError() }}</p>
          }
          @if (createSuccess()) {
            <p class="success">{{ createSuccess() }}</p>
          }

          <button
            type="submit"
            id="btn-register-property"
            class="btn-submit"
            [disabled]="form.invalid || creating() || locationState() !== 'CONFIRMED'"
          >
            {{ creating() ? 'Registrando…' : 'Registrar propiedad' }}
          </button>
        </form>
      </article>

      <article class="block">
        <h2>Propiedades registradas</h2>
        @if (loading()) {
          <p>Cargando propiedades…</p>
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
    h1, h2, h3 { color: var(--fixup-color-primary, #2D2E31); font-family: var(--fixup-font-heading); }
    h1 { margin: 0; font-size: 1.5rem; }
    header p, .property-card p { color: #666; margin: 0.25rem 0; }
    .block { background: #fff; border: 1px solid rgba(154, 148, 141, 0.2); border-radius: var(--fixup-radius-lg, 12px); padding: 1.25rem; }
    h2 { font-size: 1.05rem; margin: 0 0 0.85rem; }
    .form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; }
    label { display: flex; flex-direction: column; gap: 0.3rem; color: #666; font-size: 0.82rem; }
    input { border: 1px solid rgba(154, 148, 141, 0.4); border-radius: var(--fixup-radius-md, 8px); padding: 0.55rem 0.7rem; font: inherit; }
    small, .error { color: #b91c1c; }
    .error, .success, .btn-submit, .location-section { grid-column: 1 / -1; margin: 0; }
    .success { color: #047857; }
    .btn-submit { justify-self: start; background: var(--fixup-color-primary, #2D2E31); color: #fff; border: 0; border-radius: var(--fixup-radius-md, 8px); padding: 0.65rem 1.4rem; font: inherit; font-weight: 700; cursor: pointer; transition: opacity .2s; }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Sección de ubicación */
    .location-section { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.9rem; background: #faf9f6; border: 1px solid #efece5; border-radius: 8px; margin-top: 0.2rem; }
    .location-header { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .location-label { font-size: 0.85rem; font-weight: 600; color: #4A463F; }
    .btn-lookup { background: #fff; color: #2D2E31; border: 1px solid #CEAC78; border-radius: 6px; padding: 0.4rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all .2s; }
    .btn-lookup:hover:not(:disabled) { background: #CEAC78; color: #fff; }
    .btn-lookup:disabled { opacity: 0.5; cursor: not-allowed; }
    .lookup-status, .location-hint { font-size: 0.82rem; margin: 0; color: #7A756D; }
    .location-error { margin: 0; font-size: 0.82rem; }
    .reverse-warning { font-size: 0.82rem; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 0.4rem 0.6rem; margin: 0; }

    .confirmed-location-card { display: flex; flex-direction: column; gap: 0.75rem; background: #fff; border: 1px solid #a7f3d0; border-radius: 8px; padding: 0.75rem; }
    .confirmed-header { display: flex; align-items: center; gap: 0.7rem; }
    .selected-icon-badge { width: 24px; height: 24px; border-radius: 50%; background: #059669; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
    .confirmed-info strong { display: block; font-size: 0.84rem; color: #065f46; }
    .selected-display-name { margin: 0.15rem 0 0; font-size: 0.82rem; color: #047857; line-height: 1.35; }
    .map-container-box { width: 100%; margin-top: 0.25rem; }

    .properties-list { display: grid; gap: 0.75rem; list-style: none; margin: 0; padding: 0; }
    .property-card { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 0.85rem; background: #faf9f6; border: 1px solid #efece5; border-radius: var(--fixup-radius-md, 8px); }
    .property-card h3 { margin: 0; font-size: 0.95rem; }
    a { color: var(--fixup-color-accent, #B9975B); font-weight: 700; text-decoration: none; }
    @media (max-width: 640px) { .form { grid-template-columns: 1fr; } .property-card { align-items: flex-start; flex-direction: column; } }
  `]
})
export class MyPropertiesComponent implements OnInit, OnDestroy {
  private readonly propertyApi = inject(PropertyControllerService);
  private readonly locationApi = inject(LocationControllerService);
  private readonly fb = inject(FormBuilder);
  readonly geocodingStore = inject(GeocodingStore);

  readonly properties = signal<PropertySummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly createSuccess = signal<string | null>(null);

  readonly locationState = signal<PropertyLocationState>('UNRESOLVED');
  readonly confirmedLocation = signal<GeocodingCandidate | null>(null);
  readonly selectedLocation = computed(() => this.confirmedLocation());
  readonly isReverseGeocoding = signal(false);
  readonly lookupError = signal<string | null>(null);
  readonly reverseGeocodeWarning = signal<string | null>(null);

  private addressSub?: Subscription;
  private citySub?: Subscription;
  private reverseSub?: Subscription;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    address: ['', Validators.required],
    city: ['', Validators.required],
    areaM2: [0, [Validators.required, Validators.min(0.01)]]
  });

  constructor() {
    effect(() => {
      const state = this.geocodingStore.state();
      if (state === 'candidates') {
        const candidates = this.geocodingStore.candidates();
        if (candidates.length > 0 && !this.confirmedLocation()) {
          const top = candidates[0];
          this.confirmedLocation.set(top);
          this.locationState.set('CONFIRMED');
          this.geocodingStore.selectCandidate(top);
        }
      } else if (state === 'empty') {
        this.locationState.set('UNRESOLVED');
        this.lookupError.set('No se encontraron ubicaciones para la dirección indicada. Verifica los datos.');
      } else if (state === 'error') {
        this.locationState.set('UNRESOLVED');
        this.lookupError.set(this.geocodingStore.errorMessage() ?? 'Error al buscar ubicación');
      }
    });
  }

  ngOnInit(): void {
    this.geocodingStore.reset();
    this.load();

    this.addressSub = this.form.controls.address.valueChanges.subscribe(() => {
      this.invalidateLocation();
    });

    this.citySub = this.form.controls.city.valueChanges.subscribe(() => {
      this.invalidateLocation();
    });
  }

  ngOnDestroy(): void {
    this.addressSub?.unsubscribe();
    this.citySub?.unsubscribe();
    this.reverseSub?.unsubscribe();
  }

  canLookupLocation(): boolean {
    const address = this.form.controls.address.value.trim();
    const city = this.form.controls.city.value.trim();
    return address.length > 0 && city.length > 0;
  }

  lookupLocation(): void {
    const address = this.form.controls.address.value.trim();
    const city = this.form.controls.city.value.trim();
    if (!address || !city) return;

    this.confirmedLocation.set(null);
    this.lookupError.set(null);
    this.reverseGeocodeWarning.set(null);
    this.locationState.set('RESOLVING');

    const query = `${address}, ${city}`;
    this.geocodingStore.geocode(query);
  }

  selectCandidate(candidate: GeocodingCandidate): void {
    this.confirmedLocation.set(candidate);
    this.locationState.set('CONFIRMED');
    this.geocodingStore.selectCandidate(candidate);
  }

  onMarkerPositionChanged(coords: { latitude: number; longitude: number }): void {
    this.isReverseGeocoding.set(true);
    this.reverseGeocodeWarning.set(null);

    this.reverseSub?.unsubscribe();
    this.reverseSub = this.locationApi.reverseGeocode(coords.latitude, coords.longitude, 'body').subscribe({
      next: (candidates: GeocodingCandidate[]) => {
        this.isReverseGeocoding.set(false);
        if (candidates && candidates.length > 0) {
          const rev = candidates[0];
          this.confirmedLocation.set({
            displayName: rev.displayName,
            latitude: coords.latitude,
            longitude: coords.longitude
          });
          this.locationState.set('CONFIRMED');

          // Actualizar address/city sin disparar invalidación de ubicación
          const parts = rev.displayName.split(',').map((p) => p.trim());
          if (parts[0]) {
            this.form.controls.address.setValue(parts[0], { emitEvent: false });
          }
          if (parts.length >= 3 && parts[2]) {
            this.form.controls.city.setValue(parts[2], { emitEvent: false });
          } else if (parts[1]) {
            this.form.controls.city.setValue(parts[1], { emitEvent: false });
          }
        } else {
          this.confirmedLocation.set({
            displayName: 'Punto ajustado en el mapa',
            latitude: coords.latitude,
            longitude: coords.longitude
          });
          this.locationState.set('CONFIRMED');
          this.reverseGeocodeWarning.set(
            'Punto ajustado en el mapa, pero no se pudo determinar el nombre exacto de la vía. Revisa la dirección escrita.'
          );
        }
      },
      error: () => {
        this.isReverseGeocoding.set(false);
        this.confirmedLocation.set({
          displayName: 'Punto ajustado en el mapa',
          latitude: coords.latitude,
          longitude: coords.longitude
        });
        this.locationState.set('CONFIRMED');
        this.reverseGeocodeWarning.set(
          'No pudimos actualizar la dirección automáticamente para el punto seleccionado. El marcador se mantiene en las nuevas coordenadas.'
        );
      }
    });
  }

  private invalidateLocation(): void {
    this.confirmedLocation.set(null);
    this.locationState.set('UNRESOLVED');
    this.lookupError.set(null);
    this.reverseGeocodeWarning.set(null);
    this.geocodingStore.reset();
  }

  create(): void {
    const location = this.confirmedLocation();
    if (this.form.invalid || !location || this.locationState() !== 'CONFIRMED') {
      this.form.markAllAsTouched();
      return;
    }

    const { name, address, city, areaM2 } = this.form.getRawValue();
    this.creating.set(true);
    this.createError.set(null);
    this.createSuccess.set(null);

    this.propertyApi.create1({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      areaM2,
      latitude: location.latitude,
      longitude: location.longitude
    }, 'body', false, { httpHeaderAccept: 'application/json' } as never).subscribe({
      next: (property: PropertySummary) => {
        this.properties.update((current) => [property, ...current]);
        this.form.reset({ name: '', address: '', city: '', areaM2: 0 });
        this.confirmedLocation.set(null);
        this.locationState.set('UNRESOLVED');
        this.reverseGeocodeWarning.set(null);
        this.geocodingStore.reset();
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
