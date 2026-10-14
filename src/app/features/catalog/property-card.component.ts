import { LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogItem } from '../../data/models';
import { LISTING_TYPE, PROPERTY_TYPE } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoComponent } from '../../shared/ui/photo.component';
import { LabelPipe, MoneyPipe } from '../../shared/ui/pipes';

// Tarjeta de inmueble del catálogo: la foto y el precio deciden el clic; el sello solo aparece
// cuando el sistema lo otorgó.
@Component({
  selector: 'app-property-card',
  imports: [RouterLink, LowerCasePipe, IconComponent, PhotoComponent, MoneyPipe, LabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="['/catalog', item().id]" class="card">
      <div class="media">
        <app-photo [src]="item().coverPhotoUrl" [alt]="item().name" />
        @if (item().seal) {
          <span class="seal on-photo"><app-icon name="seal" [size]="16" />Sello Fix&amp;Rent</span>
        }
      </div>
      <div class="body">
        <p class="price">
          {{ item().price | money }}
          @if (item().listingType === 'RENT') {
            <small>/ mes</small>
          }
        </p>
        <h3 class="name">{{ item().name }}</h3>
        <p class="text-muted text-sm">
          {{ item().propertyType | label: propertyType }} en {{ item().listingType | label: listingType | lowercase }} ·
          {{ item().neighborhood ? item().neighborhood + ', ' : '' }}{{ item().city }}
        </p>
        <p class="specs text-sm">
          @if (item().bedrooms !== null && item().bedrooms !== undefined) {
            <span><app-icon name="bed" [size]="16" />{{ item().bedrooms }} hab.</span>
          }
          @if (item().bathrooms !== null && item().bathrooms !== undefined) {
            <span><app-icon name="bath" [size]="16" />{{ item().bathrooms }} baños</span>
          }
          <span><app-icon name="area" [size]="16" />{{ item().areaM2 }} m²</span>
          @if (item().ownedByCurrentUser) {
            <span class="chip chip-info">Tuyo</span>
          }
        </p>
      </div>
    </a>
  `,
  styles: `
    .card { display: grid; gap: var(--s-3); color: inherit; text-decoration: none; }
    .card:hover .name { text-decoration: underline; text-underline-offset: 3px; }
    .media { position: relative; }
    .on-photo { position: absolute; left: var(--s-2); bottom: var(--s-2); }
    .body { display: grid; gap: var(--s-1); }
    .name { font-size: var(--fs-base); font-weight: 600; }
    .specs { display: flex; flex-wrap: wrap; gap: var(--s-1) var(--s-3); color: var(--text-muted); }
    .specs span { display: inline-flex; align-items: center; gap: 4px; }
  `
})
export class PropertyCardComponent {
  readonly item = input.required<CatalogItem>();
  readonly propertyType = PROPERTY_TYPE;
  readonly listingType = LISTING_TYPE;
}
