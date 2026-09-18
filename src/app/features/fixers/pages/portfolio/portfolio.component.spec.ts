import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PortfolioComponent } from './portfolio.component';
import { provideApi, PieceResponse } from '../../../../api/generated';
import { environment } from '../../../../../environments/environment';

describe('PortfolioComponent', () => {
  let component: PortfolioComponent;
  let httpTesting: HttpTestingController;

  const pieza: PieceResponse = {
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'PHOTO',
    storageKey: 'fixers/portafolio/cocina.jpg',
    title: 'Cocina',
    description: 'Trabajo terminado',
    position: 1,
    visibility: 'PUBLIC',
    createdAt: '2026-09-18T09:00:00Z'
  };

  const listaUrl = `${environment.apiOrigin}/media/me/portfolio`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortfolioComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideApi(environment.apiOrigin)]
    });
    component = TestBed.createComponent(PortfolioComponent).componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('debe cargar la galería propia al iniciar, con piezas ocultas incluidas', () => {
    component.ngOnInit();

    const req = httpTesting.expectOne(listaUrl);
    expect(req.request.method).toBe('GET');
    req.flush([pieza, { ...pieza, id: '2', position: 2, visibility: 'HIDDEN' }]);

    expect(component.piezas().length).toBe(2);
    expect(component.cargando()).toBe(false);
  });

  it('debe publicar enviando solo la clave de almacenamiento y sin archivo', () => {
    component.titulo = '  Cocina  ';
    component.clave = '  fixers/portafolio/cocina.jpg  ';
    component.descripcion = '  Trabajo terminado  ';
    component.publicar();

    const req = httpTesting.expectOne(listaUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      kind: 'PHOTO',
      storageKey: 'fixers/portafolio/cocina.jpg',
      title: 'Cocina',
      description: 'Trabajo terminado'
    });
    expect(JSON.stringify(req.request.body)).not.toContain('content');
    req.flush(pieza);

    expect(component.piezas()).toEqual([pieza]);
    expect(component.titulo).toBe('');
    expect(component.clave).toBe('');
  });

  it('debe omitir la descripción cuando queda vacía', () => {
    component.titulo = 'Cocina';
    component.clave = 'clave';
    component.descripcion = '   ';
    component.publicar();

    const req = httpTesting.expectOne(listaUrl);
    expect(req.request.body.description).toBeUndefined();
    req.flush(pieza);
  });

  it('no debe publicar sin título o sin clave', () => {
    component.titulo = 'Solo título';
    component.clave = '';
    component.publicar();

    httpTesting.expectNone(() => true);
    expect(component.publicando()).toBe(false);
  });

  it('debe ocultar una pieza visible y reflejar el nuevo estado en la galería', () => {
    component.ngOnInit();
    httpTesting.expectOne(listaUrl).flush([pieza]);

    component.alternarVisibilidad(pieza);

    const req = httpTesting.expectOne(`${listaUrl}/${pieza.id}/hide`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...pieza, visibility: 'HIDDEN' });

    expect(component.piezas()[0].visibility).toBe('HIDDEN');
  });

  it('debe mostrar de nuevo una pieza oculta', () => {
    const oculta: PieceResponse = { ...pieza, visibility: 'HIDDEN' };
    component.ngOnInit();
    httpTesting.expectOne(listaUrl).flush([oculta]);

    component.alternarVisibilidad(oculta);

    httpTesting.expectOne(`${listaUrl}/${pieza.id}/show`).flush(pieza);
    expect(component.piezas()[0].visibility).toBe('PUBLIC');
  });

  it('debe explicar el tope del portafolio cuando el backend responde PORTFOLIO_FULL', () => {
    component.titulo = 'Excedente';
    component.clave = 'clave';
    component.publicar();

    httpTesting
      .expectOne(listaUrl)
      .flush({ code: 'PORTFOLIO_FULL' }, { status: 409, statusText: 'Conflict' });

    expect(component.error()).toBe('Tu portafolio ya tiene el máximo de 20 piezas.');
  });

  it('debe explicar el 403 del técnico no verificado', () => {
    component.ngOnInit();

    httpTesting
      .expectOne(listaUrl)
      .flush({ code: 'ACCESS_DENIED' }, { status: 403, statusText: 'Forbidden' });

    expect(component.error()).toBe(
      'Necesitas ser un técnico verificado para gestionar tu portafolio.'
    );
  });
});
