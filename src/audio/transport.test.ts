import { describe, expect, it } from "vitest";
import { beatsToSeconds, secondsToBeats } from "./transport";

describe("beats <-> seconds 変換", () => {
  it("120BPM で 2 拍 = 1 秒", () => {
    expect(beatsToSeconds(2, 120)).toBeCloseTo(1);
    expect(secondsToBeats(1, 120)).toBeCloseTo(2);
  });

  it("往復で元に戻る", () => {
    const beats = 3.5;
    expect(secondsToBeats(beatsToSeconds(beats, 90), 90)).toBeCloseTo(beats);
  });
});
