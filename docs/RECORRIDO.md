# Tarjetero — del prototipo a producción

Este documento cuenta, **de principio a fin**, qué es este proyecto, con qué tecnologías se hizo,
cómo está organizado y **cómo se fue construyendo paso a paso**. Sirve como guía para entenderlo,
retomarlo o explicárselo a alguien.

---

## 1. Qué es Tarjetero

Una **app web para gestionar tarjetas de crédito y gastos en cuotas** (pensada para Argentina):

- Cargás tus **tarjetas** (límite, marca, color, banco emisor).
- Registrás **compras en cuotas** en varias monedas (ARS / USD / EUR) y vas **pagando/despagando cuotas**.
- Ves **deuda, disponible y % usado** por tarjeta, un **gráfico por categoría** y las **compras recientes**.
- Llevás **deudas personales** (préstamos que no son de una tarjeta).
- Calcula la **fecha de cierre y de vencimiento** de cada tarjeta.
- Es **multiusuario**: cada persona se registra y ve **solo sus datos** (aislados a nivel base de datos).

---

## 2. El punto de partida

1. Partimos de un **diseño en Claude Design** (`Tarjetero.dc.html`), un formato con plantillas propias
   (`<x-dc>`, bindings `{{ }}`) que solo corre dentro del editor de diseño.
2. Se **reimplementó como un prototipo funcional** en un solo archivo HTML + JS vanilla
   ([reference/prototype.html](../reference/prototype.html)): misma UI y **toda la lógica de negocio**
   (deuda, cuotas, conversión de monedas, categorías) con persistencia en `localStorage`.
3. Ese prototipo fue la **referencia visual y de lógica 1:1** para construir la app real.

---

## 3. El stack (y por qué)

| Capa | Elección | Motivo |
|------|----------|--------|
| Framework | **Next.js 16** (App Router) + React 19 + TypeScript | Front + back en un solo proyecto (Server Actions), deploy gratis en Vercel, gran comunidad. |
| Estilos | **Tailwind CSS v4** + tokens propios | Reutilizables y consistentes; portamos el look "glass/violeta" del prototipo. |
| Primitivos UI | **shadcn/ui** (sobre **Base UI**) | Dialog, Select, Input, Toast accesibles y editables. |
| Animaciones | **Motion** (Framer Motion) + CSS | Hover-lift, pop-in, transición de modales, reordenar listas. |
| Auth | **Supabase Auth** (email/contraseña) | Gratis e integrado con la DB. |
| Base de datos | **Supabase Postgres** | Datos relacionales (usuario → tarjetas → compras / deudas). |
| Esquema/migraciones | **Drizzle ORM** | Esquema tipado en TS + `db:push`. |
| Aislamiento | **Row Level Security (RLS)** | Cada usuario solo accede a sus filas, garantizado por la DB. |
| Validación | **Zod** | Un esquema compartido entre formulario y servidor. |
| Deploy | **Vercel** + **Supabase** | Free tier + redeploy automático desde GitHub. |

---

## 4. Arquitectura (estructura del código)

```
src/
├─ app/
│  ├─ layout.tsx            # fuente Plus Jakarta Sans, metadata, <html lang="es">
│  ├─ page.tsx              # ruta protegida: lee sesión + getAppData(user.id) → <TarjeteroApp/>
│  ├─ globals.css           # tokens de diseño, glass, animaciones, clases de formulario
│  ├─ actions.ts            # Server Actions (crear/editar/borrar, pagar cuotas, rates, cierre)
│  ├─ login/page.tsx        # login + registro (Supabase)
│  └─ auth/signout/route.ts # cerrar sesión
├─ proxy.ts                 # (ex "middleware", Next 16) refresca sesión + protege rutas
├─ db/
│  ├─ schema.ts             # tablas Drizzle: profiles, cards, purchases, debts
│  └─ index.ts              # cliente Postgres (pooler, prepare:false)
├─ lib/
│  ├─ types.ts              # tipos de dominio (Card, Purchase, Debt, Rates…)
│  ├─ calc.ts               # lógica pura: deuda, cuotas, conversión, categorías, donut
│  ├─ store.ts              # reducer puro (mutaciones de estado)
│  ├─ schemas.ts            # validaciones Zod
│  ├─ closing.ts            # fechas de cierre/vencimiento + feriados AR + días hábiles
│  ├─ banks.ts              # catálogo de bancos → preset de regla de cierre
│  ├─ data.ts               # getAppData(userId): lee la DB y mapea a tipos de dominio
│  ├─ id.ts / mock.ts       # helpers
│  └─ supabase/             # clientes Supabase (browser / server / proxy)
├─ components/
│  ├─ tarjetero/            # UI de la app (AppShell, Sidebar, Dashboard, CardDetail, modales…)
│  └─ ui/                   # componentes shadcn (dialog, select, input, sonner…)
└─ ...
drizzle.config.ts           # config de migraciones (lee .env.local)
supabase/rls.sql            # políticas RLS + FKs a auth.users + trigger de perfil
.env.local.example          # variables necesarias (se copian a .env.local / Vercel)
```

