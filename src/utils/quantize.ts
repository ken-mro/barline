import type { Note, TimeSignature } from "../types/song";

/**
 * 打ち込んだノート（拍単位）を、五線譜描画に適した「小節 → 音符/休符」の
 * 並びへ変換するユーティリティ。
 *
 * 表示重視の MVP として、各トラックを「同時発音はコード、それ以外は単旋律」
 * として扱い、隙間を休符で埋める。任意長の音価は表現可能な音価（付点含む）
 * の和へ貪欲分解する。
 */

/** 量子化の最小単位（拍）。0.25 = 16 分音符。 */
export const DEFAULT_GRID = 0.25;

const EPSILON = 1e-6;

export interface NotationElement {
  type: "note" | "rest";
  /** VexFlow のキー（例 "c#/4"）。rest のときは空配列。 */
  keys: string[];
  /** VexFlow の音価コード（"w" | "h" | "q" | "8" | "16"）。 */
  duration: string;
  /** 付点の数（0 または 1）。 */
  dots: number;
}

export interface NotationMeasure {
  elements: NotationElement[];
}

/** 表現可能な音価テーブル（拍, コード, 付点）。降順。 */
const DURATION_TABLE: Array<{ beats: number; code: string; dots: number }> = [
  { beats: 4, code: "w", dots: 0 },
  { beats: 3, code: "h", dots: 1 },
  { beats: 2, code: "h", dots: 0 },
  { beats: 1.5, code: "q", dots: 1 },
  { beats: 1, code: "q", dots: 0 },
  { beats: 0.75, code: "8", dots: 1 },
  { beats: 0.5, code: "8", dots: 0 },
  { beats: 0.375, code: "16", dots: 1 },
  { beats: 0.25, code: "16", dots: 0 },
];

const NOTE_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];

/** MIDI ノート番号を VexFlow のキー表記へ変換する（例 60 → "c/4"）。 */
export function midiToVexKey(pitch: number): string {
  const name = NOTE_NAMES[((pitch % 12) + 12) % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${name}/${octave}`;
}

/** 値をグリッドへスナップする。 */
export function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

/** 1 小節の拍数（四分音符 = 1）。例: 4/4 → 4、6/8 → 3。 */
export function measureBeats(ts: TimeSignature): number {
  return (ts[0] * 4) / ts[1];
}

/** 任意の拍長を表現可能な音価の並びへ貪欲分解する。 */
export function decomposeDuration(beats: number): Array<{ code: string; dots: number }> {
  const out: Array<{ code: string; dots: number }> = [];
  let remaining = beats;
  while (remaining > DEFAULT_GRID / 2) {
    const entry = DURATION_TABLE.find((d) => d.beats <= remaining + EPSILON);
    if (!entry) break;
    out.push({ code: entry.code, dots: entry.dots });
    remaining -= entry.beats;
  }
  return out;
}

/** 内部表現: タイムライン上の 1 区間（音符 or 休符）。 */
interface Slot {
  type: "note" | "rest";
  pitches: number[];
  beats: number;
}

/**
 * 1 トラックのノート列を小節配列へ変換する。
 * @param notes トラックのノート
 * @param ts 拍子記号
 * @param grid 量子化単位（拍）
 */
export function quantizeTrackToMeasures(
  notes: Note[],
  ts: TimeSignature,
  grid: number = DEFAULT_GRID,
): NotationMeasure[] {
  const mBeats = measureBeats(ts);

  // 1) 同時発音（同じ量子化開始位置）をコードへまとめる。
  const onsetMap = new Map<number, { start: number; pitches: number[]; dur: number }>();
  for (const note of notes) {
    const start = snap(note.start, grid);
    const dur = Math.max(grid, snap(note.duration, grid));
    const existing = onsetMap.get(start);
    if (existing) {
      existing.pitches.push(note.pitch);
      existing.dur = Math.max(existing.dur, dur);
    } else {
      onsetMap.set(start, { start, pitches: [note.pitch], dur });
    }
  }
  const onsets = [...onsetMap.values()].sort((a, b) => a.start - b.start);

  // 2) 隙間を休符で埋めつつ、フラットなタイムラインを構築する。
  const slots: Slot[] = [];
  let cursor = 0;
  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];
    if (onset.start > cursor + EPSILON) {
      slots.push({ type: "rest", pitches: [], beats: onset.start - cursor });
    }
    const next = onsets[i + 1];
    const maxDur = next ? next.start - onset.start : onset.dur;
    const dur = Math.max(grid, Math.min(onset.dur, maxDur));
    slots.push({ type: "note", pitches: onset.pitches, beats: dur });
    cursor = onset.start + dur;
  }

  // 3) 末尾を小節境界まで休符でパディングする。
  const totalMeasures = Math.max(1, Math.ceil((cursor - EPSILON) / mBeats));
  const totalBeats = totalMeasures * mBeats;
  if (cursor < totalBeats - EPSILON) {
    slots.push({ type: "rest", pitches: [], beats: totalBeats - cursor });
  }

  // 4) 小節境界で分割し、各区間を表現可能な音価へ分解して要素化する。
  const measures: NotationMeasure[] = Array.from({ length: totalMeasures }, () => ({
    elements: [],
  }));
  let pos = 0;
  for (const slot of slots) {
    let remaining = slot.beats;
    while (remaining > EPSILON) {
      const measureIndex = Math.min(totalMeasures - 1, Math.floor((pos + EPSILON) / mBeats));
      const measureEnd = (measureIndex + 1) * mBeats;
      const chunk = Math.min(remaining, measureEnd - pos);
      for (const part of decomposeDuration(chunk)) {
        measures[measureIndex].elements.push({
          type: slot.type,
          keys: slot.type === "note" ? slot.pitches.map(midiToVexKey) : [],
          duration: part.code,
          dots: part.dots,
        });
      }
      pos += chunk;
      remaining -= chunk;
    }
  }

  // 空小節には全休符を入れておく（VexFlow が空 voice を嫌うため）。
  for (const m of measures) {
    if (m.elements.length === 0) {
      m.elements.push({ type: "rest", keys: [], duration: "w", dots: 0 });
    }
  }

  return measures;
}
