import * as Tone from "tone";
import type { Song } from "../types/song";
import { ensureStarted, getSynth, midiToFrequency } from "./engine";

/**
 * Song を Tone.Transport 上にスケジューリングして再生する。
 *
 * 時間はすべて拍（四分音符 = 1）で保持しているため、Transport の
 * "Xi" 表記（i = 拍 index ではなく秒換算）ではなく、テンポから秒へ
 * 変換した絶対秒でスケジュールする。
 */

let scheduledIds: number[] = [];
let positionRaf: number | null = null;

/** 拍数 → 秒（指定 BPM）。 */
function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

/** 現在スケジュールされているイベントをすべて解除する。 */
function clearSchedule(): void {
  for (const id of scheduledIds) {
    Tone.getTransport().clear(id);
  }
  scheduledIds = [];
}

export interface PlaybackHandle {
  stop: () => void;
}

/**
 * 再生を開始する。
 * @param song 対象楽曲
 * @param onPosition 再生位置（拍）を通知するコールバック（任意）
 * @param onEnd 再生終了時のコールバック（任意）
 */
export async function play(
  song: Song,
  onPosition?: (beats: number) => void,
  onEnd?: () => void,
): Promise<PlaybackHandle> {
  await ensureStarted();
  stop();

  const transport = Tone.getTransport();
  const synth = getSynth();
  transport.bpm.value = song.tempo;

  let lastEndSec = 0;
  for (const track of song.tracks) {
    for (const note of track.notes) {
      const startSec = beatsToSeconds(note.start, song.tempo);
      const durSec = Math.max(0.01, beatsToSeconds(note.duration, song.tempo));
      lastEndSec = Math.max(lastEndSec, startSec + durSec);
      const id = transport.schedule((time) => {
        synth.triggerAttackRelease(midiToFrequency(note.pitch), durSec, time, note.velocity / 127);
      }, startSec);
      scheduledIds.push(id);
    }
  }

  // 末尾で自動停止。
  const endId = transport.schedule(() => {
    stop();
    onEnd?.();
  }, lastEndSec + 0.1);
  scheduledIds.push(endId);

  transport.start();

  // 再生位置をアニメーションフレームで通知。
  if (onPosition) {
    const tick = () => {
      onPosition((transport.seconds * song.tempo) / 60);
      positionRaf = requestAnimationFrame(tick);
    };
    positionRaf = requestAnimationFrame(tick);
  }

  return { stop };
}

/** 再生を停止し、Transport を先頭へ戻す。 */
export function stop(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.position = 0;
  clearSchedule();
  if (positionRaf !== null) {
    cancelAnimationFrame(positionRaf);
    positionRaf = null;
  }
}
