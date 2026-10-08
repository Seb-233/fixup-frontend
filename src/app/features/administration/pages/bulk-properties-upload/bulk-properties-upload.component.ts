import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import {
  AlertController,
  ToastController
} from '@ionic/angular';
import Papa from 'papaparse';
import { FileUploadDropzoneComponent } from '../../../../shared/components/file-upload-dropzone/file-upload-dropzone.component';
import {
  BulkValidationError,
  PropertyBulkService
} from '../../services/property-bulk.service';
import { BulkPropertiesStore } from '../../services/bulk-properties.store';

interface ParsedRow {
  name?: string;
  address?: string;
  city?: string;
  areaM2?: string;
}

@Component({
  selector: 'app-bulk-properties-upload',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IonicModule,
    FileUploadDropzoneComponent
  ],
  templateUrl: './bulk-properties-upload.component.html',
  styleUrls: ['./bulk-properties-upload.component.scss']
})
export class BulkPropertiesUploadComponent {
  readonly store = inject(BulkPropertiesStore);
  private readonly propertyBulkService = inject(PropertyBulkService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly parsedPreview = signal<ParsedRow[]>([]);

  readonly hasErrors = computed(() => {
    const v = this.store.validation();
    return v ? v.total - v.validCount > 0 : false;
  });

  readonly hasValid = computed(() => {
    const v = this.store.validation();
    return v ? v.validCount > 0 : false;
  });

  readonly displayedRows = computed(() => this.parsedPreview().slice(0, 50));

  onFileSelected(file: File): void {
    this.store.setFile(file);
    this.parsePreview(file);
  }

  private parsePreview(file: File): void {
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: Papa.ParseResult<ParsedRow>) => {
        this.parsedPreview.set(result.data.slice(0, 50));
      }
    });
  }

  async onValidate(): Promise<void> {
    if (!this.store.file()) return;
    await this.store.validate();
  }

  goBack(): void {
    this.store.reset();
    this.parsedPreview.set([]);
  }

  async revalidate(): Promise<void> {
    this.store.setFile(this.store.file());
    this.parsedPreview.set([]);
    const f = this.store.file();
    if (f) {
      this.parsePreview(f);
    }
    await this.store.validate();
  }

  async onImport(): Promise<void> {
    if (!this.hasValid()) return;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar importación',
      message: `Se van a importar ${this.store.validation()?.validCount ?? 0} propiedades válidas. ¿Deseas continuar?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Importar',
          handler: async () => {
            await this.store.importFile();
            if (this.store.importResult() && this.store.importResult()!.imported > 0) {
              await this.showSuccessToast();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async showSuccessToast(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: '¡Lote importado correctamente!',
      duration: 3500,
      color: 'success',
      position: 'top',
      icon: 'checkmark-circle-outline'
    });
    await toast.present();
  }

  async downloadTemplate(): Promise<void> {
    this.propertyBulkService.downloadTemplate().subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-propiedades.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }

  finish(): void {
    this.router.navigate(['/properties']);
  }

  resetAll(): void {
    this.store.reset();
    this.parsedPreview.set([]);
  }

  errorsForRow(index: number): BulkValidationError[] {
    const errors = this.store.validation()?.errors ?? [];
    const rowNum = index + 2;
    return errors.filter((e) => e.rowNumber === rowNum);
  }

  rowHasErrors(index: number): boolean {
    return this.errorsForRow(index).length > 0;
  }
}
