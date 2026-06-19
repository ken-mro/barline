import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "../store/editorStore";
import { createInitialSong, useSongStore } from "../store/songStore";
import { PianoRoll } from "./PianoRoll";

// PianoRoll の座標定数（コンポーネントと一致させる）。
const BEAT_WIDTH = 40;
const ROW_HEIGHT = 22;
const PITCH_MAX = 84;
const pitchToY = (p: number) => (PITCH_MAX - 1 - p) * ROW_HEIGHT;

const editorInitial = useEditorStore.getState();

beforeEach(() => {
  const song = createInitialSong();
  const trackId = song.tracks[0].id;
  song.tracks[0].notes = [{ id: "n1", pitch: 60, start: 1, duration: 1, velocity: 96 }];
  useSongStore.setState({ song, selectedTrackId: trackId });
  useEditorStore.setState({ ...editorInitial, grid: 0.25 }, true);
});

afterEach(() => {
  useEditorStore.setState(editorInitial, true);
});

function getNote() {
  return useSongStore.getState().song.tracks[0].notes[0];
}

/**
 * jsdom には PointerEvent が無いため、clientX を運べる MouseEvent を
 * pointer 種別の type で発火し、pointerId を付与する。
 */
function dispatchPointer(target: EventTarget, type: string, x: number, y: number, pointerId = 1) {
  const ev = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.defineProperty(ev, "pointerId", { value: pointerId, configurable: true });
  act(() => {
    target.dispatchEvent(ev);
  });
}

function center(handle: "move" | "left" | "right") {
  const n = getNote();
  const x =
    handle === "move"
      ? (n.start + n.duration / 2) * BEAT_WIDTH
      : handle === "left"
        ? n.start * BEAT_WIDTH + 2
        : (n.start + n.duration) * BEAT_WIDTH - 2;
  const y = pitchToY(n.pitch) + ROW_HEIGHT / 2;
  return { x, y };
}

describe("PianoRoll ドラッグ操作（結合）", () => {
  it("中央ドラッグでノートが右に移動する", () => {
    const { container } = render(<PianoRoll />);
    const move = container.querySelector('[data-note-handle="move"]') as Element;
    expect(move).toBeTruthy();
    const s = center("move");
    dispatchPointer(move, "pointerdown", s.x, s.y);
    dispatchPointer(window, "pointermove", s.x + 2 * BEAT_WIDTH, s.y);
    dispatchPointer(window, "pointerup", s.x + 2 * BEAT_WIDTH, s.y);
    expect(getNote().start).toBeCloseTo(3);
    expect(getNote().duration).toBeCloseTo(1);
  });

  it("右端ドラッグで長さが伸びる", () => {
    const { container } = render(<PianoRoll />);
    const right = container.querySelector('[data-note-handle="right"]') as Element;
    const s = center("right");
    dispatchPointer(right, "pointerdown", s.x, s.y);
    dispatchPointer(window, "pointermove", s.x + 2 * BEAT_WIDTH, s.y);
    dispatchPointer(window, "pointerup", s.x + 2 * BEAT_WIDTH, s.y);
    expect(getNote().start).toBeCloseTo(1);
    expect(getNote().duration).toBeCloseTo(3);
  });

  it("左端ドラッグで右端を固定して開始位置が動く", () => {
    const { container } = render(<PianoRoll />);
    const left = container.querySelector('[data-note-handle="left"]') as Element;
    const s = center("left");
    dispatchPointer(left, "pointerdown", s.x, s.y);
    dispatchPointer(window, "pointermove", s.x - 0.5 * BEAT_WIDTH, s.y);
    dispatchPointer(window, "pointerup", s.x - 0.5 * BEAT_WIDTH, s.y);
    const n = getNote();
    expect(n.start).toBeCloseTo(0.5);
    expect(n.start + n.duration).toBeCloseTo(2);
  });
});
