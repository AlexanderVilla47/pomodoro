# Plan Pomodoro v1 — Resumen en español

## ¿Qué estamos construyendo?

Una app web personal de Pomodoro con tres pilares:

1. **Timer animado** — el centro de la pantalla, con animaciones GSAP espectaculares
2. **Música de YouTube** — pegás el link de tu playlist y suena mientras estudiás
3. **Tracking diario/semanal** — ves cuántas horas estudiaste hoy y esta semana

Se despliega en tu servidor Oracle Cloud con Docker.

---

## Stack tecnológico elegido

| Parte | Tecnología | Por qué |
|-------|-----------|---------|
| Framework | Next.js (App Router) + TypeScript | Full-stack, se auto-hostea fácil con Docker |
| Animaciones | GSAP | El rey de las animaciones web, sin rival |
| Estilos | Tailwind CSS | Rápido y flexible |
| Base de datos | SQLite (better-sqlite3) | Liviana, sin servidor, perfecta para uso personal |
| Música | YouTube IFrame Player API + YouTube Data API v3 | Gratis, 10k llamadas/día, más que suficiente |
| Despliegue | Docker + nginx en Oracle Cloud | Ya tenés Docker instalado |
| Contenedores | Docker + GitHub Container Registry (ghcr.io) | Imágenes versionadas, gratis con GitHub |
| CI | GitHub Actions | Tests + build automático en cada push |
| Control de versiones | Git + GitHub | Repositorio privado |

---

## ¿Qué va en la versión 1 (MVP)?

### SÍ entra en v1:
- Timer configurable (25 min trabajo / 5 min descanso corto / 15 min descanso largo)
- Animaciones GSAP en cada estado del timer
- Pegás la URL de tu playlist de YouTube → la app descarga las canciones y las cachea en SQLite
- Reproducción con controles propios (play/pausa/siguiente/anterior/volumen)
- Registro de sesiones de estudio completadas
- Dashboard con sesiones de hoy y de la semana
- Notificación del navegador + sonido cuando termina el pomodoro
- Docker listo para desplegar en Oracle

### NO entra en v1 (lo dejamos para después):
- Login / múltiples usuarios (es una app personal, no lo necesitás)
- Exportar datos a CSV
- PWA (app instalable en el celular)
- Spotify u otros servicios de música

---

## Cómo funciona el timer (la parte técnica importante)

El timer **NO usa `setInterval`** (que se rompe cuando el navegador duerme la pestaña). En cambio:
- Guarda el tiempo de fin exacto en `localStorage` (`endTime = Date.now() + duración`)
- Calcula el tiempo restante en cada frame: `restante = endTime - Date.now()`
- Si cerrás la pestaña y la volvés a abrir → el timer sigue desde donde estaba
- Si ponés el navegador en segundo plano → no pierde tiempo

---

## Cómo funciona la música de YouTube

1. Copiás la URL de tu playlist de YouTube Music (ej: `https://www.youtube.com/playlist?list=PLabc123`)
2. La pegás en la app
3. El servidor llama a la API de YouTube, descarga la lista de canciones y la guarda en SQLite
4. La cache dura 24 horas (después se actualiza sola)
5. La reproducción es un reproductor de YouTube **oculto**, con tus propios controles encima
6. Si no configurás la API key de YouTube → el timer y el tracking funcionan igual, solo se deshabilita la música y te muestra cómo configurarla

---

## Base de datos (4 tablas SQLite)

| Tabla | Qué guarda |
|-------|-----------|
| `user_settings` | Tus configuraciones (duración del pomodoro, etc.) |
| `sessions` | Cada sesión de estudio registrada |
| `playlists` | Tus playlists de YouTube |
| `tracks` | Las canciones de cada playlist |

---

## Animaciones GSAP planeadas

| Momento | Animación |
|---------|-----------|
| Arrancar timer | Ring aparece con efecto elástico + brillo |
| Timer corriendo | Ring se va llenando suavemente |
| Timer en pausa | Ring se hace punteado + efecto de respiración lento |
| Últimos 10 segundos | Color se satura + vibración sutil |
| Pomodoro completado | Explosión de partículas + confetti |
| Trabajo → Descanso | Color cambia de coral a verde menta, fondo se transforma |
| Dashboard al abrir | Las barras crecen desde abajo, los números suben animados |

---

## Despliegue en tu servidor Oracle

```
GitHub (repositorio privado)
    ├── push a main
    │       └── GitHub Actions CI
    │               ├── corre los tests (Vitest)
    │               ├── type-check (tsc --noEmit)
    │               ├── build Docker image
    │               └── push imagen a ghcr.io/tu-usuario/pomodoro:latest
    │
    └── (manual o automatizado) → Oracle Cloud VPS
            └── Docker
                ├── contenedor: app Next.js (puerto 4000)
                │       └── SQLite → /data/pomodoro.db (guardado en el host)
                └── contenedor: nginx (puerto 80)
                        └── redirige al contenedor en el puerto 4000
```

**Flujo de deploy:**
1. Hacés push a `main` en GitHub
2. GitHub Actions corre los tests y buildea la imagen Docker
3. Si todo pasa ✅ → la imagen se sube a GitHub Container Registry (`ghcr.io`)
4. En el server Oracle: `docker compose pull && docker compose up -d` — descarga la nueva imagen y reinicia

---

## GitHub Actions — Pipeline CI/CD completo

### Flujo por etapas (en cada push a `main`)

