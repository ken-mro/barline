import { useCallback, useEffect } from "react";
import { play, stop } from "../audio/playback";
import { useEditorStore } from "../store/editorStore";
import { useSongStore } from "../store/songStore";

/**
 * 再生の開始/停止を扱うフック。
 * 再生状態と再生ヘッド位置を editorStore に反映する。
 */
export function usePlayback() {
  const song = useSongStore((s) => s.song);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setPlayheadBeats = useEditorStore((s) => s.setPlayheadBeats);

  const start = useCallback(async () => {
    setIsPlaying(true);
    await play(
      song,
      (beats) => setPlayheadBeats(beats),
      () => {
        setIsPlaying(false);
        setPlayheadBeats(0);
      },
    );
  }, [song, setIsPlaying, setPlayheadBeats]);

  const halt = useCallback(() => {
    stop();
    setIsPlaying(false);
    setPlayheadBeats(0);
  }, [setIsPlaying, setPlayheadBeats]);

  const toggle = useCallback(() => {
    if (isPlaying) halt();
    else void start();
  }, [isPlaying, start, halt]);

  // アンマウント時に確実に停止する。
  useEffect(() => () => stop(), []);

  return { isPlaying, start, halt, toggle };
}
