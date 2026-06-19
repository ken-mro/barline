import * as Tone from "tone";
import type { LiveNote } from "../store/editorStore";
import type { Note, Song } from "../types/song";
import { measureBeats } from "../utils/quantize";
import {
  noteOff as engineNoteOff,
  noteOn as engineNoteOn,
  ensureStarted,
  playClick,
} from "./engine";
import { scheduleSongNotes } from "./playback";
import { acquire, beatsToSeconds, hardStop, secondsToBeats, startRaf } from "./transport";

/** ID 未付与の記録ノート。 */
export type RecordedNote = Omit<Note, "id">;

/** 録音中の最小ノート長（拍）。1/16 拍 = 64 分音符相当。 */
const MIN_DURATION = 0.0625;

export interface RecorderOptions {
  /** カウントイン長（拍）。0 でカウントインなし。 */
  countInBeats: number;
  metronome: boolean;
  overdub: boolean;
  /** 録音ヘッド位置（拍。カウントイン中は負）。rAF で通知。 */
  onHead: (beats: number) => void;
  /** 押下中ノートの変化を通知（ライブ表示用）。 */
  onLiveChange: (live: LiveNote[]) => void;
  /** 確定したノートを通知（離鍵/停止時）。 */
  onCommit: (note: RecordedNote) => void;
}

export interface RecorderHandle {
  noteOn: (pitch: number, velocity?: number) => void;
  noteOff: (pitch: number) => void;
  stop: () => void;
}

/**
 * 録音を開始する。Tone.Transport をカウントイン分だけ先行させ、録音原点
 * （= 最初の実拍）を beat 0 とする座標系で start/duration を記録する。
 * @returns ハンドル。トランスポートが他で使用中なら null。
 */
export async function startRecorder(
  song: Song,
  opts: RecorderOptions,
): Promise<RecorderHandle | null> {
  await ensureStarted();
  hardStop();
  if (!acquire("recorder")) return null;

  const transport = Tone.getTransport();
  const bpm = song.tempo;
  transport.bpm.value = bpm;

  const countInSec = beatsToSeconds(opts.countInBeats, bpm);
  const mBeats = measureBeats(song.timeSignature);

  // オーバーダブ: 既存ノートをカウントイン分ずらして再生。
  if (opts.overdub) scheduleSongNotes(song, countInSec);

  // メトロノーム（カウントイン中から鳴らす）。
  const beatSec = 60 / bpm;
  transport.scheduleRepeat(
    (time) => {
      if (!opts.metronome) return;
      const beatIndex = Math.round(transport.seconds / beatSec);
      const recBeat = beatIndex - opts.countInBeats;
      const accent = ((recBeat % mBeats) + mBeats) % mBeats === 0;
      playClick(time, accent);
    },
    beatSec,
    0,
  );

  // 録音原点（カウントイン終了）からの拍。
  const currentBeats = () => secondsToBeats(transport.seconds, bpm) - opts.countInBeats;

  const held = new Map<number, { startBeat: number; velocity: number }>();
  const live: LiveNote[] = [];
  const emitLive = () => opts.onLiveChange(live.map((l) => ({ ...l })));

  transport.start();
  startRaf(() => opts.onHead(currentBeats()));

  const commitHeld = (pitch: number, entry: { startBeat: number; velocity: number }) => {
    const end = currentBeats();
    if (end <= 0) return; // 実録音前なら破棄
    const duration = Math.max(MIN_DURATION, end - entry.startBeat);
    opts.onCommit({
      pitch,
      start: entry.startBeat,
      duration,
      velocity: Math.round(entry.velocity * 127),
    });
  };

  return {
    noteOn(pitch, velocity = 0.8) {
      if (held.has(pitch)) return;
      engineNoteOn(pitch, velocity);
      // カウントイン中の発音は開始拍を 0 にクランプ。
      const startBeat = Math.max(0, currentBeats());
      held.set(pitch, { startBeat, velocity });
      live.push({ pitch, startBeat });
      emitLive();
    },
    noteOff(pitch) {
      engineNoteOff(pitch);
      const entry = held.get(pitch);
      if (!entry) return;
      held.delete(pitch);
      const idx = live.findIndex((l) => l.pitch === pitch);
      if (idx >= 0) live.splice(idx, 1);
      emitLive();
      commitHeld(pitch, entry);
    },
    stop() {
      for (const [pitch, entry] of held) {
        engineNoteOff(pitch);
        commitHeld(pitch, entry);
      }
      held.clear();
      live.length = 0;
      opts.onLiveChange([]);
      hardStop();
    },
  };
}