**Idea clave de la arquitectura:** la **lógica de negocio es pura** (`calc.ts`, `store.ts`,
`closing.ts`) y está **testeada**; la UI y la base de datos son "cáscaras" alrededor. Por eso pudimos
pasar de `localStorage` a Postgres **sin reescribir la lógica**.

---

## 5. El recorrido paso a paso

### Fase 0 — Scaffolding
`create-next-app` (TS + Tailwind + App Router), repo en GitHub, e instalación de dependencias base.
El prototipo se guardó en `reference/prototype.html`.

### Fase 1 — Design system
Tokens de color/gradiente/"glass", fuente Plus Jakarta Sans, animaciones (blobs, pop-in) y los
componentes visuales (`AppShell`, `Sidebar`, `CreditCardVisual`, `StatTile`, `DonutChart`,
`ProgressBar`). Dashboard estático armado desde datos de ejemplo.

### Fase 2 — Paridad de features con estado local
Las 3 vistas (Dashboard / Detalle / Deudas) y los 4 modales, ya **interactivos** con `useState` +
un **reducer puro** (`store.ts`), validación **Zod** y animaciones **Motion**. La lógica del
prototipo se portó a `calc.ts` con **tests unitarios**. Persistencia temporal en `localStorage`.

### Fase 3 — Base de datos (Supabase + Drizzle + RLS)
Esquema en `db/schema.ts`, tablas creadas con `npm run db:push`, y `supabase/rls.sql` con las
**políticas RLS por `user_id`**, las FK a `auth.users` y un **trigger** que crea el perfil al
registrarse.

### Fase 4 — Autenticación
Clientes de Supabase (`lib/supabase/*`), `proxy.ts` que **refresca la sesión y protege las rutas**,
página `/login` (registro + inicio de sesión) y logout. `/` quedó protegida (sin sesión → `/login`).

### Fase 5 — Conectar datos reales
Se reemplazó `localStorage` por:
- **`getAppData(userId)`** (lectura por usuario en el Server Component `page.tsx`).
- **Server Actions** (`app/actions.ts`) para cada mutación, con auth + Zod + filtrado por `user_id`.
- **UI optimista** (`useOptimistic` + el mismo reducer) para que pagar/agregar se sienta instantáneo.
Se verificó el **aislamiento RLS** con dos usuarios reales (uno no puede leer/escribir datos del otro).

### Iteración — Pulido de UI
Se reemplazó el `<select>` nativo por un **`TjSelect`** estilado (combina con el diseño) y se
sumaron **hovers/animaciones** (CTAs que se elevan, tiles que flotan, filas que se resaltan, feedback
de "press", respeto por `prefers-reduced-motion`).

### Feature — Fechas de cierre y vencimiento
A partir de **resúmenes reales** (BBVA, Patagonia, Ualá, Sucrédito) se detectaron los patrones y se
construyó `lib/closing.ts` (ver sección 6). Cada tarjeta puede configurar su ciclo; se muestra el
**próximo cierre / vencimiento** y se puede **reajustar**.

### Fase 7 — Deploy a Vercel
Import del repo de GitHub, carga de variables de entorno y deploy. Cada `git push` a `main`
redepliega automático. (Ver sección 8 y 9.)

---

## 6. Cómo funciona la lógica clave

### Deuda / disponible (`calc.ts`)
- Cada compra en cuotas compromete su parte **no pagada**: `deudaCompra = total × (cuotas − pagadas) / cuotas`.
- Por tarjeta: `deuda = Σ deudas de sus compras`, `disponible = límite − deuda`, `% usado = deuda / límite`.
- Todo se convierte a **ARS** usando los tipos de cambio del perfil.

