import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ensureStarted, previewNote } from "../audio/engine";
import { useEditorStore } from "../store/editorStore";
import { useSongStore } from "../store/songStore";
import type { Note } from "../types/song";
import { measureBeats } from "../utils/quantize";

/**
 * SVG ベースのピアノロール編集。
 * - ツール = pen: 空白クリックで現在の音価のノート追加
 * - ツール = select: 空白は不活性（スクロール優先）。誤入力を防ぐ。
 * - ノート中央をドラッグ: 移動（音高・位置）
 * - ノート左端/右端をドラッグ: 長さ変更（両端対応）
 * - ノート選択中に Delete/Backspace: 削除
 *
 * スムーズさのため、ドラッグ中はローカルのプレビュー状態のみ更新し（ソング
 * ストアは書き換えない＝譜面の再描画が走らない）、確定時に 1 度だけ commit する。
 */

const ROW_HEIGHT = 22;
const GUTTER_W = 40; // 左の音高ラベル固定ガター幅
const PITCH_MAX = 84; // C6
const PITCH_MIN = 48; // C3
const MIN_BEATS = 16;
// リサイズ用の当たり判定幅（タッチでも掴みやすいよう広め）。
const TOUCH_HANDLE = 14;

type DragMode = "move" | "resize-left" | "resize-right";

interface DragState {
  mode: DragMode;
  pointerId: number;
  noteId: string;
  startPointerBeat: number;
  startPointerPitch: number;
  origStart: number;
  origPitch: number;
  origDuration: number;
}

/** ドラッグ中のプレビュー値。 */
interface DragPreview {
  noteId: string;
  start: number;
  duration: number;
  pitch: number;
}

function snapTo(value: number, grid: number): number {
  return Math.max(0, Math.round(value / grid) * grid);
}

