import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';
import { RouterModule } from '@angular/router';
import { ContractResponse, daysUntil, formatDate, formatCurrencyCOP } from '../../models/contract.models';
import { PlaceholderComponent } from '../../../../shared/components/placeholder/placeholder.component';

@Component({
  selector: 'app-contract-expiration-card',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, PlaceholderComponent],
  template: `
    <ion-card class="expiration-card">
      <ion-card-header>
        <ion-card-title class="card-title">{{ title }}</ion-card-title>
        <div class="chips-row">
          <ion-chip color="warning" outline="false">
            <ion-label>En ≤ 30 días: {{ count30d() }}</ion-label>
          </ion-chip>
          <ion-chip color="danger" outline="false">
            <ion-label>En ≤ 7 días: {{ count7d() }}</ion-label>
          </ion-chip>
          <ion-chip color="medium" outline="false">
            <ion-label>Vencen hoy: {{ countToday() }}</ion-label>
          </ion-chip>
        </div>
      </ion-card-header>

      <ion-card-content>
        @if (slice().length === 0) {
          <app-placeholder [title]="'No hay contratos próximos a vencer'" />
        } @else {
          <ion-list lines="inset" class="contracts-list">
            @for (c of slice(); track c.id) {
              <ion-item button detail="true" [routerLink]="['/contracts', c.id]" class="contract-item">
                <ion-avatar slot="start" class="avatar" [class.urgent]="isUrgent(c)">
                  {{ daysUntilLabel(c) }}
                </ion-avatar>
                <ion-label>
                  <h3 class="contract-name">{{ c.propertyName ?? 'Sin nombre' }}</h3>
                  <p class="contract-tenant">
                    <ion-icon name="person-outline" aria-hidden="true"></ion-icon>
                    {{ c.tenantDisplayName ?? 'Inquilino' }}
                  </p>
                  <p class="contract-dates">
                    <ion-icon name="calendar-outline" aria-hidden="true"></ion-icon>
                    Vence: {{ formatDate(c.endDate) }}
                  </p>
                </ion-label>
                <div slot="end" class="rent-amount">
                  {{ formatCurrencyCOP(c.monthlyRentAmount) }}
                </div>
              </ion-item>
            }
          </ion-list>

          <div class="actions-row">
            <ion-buttons class="actions-buttons">
              <ion-button
                fill="clear"
                size="small"
                [routerLink]="['/contracts']"
                [queryParams]="{ expiringWithinDays: 30 }"
              >
                Ver todos
                <ion-icon slot="end" name="arrow-forward-outline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styleUrls: ['./contract-expiration-card.component.scss']
})
export class ContractExpirationCardComponent {
  @Input() upcoming: ContractResponse[] = [];
  @Input() title = 'Contratos por vencer';

  readonly slice = computed(() => this.upcoming.slice(0, 8));

  readonly count30d = computed(() =>
    this.upcoming.filter((c) => {
      const d = daysUntil(c.endDate);
      return d >= 0 && d <= 30;
    }).length
  );

  readonly count7d = computed(() =>
    this.upcoming.filter((c) => {
      const d = daysUntil(c.endDate);
      return d >= 0 && d <= 7;
    }).length
  );

  readonly countToday = computed(() =>
    this.upcoming.filter((c) => daysUntil(c.endDate) === 0).length
  );

  isUrgent(c: ContractResponse): boolean {
    const d = daysUntil(c.endDate);
    return d <= 7 && d >= 0;
  }

  daysUntilLabel(c: ContractResponse): string {
    const d = daysUntil(c.endDate);
    if (d < 0) return 'Ven.';
    if (d === 0) return 'Hoy';
    if (d === 1) return '1 día';
    if (d <= 30) return `${d}d`;
    return '>30';
  }

  formatDate = formatDate;
  formatCurrencyCOP = formatCurrencyCOP;
}
