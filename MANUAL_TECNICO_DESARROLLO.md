# 🛠 Manual Técnico de Desarrollo - Gemabit (v2.0)

Este documento es la referencia técnica definitiva para la aplicación **Gemabit**. Cubre la arquitectura, el esquema de base de datos detallado, los flujos de datos en tiempo real, la seguridad y guías paso a paso para la extensión del código.

---

## 1. Arquitectura del Sistema

Gemabit sigue una arquitectura **Serverless** utilizando el patrón **BaaS (Backend as a Service)**.

### Diagrama Conceptual
```
[Cliente: React PWA]  <-- WebSocket (Realtime) -->  [Supabase (PostgreSQL)]
       |                                                   |
    (REST API)                                        (Auth / Storage)
       |                                                   |
       +---------------------> [Supabase Edge] <-----------+
```

### Tecnologías Clave
*   **Frontend Core:** React 18 + TypeScript + Vite.
*   **Estilizado:** Tailwind CSS (Utility-first). Se utiliza un archivo de configuración extendido en `index.html` para animaciones personalizadas (`float`, `bounce-slow`).
*   **Estado:**
    *   **Global (Sesión/Perfil):** `Zustand` (`store/userStore.ts`). Persiste la sesión del usuario y reacciona a cambios en vivo.
    *   **Local (UI):** `useState` / `useMemo` para lógica efímera de componentes.
    *   **Remoto (Sincronización):** `Supabase Realtime` (Postgres Changes).
*   **Base de Datos:** PostgreSQL (alojado en Supabase).
*   **Autenticación:** Supabase Auth (Email/Password).

---

## 2. Estructura de Directorios y Responsabilidades

```bash
/src
├── /components
│   ├── /games            # Lógica encapsulada de cada minijuego.
│   │   ├── SentenceGame.tsx  # Drag & Drop de palabras.
│   │   ├── SortingGame.tsx   # Clasificación booleana.
│   │   └── ...
│   ├── Layout.tsx        # Wrapper principal. Maneja el Navbar, PWA Install prompt y Modal de Perfil.
│   ├── RoleSelector.tsx  # Punto de entrada (Auth). Maneja Login y Registro.
│   ├── StudentView.tsx   # Dashboard complejo del alumno (Lógica de canje, juegos, tareas).
│   ├── TeacherView.tsx   # Dashboard administrativo (CRUD alumnos, aprobación, reportes).
│   ├── ParentView.tsx    # Dashboard de padres (Solo lectura + validación hogar).
│   ├── TaskController.tsx # Componente atómico para visualizar/alternar estados de tareas.
│   └── TutorialModal.tsx # Onboarding visual.
├── /services
│   ├── supabaseClient.ts # Singleton de conexión.
│   ├── supabaseService.ts # CAPA DE SERVICIO (Crucial). Contiene todas las queries SQL.
│   └── soundService.ts    # Singleton para manejo de audio con caché (evita lag en móviles).
├── /store
│   └── userStore.ts      # Store de Zustand. Mantiene el objeto `currentUser` sincronizado.
├── /utils
│   ├── dateUtils.ts      # Lógica de semanas ISO ("2024-W32").
│   ├── gameUtils.ts      # Mapeo de tipos de juego a iconos/colores.
│   └── taskUtils.ts      # Mapeo de keys de tareas a iconos/colores.
├── /types.ts             # Definiciones de TypeScript (Interface Mirror de la DB).
├── App.tsx               # Router lógico y Listener Global de Auth/Realtime.
└── main.tsx              # Punto de montaje React.
```

---

## 3. Esquema de Base de Datos (PostgreSQL)

Para replicar el entorno, ejecuta el siguiente script SQL en el editor de Supabase.

### 3.1. Extensiones Necesarias
```sql
create extension if not exists "uuid-ossp";
```

### 3.2. Tablas Core

#### `profiles`
Almacena la información extendida del usuario. Se vincula 1:1 con `auth.users`.
```sql
create table profiles (
  id uuid references auth.users not null primary key,
  role text not null check (role in ('MAESTRA', 'PADRE', 'ALUMNO')),
  display_name text,
  username text, -- Usado para login simplificado (email: username@gemabit.app)
  avatar_url text, 
  status text default 'PENDING', -- Control de acceso (aprobación de maestra)
  balance int default 0, -- Saldo en MiniBits (Entero)
  xp int default 0, -- Experiencia (Futuras features)
  streak_weeks int default 0, -- Contador de racha para Super GemaBit
  link_code text, -- Código único de vinculación para padres
  linked_student_ids text[] default array[]::text[] -- Array de UUIDs para padres
);
```

