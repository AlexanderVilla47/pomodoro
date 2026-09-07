import type postgres from "postgres";
import {
  resolvePreferences,
  type Preferences,
} from "@/lib/preferences";

type Sql = ReturnType<typeof postgres>;

export interface Settings {
  id: number;
  work_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  long_break_interval: number;
  notification_sound_enabled: boolean;
  /**
   * Ya resueltas: completas, con los defaults de código aplicados. Ningún
   * consumidor ve JSONB crudo ni tiene que decidir qué hacer con un campo
   * faltante — misma traducción que ya hacía `notification_sound_enabled`.
   */
  preferences: Preferences;
}

type SettingsPatch = Partial<Omit<Settings, "id" | "preferences">> & {
  /** Parcial: se MERGEA sobre lo guardado, nunca lo reemplaza. */
  preferences?: Partial<Preferences>;
};

type RawRow = {
  id: number;
  work_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  long_break_interval: number;
  notification_sound_enabled: number;
  preferences: unknown;
};

export async function getSettings(sql: Sql, userId: string): Promise<Settings> {
  await sql`INSERT INTO settings (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`;
  const [row] = await sql<[RawRow]>`SELECT * FROM settings WHERE user_id = ${userId}`;
  return {
    ...row,
    notification_sound_enabled: row.notification_sound_enabled === 1,
    preferences: resolvePreferences(row.preferences),
  };
}

export async function upsertSettings(sql: Sql, userId: string, patch: SettingsPatch): Promise<Settings> {
  const current = await getSettings(sql, userId);

  // ⚠️ MERGE, no reemplazo. Si esto pisara el objeto entero, apagar el journal
  // borraría la unidad configurada. Es superficial porque la forma es plana: si
  // algún día se anida, este comentario deja de ser cierto.
  const nextPreferences = resolvePreferences({
    ...current.preferences,
    ...(patch.preferences ?? {}),
  });

  const next = {
    work_duration: patch.work_duration ?? current.work_duration,
    short_break_duration: patch.short_break_duration ?? current.short_break_duration,
    long_break_duration: patch.long_break_duration ?? current.long_break_duration,
    long_break_interval: patch.long_break_interval ?? current.long_break_interval,
    notification_sound_enabled:
      patch.notification_sound_enabled !== undefined
        ? patch.notification_sound_enabled
          ? 1
          : 0
        : current.notification_sound_enabled
          ? 1
          : 0,
  };

  await sql`
    UPDATE settings SET
      work_duration = ${next.work_duration},
      short_break_duration = ${next.short_break_duration},
      long_break_duration = ${next.long_break_duration},
      long_break_interval = ${next.long_break_interval},
      notification_sound_enabled = ${next.notification_sound_enabled},
      preferences = ${JSON.stringify(nextPreferences)}::jsonb,
      updated_at = NOW()
    WHERE user_id = ${userId}
  `;

  return {
    id: current.id,
    ...next,
    notification_sound_enabled: next.notification_sound_enabled === 1,
    preferences: nextPreferences,
  };
}
