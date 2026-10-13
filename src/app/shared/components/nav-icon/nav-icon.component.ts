import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationIcon } from '../../../core/navigation/role-navigation';

@Component({
  selector: 'app-nav-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (name()) {
      @case ('dashboard') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      }
      @case ('properties') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 21h18M4 21V7l8-4 8 4v14" />
          <path d="M9 10h2M13 10h2M9 14h2M13 14h2M10 21v-3a1 1 0 011-1h2a1 1 0 011 1v3" />
        </svg>
      }
      @case ('requests') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      }
      @case ('quotations') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 3h12v18H6z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </svg>
      }
      @case ('jobs') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18" />
        </svg>
      }
      @case ('earnings') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 12h.01M16 12h1M12 8v8M14 10c0-1-4-1-4 1s4 1 4 3-4 2-4 1" />
        </svg>
      }
      @case ('verification') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      }
      @case ('portfolio') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8" cy="9" r="1.5" />
          <path d="M3 17l5-5 4 4 3-3 6 6" />
        </svg>
      }
      @case ('review') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <circle cx="11" cy="14" r="2.5" />
          <line x1="13" y1="16" x2="16" y2="19" />
        </svg>
      }
      @case ('notifications') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      }
      @case ('contracts') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      }
      @case ('explore') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      }
      @case ('sla-board') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h10" />
          <path d="M7 12h5" />
          <circle cx="15.5" cy="14.5" r="2.5" />
          <polyline points="15.5 13.5 15.5 14.5 16.5 14.5" />
        </svg>
      }
      @case ('bulk-properties') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 21h18" />
          <path d="M5 21V7l5-4v18" />
          <path d="M10 21V11l5-4v14" />
          <path d="M15 21V15l4-3v9" />
          <line x1="7" y1="9" x2="7" y2="9.01" />
          <line x1="12" y1="13" x2="12" y2="13.01" />
          <line x1="17" y1="17" x2="17" y2="17.01" />
        </svg>
      }
      @case ('profile') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M6 20v-1a6 6 0 0112 0v1" />
        </svg>
      }
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      line-height: 0;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `]
})
export class NavIconComponent {
  readonly name = input.required<NavigationIcon>();
}
