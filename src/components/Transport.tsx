import { type ChangeEvent, useRef } from "react";
import { useRecorderContext } from "../hooks/recorderContext";
import { usePlayback } from "../hooks/usePlayback";
import { downloadSongAsMidi } from "../midi/export";
import { loadMidiFile } from "../midi/import";
import { useEditorStore } from "../store/editorStore";
import { useSongStore } from "../store/songStore";
import type { TimeSignature } from "../types/song";

const TIME_SIGNATURES: TimeSignature[] = [
  [4, 4],
  [3, 4],
  [2, 4],
  [6, 8],
];

export function Transport() {
  const { isPlaying, toggle, halt } = usePlayback();
  const recorder = useRecorderContext();
  const song = useSongStore((s) => s.song);
  const setTempo = useSongStore((s) => s.setTempo);
  const setTimeSignature = useSongStore((s) => s.setTimeSignature);
  const clearNotes = useSongStore((s) => s.clearNotes);
  const loadSong = useSongStore((s) => s.loadSong);

  const isRecording = useEditorStore((s) => s.isRecording);
  const countdown = useEditorStore((s) => s.countdown);
  const metronome = useEditorStore((s) => s.metronome);
  const setMetronome = useEditorStore((s) => s.setMetronome);
  const countIn = useEditorStore((s) => s.countIn);
  const setCountIn = useEditorStore((s) => s.setCountIn);
  const overdub = useEditorStore((s) => s.overdub);
  const setOverdub = useEditorStore((s) => s.setOverdub);

  const fileInput = useRef<HTMLInputElement>(null);

  const onTempo = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (!Number.isNaN(v)) setTempo(v);
  };

  const onTimeSig = (e: ChangeEvent<HTMLSelectElement>) => {
    const [n, d] = e.target.value.split("/").map(Number);
    setTimeSignature([n, d]);
  };

  // 録音中・カウントダウン中は「録音アクティブ」として扱う。
  const recordingActive = isRecording || countdown !== null;

  const onPlay = () => {
    if (recordingActive) recorder.halt();
    toggle();
  };

  const onRecord = () => {
    if (recordingActive) {
      recorder.halt();
    } else {
      if (isPlaying) halt();
      void recorder.start();
    }
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
      <button type="button" className="primary" onClick={onPlay} disabled={recordingActive}>
        {isPlaying ? "■ 停止" : "▶ 再生"}
      </button>
      <button
        type="button"
        className={recordingActive ? "active recording" : ""}
        onClick={onRecord}
      >
        {recordingActive ? "■ 録音停止" : "● 録音"}
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

      <div className="group">
        <label>
          <input
            type="checkbox"
            checked={metronome}
            onChange={(e) => setMetronome(e.target.checked)}
          />{" "}
          メトロノーム
        </label>
        <label>
          <input type="checkbox" checked={countIn} onChange={(e) => setCountIn(e.target.checked)} />{" "}
          カウントダウン
        </label>
        <label>
          <input type="checkbox" checked={overdub} onChange={(e) => setOverdub(e.target.checked)} />{" "}
          重ね録り
        </label>
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
