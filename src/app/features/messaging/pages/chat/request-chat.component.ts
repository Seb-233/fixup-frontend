import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import {
  ChatControllerService,
  MessageResponse,
  RepairRequestControllerService,
  RequestDetailResponse
} from '../../../../api/generated';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';

/** Frecuencia de refresco del hilo. El backend no ofrece websockets ni un parámetro
 *  "desde este id/instante" en GET /requests/{requestId}/messages -- cada intento trae el hilo
 *  completo -- así que este es un polling simple, no una suscripción incremental. 5s es un
 *  balance razonable entre sensación de "tiempo real" y no bombardear al backend; no hay
 *  backoff ni pausa por visibilidad de pestaña porque este caso de uso no lo necesita. */
const POLL_INTERVAL_MS = 5000;

/** Límite de caracteres del cuerpo del mensaje, replicando @Size(max = 2000) de
 *  SendMessageRequest en el backend. Es solo una guía visual temprana: el backend es quien
 *  realmente lo hace cumplir (400 si se excede). */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * FR-UC-24 — Chat privado por solicitud asignada.
 *
 * Pantalla de conversación entre el propietario/arrendatario y el Fixer de una
 * `RepairRequest` ya asignada (`status === 'ASSIGNED'`). Es una pantalla separada, enlazada
 * desde {@link RequestDetailComponent} ("Ver conversación →"), y no un panel embebido en el
 * detalle, por dos razones concretas:
 *  1. El polling de este componente (ver más abajo) solo debe correr mientras la persona está
 *     realmente mirando los mensajes. Si viviera dentro del detalle de la solicitud, el poll
 *     correría cada vez que alguien abre esa pantalla aunque nunca desplace la vista hasta el
 *     chat, desperdiciando peticiones contra el backend.
 *  2. Un hilo de mensajes con scroll propio y un compositor fijo abajo es una forma de UI muy
 *     distinta a las tarjetas del detalle de la solicitud; forzarlo en el mismo layout exigiría
 *     un contenedor de scroll anidado incómodo.
 * El mismo criterio ya lo sigue el tablero de cotizaciones (`/quotations/request/:requestId`,
 * en la feature `quotations`, no `requests`): la URL cuelga del recurso al que pertenece
 * (`/requests/:requestId/messages`, reflejando la jerarquía REST real del backend), pero el
 * componente vive en su propio dominio de negocio (`features/messaging/`, tal como lo designa
 * `docs/architecture/frontend-architecture.md`).
 *
 * Actualización casi en tiempo real sin WebSockets: como el backend no expone un mecanismo de
 * push ni un parámetro incremental, este componente hace polling con
 * `timer(0, POLL_INTERVAL_MS)` -> `switchMap` a `list()` -> `takeUntilDestroyed()`. `switchMap`
 * (en vez de `mergeMap`/`concatMap`) importa aquí: si una respuesta tarda más que el intervalo,
 * cancela la petición en vuelo y arranca la siguiente en vez de acumular peticiones colgadas.
 * Cada respuesta se **mezcla por `id`** con lo que ya había en pantalla (`mergeMessages`), nunca
 * se reemplaza a ciegas el arreglo: `list()` siempre devuelve el hilo completo, así que un
 * reemplazo directo re-renderizaría toda la lista en cada tick y perdería la posición de scroll
 * del usuario si estaba leyendo mensajes anteriores.
 *
 * Envío sin `<form>`/`FormsModule` a propósito: la pantalla de verificación de este mismo
 * proyecto tuvo un bug real donde un `<button type="submit">` dentro de un `<form>` sin
 * `FormsModule` cargado disparaba un submit nativo del navegador (recarga completa de página)
 * porque `(ngSubmit)` nunca llegaba a enlazarse. Para no arrastrar ese riesgo aquí, el
 * compositor no usa `<form>` en absoluto: es un `<div>` con un `<textarea>` y un
 * `<button type="button" (click)="send()">` corriente, así que no existe ningún evento
 * `submit` nativo que interceptar ni ningún módulo de formularios que importar.
 */
