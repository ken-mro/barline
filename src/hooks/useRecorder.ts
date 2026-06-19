import { useCallback, useEffect, useRef } from "react";
import { clickNow, ensureStarted } from "../audio/engine";
import { stop as stopPlayback } from "../audio/playback";
import { type RecorderHandle, startRecorder } from "../audio/recorder";
import { useEditorStore } from "../store/editorStore";
import { useSongStore } from "../store/songStore";

/** 鍵盤パネルを画面下部へスクロールするための要素 id。 */
export const KEYBOARD_ANCHOR_ID = "barline-keyboard";

const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * リアルタイム録音の React 配線。
 * 録音ボタンを押すと、鍵盤が見える位置までスクロール → 3 秒カウントダウン
 * → 録音開始、という流れを担う。App で 1 度だけ生成し RecorderContext で共有する。
 */
export interface RecorderApi {
  start: () => Promise<void>;
  halt: () => void;
  noteOn: (pitch: number) => void;
  noteOff: (pitch: number) => void;
}

export function useRecorder(): RecorderApi {
  const handleRef = useRef<RecorderHandle | null>(null);
  // カウントダウン進行中フラグ（停止操作でキャンセルするため）。
  const armingRef = useRef(false);

  const halt = useCallback(() => {
    // カウントダウン中のキャンセルも兼ねる。
    armingRef.current = false;
    handleRef.current?.stop();
    handleRef.current = null;
    const ed = useEditorStore.getState();
    ed.setIsRecording(false);
    ed.setCountdown(null);
    ed.setRecordHeadBeats(0);
    ed.setLiveNotes([]);
  }, []);

  const start = useCallback(async () => {
    const ed = useEditorStore.getState();
    if (ed.isRecording || armingRef.current) return;

    // 再生と排他。録音前に再生を止める。
    stopPlayback();
    ed.setIsPlaying(false);

    await ensureStarted();

    // 鍵盤が画面下部に見える位置までスクロール。
    document
      .getElementById(KEYBOARD_ANCHOR_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "end" });

    // 3 秒カウントダウン（停止操作でキャンセル可能）。countIn が off なら省略。
    if (ed.countIn) {
      armingRef.current = true;
      for (let n = COUNTDOWN_FROM; n >= 1; n--) {
        if (!armingRef.current) {
          useEditorStore.getState().setCountdown(null);
          return; // キャンセルされた
        }
        useEditorStore.getState().setCountdown(n);
        clickNow(n === COUNTDOWN_FROM);
        await sleep(COUNTDOWN_STEP_MS);
      }
      useEditorStore.getState().setCountdown(null);
      if (!armingRef.current) return; // 最終ステップ中にキャンセル
      armingRef.current = false;
    }

    const song = useSongStore.getState().song;
    const handle = await startRecorder(song, {
      countInBeats: 0, // 事前の 3 秒カウントダウンが pre-roll を兼ねる
      metronome: ed.metronome,
      overdub: ed.overdub,
      onHead: (b) => useEditorStore.getState().setRecordHeadBeats(b),
      onLiveChange: (live) => useEditorStore.getState().setLiveNotes(live),
      onCommit: (note) => useSongStore.getState().addNote(note),
    });

    handleRef.current = handle;
    if (handle) {
      useEditorStore.getState().setIsRecording(true);
    }
  }, []);

  const noteOn = useCallback((pitch: number) => handleRef.current?.noteOn(pitch), []);
  const noteOff = useCallback((pitch: number) => handleRef.current?.noteOff(pitch), []);

  // アンマウント時に確実に停止（鳴りっぱなし防止）。
  useEffect(
    () => () => {
      armingRef.current = false;
      handleRef.current?.stop();
    },
    [],
  );

  return { start, halt, noteOn, noteOff };
}