// 縦方向の座標変換は定数のみに依存する純粋関数。横方向(拍↔px)はズーム
// (pxPerBeat)に依存するためコンポーネント内で定義する。
const yToPitch = (y: number) => PITCH_MAX - 1 - Math.floor(y / ROW_HEIGHT);
const pitchToY = (pitch: number) => (PITCH_MAX - 1 - pitch) * ROW_HEIGHT;
const clampPitch = (p: number) => Math.min(PITCH_MAX - 1, Math.max(PITCH_MIN, p));

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
  const pxPerBeat = useEditorStore((s) => s.pxPerBeat);
  const setPxPerBeat = useEditorStore((s) => s.setPxPerBeat);
  const isRecording = useEditorStore((s) => s.isRecording);
  const recordHeadBeats = useEditorStore((s) => s.recordHeadBeats);
  const liveNotes = useEditorStore((s) => s.liveNotes);

  // 横方向の座標変換（ズーム連動）。pxPerBeat が変わったときだけ作り直す。
  const xToBeat = useCallback((x: number) => x / pxPerBeat, [pxPerBeat]);

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const previewRef = useRef<DragPreview | null>(null);
  // 選択モードで空白をドラッグしたときのパン（自前スクロール）状態。
  const pan = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const [preview, setPreview] = useState<DragPreview | null>(null);

  // プレビューは ref と state の両方に持つ（ref は commit 時に参照、state は描画用）。
  const applyPreview = (p: DragPreview | null) => {
    previewRef.current = p;
    setPreview(p);
  };

  const track = song.tracks.find((t) => t.id === selectedTrackId) ?? song.tracks[0];
  const notes = track?.notes ?? [];

  const mBeats = measureBeats(song.timeSignature);
  const contentEnd = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
  const totalBeats = Math.max(
    MIN_BEATS,
    Math.ceil(Math.max(contentEnd, recordHeadBeats) / mBeats) * mBeats + mBeats,
  );
  const pitchRows = PITCH_MAX - PITCH_MIN;

  const width = totalBeats * pxPerBeat;
  const height = pitchRows * ROW_HEIGHT;

  // 背景での pointerdown。
  // - pen: ノート追加
  // - select: パン開始（自前スクロール）。SVG は touch-action:none のため
  //   タッチでも確実にドラッグでき、空白ドラッグでスクロールできる。
  const onBackgroundPointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (tool !== "pen") {
      selectNote(null);
      const wrap = wrapRef.current;
      if (wrap && !pan.current && !drag.current) {
        pan.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startLeft: wrap.scrollLeft,
          startTop: wrap.scrollTop,
        };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // 無視
        }
      }
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
    // 既にドラッグ中なら 2 本目のポインタは無視（マルチタッチで掴みが奪われるのを防ぐ）。
    if (drag.current) return;
    selectNote(note.id);
    // ポインタキャプチャは「あれば便利」程度。失敗してもドラッグ自体は
    // window のリスナーで成立するため、例外でドラッグが始まらない事故を防ぐ。
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 無視
    }
    const { x, y } = clientToLocal(svgRef.current, e.clientX, e.clientY);
    drag.current = {
      mode,
      pointerId: e.pointerId,
      noteId: note.id,
      startPointerBeat: xToBeat(x),
      startPointerPitch: yToPitch(y),
      origStart: note.start,
      origPitch: note.pitch,
      origDuration: note.duration,
    };
    applyPreview({
      noteId: note.id,
      start: note.start,
      duration: note.duration,
      pitch: note.pitch,
    });
  };

  // ドラッグ中はプレビューのみ更新（ストアは触らない）。確定は pointerup。
  useEffect(() => {
    const computePreview = (e: PointerEvent): DragPreview | null => {
      const d = drag.current;
      if (!d) return null;
      const { x, y } = clientToLocal(svgRef.current, e.clientX, e.clientY);
      const deltaBeat = xToBeat(x) - d.startPointerBeat;
      const origEnd = d.origStart + d.origDuration;
      if (d.mode === "move") {
        const deltaPitch = yToPitch(y) - d.startPointerPitch;
        return {
          noteId: d.noteId,
          start: snapTo(d.origStart + deltaBeat, grid),
          duration: d.origDuration,
          pitch: clampPitch(d.origPitch + deltaPitch),
        };
      }
      if (d.mode === "resize-right") {
        return {
          noteId: d.noteId,
          start: d.origStart,
          duration: Math.max(grid, snapTo(d.origDuration + deltaBeat, grid)),
          pitch: d.origPitch,
        };
      }
      // resize-left: 右端を固定して開始位置と長さを変える。
      // 先にクランプしてからスナップすることで、右端が非グリッド（録音/取込ノート）でも
      // 開始位置はグリッドに整列する。
      const rawStart = Math.min(d.origStart + deltaBeat, origEnd - grid);
      const newStart = snapTo(rawStart, grid);
      return {
        noteId: d.noteId,
        start: newStart,
        duration: Math.max(grid, origEnd - newStart),
        pitch: d.origPitch,
      };
    };

    const onMove = (e: PointerEvent) => {
      // パン（空白ドラッグでスクロール）。
      const pn = pan.current;
      if (pn && e.pointerId === pn.pointerId) {
        const wrap = wrapRef.current;
        if (wrap) {
          wrap.scrollLeft = pn.startLeft - (e.clientX - pn.startX);
          wrap.scrollTop = pn.startTop - (e.clientY - pn.startY);
        }
        return;
      }
      if (!drag.current || e.pointerId !== drag.current.pointerId) return;
      const next = computePreview(e);
      if (next) {
        previewRef.current = next;
        setPreview(next);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (pan.current && e.pointerId === pan.current.pointerId) {
        pan.current = null;
        return;
      }
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      // commit は state updater の外で行う（副作用を updater に入れない）。
      const p = previewRef.current;
      if (p) {
        updateNote(d.noteId, { start: p.start, duration: p.duration, pitch: p.pitch });
      }
      drag.current = null;
      previewRef.current = null;
      setPreview(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [grid, updateNote, xToBeat]);

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
    // svg は左ガター分だけ右にずれているので GUTTER_W を加算する。
    const x = GUTTER_W + head * pxPerBeat;
    const margin = 80;
    if (x > wrap.scrollLeft + wrap.clientWidth - margin) {
      wrap.scrollLeft = x - wrap.clientWidth + margin;
    } else if (x < wrap.scrollLeft + margin) {
      wrap.scrollLeft = Math.max(0, x - margin);
    }
  }, [recordHeadBeats, playheadBeats, isRecording, pxPerBeat]);

  // 静的レイヤー（行・補助線・拍線）はドラッグ中に変わらないので memo 化する。
  const rows = useMemo(() => {
    const out = [];
    for (let p = PITCH_MIN; p < PITCH_MAX; p++) {
      const isBlack = [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
      out.push(
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
    return out;
  }, [width]);

  const subLines = useMemo(() => {
    const out = [];
    if (grid < 1) {
      for (let b = 0; b <= totalBeats + 1e-9; b += grid) {
        if (Math.abs(b - Math.round(b)) < 1e-6) continue; // 拍線は別途描画
        out.push(
          <line
            key={`sub-${b}`}
            x1={b * pxPerBeat}
            y1={0}
            x2={b * pxPerBeat}
            y2={height}
            stroke="#2c2c34"
            strokeWidth={1}
          />,
        );
      }
    }
    return out;
  }, [grid, totalBeats, height, pxPerBeat]);

  const measureLines = useMemo(() => {
    const out = [];
    for (let b = 0; b <= totalBeats; b += 1) {
      const isMeasure = Math.abs(b % mBeats) < 1e-6;
      out.push(
        <line
          key={`v-${b}`}
          x1={b * pxPerBeat}
          y1={0}
          x2={b * pxPerBeat}
          y2={height}
          stroke={isMeasure ? "#5b5b66" : "#3a3a44"}
          strokeWidth={isMeasure ? 1.5 : 1}
        />,
      );
    }
    return out;
  }, [totalBeats, mBeats, height, pxPerBeat]);

  // 横方向の区切り線。鍵盤と対応づけやすいよう半音間に線を引く:
  // - シ(B)–ド(C): オクターブ区切り（明るく太め）。C 行の下端。
  // - ミ(E)–ファ(F): 拍線と同じ控えめな線。F 行の下端。
  const octaveLines = useMemo(() => {
    const out = [];
    for (let p = PITCH_MIN; p <= PITCH_MAX; p++) {
      const mod = ((p % 12) + 12) % 12;
      const isC = mod === 0;
      const isF = mod === 5;
      if (!isC && !isF) continue;
      const yLine = pitchToY(p) + ROW_HEIGHT;
      out.push(
        <line
          key={`hline-${p}`}
          x1={0}
          y1={yLine}
          x2={width}
          y2={yLine}
          stroke={isC ? "#8a8a98" : "#3a3a44"}
          strokeWidth={isC ? 1.5 : 1}
        />,
      );
    }
    return out;
  }, [width]);

  // 左ガターの音高ラベル（各 C を明示。C3 / C4 …）。
  const pitchLabels = useMemo(() => {
    const out = [];
    for (let p = PITCH_MIN; p < PITCH_MAX; p++) {
      if (((p % 12) + 12) % 12 !== 0) continue; // C のみ
      out.push(
        <div
          key={`label-${p}`}
          className="pr-label"
          style={{ top: pitchToY(p), height: ROW_HEIGHT }}
        >
          {`C${Math.floor(p / 12) - 1}`}
        </div>,
      );
    }
    return out;
  }, []);

  // ドラッグ中はプレビュー値で描画する。
  const effective = (note: Note) =>
    preview && preview.noteId === note.id
      ? { start: preview.start, duration: preview.duration, pitch: preview.pitch }
      : note;

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
          <button
            type="button"
            disabled={!selectedNoteId}
            onClick={() => {
              if (!selectedNoteId) return;
              removeNote(selectedNoteId);
              selectNote(null);
            }}
            title="選択中のノートを削除"
          >
            🗑 削除
          </button>
          <span className="label">横幅</span>
          <input
            type="range"
            min={16}
            max={96}
            value={pxPerBeat}
            onChange={(e) => setPxPerBeat(Number(e.target.value))}
            aria-label="ピアノロールの横幅（ズーム）"
          />
        </div>
      </div>
      <p className="hint">
        {tool === "pen"
          ? "ペン: タップでノート入力。移動/長さ変更は「選択」に切替。"
          : "中央ドラッグ=移動 / 両端ドラッグ=長さ変更 / 空白ドラッグ=スクロール"}
      </p>
      <div className="piano-roll-wrap" ref={wrapRef} style={{ maxHeight: 360 }}>
        <div className="pr-scroll" style={{ width: GUTTER_W + width }}>
          {/* 左固定ガター: 音高ラベル。横スクロールで左に固定、縦は行に追従。 */}
          <div className="pr-gutter" style={{ width: GUTTER_W, height }}>
            {pitchLabels}
          </div>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            // タッチでブラウザのスクロール/ジェスチャに奪われないよう none。
            // スクロールは選択ツールでの空白ドラッグ（自前パン）で行う。
            style={{ display: "block", touchAction: "none" }}
            role="img"
            aria-label="ピアノロール編集領域"
          >
            {rows}
            {subLines}
            {/* 背景: pen=ノート追加 / select=空白ドラッグでパン。 */}
            <rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill="transparent"
              style={{ cursor: tool === "pen" ? "crosshair" : "grab" }}
              onPointerDown={onBackgroundPointerDown}
            />
            {measureLines}
            {octaveLines}
            {notes.map((note) => {
              const e = effective(note);
              const x = e.start * pxPerBeat;
              const w = Math.max(2, e.duration * pxPerBeat - 1);
              const y = pitchToY(e.pitch);
              const h = ROW_HEIGHT - 1;
              const selected = note.id === selectedNoteId;
              // タッチでも掴みやすいよう広めの当たり判定。見た目のグリップは細め。
              const hitW = Math.min(TOUCH_HANDLE, w / 3);
              const gripW = Math.min(4, w / 3);
              const showGrips = w >= 14;
              const showCenter = w >= 28;
              return (
                <g key={note.id}>
                  {/* 本体（移動）。 */}
                  <rect
                    data-note-handle="move"
                    data-note-id={note.id}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={3}
                    fill={selected ? "var(--note-selected)" : "var(--note)"}
                    stroke={selected ? "#fff8" : "#1118"}
                    style={{ cursor: "move" }}
                    onPointerDown={(ev) => beginDrag(ev, note, "move")}
                  />
                  {/* 中央の移動グリップ（点々）。視覚のみ。 */}
                  {showCenter && (
                    <g pointerEvents="none" fill="#ffffffcc">
                      {[-3, 0, 3].map((dx) =>
                        [-3, 3].map((dy) => (
                          <circle
                            key={`${dx}-${dy}`}
                            cx={x + w / 2 + dx}
                            cy={y + h / 2 + dy}
                            r={0.9}
                          />
                        )),
                      )}
                    </g>
                  )}
                  {/* 左右の可視グリップ（リサイズできることを示す縦バー）。 */}
                  {showGrips && (
                    <>
                      <rect
                        pointerEvents="none"
                        x={x + 1.5}
                        y={y + 2}
                        width={gripW}
                        height={h - 4}
                        rx={1}
                        fill="#ffffffcc"
                      />
                      <rect
                        pointerEvents="none"
                        x={x + w - gripW - 1.5}
                        y={y + 2}
                        width={gripW}
                        height={h - 4}
                        rx={1}
                        fill="#ffffffcc"
                      />
                    </>
                  )}
                  {/* 左端の当たり判定（開始位置＝長さ変更）。 */}
                  <rect
                    data-note-handle="left"
                    data-note-id={note.id}
                    x={x}
                    y={y}
                    width={hitW}
                    height={h}
                    fill="transparent"
                    style={{ cursor: "ew-resize" }}
                    onPointerDown={(ev) => beginDrag(ev, note, "resize-left")}
                  />
                  {/* 右端の当たり判定（長さ変更）。 */}
                  <rect
                    data-note-handle="right"
                    data-note-id={note.id}
                    x={x + w - hitW}
                    y={y}
                    width={hitW}
                    height={h}
                    fill="transparent"
                    style={{ cursor: "ew-resize" }}
                    onPointerDown={(ev) => beginDrag(ev, note, "resize-right")}
                  />
                </g>
              );
            })}
            {/* 録音中のライブノート（押下中。録音ヘッドまで伸びる）。 */}
            {isRecording &&
              liveNotes.map((ln) => (
                <rect
                  key={`live-${ln.pitch}`}
                  x={ln.startBeat * pxPerBeat}
                  y={pitchToY(ln.pitch)}
                  width={Math.max(2, (recordHeadBeats - ln.startBeat) * pxPerBeat)}
                  height={ROW_HEIGHT - 1}
                  rx={3}
                  fill="var(--record)"
                  opacity={0.7}
                  pointerEvents="none"
                />
              ))}
            {/* 再生ヘッド。 */}
            <line
              x1={playheadBeats * pxPerBeat}
              y1={0}
              x2={playheadBeats * pxPerBeat}
              y2={height}
              stroke="var(--playhead)"
              strokeWidth={2}
              pointerEvents="none"
            />
            {/* 録音ヘッド。 */}
            {isRecording && (
              <line
                x1={recordHeadBeats * pxPerBeat}
                y1={0}
                x2={recordHeadBeats * pxPerBeat}
                y2={height}
                stroke="var(--record)"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
