import { create } from "zustand";
import type { Note, Song, TimeSignature } from "../types/song";

/** 一意 ID 生成（crypto.randomUUID が無い環境のフォールバック付き）。 */
export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 新規プロジェクトの初期 Song。 */
export function createInitialSong(): Song {
  return {
    tempo: 120,
    timeSignature: [4, 4],
    ppq: 480,
    tracks: [
      {
        id: createId(),
        name: "Track 1",
        instrument: "acoustic_grand_piano",
        notes: [],
      },
    ],
  };
}

const initialSong = createInitialSong();

interface SongState {
  song: Song;
  /** 現在編集中のトラック ID。 */
  selectedTrackId: string;

  // --- ソング設定 ---
  setTempo: (tempo: number) => void;
  setTimeSignature: (ts: TimeSignature) => void;

  // --- トラック選択 ---
  selectTrack: (trackId: string) => void;

  // --- ノート編集 ---
  /** ノートを追加し、生成された ID を返す。trackId 省略時は選択中トラック。 */
  addNote: (note: Omit<Note, "id">, trackId?: string) => string;
  updateNote: (noteId: string, patch: Partial<Omit<Note, "id">>) => void;
  removeNote: (noteId: string) => void;
  clearNotes: (trackId?: string) => void;

  /** 楽曲全体を差し替える（MIDI インポートなどで使用）。 */
  loadSong: (song: Song) => void;
}

/** 操作対象トラック ID を解決する（指定 → 選択中 → 先頭の順）。 */
function resolveTrackId(s: SongState, trackId?: string): string {
  return trackId ?? s.selectedTrackId ?? s.song.tracks[0]?.id ?? "";
}

export const useSongStore = create<SongState>((set, get) => ({
  song: initialSong,
  selectedTrackId: initialSong.tracks[0]?.id ?? "",

  setTempo: (tempo) =>
    set((s) => ({ song: { ...s.song, tempo: Math.max(20, Math.min(300, tempo)) } })),

  setTimeSignature: (ts) => set((s) => ({ song: { ...s.song, timeSignature: ts } })),

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  addNote: (note, trackId) => {
    const id = createId();
    const targetId = resolveTrackId(get(), trackId);
    set((s) => ({
      song: {
        ...s.song,
        tracks: s.song.tracks.map((t) =>
          t.id === targetId ? { ...t, notes: [...t.notes, { ...note, id }] } : t,
        ),
      },
    }));
    return id;
  },

  updateNote: (noteId, patch) =>
    set((s) => ({
      song: {
        ...s.song,
        tracks: s.song.tracks.map((t) => ({
          ...t,
          notes: t.notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n)),
        })),
      },
    })),

  removeNote: (noteId) =>
    set((s) => ({
      song: {
        ...s.song,
        tracks: s.song.tracks.map((t) => ({
          ...t,
          notes: t.notes.filter((n) => n.id !== noteId),
        })),
      },
    })),

  clearNotes: (trackId) => {
    const targetId = resolveTrackId(get(), trackId);
    set((s) => ({
      song: {
        ...s.song,
        tracks: s.song.tracks.map((t) => (t.id === targetId ? { ...t, notes: [] } : t)),
      },
    }));
  },

  loadSong: (song) => set({ song, selectedTrackId: song.tracks[0]?.id ?? "" }),
}));