#### `tasks`
Registro semanal de tareas. Se crean bajo demanda (lazy creation) cuando un usuario inicia sesión en una semana nueva.
```sql
create table tasks (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references profiles(id) on delete cascade,
  week_id text not null, -- Formato ISO: "YYYY-W##"
  type text check (type in ('SCHOOL', 'HOME')),
  status jsonb default '{}'::jsonb, -- JSONB para flexibilidad. Ej: {"HYGIENE": true, "READING": false}
  updated_at timestamptz default now()
);
-- Indice para búsquedas rápidas por semana
create index tasks_student_week_idx on tasks (student_id, week_id);
```

#### `transactions`
Log inmutable financiero (Libro Mayor).
```sql
create table transactions (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references profiles(id),
  amount int not null, -- Positivo (Ganancia) o Negativo (Gasto)
  description text,
  type text check (type in ('EARN', 'SPEND')),
  timestamp bigint -- Epoch time (Date.now()) para facilitar ordenamiento en JS
);
```

#### `quizzes`
Definición de minijuegos creados por la maestra.
```sql
create table quizzes (
  id uuid default uuid_generate_v4() primary key,
  type text check (type in ('TEXT', 'SENTENCE', 'SORTING', 'SECRET_WORD', 'INTRUDER')),
  question text,
  options text[], -- Usado en Trivia e Intruso
  correct_index int, -- Índice de la respuesta correcta en 'options'
  game_items jsonb, -- Estructura compleja para Sentence/Sorting
  reward int default 50,
  difficulty text default 'MEDIUM',
  assigned_to text default 'ALL', -- 'ALL' o UUID específico
  created_by text default 'TEACHER'
);
```

#### `quiz_results`
Registro de intentos y estado de cobro.
```sql
create table quiz_results (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references profiles(id),
  quiz_id uuid references quizzes(id) on delete set null,
  question_preview text, -- Snapshot por si se borra el quiz original
  score int, -- 1 (Éxito) o 0 (Fallo)
  earned int,
  status text default 'IN_BAG', -- Ciclo: IN_BAG -> PENDING -> APPROVED/REJECTED
  created_at bigint
);
```

#### `expense_requests`
Solicitudes de compra de premios reales.
```sql
create table expense_requests (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references profiles(id),
  amount int,
  description text,
  status text default 'PENDING',
  category text check (category in ('NEED', 'WANT')),
  sentiment text, -- Feedback emocional post-compra
  created_at bigint
);
```

#### `savings_goals`
Metas de ahorro personalizadas.
```sql
create table savings_goals (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references profiles(id),
  title text,
  target_amount int,
  current_amount int default 0,
  icon text,
  created_at bigint
);
```

#### `app_settings`
Configuración global (Singleton).
```sql
create table app_settings (
  key text primary key,
  value text
);
-- Inicialización
insert into app_settings (key, value) values ('registration_code', 'lazo123');
```

---

## 4. Seguridad (Row Level Security - RLS)

Para producción, es **crítico** activar RLS en Supabase. Aquí están las políticas recomendadas:

1.  **Profiles:**
    *   `SELECT`: Público (para que padres/maestras vean avatares).
    *   `UPDATE`: Solo el usuario dueño (`auth.uid() = id`) o usuarios con rol 'MAESTRA'.
2.  **Tasks:**
    *   `SELECT`: Público.
    *   `INSERT/UPDATE`:
        *   Si `type = 'SCHOOL'`: Solo 'MAESTRA'.
        *   Si `type = 'HOME'`: Solo 'PADRE' (vinculado) o el propio 'ALUMNO'.
3.  **Transactions/Balances:**
    *   Solo modificables vía funciones RPC (Stored Procedures) o por la Maestra para evitar trampas, aunque en esta versión MVP se maneja desde el cliente (`supabaseService.ts`). *Mejora futura: Mover lógica monetaria a Postgres Functions.*

---

## 5. Lógica de Negocio Detallada

### 5.1 Sistema de Tiempo (Semanas)
Se utiliza la función `getCurrentWeekId` (`utils/dateUtils.ts`) para calcular la semana ISO.
*   Formato: `2024-W35`.
*   Al cargar `StudentView`, se verifica si existen tareas para `week_id` actual. Si no, `supabaseService.getTasks` las crea (Lazy Initialization).

