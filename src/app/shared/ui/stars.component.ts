import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from './icon.component';

// Calificación promedio: una sola estrella con el número, que se lee más rápido que cinco íconos.
@Component({
  selector: 'app-stars',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (average() !== null && average() !== undefined && (count() ?? 1) > 0) {
      <span class="stars">
        <app-icon name="star" [size]="16" />
        <span>{{ formatted() }}</span>
        @if (count() !== null && count() !== undefined) {
          <span class="text-muted text-sm">({{ count() }})</span>
        }
        <span class="visually-hidden">de 5 estrellas</span>
      </span>
    } @else {
      <span class="text-muted text-sm">Sin calificaciones</span>
    }
  `
})
export class StarsComponent {
  readonly average = input<number | null | undefined>();
  readonly count = input<number | null | undefined>();
  readonly formatted = computed(() => (this.average() ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
}