```
push a main
    │
    ▼
[Job 1: test]
    ├── npm ci
    ├── tsc --noEmit (type-check)
    └── npx vitest run
    │
    ▼ (solo si tests pasan)
[Job 2: build-and-push]
    ├── docker build (multi-stage)
    └── docker push → ghcr.io/tu-usuario/pomodoro:latest
    │
    ▼ (solo si el push fue exitoso)
[Job 3: deploy]
    ├── SSH al servidor Oracle Cloud
    ├── docker compose pull (descarga la imagen nueva)
    └── docker compose up -d (reinicia el contenedor)
```

En PRs solo corre **Job 1** (tests) — nunca deploya desde un PR.

### Secrets que tenés que cargar en GitHub

Ir a: Repositorio → Settings → Secrets and variables → Actions

| Secret | Qué es |
|--------|--------|
| `SSH_HOST` | IP pública de tu servidor Oracle |
| `SSH_USER` | Usuario SSH (generalmente `ubuntu` u `opc` en Oracle) |
| `SSH_PRIVATE_KEY` | Tu clave privada SSH (contenido del archivo `.pem` o `id_rsa`) |
| `GITHUB_TOKEN` | Automático — GitHub lo genera solo, no hay que configurarlo |

> El `GITHUB_TOKEN` lo usa Actions para hacer push a `ghcr.io` sin configuración extra.

---

## Plan de implementación (58 tareas en 14 fases)

### Fase 1: Configuración inicial del proyecto
- Crear proyecto Next.js con TypeScript + Tailwind
- Instalar dependencias (GSAP, SQLite, Vitest para tests)
- Configurar colores coral y verde menta en Tailwind
- Inicializar repositorio Git + subir a GitHub (privado)
- Crear `.github/workflows/ci.yml` — pipeline de GitHub Actions
- Crear `.gitignore` (Node, `.env`, `data/`, `.next/`)
- Crear `.env.example` documentado

### Fase 2: Capa de base de datos
- Singleton de conexión SQLite con HMR guard
- Migraciones automáticas al arrancar el servidor
- Queries para settings, sessions y playlists

### Fase 3: Motor del timer
- Estado del timer (idle → corriendo → pausa → completado → transición)
- Cálculo de tiempo restante con `Date.now()`
- Lógica del 50% para sesiones manuales (si estudiaste ≥50% del tiempo, se registra igual)

### Fase 4: Utilidades de YouTube
- Extracción del playlist ID de cualquier formato de URL de YouTube
- Cliente para la API de YouTube Data v3 con paginación

### Fase 5: Rutas de API (backend)
- `GET/PUT /api/settings` — configuración del timer
- `POST /api/sessions` — registrar sesión de estudio
- `GET /api/stats` — estadísticas del día y la semana
- `POST/GET /api/playlists` — gestión de playlists
- `GET /api/playlists/status` — si la API key está configurada

### Fase 6: Contextos y hooks de React
- `SettingsContext` — configuración global
- `TimerContext` + `useTimer` — el motor del timer con GSAP ticker
- `useSessionLogger` — registra sesiones automáticamente
- `useYouTubePlayer` — controla el IFrame de YouTube

### Fase 7: Componentes del timer (GSAP)
- `TimerRing` — el SVG circular con animación ticker-driven
- `TimerLabel` — MM:SS + tipo de sesión
- `TimerControls` — botones Start/Pause/Resume/Stop
- `SessionProgress` — puntitos que muestran cuántos pomodoros hiciste
- `Confetti` — partículas al completar

### Fase 8: Panel de música
- `YouTubePlayer` — IFrame oculto
- `PlayerControls` — controles personalizados
- `TrackList` — lista de canciones
- `PlaylistSwitcher` — switcher entre playlists + input para agregar
- `SetupGuide` — guía cuando no hay API key

### Fase 9: Dashboard
- `StatsCard` — tarjeta con sesiones/horas con animación count-up
- `WeeklyChart` — gráfico de barras SVG de los últimos 7 días
- Auto-actualización al completar un pomodoro

### Fase 10: Panel de configuración
- Formulario para cambiar duraciones + intervalo de descanso largo

### Fase 11: Página principal
- Layout responsive (dos columnas en desktop, apilado en tablet)
- Composición de todos los componentes

### Fase 12: Notificaciones y sonido
- Pedir permiso de notificaciones al primer Start
- Disparar notificación + chime al completar

### Fase 13: Docker y despliegue
- `Dockerfile` multi-stage
- `docker-compose.yml` con app + nginx
- `SETUP.md` con instrucciones para Oracle Cloud + API key de YouTube

### Fase 14: Integración y pulido final
- Test de ciclo completo
- Verificación manual de drift del timer
- Accesibilidad (aria-labels)
- Optimización de performance (sin re-renders a 60fps)

---

## Variables de entorno necesarias

```env
DB_PATH=/data/pomodoro.db       # dónde se guarda la base de datos (opcional)
YOUTUBE_API_KEY=tu_clave_aqui   # sin esto no funciona la música, el resto sí
PORT=4000                        # puerto del servidor (3000 está ocupado en tu server)
```

---

## Próximo paso

Cuando quieras arrancar con la implementación, corremos `/sdd-apply pomodoro-v1`.
Te recomiendo empezar por las Fases 1-3 (bootstrap + base de datos + motor del timer)
porque no tienen dependencias de React y se pueden testear solos.
