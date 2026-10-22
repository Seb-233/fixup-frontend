# Dirección visual de Fix&Rent

Este archivo transcribe la identidad que el equipo ya tenía en el front (logo, paleta y tipografías en
`src/styles/_tokens.scss` antes del rediseño) y las decisiones que tomó Mateo Madrigal el 13 de octubre
de 2026 para el rediseño. Es la fuente de dirección; `antislop` es el filtro que se aplica encima.

## Identidad

- **Producto:** Fix&Rent conecta a propietarios, arrendatarios y administradores inmobiliarios con
  técnicos verificados, y une el mantenimiento del inmueble con su publicación para arriendo o venta.
- **Logo:** la "F" dorada sobre fondo carbón (`src/assets/icons/icon-512x512.png`). Se usa tal cual; no
  se dibuja un logo nuevo.
- **Nombre en la interfaz:** Fix&Rent (el nombre del SRS y del sello de inmuebles).

## Personalidad

Sobria y cálida. Es una herramienta de trabajo para gente que resuelve problemas de su casa o de su
oficio: tiene que verse confiable y tranquila, no llamativa. Las fotos reales de los inmuebles y de
los trabajos son lo que da vida a las pantallas; la interfaz les deja el espacio.

## Paleta

| Rol | Color | Uso |
| --- | --- | --- |
| Tinta (núcleo) | `#2D2E31` carbón | Texto principal, botón primario, barra lateral |
| Base (núcleo) | `#F8F8F8` y blanco | Fondo de página y superficies |
| Neutro cálido | `#9A948D` | Bordes y texto secundario sobre fondos oscuros |
| Acento | `#CEAC78` dorado | Un solo momento por pantalla: la acción o el dato que importa |
| Tierra (núcleo secundario) | `#795548` / `#423D32` | Sello Fix&Rent y detalles de marca |

Los colores de estado (éxito, atención, error) son funcionales y apagados para no competir con el
acento. Todo par de texto se verifica con el contraste AA.

## Tipografía

- **Comfortaa** (títulos de página y marca): la redondez del logo; se usa solo en titulares grandes,
  donde se lee bien.
- **Inter** (interfaz y texto): legible a tamaños pequeños en formularios y tablas densas.

## Dials

`ENERGY 2 / RHYTHM 2 / MOTION 1`

- Energía equilibrada: un punto focal por pantalla, acento dorado solo donde está la decisión.
- Ritmo consistente con algunos quiebres: las pantallas siguen una estructura común y la portada y
  el detalle de inmueble rompen con fotografía grande.
- Movimiento mínimo: estados de hover y foco, transiciones cortas de 150 ms. Nada en bucle.

## Tema

La plataforma no tiene una razón de producto para un tema fijo, así que hay modo claro (por defecto)
y oscuro con un selector en el perfil y en la barra superior. Ambos se prueban.
