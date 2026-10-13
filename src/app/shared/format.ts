// Formato y vocabulario de Fix&Rent en español de Colombia. Un solo lugar para que una misma cosa
// (un estado, una especialidad, un precio) se lea igual en todas las pantallas.

const MONEY = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});
const NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
// Fechas y horas siempre en hora de Colombia: las reglas del negocio (visitas de 7:00 a 19:00,
// plazos de atención) se expresan en esa zona sin importar dónde esté quien mira.
const ZONE = 'America/Bogota';
const DATE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: ZONE });
const DATE_SHORT = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: ZONE });
const DATE_TIME = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: ZONE
});
const TIME = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: ZONE });

/** "7:00 a. m." nunca se parte entre líneas. */
function keepTogether(text: string): string {
  return text.replace(/\s?([ap])\.\s?m\./g, '\u00a0$1.\u00a0m.');
}
const MONTH = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });

export function money(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Sin precio' : MONEY.format(value);
}

export function num(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : NUMBER.format(value);
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  // Una fecha sin hora ("2026-10-14", contratos) es un día del calendario colombiano, no medianoche UTC.
  const date = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-05:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function date(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? DATE.format(d) : '—';
}

export function dateShort(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? DATE_SHORT.format(d) : '—';
}

export function dateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? keepTogether(DATE_TIME.format(d)) : '—';
}

export function time(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? keepTogether(TIME.format(d)) : '—';
}

export function month(value: string): string {
  // "2026-09" → "septiembre de 2026"
  const [y, m] = value.split('-').map(Number);
  if (!y || !m) return value;
  return MONTH.format(new Date(y, m - 1, 1));
}

/** "hace 3 h", "en 2 días": para plazos y actividad reciente. */
export function relative(value: string | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return '—';
  const minutes = Math.round((d.getTime() - now.getTime()) / 60000);
  const abs = Math.abs(minutes);
  const unit =
    abs < 60
      ? `${abs} min`
      : abs < 60 * 24
        ? `${Math.round(abs / 60)} h`
        : `${Math.round(abs / (60 * 24))} ${Math.round(abs / (60 * 24)) === 1 ? 'día' : 'días'}`;
  if (abs < 1) return 'ahora';
  return minutes < 0 ? `hace ${unit}` : `en ${unit}`;
}

