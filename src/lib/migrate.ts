import { db } from "./db";

let done = false;

export async function runMigrations(): Promise<void> {
  if (done) return;

  await db`
    CREATE TABLE IF NOT EXISTS areas (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS profiles (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT UNIQUE NOT NULL,
      full_name     TEXT,
      role          TEXT NOT NULL DEFAULT 'Pendiente',
      area_id       UUID REFERENCES areas(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Ensure role column accepts all current roles (idempotent)
  await db`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT DISTINCT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE con.conrelid = 'profiles'::regclass AND con.contype = 'c' AND att.attname = 'role'
      ) LOOP
        EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || quote_ident(r.conname);
      END LOOP;
      ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('super_admin','admin','supervisor','leader','participant','both','Pendiente'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  await db`
    CREATE TABLE IF NOT EXISTS evaluations (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title               TEXT NOT NULL,
      description         TEXT,
      created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
      area_id             UUID REFERENCES areas(id) ON DELETE SET NULL,
      activa              BOOLEAN NOT NULL DEFAULT true,
      tiempo_limite       INTEGER,
      intentos_permitidos INTEGER DEFAULT 1,
      categorias          JSONB,
      config              JSONB,
      fecha_vencimiento   TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS questions (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      evaluation_id  UUID REFERENCES evaluations(id) ON DELETE CASCADE,
      question_text  TEXT NOT NULL,
      options        JSONB NOT NULL,
      correct_answer TEXT NOT NULL,
      contexto       TEXT,
      categoria      TEXT,
      area           TEXT,
      dificultad     TEXT,
      estado         TEXT,
      justificacion  TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Idempotent for installs whose questions table predates the 'area' column
  await db`ALTER TABLE questions ADD COLUMN IF NOT EXISTS area TEXT`;

  await db`
    CREATE TABLE IF NOT EXISTS results (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
      score         FLOAT NOT NULL,
      answers       JSONB NOT NULL,
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS evaluation_participants (
      evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
      user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      PRIMARY KEY (evaluation_id, user_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS evaluation_progress (
      id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      evaluation_id          UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
      current_question_index INTEGER NOT NULL DEFAULT 0,
      answers                JSONB NOT NULL DEFAULT '{}',
      time_remaining         INTEGER,
      question_order         JSONB,
      started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, evaluation_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS system_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role   TEXT NOT NULL,
      module TEXT NOT NULL,
      level  TEXT NOT NULL DEFAULT 'none',
      PRIMARY KEY (role, module)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS role_capabilities (
      role       TEXT NOT NULL,
      capability TEXT NOT NULL,
      enabled    BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (role, capability)
    )
  `;

  // Always ensure super_admin has full access to every module (idempotent upsert)
  {
    const allMods = ['dashboard','users','areas','evaluations','question_bank','generate','results','settings','config','config.users','config.roles','config.org','config.brand','participant','my_history','foro'];
    const caps    = ['create_users','edit_users','delete_users','manage_areas','export_results','generate_ai','manage_config'];
    for (const m of allMods) {
      await db`INSERT INTO role_permissions (role, module, level) VALUES ('super_admin', ${m}, 'full')
               ON CONFLICT (role, module) DO UPDATE SET level = 'full'`;
    }
    for (const c of caps) {
      await db`INSERT INTO role_capabilities (role, capability, enabled) VALUES ('super_admin', ${c}, true)
               ON CONFLICT (role, capability) DO UPDATE SET enabled = true`;
    }
  }

  // Always ensure config sub-modules exist for all roles (idempotent — DO NOTHING preserves manual overrides)
  {
    const configSubMods = ['config.users','config.roles','config.org','config.brand'];
    const subDefaults = [
      { role: 'admin',       level: 'full' },
      { role: 'supervisor',  level: 'none' },
      { role: 'leader',      level: 'none' },
      { role: 'participant', level: 'none' },
    ];
    for (const m of configSubMods) {
      for (const r of subDefaults) {
        await db`INSERT INTO role_permissions (role, module, level) VALUES (${r.role}, ${m}, ${r.level}) ON CONFLICT DO NOTHING`;
      }
    }
  }

  // Ensure the 'foro' module has sane defaults for all roles (idempotent — DO NOTHING preserves manual overrides)
  {
    const foroDefaults = [
      { role: 'admin',       level: 'full'   },
      { role: 'supervisor',  level: 'editar' },
      { role: 'leader',      level: 'ver'    },
      { role: 'participant', level: 'ver'    },
    ];
    for (const r of foroDefaults) {
      await db`INSERT INTO role_permissions (role, module, level) VALUES (${r.role}, 'foro', ${r.level}) ON CONFLICT DO NOTHING`;
    }
  }

  // Seed default permissions for remaining roles once
  const [{ count: permCount }] = await db`SELECT COUNT(*) AS count FROM role_permissions WHERE role != 'super_admin'` as any[];
  if (parseInt(permCount) === 0) {
    const adminMods   = ['dashboard','users','areas','evaluations','question_bank','generate','results','settings','config'];
    const partMods    = ['participant','my_history'];
    const permSeeds: Array<{ role: string; module: string; level: string }> = [
      ...adminMods.map(m => ({ role: 'admin',       module: m, level: 'editar' })),
      ...partMods.map(m  => ({ role: 'admin',       module: m, level: 'ver'    })),
      ...['dashboard','evaluations','results'].map(m => ({ role: 'supervisor', module: m, level: 'editar' })),
      ...['users','areas','question_bank','participant','my_history'].map(m => ({ role: 'supervisor', module: m, level: 'ver' })),
      ...['generate','settings','config'].map(m => ({ role: 'supervisor', module: m, level: 'none' })),
      ...['dashboard','evaluations','results','participant','my_history'].map(m => ({ role: 'leader', module: m, level: 'ver' })),
      ...['users','areas','question_bank','generate','settings','config'].map(m => ({ role: 'leader', module: m, level: 'none' })),
      ...adminMods.map(m => ({ role: 'participant', module: m, level: 'none' })),
      ...partMods.map(m  => ({ role: 'participant', module: m, level: 'ver'  })),
    ];
    for (const s of permSeeds) {
      await db`INSERT INTO role_permissions (role, module, level) VALUES (${s.role}, ${s.module}, ${s.level}) ON CONFLICT DO NOTHING`;
    }

    const caps = ['create_users','edit_users','delete_users','manage_areas','export_results','generate_ai','manage_config'];
    const capSeeds: Array<{ role: string; capability: string; enabled: boolean }> = [
      ...caps.map(c => ({ role: 'admin',       capability: c, enabled: true  })),
      ...caps.map(c => ({ role: 'supervisor',  capability: c, enabled: c === 'export_results' })),
      ...caps.map(c => ({ role: 'leader',      capability: c, enabled: false })),
      ...caps.map(c => ({ role: 'participant', capability: c, enabled: false })),
    ];
    for (const s of capSeeds) {
      await db`INSERT INTO role_capabilities (role, capability, enabled) VALUES (${s.role}, ${s.capability}, ${s.enabled}) ON CONFLICT DO NOTHING`;
    }
  }

  await db`
    CREATE TABLE IF NOT EXISTS notifications (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      type       TEXT NOT NULL DEFAULT 'info',
      title      TEXT NOT NULL,
      body       TEXT,
      read       BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(user_id, read, created_at DESC)
  `;

  // One-time fix: capitalize existing names that were stored in lowercase
  await db`
    UPDATE profiles
    SET full_name = initcap(full_name)
    WHERE full_name IS NOT NULL
      AND full_name != initcap(full_name)
  `;

  // ── Foro ──────────────────────────────────────────────────────────────────
  await db`
    CREATE TABLE IF NOT EXISTS foro_articulos (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo       TEXT NOT NULL,
      contenido    TEXT NOT NULL,
      resumen      TEXT,
      autor_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      categoria    TEXT,
      etiquetas    JSONB NOT NULL DEFAULT '[]',
      estado       TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','publicado')),
      vistas       INTEGER NOT NULL DEFAULT 0,
      published_at TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_foro_articulos_estado ON foro_articulos(estado, published_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_foro_articulos_etiquetas ON foro_articulos USING GIN (etiquetas)`;

  await db`
    CREATE TABLE IF NOT EXISTS foro_adjuntos (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      articulo_id UUID NOT NULL REFERENCES foro_articulos(id) ON DELETE CASCADE,
      nombre      TEXT NOT NULL,
      tipo        TEXT NOT NULL,
      data_url    TEXT NOT NULL,
      tamano      INTEGER NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS foro_comentarios (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      articulo_id UUID NOT NULL REFERENCES foro_articulos(id) ON DELETE CASCADE,
      autor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      parent_id   UUID REFERENCES foro_comentarios(id) ON DELETE CASCADE,
      contenido   TEXT NOT NULL,
      mentions    JSONB NOT NULL DEFAULT '[]',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_foro_comentarios_articulo ON foro_comentarios(articulo_id, created_at)`;

  await db`
    CREATE TABLE IF NOT EXISTS foro_reacciones (
      comentario_id UUID NOT NULL REFERENCES foro_comentarios(id) ON DELETE CASCADE,
      user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (comentario_id, user_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS foro_vistas (
      articulo_id UUID NOT NULL REFERENCES foro_articulos(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (articulo_id, user_id)
    )
  `;

  done = true;
}
