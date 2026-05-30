# EvalPro — Plataforma de Evaluaciones con IA

## Descripción

EvalPro es una plataforma web empresarial que permite crear, gestionar y aplicar evaluaciones de conocimiento generadas con inteligencia artificial. Los administradores cargan documentos (PDF, DOCX, TXT) y la IA genera automáticamente bancos de preguntas calibradas. Los participantes toman las evaluaciones en línea y los resultados se analizan en dashboards de analítica.

## Objetivo

Automatizar el proceso de creación de evaluaciones de conocimiento a partir de material existente (manuales, procedimientos, contenidos de capacitación), eliminando la elaboración manual de preguntas y centralizando la gestión de evaluaciones y resultados en una sola herramienta.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | TanStack Start (React 19 + SSR) |
| Enrutamiento | TanStack Router |
| Base de datos / Auth | Supabase (PostgreSQL + RLS) |
| IA — generación | OpenAI gpt-4o-mini |
| IA — OCR imágenes | OpenAI gpt-4o vision |
| Extracción PDF | pdfjs-dist |
| Extracción DOCX | mammoth |
| UI | Tailwind CSS 4 + Radix UI |
| Gráficas | Recharts |
| Deploy | Dokku (Node.js) |

---

## Roles de Usuario

| Rol | Acceso |
|---|---|
| **admin** | Dashboard, gestión de evaluaciones, generación IA, banco de preguntas, usuarios, áreas, resultados globales |
| **participant** | Tomar evaluaciones asignadas, ver historial de resultados propios |
| **both** | Acceso completo de admin + puede tomar evaluaciones como participante |

---

## Funcionalidades Principales

### 1. Autenticación
- Login con email/contraseña vía Supabase Auth
- Recuperación de contraseña por correo
- Redirección automática según rol al iniciar sesión
- Protección de rutas con guard de sesión

### 2. Generación de Preguntas con IA
- Carga de documentos: PDF (hasta 50 páginas), DOCX, TXT
- Extracción de texto con OCR para imágenes vía gpt-4o
- Configuración de generación: número de preguntas, dificultad, categoría, distribución de tipos
- Tipos de pregunta: selección única, selección múltiple, verdadero/falso
- Revisión y edición de preguntas antes de guardar
- Importación masiva al banco de preguntas o a una evaluación específica

### 3. Gestión de Evaluaciones (Admin)
- CRUD completo de evaluaciones
- Configuración: límite de tiempo, fecha de vencimiento, intentos permitidos, número de preguntas, dificultad
- Asignación de participantes: directa (por usuario) o por área
- Activar/desactivar evaluaciones
- Ver resultados de cada evaluación

### 4. Banco de Preguntas
- Repositorio centralizado de todas las preguntas
- Filtros: categoría, dificultad, tipo, estado
- Edición inline: enunciado, opciones, respuesta correcta, contexto, justificación
- Paginación (10 por página)

### 5. Gestión de Usuarios (Admin)
- Crear usuarios con asignación de rol
- Asignar usuarios a áreas
- Eliminar usuarios (con confirmación)
- Prevención de auto-eliminación del administrador activo

### 6. Gestión de Áreas (Admin)
- Crear/editar/eliminar áreas organizacionales
- Asignar evaluaciones a áreas (asignación masiva de participantes)

### 7. Toma de Evaluaciones (Participante)
- Listado de evaluaciones disponibles (directas + por área)
- Reanudar evaluaciones en progreso
- Orden de preguntas aleatorizado (Fisher-Yates)
- Temporizador con tiempo restante
- Auto-guardado de progreso
- Tipos de pregunta: única, múltiple, verdadero/falso

### 8. Resultados y Analítica
- Calificación automática con reglas anti-trampa:
  - Seleccionar todas las opciones cuando no todas son correctas → 0 puntos
  - Seleccionar más opciones que respuestas correctas → 0 puntos
  - Crédito parcial si se seleccionan algunas correctas
  - Crédito completo solo con selección exacta
- Vista detallada del resultado para el participante (respuestas correctas + justificaciones)
- Historial personal de resultados
- Dashboard admin: KPIs, distribución de puntajes, tabla de líderes, tendencias semanales
- Filtros de resultados: por área, usuario, año

### 9. Configuración del Sistema (Admin)
- Prompt personalizado para generación de preguntas
- Configuración del modelo OpenAI: modelo, temperatura, max tokens, reintentos
- Almacenado en localStorage del navegador

---

## Modo de Uso

### Instalación

```bash
# Requisitos: Node.js 22.12+
npm install
```

### Variables de Entorno

Crear archivo `.env` en la raíz con:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-secreta
OPENAI_API_KEY=tu-openai-api-key
```

### Desarrollo

```bash
npm run dev
# La app corre en http://localhost:3000
```

### Producción

```bash
npm run build
npm start
```

### Base de Datos

Ejecutar los archivos `.sql` en Supabase SQL Editor en orden:
1. Esquema principal (tablas, RLS)
2. Migraciones de `fix-*.sql`

---

## Flujo de Trabajo Típico

### Administrador

1. Iniciar sesión → Dashboard con KPIs
2. **Áreas** → Crear áreas organizacionales
3. **Usuarios** → Crear participantes y asignarles área
4. **Generar** → Cargar documento → Configurar parámetros → Generar preguntas con IA → Revisar → Guardar al banco
5. **Evaluaciones** → Crear evaluación → Asignar participantes o área → Activar
6. **Resultados** → Ver puntajes, distribución, tendencias

### Participante

1. Iniciar sesión → Ver evaluaciones disponibles
2. Seleccionar evaluación → Iniciar
3. Responder preguntas en el tiempo asignado
4. Enviar → Ver puntaje y retroalimentación
5. **Historial** → Revisar resultados anteriores

---

## Arquitectura de Datos

```
auth.users (Supabase)
    └── profiles (rol, área)
            └── evaluation_participants (asignación directa)

evaluations
    ├── questions (banco de preguntas)
    ├── results (puntajes por usuario)
    └── evaluation_progress (estado en curso)

areas
    └── profiles (usuario pertenece a área)
```

---

## Seguridad

- Row-Level Security (RLS) en todas las tablas de Supabase
- Service role key solo en servidor (nunca expuesta al cliente)
- Server functions de TanStack para operaciones privilegiadas
- Validación de autorización antes de operaciones admin
- Prevención de eliminación propia en gestión de usuarios
