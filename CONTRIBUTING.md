# Guía de Contribución al Frontend de FixUp

Agradecemos las contribuciones al proyecto frontend de FixUp. Para mantener un código de alta calidad, seguro y consistente, todos los colaboradores deben seguir estas pautas.

---

## 🌿 Estrategia de Ramas y Flujo de Trabajo (Git Flow Adaptado)

El repositorio cuenta con dos ramas principales y protegidas:

- **`main`**: Rama de producción. Contiene el código estable y versiones etiquetadas (releases). Nadie realiza push directo a `main`.
- **`develop`**: Rama base de integración continua para el desarrollo activo. Todo desarrollo de nuevas funcionalidades y correcciones se integra primero aquí.

### Prefijos de Ramas Autorizados

Toda nueva rama debe crearse a partir de `develop` (o de `main` exclusivamente para `hotfix/*`) utilizando uno de los siguientes prefijos según su propósito:

| Prefijo | Propósito | Rama Base | Rama Destino (PR) |
| :--- | :--- | :--- | :--- |
| `setup/*` | Configuración inicial de herramientas, infraestructura o arquitectura base | `develop` / `main` | `develop` |
| `feature/*` | Nuevas funcionalidades o módulos de la aplicación | `develop` | `develop` |
| `fix/*` | Correcciones de errores (bug fixes) detectados en desarrollo | `develop` | `develop` |
| `test/*` | Creación o ampliación de pruebas unitarias o de integración | `develop` | `develop` |
| `docs/*` | Documentación técnica, guías o actualización de manuales | `develop` | `develop` |
| `release/*` | Estabilización y preparación de una versión para producción | `develop` | `main` y `develop` |
| `hotfix/*` | Correcciones críticas inmediatas sobre código en producción | `main` | `main` y `develop` |

---

## 📝 Convención de Commits (Conventional Commits)

Los mensajes de commit deben redactarse en minúsculas y seguir la especificación [Conventional Commits](https://www.conventionalcommits.org/):

`<tipo>(<alcance opcional>): <descripción concisa>`

### Tipos admitidos:
- **`feat`**: Una nueva funcionalidad para el usuario.
- **`fix`**: Corrección de un error.
- **`chore`**: Tareas de mantenimiento, actualización de dependencias o ajustes de configuración que no modifican código fuente de negocio.
- **`docs`**: Cambios exclusivos en la documentación.
- **`style`**: Cambios de formato (espacios, comas, punto y coma) que no afectan el significado del código.
- **`refactor`**: Refactorización de código que no corrige un bug ni añade una funcionalidad.
- **`test`**: Añadir o corregir pruebas unitarias.
- **`ci`**: Cambios en los archivos o scripts de integración continua (`.github/workflows`).
- **`build`**: Cambios que afectan el sistema de compilación o dependencias externas (Docker, Nginx, Angular CLI).

---

## 🔄 Proceso de Pull Requests y Revisiones

1. **Destino de los Pull Requests**:
   - Todo trabajo regular (`setup/*`, `feature/*`, `fix/*`, `test/*`, `docs/*`) debe solicitar Pull Request hacia la rama **`develop`**.
   - Solo las ramas `release/*` y `hotfix/*` abren PR hacia **`main`**.
2. **Revisión Humana Obligatoria**:
   - Ningún Pull Request podrá integrarse sin la aprobación previa de al menos un revisor / orquestador técnico.
   - Queda estrictamente prohibido que un autor apruebe su propio PR.
3. **Validación de CI Obligatoria**:
   - El pipeline de GitHub Actions (`frontend-ci.yml`) debe ejecutarse y aprobarse en su totalidad (auditoría de seguridad, linteo, tests unitarios, build web y sincronización de Capacitor).
4. **Prohibición de Push Directo y Force Push**:
   - Está terminantemente prohibido hacer push directo sobre `main` o `develop`.
   - Está prohibido reescribir la historia remota mediante `git push --force` o force push con `lease` en ramas compartidas.
