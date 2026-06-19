import { type PointerEvent as ReactPointerEvent, useRef } from "react";
import { ensureStarted, previewNote } from "../audio/engine";
import { useRecorderContext } from "../hooks/recorderContext";
import { useEditorStore } from "../store/editorStore";
import { useSongStore } from "../store/songStore";

/**
 * 画面上のピアノ鍵盤。
 * - 通常時: クリックでステップ入力（stepCursor 位置にノート追加し進める）
 * - 録音中: 押し続けでリアルタイム録音（pointerdown=noteOn / up=noteOff）
 * キーの横幅は editorStore.keyWidth で調整できる。
 */

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_OFFSETS = [1, 3, 6, 8, 10];
const START_OCTAVE = 3;
const OCTAVE_COUNT = 3;
const WHITE_HEIGHT = 100;
const BLACK_HEIGHT = 62;
const BLACK_RATIO = 22 / 34;

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function pitchLabel(pitch: number): string {
  return `${NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

export function Keyboard() {
  const addNote = useSongStore((s) => s.addNote);
  const noteDuration = useEditorStore((s) => s.noteDuration);
  const stepCursor = useEditorStore((s) => s.stepCursor);
  const setStepCursor = useEditorStore((s) => s.setStepCursor);
  const selectNote = useEditorStore((s) => s.selectNote);
  const keyWidth = useEditorStore((s) => s.keyWidth);
  const setKeyWidth = useEditorStore((s) => s.setKeyWidth);
  const isRecording = useEditorStore((s) => s.isRecording);
  const recorder = useRecorderContext();

  // 録音中の pointerId → pitch（マルチタッチ和音対応）。
  const activePointers = useRef<Map<number, number>>(new Map());

  const whiteWidth = keyWidth;
  const blackWidth = Math.round(keyWidth * BLACK_RATIO);

  const whiteKeys: number[] = [];
  const blackKeys: { pitch: number; leftWhiteIndex: number }[] = [];

  for (let o = 0; o < OCTAVE_COUNT; o++) {
    const base = (START_OCTAVE + 1 + o) * 12; // MIDI: C(START_OCTAVE) = (oct+1)*12
    for (const off of WHITE_OFFSETS) whiteKeys.push(base + off);
    for (const off of BLACK_OFFSETS) {
      const pitch = base + off;
      const whitesBefore = WHITE_OFFSETS.filter((w) => w < off).length - 1;
      blackKeys.push({ pitch, leftWhiteIndex: o * 7 + whitesBefore });
    }
  }

  const press = (e: ReactPointerEvent<SVGRectElement | HTMLButtonElement>, pitch: number) => {
    if (isRecording) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointers.current.set(e.pointerId, pitch);
      recorder.noteOn(pitch);
      return;
    }
    // ステップ入力（押下時に確定）。
    void ensureStarted().then(() => previewNote(pitch));
    const id = addNote({ pitch, start: stepCursor, duration: noteDuration, velocity: 96 });
    selectNote(id);
    setStepCursor(stepCursor + noteDuration);
  };

  const release = (e: ReactPointerEvent<SVGRectElement | HTMLButtonElement>) => {
    const pitch = activePointers.current.get(e.pointerId);
    if (pitch === undefined) return;
    activePointers.current.delete(e.pointerId);
    recorder.noteOff(pitch);
  };

  const totalWidth = whiteKeys.length * whiteWidth;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>鍵盤{isRecording ? "（録音中：押すと記録）" : "（クリックでステップ入力）"}</h2>
        <div className="group">
          <span className="label">鍵盤幅</span>
          <input
            type="range"
            min={20}
            max={60}
            value={keyWidth}
            onChange={(e) => setKeyWidth(Number(e.target.value))}
            aria-label="鍵盤の横幅"
          />
        </div>
      </div>
      <div className="keyboard">
        <div style={{ position: "relative", width: totalWidth, height: WHITE_HEIGHT }}>
          {whiteKeys.map((pitch, i) => (
            <button
              key={pitch}
              type="button"
              title={pitchLabel(pitch)}
              onPointerDown={(e) => press(e, pitch)}
              onPointerUp={release}
              onPointerCancel={release}
              style={{
                position: "absolute",
                left: i * whiteWidth,
                top: 0,
                width: whiteWidth - 1,
                height: WHITE_HEIGHT,
                background: "var(--white-key)",
                color: "#333",
                borderRadius: "0 0 4px 4px",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 4,
                fontSize: 10,
                touchAction: "none",
              }}
            >
              {pitch % 12 === 0 ? pitchLabel(pitch) : ""}
            </button>
          ))}
          {blackKeys.map(({ pitch, leftWhiteIndex }) => (
            <button
              key={pitch}
              type="button"
              title={pitchLabel(pitch)}
              onPointerDown={(e) => press(e, pitch)}
              onPointerUp={release}
              onPointerCancel={release}
              style={{
                position: "absolute",
                left: (leftWhiteIndex + 1) * whiteWidth - blackWidth / 2,
                top: 0,
                width: blackWidth,
                height: BLACK_HEIGHT,
                background: "var(--black-key)",
                border: "1px solid #000",
                borderRadius: "0 0 4px 4px",
                zIndex: 2,
                touchAction: "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
