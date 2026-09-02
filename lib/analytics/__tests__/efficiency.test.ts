import { describe, it, expect } from "vitest";
import {
  minutesPerChunk,
  weightedAverage,
  studyDays,
  blocksPerStudyDay,
  distractionsPerHour,
  summarize,
  groupByPeriod,
  compare,
  byLabel,
  type EfficiencyRow,
} from "../efficiency";

/** Fila cruda de la query, con defaults para no repetir lo que no importa. */
function row(partial: Partial<EfficiencyRow> & { day: string }): EfficiencyRow {
  return {
    label_id: null,
    label_name: null,
    label_color: null,
    total_seconds: 0,
    total_chunks: 0,
    sessions: 0,
    distractions: 0,
    ...partial,
  };
}

describe("minutesPerChunk", () => {
  it("divide los minutos por la cantidad de chunks", () => {
    // 25 min en 2 chunks -> 12.5 min/chunk
    expect(minutesPerChunk(1500, 2)).toBe(12.5);
  });

  it("redondea a un decimal", () => {
    // 1500 / 60 / 3 = 8.333...
    expect(minutesPerChunk(1500, 3)).toBe(8.3);
  });

  it("soporta chunks decimales", () => {
    // 25 min en medio chunk -> 50 min/chunk
    expect(minutesPerChunk(1500, 0.5)).toBe(50);
  });

  it("retorna null con 0 chunks en vez de dividir por cero", () => {
    expect(minutesPerChunk(1500, 0)).toBeNull();
  });

  it("retorna null con chunks negativos", () => {
    expect(minutesPerChunk(1500, -2)).toBeNull();
  });

  it("retorna null si los chunks no son un número finito", () => {
    expect(minutesPerChunk(1500, NaN)).toBeNull();
    expect(minutesPerChunk(1500, Infinity)).toBeNull();
  });

  it("retorna null si los segundos no son válidos", () => {
    expect(minutesPerChunk(NaN, 2)).toBeNull();
    expect(minutesPerChunk(-100, 2)).toBeNull();
  });

  it("una sesión de 0 segundos da 0, no null", () => {
    expect(minutesPerChunk(0, 2)).toBe(0);
  });
});

describe("weightedAverage", () => {
  it("suma primero y divide después, no promedia promedios", () => {
    // Un día largo y eficiente (10 min/bloque) y uno corto e ineficiente
    // (30 min/bloque). Promediar los promedios daría 20: le da el mismo peso
    // a un día de 10 bloques que a uno de 1. Lo correcto pondera por bloques.
    // (6000 + 1800) / (10 + 1) = 7800s / 11 bloques = 11.8 min/bloque
    const rows = [
      row({ day: "2026-08-17", total_seconds: 6000, total_chunks: 10 }),
      row({ day: "2026-08-18", total_seconds: 1800, total_chunks: 1 }),
    ];
    expect(weightedAverage(rows)).toBe(11.8);
  });

  it("retorna null con una serie vacía", () => {
    expect(weightedAverage([])).toBeNull();
  });

  it("retorna null si no hay ningún bloque cargado", () => {
    const rows = [row({ day: "2026-08-17", total_seconds: 3000, total_chunks: 0 })];
    expect(weightedAverage(rows)).toBeNull();
  });
});

describe("studyDays", () => {
  it("cuenta los días distintos con estudio", () => {
    const rows = [
      row({ day: "2026-08-17", total_chunks: 3 }),
      row({ day: "2026-08-19", total_chunks: 2 }),
    ];
    expect(studyDays(rows)).toBe(2);
  });

  it("un día con dos materias cuenta como UN día", () => {
    // La query devuelve una fila por día + materia: estudiar dos materias el
    // mismo día son dos filas, pero fue un solo día de estudio.
    const rows = [
      row({ day: "2026-08-17", label_id: 1, total_chunks: 3 }),
      row({ day: "2026-08-17", label_id: 2, total_chunks: 2 }),
    ];
    expect(studyDays(rows)).toBe(1);
  });

  it("ignora los días sin bloques cargados", () => {
    const rows = [
      row({ day: "2026-08-17", total_chunks: 3 }),
      row({ day: "2026-08-18", total_chunks: 0 }),
    ];
    expect(studyDays(rows)).toBe(1);
  });

  it("una serie vacía da 0", () => {
    expect(studyDays([])).toBe(0);
  });
});

