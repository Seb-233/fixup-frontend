import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription, catchError, of } from 'rxjs';
import { FeedPieceResponse, FixerProfile } from '../../data/models';
import { PeopleApi } from '../../data/people.api';
import { SPECIALTIES, SPECIALTY, initials } from '../../shared/format';
import { DialogComponent } from '../../shared/ui/dialog.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoComponent } from '../../shared/ui/photo.component';
import { LabelPipe } from '../../shared/ui/pipes';
import { StarsComponent } from '../../shared/ui/stars.component';

const PAGE_SIZE = 24;

// Ideas de remodelación para clientes: las obras que los técnicos publican en su portafolio, en
// una rejilla de fotos que se sigue cargando al bajar. Cada foto lleva al técnico que la hizo y a
// pedir algo parecido, que es la decisión que esta sección quiere facilitar.
@Component({
  selector: 'app-ideas-feed',
  imports: [RouterLink, IconComponent, PhotoComponent, StarsComponent, DialogComponent, LabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ideas-feed.component.html',
  styleUrl: './ideas-feed.component.scss'
})
export class IdeasFeedComponent {
  private readonly people = inject(PeopleApi);
  private readonly destroyRef = inject(DestroyRef);

  /** Destino de "Pedir algo parecido": el formulario de solicitud del rol que mira. */
  readonly requestLink = input('/requests/new');

  readonly specialties = SPECIALTIES;
  readonly specialtyNames = SPECIALTY;
  readonly initials = initials;

  readonly specialty = signal('');
  readonly items = signal<FeedPieceResponse[]>([]);
  readonly hasMore = signal(true);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly selected = signal<FeedPieceResponse | null>(null);
  private page = 0;
  private pending?: Subscription;
  private observer?: IntersectionObserver;

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  // El directorio da nombre, ciudad, especialidades y calificación a cada técnico del feed. Si no
  // carga, el feed se muestra igual con "Técnico verificado".
  readonly directory = rxResource({
    stream: () => this.people.directory().pipe(catchError(() => of<FixerProfile[]>([])))
  });

  readonly fixers = computed(() => {
    const map = new Map<string, FixerProfile>();
    for (const fixer of this.directory.value() ?? []) map.set(fixer.fixerUserId, fixer);
    return map;
  });

  readonly emptyText = computed(() => {
    const specialty = this.specialty();
    return specialty
      ? `Aún no hay obras de ${(SPECIALTY[specialty] ?? specialty).toLowerCase()} publicadas.`
      : 'Aún no hay obras publicadas.';
  });

  readonly selectedFixer = computed(() => {
    const piece = this.selected();
    return piece ? this.fixers().get(piece.fixerUserId) ?? null : null;
  });

  constructor() {
    // Cambiar de especialidad vuelve a la primera página. Con filtro hace falta el directorio para
    // saber qué técnicos la tienen; sin filtro se arranca de una vez.
    effect(() => {
      const specialty = this.specialty();
      const ready = !specialty || this.directory.hasValue();
      if (ready) untracked(() => this.reset());
    });

    afterNextRender(() => {
      if (typeof IntersectionObserver !== 'function') return;
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.loadMore();
        },
        { rootMargin: '600px 0px' }
      );
      this.rearm();
      this.destroyRef.onDestroy(() => this.observer?.disconnect());
    });
    this.destroyRef.onDestroy(() => this.pending?.unsubscribe());
  }

  choose(specialty: string): void {
    this.specialty.set(this.specialty() === specialty ? '' : specialty);
  }

  reset(): void {
    this.pending?.unsubscribe();
    this.page = 0;
    this.items.set([]);
    this.hasMore.set(true);
    this.failed.set(false);
    this.loading.set(false);
    this.loadMore();
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    const filter = this.filterIds();
    if (filter && !filter.length) {
      this.hasMore.set(false);
      return;
    }
    this.loading.set(true);
    this.failed.set(false);
    this.pending = this.people.feed(this.page, PAGE_SIZE, filter ?? undefined).subscribe({
      next: (result) => {
        this.items.update((current) => [...current, ...result.items]);
        this.hasMore.set(result.hasMore);
        this.page = result.page + 1;
        this.loading.set(false);
        if (result.hasMore) setTimeout(() => this.rearm());
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  /**
   * El observador solo avisa cuando el marcador entra o sale de la vista. Si una página no alcanza
   * a empujarlo fuera (pantallas altas), volver a observarlo dispara otro aviso y carga la siguiente.
   */
  private rearm(): void {
    const element = this.sentinel()?.nativeElement;
    if (!this.observer || !element) return;
    this.observer.unobserve(element);
    this.observer.observe(element);
  }

  fixerOf(piece: FeedPieceResponse): FixerProfile | null {
    return this.fixers().get(piece.fixerUserId) ?? null;
  }

  /** Técnicos del directorio con la especialidad elegida; null cuando no hay filtro. */
  private filterIds(): string[] | null {
    const specialty = this.specialty();
    if (!specialty) return null;
    return (this.directory.value() ?? [])
      .filter((fixer) => fixer.specialties.includes(specialty as FixerProfile['specialties'][number]))
      .map((fixer) => fixer.fixerUserId);
  }
}
