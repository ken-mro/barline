import { type ChangeEvent, useRef } from "react";
import { usePlayback } from "../hooks/usePlayback";
import { downloadSongAsMidi } from "../midi/export";
import { loadMidiFile } from "../midi/import";
import { useSongStore } from "../store/songStore";
import type { TimeSignature } from "../types/song";

const TIME_SIGNATURES: TimeSignature[] = [
  [4, 4],
  [3, 4],
  [2, 4],
  [6, 8],
];

export function Transport() {
  const { isPlaying, toggle } = usePlayback();
  const song = useSongStore((s) => s.song);
  const setTempo = useSongStore((s) => s.setTempo);
  const setTimeSignature = useSongStore((s) => s.setTimeSignature);
  const clearNotes = useSongStore((s) => s.clearNotes);
  const loadSong = useSongStore((s) => s.loadSong);
  const fileInput = useRef<HTMLInputElement>(null);

  const onTempo = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (!Number.isNaN(v)) setTempo(v);
  };

  const onTimeSig = (e: ChangeEvent<HTMLSelectElement>) => {
    const [n, d] = e.target.value.split("/").map(Number);
    setTimeSignature([n, d]);
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      loadSong(await loadMidiFile(file));
    } catch (err) {
      console.error(err);
      alert("MIDI ファイルの読み込みに失敗しました。");
    }
    e.target.value = "";
  };

  return (
    <div className="panel toolbar" aria-label="トランスポート">
      <button type="button" className="primary" onClick={toggle}>
        {isPlaying ? "■ 停止" : "▶ 再生"}
      </button>

      <div className="group">
        <label htmlFor="tempo">テンポ</label>
        <input
          id="tempo"
          type="number"
          min={20}
          max={300}
          value={song.tempo}
          onChange={onTempo}
          style={{ width: 70 }}
        />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>BPM</span>
      </div>

      <div className="group">
        <label htmlFor="timesig">拍子</label>
        <select
          id="timesig"
          value={`${song.timeSignature[0]}/${song.timeSignature[1]}`}
          onChange={onTimeSig}
        >
          {TIME_SIGNATURES.map((ts) => (
            <option key={ts.join("/")} value={ts.join("/")}>
              {ts.join("/")}
            </option>
          ))}
        </select>
      </div>

      <div className="spacer" />

      <button type="button" onClick={() => downloadSongAsMidi(song)}>
        ⬇ MIDI 書き出し
      </button>
      <button type="button" onClick={() => fileInput.current?.click()}>
        ⬆ MIDI 読み込み
      </button>
      <button type="button" onClick={() => clearNotes()}>
        クリア
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".mid,.midi,audio/midi"
        hidden
        onChange={onImport}
      />
    </div>
  );
}
