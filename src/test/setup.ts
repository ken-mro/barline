import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom は Pointer Capture を実装していないため最小スタブを入れる
// （実ブラウザの Element には存在する）。
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

// jsdom は canvas の 2D コンテキストを実装していないため、VexFlow が
// テキスト寸法計測に使う measureText 等を最小限スタブする。
// （実ブラウザでは本物の Canvas が使われるため不要）
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  measureText: (text: string) => ({
    width: text.length * 8,
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 2,
  }),
  font: "",
  fillText: () => {},
  // VexFlow が触る可能性のあるプロパティへのフォールバック。
  save: () => {},
  restore: () => {},
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
