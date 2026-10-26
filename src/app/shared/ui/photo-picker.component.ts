import { ChangeDetectionStrategy, Component, OnDestroy, computed, input, output, signal } from '@angular/core';
import { ACCEPTED_IMAGES, rejectFile } from '../../data/media.service';
import { IconComponent } from './icon.component';

interface Picked {
  file: File;
  preview: string;
}

// Selector de fotos con vista previa local. Valida tipo y tamaño antes de subir nada; la subida la
// hace quien lo usa, con los archivos que emite.
@Component({
  selector: 'app-photo-picker',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack-sm">
      <label class="btn btn-secondary picker-trigger" [class.disabled]="full()">
        <app-icon name="camera" />
        <span>{{ label() }}</span>
        <input
          type="file"
          class="visually-hidden"
          [accept]="accept"
          multiple
          [disabled]="full()"
          (change)="onPick($event)"
        />
      </label>
      <span class="text-xs text-muted">JPG, PNG o WebP, hasta 10 MB cada una. Máximo {{ max() }}.</span>
      @for (problem of problems(); track problem) {
        <span class="text-xs" style="color: var(--danger); font-weight: 600">{{ problem }}</span>
      }
      @if (picked().length) {
        <ul class="gallery picker-list">
          @for (item of picked(); track item.preview; let i = $index) {
            <li class="photo">
              <img [src]="item.preview" [alt]="'Foto ' + (i + 1) + ' seleccionada'" />
              <button type="button" class="btn btn-secondary btn-icon remove" (click)="remove(i)"
                      [attr.aria-label]="'Quitar foto ' + (i + 1)">
                <app-icon name="close" [size]="16" />
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .picker-trigger { align-self: flex-start; position: relative; }
    .picker-trigger.disabled { opacity: 0.55; cursor: not-allowed; }
    .picker-trigger:has(input:focus-visible) { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
    .picker-list { list-style: none; margin: 0; padding: 0; }
    .remove { position: absolute; top: 6px; right: 6px; min-height: 32px; width: 32px; background: var(--surface); }
  `
})
export class PhotoPickerComponent implements OnDestroy {
  readonly label = input('Agregar fotos');
  readonly max = input(6);
  readonly changed = output<File[]>();
  readonly accept = ACCEPTED_IMAGES;

  readonly picked = signal<Picked[]>([]);
  readonly problems = signal<string[]>([]);
  readonly full = computed(() => this.picked().length >= this.max());

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const problems: string[] = [];
    const accepted: Picked[] = [];
    for (const file of files) {
      const problem = rejectFile(file);
      if (problem) problems.push(problem);
      else if (this.picked().length + accepted.length < this.max()) accepted.push({ file, preview: URL.createObjectURL(file) });
      else problems.push(`${file.name}: ya tienes el máximo de ${this.max()} fotos.`);
    }
    this.problems.set(problems);
    this.picked.update((current) => [...current, ...accepted]);
    this.changed.emit(this.picked().map((item) => item.file));
  }

  remove(index: number): void {
    const item = this.picked()[index];
    if (item) URL.revokeObjectURL(item.preview);
    this.picked.update((current) => current.filter((_, i) => i !== index));
    this.changed.emit(this.picked().map((entry) => entry.file));
  }

  clear(): void {
    this.picked().forEach((item) => URL.revokeObjectURL(item.preview));
    this.picked.set([]);
    this.problems.set([]);
  }

  ngOnDestroy(): void {
    this.picked().forEach((item) => URL.revokeObjectURL(item.preview));
  }
}