### 5.2 Ciclo de Vida del Arcade
El flujo de dinero en los juegos es indirecto para simular control financiero:
1.  **Juego:** Alumno gana -> Se crea registro `quiz_results` con status `IN_BAG`.
    *   *UI:* Se muestra en "Bolsa Actual" dentro del modal Arcade.
2.  **Cobro:** Alumno pulsa "COBRAR" -> `supabaseService.cashOutArcade` actualiza status a `PENDING`.
    *   *UI:* La bolsa vuelve a 0. Aparece notificación a la Maestra.
3.  **Aprobación:** Maestra revisa -> Aprueba -> Status pasa a `APPROVED` -> Se suma al `balance` del perfil -> Se crea registro en `transactions`.

### 5.3 Super GemaBit (Racha)
Lógica ubicada en `StudentView.tsx`:
*   El botón "Canjear" solo se activa si `student.streakWeeks >= 4`.
*   Al canjear:
    1.  Se llama a `supabaseService.exchangeSuperGemabit`.
    2.  Incrementa saldo +500.
    3.  Decrementa `streakWeeks` -4 (permitiendo acumular rachas largas, ej: 8 semanas -> canjea -> quedan 4).

### 5.4 Sincronización en Tiempo Real
En `App.tsx` y las vistas principales, se usa `supabaseService.subscribeToChanges`.
*   **Evento:** `postgres_changes` (INSERT, UPDATE, DELETE).
*   **Filtro:** Generalmente filtrado por `student_id` para evitar tráfico innecesario.
*   **Acción:** Al recibir evento, se llama a `loadData()` para refrescar el estado local y `updateUserFields` de Zustand para actualizar la UI global (Navbar, saldo).

---

## 6. Guía de Extensión

### ¿Cómo agregar un nuevo tipo de Juego?

1.  **Base de Datos:**
    *   Edita el check constraint de la tabla `quizzes` para aceptar el nuevo `TYPE`.
2.  **Frontend (Tipos):**
    *   Edita `types.ts`, agrega el tipo a `QuizType`.
3.  **Frontend (Componente de Juego):**
    *   Crea `components/games/NewGame.tsx`.
    *   Debe recibir `quiz` y llamar a `onComplete()` cuando el usuario gane.
4.  **Frontend (Integración):**
    *   En `StudentView.tsx` -> `renderActiveGame()`: Añadir el caso switch.
    *   En `utils/gameUtils.tsx`: Definir icono y colores para la UI.
5.  **Frontend (Panel Maestra):**
    *   En `TeacherView.tsx` -> Modal de creación: Añadir campos para configurar el nuevo juego (inputs que llenen `gameItems` o `options`).

### ¿Cómo agregar un nuevo tipo de Tarea?

1.  **Frontend (Tipos):**
    *   Edita `types.ts`, agrega la key a `SchoolTaskKey` o `HomeTaskKey`.
2.  **Frontend (Utils):**
    *   Edita `utils/taskUtils.tsx` para asignar un Icono y un Color a esa nueva key.
    *   Edita `services/supabaseService.ts` -> `TASK_NAMES` para la traducción legible.
3.  **Base de Datos:**
    *   No requiere cambios estructurales (es JSONB). Las nuevas tareas aparecerán automáticamente cuando se generen nuevos registros.

---

## 7. Despliegue (PWA)

### Configuración del Manifiesto
El archivo `manifest.json` y `sw.js` (Service Worker) en la raíz son esenciales.
*   **Icons:** Deben ser "maskable" para Android.
*   **Display:** `standalone` elimina la barra de URL del navegador.

### Instalación en iOS
iOS no soporta el prompt de instalación nativo (`beforeinstallprompt`).
*   **Solución:** `Layout.tsx` detecta si es iOS (`navigator.platform`) y muestra un modal personalizado con instrucciones ("Toca Compartir -> Añadir a Inicio").

### Build de Producción
1.  `npm run build` genera la carpeta `/dist`.
2.  Configura tu servidor web para redirigir todas las rutas a `index.html` (SPA Routing).
    *   *Vercel:* Usar `vercel.json` incluido.
    *   *Netlify:* Usar archivo `_redirects` (`/* /index.html 200`).

---

**Gemabit Engineering Team**
