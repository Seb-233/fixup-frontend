import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="loading-line" role="status"><span class="spinner" aria-hidden="true"></span>{{ text() }}</p>`
})
export class LoadingComponent {
  readonly text = input('Cargando…');
}

@Component({
  selector: 'app-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert alert-danger" role="alert">
      <div class="stack-sm">
        <strong>{{ title() }}</strong>
        <span>{{ message() }}</span>
        @if (retryable()) {
          <div><button type="button" class="btn btn-secondary" (click)="retry.emit()">Reintentar</button></div>
        }
      </div>
    </div>
  `
})
export class ErrorStateComponent {
  readonly title = input('No pudimos cargar esta información');
  readonly message = input('Revisa tu conexión e inténtalo de nuevo.');
  readonly retryable = input(true);
  readonly retry = output<void>();
}

@Component({
  selector: 'app-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state">
      <h3>{{ title() }}</h3>
      @if (text()) {
        <p>{{ text() }}</p>
      }
      <ng-content />
    </div>
  `
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly text = input<string>();
}

export const STATES = [LoadingComponent, ErrorStateComponent, EmptyStateComponent] as const;
