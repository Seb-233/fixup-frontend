import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  signal
} from '@angular/core';
import { IonicModule } from '@ionic/angular/lazy';

@Component({
  selector: 'app-file-upload-dropzone',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './file-upload-dropzone.component.html',
  styleUrls: ['./file-upload-dropzone.component.scss']
})
export class FileUploadDropzoneComponent {
  @Input() accept = '.csv';
  @Input() maxSizeMb = 5;
  @Output() fileSelected = new EventEmitter<File>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly isHover = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly error = signal<string | null>(null);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isHover.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isHover.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isHover.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  openFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  changeFile(): void {
    this.selectedFile.set(null);
    this.error.set(null);
    this.fileInput.nativeElement.value = '';
    this.openFilePicker();
  }

  private handleFile(file: File): void {
    this.error.set(null);

    const validExtensions = this.accept
      .split(',')
      .map((ext) => ext.trim().toLowerCase().replace(/^\./, ''));
    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!validExtensions.includes(fileExt)) {
      this.error.set(
        `Extensión no válida. Solo se aceptan archivos: ${this.accept}`
      );
      return;
    }

    const maxBytes = this.maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      this.error.set(
        `Archivo demasiado grande. Tamaño máximo permitido: ${this.maxSizeMb}MB`
      );
      return;
    }

    this.selectedFile.set(file);
    this.fileSelected.emit(file);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