describe("blocksPerStudyDay", () => {
  it("divide por los días CON estudio, no por los del calendario", () => {
    // 12 bloques repartidos en 3 días de una semana de 7.
    // Por días de calendario daría 1.7; por días con estudio, 4.
    const rows = [
      row({ day: "2026-08-17", total_chunks: 5 }),
      row({ day: "2026-08-19", total_chunks: 4 }),
      row({ day: "2026-08-20", total_chunks: 3 }),
    ];
    expect(blocksPerStudyDay(rows)).toBe(4);
  });

  it("un día con dos materias no infla el denominador", () => {
    const rows = [
      row({ day: "2026-08-17", label_id: 1, total_chunks: 3 }),
      row({ day: "2026-08-17", label_id: 2, total_chunks: 2 }),
    ];
    expect(blocksPerStudyDay(rows)).toBe(5);
  });

  it("redondea a un decimal", () => {
    const rows = [
      row({ day: "2026-08-17", total_chunks: 2 }),
      row({ day: "2026-08-18", total_chunks: 3 }),
      row({ day: "2026-08-19", total_chunks: 3 }),
    ];
    // 8 / 3 = 2.666...
    expect(blocksPerStudyDay(rows)).toBe(2.7);
  });

  it("retorna null sin días de estudio", () => {
    expect(blocksPerStudyDay([])).toBeNull();
    expect(blocksPerStudyDay([row({ day: "2026-08-17", total_chunks: 0 })])).toBeNull();
  });
});

describe("distractionsPerHour", () => {
  it("normaliza las distracciones por tiempo estudiado", () => {
    // 2 horas, 3 cortes -> 1.5 cortes/hora
    const rows = [row({ day: "2026-08-17", total_seconds: 7200, total_chunks: 4, distractions: 3 })];
    expect(distractionsPerHour(rows)).toBe(1.5);
  });

  it("suma a lo largo de la serie antes de dividir", () => {
    const rows = [
      row({ day: "2026-08-17", total_seconds: 3600, total_chunks: 2, distractions: 2 }),
      row({ day: "2026-08-18", total_seconds: 3600, total_chunks: 2, distractions: 1 }),
    ];
    expect(distractionsPerHour(rows)).toBe(1.5);
  });

  it("cero distracciones da 0, no null", () => {
    // Concentrarse perfecto es un dato, no un dato faltante.
    const rows = [row({ day: "2026-08-17", total_seconds: 3600, total_chunks: 2, distractions: 0 })];
    expect(distractionsPerHour(rows)).toBe(0);
  });

  it("retorna null sin tiempo estudiado", () => {
    expect(distractionsPerHour([])).toBeNull();
    expect(
      distractionsPerHour([row({ day: "2026-08-17", total_seconds: 0, distractions: 2 })])
    ).toBeNull();
  });

  it("no extrapola una muestra diminuta: 2 cortes en 1 minuto NO son 120/hora", () => {
    // El caso real que motivo el piso. La cuenta 2 / (60/3600) = 120 es
    // correcta, pero llevar un minuto a una hora multiplica por 60 y
    // convierte el ruido en titular.
    const rows = [row({ day: "2026-08-17", total_seconds: 60, total_chunks: 1, distractions: 2 })];
    expect(distractionsPerHour(rows)).toBeNull();
  });

  it("justo en el piso de 15 minutos ya devuelve el numero", () => {
    // 900s = 15 min, 1 corte -> 4 cortes/hora
    const rows = [row({ day: "2026-08-17", total_seconds: 900, total_chunks: 2, distractions: 1 })];
    expect(distractionsPerHour(rows)).toBe(4);
  });

  it("un pomodoro completo de 25 minutos pasa el piso", () => {
    // El default de work_duration es 1500s. Un piso que escondiera una sesion
    // entera taparia el caso mas comun de todos.
    const rows = [row({ day: "2026-08-17", total_seconds: 1500, total_chunks: 2, distractions: 1 })];
    expect(distractionsPerHour(rows)).toBe(2.4);
  });

  it("suma a lo largo del periodo antes de aplicar el piso", () => {
    // Tres sesiones cortas que solas no llegarian, pero juntas si: el piso es
    // del periodo, no de cada sesion.
    const rows = [
      row({ day: "2026-08-17", total_seconds: 360, total_chunks: 1, distractions: 1 }),
      row({ day: "2026-08-18", total_seconds: 360, total_chunks: 1, distractions: 1 }),
      row({ day: "2026-08-19", total_seconds: 360, total_chunks: 1, distractions: 1 }),
    ];
    expect(distractionsPerHour(rows)).toBe(10);
  });
});

