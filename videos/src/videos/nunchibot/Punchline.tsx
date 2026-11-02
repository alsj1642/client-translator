import { Easing } from "remotion";
import { PIXEL } from "../../fonts";
import { clamp01 } from "../../kit/time";
import { HERO_INK, NEON } from "./theme";

// 장면 사이 큰 한 줄. 단어마다 박자에 맞춰 흐릿한 글자 → 또렷한 글자 (메인 카피처럼 5단계로 끊어서).
// 강조(mark) 단어는 또렷해진 뒤 형광 연두 형광펜이 왼쪽부터 쓱 (메인 카피와 같은 모양: 글자 아래쪽 52~94%).
export type PWord = { text: string; at: number; mark?: boolean };

const steps5 = (u: number) => Math.floor(clamp01(u) * 5) / 5;
const easeOut = Easing.bezier(0, 0, 0.58, 1);

export function Punchline({ t, words, size = 120 }: { t: number; words: readonly PWord[]; size?: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3em", fontFamily: PIXEL, fontSize: size, lineHeight: 1.1, color: HERO_INK, whiteSpace: "nowrap", background: "#FFFFFF" }}>
      {words.map((w) => {
        const clear = steps5((t - w.at) / 0.3);
        const shown = t >= w.at;
        const mark = w.mark ? easeOut(clamp01((t - w.at - 0.35) / 0.5)) : 0;
        return (
          <span
            key={w.text}
            style={{
              opacity: shown ? 0.45 + 0.55 * clear : 0,
              filter: clear < 1 ? `blur(${(1 - clear) * 0.09}em)` : undefined,
              background: `linear-gradient(transparent 52%, ${NEON} 52%, ${NEON} 94%, transparent 94%) no-repeat 0 0 / ${mark * 100}% 100%`,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}
