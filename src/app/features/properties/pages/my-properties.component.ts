import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PropertiesService,
  Property,
  PropertyPayload,
  PropertyType,
  PropertyStatus
} from '../../../api/properties.service';

const TYPE_OPTIONS: { v: PropertyType; label: string }[] = [
  { v: 'APARTMENT', label: 'Departamento' },
  { v: 'HOUSE', label: 'Casa' },
  { v: 'STUDIO', label: 'Monoambiente' },
  { v: 'STORE', label: 'Local' },
  { v: 'OFFICE', label: 'Oficina' },
  { v: 'GARAGE', label: 'Cochera' },
  { v: 'LAND', label: 'Terreno' }
];

const STATUS_LABEL: Record<PropertyStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  UNLISTED: 'Despublicado',
  DELETED: 'Eliminado'
};

type TabView = 'LIST' | 'CREATE' | 'BATCH';

@Component({
  selector: 'app-my-properties',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="properties-page">
      <header class="section-header">
        <div>
          <h1 class="title">Mis inmuebles</h1>
          <p class="subtitle">Gestiona tu cartera de propiedades, publícalas individualmente o en lote.</p>
        </div>
        <div class="tabs">
          <button class="tab" [class.active]="tab() === 'LIST'" (click)="tab.set('LIST')">Listado</button>
          <button class="tab" [class.active]="tab() === 'CREATE'" (click)="tab.set('CREATE')">Publicar 1</button>
          <button class="tab" [class.active]="tab() === 'BATCH'" (click)="tab.set('BATCH')">Publicar lote</button>
        </div>
      </header>

      @if (tab() === 'LIST') {
        <div class="filters">
          <select class="input-sm" [(ngModel)]="filters.role" (ngModelChange)="load()">
            <option value="">Como propietario y gestor</option>
            <option value="OWNER">Solo como propietario</option>
            <option value="MANAGER">Solo como gestor</option>
          </select>
          <select class="input-sm" [(ngModel)]="filters.status" (ngModelChange)="load()">
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="PUBLISHED">Publicado</option>
            <option value="UNLISTED">Despublicado</option>
          </select>
          <button class="btn-secondary" (click)="load()" [disabled]="loading()">Refrescar</button>
        </div>

        @if (loading()) {
          <div class="loading-box">Cargando tus inmuebles...</div>
        } @else if (properties().length === 0) {
          <div class="empty-state">
            <h3>Todavía no publicaste ningún inmueble</h3>
            <p>Crea el primero desde la pestaña <strong>Publicar 1</strong> o sube un lote.</p>
          </div>
        } @else {
          <div class="cards-grid">
            @for (p of properties(); track p.id) {
              <article class="property-card">
                @if (p.photos.length > 0) {
                  <div class="photo">
                    <img [src]="p.photos[0].readUrl" [alt]="p.title" loading="lazy" />
                    <span class="status-pill" [class]="p.status">{{ STATUS_LABEL[p.status] }}</span>
                  </div>
                } @else {
                  <div class="photo photo-empty">
                    <span class="status-pill" [class]="p.status">{{ STATUS_LABEL[p.status] }}</span>
                    <span class="empty-photo-text">Sin fotos</span>
                  </div>
                }
                <div class="content">
                  <div class="type-row">
                    <span class="type-label">{{ typeLabel(p.type) }}</span>
                    <span class="rent">
                      {{ p.monthlyRentSuggestion ? '$ ' + (p.monthlyRentSuggestion | number) + '/mes' : 'Sin precio' }}
                    </span>
                  </div>
                  <h3 class="prop-title">{{ p.title }}</h3>
                  <p class="address">
                    {{ [p.addressStreet, p.addressNumber, p.city, p.zone].filter(Boolean).join(' · ') || 'Sin dirección' }}
                  </p>
                  <div class="meta-grid">
                    <span>🛏 {{ p.bedrooms ?? '—' }}</span>
                    <span>🚿 {{ p.bathrooms ?? '—' }}</span>
                    <span>📐 {{ p.surfaceM2 ? (p.surfaceM2 | number) + ' m²' : '—' }}</span>
                    <span>🚗 {{ p.coveredParkingSpots ?? '—' }}</span>
                  </div>
                  <div class="actions-row">
                    @if (p.status === 'DRAFT') {
                      <button class="btn-primary" (click)="quickPublish(p)">Publicar</button>
                    } @else if (p.status === 'PUBLISHED') {
                      <button class="btn-secondary" (click)="quickUnlist(p)">Despublicar</button>
                    } @else if (p.status === 'UNLISTED') {
                      <button class="btn-primary" (click)="quickRelist(p)">Re-publicar</button>
                    }
                    <button class="btn-ghost danger" (click)="quickDelete(p)">Eliminar</button>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      }

      @if (tab() === 'CREATE') {
        <div class="form-card">
          <h2>Publicar nuevo inmueble</h2>
          <form (ngSubmit)="submitOne()" class="grid-form">
            <label>
              <span>Título *</span>
              <input class="input" required maxlength="150" [(ngModel)]="form.title" name="title" placeholder="Ej: Departamento 2 ambientes con balcón" />
            </label>
            <label>
              <span>Tipo *</span>
              <select class="input" required [(ngModel)]="form.type" name="type">
                <option [ngValue]="undefined" disabled>Seleccionar...</option>
                @for (t of TYPE_OPTIONS; track t.v) {
                  <option [ngValue]="t.v">{{ t.label }}</option>
                }
              </select>
            </label>
            <label>
              <span>Ciudad *</span>
              <input class="input" required maxlength="200" [(ngModel)]="form.city" name="city" />
            </label>
            <label>
              <span>Zona *</span>
              <input class="input" required maxlength="100" [(ngModel)]="form.zone" name="zone" />
            </label>
            <label class="span-2">
              <span>Descripción</span>
              <textarea class="input" rows="3" maxlength="4000" [(ngModel)]="form.description" name="description"></textarea>
            </label>
            <label>
              <span>Calle</span>
              <input class="input" maxlength="200" [(ngModel)]="form.addressStreet" name="addressStreet" />
            </label>
            <label>
              <span>Número</span>
              <input class="input" maxlength="30" [(ngModel)]="form.addressNumber" name="addressNumber" />
            </label>
            <label>
              <span>Piso</span>
              <input class="input" maxlength="20" [(ngModel)]="form.addressFloor" name="addressFloor" />
            </label>
            <label>
              <span>Departamento</span>
              <input class="input" maxlength="20" [(ngModel)]="form.addressApartment" name="addressApartment" />
            </label>
            <label>
              <span>Superficie m²</span>
              <input class="input" type="number" min="0" step="0.01" [(ngModel)]="form.surfaceM2" name="surfaceM2" />
            </label>
            <label>
              <span>Superficie cubierta</span>
              <input class="input" type="number" min="0" step="0.01" [(ngModel)]="form.coveredSurfaceM2" name="coveredSurfaceM2" />
            </label>
            <label>
              <span>Habitaciones</span>
              <input class="input" type="number" min="0" step="1" [(ngModel)]="form.bedrooms" name="bedrooms" />
            </label>
            <label>
              <span>Baños</span>
              <input class="input" type="number" min="0" step="1" [(ngModel)]="form.bathrooms" name="bathrooms" />
            </label>
            <label>
              <span>Cocheras cubiertas</span>
              <input class="input" type="number" min="0" step="1" [(ngModel)]="form.coveredParkingSpots" name="coveredParkingSpots" />
            </label>
            <label>
              <span>Alquiler mensual sugerido *</span>
              <input class="input" required type="number" min="1" step="1" [(ngModel)]="form.monthlyRentSuggestion" name="monthlyRentSuggestion" />
            </label>
            <label>
              <span>Expensas</span>
              <input class="input" type="number" min="0" step="1" [(ngModel)]="form.monthlyCondoFee" name="monthlyCondoFee" />
            </label>
            <div class="span-2 amenities-row">
              <label class="checkbox-inline"><input type="checkbox" [(ngModel)]="form.hasBalcony" name="hasBalcony" /> Balcón</label>
              <label class="checkbox-inline"><input type="checkbox" [(ngModel)]="form.hasTerrace" name="hasTerrace" /> Terraza</label>
              <label class="checkbox-inline"><input type="checkbox" [(ngModel)]="form.hasGarden" name="hasGarden" /> Jardín</label>
              <label class="checkbox-inline"><input type="checkbox" [(ngModel)]="form.hasElevator" name="hasElevator" /> Ascensor</label>
              <label class="checkbox-inline"><input type="checkbox" [(ngModel)]="form.hasPool" name="hasPool" /> Pileta</label>
              <label class="checkbox-inline"><input type="checkbox" [(ngModel)]="form.hasSecurity" name="hasSecurity" /> Seguridad 24h</label>
              <label class="checkbox-inline"><input type="checkbox" [(ngModel)]="form.petsAllowed" name="petsAllowed" /> Mascotas</label>
              <label class="checkbox-inline"><input type="checkbox" [(ngModel)]="form.furnished" name="furnished" /> Amoblado</label>
            </div>
            <label class="span-2">
              <span>Amenidades (una por línea)</span>
              <textarea class="input" rows="3" [(ngModel)]="amenitiesText" name="amenitiesText" placeholder="Parrilla&#10;SUM&#10;Cine"></textarea>
            </label>
            <div class="span-2 form-actions">
              <label class="checkbox-inline">
                <input type="checkbox" [(ngModel)]="publishImmediately" name="publishImmediately" />
                Publicar inmediatamente (si no, se guarda como BORRADOR)
              </label>
              <div class="spacer"></div>
              <button type="button" class="btn-secondary" (click)="resetFormOne()">Limpiar</button>
              <button type="submit" class="btn-primary" [disabled]="submitting()">
                {{ submitting() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
            @if (createResultMessage()) {
              <div class="alert span-2" [class.error]="createResultIsError()">
                {{ createResultMessage() }}
              </div>
            }
          </form>
        </div>
      }

      @if (tab() === 'BATCH') {
        <div class="form-card">
          <h2>Publicar lote de inmuebles</h2>
          <p class="muted">
            Introduce la cantidad de inmuebles que deseas generar y edita sus datos básicos.
          </p>
          <div class="batch-controls">
            <label>
              <span>Cantidad</span>
              <input class="input-sm" type="number" min="1" max="50" [(ngModel)]="batchSize" />
            </label>
            <button class="btn-secondary" (click)="initBatch()">Generar filas</button>
            <label class="checkbox-inline">
              <input type="checkbox" [(ngModel)]="batchPublishImmediately" />
              Publicar inmediatamente todos
            </label>
            <div class="spacer"></div>
            <button class="btn-primary" [disabled]="submittingBatch() || batchItems().length === 0" (click)="submitBatch()">
              {{ submittingBatch() ? 'Enviando...' : 'Enviar lote (' + batchItems().length + ')' }}
            </button>
          </div>
          @if (batchResultMessage()) {
            <div class="alert mt-1" [class.error]="batchResultIsError()">
              {{ batchResultMessage() }}
            </div>
          }

          @if (batchItems().length > 0) {
            <div class="batch-grid">
              <div class="batch-row batch-head">
                <span>#</span><span>Título</span><span>Tipo</span>
                <span>Ciudad</span><span>Zona</span><span>Alquiler</span><span>Superficie</span>
                <span>Habit.</span><span>Baños</span>
              </div>
              @for (row of batchItems(); let i = $index; track i) {
                <div class="batch-row">
                  <span class="idx">{{ i + 1 }}</span>
                  <input class="input-sm" required maxlength="150" [(ngModel)]="row.title" />
                  <select class="input-sm" required [(ngModel)]="row.type">
                    @for (t of TYPE_OPTIONS; track t.v) { <option [ngValue]="t.v">{{ t.label }}</option> }
                  </select>
                  <input class="input-sm" required maxlength="200" [(ngModel)]="row.city" />
                  <input class="input-sm" required maxlength="100" [(ngModel)]="row.zone" />
                  <input class="input-sm" type="number" min="1" step="1" [(ngModel)]="row.monthlyRentSuggestion" />
                  <input class="input-sm" type="number" min="0" step="0.01" [(ngModel)]="row.surfaceM2" />
                  <input class="input-sm" type="number" min="0" step="1" [(ngModel)]="row.bedrooms" />
                  <input class="input-sm" type="number" min="0" step="1" [(ngModel)]="row.bathrooms" />
                </div>
              }
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .properties-page { padding: 1.75rem; }
    .section-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.25rem; }
    .title { margin:0 0 .25rem; font-size:1.5rem; }
    .subtitle { margin:0; color:#64748b; }
    .tabs { display:flex; gap:.25rem; background:#f1f5f9; padding:.25rem; border-radius:12px; }
    .tab { border:0; background:transparent; padding:.5rem .9rem; border-radius:10px; cursor:pointer; font-weight:600; color:#475569; }
    .tab.active { background:white; color:#0f172a; box-shadow: 0 1px 2px rgba(15,23,42,.08); }
    .filters, .batch-controls {
      display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; margin-bottom:1rem;
      padding:.8rem 1rem; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;
    }
    .input, .input-sm, select.input, select.input-sm {
      width:100%; border:1px solid #cbd5e1; border-radius:10px; padding:.6rem .8rem;
      font-size:.95rem; background:white; box-sizing:border-box;
    }
    .input-sm { padding:.4rem .55rem; font-size:.9rem; width:auto; }
    .btn-primary, .btn-secondary, .btn-ghost {
      border:0; border-radius:10px; padding:.55rem 1rem; font-weight:600; cursor:pointer;
    }
    .btn-primary { background: #4F46E5; color:white; }
    .btn-primary:disabled { opacity:.6; cursor:not-allowed; }
    .btn-secondary { background: #E2E8F0; color:#0f172a; }
    .btn-secondary:disabled { opacity:.6; }
    .btn-ghost { background:transparent; color:#4F46E5; padding:.5rem; }
    .btn-ghost.danger { color: #B91C1C; }
    .loading-box, .empty-state {
      border:1px dashed #cbd5e1; border-radius:14px; padding:2.5rem; text-align:center; color:#64748b;
    }
    .empty-state h3 { margin:0 0 .5rem; color:#0f172a; }
    .cards-grid {
      display:grid; gap:1rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }
    .property-card { background:white; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(15,23,42,.05); display:flex; flex-direction:column; }
    .photo { position:relative; aspect-ratio: 16 / 9; background:#f1f5f9; }
    .photo img { width:100%; height:100%; object-fit:cover; }
    .photo-empty { display:flex; align-items:center; justify-content:center; color:#64748b; }
    .empty-photo-text { padding:.5rem .8rem; background:#e2e8f0; border-radius:10px; font-size:.85rem; }
    .status-pill {
      position:absolute; top:.75rem; left:.75rem; padding:.25rem .6rem; border-radius:999px;
      font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.03em;
    }
    .status-pill.DRAFT { background:#fde68a; color:#854d0e; }
    .status-pill.PUBLISHED { background:#bbf7d0; color:#166534; }
    .status-pill.UNLISTED { background:#fecaca; color:#991b1b; }
    .status-pill.DELETED { background:#d1d5db; color:#374151; }
    .content { padding:.9rem 1rem 1rem; display:flex; flex-direction:column; gap:.45rem; }
    .type-row { display:flex; justify-content:space-between; align-items:center; }
    .type-label { font-size:.75rem; text-transform:uppercase; font-weight:700; color:#4338ca; background:#eef2ff; padding:.2rem .5rem; border-radius:999px; }
    .rent { font-weight:700; color:#0f172a; }
    .prop-title { margin:0; font-size:1.05rem; }
    .address { margin:0; color:#475569; font-size:.9rem; }
    .meta-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:.4rem; font-size:.82rem; color:#475569; padding:.35rem 0; border-top:1px dashed #e2e8f0; border-bottom:1px dashed #e2e8f0; }
    .actions-row { display:flex; gap:.4rem; justify-content:flex-end; margin-top:.15rem; }
    .form-card { background:white; border:1px solid #e2e8f0; border-radius:14px; padding:1.25rem 1.4rem; box-shadow:0 1px 2px rgba(15,23,42,.04); }
    .grid-form { display:grid; grid-template-columns: repeat(2, 1fr); gap:.9rem; }
    .grid-form label { display:flex; flex-direction:column; gap:.3rem; font-size:.85rem; font-weight:600; color:#334155; }
    .span-2 { grid-column: span 2; }
    .amenities-row { display:flex; gap:1rem; flex-wrap:wrap; padding:.5rem 0; border:1px solid #e2e8f0; border-radius:10px; padding:.7rem 1rem; }
    .checkbox-inline { display:flex; align-items:center; gap:.35rem; font-weight:500; color:#0f172a; }
    .form-actions { display:flex; align-items:center; gap:.6rem; border-top:1px dashed #e2e8f0; padding-top:1rem; }
    .spacer { flex:1; }
    .alert { padding:.8rem 1rem; border-radius:10px; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; }
    .alert.error { background:#fef2f2; color:#991b1b; border-color:#fecaca; }
    .muted { color:#64748b; }
    .mt-1 { margin-top:.75rem; }
    .batch-grid {
      display:grid; gap:.4rem; margin-top:1rem;
    }
    .batch-head { background:#f1f5f9; font-weight:700; color:#0f172a; }
    .batch-row {
      display:grid;
      grid-template-columns: 3.5rem 1.5fr 1fr 1fr 1fr 1fr .9fr .6fr .6fr;
      gap:.45rem; padding:.5rem .65rem; align-items:center;
      border:1px solid #e2e8f0; border-radius:10px; background:white;
    }
    .batch-row .idx { text-align:center; color:#64748b; font-weight:700; }
    .batch-row input, .batch-row select { width:100%; }
  `]
})
export class MyPropertiesComponent implements OnInit {
  private readonly svc = inject(PropertiesService);

  readonly TYPE_OPTIONS = TYPE_OPTIONS;
  readonly STATUS_LABEL = STATUS_LABEL;

  readonly loading = signal(true);
  readonly properties = signal<Property[]>([]);

  readonly tab = signal<TabView>('LIST');
  readonly submitting = signal(false);
  readonly submittingBatch = signal(false);
  readonly createResultMessage = signal<string | null>(null);
  readonly createResultIsError = signal(false);
  readonly batchResultMessage = signal<string | null>(null);
  readonly batchResultIsError = signal(false);

  readonly batchItems = signal<PropertyPayload[]>([]);
  readonly batchSize = 3;
  batchPublishImmediately = false;
  publishImmediately = false;
  amenitiesText = '';

  filters: { role: '' | 'OWNER' | 'MANAGER'; status: '' | PropertyStatus } = { role: '', status: '' };

  form: Partial<PropertyPayload> = {
    type: 'APARTMENT',
    title: '',
    city: '',
    zone: ''
  };

  ngOnInit(): void {
    this.load();
  }

  typeLabel(t: PropertyType): string {
    return TYPE_OPTIONS.find((x) => x.v === t)?.label ?? t;
  }

  load() {
    this.loading.set(true);
    const role = this.filters.role === '' ? undefined : this.filters.role;
    const status = this.filters.status === '' ? undefined : this.filters.status;
    this.svc.listMine({ role, status, limit: 200 }).subscribe({
      next: (items) => this.properties.set(items),
      error: () => this.properties.set([]),
      complete: () => this.loading.set(false)
    });
  }

  quickPublish(p: Property) {
    this.svc.relist(p.id).subscribe({
      next: (updated) => {
        this.properties.update((list) => list.map((x) => (x.id === p.id ? updated : x)));
      },
      error: (err) => {
        console.warn('Error quickPublish', err);
      }
    });
  }

  quickUnlist(p: Property) {
    this.svc.unlist(p.id).subscribe({
      next: (updated) => {
        this.properties.update((list) => list.map((x) => (x.id === p.id ? updated : x)));
      }
    });
  }

  quickRelist(p: Property) {
    this.svc.relist(p.id).subscribe({
      next: (updated) => {
        this.properties.update((list) => list.map((x) => (x.id === p.id ? updated : x)));
      }
    });
  }

  quickDelete(p: Property) {
    if (!confirm(`¿Eliminar ${p.title}? Esta acción solo soft-deletea el inmueble.`)) return;
    this.svc.delete(p.id).subscribe({
      next: () => {
        this.properties.update((list) => list.filter((x) => x.id !== p.id));
      }
    });
  }

  resetFormOne() {
    this.form = { type: 'APARTMENT', title: '', city: '', zone: '' };
    this.amenitiesText = '';
    this.publishImmediately = false;
    this.createResultMessage.set(null);
  }

  private buildPayload(): PropertyPayload {
    const amenities = this.amenitiesText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return {
      ...this.form,
      amenities,
      type: this.form.type ?? 'APARTMENT',
      title: this.form.title ?? '',
      city: this.form.city ?? '',
      zone: this.form.zone ?? ''
    } as PropertyPayload;
  }

  submitOne() {
    const payload = this.buildPayload();
    if (!payload.title || !payload.city || !payload.zone || !payload.type || !payload.monthlyRentSuggestion) {
      this.createResultIsError.set(true);
      this.createResultMessage.set('Completar campos marcados con * (título, tipo, ciudad, zona, alquiler).');
      return;
    }
    this.submitting.set(true);
    this.createResultMessage.set(null);
    this.svc
      .publishOne(payload, { status: this.publishImmediately ? 'PUBLISHED' : 'DRAFT' })
      .subscribe({
        next: (saved) => {
          this.submitting.set(false);
          this.createResultIsError.set(false);
          this.createResultMessage.set(
            `Guardado correctamente. Estado: ${STATUS_LABEL[saved.status]} (${saved.id.slice(0, 8)}...)`
          );
          this.load();
        },
        error: (err) => {
          this.submitting.set(false);
          this.createResultIsError.set(true);
          this.createResultMessage.set(
            `Error al guardar: ${err?.error?.message || err?.message || 'revisar datos'}`
          );
        }
      });
  }

  initBatch() {
    const n = Math.max(1, Math.min(50, Number(this.batchSize || 1)));
    const rows: PropertyPayload[] = Array.from({ length: n }, () => ({
      type: 'APARTMENT',
      title: '',
      city: 'Buenos Aires',
      zone: 'Palermo',
      monthlyRentSuggestion: 500000
    }));
    this.batchItems.set(rows);
  }

  submitBatch() {
    const rows = this.batchItems();
    if (rows.length === 0) return;
    const invalid = rows.findIndex(
      (r) => !r.title || !r.type || !r.city || !r.zone || !r.monthlyRentSuggestion
    );
    if (invalid >= 0) {
      this.batchResultIsError.set(true);
      this.batchResultMessage.set(
        `Fila #${invalid + 1} incompleta (título, tipo, ciudad, zona, alquiler).`
      );
      return;
    }
    this.submittingBatch.set(true);
    this.batchResultMessage.set(null);
    this.svc
      .publishBatch(rows, { status: this.batchPublishImmediately ? 'PUBLISHED' : 'DRAFT' })
      .subscribe({
        next: (r) => {
          this.submittingBatch.set(false);
          this.batchResultIsError.set(false);
          this.batchResultMessage.set(
            `Lote creado: ${r.created.length} inmueble(s), ${r.publishedCount} publicado(s) inmediatamente.`
          );
          this.load();
        },
        error: (err) => {
          this.submittingBatch.set(false);
          this.batchResultIsError.set(true);
          this.batchResultMessage.set(
            `Error al enviar lote: ${err?.error?.message || err?.message || 'revisar datos'}`
          );
        }
      });
  }
}
