import type { DatabaseSync } from "node:sqlite";

export interface Settings {
  id: number;
  work_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  long_break_interval: number;
  notification_sound_enabled: boolean;
}

type SettingsPatch = Partial<Omit<Settings, "id">>;

type RawRow = {
  id: number;
  work_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  long_break_interval: number;
  notification_sound_enabled: number;
};

function toSettings(row: RawRow): Settings {
  return {
    ...row,
    notification_sound_enabled: row.notification_sound_enabled === 1,
  };
}

export function getSettings(db: DatabaseSync): Settings {
  const row = db.prepare("SELECT * FROM settings WHERE id = 1").get() as RawRow;
  return toSettings(row);
}

export function upsertSettings(db: DatabaseSync, patch: SettingsPatch): Settings {
  const current = db
    .prepare("SELECT * FROM settings WHERE id = 1")
    .get() as RawRow;

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
        : current.notification_sound_enabled,
  };

  db.prepare(`
    UPDATE settings SET
      work_duration = ?,
      short_break_duration = ?,
      long_break_duration = ?,
      long_break_interval = ?,
      notification_sound_enabled = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).run(
    next.work_duration,
    next.short_break_duration,
    next.long_break_duration,
    next.long_break_interval,
    next.notification_sound_enabled
  );

  return toSettings({
    id: 1,
    ...next,
  });
}
