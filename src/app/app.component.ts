import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConnectionBannerComponent } from './core/connectivity/connection-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConnectionBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-connection-banner /><router-outlet />'
})
export class App {
  readonly title = signal('Fix&Rent');
}
