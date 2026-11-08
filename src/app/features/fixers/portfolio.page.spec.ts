import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { MediaService } from '../../data/media.service';
import { OwnPortfolioResponse, PieceResponse } from '../../data/models';
import { PeopleApi } from '../../data/people.api';
import { PortfolioPage } from './portfolio.page';

describe('PortfolioPage (FR-UC-17)', () => {
  let fixture: ComponentFixture<PortfolioPage>;
  let page: PortfolioPage;
  let portfolio: Subject<OwnPortfolioResponse>;
  let upload: Subject<string>;
  let reportProgress: ((percent: number) => void) | undefined;
  let addPiece: ReturnType<typeof vi.fn>;

  const piece = (position: number, visibility: 'PUBLIC' | 'HIDDEN' = 'PUBLIC'): PieceResponse => ({
    id: `piece-${position}`,
    mediaId: `media-${position}`,
    title: `Trabajo ${position}`,
    position,
    visibility,
    readUrl: `http://storage.test/piece-${position}.jpg`,
    readUrlExpiresAt: '2026-10-26T13:00:00Z'
  });

  const draft = (...pieces: PieceResponse[]): OwnPortfolioResponse => ({ fixerUserId: 'fixer-1', status: 'DRAFT', pieces });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const publishButton = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Publicar portafolio')
    ) as HTMLButtonElement;

  function settle(): void {
    TestBed.tick();
    fixture.detectChanges();
  }

  async function load(value: OwnPortfolioResponse | HttpErrorResponse): Promise<void> {
    if (value instanceof HttpErrorResponse) portfolio.error(value);
    else {
      portfolio.next(value);
      portfolio.complete();
    }
    await fixture.whenStable();
    settle();
  }

  beforeEach(async () => {
    addPiece = vi.fn((): Observable<PieceResponse> => of(piece(9)));
    await TestBed.configureTestingModule({
      imports: [PortfolioPage],
      providers: [
        provideRouter([]),
        {
          provide: PeopleApi,
          useValue: {
            myPortfolio: () => {
              portfolio = new Subject<OwnPortfolioResponse>();
              return portfolio;
            },
            addPiece
          }
        },
        {
          provide: MediaService,
          useValue: {
            upload: (_file: File, _purpose: string, onProgress?: (percent: number) => void) => {
              reportProgress = onProgress;
              upload = new Subject<string>();
              return upload;
            }
          }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(PortfolioPage);
    page = fixture.componentInstance;
    settle();
  });

  it('muestra el estado de carga mientras llega el portafolio', () => {
    expect(text()).toContain('Cargando portafolio…');
  });

  it('muestra el error con opción de reintentar si el portafolio no carga', async () => {
    await load(new HttpErrorResponse({ status: 500 }));
    expect(text()).toContain('No pudimos cargar esta información');
    expect(text()).toContain('Reintentar');
  });

  it('con menos de tres piezas visibles no deja publicar', async () => {
    await load(draft(piece(1), piece(2), piece(3, 'HIDDEN')));
    expect(page.visibleCount()).toBe(2);
    expect(text()).toContain('2 de 3 piezas visibles necesarias para publicar');
    expect(publishButton().disabled).toBe(true);
  });

  it('con tres piezas visibles habilita la publicación', async () => {
    await load(draft(piece(1), piece(2), piece(3)));
    expect(page.visibleCount()).toBe(3);
    expect(publishButton().disabled).toBe(false);
  });

  it('muestra el progreso de la subida y luego guarda la pieza', async () => {
    await load(draft());
    page.file.set(new File([new Uint8Array([0xff, 0xd8, 0xff])], 'grifo.jpg', { type: 'image/jpeg' }));
    page.title = 'Cambio de grifería';
    page.addPiece();
    settle();
    expect(fixture.nativeElement.querySelector('progress')).not.toBeNull();

    reportProgress?.(40);
    settle();
    expect(page.progress()).toBe(40);
    expect(text()).toContain('Subiendo foto: 40 %');
    expect((fixture.nativeElement.querySelector('progress') as HTMLProgressElement).value).toBe(40);

    upload.next('media-new');
    upload.complete();
    settle();
    expect(addPiece).toHaveBeenCalledWith('media-new', 'Cambio de grifería', undefined);
    expect(page.progress()).toBeNull();
    expect(fixture.nativeElement.querySelector('progress')).toBeNull();
  });

  it('si la subida falla avisa y no intenta guardar la pieza', async () => {
    await load(draft());
    page.file.set(new File([new Uint8Array([0xff, 0xd8, 0xff])], 'grifo.jpg', { type: 'image/jpeg' }));
    page.title = 'Cambio de grifería';
    page.addPiece();
    reportProgress?.(70);
    upload.error(new HttpErrorResponse({ status: 500, url: 'http://storage.test/bucket' }));
    settle();
    expect(addPiece).not.toHaveBeenCalled();
    expect(page.progress()).toBeNull();
    expect(page.busy()).toBe(false);
    expect(text()).toContain('La foto no se pudo subir');
    expect(fixture.nativeElement.querySelector('.alert-danger')).not.toBeNull();
  });
});
