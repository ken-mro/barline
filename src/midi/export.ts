import { Midi } from "@tonejs/midi";
import type { Song } from "../types/song";

/**
 * Song を @tonejs/midi の Midi オブジェクトへ変換する。
 *
 * 内部の時間単位は拍（四分音符 = 1）。@tonejs/midi の note.ticks /
 * durationTicks は PPQ 基準の tick なので `拍 * ppq` で変換する。
 */
export function songToMidi(song: Song): Midi {
  const midi = new Midi();
  // header.ppq は読み取り専用なので、その値を tick 換算の基準に使う。
  const ppq = midi.header.ppq;
  midi.header.setTempo(song.tempo);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: song.timeSignature,
  });

  for (const track of song.tracks) {
    const midiTrack = midi.addTrack();
    midiTrack.name = track.name;
    for (const note of track.notes) {
      midiTrack.addNote({
        midi: note.pitch,
        ticks: Math.round(note.start * ppq),
        durationTicks: Math.round(note.duration * ppq),
        velocity: note.velocity / 127,
      });
    }
  }
  return midi;
}

/** Song を .mid バイト列（Uint8Array）へシリアライズする。 */
export function songToMidiBytes(song: Song): Uint8Array {
  return new Uint8Array(songToMidi(song).toArray());
}

/**
 * Song を .mid ファイルとしてダウンロードさせる（ブラウザ専用）。
 * @param filename 拡張子付きファイル名（既定 "barline.mid"）
 */
export function downloadSongAsMidi(song: Song, filename = "barline.mid"): void {
  const bytes = songToMidiBytes(song);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
