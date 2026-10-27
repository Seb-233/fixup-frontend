import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Label, pick } from '../format';

// Estado de un objeto (solicitud, pago, visita) como texto con tono. El color nunca va solo: el
// texto dice el estado y el tono solo refuerza.
@Component({
  selector: 'app-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class]="'chip chip-' + resolved().tone">{{ resolved().text }}</span>`
})
export class StatusComponent {
  readonly map = input.required<Record<string, Label>>();
  readonly value = input<string | null | undefined>();
  readonly resolved = computed(() => pick(this.map(), this.value()));
}
