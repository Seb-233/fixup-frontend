import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="landing">
      <header class="site-header">
        <a class="brand" href="#inicio" aria-label="FixUp, inicio"><span class="brand-mark" aria-hidden="true">F</span><span>FixUp</span></a>
        <nav aria-label="Navegación principal">
          <a href="#inicio">Inicio</a><a href="#como-funciona">¿Cómo funciona?</a><a href="#propietarios">Para propietarios</a><a href="#tecnicos">Para técnicos</a><a href="#sobre-nosotros">Sobre nosotros</a>
        </nav>
        <a class="login-link" routerLink="/auth/login">Iniciar sesión</a>
      </header>

      <main>
        <section id="inicio" class="hero" aria-labelledby="hero-title">
          <p class="eyebrow">Hogares en mejores manos</p>
          <h1 id="hero-title">Reparaciones más simples, seguras y confiables</h1>
          <p class="hero-copy">Conecta con técnicos verificados, compara cotizaciones y gestiona tus reparaciones en un solo lugar.</p>
          <a class="primary-action" routerLink="/auth/login">Iniciar sesión</a>
          <ul class="benefits" aria-label="Beneficios de FixUp"><li>Técnicos verificados</li><li>Cotizaciones transparentes</li><li>Tu hogar más seguro</li></ul>
        </section>

        <section id="como-funciona" class="section how-it-works" aria-labelledby="how-title">
          <p class="eyebrow">Un proceso claro</p><h2 id="how-title">¿Cómo funciona?</h2>
          <p class="section-intro">En pocos pasos puedes resolver lo que tu hogar necesita.</p>
          <div class="steps">
            <article><span>01</span><h3>Publica tu solicitud</h3><p>Describe la reparación y adjunta fotos.</p></article>
            <article><span>02</span><h3>Recibe cotizaciones</h3><p>Técnicos verificados te envían sus propuestas.</p></article>
            <article><span>03</span><h3>Elige al técnico</h3><p>Compara perfiles y propuestas.</p></article>
            <article><span>04</span><h3>Gestiona y listo</h3><p>Haz seguimiento al servicio desde FixUp.</p></article>
          </div>
        </section>

        <section id="propietarios" class="section audience owner" aria-labelledby="owners-title">
          <div><p class="eyebrow">Para propietarios</p><h2 id="owners-title">Todo lo que necesitas para cuidar tu hogar.</h2></div>
          <div><p>Registra tus propiedades, reporta reparaciones, consulta solicitudes y revisa las cotizaciones asociadas desde tu cuenta.</p><a class="text-link" routerLink="/auth/login">Gestiona tu hogar <span aria-hidden="true">→</span></a></div>
        </section>

        <section id="tecnicos" class="section audience technician" aria-labelledby="technicians-title">
          <div><p class="eyebrow">Para técnicos</p><h2 id="technicians-title">Tu trabajo, mejor organizado.</h2></div>
          <div><p>Encuentra solicitudes disponibles, envía cotizaciones, administra trabajos, consulta ingresos y mantén tu verificación y portafolio al día.</p><a class="text-link" routerLink="/auth/login">Únete como técnico <span aria-hidden="true">→</span></a></div>
        </section>

        <section id="sobre-nosotros" class="about" aria-labelledby="about-title">
          <p class="eyebrow">FixUp</p><h2 id="about-title">Hogares que funcionan mejor</h2>
          <p>FixUp conecta a quienes necesitan resolver reparaciones con técnicos, centralizando el proceso de forma simple y transparente.</p>
          <a class="primary-action" routerLink="/auth/login">Únete a FixUp</a>
        </section>
      </main>

      <footer><div><a class="brand" href="#inicio"><span class="brand-mark" aria-hidden="true">F</span><span>FixUp</span></a><small>© 2026 FixUp</small></div><div><strong>Producto</strong><a href="#como-funciona">Cómo funciona</a><a href="#propietarios">Para propietarios</a><a href="#tecnicos">Para técnicos</a></div><div><strong>Cuenta</strong><a routerLink="/auth/login">Iniciar sesión</a></div></footer>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100dvh; color:var(--fixup-color-primary,#2d2e31); }
    .landing { min-height:100dvh; height:auto; overflow-x:hidden; background:#f7f4ee; }
    .site-header, main, footer { width:min(1180px,calc(100% - 3rem)); margin:0 auto; }
    .site-header { position:sticky; top:0; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:1.5rem; min-height:82px; background:rgba(247,244,238,.96); border-bottom:1px solid rgba(45,46,49,.1); }
    .brand { display:inline-flex; align-items:center; gap:.55rem; color:inherit; font-family:var(--fixup-font-heading); font-size:1.25rem; font-weight:800; text-decoration:none; white-space:nowrap; }
    .brand-mark { display:grid; place-items:center; width:1.9rem; height:1.9rem; border-radius:50%; background:#2d2e31; color:#f4dfb7; font-size:.85rem; }
    nav { display:flex; align-items:center; justify-content:center; gap:1.35rem; }
    nav a, footer a { color:#56534e; font-size:.9rem; text-decoration:none; } nav a:hover, footer a:hover, .text-link:hover { color:#2d2e31; text-decoration:underline; }
    .login-link, .primary-action { display:inline-flex; align-items:center; justify-content:center; padding:.78rem 1.15rem; border:1px solid #2d2e31; background:#2d2e31; color:#fff; font-size:.92rem; font-weight:700; text-decoration:none; }
    .login-link { padding:.62rem 1rem; }
    .hero { padding:clamp(5rem,12vw,10rem) 0 clamp(4rem,9vw,7rem); max-width:850px; }
    .eyebrow { margin:0 0 .8rem; color:#8a704f; font-size:.76rem; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
    h1,h2,h3 { font-family:var(--fixup-font-heading); color:#292a2a; } h1 { max-width:820px; margin:0; font-size:clamp(3rem,7vw,6.3rem); line-height:.98; letter-spacing:-.06em; } h2 { margin:0; font-size:clamp(2.2rem,4.4vw,4.3rem); line-height:1; letter-spacing:-.045em; } h3 { margin:.9rem 0 .45rem; font-size:1.14rem; }
    .hero-copy { max-width:650px; margin:1.75rem 0 2rem; color:#605d58; font-size:1.13rem; line-height:1.65; }.benefits { display:flex; flex-wrap:wrap; gap:1.2rem 2.25rem; margin:3.3rem 0 0; padding:1.1rem 0; border-top:1px solid rgba(45,46,49,.17); border-bottom:1px solid rgba(45,46,49,.17); list-style:none; color:#484641; font-size:.9rem; font-weight:700; }.benefits li::before { content:'•'; margin-right:.5rem; color:#a78351; }
    .section { padding:clamp(4.5rem,9vw,8rem) 0; border-top:1px solid rgba(45,46,49,.12); }.section-intro { margin:1rem 0 0; color:#69665f; font-size:1.05rem; }.steps { display:grid; grid-template-columns:repeat(4,1fr); gap:0; margin-top:3rem; border:1px solid rgba(45,46,49,.14); background:#fbfaf7; }.steps article { min-height:220px; padding:1.5rem; border-right:1px solid rgba(45,46,49,.14); }.steps article:last-child { border:0; }.steps span { color:#96774b; font-size:.78rem; font-weight:800; letter-spacing:.1em; }.steps p,.audience p,.about p { color:#625f59; line-height:1.6; }
    .audience { display:grid; grid-template-columns:1fr 1fr; gap:clamp(2rem,10vw,10rem); align-items:start; }.audience > div:last-child { max-width:460px; }.text-link { display:inline-block; margin-top:1.2rem; color:#2d2e31; font-weight:800; text-decoration:none; }.technician { background:#ebe5dc; width:100%; padding-left:max(1.5rem,calc((100% - 1180px)/2)); padding-right:max(1.5rem,calc((100% - 1180px)/2)); }
    .about { margin:clamp(4.5rem,9vw,8rem) auto; max-width:920px; padding:clamp(2.5rem,6vw,5rem); background:#fff; border:1px solid rgba(45,46,49,.12); text-align:center; }.about p:not(.eyebrow) { max-width:650px; margin:1.5rem auto 2rem; }
    footer { display:grid; grid-template-columns:2fr 1fr 1fr; gap:2rem; padding:3rem 0; border-top:1px solid rgba(45,46,49,.14); } footer div { display:grid; align-content:start; gap:.65rem; } footer small { margin-top:.5rem; color:#77736d; } footer strong { color:#2d2e31; font-size:.85rem; }
    @media (max-width:800px) { .site-header { min-height:68px; gap:.75rem; }.site-header nav { display:none; }.site-header,main,footer { width:min(100% - 2rem,1180px); }.hero { padding-top:4rem; }.steps { grid-template-columns:1fr 1fr; }.steps article:nth-child(2) { border-right:0; }.steps article:nth-child(-n+2) { border-bottom:1px solid rgba(45,46,49,.14); }.audience { grid-template-columns:1fr; gap:1.5rem; }.technician { padding-left:1rem; padding-right:1rem; margin-left:calc(50% - 50vw); margin-right:calc(50% - 50vw); }.technician > * { max-width:1180px; margin-left:auto; margin-right:auto; } footer { grid-template-columns:1fr 1fr; }.hero-copy { font-size:1rem; } }
    @media (max-width:480px) { h1 { font-size:clamp(2.7rem,14vw,4.2rem); }.steps { grid-template-columns:1fr; }.steps article { min-height:auto; border-right:0; border-bottom:1px solid rgba(45,46,49,.14); }.steps article:last-child { border-bottom:0; }.benefits { display:grid; gap:.75rem; }.about { padding:2.2rem 1.35rem; } footer { grid-template-columns:1fr; } }
  `]
})
export class LandingComponent {}