/** Valor para un <input type="datetime-local"> en la hora local del navegador. */
export function toLocalInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
    value.getHours()
  )}:${pad(value.getMinutes())}`;
}

export function isoDate(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

// ------------------------------------------------------------------ vocabulario

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export interface Label {
  text: string;
  tone: Tone;
}

const label = (text: string, tone: Tone = 'neutral'): Label => ({ text, tone });

export const SPECIALTY: Record<string, string> = {
  PLUMBING: 'Plomería',
  ELECTRICAL: 'Electricidad',
  PAINTING: 'Pintura',
  CARPENTRY: 'Carpintería',
  MASONRY: 'Albañilería',
  GENERAL: 'Mantenimiento general'
};

export const SPECIALTIES = Object.keys(SPECIALTY);

// Ciudades sugeridas en los buscadores. El campo acepta cualquier ciudad; esta lista solo ahorra
// escribir las más comunes.
export const CITIES = [
  'Bogotá',
  'Medellín',
  'Cali',
  'Barranquilla',
  'Cartagena',
  'Bucaramanga',
  'Pereira',
  'Manizales',
  'Santa Marta',
  'Armenia',
  'Envigado',
  'Chía',
  'Villavicencio'
];

export const PROPERTY_TYPE: Record<string, string> = {
  APARTMENT: 'Apartamento',
  HOUSE: 'Casa',
  STUDIO: 'Apartaestudio',
  OFFICE: 'Oficina',
  COMMERCIAL: 'Local comercial',
  COUNTRY_HOUSE: 'Casa campestre'
};

export const LISTING_TYPE: Record<string, string> = {
  RENT: 'Arriendo',
  SALE: 'Venta'
};

export const URGENCY: Record<string, Label> = {
  LOW: label('Baja'),
  MEDIUM: label('Media', 'info'),
  HIGH: label('Alta', 'warning'),
  URGENT: label('Urgente', 'danger')
};

export const REQUEST_STATUS: Record<string, Label> = {
  OPEN: label('Recibiendo cotizaciones', 'info'),
  ASSIGNED: label('Técnico asignado', 'accent'),
  SLA_WARNING: label('Plazo en riesgo', 'warning'),
  SLA_BREACHED: label('Plazo vencido', 'danger'),
  COMPLETED: label('Terminada', 'success'),
  CANCELLED: label('Cancelada')
};

export const SLA_STATE: Record<string, Label> = {
  NONE: label('Sin plazo'),
  ON_TRACK: label('A tiempo', 'success'),
  WARNING: label('Por vencer', 'warning'),
  BREACHED: label('Vencido', 'danger')
};

export const QUOTATION_STATUS: Record<string, Label> = {
  SUBMITTED: label('Enviada', 'info'),
  ACCEPTED: label('Aceptada', 'success'),
  REJECTED: label('No elegida')
};

export const JOB_STATUS: Record<string, Label> = {
  ASSIGNED: label('Por agendar', 'info'),
  SCHEDULED: label('Agendado', 'accent'),
  IN_PROGRESS: label('En curso', 'warning'),
  SLA_AT_RISK: label('Plazo en riesgo', 'danger'),
  COMPLETED: label('Terminado', 'success')
};

export const VISIT_KIND: Record<string, string> = {
  DIAGNOSTIC: 'Diagnóstico',
  EXECUTION: 'Ejecución',
  KITCHEN_ASSESSMENT: 'Valoración de cocina'
};

export const VISIT_STATUS: Record<string, Label> = {
  PROPOSED: label('Por confirmar', 'warning'),
  CONFIRMED: label('Confirmada', 'success'),
  COMPLETED: label('Realizada', 'neutral'),
  CANCELLED: label('Cancelada'),
  NO_SHOW: label('No asistió', 'danger')
};

export const CHARGE_STATUS: Record<string, Label> = {
  PENDING: label('Por pagar', 'warning'),
  APPROVED: label('Pagado', 'success'),
  DECLINED: label('Rechazado', 'danger')
};

export const PAYMENT_METHOD: Record<string, string> = {
  SANDBOX_CARD: 'Tarjeta (prueba)',
  SANDBOX_PSE: 'PSE (prueba)',
  SANDBOX_NEQUI: 'Nequi (prueba)'
};

export const EARNING_STATUS: Record<string, Label> = {
  HELD: label('Retenido', 'warning'),
  AVAILABLE: label('Disponible', 'success'),
  PAID_OUT: label('Pagado al técnico')
};

export const CONTRACT_STATUS: Record<string, Label> = {
  DRAFT: label('Borrador'),
  ACTIVE: label('Vigente', 'success'),
  EXPIRED: label('Vencido', 'danger'),
  TERMINATED: label('Terminado'),
  RENEWED: label('Renovado', 'info')
};

export const PROPERTY_STATUS: Record<string, Label> = {
  DRAFT: label('Sin publicar'),
  PUBLISHED: label('Publicado', 'success'),
  ARCHIVED: label('Archivado')
};

export const REMODELING_STATUS: Record<string, Label> = {
  OPEN: label('Buscando técnicos', 'info'),
  PARTIALLY_ASSIGNED: label('Asignación parcial', 'warning'),
  FULLY_ASSIGNED: label('Equipo completo', 'accent'),
  PARTIALLY_COMPLETED: label('Obra en curso', 'warning'),
  COMPLETED: label('Terminada', 'success')
};

export const VERIFICATION_STATUS: Record<string, Label> = {
  PENDING: label('Pendiente', 'warning'),
  VERIFIED: label('Verificado', 'success'),
  REJECTED: label('Rechazado', 'danger'),
  SUSPENDED: label('Suspendido', 'danger')
};

export const DOCUMENT_TYPE: Record<string, string> = {
  ID_CARD: 'Cédula de ciudadanía',
  TRADE_CERTIFICATE: 'Certificado del oficio',
  BACKGROUND_CHECK: 'Antecedentes judiciales',
  INSURANCE: 'Póliza de responsabilidad civil'
};

export const ROLE_NAME: Record<string, string> = {
  OWNER: 'Propietario',
  TENANT: 'Arrendatario',
  FIXER: 'Técnico',
  REAL_ESTATE_MANAGER: 'Inmobiliaria',
  PLATFORM_ADMIN: 'Administración'
};

export const EVIDENCE_STAGE: Record<string, string> = {
  BEFORE: 'Antes',
  DURING: 'Durante',
  AFTER: 'Después'
};

export const CHECKLIST_RESULT: Record<string, string> = {
  OK: 'En buen estado',
  NEEDS_WORK: 'Requiere arreglo',
  NOT_APPLICABLE: 'No aplica'
};

export function pick(map: Record<string, Label>, key: string | null | undefined): Label {
  return (key && map[key]) || label(key ?? '—');
}

export function name(map: Record<string, string>, key: string | null | undefined): string {
  return (key && map[key]) || key || '—';
}

/** Mensaje legible a partir del error del backend ({code, message}) o de la red. */
export function errorMessage(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  const failure = error as { status?: number; error?: { code?: string } };
  if (failure?.status === 0) return 'No hay conexión con el servidor de Fix&Rent.';
  const code = failure?.error?.code;
  if (code && ERROR_CODES[code]) return ERROR_CODES[code];
  if (failure?.status === 403) return 'Tu cuenta no tiene permiso para esta acción.';
  if (failure?.status === 404) return 'No encontramos lo que buscabas, o ya no tienes acceso.';
  // El backend redacta sus mensajes en inglés para registro técnico; al usuario le llega el texto
  // de la pantalla que falló.
  return fallback;
}

// Los códigos que el backend devuelve en {code}. Solo los que el usuario puede corregir llevan
// instrucción; el resto cae al mensaje del servidor.
const ERROR_CODES: Record<string, string> = {
  FIXER_BUSY: 'El técnico ya tiene una visita confirmada a esa hora. Propón otra.',
  FIXER_NOT_QUOTED: 'El diagnóstico se agenda con un técnico que ya cotizó la solicitud abierta.',
  FIXER_NOT_ASSIGNED: 'La visita de ejecución es con el técnico asignado.',
  FIXER_REQUIRED: 'Elige el técnico que hará la visita.',
  SELF_VISIT: 'El propietario no puede ser el técnico de la visita.',
  TOO_SOON: 'Agenda la visita con al menos dos horas de anticipación.',
  OUTSIDE_HOURS: 'Las visitas son entre 7:00 a. m. y 7:00 p. m., hora de Colombia.',
  VISIT_IN_THE_PAST: 'La fecha de la visita ya pasó.',
  CHECKLIST_INCOMPLETE: 'Responde todos los puntos de la lista de chequeo.',
  OUTCOME_REQUIRED: 'Escribe el resultado de la visita.',
  REQUEST_CLOSED: 'La solicitud ya está cerrada.',
  REQUEST_NOT_OPEN: 'La solicitud ya no recibe cotizaciones.',
  ALREADY_QUOTED: 'Ya enviaste una cotización para esta solicitud.',
  SELF_QUOTATION: 'No puedes cotizar una solicitud propia.',
  QUOTATION_ALREADY_DECIDED: 'Esa cotización ya fue decidida.',
  AMOUNT_MISMATCH: 'El valor no coincide con el cobro.',
  REFERENCE_MISMATCH: 'La referencia no coincide con el cobro.',
  CHARGE_ALREADY_PAID: 'Este cobro ya está pagado.',
  METHOD_REQUIRED: 'Elige un medio de pago de prueba.',
  NO_AVAILABLE_BALANCE: 'No tienes saldo disponible para retirar.',
  ALREADY_RATED: 'Este trabajo ya tiene calificación.',
  JOB_NOT_COMPLETED: 'Solo se califica un trabajo terminado.',
  SELF_RATING: 'No puedes calificar tu propio trabajo.',
  JOB_NOT_STARTABLE: 'Solo se inicia un trabajo asignado o agendado.',
  INVALID_SCHEDULE: 'La fecha acordada debe ser futura.',
  TOO_MANY_PHOTOS: 'Superaste el número de fotos permitido.',
  NOT_READY_TO_PUBLISH: 'La remodelación debe estar terminada para publicar el aviso.',
  LISTING_ALREADY_PUBLISHED: 'El aviso de esta remodelación ya está publicado.',
  TARGET_RENT_REQUIRED: 'Indica el canon objetivo de la remodelación pre-arriendo.',
  CONSENT_REQUIRED: 'Debes aceptar el tratamiento de datos personales.'
};
