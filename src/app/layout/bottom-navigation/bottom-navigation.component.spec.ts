import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { BottomNavigationComponent } from './bottom-navigation.component';

describe('BottomNavigationComponent', () => {
  let component: BottomNavigationComponent;
  let fixture: ComponentFixture<BottomNavigationComponent>;
  let userStore: CurrentUserStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavigationComponent],
      providers: [
        CurrentUserStore,
        provideRouter([])
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    fixture = TestBed.createComponent(BottomNavigationComponent);
    component = fixture.componentInstance;
  });

  it('debe incluir /requests/inbox para FIXER', () => {
    userStore.setRoles(['FIXER']);
    userStore.setActiveRole('FIXER');
    fixture.detectChanges();
    const items = component.visibleItems();
    const reqItem = items.find(i => i.label === 'Solicitudes');
    expect(reqItem?.path).toBe('/requests/inbox');
  });

  it('no debe incluir enlace de Solicitudes para PLATFORM_ADMIN', () => {
    userStore.setRoles(['PLATFORM_ADMIN']);
    userStore.setActiveRole('PLATFORM_ADMIN');
    fixture.detectChanges();
    const items = component.visibleItems();
    const reqItem = items.find(i => i.label === 'Solicitudes');
    expect(reqItem).toBeUndefined();
  });

  it('debe incluir /requests para OWNER', () => {
    userStore.setRoles(['OWNER']);
    userStore.setActiveRole('OWNER');
    fixture.detectChanges();
    const items = component.visibleItems();
    const reqItem = items.find(i => i.label === 'Solicitudes');
    expect(reqItem?.path).toBe('/requests');
  });
});