### Fechas de cierre (`closing.ts`) — el hallazgo
Analizando los resúmenes encontramos **dos patrones**:
- **BBVA Francés y Banco Patagonia:** cierran **siempre el mismo día de semana (jueves)**, alternando
  **+28 / +35 días**. Por eso "se corren" del calendario. Se modela con una **fecha ancla + alternancia**.
- **Ualá:** **día fijo 30**, movido al **hábil anterior** si cae finde/feriado. **Sucrédito:** día fijo
  del calendario. Se modela como **`fixed_day`** (con o sin ajuste a día hábil).

`closing.ts` incluye un **calendario de feriados AR**, cálculo de **días hábiles**, y predice el
**próximo cierre** y el **vencimiento** (`cierre + N días`, movido a hábil siguiente). Como puede
haber corrimientos, la fecha es **editable y se re-ancla**.

### Seguridad (RLS)
Aunque el código ya filtra por `user_id`, las **políticas RLS** en Postgres son la red de seguridad
real: un usuario **no puede** leer ni escribir filas de otro, aunque hubiera un bug en el código.

---

## 7. Cómo correrlo localmente

```bash
npm install
# crear .env.local a partir de .env.local.example (claves de Supabase)
npm run db:push        # crea/actualiza las tablas en Supabase
# (una vez) pegar supabase/rls.sql en el SQL Editor de Supabase
npm run dev            # http://localhost:3000
npm run test           # tests unitarios (calc, store, closing)
npm run build          # build de producción
```

Variables necesarias (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`DATABASE_URL` (pooler 6543), `DIRECT_URL` (para migraciones).

---

## 8. Cómo se despliega (Vercel)

1. `git push` a `main`.
2. Vercel → Import del repo → detecta Next.js.
3. Cargar en **Environment Variables** (Production): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`. Cada una: **Key** = nombre, **Value** = solo el
   valor (sin comillas, sin prefijo, sin espacios).
4. En Supabase → Authentication → URL Configuration: setear **Site URL** y **Redirect URLs** con el
   dominio de Vercel.
5. Deploy. Cada push futuro a `main` redepliega solo.

---

## 9. Problemas que aparecieron y cómo se resolvieron (lecciones)

- **Turbopack crasheaba (`FATAL panic`)**: era por un **espacio en la ruta de la carpeta**. Se
  renombró la carpeta (sin espacios) y se solucionó.
- **`middleware` deprecado en Next 16**: se renombró a **`proxy.ts`** (misma función).
- **No conectaba a la DB (`password authentication failed`)**: la contraseña en la URL tenía
  **corchetes `[ ]`** heredados del placeholder `[YOUR-PASSWORD]`. Se quitaron.
- **Build de Vercel fallaba con `ERR_INVALID_URL` / "Failed to collect page data for /"**: la variable
  `DATABASE_URL` en Vercel tenía un **valor inválido** (comillas / prefijo / espacio). El cliente de
  DB se crea al importar el módulo, y ese import ocurre durante el build → si la URL es inválida,
  el build cae. Se arregla dejando el **Value limpio** y haciendo **Redeploy**.
- **Confirmación de email**: se **desactivó en Supabase** para probar en desarrollo (el registro
  entra directo); en **producción conviene reactivarla** (con el Site URL bien configurado).

**Ideas para recordar:**
- El `.env.local` no se sube; las variables van en el panel del hosting, y **el formato importa**.
- El código a nivel de módulo **se ejecuta al importar** (también en el build).
- Mantener la **lógica de negocio pura y testeada** permite cambiar la UI o la base de datos sin
  reescribirla.

---

## 10. Estado actual y próximos pasos

**Hecho:** app multiusuario funcionando con Supabase (auth + datos por usuario + RLS), diseño premium
con animaciones, cálculo de deuda/cuotas/categorías, y fechas de cierre por tarjeta. Tests en verde.

**Próximos pasos posibles:**
- Terminar el deploy en Vercel (arreglar env + reactivar confirmación de email).
- Confirmar más bancos en el catálogo de cierres con resúmenes reales.
- (Futuro) leer resúmenes por email para autocompletar fechas; PWA instalable; más gráficos.
