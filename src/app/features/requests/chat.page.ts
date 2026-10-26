import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { RequestsApi } from '../../data/requests.api';
import { errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { WhenPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

// Conversación privada de una solicitud asignada (FR-UC-24). Se actualiza cada 15 segundos.
@Component({
  selector: 'app-chat-page',
  imports: [FormsModule, RouterLink, IconComponent, WhenPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow chat-page">
      <a [routerLink]="['/requests', requestId()]" class="back-link"><app-icon name="chevron-left" [size]="16" />Solicitud</a>
      <header class="page-header">
        <div>
          <h1>Conversación</h1>
          @if (request.hasValue()) { <p class="lede">{{ request.value().title }}</p> }
        </div>
      </header>

      @if (messages.isLoading() && !messages.hasValue()) {
        <app-loading text="Cargando mensajes…" />
      } @else if (messages.error()) {
        <app-error title="No pudimos abrir la conversación" message="El chat se habilita cuando la solicitud tiene técnico asignado." (retry)="messages.reload()" />
      } @else if (messages.hasValue()) {
        <section class="panel thread" #thread aria-live="polite" aria-label="Mensajes">
          @for (m of messages.value(); track m.id) {
            <div class="bubble" [class.mine]="m.senderUserId === me()">
              <p>{{ m.body }}</p>
              <span class="text-xs">{{ senderName(m.senderUserId) }} · {{ m.sentAt | when }}</span>
            </div>
          } @empty {
            <p class="text-muted">Aún no hay mensajes. Escribe para coordinar detalles del trabajo.</p>
          }
        </section>
        @if (isClosed()) {
          <div class="alert alert-info" role="status">
            Esta solicitud está {{ request.value()?.status === 'COMPLETED' ? 'finalizada' : 'cancelada' }}. La conversación se conserva en modo de solo lectura.
          </div>
        } @else {
          <form class="composer" (ngSubmit)="send()">
            <label for="message" class="visually-hidden">Mensaje</label>
            <textarea id="message" class="textarea" rows="2" name="message" maxlength="2000" [(ngModel)]="draft"
                      placeholder="Escribe un mensaje" (keydown.enter)="onEnter($event)"></textarea>
            <button type="submit" class="btn btn-primary" [disabled]="sending() || !draft.trim()">Enviar</button>
          </form>
        }
        @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
      }
    </div>
  `,
  styles: `
    .thread { display: flex; flex-direction: column; gap: var(--s-3); max-height: 60dvh; overflow-y: auto; }
    .bubble { max-width: 80%; padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--surface-2); display: grid; gap: 4px; }
    .bubble p { white-space: pre-line; }
    .bubble span { color: var(--text-muted); }
    .bubble.mine { align-self: flex-end; background: var(--primary); color: var(--on-primary); }
    .bubble.mine span { color: inherit; opacity: 0.85; }
    .composer { display: flex; gap: var(--s-2); align-items: flex-end; }
    .composer .textarea { flex: 1; }
  `
})
export class ChatPage implements OnInit {
  private readonly api = inject(RequestsApi);
  private readonly user = inject(CurrentUserStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly requestId = input.required<string>();
  readonly me = computed(() => this.user.user()?.id);
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  readonly request = rxResource({ params: () => this.requestId(), stream: ({ params }) => this.api.get(params) });
  readonly messages = rxResource({ params: () => this.requestId(), stream: ({ params }) => this.api.messages(params) });

  readonly isClosed = computed(() => {
    if (!this.request.hasValue()) return false;
    const status = this.request.value().status;
    return status === 'COMPLETED' || status === 'CANCELLED';
  });

  draft = '';
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.messages.hasValue()) {
        this.messages.value();
        queueMicrotask(() => {
          const el = this.thread()?.nativeElement;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    });
  }

  ngOnInit(): void {
    interval(15000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.messages.error()) this.messages.reload();
      });
  }

  senderName(userId: string): string {
    if (userId === this.me()) return 'Tú';
    if (!this.request.hasValue()) return 'Participante';
    const r = this.request.value();
    if (userId === r.assignedFixerUserId) return r.assignedFixerName || 'Técnico';
    if (userId === r.ownerUserId) return r.ownerName || 'Propietario';
    if (userId === r.requestedByUserId) return r.requestedByName || 'Arrendatario';
    if (userId === r.managerUserId) return 'Inmobiliaria';
    return 'Participante';
  }

  onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (!keyboard.shiftKey) {
      keyboard.preventDefault();
      this.send();
    }
  }

  send(): void {
    if (this.isClosed() || this.sending()) return;
    const body = this.draft.trim();
    if (!body) return;
    this.sending.set(true);
    this.error.set(null);
    this.api.sendMessage(this.requestId(), body).subscribe({
      next: (message) => {
        this.sending.set(false);
        this.draft = '';
        this.messages.update((list) => [...(list ?? []), message]);
      },
      error: (failure) => {
        this.sending.set(false);
        const errObj = failure?.error;
        const code = typeof errObj === 'object' ? errObj?.code : undefined;
        if (failure?.status === 409 || code === 'REQUEST_NOT_ASSIGNED') {
          this.request.reload();
          this.error.set('La solicitud fue cerrada o ya no tiene técnico asignado. La conversación pasó a modo de solo lectura.');
          return;
        }
        this.error.set(errorMessage(failure, 'No pudimos enviar el mensaje.'));
      }
    });
  }
}
