import { Accidental, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import type { Song } from "../types/song";
import { type NotationMeasure, measureBeats, quantizeTrackToMeasures } from "../utils/quantize";

/**
 * Song を量子化して VexFlow で五線譜描画する（表示専用）。
 *
 * MVP では選択トラック（既定で先頭トラック）を高音部譜表に描画する。
 */

const FIRST_STAVE_WIDTH = 300;
const STAVE_WIDTH = 260;
const ROW_HEIGHT = 110;
const TOP_PADDING = 20;
const LEFT_PADDING = 10;

/** NotationElement を VexFlow の StaveNote へ変換する。 */
function toStaveNote(el: NotationMeasure["elements"][number]): StaveNote {
  if (el.type === "rest") {
    const note = new StaveNote({
      keys: ["b/4"],
      duration: `${el.duration}r`,
    });
    if (el.dots > 0) Dot.buildAndAttach([note]);
    return note;
  }

  const note = new StaveNote({ keys: el.keys, duration: el.duration });
  // シャープを含むキーに臨時記号を付与する。
  el.keys.forEach((key, i) => {
    if (key.includes("#")) {
      note.addModifier(new Accidental("#"), i);
    }
  });
  if (el.dots > 0) Dot.buildAndAttach([note]);
  return note;
}

/**
 * 五線譜を描画する。
 * @param container 描画先の要素（中身はクリアされる）
 * @param song 対象楽曲
 * @param trackId 描画するトラック（省略時は先頭）
 * @param width 描画幅(px)
 */
export function renderNotation(
  container: HTMLDivElement,
  song: Song,
  trackId?: string,
  width = 800,
): void {
  container.innerHTML = "";

  const track = song.tracks.find((t) => t.id === trackId) ?? song.tracks[0];
  if (!track) return;

  const measures = quantizeTrackToMeasures(track.notes, song.timeSignature);
  const perRow = Math.max(1, Math.floor((width - LEFT_PADDING) / STAVE_WIDTH));
  const rows = Math.ceil(measures.length / perRow);

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(width, TOP_PADDING + rows * ROW_HEIGHT + 20);
  const context = renderer.getContext();

  const [numBeats, beatValue] = song.timeSignature;
  const mBeats = measureBeats(song.timeSignature);

  measures.forEach((measure, index) => {
    const col = index % perRow;
    const row = Math.floor(index / perRow);
    const isRowStart = col === 0;

    let x = LEFT_PADDING;
    for (let c = 0; c < col; c++) {
      x += c === 0 ? FIRST_STAVE_WIDTH : STAVE_WIDTH;
    }
    const staveWidth = isRowStart ? FIRST_STAVE_WIDTH : STAVE_WIDTH;
    const y = TOP_PADDING + row * ROW_HEIGHT;

    const stave = new Stave(x, y, staveWidth);
    if (isRowStart) {
      stave.addClef("treble").addTimeSignature(`${numBeats}/${beatValue}`);
    }
    stave.setContext(context).draw();

    const notes = measure.elements.map(toStaveNote);
    const voice = new Voice({ numBeats: mBeats, beatValue: 4 }).setMode(Voice.Mode.SOFT);
    voice.addTickables(notes);

    new Formatter().joinVoices([voice]).format([voice], staveWidth - 60);
    voice.draw(context, stave);
  });
}
