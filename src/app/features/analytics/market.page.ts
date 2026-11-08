import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ProjectsApi } from '../../data/projects.api';
import { money } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { WhenPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

const SUGGESTED = ['Chapinero', 'Usaquén', 'El Poblado', 'Laureles', 'Bocagrande', 'Cabecera'];

@Component({
  selector: 'app-market-page',
  imports: [FormsModule, IconComponent, WhenPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <header class="page-header">
        <div>
          <h1>Indicadores de mercado</h1>
          <p class="lede">Precio por metro cuadrado, variación anual y días promedio en el mercado de una zona, para fijar un canon o un precio de venta con referencia.</p>
        </div>
      </header>

      <form class="toolbar panel" (ngSubmit)="search()">
        <div class="field">
          <label for="zone">Zona o barrio</label>
          <input id="zone" class="input" name="zone" maxlength="64" list="zones" [(ngModel)]="zoneInput" placeholder="Chapinero" />
          <datalist id="zones">@for (z of suggested; track z) { <option [value]="z"></option> }</datalist>
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="!zoneInput.trim()"><app-icon name="search" />Consultar</button>
      </form>

      @if (indicators.isLoading()) {
        <app-loading text="Consultando la fuente de mercado…" />
      } @else if (indicators.error()) {
        @switch (errorStatus()) {
          @case (400) {
            <app-error title="Zona no válida" message="Escribe el nombre de un barrio o zona, de hasta 64 caracteres, y vuelve a consultar." [retryable]="false" />
          }
          @case (503) {
            <app-error title="Fuente de mercado no disponible" message="El proveedor de indicadores no respondió y aún no hay un valor guardado para esta zona. Inténtalo en unos minutos." (retry)="indicators.reload()" />
          }
          @default {
            <app-error message="La fuente de indicadores no respondió. Inténtalo en unos minutos." (retry)="indicators.reload()" />
          }
        }
      } @else if (indicators.hasValue()) {
        @let i = indicators.value();
        @if (i.synthetic) {
          <div class="alert alert-warning" role="status"><strong>Datos sintéticos.</strong> Este entorno no está conectado a un proveedor de mercado; los valores son de desarrollo.</div>
        }
        @if (i.degraded) {
          <div class="alert alert-warning" role="status"><strong>Dato desactualizado.</strong> La fuente no respondió y se muestra el último valor conocido.</div>
        }
        <section class="panel stack">
          <h2 class="zone">{{ i.zone.toLowerCase() }}</h2>
          <dl class="facts big">
            <div><dt>Precio por m²</dt><dd>{{ format(i.pricePerSquareMeter) }}</dd></div>
            <div><dt>Variación anual</dt><dd [class.up]="i.yearOverYearVariationPercent > 0" [class.down]="i.yearOverYearVariationPercent < 0">{{ i.yearOverYearVariationPercent > 0 ? '+' : '' }}{{ i.yearOverYearVariationPercent.toFixed(1) }} %</dd></div>
            <div><dt>Días en el mercado</dt><dd>{{ i.averageDaysOnMarket }}</dd></div>
          </dl>
          <p class="text-xs text-muted">Observado {{ i.observedAt | when }} · {{ i.freshness === 'LIVE' ? 'consulta en vivo' : i.freshness === 'CACHED' ? 'desde caché' : 'último valor conocido' }}</p>
        </section>
      }
    </div>
  `,
  styles: `
    .zone::first-letter { text-transform: uppercase; }
    .big dd { font-size: var(--fs-xl); font-variant-numeric: tabular-nums; }
    .up { color: var(--success); }
    .down { color: var(--danger); }
  `
})
export class MarketPage {
  private readonly api = inject(ProjectsApi);
  readonly suggested = SUGGESTED;
  zoneInput = '';
  private readonly zone = signal<string | null>(null);
  readonly indicators = rxResource({ params: () => this.zone() ?? undefined, stream: ({ params }) => this.api.marketIndicators(params) });
  /** 400: la zona no pasó la validación del backend. 503: la fuente falló y no hay último valor conocido. */
  readonly errorStatus = computed(() => (this.indicators.error() as { status?: number } | undefined)?.status ?? null);

  search(): void {
    const zone = this.zoneInput.trim();
    if (zone) this.zone.set(zone);
  }

  format(value: number): string {
    return money(Math.round(value));
  }
}
