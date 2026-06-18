import { useEditorStore } from "../store/editorStore";

/**
 * ステップ入力の操作パネル。
 * 音価の選択・カーソル移動・休符挿入を行う。実際の音高入力は Keyboard が担う。
 */

const DURATIONS: { label: string; beats: number }[] = [
  { label: "全音符", beats: 4 },
  { label: "2分", beats: 2 },
  { label: "付点4分", beats: 1.5 },
  { label: "4分", beats: 1 },
  { label: "付点8分", beats: 0.75 },
  { label: "8分", beats: 0.5 },
  { label: "16分", beats: 0.25 },
];

const GRIDS: { label: string; beats: number }[] = [
  { label: "1/4", beats: 1 },
  { label: "1/8", beats: 0.5 },
  { label: "1/16", beats: 0.25 },
];

export function StepInput() {
  const noteDuration = useEditorStore((s) => s.noteDuration);
  const setNoteDuration = useEditorStore((s) => s.setNoteDuration);
  const grid = useEditorStore((s) => s.grid);
  const setGrid = useEditorStore((s) => s.setGrid);
  const stepCursor = useEditorStore((s) => s.stepCursor);
  const setStepCursor = useEditorStore((s) => s.setStepCursor);

  return (
    <div className="panel">
      <h2>ステップ入力</h2>
      <div className="toolbar">
        <div className="group">
          <span className="label">音価</span>
          {DURATIONS.map((d) => (
            <button
              key={d.beats}
              type="button"
              className={noteDuration === d.beats ? "active" : ""}
              onClick={() => setNoteDuration(d.beats)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="spacer" />

        <div className="group">
          <span className="label">グリッド</span>
          {GRIDS.map((g) => (
            <button
              key={g.beats}
              type="button"
              className={grid === g.beats ? "active" : ""}
              onClick={() => setGrid(g.beats)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 10 }}>
        <div className="group">
          <span className="label">カーソル</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{stepCursor.toFixed(2)} 拍</span>
        </div>
        <button type="button" onClick={() => setStepCursor(stepCursor - noteDuration)}>
          ← 戻る
        </button>
        <button type="button" onClick={() => setStepCursor(stepCursor + noteDuration)}>
          休符 →
        </button>
        <button type="button" onClick={() => setStepCursor(0)}>
          先頭へ
        </button>
      </div>
    </div>
  );
}