@Component({
  selector: 'app-request-chat',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="chat">
      <header class="chat-header">
        <a class="back" [routerLink]="['/requests', requestId]">← Volver a la solicitud</a>
        <h1 class="title">Conversación</h1>
        @if (request(); as item) {
          <p class="subtitle">{{ item.title }}</p>
        }
      </header>

      @if (loading()) {
        <p class="state">Cargando conversación…</p>
      } @else if (loadError()) {
        <p class="state error">{{ loadError() }}</p>
      } @else {
        @if (pollError()) {
          <p class="state warn">{{ pollError() }}</p>
        }

        <div class="thread" #thread>
          @if (messages().length === 0) {
            <p class="empty">Todavía no hay mensajes. Escribe el primero.</p>
          }
          @for (msg of messages(); track msg.id) {
            <div class="bubble-row" [class.mine]="isMine(msg)">
              <div class="bubble">
                <p class="bubble-body">{{ msg.body }}</p>
                <div class="bubble-meta">
                  <span class="bubble-time">{{ msg.sentAt | date: 'short' }}</span>
                  <!-- FR-UC-24: degradación observable del canal de notificaciones. Un mensaje
                       igual queda entregado en el chat (la fuente de verdad es este hilo, no la
                       notificación push/email); esto solo le avisa al remitente que el aviso
                       fuera de banda pudo no haber llegado, sin bloquear ni reintentar el envío. -->
                  @if (isMine(msg) && msg.notificationStatus === 'FAILED') {
                    <span
                      class="notif-failed"
                      title="El mensaje quedó registrado, pero no se pudo notificar al otro participante"
                    >
                      ⚠ no se pudo notificar
                    </span>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        @if (canSend()) {
          <div class="composer">
            <textarea
              class="composer-input"
              [value]="draft()"
              (input)="onDraftInput($event)"
              rows="2"
              [attr.maxlength]="maxMessageLength"
              placeholder="Escribe un mensaje…"
              [disabled]="sending()"
            ></textarea>
            <button
              type="button"
              class="send-btn"
              [disabled]="!draft().trim() || sending()"
              (click)="send()"
            >
              {{ sending() ? 'Enviando…' : 'Enviar' }}
            </button>
          </div>
          @if (sendError(); as mensaje) {
            <p class="state error">{{ mensaje }}</p>
          }
        } @else {
          <p class="admin-note">Los administradores solo pueden leer esta conversación.</p>
        }
      }
    </section>
  `,
  styles: [`
    .chat { display: flex; flex-direction: column; gap: 0.9rem; max-width: 720px; margin: 0 auto; height: calc(100vh - var(--fixup-header-height, 60px) - 3rem); }
    .chat-header { flex-shrink: 0; }
    .back { color: #888; font-size: 0.82rem; text-decoration: none; }
    .back:hover { color: var(--fixup-color-primary); }
    .title {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.4rem; margin: 0.4rem 0 0.15rem 0;
    }
    .subtitle { color: #666; font-size: 0.88rem; margin: 0; }
    .state { color: #666; font-size: 0.9rem; margin: 0; padding: 0.5rem 0; flex-shrink: 0; }
    .state.error { color: #b91c1c; }
    .state.warn { color: #8a6100; }
    .thread {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem;
      background: #faf9f6; border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg); padding: 1rem;
    }
    .empty { color: #999; font-size: 0.86rem; text-align: center; margin: auto; }
    .bubble-row { display: flex; }
    .bubble-row.mine { justify-content: flex-end; }
    .bubble {
      max-width: 75%; background: #fff; border: 1px solid rgba(154, 148, 141, 0.25);
      border-radius: var(--fixup-radius-md); padding: 0.55rem 0.8rem;
      box-shadow: var(--fixup-shadow-sm);
    }
    .bubble-row.mine .bubble { background: var(--fixup-color-primary); color: #fff; border-color: var(--fixup-color-primary); }
    .bubble-body { margin: 0; font-size: 0.88rem; line-height: 1.45; white-space: pre-line; word-break: break-word; }
    .bubble-meta { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.3rem; }
    .bubble-time { font-size: 0.68rem; opacity: 0.65; }
    .notif-failed { font-size: 0.66rem; opacity: 0.85; cursor: help; }
    .composer { flex-shrink: 0; display: flex; gap: 0.6rem; align-items: flex-end; }
    .composer-input {
      flex: 1; border: 1px solid rgba(154, 148, 141, 0.4); border-radius: var(--fixup-radius-md);
      padding: 0.55rem 0.7rem; font: inherit; color: var(--fixup-color-primary); resize: vertical;
    }
    .send-btn {
      background: var(--fixup-color-primary); color: #fff; border: none;
      border-radius: var(--fixup-radius-md); padding: 0.6rem 1.2rem;
      font: inherit; font-weight: 700; cursor: pointer; white-space: nowrap;
    }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn:not(:disabled):hover { background: #1f2023; }
    .admin-note { color: #999; font-size: 0.82rem; text-align: center; flex-shrink: 0; }
  `]
})
export class RequestChatComponent implements OnInit {
  private readonly chatApi = inject(ChatControllerService);
  private readonly requestsApi = inject(RepairRequestControllerService);
  private readonly route = inject(ActivatedRoute);
  private readonly userStore = inject(CurrentUserStore);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('thread') private threadRef?: ElementRef<HTMLElement>;

  readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';
  readonly maxMessageLength = MAX_MESSAGE_LENGTH;

  readonly request = signal<RequestDetailResponse | null>(null);
  readonly messages = signal<MessageResponse[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly pollError = signal<string | null>(null);

  readonly draft = signal('');
  readonly sending = signal(false);
  readonly sendError = signal<string | null>(null);

  // El backend permite a un PLATFORM_ADMIN leer cualquier chat (GET), pero enviar (POST) exige
  // ser el propietario de la solicitud o su Fixer asignado -- un admin nunca es "participante".
  // Ocultar el compositor evita que el admin escriba un mensaje que el backend rechazará seguro.
  readonly canSend = computed(() => this.userStore.activeRole() !== 'PLATFORM_ADMIN');

  ngOnInit(): void {
    if (!this.requestId) {
      this.loadError.set('La solicitud no existe.');
      this.loading.set(false);
      return;
    }

    // Contexto del encabezado (título de la solicitud). Igual que en QuotationBoardComponent,
    // un fallo aquí no debe bloquear el chat: el título es decorativo, el hilo no depende de él.
    this.requestsApi.detail(this.requestId).subscribe({
      next: (req) => this.request.set(req),
      error: () => this.request.set(null)
    });

    this.startPolling();
  }

  private startPolling(): void {
    timer(0, POLL_INTERVAL_MS)
      .pipe(
        // switchMap, no mergeMap/concatMap: si una respuesta tarda más que el intervalo, se
        // cancela y se arranca la siguiente en vez de acumular peticiones en vuelo.
        switchMap(() => this.chatApi.list(this.requestId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (incoming) => {
          this.mergeMessages(incoming);
          this.loading.set(false);
          this.pollError.set(null);
        },
        error: (failure: HttpErrorResponse) => {
          this.loading.set(false);
          if (this.messages().length === 0) {
            // Nunca se logró cargar el hilo ni una vez: bloquear la pantalla con un error real.
            this.loadError.set(this.describeListError(failure));
          } else {
            // Ya hay un hilo en pantalla: un fallo transitorio de un tick de polling no debe
            // borrarlo ni impedir que la persona siga leyendo o componiendo un mensaje.
            this.pollError.set('No se pudo actualizar la conversación. Reintentando…');
          }
        }
      });
  }

  /**
   * Mezcla la respuesta del backend con lo que ya hay en pantalla, indexando por `id`, en vez
   * de reemplazar el arreglo completo. `list()` siempre devuelve el hilo entero (no hay
   * paginación ni "desde este id"), así que un reemplazo directo re-renderizaría toda la lista
   * en cada tick del polling y perdería la posición de scroll de quien esté leyendo mensajes
   * anteriores. Solo se hace auto-scroll al final cuando de verdad llegó un id nuevo.
   */
  private mergeMessages(incoming: MessageResponse[]): void {
    const previousIds = new Set(this.messages().map((m) => m.id));
    const arrivedNew = incoming.some((m) => !previousIds.has(m.id));

    const byId = new Map(this.messages().map((m) => [m.id, m]));
    incoming.forEach((m) => byId.set(m.id, m));
    const merged = Array.from(byId.values()).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    this.messages.set(merged);

    if (arrivedNew) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    // queueMicrotask en vez de un scroll inmediato: espera a que Angular termine de aplicar el
    // @for sobre la señal `messages` recién actualizada, para medir un scrollHeight ya correcto.
    queueMicrotask(() => {
      const el = this.threadRef?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  isMine(message: MessageResponse): boolean {
    return message.senderUserId === this.userStore.user()?.id;
  }

  onDraftInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  send(): void {
    const body = this.draft().trim();
    if (!body || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.sendError.set(null);

    this.chatApi.send(this.requestId, { body }).subscribe({
      next: (message) => {
        // El propio mensaje enviado entra por el mismo camino de mezcla que el polling, así
        // aparece de inmediato sin esperar al próximo tick de 5s.
        this.mergeMessages([message]);
        this.draft.set('');
        this.sending.set(false);
      },
      error: (failure: HttpErrorResponse) => {
        this.sending.set(false);
        this.sendError.set(this.describeSendError(failure));
      }
    });
  }

  private describeListError(failure: HttpErrorResponse): string {
    if (failure.status === 401) {
      return 'Sesión expirada. Inicia sesión nuevamente.';
    }
    if (failure.status === 403) {
      return 'No tienes acceso a esta conversación.';
    }
    if (failure.status === 404) {
      return 'La solicitud no existe o no es visible para ti.';
    }
    if (failure.status === 409) {
      return 'Esta solicitud todavía no tiene un técnico asignado; el chat se activa cuando se asigne uno.';
    }
    return 'No pudimos cargar la conversación.';
  }

  // 409 explícito pedido para send(): la solicitud puede haberse desasignado entre que se
  // mostró el link "Ver conversación" y el momento de escribir, así que el backend lo revalida.
  private describeSendError(failure: HttpErrorResponse): string {
    if (failure.status === 400) {
      return 'El mensaje está vacío o excede el largo permitido.';
    }
    if (failure.status === 401) {
      return 'Sesión expirada. Inicia sesión nuevamente.';
    }
    if (failure.status === 403) {
      return 'No tienes acceso a esta conversación.';
    }
    if (failure.status === 404) {
      return 'La solicitud no existe o no es visible para ti.';
    }
    if (failure.status === 409) {
      return 'Esta solicitud todavía no tiene un técnico asignado; no puedes enviar mensajes hasta que se asigne uno.';
    }
    return 'No pudimos enviar el mensaje. Intenta de nuevo.';
  }
}
