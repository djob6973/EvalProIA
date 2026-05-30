# Lista de Funcionalidades a Probar — EvalPro

## Leyenda
- `[ ]` Pendiente
- `[x]` Aprobado
- `[!]` Fallo / Bug encontrado

---

## 1. Autenticación

- [ ] Login con credenciales válidas (admin)
- [ ] Login con credenciales válidas (participant)
- [ ] Login con credenciales incorrectas → mensaje de error
- [ ] Login con email inexistente → mensaje de error
- [ ] Redirección tras login: admin → `/dashboard`, participant → `/participant`
- [ ] Cierre de sesión → redirige a `/login`
- [ ] Recuperación de contraseña → correo enviado
- [ ] Acceso a ruta protegida sin sesión → redirige a `/login`
- [ ] Sesión persiste al recargar la página
- [ ] Cuenta eliminada mientras sesión activa → redirige a `/login`

---

## 2. Gestión de Usuarios (Admin)

- [ ] Listar usuarios existentes
- [ ] Crear usuario con rol `participant`
- [ ] Crear usuario con rol `admin`
- [ ] Crear usuario con rol `both`
- [ ] Crear usuario con email duplicado → error controlado
- [ ] Asignar área a un usuario
- [ ] Cambiar área de un usuario
- [ ] Eliminar usuario con confirmación
- [ ] Intentar eliminar el propio usuario activo → bloqueado
- [ ] Usuario eliminado no puede iniciar sesión

---

## 3. Gestión de Áreas (Admin)

- [ ] Listar áreas existentes
- [ ] Crear nueva área (nombre + descripción)
- [ ] Editar área existente
- [ ] Eliminar área sin usuarios asignados
- [ ] Eliminar área con usuarios asignados → validar comportamiento

---

## 4. Generación de Preguntas con IA

### Carga de Documentos
- [ ] Cargar archivo `.txt` → extrae texto correctamente
- [ ] Cargar archivo `.pdf` → extrae texto de texto seleccionable
- [ ] Cargar archivo `.pdf` con imágenes (OCR) → extrae texto vía gpt-4o
- [ ] Cargar archivo `.docx` → extrae texto correctamente
- [ ] Cargar archivo de formato no soportado → error controlado
- [ ] Cargar PDF de más de 50 páginas → comportamiento definido

### Generación
- [ ] Generar preguntas de selección única
- [ ] Generar preguntas de selección múltiple
- [ ] Generar preguntas de verdadero/falso
- [ ] Generar con distribución mixta de tipos
- [ ] Generar con dificultad `baja`
- [ ] Generar con dificultad `media`
- [ ] Generar con dificultad `alta`
- [ ] Generar más de 20 preguntas (batching) → todas generadas correctamente
- [ ] Generar con categoría personalizada
- [ ] Generación fallida por timeout → reintento automático
- [ ] Generación fallida por rate limit → reintento con backoff

### Revisión y Guardado
- [ ] Ver preguntas generadas antes de guardar
- [ ] Editar enunciado de pregunta generada
- [ ] Editar opciones de respuesta
- [ ] Editar respuesta correcta
- [ ] Guardar preguntas al banco general
- [ ] Guardar preguntas a una evaluación específica
- [ ] Confirmar preguntas guardadas aparecen en banco de preguntas

---

## 5. Banco de Preguntas

- [ ] Listar todas las preguntas del banco
- [ ] Filtrar por categoría
- [ ] Filtrar por dificultad
- [ ] Filtrar por tipo (única, múltiple, verdadero/falso)
- [ ] Filtrar por estado
- [ ] Paginación (10 por página, navegar páginas)
- [ ] Editar enunciado de pregunta inline
- [ ] Editar opciones de respuesta inline
- [ ] Cambiar respuesta correcta
- [ ] Editar contexto de pregunta
- [ ] Editar justificación
- [ ] Guardar cambios de edición
- [ ] Cancelar edición sin guardar

---

## 6. Gestión de Evaluaciones (Admin)

### Creación y Edición
- [ ] Crear evaluación con título y descripción
- [ ] Configurar número de preguntas
- [ ] Configurar dificultad
- [ ] Configurar límite de tiempo
- [ ] Configurar fecha de vencimiento
- [ ] Configurar intentos permitidos
- [ ] Asignar categorías de preguntas
- [ ] Asignar área a la evaluación
- [ ] Editar evaluación existente
- [ ] Eliminar evaluación (con confirmación)

### Asignación de Participantes
- [ ] Asignar participante directamente a la evaluación
- [ ] Quitar participante de la evaluación
- [ ] Evaluación asignada por área → todos los usuarios del área la ven

### Activación
- [ ] Activar evaluación → visible para participantes
- [ ] Desactivar evaluación → no visible para participantes
- [ ] Evaluación vencida (fecha pasada) → no disponible para tomar

