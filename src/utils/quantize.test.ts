import { describe, expect, it } from "vitest";
import type { Note } from "../types/song";
import { decomposeDuration, measureBeats, midiToVexKey, quantizeTrackToMeasures } from "./quantize";

const note = (pitch: number, start: number, duration: number): Note => ({
  id: `${pitch}-${start}`,
  pitch,
  start,
  duration,
  velocity: 96,
});

describe("midiToVexKey", () => {
  it("C4 (60) → c/4", () => expect(midiToVexKey(60)).toBe("c/4"));
  it("C#5 (73) → c#/5", () => expect(midiToVexKey(73)).toBe("c#/5"));
  it("A0 (21) → a/0", () => expect(midiToVexKey(21)).toBe("a/0"));
});

describe("measureBeats", () => {
  it("4/4 → 4", () => expect(measureBeats([4, 4])).toBe(4));
  it("3/4 → 3", () => expect(measureBeats([3, 4])).toBe(3));
  it("6/8 → 3", () => expect(measureBeats([6, 8])).toBe(3));
});

describe("decomposeDuration", () => {
  it("4 拍 → 全音符", () => {
    expect(decomposeDuration(4)).toEqual([{ code: "w", dots: 0 }]);
  });
  it("1.5 拍 → 付点4分", () => {
    expect(decomposeDuration(1.5)).toEqual([{ code: "q", dots: 1 }]);
  });
  it("2.5 拍 → 2分 + 8分", () => {
    expect(decomposeDuration(2.5)).toEqual([
      { code: "h", dots: 0 },
      { code: "8", dots: 0 },
    ]);
  });
});

describe("quantizeTrackToMeasures", () => {
  it("4/4 で 4 つの四分音符を 1 小節に並べる", () => {
    const notes = [note(60, 0, 1), note(62, 1, 1), note(64, 2, 1), note(65, 3, 1)];
    const measures = quantizeTrackToMeasures(notes, [4, 4]);
    expect(measures).toHaveLength(1);
    expect(measures[0].elements).toHaveLength(4);
    expect(measures[0].elements.every((e) => e.type === "note")).toBe(true);
    expect(measures[0].elements[0].keys).toEqual(["c/4"]);
  });

  it("先頭の隙間を休符で埋める", () => {
    const measures = quantizeTrackToMeasures([note(60, 1, 1)], [4, 4]);
    expect(measures[0].elements[0].type).toBe("rest");
  });

  it("同時発音はコード（複数キー）になる", () => {
    const measures = quantizeTrackToMeasures([note(60, 0, 4), note(64, 0, 4)], [4, 4]);
    const first = measures[0].elements[0];
    expect(first.type).toBe("note");
    expect(first.keys.sort()).toEqual(["c/4", "e/4"]);
  });

  it("空トラックは 1 小節の全休符になる", () => {
    const measures = quantizeTrackToMeasures([], [4, 4]);
    expect(measures).toHaveLength(1);
    expect(measures[0].elements[0]).toMatchObject({ type: "rest", duration: "w" });
  });

  it("2 小節をまたぐ長さは小節境界で分割される", () => {
    const measures = quantizeTrackToMeasures([note(60, 3, 2)], [4, 4]);
    expect(measures).toHaveLength(2);
    // 1 小節目の末尾と 2 小節目の先頭にノートが現れる。
    const lastOfFirst = measures[0].elements.at(-1);
    expect(lastOfFirst?.type).toBe("note");
    expect(measures[1].elements[0].type).toBe("note");
  });

  it("grid を変えると量子化結果が変わる", () => {
    const n = [note(60, 0.25, 1)];
    // 粗いグリッド(1拍)では 0.25 → 0 にスナップし、先頭からノート。
    const coarse = quantizeTrackToMeasures(n, [4, 4], 1);
    expect(coarse[0].elements[0].type).toBe("note");
    // 細かいグリッド(1/16)では 0.25 のまま、先頭に休符が入る。
    const fine = quantizeTrackToMeasures(n, [4, 4], 0.25);
    expect(fine[0].elements[0].type).toBe("rest");
  });
});
