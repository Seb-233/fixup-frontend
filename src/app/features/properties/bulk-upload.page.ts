import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BulkImportResult, BulkValidationResult } from '../../api/generated';
import { PropertiesApi } from '../../data/properties.api';
import { errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';

// Encabezados que acepta el backend (BulkImportProperties): los cuatro primeros son obligatorios.
const TEMPLATE_HEADER =
  'name,address,city,areaM2,listingType,propertyType,price,adminFee,bedrooms,bathrooms,parkingSpots,stratum,neighborhood,description,latitude,longitude';
const TEMPLATE_ROW =
  '"Apartamento en Chapinero Alto","Calle 63 # 4-25","Bogotá",72,RENT,APARTMENT,2800000,380000,2,2,1,4,"Chapinero Alto","Balcón con vista a los cerros",4.6458,-74.0596';

@Component({
  selector: 'app-bulk-upload-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <header class="page-header">
        <div>
          <h1>Carga masiva de inmuebles</h1>
          <p class="lede">Sube un archivo CSV para crear muchos inmuebles de una vez. Primero se valida fila por fila; solo importas cuando todo está bien.</p>
        </div>
      </header>

      <ol class="steps">
        <li [class.current]="step() === 1">1. Archivo</li>
        <li [class.current]="step() === 2">2. Validación</li>
        <li [class.current]="step() === 3">3. Resultado</li>
      </ol>

      <section class="panel stack">
        <div class="stack-sm">
          <h2 class="text-lg">Formato del archivo</h2>
          <p class="text-sm text-muted">
            Columnas obligatorias: <code>name</code>, <code>address</code>, <code>city</code> y <code>areaM2</code>. Opcionales: tipo, operación,
            precio, administración, habitaciones, baños, parqueaderos, estrato, barrio, descripción y coordenadas.
          </p>
          <div><button type="button" class="btn btn-ghost" (click)="downloadTemplate()"><app-icon name="download" />Descargar plantilla</button></div>
        </div>

        <label class="drop" [class.has-file]="file()">
          <app-icon name="upload" [size]="28" />
          <span>{{ file() ? file()!.name : 'Elige un archivo .csv' }}</span>
          @if (file()) { <span class="text-sm text-muted">{{ (file()!.size / 1024).toFixed(1) }} KB</span> }
          <input type="file" accept=".csv,text/csv" class="visually-hidden" (change)="pick($event)" />
        </label>

        @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }

        <div class="form-actions">
          @if (step() > 1) { <button type="button" class="btn btn-ghost" (click)="reset()">Empezar de nuevo</button> }
          <button type="button" class="btn btn-secondary" (click)="validate()" [disabled]="!file() || busy()">
            {{ busy() && step() === 1 ? 'Validando…' : 'Validar archivo' }}
          </button>
          @if (validation(); as v) {
            <button type="button" class="btn btn-primary" (click)="importFile()" [disabled]="busy() || v.validCount === 0 || step() === 3">
              {{ busy() && step() === 2 ? 'Importando…' : 'Importar ' + v.validCount + ' filas válidas' }}
            </button>
          }
        </div>
      </section>

      @if (validation(); as v) {
        <section class="panel stack" aria-labelledby="validation-title">
          <h2 id="validation-title" class="text-lg">Validación</h2>
          <dl class="facts">
            <div><dt>Filas</dt><dd>{{ v.total }}</dd></div>
            <div><dt>Válidas</dt><dd>{{ v.validCount }}</dd></div>
            <div><dt>Con errores</dt><dd>{{ (v.total ?? 0) - (v.validCount ?? 0) }}</dd></div>
          </dl>
          @if (v.errors?.length) {
            <table class="table">
              <thead><tr><th scope="col">Fila</th><th scope="col">Campo</th><th scope="col">Problema</th></tr></thead>
              <tbody>
                @for (e of v.errors; track $index) {
                  <tr>
                    <td data-label="Fila">{{ e.rowNumber }}</td>
                    <td data-label="Campo"><code>{{ e.field || '—' }}</code></td>
                    <td data-label="Problema">{{ e.message }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <div class="alert alert-success">Todas las filas están listas para importar.</div>
          }
        </section>
      }

      @if (result(); as r) {
        <section class="panel stack" aria-labelledby="result-title">
          <h2 id="result-title" class="text-lg">Resultado</h2>
          <div class="alert" [class.alert-success]="!r.failed" [class.alert-warning]="r.failed" role="status">
            Se crearon {{ r.imported }} inmuebles{{ r.failed ? '; ' + r.failed + ' filas no se importaron' : '' }}. Ya aparecen publicados en el catálogo; agrégales fotos desde Inmuebles.
          </div>
          <div><a routerLink="/properties" class="btn btn-secondary">Ver inmuebles</a></div>
        </section>
      }
    </div>
  `,
  styles: `
    .steps { display: flex; gap: var(--s-4); list-style: none; margin: 0; padding: 0; color: var(--text-muted); font-weight: 600; font-size: var(--fs-sm); }
    .steps .current { color: var(--text); text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 2px; }
    .drop { display: grid; justify-items: center; gap: var(--s-2); padding: var(--s-6); border: 2px dashed var(--border-control); border-radius: var(--r-md); cursor: pointer; text-align: center; }
    .drop.has-file { border-style: solid; }
    .drop:has(input:focus-visible) { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
    code { font-size: 0.85em; background: var(--surface-2); padding: 1px 4px; border-radius: 4px; }
  `
})
export class BulkUploadPage {
  private readonly api = inject(PropertiesApi);

  readonly step = signal<1 | 2 | 3>(1);
  readonly file = signal<File | null>(null);
  readonly validation = signal<BulkValidationResult | null>(null);
  readonly result = signal<BulkImportResult | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.reset();
    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      this.error.set('El archivo debe ser .csv (valores separados por comas).');
      return;
    }
    this.file.set(file);
  }

  validate(): void {
    const file = this.file();
    if (!file) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.validateBulk(file).subscribe({
      next: (validation) => {
        this.busy.set(false);
        this.validation.set(validation);
        this.step.set(2);
      },
      error: (failure) => {
        this.busy.set(false);
        this.error.set(errorMessage(failure, 'No pudimos leer el archivo. Revisa que tenga la fila de encabezados de la plantilla.'));
      }
    });
  }

  importFile(): void {
    const file = this.file();
    if (!file) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.importBulk(file).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.result.set(result);
        this.step.set(3);
      },
      error: (failure) => {
        this.busy.set(false);
        this.error.set(errorMessage(failure, 'No pudimos importar el lote. Inténtalo de nuevo.'));
      }
    });
  }

  reset(): void {
    this.step.set(1);
    this.file.set(null);
    this.validation.set(null);
    this.result.set(null);
    this.error.set(null);
  }

  downloadTemplate(): void {
    const blob = new Blob([`${TEMPLATE_HEADER}\n${TEMPLATE_ROW}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla-inmuebles-fixrent.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
}
