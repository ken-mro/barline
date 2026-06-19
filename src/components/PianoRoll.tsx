import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import { ensureStarted, previewNote } from "../audio/engine";
import { useEditorStore } from "../store/editorStore";
import { useSongStore } from "../store/songStore";
import type { Note } from "../types/song";
import { measureBeats } from "../utils/quantize";

/**
 * SVG ベースのピアノロール編集。
 * - ツール = pen: 空白クリックで現在の音価のノート追加
 * - ツール = select: 空白は不活性（スクロール優先）。誤入力を防ぐ。
 * - ノートをドラッグ: 移動（音高・位置）／右端ハンドルで長さ変更（両ツール共通）
 * - ノート選択中に Delete/Backspace: 削除
 * - 録音中: 録音カーソルとライブノートを表示し、カーソルを追従スクロール
 */

const ROW_HEIGHT = 18;
const BEAT_WIDTH = 40;
const PITCH_MAX = 84; // C6
const PITCH_MIN = 48; // C3
const MIN_BEATS = 16;
const RESIZE_HANDLE = 8;

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
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const isRecording = useEditorStore((s) => s.isRecording);
  const recordHeadBeats = useEditorStore((s) => s.recordHeadBeats);
  const liveNotes = useEditorStore((s) => s.liveNotes);

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  const track = song.tracks.find((t) => t.id === selectedTrackId) ?? song.tracks[0];
  const notes = track?.notes ?? [];

  const mBeats = measureBeats(song.timeSignature);
  const contentEnd = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
  const totalBeats = Math.max(
    MIN_BEATS,
    Math.ceil(Math.max(contentEnd, recordHeadBeats) / mBeats) * mBeats + mBeats,
  );
  const pitchRows = PITCH_MAX - PITCH_MIN;

  const width = totalBeats * BEAT_WIDTH;
  const height = pitchRows * ROW_HEIGHT;

  // 背景クリックでノート追加（pen ツール時のみ）。
  const onBackgroundPointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (tool !== "pen") {
      selectNote(null);
      return;
    }
    const { x, y } = clientToLocal(svgRef.current, e.clientX, e.clientY);
    const start = snapTo(xToBeat(x), grid);
    const pitch = yToPitch(y);
    if (pitch < PITCH_MIN || pitch >= PITCH_MAX) return;
    const id = addNote({ pitch, start, duration: noteDuration, velocity: 96 });
    selectNote(id);
    setStepCursor(start + noteDuration);
    void ensureStarted().then(() => previewNote(pitch));
  };

  const beginDrag = (e: ReactPointerEvent<SVGRectElement>, note: Note, mode: DragMode) => {
    e.stopPropagation();
    selectNote(note.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = clientToLocal(svgRef.current, e.clientX, e.clientY);
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

  // 録音/再生中、カーソルが見えるよう水平オートスクロール。
  useEffect(() => {
    const head = isRecording ? recordHeadBeats : playheadBeats;
    if (!isRecording && head === 0) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const x = head * BEAT_WIDTH;
    const margin = 80;
    if (x > wrap.scrollLeft + wrap.clientWidth - margin) {
      wrap.scrollLeft = x - wrap.clientWidth + margin;
    } else if (x < wrap.scrollLeft + margin) {
      wrap.scrollLeft = Math.max(0, x - margin);
    }
  }, [recordHeadBeats, playheadBeats, isRecording]);

  // 補助線（細かいグリッド）。grid を変えると本数が変わる。
  const subLines = [];
  if (grid < 1) {
    for (let b = 0; b <= totalBeats + 1e-9; b += grid) {
      if (Math.abs(b - Math.round(b)) < 1e-6) continue; // 拍線は別途描画
      subLines.push(
        <line
          key={`sub-${b}`}
          x1={b * BEAT_WIDTH}
          y1={0}
          x2={b * BEAT_WIDTH}
          y2={height}
          stroke="#2c2c34"
          strokeWidth={1}
        />,
      );
    }
  }

  // 拍線・小節線。
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
        stroke={isMeasure ? "#5b5b66" : "#3a3a44"}
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
      <div className="panel-head">
        <h2>ピアノロール</h2>
        <div className="group">
          <button
            type="button"
            className={tool === "select" ? "active" : ""}
            onClick={() => setTool("select")}
            title="選択・移動・スクロール（誤入力なし）"
          >
            ✋ 選択
          </button>
          <button
            type="button"
            className={tool === "pen" ? "active" : ""}
            onClick={() => setTool("pen")}
            title="クリックでノート入力"
          >
            ✏ ペン
          </button>
        </div>
      </div>
      <div className="piano-roll-wrap" ref={wrapRef} style={{ maxHeight: 360 }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ display: "block" }}
          role="img"
          aria-label="ピアノロール編集領域"
        >
          {rows}
          {subLines}
          {/* 背景: pen 時のみノート追加。select 時は touch-action:auto でスクロールを許可。 */}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            style={{ touchAction: tool === "pen" ? "none" : "auto" }}
            onPointerDown={onBackgroundPointerDown}
          />
          {measureLines}
          {notes.map((note) => {
            const x = note.start * BEAT_WIDTH;
            const w = Math.max(2, note.duration * BEAT_WIDTH - 1);
            const y = pitchToY(note.pitch);
            const selected = note.id === selectedNoteId;
            return (
              <g key={note.id}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={ROW_HEIGHT - 1}
                  rx={3}
                  fill={selected ? "var(--note-selected)" : "var(--note)"}
                  stroke="#1118"
                  style={{ cursor: "move", touchAction: "none" }}
                  onPointerDown={(e) => beginDrag(e, note, "move")}
                />
                {/* 右端のリサイズハンドル（長さ変更）。 */}
                <rect
                  x={x + w - RESIZE_HANDLE}
                  y={y}
                  width={RESIZE_HANDLE}
                  height={ROW_HEIGHT - 1}
                  fill="transparent"
                  style={{ cursor: "ew-resize", touchAction: "none" }}
                  onPointerDown={(e) => beginDrag(e, note, "resize")}
                />
              </g>
            );
          })}
          {/* 録音中のライブノート（押下中。録音ヘッドまで伸びる）。 */}
          {isRecording &&
            liveNotes.map((ln) => (
              <rect
                key={`live-${ln.pitch}`}
                x={ln.startBeat * BEAT_WIDTH}
                y={pitchToY(ln.pitch)}
                width={Math.max(2, (recordHeadBeats - ln.startBeat) * BEAT_WIDTH)}
                height={ROW_HEIGHT - 1}
                rx={3}
                fill="var(--record)"
                opacity={0.7}
                pointerEvents="none"
              />
            ))}
          {/* 再生ヘッド。 */}
          <line
            x1={playheadBeats * BEAT_WIDTH}
            y1={0}
            x2={playheadBeats * BEAT_WIDTH}
            y2={height}
            stroke="var(--playhead)"
            strokeWidth={2}
            pointerEvents="none"
          />
          {/* 録音ヘッド。 */}
          {isRecording && (
            <line
              x1={recordHeadBeats * BEAT_WIDTH}
              y1={0}
              x2={recordHeadBeats * BEAT_WIDTH}
              y2={height}
              stroke="var(--record)"
              strokeWidth={2}
              pointerEvents="none"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
