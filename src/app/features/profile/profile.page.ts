import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../core/auth/auth.types';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { ThemeService } from '../../core/theme/theme.service';
import { PeopleApi } from '../../data/people.api';
import { CITIES, ROLE_NAME, errorMessage, initials } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-profile-page',
  imports: [FormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <header class="profile-head">
        <span class="avatar big" aria-hidden="true">{{ initials() }}</span>
        <div class="stack-sm">
          <h1>{{ user.user()?.displayName || 'Mi perfil' }}</h1>
          <p class="lede">{{ user.user()?.email }}</p>
          @if (auth.isDemo) { <span class="chip chip-info">Sesión de demostración</span> }
        </div>
      </header>

      <section class="panel stack-sm" aria-labelledby="roles-title">
        <h2 id="roles-title" class="text-lg">Roles de tu cuenta</h2>
        <p class="text-sm text-muted">Cambia de rol para ver la plataforma como propietario, arrendatario, técnico o inmobiliaria, según los que tengas.</p>
        <div class="cluster">
          @for (role of user.roles(); track role) {
            <button type="button" class="btn" [class.btn-primary]="role === user.activeRole()" [class.btn-secondary]="role !== user.activeRole()"
                    (click)="switchRole(role)" [attr.aria-pressed]="role === user.activeRole()">{{ roleNames[role] }}</button>
          }
        </div>
      </section>

      @if (user.activeRole() === 'FIXER') {
        <form class="panel stack" (ngSubmit)="savePresentation()" aria-labelledby="presentation-title">
          <div class="stack-sm">
            <h2 id="presentation-title" class="text-lg">Tu presentación pública</h2>
            <p class="text-sm text-muted">La ven los clientes en tu perfil y en el directorio. Tu ciudad define qué solicitudes recibes.</p>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="city">Ciudad</label>
              <input id="city" class="input" name="city" list="profile-cities" maxlength="100" [(ngModel)]="city" />
              <datalist id="profile-cities">@for (c of cities; track c) { <option [value]="c"></option> }</datalist>
            </div>
            <div class="field">
              <label for="years">Años de experiencia</label>
              <input id="years" type="number" class="input" name="years" min="0" max="70" [(ngModel)]="yearsExperience" />
            </div>
            <div class="field span-all">
              <label for="bio">Sobre ti</label>
              <textarea id="bio" class="textarea" rows="4" name="bio" maxlength="600" [(ngModel)]="bio"
                        placeholder="Oficio, tipo de trabajos que haces, zonas que cubres."></textarea>
              <span class="hint">{{ bio.length }} de 600 caracteres</span>
            </div>
          </div>
          @if (presentationMessage()) { <div class="alert" [class.alert-success]="!presentationError()" [class.alert-danger]="presentationError()" role="status">{{ presentationMessage() }}</div> }
          <div class="cluster">
            <button type="submit" class="btn btn-primary" [disabled]="saving()">Guardar presentación</button>
            <a [routerLink]="['/fixers', user.user()?.id]" class="link">Ver mi perfil público</a>
          </div>
        </form>
      }

      <section class="panel stack-sm" aria-labelledby="pref-title">
        <h2 id="pref-title" class="text-lg">Preferencias</h2>
        <label class="check">
          <input type="checkbox" [checked]="theme.theme() === 'dark'" (change)="theme.set($any($event.target).checked ? 'dark' : 'light')" />
          <span>Tema oscuro</span>
        </label>
      </section>

      <div>
        <button type="button" class="btn btn-secondary" (click)="logout()"><app-icon name="logout" />Cerrar sesión</button>
      </div>
    </div>
  `,
  styles: `
    .profile-head { display: flex; gap: var(--s-4); align-items: center; flex-wrap: wrap; }
    .avatar.big { width: 72px; height: 72px; font-size: var(--fs-xl); }
  `
})
export class ProfilePage implements OnInit {
  readonly auth = inject(AuthService);
  readonly user = inject(CurrentUserStore);
  readonly theme = inject(ThemeService);
  private readonly people = inject(PeopleApi);

  readonly roleNames = ROLE_NAME;
  readonly cities = CITIES;
  readonly initials = computed(() => initials(this.user.user()?.displayName));
  city = '';
  bio = '';
  yearsExperience: number | null = null;
  readonly saving = signal(false);
  readonly presentationMessage = signal<string | null>(null);
  readonly presentationError = signal(false);

  ngOnInit(): void {
    if (this.user.activeRole() === 'FIXER') {
      this.people.myProfile().subscribe({
        next: (profile) => {
          this.city = profile.city ?? '';
          this.bio = profile.bio ?? '';
          this.yearsExperience = profile.yearsExperience;
        },
        error: () => undefined
      });
    }
  }

  switchRole(role: Role): void {
    this.auth.selectRole(role);
  }

  savePresentation(): void {
    this.saving.set(true);
    this.presentationMessage.set(null);
    this.people
      .updateMyProfile({ city: this.city.trim() || undefined, bio: this.bio.trim() || undefined, yearsExperience: this.yearsExperience ?? undefined })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.presentationError.set(false);
          this.presentationMessage.set('Presentación guardada.');
        },
        error: (failure) => {
          this.saving.set(false);
          this.presentationError.set(true);
          this.presentationMessage.set(errorMessage(failure, 'No pudimos guardar tu presentación.'));
        }
      });
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
