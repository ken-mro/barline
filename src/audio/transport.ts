import * as Tone from "tone";

/**
 * Tone.getTransport() を再生（playback）と録音（recorder）で共有するための
 * 調停レイヤー。両者が同時に transport.start()/stop() や rAF を回すと破綻するため、
 * 排他的な所有権と単一の rAF ループをここで一元管理する。
 */

type Owner = "playback" | "recorder";

let owner: Owner | null = null;
let rafId: number | null = null;

/** 現在の所有者を返す。 */
export function getOwner(): Owner | null {
  return owner;
}

/**
 * トランスポートの所有権を取得する。
 * 既に別の所有者がいる場合は false（呼び出し側が先に相手を停止すること）。
 */
export function acquire(next: Owner): boolean {
  if (owner && owner !== next) return false;
  owner = next;
  return true;
}

/** 位置更新用 rAF を開始する（既存ループは停止してから1本だけ回す）。 */
export function startRaf(tick: () => void): void {
  stopRaf();
  const loop = () => {
    tick();
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

/** rAF を停止する。 */
export function stopRaf(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/**
 * トランスポートを完全停止し、全スケジュール（scheduleRepeat 含む）を破棄、
 * rAF を止め、所有権を解放する。各セッション開始/終了時に呼ぶ。
 */
export function hardStop(): void {
  const t = Tone.getTransport();
  // AudioContext が無い環境（テスト/SSR）では transport が未完全なため防御的に扱う。
  if (typeof t?.stop === "function") {
    t.stop();
    t.cancel(0);
    t.position = 0;
  }
  stopRaf();
  owner = null;
}

/** 拍 → 秒。 */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

/** 秒 → 拍。 */
export function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60;
}
