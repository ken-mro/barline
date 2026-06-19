import * as Tone from "tone";

/**
 * Tone.js のオーディオエンジン（シングルトン）。
 *
 * ブラウザの自動再生ポリシーにより、AudioContext はユーザー操作後にしか
 * start できない。`ensureStarted()` を最初のユーザー操作ハンドラ内で呼ぶこと。
 */

let synth: Tone.PolySynth | null = null;
let started = false;

/** AudioContext を起動し、シンセを初期化する（多重呼び出し安全）。 */
export async function ensureStarted(): Promise<void> {
  if (!started) {
    await Tone.start();
    started = true;
  }
  getSynth();
}

/** 発音用のポリフォニックシンセを取得する（遅延生成）。 */
export function getSynth(): Tone.PolySynth {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.8 },
    }).toDestination();
    synth.volume.value = -8;
  }
  return synth;
}

/** MIDI ノート番号を周波数(Hz)へ変換する。 */
export function midiToFrequency(pitch: number): number {
  return Tone.Frequency(pitch, "midi").toFrequency();
}

/** 単発のプレビュー発音（鍵盤クリックなどで使用）。 */
export function previewNote(pitch: number, duration = "8n", velocity = 0.8): void {
  getSynth().triggerAttackRelease(midiToFrequency(pitch), duration, undefined, velocity);
}

// 押し続け発音（録音・鍵盤演奏用）。同一 pitch の二重 attack を防ぐため
// 押下中の pitch を管理する（PolySynth は周波数指定で release するため）。
const heldPitches = new Set<number>();

/** ノートオン（押下）。既に押下中なら無視する。 */
export function noteOn(pitch: number, velocity = 0.8): void {
  if (heldPitches.has(pitch)) return;
  heldPitches.add(pitch);
  getSynth().triggerAttack(midiToFrequency(pitch), undefined, velocity);
}

/** ノートオフ（離鍵）。 */
export function noteOff(pitch: number): void {
  if (!heldPitches.has(pitch)) return;
  heldPitches.delete(pitch);
  getSynth().triggerRelease(midiToFrequency(pitch));
}

// メトロノーム用の打楽器シンセ（PolySynth とは別系統で軽く鳴らす）。
let click: Tone.MembraneSynth | null = null;

function getClick(): Tone.MembraneSynth {
  if (!click) {
    click = new Tone.MembraneSynth({ volume: -4 }).toDestination();
  }
  return click;
}

/**
 * メトロノームのクリックを鳴らす。必ず Transport.schedule の time 引数を渡すこと
 * （rAF から呼ぶとタイミングがずれる）。
 */
export function playClick(time: number, accent: boolean): void {
  getClick().triggerAttackRelease(accent ? "C3" : "C2", "32n", time, accent ? 1 : 0.55);
}
