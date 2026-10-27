import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IconComponent } from './icon.component';

// Foto con proporción fija y respaldo cuando no hay imagen o la URL firmada ya venció.
@Component({
  selector: 'app-photo',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'photo', '[style.aspect-ratio]': 'ratio()' },
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" [alt]="alt()" loading="lazy" decoding="async" (error)="failed.set(true)" />
    } @else {
      <span class="photo-placeholder">
        <app-icon name="image" [size]="28" />
        <span class="visually-hidden">{{ alt() || 'Sin foto' }}</span>
      </span>
    }
  `
})
export class PhotoComponent {
  readonly src = input<string | null | undefined>();
  readonly alt = input('');
  readonly ratio = input('4 / 3');
  readonly failed = signal(false);
}
