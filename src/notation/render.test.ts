import { describe, expect, it } from "vitest";
import type { Song } from "../types/song";
import { renderNotation } from "./render";

function makeSong(notes: Song["tracks"][number]["notes"]): Song {
  return {
    tempo: 120,
    timeSignature: [4, 4],
    ppq: 480,
    tracks: [{ id: "t1", name: "T", instrument: "piano", notes }],
  };
}

describe("renderNotation (runtime smoke test)", () => {
  it("空トラックでも SVG を描画する", () => {
    const container = document.createElement("div");
    renderNotation(container, makeSong([]), "t1", 800);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("ノートありで音符要素（path）を含む SVG を描画する", () => {
    const container = document.createElement("div");
    const song = makeSong([
      { id: "n1", pitch: 60, start: 0, duration: 1, velocity: 96 },
      { id: "n2", pitch: 64, start: 1, duration: 1, velocity: 96 },
      { id: "n3", pitch: 67, start: 2, duration: 2, velocity: 96 },
    ]);
    renderNotation(container, song, "t1", 800);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // VexFlow は五線・符頭・符幹を path/rect として描画する。
    expect(svg?.querySelectorAll("path").length ?? 0).toBeGreaterThan(0);
  });

  it("再描画でコンテナがクリアされ SVG は 1 つだけ", () => {
    const container = document.createElement("div");
    renderNotation(container, makeSong([]), "t1", 800);
    renderNotation(container, makeSong([]), "t1", 800);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });
});
