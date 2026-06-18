import { Keyboard } from "./components/Keyboard";
import { NotationView } from "./components/NotationView";
import { PianoRoll } from "./components/PianoRoll";
import { StepInput } from "./components/StepInput";
import { Transport } from "./components/Transport";

export function App() {
  return (
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
  );
}
