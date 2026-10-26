import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { FeedPieceResponse, FixerProfile } from '../../data/models';
import { IdeasFeedComponent } from './ideas-feed.component';

const FEED = `${environment.apiOrigin}/media/portfolio/feed`;
const DIRECTORY = `${environment.apiOrigin}/fixers/directory`;

const fixer = (id: string, specialties: FixerProfile['specialties'], displayName: string): FixerProfile => ({
  fixerUserId: id,
  displayName,
  verificationStatus: 'VERIFIED',
  specialties,
  city: 'Bogotá',
  bio: null,
  yearsExperience: 8,
  ratingAverage: 4.6,
  ratingCount: 12
});

const piece = (id: string, fixerUserId: string, title = `Obra ${id}`): FeedPieceResponse => ({
  id,
  fixerUserId,
  title,
  description: 'Trabajo terminado',
  readUrl: `https://fotos.test/${id}.jpg`,
  readUrlExpiresAt: new Date(Date.now() + 300000).toISOString()
});

describe('IdeasFeedComponent', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IdeasFeedComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function render() {
    const fixture = TestBed.createComponent(IdeasFeedComponent);
    fixture.detectChanges();
    TestBed.tick();
    backend.expectOne(DIRECTORY).flush([
      fixer('ana', ['PLUMBING'], 'Ana Rojas'),
      fixer('beto', ['PAINTING', 'GENERAL'], 'Beto Gil')
    ]);
    await fixture.whenStable();
    return fixture;
  }

  it('carga la primera página sin filtro y nombra al técnico de cada obra', async () => {
    const fixture = await render();
    const first = backend.expectOne((r) => r.url === FEED);
    expect(first.request.params.get('page')).toBe('0');
    expect(first.request.params.get('size')).toBe('24');
    expect(first.request.params.has('fixerUserIds')).toBe(false);
    first.flush({ items: [piece('1', 'ana', 'Grifería nueva'), piece('2', 'beto')], page: 0, hasMore: true });
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Grifería nueva');
    expect(cards[0].textContent).toContain('Ana Rojas · Bogotá');
  });

  it('sigue con la página siguiente al pedir más', async () => {
    const fixture = await render();
    backend.expectOne((r) => r.url === FEED).flush({ items: [piece('1', 'ana')], page: 0, hasMore: true });
    fixture.componentInstance.loadMore();
    const next = backend.expectOne((r) => r.url === FEED);
    expect(next.request.params.get('page')).toBe('1');
    next.flush({ items: [piece('2', 'beto')], page: 1, hasMore: false });
    fixture.detectChanges();

    expect(fixture.componentInstance.items().map((item) => item.id)).toEqual(['1', '2']);
    fixture.componentInstance.loadMore();
    backend.expectNone((r) => r.url === FEED);
    expect(fixture.nativeElement.textContent).toContain('Viste todas las ideas');
  });

  it('una especialidad limita el feed a los técnicos del directorio que la tienen', async () => {
    const fixture = await render();
    backend.expectOne((r) => r.url === FEED).flush({ items: [piece('1', 'ana')], page: 0, hasMore: true });

    fixture.componentInstance.choose('PAINTING');
    TestBed.tick();
    const filtered = backend.expectOne((r) => r.url === FEED);
    expect(filtered.request.params.get('fixerUserIds')).toBe('beto');
    expect(filtered.request.params.get('page')).toBe('0');
    filtered.flush({ items: [piece('9', 'beto')], page: 0, hasMore: false });
    expect(fixture.componentInstance.items().map((item) => item.id)).toEqual(['9']);
  });

  it('sin técnicos de esa especialidad no consulta y lo dice', async () => {
    const fixture = await render();
    backend.expectOne((r) => r.url === FEED).flush({ items: [], page: 0, hasMore: false });

    fixture.componentInstance.choose('ELECTRICAL');
    TestBed.tick();
    backend.expectNone((r) => r.url === FEED);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aún no hay obras de electricidad publicadas.');
  });

  it('al abrir una obra ofrece pedir algo parecido con el título prellenado', async () => {
    const fixture = await render();
    backend.expectOne((r) => r.url === FEED).flush({ items: [piece('1', 'ana', 'Clóset a medida')], page: 0, hasMore: false });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.card') as HTMLButtonElement).click();
    fixture.detectChanges();
    const ask = [...fixture.nativeElement.querySelectorAll('a')].find((a: HTMLAnchorElement) =>
      a.textContent?.includes('Pedir algo parecido')
    ) as HTMLAnchorElement;
    expect(ask.getAttribute('href')).toBe('/requests/new?title=Cl%C3%B3set%20a%20medida');
    expect(fixture.nativeElement.textContent).toContain('Ana Rojas');
  });
});