### Resultados
- [ ] Ver resultados de una evaluación específica desde la vista admin

---

## 7. Toma de Evaluaciones (Participante)

### Disponibilidad
- [ ] Ver evaluaciones asignadas directamente
- [ ] Ver evaluaciones por área
- [ ] No ver evaluaciones inactivas
- [ ] No ver evaluaciones vencidas
- [ ] No ver evaluaciones de otra área no asignada

### Inicio y Flujo
- [ ] Iniciar evaluación por primera vez
- [ ] Preguntas aparecen en orden aleatorio
- [ ] Responder pregunta de selección única
- [ ] Responder pregunta de selección múltiple
- [ ] Responder pregunta de verdadero/falso
- [ ] Navegar entre preguntas (siguiente / anterior)
- [ ] Temporizador cuenta regresiva correctamente
- [ ] Tiempo agotado → evaluación se envía automáticamente

### Progreso
- [ ] Cerrar evaluación a mitad → progreso guardado
- [ ] Reanudar evaluación → carga respuestas previas y tiempo restante
- [ ] Las preguntas retoman el mismo orden al reanudar

### Envío y Resultado
- [ ] Enviar evaluación → calificación calculada correctamente
- [ ] Puntuación mostrada correctamente (0–100)
- [ ] Ver detalle de respuestas correctas e incorrectas
- [ ] Ver justificaciones de cada pregunta
- [ ] Evaluación completada no aparece como pendiente

---

## 8. Reglas de Calificación (Anti-Trampa)

- [ ] Selección exacta de todas las respuestas correctas → puntaje completo
- [ ] Selección parcial de respuestas correctas → crédito parcial
- [ ] Seleccionar todas las opciones (cuando no todas son correctas) → 0 puntos
- [ ] Seleccionar más opciones que correctas → 0 puntos
- [ ] Selección incorrecta (sin ninguna correcta) → 0 puntos
- [ ] Pregunta sin responder → 0 puntos
- [ ] Puntaje total = promedio ponderado de preguntas

---

## 9. Historial de Resultados (Participante)

- [ ] Ver historial de evaluaciones completadas
- [ ] Ordenar por fecha
- [ ] Ordenar por nombre de evaluación
- [ ] Ver detalle de resultado específico

---

## 10. Analytics y Dashboard (Admin)

### KPIs
- [ ] Total de evaluaciones mostrado correctamente
- [ ] Total de participantes correcto
- [ ] Total de resultados correcto
- [ ] Puntuación promedio calculada correctamente
- [ ] Tasa de completitud correcta

### Resultados Globales
- [ ] Ver todos los resultados de todos los participantes
- [ ] Filtrar resultados por área
- [ ] Filtrar resultados por usuario
- [ ] Filtrar resultados por año
- [ ] Histograma de distribución de puntajes
- [ ] Tabla de líderes (top performers)
- [ ] Gráfica de tendencias por semana

### Actividad
- [ ] Feed de actividad reciente muestra resultados
- [ ] Feed de actividad reciente muestra nuevas evaluaciones

---

## 11. Configuración del Sistema (Admin)

- [ ] Editar prompt personalizado de generación
- [ ] Cambiar modelo OpenAI (ej. gpt-4o-mini)
- [ ] Cambiar temperatura
- [ ] Cambiar max tokens
- [ ] Cambiar número de reintentos
- [ ] Configuración persiste al recargar la página
- [ ] Generación usa la configuración guardada

---

## 12. Seguridad y Control de Acceso

- [ ] Participante no puede acceder a `/dashboard`
- [ ] Participante no puede acceder a `/generate`
- [ ] Participante no puede acceder a `/users`
- [ ] Participante no puede acceder a `/evaluations`
- [ ] Participante no puede acceder a `/question-bank`
- [ ] Participante no puede acceder a `/areas`
- [ ] Participante no puede acceder a `/results` (globales)
- [ ] Admin puede acceder a todas las rutas
- [ ] Participante no puede tomar evaluación de otra área
- [ ] Participante no puede tomar evaluación no asignada directamente (si no coincide área)
- [ ] Usuario sin sesión no accede a ninguna ruta protegida
- [ ] API keys de OpenAI y Supabase service role no expuestas al cliente

---

## 13. Casos Borde

- [ ] Evaluación sin preguntas → comportamiento al intentar tomar
- [ ] Banco de preguntas vacío → generación y guardado
- [ ] Usuario sin área asignada → evaluaciones por área no visibles
- [ ] Evaluación con 0 participantes asignados
- [ ] Subir documento vacío → error controlado
- [ ] OpenAI no disponible → error controlado, sin crash
- [ ] Supabase no disponible → error controlado, sin crash
- [ ] Sesión expirada durante toma de evaluación → comportamiento definido
