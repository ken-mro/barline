import { describe, expect, it } from "vitest";
import type { Song } from "../types/song";
import { songToMidi, songToMidiBytes } from "./export";
import { midiToSong } from "./import";

const song: Song = {
  tempo: 140,
  timeSignature: [3, 4],
  ppq: 480,
  tracks: [
    {
      id: "t1",
      name: "Lead",
      instrument: "acoustic_grand_piano",
      notes: [
        { id: "n1", pitch: 60, start: 0, duration: 1, velocity: 100 },
        { id: "n2", pitch: 64, start: 1, duration: 0.5, velocity: 80 },
      ],
    },
  ],
};

describe("songToMidi", () => {
  it("テンポ・拍子・ノートが反映される", () => {
    const midi = songToMidi(song);
    expect(midi.header.tempos[0].bpm).toBeCloseTo(140);
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([3, 4]);
    expect(midi.tracks[0].notes).toHaveLength(2);
    expect(midi.tracks[0].notes[0].midi).toBe(60);
  });

  it("拍 → tick 変換が PPQ に従う", () => {
    const midi = songToMidi(song);
    // start 1 拍 = 1 * 480 tick
    expect(midi.tracks[0].notes[1].ticks).toBe(480);
  });
});

describe("round-trip (export → import)", () => {
  it("書き出して読み戻すと同等の Song になる", () => {
    const bytes = songToMidiBytes(song);
    const restored = midiToSong(bytes);
    expect(restored.tempo).toBeCloseTo(140);
    expect(restored.timeSignature).toEqual([3, 4]);
    expect(restored.tracks[0].notes).toHaveLength(2);
    expect(restored.tracks[0].notes[0].pitch).toBe(60);
    expect(restored.tracks[0].notes[0].start).toBeCloseTo(0);
    expect(restored.tracks[0].notes[1].start).toBeCloseTo(1);
    expect(restored.tracks[0].notes[1].duration).toBeCloseTo(0.5);
  });
});
