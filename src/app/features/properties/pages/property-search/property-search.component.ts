import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { LocationCoordinates, LocationFailureReason } from '../../models/location.models';
import { LocationUiState, PropertySearchParameters } from '../../models/property-search.models';
import { PropertySearchFiltersComponent } from '../../components/property-search-filters/property-search-filters.component';
import { LocationService } from '../../services/location.service';

const FAILURE_MESSAGES: Record<LocationFailureReason, string> = {
  permissionDenied:
    'No tenemos permiso para acceder a tu ubicación. Puedes habilitarlo en la configuración del dispositivo o introducir las coordenadas manualmente.',
  positionUnavailable:
    'No pudimos determinar tu ubicación. Introduce las coordenadas manualmente.',
  timeout:
    'Obtener tu ubicación tomó demasiado tiempo. Intenta de nuevo o introduce las coordenadas manualmente.',
  unsupported:
    'Este dispositivo o navegador no ofrece geolocalización. Introduce las coordenadas manualmente.'
};

// FR-UC-06 (primera versión): captura de ubicación y parámetros. Todavía no consulta propiedades.
@Component({
  selector: 'app-property-search',
  standalone: true,
  imports: [PropertySearchFiltersComponent],
  template: `
    <section class="search-page">
      <header>
        <h1>Buscar propiedades cercanas</h1>
        <p>Indica una ubicación y un radio para buscar propiedades a tu alrededor.</p>
      </header>

      <article class="block">
        <h2>Ubicación y radio</h2>
        <app-property-search-filters
          [coordinates]="coordinates()"
          [locating]="state() === 'locating'"
          (useLocation)="requestLocation()"
          (searchRequested)="onSearch($event)"
        />

        <p
          id="location-status"
          class="status"
          [class.status-error]="state() === 'locationError'"
          role="status"
          aria-live="polite"
        >
          {{ statusMessage() }}
        </p>

        @if (searchParameters(); as parameters) {
          <p id="search-parameters" class="parameters">
            Parámetros listos: latitud {{ parameters.latitude }}, longitud
            {{ parameters.longitude }}, radio {{ parameters.radiusKm }} km.
          </p>
        }
      </article>
    </section>
  `,
  styleUrls: ['./property-search.component.scss']
})
export class PropertySearchComponent {
  private readonly locationService = inject(LocationService);
  private locationSubscription?: Subscription;

  readonly state = signal<LocationUiState>('idle');
  readonly failureReason = signal<LocationFailureReason | null>(null);
  readonly coordinates = signal<LocationCoordinates | null>(null);
  /** Últimos parámetros válidos confirmados por el usuario; todavía no se envían a ningún servicio. */
  readonly searchParameters = signal<PropertySearchParameters | null>(null);

  readonly statusMessage = computed(() => {
    switch (this.state()) {
      case 'locating':
        return 'Obteniendo tu ubicación…';
      case 'locationReady':
        return 'Ubicación obtenida. Puedes ajustarla antes de buscar.';
      case 'locationError': {
        const reason = this.failureReason();
        return reason ? FAILURE_MESSAGES[reason] : FAILURE_MESSAGES.positionUnavailable;
      }
      default:
        return 'Introduce las coordenadas manualmente o usa tu ubicación actual.';
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.locationSubscription?.unsubscribe());
  }

  requestLocation(): void {
    this.locationSubscription?.unsubscribe();
    this.state.set('locating');
    this.failureReason.set(null);

    this.locationSubscription = this.locationService.getCurrentLocation().subscribe((result) => {
      if (result.status === 'success') {
        // Objeto nuevo en cada éxito para que el formulario se actualice aunque se repitan valores.
        this.coordinates.set({ ...result.coordinates });
        this.state.set('locationReady');
      } else {
        this.failureReason.set(result.reason);
        this.state.set('locationError');
      }
    });
  }

  onSearch(parameters: PropertySearchParameters): void {
    this.searchParameters.set(parameters);
  }
}
