import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild
} from '@angular/core';
import { IconComponent } from './icon.component';

// Diálogo modal nativo: el navegador maneja foco, Escape y fondo. Se abre con [open].
@Component({
  selector: 'app-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="dialog" [attr.aria-labelledby]="titleId" (close)="closed.emit()" (cancel)="closed.emit()">
      <div class="dialog-body">
        <div class="dialog-header">
          <h2 [id]="titleId" class="text-lg">{{ heading() }}</h2>
          <button type="button" class="btn btn-ghost btn-icon" (click)="closed.emit()" aria-label="Cerrar">
            <app-icon name="close" />
          </button>
        </div>
        <ng-content />
      </div>
    </dialog>
  `
})
export class DialogComponent {
  private static sequence = 0;
  readonly heading = input.required<string>();
  readonly open = input(false);
  readonly closed = output<void>();
  readonly titleId = `dialog-title-${++DialogComponent.sequence}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open() && !element.open) element.showModal?.();
      if (!this.open() && element.open) element.close();
    });
  }
}
