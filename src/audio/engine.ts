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
