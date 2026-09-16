# Política de Seguridad — FixUp Frontend

La seguridad del código y la protección de datos es una prioridad absoluta para el equipo de FixUp.

---

## 🚫 Archivos y Datos Estrictamente Prohibidos en el Repositorio

Bajo ninguna circunstancia se deben rastrear o incluir en el repositorio:
- **Archivos de variables de entorno**: `.env`, `.env.local`, `.env.development`, `.env.production` (la **única** excepción permitida es `.env.example` con placeholders).
- **Configuraciones locales de plataforma**: `android/local.properties`, `android/key.properties`, `keystore.properties`.
- **Llaves de firma y certificados**: `*.jks`, `*.keystore`, `*.p12`, `*.pfx`, `upload-keystore.*`, `release-keystore.*`.
- **Credenciales de servicios en la nube**: `google-services.json`, `GoogleService-Info.plist`, `service-account*.json`, `firebase-admin*.json`.
- **Secretos y tokens**: Client Secrets de Auth0, Management API Tokens, Access/Refresh/ID Tokens, contraseñas, tokens personales de GitHub/npm, credenciales de base de datos o claves privadas de servidor.
- **Artefactos compilados**: `dist/`, `www/`, `*.apk`, `*.aab`.

Está expresamente prohibido publicar credenciales o información sensible en:
- Mensajes de commit.
- Descripciones o comentarios de Pull Requests o Issues.
- Salidas de consola o logs de depuración.

---

## 🚨 Protocolo ante Exposición Accidental de Secretos

Si por error se incluye cualquier secreto o credencial en el repositorio local o remoto:
1. **Detener el trabajo de inmediato**: No realizar nuevos commits ni pushes hasta contener el incidente.
2. **No limitarse a borrar el archivo**: Eliminar un archivo en un commit posterior **no** elimina el secreto del historial de Git.
3. **Notificar de inmediato**: Informar al orquestador técnico y al equipo de seguridad indicando el archivo, el commit y el tipo de credencial afectada.
4. **Revocar y rotar la credencial de forma urgente**: Proceder inmediatamente a invalidar la clave en el panel del proveedor (Auth0, Google Cloud, AWS, base de datos) y generar una nueva. La clave antigua debe considerarse comprometida permanentemente.
5. **Depuración del historial**: Seguir las instrucciones del equipo para reescribir el historial de manera controlada utilizando herramientas autorizadas (`git-filter-repo`).

---

## 🛡️ Reporte de Vulnerabilidades

Si descubres una vulnerabilidad de seguridad en el código de FixUp:
- **No abras un Issue público**.
- Contacta directamente al equipo técnico o al orquestador responsable del proyecto para su evaluación y remediación coordinada.
