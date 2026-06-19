import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("主要パネルがクラッシュせず描画される", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "barline" })).toBeInTheDocument();
    // トランスポートの録音ボタン（RecorderContext 配線の確認）。
    expect(screen.getByRole("button", { name: "● 録音" })).toBeInTheDocument();
    // ツール切替（ピアノロール）。
    expect(screen.getByRole("button", { name: "✋ 選択" })).toBeInTheDocument();
  });
});
