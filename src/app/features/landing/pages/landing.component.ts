import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="landing">
      <header class="site-header">
        <a class="brand" routerLink="/" aria-label="FixUp, inicio">
          <span class="brand-mark" aria-hidden="true">⌂</span>
          <span>FixUp</span>
        </a>
        <a class="login-link" routerLink="/auth/login">Iniciar sesión</a>
      </header>

      <main>
        <section class="hero" aria-labelledby="hero-title">
          <div class="hero-copy">
            <p class="eyebrow">Gestión de reparaciones para tu hogar</p>
            <h1 id="hero-title">Cuida tu propiedad sin perder de vista cada reparación.</h1>
            <p class="hero-description">
              FixUp reúne el registro de tu propiedad, tus solicitudes de reparación y la conexión
              con técnicos para que puedas dar seguimiento a lo que sucede en tu hogar.
            </p>
            <div class="hero-actions">
              <a class="primary-action" routerLink="/auth/login">Iniciar sesión</a>
              <a class="secondary-action" href="#como-funciona">Conoce cómo funciona</a>
            </div>
          </div>
          <div class="hero-panel" aria-hidden="true">
            <div class="panel-card panel-card-main">
              <span class="panel-icon">⌂</span>
              <strong>Tu propiedad, organizada</strong>
              <span>Solicitudes y reparaciones en un mismo lugar.</span>
            </div>
            <div class="panel-card panel-card-accent">
              <span>Reparación</span>
              <strong>En seguimiento</strong>
            </div>
          </div>
        </section>

        <section id="como-funciona" class="how-it-works" aria-labelledby="how-title">
          <p class="eyebrow">Proceso simple</p>
          <h2 id="how-title">Cómo funciona</h2>
          <div class="steps">
            <article>
              <span>01</span>
              <h3>Registra tu propiedad</h3>
              <p>Guarda los datos básicos de la propiedad que deseas gestionar.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Reporta el problema</h3>
              <p>Crea una solicitud con la descripción y las evidencias disponibles.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Conecta con técnicos</h3>
              <p>Consulta las propuestas y acompaña el avance de cada reparación.</p>
            </article>
          </div>
        </section>

        <section class="audiences" aria-label="FixUp para propietarios y técnicos">
          <article>
            <p class="eyebrow">Para propietarios</p>
            <h2>Centraliza el mantenimiento de tus propiedades.</h2>
            <p>Registra propiedades y crea solicitudes de reparación cuando las necesites.</p>
          </article>
          <article>
            <p class="eyebrow">Para técnicos</p>
            <h2>Encuentra solicitudes y gestiona tu trabajo.</h2>
            <p>Consulta oportunidades, cotizaciones y trabajos asignados desde tu cuenta FixUp.</p>
          </article>
        </section>
      </main>

      <footer>
        <span>FixUp</span>
        <span>Gestión de propiedades y reparaciones.</span>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; color: var(--fixup-color-primary, #2d2e31); }
    .landing { min-height: 100vh; background: linear-gradient(180deg, #fcfbf8 0%, #f4f0e9 100%); }
    .site-header, main, footer { width: min(1120px, calc(100% - 2.5rem)); margin: 0 auto; }
    .site-header { min-height: 76px; display: flex; justify-content: space-between; align-items: center; }
    .brand { display: inline-flex; align-items: center; gap: .55rem; color: inherit; font-family: var(--fixup-font-heading); font-size: 1.3rem; font-weight: 700; text-decoration: none; }
    .brand-mark { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: .65rem; background: var(--fixup-color-primary, #2d2e31); color: var(--fixup-color-accent, #ceac78); }
    .login-link, .primary-action, .secondary-action { border-radius: .7rem; font-weight: 700; text-decoration: none; }
    .login-link { padding: .65rem 1rem; color: var(--fixup-color-primary, #2d2e31); border: 1px solid rgba(45, 46, 49, .18); }
    .hero { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr); gap: 3rem; align-items: center; padding: 5rem 0; }
    .eyebrow { margin: 0 0 .7rem; color: #806437; font-size: .78rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    h1, h2, h3 { font-family: var(--fixup-font-heading); }
    h1 { max-width: 720px; margin: 0; font-size: clamp(2.4rem, 5vw, 4.5rem); line-height: 1.05; letter-spacing: -.04em; }
    .hero-description { max-width: 620px; margin: 1.4rem 0 0; color: #5f5c56; font-size: 1.08rem; line-height: 1.65; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: .85rem; margin-top: 2rem; }
    .primary-action { padding: .9rem 1.25rem; background: var(--fixup-color-primary, #2d2e31); color: #fff; }
    .secondary-action { padding: .9rem 1.25rem; color: var(--fixup-color-primary, #2d2e31); background: #fff; border: 1px solid rgba(45, 46, 49, .14); }
    .hero-panel { min-height: 340px; position: relative; border-radius: 1.5rem; background: linear-gradient(140deg, #2d2e31, #455966); box-shadow: 0 22px 45px rgba(45, 46, 49, .22); }
    .panel-card { position: absolute; display: grid; gap: .55rem; border-radius: 1rem; padding: 1.3rem; background: rgba(255, 255, 255, .94); box-shadow: 0 12px 30px rgba(0, 0, 0, .14); }
    .panel-card-main { inset: 17% 10% auto; color: #2d2e31; }
    .panel-card-main span:last-child { color: #5f5c56; line-height: 1.45; }
    .panel-icon { color: #9b7540; font-size: 1.5rem; }
    .panel-card-accent { right: 7%; bottom: 12%; color: #fff; background: #a9834a; }
    .how-it-works { padding: 4.5rem 0; }
    .how-it-works h2, .audiences h2 { margin: 0; font-size: clamp(1.8rem, 3vw, 2.6rem); }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 2rem; }
    .steps article, .audiences article { padding: 1.5rem; border: 1px solid rgba(45, 46, 49, .1); border-radius: 1rem; background: rgba(255, 255, 255, .7); }
    .steps span { color: #9b7540; font-weight: 800; }
    .steps h3 { margin: .9rem 0 .55rem; font-size: 1.12rem; }
    .steps p, .audiences p:not(.eyebrow) { margin: 0; color: #5f5c56; line-height: 1.55; }
    .audiences { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; padding: 1rem 0 5rem; }
    .audiences article:last-child { background: #2d2e31; color: #fff; }
    .audiences article:last-child .eyebrow { color: #d7b780; }
    .audiences article:last-child p:not(.eyebrow) { color: #d9d8d4; }
    footer { display: flex; justify-content: space-between; gap: 1rem; padding: 1.5rem 0; color: #68645d; border-top: 1px solid rgba(45, 46, 49, .1); font-size: .9rem; }
    @media (max-width: 720px) { .site-header, main, footer { width: min(100% - 2rem, 1120px); } .hero { grid-template-columns: 1fr; gap: 2rem; padding: 3.5rem 0; } .hero-panel { min-height: 260px; } .steps, .audiences { grid-template-columns: 1fr; } .how-it-works { padding: 3rem 0; } footer { flex-direction: column; } }
  `]
})
export class LandingComponent {}
