import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { LedgerFailure, ledgerFailure, rowsScanned } from '../../data/ledger-reconciliation';
import { LedgerReconciliation } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { IconComponent } from '../../shared/ui/icon.component';
import { MoneyPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

// Fecha completa con segundos y en hora de Colombia, sin importar el huso del navegador.
const CHECKED_AT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'long',
  timeStyle: 'medium'
});
const COUNT = new Intl.NumberFormat('es-CO');

type Verdict = 'consistent' | 'differences' | 'empty';

// Safety (SAF-01): el administrador ve si el libro de pagos cuadra. Cada vez que se abre o se
// pulsa "Conciliar ahora", el backend corre una conciliación nueva sobre todo el libro.
//
// La pantalla nunca decide por su cuenta: "El libro cuadra" solo aparece con una corrida completa
// que el backend marcó como consistente. Mientras se concilia, o si la consulta falla, no queda
// ningún resultado anterior a la vista.
@Component({
  selector: 'app-ledger-reconciliation-page',
  imports: [IconComponent, MoneyPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Conciliación de pagos</h1>
          <p class="lede">Revisa que cada peso cobrado tenga su ingreso, que las transferencias sumen lo que dicen y que lo cobrado sea igual a la comisión más lo que reciben los técnicos.</p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-primary" (click)="run()" [attr.aria-disabled]="loading()" [attr.aria-busy]="loading()">
            <app-icon name="refresh" />{{ loading() ? 'Conciliando…' : 'Conciliar ahora' }}
          </button>
        </div>
      </header>

      @if (loading()) {
        <app-loading text="Conciliando el libro de pagos…" />
      } @else if (failure(); as f) {
        <app-error [title]="f.title" [message]="f.message" [retryable]="f.retryable" (retry)="run()" />
      } @else if (report(); as r) {
        <div
          class="alert verdict"
          [class.alert-success]="verdict() === 'consistent'"
          [class.alert-danger]="verdict() === 'differences'"
          [class.alert-warning]="verdict() === 'empty'"
          role="status"
        >
          <app-icon [name]="verdict() === 'consistent' ? 'check' : 'alert'" />
          <div>
            <strong>{{ verdictTitle() }}</strong>
            <span class="text-sm">{{ verdictDetail() }}</span>
            <span class="text-sm">Corrida completada el <time [attr.datetime]="r.checkedAt">{{ checkedAt() }}</time> (hora de Colombia)</span>
          </div>
        </div>

        <section class="panel stack-sm" aria-labelledby="scanned-title">
          <h2 id="scanned-title" class="text-lg">Filas revisadas en esta corrida</h2>
          <dl class="facts">
            <div><dt>Pagos</dt><dd>{{ n(r.scanned.payments) }}</dd></div>
            <div><dt>Intentos de pago</dt><dd>{{ n(r.scanned.paymentAttempts) }}</dd></div>
            <div><dt>Ingresos de técnicos</dt><dd>{{ n(r.scanned.earnings) }}</dd></div>
            <div><dt>Transferencias</dt><dd>{{ n(r.scanned.payouts) }}</dd></div>
            <div><dt>Renglones de transferencia</dt><dd>{{ n(r.scanned.payoutEntries) }}</dd></div>
            <div><dt>Deudas</dt><dd>{{ n(r.scanned.debts) }}</dd></div>
            <div><dt>Liquidaciones en efectivo</dt><dd>{{ n(r.scanned.cashSettlements) }}</dd></div>
          </dl>
        </section>

        <section class="stack-sm" aria-labelledby="balances-title">
          <h2 id="balances-title" class="text-lg">Ecuaciones del libro</h2>
          <p class="text-muted text-sm">Cada ecuación compara dos sumas del mismo tipo de operación. Los importes son pesos enteros, sin redondeo.</p>
          <div class="panel table-panel">
            <table class="table">
              <thead>
                <tr><th scope="col">Ecuación</th><th scope="col" class="num">Un lado</th><th scope="col" class="num">Otro lado</th><th scope="col">Estado</th></tr>
              </thead>
              <tbody>
                @for (b of r.balances; track b.code) {
                  <tr [class.off]="!b.holds">
                    <td data-label="Ecuación">{{ b.description }}</td>
                    <td data-label="Un lado" class="num amount">{{ b.expected | money }}</td>
                    <td data-label="Otro lado" class="num amount">{{ b.actual | money }}</td>
                    <td data-label="Estado"><strong>{{ b.holds ? 'Cuadra' : 'No cuadra' }}</strong></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel stack-sm" aria-labelledby="totals-title">
          <h2 id="totals-title" class="text-lg">Saldos</h2>
          <dl class="facts">
            <div><dt>Cobrado</dt><dd class="amount">{{ r.totals.collected | money }}</dd></div>
            <div><dt>Comisión</dt><dd class="amount">{{ r.totals.commission | money }}</dd></div>
            <div><dt>Neto de técnicos</dt><dd class="amount">{{ r.totals.net | money }}</dd></div>
            <div><dt>Retenido (HELD)</dt><dd class="amount">{{ r.totals.heldNet | money }}</dd></div>
            <div><dt>Disponible (AVAILABLE)</dt><dd class="amount">{{ r.totals.availableNet | money }}</dd></div>
            <div><dt>Transferido (PAID_OUT)</dt><dd class="amount">{{ r.totals.paidOutNet | money }}</dd></div>
            <div><dt>Deudas pendientes de propietarios</dt><dd class="amount">{{ r.totals.outstandingDebts | money }}</dd></div>
            <div><dt>Ingresos anteriores al corte digital</dt><dd class="amount">{{ r.totals.legacyEarningsGross | money }}</dd></div>
          </dl>
          <p class="text-muted text-sm">Los ingresos y transferencias anteriores al corte digital se muestran aparte y no entran en las reglas que cruzan pagos.</p>
        </section>

        <section class="stack-sm" aria-labelledby="rules-title">
          <h2 id="rules-title" class="text-lg">Reglas con diferencias</h2>
          <p class="text-muted text-sm">Aquí solo aparecen las reglas que tienen filas que las rompen. De cada una se muestran hasta unos pocos identificadores de fila, sin datos personales.</p>
          @if (r.findings.length) {
            <div class="panel table-panel">
              <table class="table">
                <thead><tr><th scope="col">Regla</th><th scope="col" class="num">Filas</th><th scope="col">Identificadores</th></tr></thead>
                <tbody>
                  @for (f of r.findings; track f.code) {
                    <tr>
                      <td data-label="Regla"><div class="stack-sm"><span>{{ f.description }}</span><code class="text-xs">{{ f.code }}</code></div></td>
                      <td data-label="Filas" class="num"><strong>{{ n(f.count) }}</strong></td>
                      <td data-label="Identificadores"><ul class="ids">@for (id of f.sample; track id) { <li><code>{{ id }}</code></li> }</ul></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else if (verdict() === 'empty') {
            <p class="text-muted">No había filas que revisar, así que ninguna regla se pudo romper.</p>
          } @else {
            <p class="text-muted">En esta corrida ninguna de las nueve reglas tiene filas que la rompan.</p>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .verdict { display: flex; gap: var(--s-2); align-items: flex-start; }
    .verdict > div { display: flex; flex-direction: column; gap: var(--s-1); min-width: 0; }
    .btn[aria-disabled='true'] { cursor: progress; }
    .table-panel { padding: var(--s-2) var(--s-4); }
    .amount { white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.off td { color: var(--danger, #b42318); }
    .ids { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    .ids code { overflow-wrap: anywhere; }
  `
})
export class LedgerReconciliationPage {
  private readonly api = inject(WorkApi);
  private readonly users = inject(CurrentUserStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly report = signal<LedgerReconciliation | null>(null);
  readonly failure = signal<LedgerFailure | null>(null);

  readonly verdict = computed<Verdict | null>(() => {
    const r = this.report();
    if (!r) return null;
    if (!r.consistent) return 'differences';
    return rowsScanned(r.scanned) === 0 ? 'empty' : 'consistent';
  });

  readonly verdictTitle = computed(() => {
    switch (this.verdict()) {
      case 'consistent':
        return 'El libro cuadra';
      case 'empty':
        return 'El libro está vacío';
      default:
        return 'Hay diferencias en el libro';
    }
  });

  readonly verdictDetail = computed(() => {
    const r = this.report();
    if (!r) return '';
    const rows = this.n(rowsScanned(r.scanned));
    if (this.verdict() === 'empty') {
      return 'El servidor leyó el libro y no encontró ninguna fila de pagos: todavía no hay nada que conciliar. Si ya hay pagos registrados, el servidor no los pudo ver y esto no es un resultado válido.';
    }
    if (this.verdict() === 'consistent') return `Se revisaron ${rows} filas: todas las ecuaciones cuadran y ninguna regla tiene diferencias.`;
    const rules = r.findings.length;
    const equations = r.balances.filter((b) => !b.holds).length;
    return `Se revisaron ${rows} filas: ${plural(rules, 'regla con diferencias', 'reglas con diferencias')} y ${plural(equations, 'ecuación que no cuadra', 'ecuaciones que no cuadran')}.`;
  });

  readonly checkedAt = computed(() => {
    const r = this.report();
    return r ? CHECKED_AT.format(new Date(r.checkedAt)) : '';
  });

  /** A quién se le pidió la corrida que está a la vista. */
  private requestedBy = this.identity();
  private pending?: Subscription;

  constructor() {
    // Si la sesión cambia de persona o de rol, lo que se le mostró a la anterior deja de verse.
    effect(() => {
      const current = this.identity();
      if (current === this.requestedBy) return;
      untracked(() => {
        this.report.set(null);
        this.run(true);
      });
    });
    this.run();
  }

  /** Una sola corrida a la vez: mientras hay una en curso, pulsar de nuevo no pide otra. */
  run(force = false): void {
    if (this.loading() && !force) return;
    const requestedBy = this.identity();
    this.requestedBy = requestedBy;
    this.loading.set(true);
    this.report.set(null);
    this.failure.set(null);
    this.pending?.unsubscribe();
    this.pending = this.api
      .ledgerReconciliation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => this.finish(requestedBy, () => this.report.set(report)),
        error: (error: unknown) => this.finish(requestedBy, () => this.failure.set(ledgerFailure(error)))
      });
  }

  n(value: number): string {
    return COUNT.format(value);
  }

  /** Una respuesta pedida por otra sesión llega tarde y se descarta. */
  private finish(requestedBy: string, apply: () => void): void {
    if (requestedBy !== this.requestedBy || requestedBy !== this.identity()) return;
    apply();
    this.loading.set(false);
  }

  private identity(): string {
    return `${this.users.user()?.id ?? ''}|${this.users.activeRole() ?? ''}`;
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
