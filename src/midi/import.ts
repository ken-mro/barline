import { Midi } from "@tonejs/midi";
import { createId } from "../store/songStore";
import type { Song, TimeSignature } from "../types/song";

/**
 * .mid のバイト列を Song へ変換する。
 *
 * @tonejs/midi のノートは秒・小節・tick など複数表現を持つが、
 * barline の内部単位は拍（四分音符 = 1）なので ticks / ppq で換算する。
 */
export function midiToSong(data: ArrayBuffer | Uint8Array): Song {
  const midi = new Midi(data);
  const ppq = midi.header.ppq;
  const tempo = midi.header.tempos[0]?.bpm ?? 120;
  const ts = midi.header.timeSignatures[0]?.timeSignature;
  const timeSignature: TimeSignature = ts && ts.length === 2 ? [ts[0], ts[1]] : [4, 4];

  const tracks = midi.tracks
    // 音符を持たない（テンポ/メタのみの）トラックは除外。
    .filter((t) => t.notes.length > 0)
    .map((t, i) => ({
      id: createId(),
      name: t.name || `Track ${i + 1}`,
      instrument: t.instrument?.name ?? "acoustic_grand_piano",
      notes: t.notes.map((n) => ({
        id: createId(),
        pitch: n.midi,
        start: n.ticks / ppq,
        duration: n.durationTicks / ppq,
        velocity: Math.round(n.velocity * 127),
      })),
    }));

  return {
    tempo,
    timeSignature,
    ppq,
    tracks: tracks.length > 0 ? tracks : [],
  };
}

/** File オブジェクトを読み込んで Song へ変換する。 */
export async function loadMidiFile(file: File): Promise<Song> {
  const buffer = await file.arrayBuffer();
  return midiToSong(buffer);
}
