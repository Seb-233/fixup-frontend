import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { LocationCoordinates, LocationFailureReason } from '../../models/location.models';
import {
  LocationSource,
  LocationUiState,
  OWNERSHIP_OPTIONS,
  PropertySearchFormValue,
  PropertySearchParameters
} from '../../models/property-search.models';
import { PropertySearchFiltersComponent } from '../../components/property-search-filters/property-search-filters.component';
import { LocationService } from '../../services/location.service';

const FAILURE_MESSAGES: Record<LocationFailureReason, string> = {
  permissionDenied:
    'No tenemos permiso para acceder a tu ubicación. Puedes habilitarlo en la configuración del dispositivo o escribir una dirección.',
  positionUnavailable: 'No pudimos determinar tu ubicación. Escribe una dirección.',
  timeout:
    'Obtener tu ubicación tomó demasiado tiempo. Intenta de nuevo o escribe una dirección.',
  unsupported:
    'Este dispositivo o navegador no ofrece geolocalización. Escribe una dirección.'
};

// FR-UC-06 (primera versión): captura de la ubicación de referencia (GPS o dirección), radio y,
// para OWNER, alcance. Todavía no consulta propiedades.
//
// Punto de integración futuro (geocodificación): hoy una dirección escrita queda en
// 'addressPending' porque no existe proveedor. Cuando se elija uno, debe resolver la dirección a
// LocationCoordinates y asignarlas a `coordinates` para pasar a 'locationReady' con la fuente
// 'address'. No se inventan coordenadas mientras tanto, y onSearch() hoy solo acepta la fuente
// 'gps'; habrá que admitir también 'address' con coordenadas resueltas.
@Component({
  selector: 'app-property-search',
  standalone: true,
  imports: [PropertySearchFiltersComponent],
  template: `
    <section class="search-page">
      <header>
        <h1>Explorar inmuebles</h1>
        <p>Indica una dirección o usa tu ubicación y un radio para explorar inmuebles cercanos.</p>
      </header>

      <article class="block">
        <h2>Ubicación y radio</h2>
        <app-property-search-filters
          [coordinates]="coordinates()"
          [locating]="state() === 'locating'"
          [showOwnership]="isOwner()"
          (useLocation)="requestLocation()"
          (addressEdited)="onAddressEdited($event)"
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

        @if (locationRequired()) {
          <p id="search-hint" class="status status-error" role="alert">
            Selecciona una ubicación válida para continuar.
          </p>
        }

        @if (searchParameters(); as parameters) {
          <p id="search-parameters" class="parameters">
            Búsqueda lista: {{ sourceLabel() }}, radio {{ parameters.radiusKm }} km{{
              ownershipLabel()
            }}.
          </p>
        }
      </article>
    </section>
  `,
  styleUrls: ['./property-search.component.scss']
})
export class PropertySearchComponent {
  private readonly locationService = inject(LocationService);
  private readonly userStore = inject(CurrentUserStore);
  private locationSubscription?: Subscription;

  readonly state = signal<LocationUiState>('idle');
  readonly failureReason = signal<LocationFailureReason | null>(null);
  readonly locationSource = signal<LocationSource>('address');
  /** Coordenadas internas de la ubicación de referencia; no se muestran al usuario. */
  readonly coordinates = signal<LocationCoordinates | null>(null);
  /** Último parámetro completo y válido; todavía no se envía a ningún servicio. */
  readonly searchParameters = signal<PropertySearchParameters | null>(null);
  /** El usuario pulsó buscar sin tener una ubicación utilizable. */
  readonly locationRequired = signal(false);

  readonly isOwner = computed(() => this.userStore.activeRole() === 'OWNER');

  readonly statusMessage = computed(() => {
    switch (this.state()) {
      case 'locating':
        return 'Obteniendo tu ubicación…';
      case 'locationReady':
        return 'Usando tu ubicación actual.';
      case 'addressPending':
        return 'Dirección escrita. Aún no se ha convertido en una ubicación válida.';
      case 'locationError': {
        const reason = this.failureReason();
        return reason ? FAILURE_MESSAGES[reason] : FAILURE_MESSAGES.positionUnavailable;
      }
      default:
        return 'Escribe una dirección o usa tu ubicación actual.';
    }
  });

  readonly sourceLabel = computed(() =>
    this.locationSource() === 'gps' ? 'ubicación actual' : 'dirección indicada'
  );

  readonly ownershipLabel = computed(() => {
    const ownership = this.searchParameters()?.ownership;
    const option = OWNERSHIP_OPTIONS.find((o) => o.value === ownership);
    return option ? `, mostrar: ${option.label}` : '';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.locationSubscription?.unsubscribe());
  }

  requestLocation(): void {
    this.locationSubscription?.unsubscribe();
    this.state.set('locating');
    this.failureReason.set(null);
    this.locationRequired.set(false);
    this.searchParameters.set(null);

    this.locationSubscription = this.locationService.getCurrentLocation().subscribe((result) => {
      if (result.status === 'success') {
        // Objeto nuevo en cada éxito para que los consumidores reaccionen aunque se repitan valores.
        this.coordinates.set({ ...result.coordinates });
        this.locationSource.set('gps');
        this.state.set('locationReady');
      } else {
        this.failureReason.set(result.reason);
        this.state.set('locationError');
      }
    });
  }

  onAddressEdited(text: string): void {
    // Escribir una dirección cancela una lectura de GPS en curso y descarta las coordenadas del
    // GPS: ya no corresponden a lo escrito, y la dirección aún no tiene coordenadas.
    this.locationSubscription?.unsubscribe();
    this.coordinates.set(null);
    this.locationSource.set('address');
    this.failureReason.set(null);
    this.locationRequired.set(false);
    this.searchParameters.set(null);
    this.state.set(text.trim() ? 'addressPending' : 'idle');
  }

  onSearch(value: PropertySearchFormValue): void {
    const coordinates = this.coordinates();
    if (this.locationSource() !== 'gps' || !coordinates) {
      // Sin coordenadas finales (dirección sin geocodificar o nada indicado) no hay búsqueda.
      this.searchParameters.set(null);
      this.locationRequired.set(true);
      return;
    }

    this.locationRequired.set(false);
    this.searchParameters.set({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      radiusKm: value.radiusKm,
      ...(this.isOwner() ? { ownership: value.ownership } : {})
    });
  }
}
