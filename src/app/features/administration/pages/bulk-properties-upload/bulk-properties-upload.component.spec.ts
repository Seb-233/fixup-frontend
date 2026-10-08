import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BulkPropertiesUploadComponent } from './bulk-properties-upload.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideIonicAngular } from '@ionic/angular';

describe('BulkPropertiesUploadComponent', () => {
  let component: BulkPropertiesUploadComponent;
  let fixture: ComponentFixture<BulkPropertiesUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BulkPropertiesUploadComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [provideIonicAngular({})]
    }).compileComponents();

    fixture = TestBed.createComponent(BulkPropertiesUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