describe("summarize", () => {
  it("junta las cuatro métricas de un conjunto de filas", () => {
    const rows = [
      row({ day: "2026-08-17", total_seconds: 3600, total_chunks: 4, distractions: 2 }),
      row({ day: "2026-08-19", total_seconds: 1800, total_chunks: 2, distractions: 1 }),
    ];
    expect(summarize(rows)).toEqual({
      minutesPerBlock: 15, // 5400s / 6 bloques = 900s = 15 min
      blocksPerDay: 3, // 6 bloques / 2 días
      studyDays: 2,
      distractionsPerHour: 2, // 3 cortes / 1.5 h
    });
  });

  it("una serie vacía da nulls y 0 días, sin romper", () => {
    expect(summarize([])).toEqual({
      minutesPerBlock: null,
      blocksPerDay: null,
      studyDays: 0,
      distractionsPerHour: null,
    });
  });
});

describe("groupByPeriod", () => {
  it("agrupa por semanas que empiezan el DOMINGO", () => {
    // La app ya define la semana arrancando el domingo en getStatsForWeek
    // (date_trunc + 1 día - 1 día). Si acá arrancara el lunes, "esta semana"
    // del informe no coincidiría con la tarjeta "Esta semana" que ya existe.
    // 2026-08-16 es domingo; el 22, sábado. El 23 ya es otra semana.
    const rows = [
      row({ day: "2026-08-16", total_seconds: 600, total_chunks: 1 }),
      row({ day: "2026-08-22", total_seconds: 600, total_chunks: 1 }),
      row({ day: "2026-08-23", total_seconds: 600, total_chunks: 1 }),
    ];
    const periods = groupByPeriod(rows, "week");
    expect(periods).toHaveLength(2);
    expect(periods[0].start).toBe("2026-08-16");
    expect(periods[0].studyDays).toBe(2);
    expect(periods[1].start).toBe("2026-08-23");
    expect(periods[1].studyDays).toBe(1);
  });

  it("un día de mitad de semana cae en el domingo anterior", () => {
    const periods = groupByPeriod(
      [row({ day: "2026-08-19", total_seconds: 600, total_chunks: 1 })],
      "week"
    );
    expect(periods[0].start).toBe("2026-08-16");
  });

  it("agrupa por mes", () => {
    const rows = [
      row({ day: "2026-08-31", total_seconds: 600, total_chunks: 1 }),
      row({ day: "2026-09-01", total_seconds: 600, total_chunks: 1 }),
      row({ day: "2026-09-15", total_seconds: 600, total_chunks: 1 }),
    ];
    const periods = groupByPeriod(rows, "month");
    expect(periods).toHaveLength(2);
    expect(periods[0].start).toBe("2026-08-01");
    expect(periods[1].start).toBe("2026-09-01");
    expect(periods[1].studyDays).toBe(2);
  });

  it("cruza el fin de año sin romper la semana", () => {
    // 2026-01-03 es sábado: su semana arranca el domingo 2025-12-28.
    const periods = groupByPeriod(
      [row({ day: "2026-01-03", total_seconds: 600, total_chunks: 1 })],
      "week"
    );
    expect(periods[0].start).toBe("2025-12-28");
  });

  it("devuelve los períodos ordenados cronológicamente", () => {
    const rows = [
      row({ day: "2026-09-15", total_seconds: 600, total_chunks: 1 }),
      row({ day: "2026-07-15", total_seconds: 600, total_chunks: 1 }),
      row({ day: "2026-08-15", total_seconds: 600, total_chunks: 1 }),
    ];
    const periods = groupByPeriod(rows, "month");
    expect(periods.map((p) => p.start)).toEqual(["2026-07-01", "2026-08-01", "2026-09-01"]);
  });

  it("calcula las métricas de cada período", () => {
    const rows = [
      row({ day: "2026-08-17", total_seconds: 3600, total_chunks: 4, distractions: 2 }),
      row({ day: "2026-08-19", total_seconds: 1800, total_chunks: 2, distractions: 1 }),
    ];
    const [p] = groupByPeriod(rows, "week");
    expect(p.minutesPerBlock).toBe(15);
    expect(p.blocksPerDay).toBe(3);
    expect(p.distractionsPerHour).toBe(2);
  });

  it("una serie vacía da una lista vacía", () => {
    expect(groupByPeriod([], "week")).toEqual([]);
  });
});

