# PokeScanner – Pokémon Card Scanner

Escanea cartas Pokémon con tu cámara, identifícalas vía la API de TCG, consulta su **precio de mercado** y guárdalas en tu **colección** con tu propio precio. Además, desbloquea **logros** según el tamaño de tu colección.

>  **Video demo**: https://youtu.be/DjTDVlcddvs

> **Backend en**: https://github.com/Pozzzo/PokeTCG/tree/main/Codigos

---

##  Funcionalidades
- **Scanner**: abre la cámara/imagen subida, detecta la carta, busca en la **API de TCG** y valida coincidencias.
- **Precio de mercado**: muestra cotizaciones actuales y el rango de precios (cuando aplica).
- **Añadir a colección**: asigna tu **precio** y guarda la carta en tu colección personal.
- **Perfil & Logros**: visualiza tu progreso; hay **niveles** que se desbloquean según la cantidad de cartas guardadas.
- **Colección**: listado/galería de tus cartas guardadas con filtros básicos.
- **Settings**: preferencias de la app.
- **Donar**: enlace para apoyar el proyecto.
- **Login**: autenticación para sincronizar tu colección y logros.

---

##  Stack
- **Repo**: `Aniela13/PokeScanner`
- **Framework**: [Next.js](https://nextjs.org) (App Router) – creado con [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- **Estructura**: carpeta `src/` con rutas en `src/app`
- **Lenguaje**: TypeScript
- **UI**: React + `next/font` con [Geist](https://vercel.com/font)
- **Estado / Datos**: Hooks de React y fetch/SDK hacia API de TCG
- **Build/Dev**: Tooling de Next.js

---

##  Empezar (Local)
1. **Clona** el repo:
   ```bash
   git clone https://github.com/Aniela13/PokeScanner.git
   cd PokeScanner
   ```
2. **Crea `.env.local`** con tus credenciales (ver [Variables de entorno](#-variables-de-entorno))
3. **Instala dependencias**:
   ```bash
   npm install
   ```
4. **Inicia el servidor de desarrollo**:
   ```bash
   npm run dev
   # o
   yarn dev
   # o
   pnpm dev
   # o
   bun dev
   ```
5. Abre **http://localhost:3000** en tu navegador.

> En el video (https://youtu.be/DjTDVlcddvs) muestro el flujo y cómo correrlo en local.

---

##  Flujo del Frontend
**Navegación principal (menú):**
- **Scanner** (`/scanner`)
  1) Solicita permiso de **cámara**/ sube imagen de archivos.  
  2) Captura imagen y extrae pistas (nombre/edición/código) *(por OCR o selección manual según tu implementación)*.  
  3) Consulta **API de TCG** con esos datos.  
  4) Valida la carta y **muestra precio de mercado**.  
  5) Usuario ingresa **su precio** y pulsa **Guardar** → se persiste en **Colección**.
- **Perfil** (`/profile`)
  - Muestra **logros**/niveles según el **conteo de cartas** guardadas. Al alcanzar umbrales, se **desbloquean** medallas.
- **Colección** (`/collection`)
  - Listado de cartas guardadas (grid o tabla), con búsqueda/filtros básicos.
- **Settings** (`/settings`)
  - Preferencias (tema, idioma, etc.).
- **Donar** (`/donate`)
  - Enlace/CTA para apoyar el proyecto.
- **Login** (`/login`)
  - Autenticación (email/password, OAuth, etc.) para sincronizar colección y logros.

**Estructura de estados (sugerida):**
- `src/app` → páginas (App Router)
- `src/components` → UI compartida (Navbar, CardItem, BadgeLevel, etc.)
- `src/lib/tcg.ts` → cliente/helper para la API TCG (fetch, mapeos)
- Hooks:
  - `useScanner()` → cámara, resultado de búsqueda, precio.
  - `useCollection()` → CRUD de cartas guardadas.
  - `useProfile()` → niveles/insignias desde `collection.length`.
  - `useAuth()` → usuario/sesión.

**Flujo de datos:**
```
Cámara → (OCR/inputs) → Query a API TCG → Carta + Precio → Guardar en Colección → Actualiza Perfil/Logros
```

---

##  Rutas y archivos clave
- `src/app/page.tsx` – Home; enlaces a Scanner/Colección/Perfil.
- `src/app/scanner/page.tsx` – Vista principal del escáner.
- `src/app/collection/page.tsx` – Tu colección.
- `src/app/profile/page.tsx` – Perfil y logros.
- `src/app/settings/page.tsx` – Ajustes.
- `src/app/donate/page.tsx` – Donaciones.
- `src/app/login/page.tsx` – Login.
- `src/lib/tcg.ts` – Cliente para la API TCG (helpers de fetch, mapeo de respuestas, etc.).
- `src/components/` – UI compartida (Navbar, CardItem, BadgeLevel, etc.).

> Puedes empezar a editar en `src/app/page.tsx`. Next.js recarga **en caliente** mientras editas.

---

##  Deploy (Vercel)
La forma más sencilla es desplegar en **Vercel**:
1. Conecta tu repo
2. Añade las **variables de entorno** de producción
3. Haz deploy

Más info: [Next.js – Deploy en Vercel](https://nextjs.org/docs/app/building-your-application/deploying)

---
