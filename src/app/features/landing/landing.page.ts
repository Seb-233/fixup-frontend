import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/ui/icon.component';

interface RoleRow {
  role: string;
  does: string[];
}

interface Step {
  title: string;
  text: string;
}

// Página pública. Cuenta qué hace el producto con sus propias piezas (roles, flujo, sello) y no
// promete nada que el sistema no haga: no hay cifras de clientes ni testimonios porque no existen.
@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss'
})
export class LandingPage {
  readonly roles: RoleRow[] = [
    {
      role: 'Propietarios',
      does: [
        'Publican sus inmuebles con fotos, precio y ubicación en el mapa.',
        'Comparan cotizaciones de técnicos con su calificación antes de elegir.',
        'Pagan en línea y ven sus gastos de mantenimiento por inmueble y por mes.'
      ]
    },
    {
      role: 'Arrendatarios',
      does: [
        'Reportan un daño del inmueble que arriendan, con fotos, desde el celular.',
        'Siguen el arreglo hasta el final y califican al técnico.'
      ]
    },
    {
      role: 'Técnicos',
      does: [
        'Verifican su identidad y su oficio una sola vez.',
        'Cotizan, agendan visitas y suben fotos de antes y después.',
        'Reciben su pago cuando el cliente paga y el trabajo termina.'
      ]
    },
    {
      role: 'Inmobiliarias',
      does: [
        'Administran los inmuebles que les delegan sus propietarios.',
        'Priorizan solicitudes por plazo e invitan técnicos de la misma ciudad.'
      ]
    }
  ];

  readonly steps: Step[] = [
    { title: 'Reporte con fotos', text: 'Quien vive o es dueño describe el daño y su urgencia. El plazo de atención empieza a contar.' },
    { title: 'Cotizaciones', text: 'Técnicos verificados de la especialidad cotizan valor y días. Se comparan lado a lado.' },
    { title: 'Visita, si hace falta', text: 'Se agenda un diagnóstico entre 7:00 a. m. y 7:00 p. m. y ambas partes la confirman.' },
    { title: 'Trabajo con evidencia', text: 'El técnico registra fotos de antes, durante y después en el historial del inmueble.' },
    { title: 'Pago y calificación', text: 'El cliente paga, el trabajo se cierra y la calificación queda en el perfil del técnico.' }
  ];
}
