import { Component, effect, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  LocationSource,
  OWNERSHIP_OPTIONS,
  OwnershipFilter,
  PropertySearchFormValue,
  RADIUS_OPTIONS_KM
} from '../../models/property-search.models';
import {
  GeocodingCandidate,
  GeocodingErrorType,
  GeocodingState
} from '../../models/geocoding.models';

// El radio debe ser estrictamente mayor que cero (Validators.min(0) aceptaría 0).
function greaterThanZero(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  return Number(value) > 0 ? null : { greaterThanZero: true };
}

// FR-UC-06: dirección o zona, resolución explícita de dirección, ubicación actual, radio y alcance.
@Component({
  selector: 'app-property-search-filters',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="filters" novalidate>
      <div class="field address">
        <label for="search-address">Dirección o zona</label>
        <div class="address-input-group">
          <input
            id="search-address"
            type="text"
            formControlName="addressQuery"
            autocomplete="off"
            placeholder="Escribe una dirección, barrio o zona"
            (keydown.enter)="$event.preventDefault(); onResolveAddress()"
          />
          <button
            type="button"
            id="resolve-address"
            class="secondary resolve-button"
            [disabled]="locating() || geocoding() || !hasAddressQuery()"
            (click)="onResolveAddress()"
          >
            {{ geocoding() ? 'Buscando…' : 'Buscar dirección' }}
          </button>
        </div>

        @if (geocoding()) {
          <p id="geocoding-loading" class="geocoding-status" role="status">
            Buscando dirección…
          </p>
        }

        @if (geocodingState() === 'empty') {
          <p id="geocoding-empty" class="geocoding-status geocoding-empty" role="status">
            No encontramos ubicaciones para esa dirección.
          </p>
        }

        @if (geocodingState() === 'error' && geocodingError(); as errorMsg) {
          <div id="geocoding-error" class="geocoding-error-block" role="alert">
            <p class="error">{{ errorMsg }}</p>
            @if (geocodingErrorType() === 'rate_limit') {
              <button
                type="button"
                id="geocoding-retry"
                class="secondary retry-button"
                (click)="retryGeocoding.emit()"
              >
                Reintentar búsqueda de dirección
              </button>
            }
          </div>
        }

        @if (candidates().length > 0) {
          <div class="candidates-container" id="geocoding-candidates-container">
            <p class="candidates-label">Selecciona una ubicación coincidente:</p>
            <ul class="candidates-list" id="geocoding-candidates" role="listbox">
              @for (candidate of candidates(); track candidate.displayName; let idx = $index) {
                <li class="candidate-item">
                  <button
                    type="button"
                    class="candidate-option"
                    [class.selected]="selectedCandidate()?.displayName === candidate.displayName"
                    [id]="'candidate-option-' + idx"
                    (click)="selectCandidate(candidate)"
                  >
                    {{ candidate.displayName }}
                  </button>
                </li>
              }
            </ul>
            @if (attribution(); as attr) {
              <p id="geocoding-attribution" class="attribution">
                Datos de ubicación: {{ attr }}
              </p>
            }
          </div>
        }

        @if (selectedCandidate(); as selected) {
          <div id="selected-address-badge" class="selected-badge">
            <span class="selected-text">✓ Ubicación seleccionada: {{ selected.displayName }}</span>
            @if (candidates().length === 0 && attribution(); as attr) {
              <p id="geocoding-attribution" class="attribution">
                Datos de ubicación: {{ attr }}
              </p>
            }
          </div>
        }
      </div>

      <div class="location-action">
        <button
          type="button"
          id="use-my-location"
          class="secondary"
          [disabled]="locating() || geocoding()"
          (click)="useLocation.emit()"
        >
          {{ locating() ? 'Obteniendo ubicación…' : 'Usar mi ubicación' }}
        </button>
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

      @if (showOwnership()) {
        <fieldset class="ownership" id="search-ownership">
          <legend>Mostrar</legend>
          <div class="ownership-options">
            @for (option of ownershipOptions; track option.value) {
              <label class="radio">
                <input
                  type="radio"
                  formControlName="ownership"
                  [value]="option.value"
                  [id]="'ownership-' + option.value.toLowerCase()"
                />
                <span>{{ option.label }}</span>
              </label>
            }
          </div>
        </fieldset>
      }

      <div class="submit-action">
        <button
          type="submit"
          id="search-submit"
          class="primary"
          [disabled]="locating() || geocoding()"
        >
          Buscar propiedades
        </button>
      </div>
    </form>
  `,
  styleUrls: ['./property-search-filters.component.scss']
})
export class PropertySearchFiltersComponent {
  /** Coordenadas obtenidas; con GPS limpian el texto de dirección. */
  readonly coordinates = input<LocationCoordinates | null>(null);
  /** Mientras es true se bloquean las acciones que dependen de la ubicación. */
  readonly locating = input(false);
  /** Solo OWNER ve el filtro Todos / Mis inmuebles / Otros inmuebles. */
  readonly showOwnership = input(false);
  /** Origen de la ubicación activa. Por defecto 'gps' para compatibilidad hacia atrás. */
  readonly locationSource = input<LocationSource>('gps');

  /** Estados y datos de geocodificación */
  readonly geocoding = input(false);
  readonly geocodingState = input<GeocodingState>('idle');
  readonly geocodingError = input<string | null>(null);
  readonly geocodingErrorType = input<GeocodingErrorType | null>(null);
  readonly candidates = input<GeocodingCandidate[]>([]);
  readonly selectedCandidate = input<GeocodingCandidate | null>(null);
  readonly attribution = input<string | null>(null);

  readonly useLocation = output<void>();
  /** El usuario modificó el texto de dirección (no se emite al limpiarlo por código). */
  readonly addressEdited = output<string>();
  readonly resolveAddress = output<string>();
  readonly candidateSelected = output<GeocodingCandidate>();
  readonly retryGeocoding = output<void>();
  readonly radiusChanged = output<number>();
  readonly searchRequested = output<PropertySearchFormValue>();

  readonly radiusOptions = RADIUS_OPTIONS_KM;
  readonly ownershipOptions = OWNERSHIP_OPTIONS;

  readonly form = new FormGroup({
    addressQuery: new FormControl<string>('', { nonNullable: true }),
    radiusKm: new FormControl<number | null>(DEFAULT_RADIUS_KM, [
      Validators.required,
      greaterThanZero
    ]),
    ownership: new FormControl<OwnershipFilter>('ALL', { nonNullable: true })
  });

  constructor() {
    this.form.controls.addressQuery.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.addressEdited.emit(value));

    this.form.controls.radiusKm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        if (value && value > 0) {
          this.radiusChanged.emit(value);
        }
      });

    effect(() => {
      // Con GPS el texto escrito deja de describir la ubicación: se limpia sin emitir evento.
      if (this.coordinates() && this.locationSource() === 'gps') {
        this.form.controls.addressQuery.setValue('', { emitEvent: false });
      }
    });
  }

  hasAddressQuery(): boolean {
    return this.form.controls.addressQuery.value.trim().length > 0;
  }

  onResolveAddress(): void {
    const query = this.form.controls.addressQuery.value.trim();
    if (query) {
      this.resolveAddress.emit(query);
    }
  }

  selectCandidate(candidate: GeocodingCandidate): void {
    this.candidateSelected.emit(candidate);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { addressQuery, radiusKm, ownership } = this.form.getRawValue();
    this.searchRequested.emit({
      addressQuery: addressQuery.trim(),
      radiusKm: radiusKm as number,
      ownership
    });
  }

  radiusError(): string | null {
    const control = this.form.controls.radiusKm;
    if (!control.touched || control.valid) return null;
    return control.hasError('required')
      ? 'Selecciona un radio de búsqueda.'
      : 'El radio debe ser mayor que 0 km.';
  }
}
