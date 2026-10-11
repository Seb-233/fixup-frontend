import { Component, input, output } from '@angular/core';
import { PropertySearchResult } from '../../../../api/generated';

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

@Component({
  selector: 'app-property-result-list',
  standalone: true,
  template: `
    @if (results().length === 0) {
      <div class="empty-state" id="property-empty-state" role="status">
        <p class="empty-title">No encontramos inmuebles dentro de este radio.</p>
        <p class="empty-hint">Prueba ampliando el radio de búsqueda o cambiando la ubicación.</p>
      </div>
    } @else {
      <div class="results-grid" id="property-results-list" role="list">
        @for (property of results(); track property.id) {
          <article
            class="property-card"
            [class.is-mine]="property.ownedByCurrentUser"
            role="listitem"
            tabindex="0"
            (click)="propertySelected.emit(property)"
            (keydown.enter)="propertySelected.emit(property)"
          >
            <header class="card-header">
              <h3 class="property-name">{{ property.name }}</h3>
              @if (property.ownedByCurrentUser) {
                <span class="mine-badge">Tu inmueble</span>
              }
            </header>

            <p class="property-address">{{ property.address }}, {{ property.city }}</p>

            <footer class="card-footer">
              <span class="property-area">{{ property.areaM2 }} m²</span>
              <span class="property-distance">{{ formatDistance(property.distanceKm) }}</span>
            </footer>
          </article>
        }
      </div>
    }
  `,
  styleUrls: ['./property-result-list.component.scss']
})
export class PropertyResultListComponent {
  readonly results = input<PropertySearchResult[]>([]);
  readonly propertySelected = output<PropertySearchResult>();

  readonly formatDistance = formatDistance;
}
