import { ensureStarted, previewNote } from "../audio/engine";
import { useEditorStore } from "../store/editorStore";
import { useSongStore } from "../store/songStore";

/**
 * 画面上のピアノ鍵盤。
 * クリックでプレビュー発音し、ステップカーソル位置にノートを追加して
 * カーソルを音価ぶん進める（= 画面鍵盤入力 / ステップ入力を兼ねる）。
 */

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_OFFSETS = [1, 3, 6, 8, 10];
const START_OCTAVE = 3;
const OCTAVE_COUNT = 3;

const WHITE_WIDTH = 34;
const BLACK_WIDTH = 22;

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

  const whiteKeys: number[] = [];
  const blackKeys: { pitch: number; leftWhiteIndex: number }[] = [];

  for (let o = 0; o < OCTAVE_COUNT; o++) {
    const base = (START_OCTAVE + 1 + o) * 12; // MIDI: C(START_OCTAVE) = (oct+1)*12
    for (const off of WHITE_OFFSETS) whiteKeys.push(base + off);
    for (const off of BLACK_OFFSETS) {
      const pitch = base + off;
      // この黒鍵の左隣の白鍵が whiteKeys の何番目か。
      const whitesBefore = WHITE_OFFSETS.filter((w) => w < off).length - 1;
      blackKeys.push({ pitch, leftWhiteIndex: o * 7 + whitesBefore });
    }
  }

  const handlePress = (pitch: number) => {
    void ensureStarted().then(() => previewNote(pitch));
    const id = addNote({ pitch, start: stepCursor, duration: noteDuration, velocity: 96 });
    selectNote(id);
    setStepCursor(stepCursor + noteDuration);
  };

  const totalWidth = whiteKeys.length * WHITE_WIDTH;

  return (
    <div className="panel">
      <h2>鍵盤（クリックでステップ入力）</h2>
      <div className="keyboard">
        <div style={{ position: "relative", width: totalWidth, height: 100 }}>
          {whiteKeys.map((pitch, i) => (
            <button
              key={pitch}
              type="button"
              title={pitchLabel(pitch)}
              onClick={() => handlePress(pitch)}
              style={{
                position: "absolute",
                left: i * WHITE_WIDTH,
                top: 0,
                width: WHITE_WIDTH - 1,
                height: 100,
                background: "var(--white-key)",
                color: "#333",
                borderRadius: "0 0 4px 4px",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 4,
                fontSize: 10,
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
              onClick={() => handlePress(pitch)}
              style={{
                position: "absolute",
                left: (leftWhiteIndex + 1) * WHITE_WIDTH - BLACK_WIDTH / 2,
                top: 0,
                width: BLACK_WIDTH,
                height: 62,
                background: "var(--black-key)",
                border: "1px solid #000",
                borderRadius: "0 0 4px 4px",
                zIndex: 2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