describe("compare", () => {
  it("en min/bloque, bajar es mejorar", () => {
    expect(compare(12, 15, "lower-is-better")).toEqual({
      diff: -3,
      pct: -20,
      trend: "better",
    });
  });

  it("en min/bloque, subir es empeorar", () => {
    expect(compare(18, 15, "lower-is-better")).toMatchObject({ trend: "worse" });
  });

  it("en bloques/día, subir es mejorar", () => {
    // La dirección es lo único que separa una métrica de la otra: un "verde
    // si sube" naive pintaría de verde un min/bloque que empeoró.
    expect(compare(5, 4, "higher-is-better")).toMatchObject({ diff: 1, trend: "better" });
  });

  it("en bloques/día, bajar es empeorar", () => {
    expect(compare(3, 4, "higher-is-better")).toMatchObject({ trend: "worse" });
  });

  it("sin cambio no es ni mejor ni peor", () => {
    expect(compare(10, 10, "lower-is-better")).toEqual({ diff: 0, pct: 0, trend: "same" });
  });

  it("sin período anterior no hay comparación", () => {
    expect(compare(10, null, "lower-is-better")).toEqual({
      diff: null,
      pct: null,
      trend: null,
    });
  });

  it("sin período actual tampoco", () => {
    expect(compare(null, 10, "lower-is-better")).toEqual({
      diff: null,
      pct: null,
      trend: null,
    });
  });

  it("un anterior en cero deja el porcentaje en null pero no el delta", () => {
    // Dividir por cero daría Infinity; el delta absoluto sigue siendo válido.
    expect(compare(4, 0, "higher-is-better")).toEqual({
      diff: 4,
      pct: null,
      trend: "better",
    });
  });

  it("redondea el delta y el porcentaje a un decimal", () => {
    expect(compare(10.25, 9.1, "higher-is-better")).toEqual({
      diff: 1.2,
      pct: 12.6,
      trend: "better",
    });
  });
});

describe("byLabel", () => {
  it("agrupa por materia y ordena de la más costosa a la menos", () => {
    const rows = [
      row({
        day: "2026-08-17",
        label_id: 1,
        label_name: "Derecho",
        label_color: "#f00",
        total_seconds: 1800,
        total_chunks: 4,
      }),
      row({
        day: "2026-08-17",
        label_id: 2,
        label_name: "RRHH",
        label_color: "#0f0",
        total_seconds: 3600,
        total_chunks: 4,
      }),
    ];
    const result = byLabel(rows);
    expect(result.map((l) => l.label_name)).toEqual(["RRHH", "Derecho"]);
    expect(result[0].minutesPerBlock).toBe(15);
    expect(result[1].minutesPerBlock).toBe(7.5);
    expect(result[0].label_color).toBe("#0f0");
  });

  it("junta los días de una misma materia", () => {
    const rows = [
      row({ day: "2026-08-17", label_id: 1, label_name: "RRHH", total_seconds: 1800, total_chunks: 2 }),
      row({ day: "2026-08-18", label_id: 1, label_name: "RRHH", total_seconds: 1800, total_chunks: 2 }),
    ];
    const result = byLabel(rows);
    expect(result).toHaveLength(1);
    expect(result[0].studyDays).toBe(2);
    expect(result[0].minutesPerBlock).toBe(15);
  });

  it("agrupa las sesiones sin materia bajo un label nulo", () => {
    const rows = [row({ day: "2026-08-17", total_seconds: 1800, total_chunks: 2 })];
    const result = byLabel(rows);
    expect(result).toHaveLength(1);
    expect(result[0].label_id).toBeNull();
    expect(result[0].label_name).toBeNull();
  });

  it("una serie vacía da una lista vacía", () => {
    expect(byLabel([])).toEqual([]);
  });
});
