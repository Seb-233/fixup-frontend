import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Juego de iconos propio de Fix&Rent. Trazo de 1.8 px con uniones en ángulo recto: se lee como un
// plano de obra, que es el mundo del producto, y no como la librería de iconos por defecto. Cada
// glifo representa literalmente lo que nombra (casa, llave, calendario); no hay iconos decorativos.
const PATHS: Record<string, string> = {
  home: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
  building: 'M4 21V4h11v17M15 9h5v12M2 21h20M7.5 8h2M7.5 12h2M7.5 16h2M11 8h1M11 12h1M11 16h1M17.5 13h0.5M17.5 17h0.5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L21 21',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  wrench: 'M14.5 6.5a4 4 0 0 1 5-3.5l-2.5 2.5 1 2.5 2.5 1L23 6.5a4 4 0 0 1-5.5 4.5L8 20.5a2 2 0 0 1-3-3L14.5 8z',
  hammer: 'M13 7l4-4 4 4-4 4M15 9L5 19a1.5 1.5 0 0 1-2-2L13 7',
  file: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8M9 9h3',
  wallet: 'M3 7h16v13H3zM3 7l12-4v4M15 13.5h4',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9a1 1 0 1 0 0-.01',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0.5M8 17.5h2M12 17.5h2',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M18 14a5 5 0 0 1 4 5v2',
  clipboard: 'M8 4h8v3H8zM6 5H4v16h16V5h-2M8 12h8M8 16h5',
  upload: 'M12 16V4M7 9l5-5 5 5M4 15v5h16v-5',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h0.01',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21a8 8 0 0 1 16 0',
  logout: 'M15 4h5v16h-5M10 8l-4 4 4 4M6 12h11',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M5 5l14 14M19 5L5 19',
  plus: 'M12 4v16M4 12h16',
  minus: 'M4 12h16',
  'chevron-left': 'M15 4l-8 8 8 8',
  'chevron-right': 'M9 4l8 8-8 8',
  'chevron-down': 'M4 9l8 8 8-8',
  check: 'M4 12.5l5 5L20 6',
  star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L3 9.7l6.2-.9z',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  chat: 'M4 4h16v12H9l-5 4z',
  pin: 'M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  bed: 'M3 19V6M3 13h18v6M21 13a3 3 0 0 0-3-3h-7v3M7 12a1.5 1.5 0 1 0 0-.01',
  bath: 'M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V5a2 2 0 0 1 4 0M6 20l-1 2M18 20l1 2',
  area: 'M4 4h16v16H4zM4 9h5M9 4v5M15 20v-5h5',
  car: 'M4 16v-4l2-5h12l2 5v4zM4 16v3h3v-3M17 16v3h3v-3M7.5 13h0.01M16.5 13h0.01',
  seal: 'M12 2.5l2.4 1.7 2.9-.2.9 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.8-2.9-.2L12 21.5l-2.4-1.7-2.9.2-.9-2.8-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.8 2.9.2zM8.5 12l2.5 2.5 4.5-5',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.6-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2',
  key: 'M14 10a5 5 0 1 0-2.6 4.4L13 16h2v2h2v2h4v-4l-6.4-6.4A5 5 0 0 0 14 10zM8.5 9.5h0.01',
  kitchen: 'M5 3h14v18H5zM5 10h14M8 6.5h2M8 13v4',
  card: 'M2 6h20v12H2zM2 10h20M6 15h4',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h0.01',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4',
  money: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v.01M18 15v.01'
};

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:inline-flex;line-height:0' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" [attr.stroke-width]="stroke()" stroke-linecap="square"
         stroke-linejoin="miter" aria-hidden="true" focusable="false">
      <path [attr.d]="path()" />
    </svg>
  `
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input<number>(20);
  readonly stroke = input<number>(1.8);
  readonly path = computed(() => PATHS[this.name()] ?? PATHS['info']);
}
