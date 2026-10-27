import { HttpBackend, HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO_ACCOUNTS, DemoAccount } from '../../core/demo/demo-session';
import { ROLE_NAME } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-login-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-layout.scss',
  template: `
    <header class="site-header">
      <a routerLink="/" class="brand-mark">Fix<span>&amp;</span>Rent</a>
      <a routerLink="/" class="btn btn-secondary">Volver a la portada</a>
    </header>

    <main>
      <div class="access">
        <section class="form-inner" aria-labelledby="login-title">
          <header class="stack-sm">
            <h1 id="login-title">Ingresa a tu cuenta</h1>
            <p class="lede">Propietarios, arrendatarios, técnicos e inmobiliarias usan la misma cuenta.</p>
          </header>

          @if (error()) {
            <div class="alert alert-danger" role="alert">{{ error() }}</div>
          }

          <div class="stack-sm">
            <button type="button" class="btn btn-primary btn-block" (click)="login()" [disabled]="busy() !== null">
              <app-icon name="key" />
              Ingresar o crear cuenta
            </button>
            <p class="text-muted text-sm">
              El ingreso se hace en la página de Auth0, el servicio de cuentas de Fix&amp;Rent. Al terminar vuelves aquí
              con la sesión abierta.
            </p>
          </div>

          @if (demoAvailable()) {
            <section class="panel stack" aria-labelledby="demo-title">
              <div class="stack-sm">
                <h2 id="demo-title" class="text-lg">Cuentas de demostración</h2>
                <p class="text-muted text-sm">
                  Este servidor corre con el perfil demo y datos de prueba de Colombia. Entra con el rol que quieras
                  revisar.
                </p>
              </div>
              <ul class="list">
                @for (account of accounts; track account.subject) {
                  <li>
                    <button type="button" class="demo-row" (click)="enter(account)" [disabled]="busy() !== null">
                      <span class="stack-sm">
                        <span class="row-title">{{ roleNames[account.role] }} · {{ account.name }}</span>
                        <span class="row-meta">{{ account.summary }}</span>
                      </span>
                      @if (busy() === account.subject) {
                        <span class="spinner" aria-label="Ingresando"></span>
                      } @else {
                        <app-icon name="chevron-right" />
                      }
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
        </section>

        <figure class="access-photo">
          <img
            src="landing/reparacion-plomeria.jpg"
            alt="Técnica revisando la tubería bajo un lavaplatos"
            width="1024"
            height="683"
          />
          <figcaption>Foto: TWP Inc., CC BY 2.0.</figcaption>
        </figure>
      </div>
    </main>

    <footer class="site-footer">
      <span class="brand-mark small">Fix<span>&amp;</span>Rent</span>
      <span class="text-sm">Proyecto académico de arquitectura de software. Los pagos funcionan en modo de prueba.</span>
    </footer>
  `,
  styles: `
    .demo-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--s-4);
      width: 100%;
      min-height: var(--tap);
      padding: var(--s-3) var(--s-2);
      border: 0;
      background: none;
      text-align: left;
      cursor: pointer;
      border-radius: var(--r-sm);
    }
    .demo-row:hover:not(:disabled) { background: var(--surface-2); }
    .demo-row:disabled { cursor: progress; opacity: 0.7; }
  `
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly bare = new HttpClient(inject(HttpBackend));

  readonly accounts = DEMO_ACCOUNTS;
  readonly roleNames = ROLE_NAME;
  readonly demoAvailable = signal(false);
  readonly busy = signal<string | null>(null);
  readonly error = signal<string | null>(this.route.snapshot.queryParamMap.get('error'));

  ngOnInit(): void {
    if (!environment.demoLogin) return;
    // El acceso demo solo aparece si el backend local responde con el perfil demo activo.
    this.bare
      .get(`${environment.apiOrigin}/demo/token`, { params: { role: 'OWNER', ttlSeconds: '60' } })
      .subscribe({ next: () => this.demoAvailable.set(true), error: () => this.demoAvailable.set(false) });
  }

  login(): void {
    const target = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
    this.auth.loginWithRedirect(target).subscribe();
  }

  enter(account: DemoAccount): void {
    this.busy.set(account.subject);
    this.error.set(null);
    this.auth.loginAsDemo(account).subscribe({
      next: (profile) => {
        this.busy.set(null);
        if (!profile) {
          this.error.set('El servidor no pudo abrir la sesión de demostración. Revisa que el backend esté en marcha.');
          return;
        }
        const target = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard');
      },
      error: () => {
        this.busy.set(null);
        this.error.set('No hay conexión con el servidor de Fix&Rent.');
      }
    });
  }
}
