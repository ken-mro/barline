import { Keyboard } from "./components/Keyboard";
import { NotationView } from "./components/NotationView";
import { PianoRoll } from "./components/PianoRoll";
import { StepInput } from "./components/StepInput";
import { Transport } from "./components/Transport";
import { RecorderContext } from "./hooks/recorderContext";
import { useRecorder } from "./hooks/useRecorder";

export function App() {
  // 録音インスタンスはアプリ全体で 1 つだけ生成し、Transport と Keyboard で共有する。
  const recorder = useRecorder();

  return (
    <RecorderContext.Provider value={recorder}>
      <div className="app">
        <header className="app-header">
          <h1>barline</h1>
          <p>MIDI の打ち込み・ダウンロード・譜面化ができる Web アプリ</p>
        </header>

        <Transport />
        <StepInput />
        <PianoRoll />
        <Keyboard />
        <NotationView />
      </div>
    </RecorderContext.Provider>
  );
}
