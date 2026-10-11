import { Component, effect, input, output } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { LocationCoordinates } from '../../models/location.models';
import {
  DEFAULT_RADIUS_KM,
  PropertySearchParameters,
  RADIUS_OPTIONS_KM
} from '../../models/property-search.models';

// El radio debe ser estrictamente mayor que cero (Validators.min(0) aceptaría 0).
function greaterThanZero(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  return Number(value) > 0 ? null : { greaterThanZero: true };
}

// FR-UC-06: formulario de coordenadas y radio. No consulta ubicación ni backend: delega
// en la página mediante eventos y recibe las coordenadas por entrada.
@Component({
  selector: 'app-property-search-filters',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="filters" novalidate>
      <div class="location-action">
        <button
          type="button"
          id="use-my-location"
          class="secondary"
          [disabled]="locating()"
          (click)="useLocation.emit()"
        >
          {{ locating() ? 'Obteniendo ubicación…' : 'Usar mi ubicación' }}
        </button>
      </div>

      <div class="field">
        <label for="search-latitude">Latitud</label>
        <input
          id="search-latitude"
          type="number"
          inputmode="decimal"
          step="any"
          formControlName="latitude"
          [attr.aria-invalid]="latitudeError() ? 'true' : null"
          [attr.aria-describedby]="latitudeError() ? 'search-latitude-error' : null"
          placeholder="Ej. 4.6533"
        />
        @if (latitudeError(); as message) {
          <small id="search-latitude-error" class="error">{{ message }}</small>
        }
      </div>

      <div class="field">
        <label for="search-longitude">Longitud</label>
        <input
          id="search-longitude"
          type="number"
          inputmode="decimal"
          step="any"
          formControlName="longitude"
          [attr.aria-invalid]="longitudeError() ? 'true' : null"
          [attr.aria-describedby]="longitudeError() ? 'search-longitude-error' : null"
          placeholder="Ej. -74.0836"
        />
        @if (longitudeError(); as message) {
          <small id="search-longitude-error" class="error">{{ message }}</small>
        }
      </div>

      <div class="field">
        <label for="search-radius">Radio de búsqueda</label>
        <select
          id="search-radius"
          formControlName="radiusKm"
          [attr.aria-invalid]="radiusError() ? 'true' : null"
          [attr.aria-describedby]="radiusError() ? 'search-radius-error' : null"
        >
          @for (option of radiusOptions; track option) {
            <option [ngValue]="option">{{ option }} km</option>
          }
        </select>
        @if (radiusError(); as message) {
          <small id="search-radius-error" class="error">{{ message }}</small>
        }
      </div>

      <div class="submit-action">
        <button type="submit" id="search-submit" class="primary" [disabled]="locating()">
          Buscar propiedades
        </button>
      </div>
    </form>
  `,
  styleUrls: ['./property-search-filters.component.scss']
})
export class PropertySearchFiltersComponent {
  /** Coordenadas obtenidas del dispositivo; al cambiar rellenan latitud y longitud. */
  readonly coordinates = input<LocationCoordinates | null>(null);
  /** Mientras es true se bloquean las acciones que dependen de la ubicación. */
  readonly locating = input(false);

  readonly useLocation = output<void>();
  readonly searchRequested = output<PropertySearchParameters>();

  readonly radiusOptions = RADIUS_OPTIONS_KM;

  readonly form = new FormGroup({
    latitude: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(-90),
      Validators.max(90)
    ]),
    longitude: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(-180),
      Validators.max(180)
    ]),
    radiusKm: new FormControl<number | null>(DEFAULT_RADIUS_KM, [
      Validators.required,
      greaterThanZero
    ])
  });

  constructor() {
    effect(() => {
      const coordinates = this.coordinates();
      // patchValue no toca radiusKm: el radio elegido se conserva.
      if (coordinates) {
        this.form.patchValue({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { latitude, longitude, radiusKm } = this.form.getRawValue();
    this.searchRequested.emit({
      latitude: latitude as number,
      longitude: longitude as number,
      radiusKm: radiusKm as number
    });
  }

  latitudeError(): string | null {
    const control = this.form.controls.latitude;
    if (!control.touched || control.valid) return null;
    return control.hasError('required')
      ? 'Ingresa la latitud.'
      : 'La latitud debe estar entre -90 y 90.';
  }

  longitudeError(): string | null {
    const control = this.form.controls.longitude;
    if (!control.touched || control.valid) return null;
    return control.hasError('required')
      ? 'Ingresa la longitud.'
      : 'La longitud debe estar entre -180 y 180.';
  }

  radiusError(): string | null {
    const control = this.form.controls.radiusKm;
    if (!control.touched || control.valid) return null;
    return control.hasError('required')
      ? 'Selecciona un radio de búsqueda.'
      : 'El radio debe ser mayor que 0 km.';
  }
}
