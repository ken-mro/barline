import * as Tone from "tone";
import type { Song } from "../types/song";
import { ensureStarted, getSynth, midiToFrequency } from "./engine";
import { acquire, beatsToSeconds, hardStop, startRaf } from "./transport";

/**
 * Song を Tone.Transport 上にスケジューリングして再生する。
 *
 * 時間はすべて拍（四分音符 = 1）で保持しているため、テンポから秒へ変換した
 * 絶対秒でスケジュールする。トランスポートは録音と共有のため transport.ts の
 * コーディネータ経由で扱う。
 */

/**
 * 既存ノートをトランスポートにスケジュールし、末尾の秒位置を返す。
 * @param offsetSec 全ノートをずらす秒数（録音のカウントイン用）
 */
export function scheduleSongNotes(song: Song, offsetSec = 0): number {
  const transport = Tone.getTransport();
  const synth = getSynth();
  let lastEndSec = 0;
  for (const track of song.tracks) {
    for (const note of track.notes) {
      const startSec = beatsToSeconds(note.start, song.tempo) + offsetSec;
      const durSec = Math.max(0.01, beatsToSeconds(note.duration, song.tempo));
      lastEndSec = Math.max(lastEndSec, startSec + durSec);
      transport.schedule((time) => {
        synth.triggerAttackRelease(midiToFrequency(note.pitch), durSec, time, note.velocity / 127);
      }, startSec);
    }
  }
  return lastEndSec;
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
  hardStop();
  acquire("playback");

  const transport = Tone.getTransport();
  transport.bpm.value = song.tempo;

  const lastEndSec = scheduleSongNotes(song);

  // 末尾で自動停止。
  transport.schedule(() => {
    stop();
    onEnd?.();
  }, lastEndSec + 0.1);

  transport.start();

  if (onPosition) {
    startRaf(() => onPosition((transport.seconds * song.tempo) / 60));
  }

  return { stop };
}

/** 再生を停止し、Transport を先頭へ戻す。 */
export function stop(): void {
  hardStop();
}
