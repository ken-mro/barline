import { useEffect, useRef } from "react";
import { renderNotation } from "../notation/render";
import { useSongStore } from "../store/songStore";

/**
 * 譜面化（五線譜表示）。
 * Song の変更を購読し、選択トラックを VexFlow で再描画する。
 */
export function NotationView() {
  const song = useSongStore((s) => s.song);
  const selectedTrackId = useSongStore((s) => s.selectedTrackId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const width = Math.max(360, el.clientWidth || 800);
    try {
      renderNotation(el, song, selectedTrackId, width);
    } catch (err) {
      console.error("譜面描画エラー", err);
    }
  }, [song, selectedTrackId]);

  return (
    <div className="panel">
      <h2>譜面（自動量子化・表示）</h2>
      <div className="notation" ref={containerRef} />
    </div>
  );
}
