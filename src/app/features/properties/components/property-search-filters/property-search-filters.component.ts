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
  OWNERSHIP_OPTIONS,
  OwnershipFilter,
  PropertySearchFormValue,
  RADIUS_OPTIONS_KM
} from '../../models/property-search.models';

// El radio debe ser estrictamente mayor que cero (Validators.min(0) aceptaría 0).
function greaterThanZero(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  return Number(value) > 0 ? null : { greaterThanZero: true };
}

// FR-UC-06: dirección o zona, ubicación actual, radio y (solo OWNER) alcance de propiedad.
// No consulta ubicación ni backend ni geocodifica: delega en la página mediante eventos.
@Component({
  selector: 'app-property-search-filters',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="filters" novalidate>
      <div class="field address">
        <label for="search-address">Dirección o zona</label>
        <input
          id="search-address"
          type="text"
          formControlName="addressQuery"
          autocomplete="off"
          placeholder="Escribe una dirección, barrio o zona"
        />
      </div>

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
        <button type="submit" id="search-submit" class="primary" [disabled]="locating()">
          Buscar propiedades
        </button>
      </div>
    </form>
  `,
  styleUrls: ['./property-search-filters.component.scss']
})
export class PropertySearchFiltersComponent {
  /** Coordenadas obtenidas del GPS; al llegar sustituyen el texto de dirección. */
  readonly coordinates = input<LocationCoordinates | null>(null);
  /** Mientras es true se bloquean las acciones que dependen de la ubicación. */
  readonly locating = input(false);
  /** Solo OWNER ve el filtro Todos / Mis inmuebles / Otros inmuebles. */
  readonly showOwnership = input(false);

  readonly useLocation = output<void>();
  /** El usuario modificó el texto de dirección (no se emite al limpiarlo por código). */
  readonly addressEdited = output<string>();
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

    effect(() => {
      // Con GPS el texto escrito deja de describir la ubicación: se limpia sin avisar a la
      // página (emitEvent: false). El radio y el alcance se conservan.
      if (this.coordinates()) {
        this.form.controls.addressQuery.setValue('', { emitEvent: false });
      }
    });
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
