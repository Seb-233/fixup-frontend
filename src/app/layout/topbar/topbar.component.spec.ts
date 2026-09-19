import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { TopbarComponent } from './topbar.component';
import { AuthService } from '../../core/auth/auth.service';
import { of } from 'rxjs';

describe('TopbarComponent', () => {
  let component: TopbarComponent;
  let fixture: ComponentFixture<TopbarComponent>;
  let userStore: CurrentUserStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        CurrentUserStore,
        provideRouter([]),
        { provide: AuthService, useValue: { logout: () => of(void 0) } }
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    fixture = TestBed.createComponent(TopbarComponent);
    component = fixture.componentInstance;
  });

  it('debe mostrar Nueva Solicitud para OWNER', () => {
    userStore.setRoles(['OWNER']);
    userStore.setActiveRole('OWNER');
    fixture.detectChanges();
    expect(component.canCreateRequest()).toBe(true);
  });

  it('no debe mostrar Nueva Solicitud para FIXER', () => {
    userStore.setRoles(['FIXER']);
    userStore.setActiveRole('FIXER');
    fixture.detectChanges();
    expect(component.canCreateRequest()).toBe(false);
  });

  it('no debe mostrar Nueva Solicitud para PLATFORM_ADMIN', () => {
    userStore.setRoles(['PLATFORM_ADMIN']);
    userStore.setActiveRole('PLATFORM_ADMIN');
    fixture.detectChanges();
    expect(component.canCreateRequest()).toBe(false);
  });
});
