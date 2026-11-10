import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { WorkApi } from '../../data/work.api';
import { IconComponent } from '../../shared/ui/icon.component';
import { MoneyPipe, WhenPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

// Safety (SAF-01): el administrador ve si el libro de pagos cuadra. Cada vez que se abre o se
// pulsa "Conciliar ahora", el backend corre una conciliación nueva sobre todo el libro.
@Component({
  selector: 'app-ledger-reconciliation-page',
  imports: [IconComponent, MoneyPipe, WhenPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Conciliación de pagos</h1>
          <p class="lede">Revisa que cada peso cobrado tenga su ingreso, que las transferencias sumen lo que dicen y que lo cobrado sea igual a la comisión más lo que reciben los técnicos.</p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-primary" (click)="report.reload()" [disabled]="report.isLoading()">
            <app-icon name="refresh" />Conciliar ahora
          </button>
        </div>
      </header>

      @if (report.isLoading() && !report.hasValue()) {
        <app-loading text="Conciliando el libro de pagos…" />
      } @else if (report.error()) {
        <app-error (retry)="report.reload()" />
      } @else if (report.hasValue()) {
        @let r = report.value();
        <div class="alert verdict" [class.alert-success]="r.consistent" [class.alert-danger]="!r.consistent" role="status">
          <app-icon [name]="r.consistent ? 'check' : 'alert'" />
          <div>
            <strong>{{ r.consistent ? 'El libro cuadra' : 'Hay diferencias en el libro' }}</strong>
            <span class="text-sm">Revisado: {{ r.checkedAt | when }}</span>
          </div>
        </div>

        <section class="panel stack-sm" aria-labelledby="balance-title">
          <h2 id="balance-title" class="text-lg">Balance</h2>
          <p class="equation" [class.off]="!r.balanced">
            Cobrado <strong>{{ r.totals.collected | money }}</strong>
            {{ r.balanced ? '=' : '≠' }} comisión <strong>{{ r.totals.commission | money }}</strong>
            + técnicos <strong>{{ r.totals.net | money }}</strong>
          </p>
          <dl class="facts">
            <div><dt>Retenido (HELD)</dt><dd>{{ r.totals.heldNet | money }}</dd></div>
            <div><dt>Disponible (AVAILABLE)</dt><dd>{{ r.totals.availableNet | money }}</dd></div>
            <div><dt>Transferido (PAID_OUT)</dt><dd>{{ r.totals.paidOutNet | money }}</dd></div>
            <div><dt>Deudas pendientes de propietarios</dt><dd>{{ r.totals.outstandingDebts | money }}</dd></div>
          </dl>
        </section>

        <section class="stack-sm" aria-labelledby="rules-title">
          <h2 id="rules-title" class="text-lg">Reglas con diferencias</h2>
          @if (r.findings.length) {
            <div class="panel table-panel">
              <table class="table">
                <thead><tr><th scope="col">Regla</th><th scope="col" class="num">Filas</th><th scope="col">Identificadores</th></tr></thead>
                <tbody>
                  @for (f of r.findings; track f.code) {
                    <tr>
                      <td data-label="Regla"><div class="stack-sm"><span>{{ f.description }}</span><code class="text-xs">{{ f.code }}</code></div></td>
                      <td data-label="Filas" class="num"><strong>{{ f.count }}</strong></td>
                      <td data-label="Identificadores"><ul class="ids">@for (id of f.sample; track id) { <li><code>{{ id }}</code></li> }</ul></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="text-muted">Ninguna de las nueve reglas tiene filas que la rompan.</p>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .verdict { display: flex; gap: var(--s-2); align-items: flex-start; }
    .verdict > div { display: flex; flex-direction: column; gap: var(--s-1); }
    .equation { font-size: var(--text-lg, 1.125rem); line-height: 1.6; overflow-wrap: anywhere; }
    .equation.off strong { color: var(--danger, #b42318); }
    .table-panel { padding: var(--s-2) var(--s-4); }
    .ids { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    .ids code { overflow-wrap: anywhere; }
  `
})
export class LedgerReconciliationPage {
  private readonly api = inject(WorkApi);
  readonly report = rxResource({ stream: () => this.api.ledgerReconciliation() });
}
