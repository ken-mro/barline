import { createContext, useContext } from "react";
import type { RecorderApi } from "./useRecorder";

/** App で生成した単一の録音インスタンスを子コンポーネントへ供給する。 */
export const RecorderContext = createContext<RecorderApi | null>(null);

export function useRecorderContext(): RecorderApi {
  const ctx = useContext(RecorderContext);
  if (!ctx) throw new Error("RecorderContext が未提供です");
  return ctx;
}
