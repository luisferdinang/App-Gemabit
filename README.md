# 💎 Gemabit - Billetera Educativa Gamificada

**Gemabit** es una aplicación web progresiva (PWA) diseñada para fomentar la educación financiera y la responsabilidad en niños. Conecta el hogar y la escuela mediante un sistema de recompensas basado en una economía virtual (MiniBits y GemaBits).

![Gemabit Banner](https://i.ibb.co/kVhqQ0K9/gemabit.png)

## 🚀 Características Principales

### conomía Virtual
- **MiniBits (MB):** Moneda base ganada por tareas y juegos.
- **GemaBits (GB):** Moneda de alto valor (100 MB = 1 GB).
- **Billetera:** Los estudiantes pueden ver su saldo en tiempo real.

### 👥 Roles de Usuario
1.  **Maestra (Teacher):**
    - Administra la clase y aprueba nuevos registros.
    - Evalúa tareas escolares (Asistencia, Comportamiento, etc.).
    - Crea juegos educativos (Arcade).
    - Aprueba canjes de recompensas.
    - Visualiza informes de progreso.
2.  **Alumno (Student):**
    - Avatar personalizado (Robots).
    - Visualiza sus tareas diarias (Casa y Escuela).
    - Juega en el Arcade para ganar extra.
    - Genera códigos para vincular a sus padres.
3.  **Padre (Parent):**
    - Se vincula a sus hijos mediante código.
    - Valida el cumplimiento de tareas del hogar (Higiene, Lectura, etc.).
    - Monitorea el saldo y progreso de sus hijos.

### 🎮 Arcade Educativo
Módulo de minijuegos creados por la maestra para reforzar el aprendizaje:
- **Trivia (Texto):** Preguntas de opción múltiple.
- **Constructor de Frases:** Ordenar palabras para formar oraciones.
- **Clasificación:** Diferenciar entre "Necesidad" vs "Deseo".
- **Balanza Matemática:** Sumar monedas para alcanzar un precio objetivo.
- **Secuencias:** Ordenar pasos de un proceso.

### 🛠 Tecnología

- **Frontend:** React 18, Vite, TypeScript.
- **Estilos:** Tailwind CSS.
- **Iconos:** Lucide React.
- **Backend / DB:** Supabase (PostgreSQL, Auth, Realtime).
- **Sonidos:** Servicio de audio personalizado con caché.
- **PWA:** Service Worker y Manifiesto para instalación nativa.

---

## 📦 Instalación y Despliegue

### Requisitos Previos
- Node.js (v18 o superior).
- Una cuenta en [Supabase](https://supabase.com).

### 1. Clonar e Instalar
```bash
git clone <tu-repositorio>
cd gemabit
npm install
```

### 2. Configuración de Supabase
El proyecto utiliza Supabase como backend. Debes crear un proyecto en Supabase y ejecutar el siguiente script SQL en el **SQL Editor** para crear la estructura de base de datos necesaria:

```sql
-- 1. Tabla de Perfiles (Usuarios)
create table profiles (
  id uuid references auth.users not null primary key,
  role text not null check (role in ('MAESTRA', 'PADRE', 'ALUMNO')),
  display_name text,
  username text,
  avatar_url text,
  status text default 'PENDING',
  balance int default 0,
  xp int default 0,
  streak_weeks int default 0,
  link_code text,
  linked_student_ids text[] default array[]::text[]
);

-- 2. Tabla de Tareas
create table tasks (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references profiles(id) on delete cascade,
  week_id text not null,
  type text check (type in ('SCHOOL', 'HOME')),
  status jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 3. Tabla de Transacciones (Historial)
create table transactions (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references profiles(id),
  amount int,
  description text,
  type text,
  timestamp bigint
);

-- 4. Tabla de Juegos (Arcade)
create table quizzes (
  id uuid default uuid_generate_v4() primary key,
  type text,
  question text,
  options text[],
  correct_index int,
  game_items jsonb,
  target_value int,
  reward int,
  difficulty text,
  assigned_to text,
  created_by text
);

-- 5. Resultados de Juegos
create table quiz_results (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references profiles(id),
  quiz_id uuid references quizzes(id) on delete cascade,
  question_preview text,
  score int,
  earned int,
  status text default 'PENDING',
  created_at bigint
);

-- 6. Configuración de la App
create table app_settings (
  key text primary key,
  value text
);

-- Insertar código de registro por defecto
insert into app_settings (key, value) values ('registration_code', 'lazo123');
```

### 3. Conexión
Edita el archivo `services/supabaseClient.ts` con tus credenciales:

```typescript
const SUPABASE_URL = 'TU_URL_DE_SUPABASE';
const SUPABASE_ANON_KEY = 'TU_CLAVE_ANONIMA';
```
*(Nota: En producción, se recomienda usar variables de entorno `.env`)*.

### 4. Ejecutar
```bash
npm run dev
```

---

## 📖 Guía de Uso

### Registro Inicial
1.  **Código Especial:** Para registrarse, todos los usuarios necesitan el "Código Especial". Por defecto es `lazo123`. La maestra puede cambiarlo desde su panel de seguridad.
2.  **Aprobación:** Cuando un usuario se registra, queda en estado `PENDING`. La maestra debe ir a la pestaña **Solicitudes** para aprobar el ingreso.

### Flujo de Tareas
1.  La **Maestra** marca tareas de *Escuela* (Asistencia, Respeto, etc.). Esto suma +20 MB automáticamente.
2.  El **Padre** marca tareas de *Casa* (Higiene, Lectura, etc.). Esto suma +25 MB automáticamente.

### Flujo del Arcade
1.  La Maestra crea un juego en la pestaña **Juegos** (ej. "Ordenar la frase").
2.  El Alumno ve el juego en su "Zona Arcade", lo juega y gana MiniBits temporales en su bolsa.
3.  El Alumno pulsa "Cobrar".
4.  La Maestra recibe una solicitud en su pestaña **Solicitudes** y aprueba el pago real de los MiniBits.

---

## 📱 Estructura del Proyecto

```
/src
  /components
     Layout.tsx        # Estructura principal y Navbar
     RoleSelector.tsx  # Login y Registro
     StudentView.tsx   # Panel del Alumno + Lógica de Juegos
     TeacherView.tsx   # Panel de Maestra + Gestión
     ParentView.tsx    # Panel de Padres
     TaskController.tsx # Componente reutilizable de botones de tareas
  /services
     supabaseService.ts # Toda la lógica de base de datos
     soundService.ts    # Efectos de sonido
  /types.ts            # Definiciones de TypeScript
```

## 🎨 Créditos de Assets
- Avatares por [DiceBear](https://dicebear.com).
- Sonidos por [Mixkit](https://mixkit.co).
- Iconografía por [Lucide](https://lucide.dev).

---
Creado con ❤️ para la educación del futuro.
