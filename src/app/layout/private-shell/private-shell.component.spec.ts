import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { FixerVerificationStore } from '../../features/fixers/pages/verification/fixer-verification.store';
import { PrivateShellComponent } from './private-shell.component';

describe('PrivateShellComponent', () => {
  let fixture: ComponentFixture<PrivateShellComponent>;
  let users: CurrentUserStore;
  let verification: FixerVerificationStore;
  beforeEach(async () => { TestBed.overrideComponent(PrivateShellComponent, { set: { template: '' } }); await TestBed.configureTestingModule({ imports: [PrivateShellComponent], providers: [CurrentUserStore] }).compileComponents(); users=TestBed.inject(CurrentUserStore); verification=TestBed.inject(FixerVerificationStore); vi.spyOn(verification,'ensureLoaded'); fixture=TestBed.createComponent(PrivateShellComponent); });
  it('asegura verificación solo para FIXER', () => { users.setRoles(['FIXER']); users.setActiveRole('FIXER'); fixture.detectChanges(); expect(verification.ensureLoaded).toHaveBeenCalledTimes(1); });
  it.each(['OWNER','TENANT','REAL_ESTATE_MANAGER','PLATFORM_ADMIN'] as const)('no carga verificación para %s', (role) => { users.setRoles([role]); users.setActiveRole(role); fixture.detectChanges(); expect(verification.ensureLoaded).not.toHaveBeenCalled(); });
});