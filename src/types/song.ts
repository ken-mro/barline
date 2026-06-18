/**
 * barline の楽曲データモデル。
 *
 * 再生（Tone.js）・MIDI 書き出し（@tonejs/midi）・譜面化（VexFlow）の
 * すべてがこの単一の `Song` から派生する（single source of truth）。
 *
 * 時間軸はテンポ非依存にするため「拍（beats / 四分音符 = 1）」で保持する。
 */

/** 1 つの音符。 */
export interface Note {
  /** 安定した一意 ID（React の key / 編集対象の特定に使う）。 */
  id: string;
  /** MIDI ノート番号（0-127、C4 = 60）。 */
  pitch: number;
  /** 開始位置（拍単位、四分音符 = 1.0）。 */
  start: number;
  /** 長さ（拍単位、四分音符 = 1.0）。 */
  duration: number;
  /** ベロシティ（0-127）。 */
  velocity: number;
}

/** 1 トラック（= 1 パート / 楽器）。 */
export interface Track {
  id: string;
  name: string;
  /** General MIDI 楽器名（Tone のシンセ選択・MIDI 書き出しに使用）。 */
  instrument: string;
  notes: Note[];
}

/** 拍子記号 [分子, 分母]（例: [4, 4]）。 */
export type TimeSignature = [number, number];

/** 楽曲全体。 */
export interface Song {
  /** テンポ（BPM）。 */
  tempo: number;
  timeSignature: TimeSignature;
  /** ticks per quarter note（MIDI 書き出し時の解像度）。 */
  ppq: number;
  tracks: Track[];
}
