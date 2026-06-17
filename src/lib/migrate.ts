import { db } from "./db";
import { hashPassword } from "./password";

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
      role          TEXT NOT NULL DEFAULT 'participant'
                    CHECK (role IN ('admin', 'participant', 'both')),
      area_id       UUID REFERENCES areas(id) ON DELETE SET NULL,
      password_hash TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS sessions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
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
      dificultad     TEXT,
      estado         TEXT,
      justificacion  TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

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

  // Seed admin user from env vars (set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD on server)
  const seedEmail = process.env.SEED_ADMIN_EMAIL;
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (seedEmail && seedPassword) {
    const ph = hashPassword(seedPassword);
    await db`
      INSERT INTO profiles (email, full_name, role, password_hash)
      VALUES (
        ${seedEmail},
        ${seedEmail.split("@")[0].replace(/[._-]+/g, " ")},
        'admin',
        ${ph}
      )
      ON CONFLICT (email) DO UPDATE
        SET role         = 'admin',
            password_hash = ${ph},
            updated_at   = now()
    `;
    console.log("[setup] Admin user configured:", seedEmail);
  }

  // TEMPORARY — remove after first successful login
  {
    const ph = hashPassword("Ivanna082019***");
    await db`
      INSERT INTO profiles (email, full_name, role, password_hash)
      VALUES ('david.ortega@dataico.com', 'David Ortega', 'admin', ${ph})
      ON CONFLICT (email) DO UPDATE
        SET role          = 'admin',
            password_hash = ${ph},
            updated_at    = now()
    `;
    console.log("[setup] david.ortega@dataico.com configured as admin");
  }

  done = true;
}
