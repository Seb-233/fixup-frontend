import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { IndicatorsResponse, MarketIndicatorsControllerService } from '../../../../api/generated';

// FR-UC-15: consulta de indicadores del mercado inmobiliario por zona
@Component({
  selector: 'app-market-indicators',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="indicators">
      <h1 class="title">Indicadores del mercado</h1>
      <p class="subtitle">
        Consulta precio por metro cuadrado, variación interanual y tiempo promedio en mercado de
        una zona.
      </p>

      <form class="search" (ngSubmit)="consultar()">
        <label for="zona">Zona</label>
        <input
          id="zona"
          name="zona"
          type="text"
          maxlength="64"
          placeholder="Chapinero"
          [(ngModel)]="zona"
        />
        <button type="submit" [disabled]="!puedeConsultar() || cargando()">
          {{ cargando() ? 'Consultando…' : 'Consultar' }}
        </button>
      </form>

      @if (indicadores(); as dato) {
        @if (dato.degraded) {
          <div class="degraded-banner" role="status">
            <strong>Dato desactualizado.</strong>
            La fuente externa no respondió, así que se muestra el último valor conocido,
            observado el {{ dato.observedAt | date: 'medium' }}.
          </div>
        }

        <article class="card" [class.degraded]="dato.degraded">
          <header>
            <h2>{{ dato.zone }}</h2>
            <span class="freshness" [class]="'freshness-' + dato.freshness.toLowerCase()">
              {{ etiquetaFrescura(dato.freshness) }}
            </span>
          </header>

          <dl class="metrics">
            <div>
              <dt>Precio por m²</dt>
              <dd>{{ dato.pricePerSquareMeter | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</dd>
            </div>
            <div>
              <dt>Variación interanual</dt>
              <dd [class.negative]="dato.yearOverYearVariationPercent < 0">
                {{ dato.yearOverYearVariationPercent > 0 ? '+' : ''
                }}{{ dato.yearOverYearVariationPercent }}%
              </dd>
            </div>
            <div>
              <dt>Tiempo promedio en mercado</dt>
              <dd>{{ dato.averageDaysOnMarket }} días</dd>
            </div>
          </dl>

          <footer class="observed">Observado: {{ dato.observedAt | date: 'medium' }}</footer>
        </article>
      }

      @if (error(); as mensaje) {
        <p class="error" role="alert">{{ mensaje }}</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 2rem 1rem;
      }
      .indicators {
        max-width: 640px;
        margin: 0 auto;
      }
      .title {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
      }
      .subtitle {
        color: #5b6472;
        font-size: 0.875rem;
      }
      .search {
        display: flex;
        align-items: flex-end;
        gap: 0.75rem;
        margin: 1.5rem 0;
      }
      .search label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      .search input {
        flex: 1;
        padding: 0.6rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font: inherit;
      }
      .search button {
        padding: 0.65rem 1.25rem;
        border: 0;
        border-radius: 8px;
        background: var(--fixup-primary, #1d4ed8);
        color: #ffffff;
        font-weight: 600;
        cursor: pointer;
      }
      .search button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .degraded-banner {
        background: #fff4d6;
        color: #8a6100;
        border-left: 4px solid #d89b00;
        padding: 0.85rem 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        font-size: 0.875rem;
      }
      .card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: var(--fixup-shadow-md);
        padding: 1.5rem;
      }
      .card.degraded {
        border: 1px solid #f0d08a;
      }
      .card header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .card h2 {
        margin: 0;
        font-size: 1.25rem;
      }
      .freshness {
        border-radius: 999px;
        padding: 0.25rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .freshness-live {
        background: #e0f7e9;
        color: #10693c;
      }
      .freshness-cached {
        background: #e5efff;
        color: #1d4ed8;
      }
      .freshness-degraded {
        background: #fff4d6;
        color: #8a6100;
      }
      .metrics {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        margin: 1.25rem 0 0;
      }
      .metrics dt {
        font-size: 0.8125rem;
        color: #6b7280;
      }
      .metrics dd {
        margin: 0.25rem 0 0;
        font-size: 1.125rem;
        font-weight: 600;
      }
      .metrics dd.negative {
        color: #9b1c1c;
      }
      .observed {
        margin-top: 1.25rem;
        font-size: 0.8125rem;
        color: #6b7280;
      }
      .error {
        color: #9b1c1c;
      }
    `
  ]
})
export class MarketIndicatorsComponent {
  private readonly api = inject(MarketIndicatorsControllerService);

  private readonly zonaState = signal('');
  private readonly indicadoresState = signal<IndicatorsResponse | null>(null);
  private readonly cargandoState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly indicadores = this.indicadoresState.asReadonly();
  readonly cargando = this.cargandoState.asReadonly();
  readonly error = this.errorState.asReadonly();

  get zona(): string {
    return this.zonaState();
  }

  set zona(valor: string) {
    this.zonaState.set(valor);
  }

  puedeConsultar(): boolean {
    return this.zonaState().trim().length > 0;
  }

  consultar(): void {
    if (!this.puedeConsultar()) {
      return;
    }
    this.cargandoState.set(true);
    this.errorState.set(null);
    this.api.ofZone(this.zonaState().trim()).subscribe({
      next: (dato) => {
        this.indicadoresState.set(dato);
        this.cargandoState.set(false);
      },
      error: (failure: HttpErrorResponse) => {
        this.indicadoresState.set(null);
        this.errorState.set(this.describe(failure));
        this.cargandoState.set(false);
      }
    });
  }

  etiquetaFrescura(frescura: IndicatorsResponse['freshness']): string {
    const etiquetas: Record<string, string> = {
      LIVE: 'Dato en vivo',
      CACHED: 'Dato reciente',
      DEGRADED: 'Último valor conocido'
    };
    return etiquetas[frescura] ?? frescura;
  }

  // El 503 se distingue del resto: no es un error del usuario sino ausencia total de dato
  private describe(failure: HttpErrorResponse): string {
    if (failure.status === 503 || failure.error?.code === 'INDICATORS_UNAVAILABLE') {
      return 'No hay indicadores disponibles para esa zona en este momento.';
    }
    if (failure.error?.code === 'INVALID_REQUEST') {
      return 'Revisa el nombre de la zona.';
    }
    return 'No se pudo consultar los indicadores. Inténtalo de nuevo.';
  }
}
