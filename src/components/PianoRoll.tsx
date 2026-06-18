import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import { ensureStarted, previewNote } from "../audio/engine";
import { useEditorStore } from "../store/editorStore";
import { useSongStore } from "../store/songStore";
import type { Note } from "../types/song";
import { measureBeats } from "../utils/quantize";

/**
 * SVG ベースのピアノロール編集。
 * - 空白クリック: 現在の音価でノート追加
 * - ノートをドラッグ: 移動（音高・位置）
 * - ノート右端をドラッグ: 長さ変更
 * - ノート選択中に Delete/Backspace: 削除
 */

const ROW_HEIGHT = 16;
const BEAT_WIDTH = 40;
const PITCH_MAX = 84; // C6
const PITCH_MIN = 48; // C3
const MIN_BEATS = 16;
const RESIZE_HANDLE = 6;

type DragMode = "move" | "resize";
interface DragState {
  mode: DragMode;
  noteId: string;
  startPointerBeat: number;
  startPointerPitch: number;
  origStart: number;
  origPitch: number;
  origDuration: number;
}

function snapTo(value: number, grid: number): number {
  return Math.max(0, Math.round(value / grid) * grid);
}

// 座標変換（定数のみに依存する純粋関数なので module スコープに置く）。
const xToBeat = (x: number) => x / BEAT_WIDTH;
const yToPitch = (y: number) => PITCH_MAX - 1 - Math.floor(y / ROW_HEIGHT);
const pitchToY = (pitch: number) => (PITCH_MAX - 1 - pitch) * ROW_HEIGHT;

function clientToLocal(svg: SVGSVGElement | null, clientX: number, clientY: number) {
  const rect = svg?.getBoundingClientRect();
  return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
}

export function PianoRoll() {
  const song = useSongStore((s) => s.song);
  const selectedTrackId = useSongStore((s) => s.selectedTrackId);
  const addNote = useSongStore((s) => s.addNote);
  const updateNote = useSongStore((s) => s.updateNote);
  const removeNote = useSongStore((s) => s.removeNote);

  const grid = useEditorStore((s) => s.grid);
  const noteDuration = useEditorStore((s) => s.noteDuration);
  const selectedNoteId = useEditorStore((s) => s.selectedNoteId);
  const selectNote = useEditorStore((s) => s.selectNote);
  const playheadBeats = useEditorStore((s) => s.playheadBeats);
  const setStepCursor = useEditorStore((s) => s.setStepCursor);

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<DragState | null>(null);

  const track = song.tracks.find((t) => t.id === selectedTrackId) ?? song.tracks[0];
  const notes = track?.notes ?? [];

  const mBeats = measureBeats(song.timeSignature);
  const contentEnd = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
  const totalBeats = Math.max(MIN_BEATS, Math.ceil(contentEnd / mBeats) * mBeats + mBeats);
  const pitchRows = PITCH_MAX - PITCH_MIN;

  const width = totalBeats * BEAT_WIDTH;
  const height = pitchRows * ROW_HEIGHT;

  // 背景クリックでノート追加。
  const onBackgroundPointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    const { x, y } = clientToLocal(svgRef.current, e.clientX, e.clientY);
    const start = snapTo(xToBeat(x), grid);
    const pitch = yToPitch(y);
    if (pitch < PITCH_MIN || pitch >= PITCH_MAX) return;
    const id = addNote({ pitch, start, duration: noteDuration, velocity: 96 });
    selectNote(id);
    setStepCursor(start + noteDuration);
    void ensureStarted().then(() => previewNote(pitch));
  };

  const onNotePointerDown = (e: ReactPointerEvent<SVGRectElement>, note: Note) => {
    e.stopPropagation();
    selectNote(note.id);
    const { x, y } = clientToLocal(svgRef.current, e.clientX, e.clientY);
    const noteRight = (note.start + note.duration) * BEAT_WIDTH;
    const mode: DragMode = noteRight - x <= RESIZE_HANDLE ? "resize" : "move";
    drag.current = {
      mode,
      noteId: note.id,
      startPointerBeat: xToBeat(x),
      startPointerPitch: yToPitch(y),
      origStart: note.start,
      origPitch: note.pitch,
      origDuration: note.duration,
    };
  };

  // ドラッグ中の移動/リサイズは window で追跡する。
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const { x, y } = clientToLocal(svgRef.current, e.clientX, e.clientY);
      if (d.mode === "move") {
        const deltaBeat = xToBeat(x) - d.startPointerBeat;
        const deltaPitch = yToPitch(y) - d.startPointerPitch;
        updateNote(d.noteId, {
          start: snapTo(d.origStart + deltaBeat, grid),
          pitch: Math.min(PITCH_MAX - 1, Math.max(PITCH_MIN, d.origPitch + deltaPitch)),
        });
      } else {
        const deltaBeat = xToBeat(x) - d.startPointerBeat;
        updateNote(d.noteId, {
          duration: Math.max(grid, snapTo(d.origDuration + deltaBeat, grid)),
        });
      }
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [grid, updateNote]);

  // 選択ノートの削除。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNoteId) {
        e.preventDefault();
        removeNote(selectedNoteId);
        selectNote(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNoteId, removeNote, selectNote]);

  // 小節の縦線。
  const measureLines = [];
  for (let b = 0; b <= totalBeats; b += 1) {
    const isMeasure = Math.abs(b % mBeats) < 1e-6;
    measureLines.push(
      <line
        key={`v-${b}`}
        x1={b * BEAT_WIDTH}
        y1={0}
        x2={b * BEAT_WIDTH}
        y2={height}
        stroke={isMeasure ? "#55555f" : "#3a3a44"}
        strokeWidth={isMeasure ? 1.5 : 1}
      />,
    );
  }

  // 行（黒鍵の行を薄く塗る）。
  const rows = [];
  for (let p = PITCH_MIN; p < PITCH_MAX; p++) {
    const isBlack = [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
    rows.push(
      <rect
        key={`row-${p}`}
        x={0}
        y={pitchToY(p)}
        width={width}
        height={ROW_HEIGHT}
        fill={isBlack ? "#00000022" : "transparent"}
      />,
    );
  }

  return (
    <div className="panel">
      <h2>ピアノロール</h2>
      <div className="piano-roll-wrap" style={{ maxHeight: 360 }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ display: "block" }}
          role="img"
          aria-label="ピアノロール編集領域"
        >
          {rows}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onPointerDown={onBackgroundPointerDown}
          />
          {measureLines}
          {notes.map((note) => (
            <rect
              key={note.id}
              x={note.start * BEAT_WIDTH}
              y={pitchToY(note.pitch)}
              width={Math.max(2, note.duration * BEAT_WIDTH - 1)}
              height={ROW_HEIGHT - 1}
              rx={3}
              fill={note.id === selectedNoteId ? "var(--note-selected)" : "var(--note)"}
              stroke="#1118"
              style={{ cursor: "pointer" }}
              onPointerDown={(e) => onNotePointerDown(e, note)}
            />
          ))}
          <line
            x1={playheadBeats * BEAT_WIDTH}
            y1={0}
            x2={playheadBeats * BEAT_WIDTH}
            y2={height}
            stroke="var(--playhead)"
            strokeWidth={2}
            pointerEvents="none"
          />
        </svg>
      </div>
    </div>
  );
}
