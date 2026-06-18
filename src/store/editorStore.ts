import { create } from "zustand";

/**
 * 編集 UI の状態（楽曲データではなく操作状態）。
 * 再生位置・ステップ入力カーソル・選択音価などを保持する。
 */
interface EditorState {
  /** 再生中かどうか。 */
  isPlaying: boolean;
  /** 再生ヘッド位置（拍）。 */
  playheadBeats: number;
  /** ステップ入力のカーソル位置（拍）。 */
  stepCursor: number;
  /** 入力する音価（拍）。1 = 四分音符、0.5 = 八分音符 など。 */
  noteDuration: number;
  /** ピアノロール／ステップ入力のスナップ単位（拍）。 */
  grid: number;
  /** 選択中ノート ID（null で未選択）。 */
  selectedNoteId: string | null;

  setIsPlaying: (v: boolean) => void;
  setPlayheadBeats: (b: number) => void;
  setStepCursor: (b: number) => void;
  setNoteDuration: (d: number) => void;
  setGrid: (g: number) => void;
  selectNote: (id: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  isPlaying: false,
  playheadBeats: 0,
  stepCursor: 0,
  noteDuration: 1,
  grid: 0.25,
  selectedNoteId: null,

  setIsPlaying: (v) => set({ isPlaying: v }),
  setPlayheadBeats: (b) => set({ playheadBeats: b }),
  setStepCursor: (b) => set({ stepCursor: Math.max(0, b) }),
  setNoteDuration: (d) => set({ noteDuration: d }),
  setGrid: (g) => set({ grid: g }),
  selectNote: (id) => set({ selectedNoteId: id }),
}));
