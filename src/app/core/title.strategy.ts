import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

// "Solicitud · Fix&Rent": la pestaña dice dónde está la persona y de qué producto es.
@Injectable({ providedIn: 'root' })
export class FixRentTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} · Fix&Rent` : 'Fix&Rent');
  }
}
