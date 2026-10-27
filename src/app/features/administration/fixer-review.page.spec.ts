import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { PendingVerification, ReviewResponse } from '../../data/models';
import { PeopleApi } from '../../data/people.api';
import { FixerReviewPage } from './fixer-review.page';

describe('FixerReviewPage (FR-UC-16)', () => {
  let fixture: ComponentFixture<FixerReviewPage>;
  let page: FixerReviewPage;
  let queue: Subject<PendingVerification[]>;
  let approve: ReturnType<typeof vi.fn>;

  const waiting: PendingVerification = {
    fixerUserId: 'fixer-1',
    displayName: 'Andrés Gómez',
    specialties: ['PLUMBING'],
    submittedAt: '2026-10-25T15:00:00Z'
  };

  const review: ReviewResponse = {
    fixerUserId: 'fixer-1',
    status: 'PENDING',
    underReview: true,
    submittedAt: '2026-10-25T15:00:00Z',
    specialties: new Set(['PLUMBING']),
    documents: [
      { type: 'ID_CARD', mediaId: 'm-1', readUrl: 'http://storage.test/m-1.jpg', readUrlExpiresAt: '2026-10-26T13:00:00Z' },
      { type: 'TRADE_CERTIFICATE', mediaId: 'm-2', readUrl: 'http://storage.test/m-2.jpg', readUrlExpiresAt: '2026-10-26T13:00:00Z' }
    ]
  } as unknown as ReviewResponse;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function settle(): void {
    TestBed.tick();
    fixture.detectChanges();
  }

  async function answer(value: PendingVerification[] | HttpErrorResponse): Promise<void> {
    if (value instanceof HttpErrorResponse) queue.error(value);
    else {
      queue.next(value);
      queue.complete();
    }
    await fixture.whenStable();
    settle();
  }

  beforeEach(async () => {
    approve = vi.fn((): Observable<void> => of(undefined));
    await TestBed.configureTestingModule({
      imports: [FixerReviewPage],
      providers: [
        {
          provide: PeopleApi,
          useValue: {
            pendingVerifications: () => {
              queue = new Subject<PendingVerification[]>();
              return queue;
            },
            review: () => of(review),
            approve,
            reject: () => of(undefined)
          }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(FixerReviewPage);
    page = fixture.componentInstance;
    settle();
  });

  it('muestra el estado de carga mientras llega la cola', () => {
    expect(text()).toContain('Cargando la cola…');
  });

  it('muestra el error si la cola no carga', async () => {
    await answer(new HttpErrorResponse({ status: 503 }));
    expect(text()).toContain('No pudimos cargar esta información');
    expect(text()).toContain('Reintentar');
  });

  it('con la cola vacía lo dice en lugar de mostrar una lista', async () => {
    await answer([]);
    expect(text()).toContain('No hay técnicos esperando revisión');
  });

  it('lista a los técnicos pendientes y abre sus documentos al elegir uno', async () => {
    await answer([waiting]);
    expect(text()).toContain('Andrés Gómez');
    expect(text()).toContain('Elige un técnico de la lista');

    page.select('fixer-1');
    await fixture.whenStable();
    settle();
    expect(text()).toContain('Documentos');
    expect(fixture.nativeElement.querySelectorAll('.docs li').length).toBe(2);
    expect(text()).toContain('Aprobar');
  });

  it('aprobar llama al backend y confirma la decisión', async () => {
    await answer([waiting]);
    page.select('fixer-1');
    await fixture.whenStable();
    settle();

    page.approve();
    settle();
    expect(approve).toHaveBeenCalledWith('fixer-1');
    expect(page.message()).toBe('Técnico aprobado. Ya puede cotizar.');
    expect(page.messageIsError()).toBe(false);
  });

  it('rechazar exige un motivo', async () => {
    await answer([waiting]);
    page.select('fixer-1');
    await fixture.whenStable();
    settle();
    const rejectButton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Rechazar'
    ) as HTMLButtonElement;
    expect(rejectButton.disabled).toBe(true);
  });
});
