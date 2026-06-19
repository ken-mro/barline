import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./editorStore";

const initial = useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState(initial, true);
});

describe("editorStore", () => {
  it("setTool でツールを切り替える", () => {
    useEditorStore.getState().setTool("pen");
    expect(useEditorStore.getState().tool).toBe("pen");
  });

  it("setKeyWidth は 20–60 にクランプする", () => {
    const { setKeyWidth } = useEditorStore.getState();
    setKeyWidth(5);
    expect(useEditorStore.getState().keyWidth).toBe(20);
    setKeyWidth(999);
    expect(useEditorStore.getState().keyWidth).toBe(60);
    setKeyWidth(40);
    expect(useEditorStore.getState().keyWidth).toBe(40);
  });

  it("録音状態とライブノートを更新できる", () => {
    const s = useEditorStore.getState();
    s.setIsRecording(true);
    s.setRecordHeadBeats(2.5);
    s.setLiveNotes([{ pitch: 60, startBeat: 1 }]);
    const next = useEditorStore.getState();
    expect(next.isRecording).toBe(true);
    expect(next.recordHeadBeats).toBeCloseTo(2.5);
    expect(next.liveNotes).toEqual([{ pitch: 60, startBeat: 1 }]);
  });

  it("録音オプションのトグル", () => {
    const s = useEditorStore.getState();
    s.setMetronome(false);
    s.setCountIn(false);
    s.setOverdub(false);
    const next = useEditorStore.getState();
    expect(next.metronome).toBe(false);
    expect(next.countIn).toBe(false);
    expect(next.overdub).toBe(false);
  });
});
