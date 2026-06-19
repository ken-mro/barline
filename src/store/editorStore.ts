import { create } from "zustand";

/** ピアノロールの操作ツール。 */
export type Tool = "select" | "pen";

/** 録音中に押下中のノート（ライブ表示用）。 */
export interface LiveNote {
  pitch: number;
  startBeat: number;
}

/**
 * 編集 UI の状態（楽曲データではなく操作状態）。
 * 再生位置・ステップ入力カーソル・選択音価・ツール・録音状態などを保持する。
 */
interface EditorState {
  // --- 再生 ---
  isPlaying: boolean;
  /** 再生ヘッド位置（拍）。 */
  playheadBeats: number;

  // --- ステップ入力 ---
  /** ステップ入力のカーソル位置（拍）。 */
  stepCursor: number;
  /** 入力する音価（拍）。1 = 四分音符、0.5 = 八分音符 など。 */
  noteDuration: number;
  /** ピアノロール／ステップ入力のスナップ単位（拍）。 */
  grid: number;
  /** 選択中ノート ID（null で未選択）。 */
  selectedNoteId: string | null;

  // --- ピアノロール ---
  /** 操作ツール（select=移動/スクロール、pen=入力）。 */
  tool: Tool;

  // --- 鍵盤 ---
  /** 白鍵 1 つの横幅(px)。 */
  keyWidth: number;

  // --- 録音 ---
  isRecording: boolean;
  /** 録音前のカウントダウン表示（3→2→1）。null で非表示。 */
  countdown: number | null;
  /** 録音ヘッド位置（拍。カウントイン中は負）。 */
  recordHeadBeats: number;
  /** 録音中に押下中のノート。 */
  liveNotes: LiveNote[];
  /** メトロノームを鳴らす。 */
  metronome: boolean;
  /** 録音前に 1 小節のカウントインを入れる。 */
  countIn: boolean;
  /** 録音中に既存ノートを再生する（オーバーダブ）。 */
  overdub: boolean;

  // --- setters ---
  setIsPlaying: (v: boolean) => void;
  setPlayheadBeats: (b: number) => void;
  setStepCursor: (b: number) => void;
  setNoteDuration: (d: number) => void;
  setGrid: (g: number) => void;
  selectNote: (id: string | null) => void;
  setTool: (t: Tool) => void;
  setKeyWidth: (w: number) => void;
  setIsRecording: (v: boolean) => void;
  setCountdown: (v: number | null) => void;
  setRecordHeadBeats: (b: number) => void;
  setLiveNotes: (n: LiveNote[]) => void;
  setMetronome: (v: boolean) => void;
  setCountIn: (v: boolean) => void;
  setOverdub: (v: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  isPlaying: false,
  playheadBeats: 0,
  stepCursor: 0,
  noteDuration: 1,
  grid: 0.25,
  selectedNoteId: null,
  tool: "select",
  keyWidth: 34,
  isRecording: false,
  countdown: null,
  recordHeadBeats: 0,
  liveNotes: [],
  metronome: true,
  countIn: true,
  overdub: true,

  setIsPlaying: (v) => set({ isPlaying: v }),
  setPlayheadBeats: (b) => set({ playheadBeats: b }),
  setStepCursor: (b) => set({ stepCursor: Math.max(0, b) }),
  setNoteDuration: (d) => set({ noteDuration: d }),
  setGrid: (g) => set({ grid: g }),
  selectNote: (id) => set({ selectedNoteId: id }),
  setTool: (t) => set({ tool: t }),
  setKeyWidth: (w) => set({ keyWidth: Math.max(20, Math.min(60, w)) }),
  setIsRecording: (v) => set({ isRecording: v }),
  setCountdown: (v) => set({ countdown: v }),
  setRecordHeadBeats: (b) => set({ recordHeadBeats: b }),
  setLiveNotes: (n) => set({ liveNotes: n }),
  setMetronome: (v) => set({ metronome: v }),
  setCountIn: (v) => set({ countIn: v }),
  setOverdub: (v) => set({ overdub: v }),
}));
