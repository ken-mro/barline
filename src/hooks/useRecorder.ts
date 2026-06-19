import { useCallback, useEffect, useRef } from "react";
import { stop as stopPlayback } from "../audio/playback";
import { type RecorderHandle, startRecorder } from "../audio/recorder";
import { useEditorStore } from "../store/editorStore";
import { useSongStore } from "../store/songStore";
import { measureBeats } from "../utils/quantize";

/**
 * リアルタイム録音の React 配線。
 * App で 1 度だけ生成し、Transport の録音ボタンと Keyboard が同じインスタンスを
 * 共有する（RecorderContext 経由）。store 読み取りは getState() でスナップショット
 * を取り、ハンドラの再生成（stale closure）を避ける。
 */
export interface RecorderApi {
  start: () => Promise<void>;
  halt: () => void;
  noteOn: (pitch: number) => void;
  noteOff: (pitch: number) => void;
}

export function useRecorder(): RecorderApi {
  const handleRef = useRef<RecorderHandle | null>(null);

  const start = useCallback(async () => {
    const song = useSongStore.getState().song;
    const ed = useEditorStore.getState();

    // 再生と排他。録音前に再生を止める。
    stopPlayback();
    ed.setIsPlaying(false);

    const mBeats = measureBeats(song.timeSignature);
    const countInBeats = ed.countIn ? mBeats : 0;

    const handle = await startRecorder(song, {
      countInBeats,
      metronome: ed.metronome,
      overdub: ed.overdub,
      onHead: (b) => useEditorStore.getState().setRecordHeadBeats(b),
      onLiveChange: (live) => useEditorStore.getState().setLiveNotes(live),
      onCommit: (n) => useSongStore.getState().addNote(n),
    });

    handleRef.current = handle;
    useEditorStore.getState().setIsRecording(true);
  }, []);

  const halt = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    const ed = useEditorStore.getState();
    ed.setIsRecording(false);
    ed.setRecordHeadBeats(0);
    ed.setLiveNotes([]);
  }, []);

  const noteOn = useCallback((pitch: number) => handleRef.current?.noteOn(pitch), []);
  const noteOff = useCallback((pitch: number) => handleRef.current?.noteOff(pitch), []);

  // アンマウント時に確実に停止（鳴りっぱなし防止）。
  useEffect(() => () => handleRef.current?.stop(), []);

  return { start, halt, noteOn, noteOff };
}
