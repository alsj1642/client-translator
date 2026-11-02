import type { CSSProperties, ReactNode } from "react";
import { ICONS, PIXEL } from "../../fonts";
import { FILL, INK, NEON, PAPER, STROKE, WHITE } from "./theme";

// 앱(styles.css)의 부품을 앱 px 그대로 다시 그린 것. 움직임은 모두 props(영상 시간)로만.

const line = `${STROKE}px solid ${INK}`;

/** 오른쪽 아래 접힌 모서리 (styles.css .st-key-memo::after와 같은 SVG) */
export function Fold({ under = PAPER }: { under?: string }) {
  return (
    <svg width={34} height={34} style={{ position: "absolute", right: -STROKE - 4, bottom: -STROKE - 4 }}>
      <path d="M30 0H34V34H0V30Z" fill={under} />
      <path d="M0.75 29.25V0.75H29.25Z" fill={WHITE} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
    </svg>
  );
}

/** 각진 흰 종이 + 검은 선 + 접힌 모서리 */
export function Paper({ style, children, shadow = 0 }: { style?: CSSProperties; children: ReactNode; shadow?: number }) {
  return (
    <div
      style={{
        position: "relative",
        border: line,
        background: WHITE,
        boxShadow: shadow > 0 ? `${4 * shadow}px ${4 * shadow}px 0 ${INK}` : undefined,
        ...style,
      }}
    >
      {children}
      <Fold />
    </div>
  );
}

/** 타자로 친 '-------' 줄 */
export function Dashes({ style }: { style?: CSSProperties }) {
  return <div style={{ overflow: "hidden", whiteSpace: "nowrap", lineHeight: 1, color: INK, ...style }}>{"-".repeat(200)}</div>;
}

/** Streamlit :material/ 아이콘 */
export function Icon({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) {
  return (
    <span style={{ fontFamily: ICONS, fontSize: size, lineHeight: 1, display: "inline-block", verticalAlign: "-0.15em", ...style }}>{name}</span>
  );
}

/** 탭 묶음: 흰 알약 + 검은 선, 고른 탭은 형광 연두 */
export function Tabs({ active }: { active: "번역" | "하소연" }) {
  const tab = (name: "번역" | "하소연", icon: string) => (
    <div
      style={{
        padding: "7px 18px",
        borderRadius: 999,
        border: `${STROKE}px solid ${active === name ? INK : "transparent"}`,
        background: active === name ? NEON : "transparent",
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Icon name={icon} size={18} />
      {name}
    </div>
  );
  return (
    <div style={{ display: "inline-flex", gap: 6, padding: 5, border: line, borderRadius: 999, background: WHITE, fontFamily: PIXEL, color: INK }}>
      {tab("번역", "translate")}
      {tab("하소연", "sentiment_dissatisfied")}
    </div>
  );
}

// app.py TICKER_LINES
const TICKER_LINES = [
  ["느낌 아시죠?", "🤔"], ["좀 더 세련되게", "✨"], ["임팩트 있게요", "💥"], ["뭔가 아쉬워요", "😕"],
  ["살짝만 바꿔주세요", "🙏"], ["고급스럽지만 가볍게", "💎"], ["그 느낌 말고요", "🙅"], ["확 튀게 해주세요", "🔥"],
];

/** 흐르는 띠: 45초에 한 바퀴 (styles.css ticker-flow). t = 영상 시간 */
export function Ticker({ t, width }: { t: number; width: number }) {
  const items = (copy: number) =>
    TICKER_LINES.flatMap(([words, emoji]) => [
      <span key={`${copy}${words}`}>{words}</span>,
      <span key={`${copy}${emoji}`} style={{ margin: "0 1.1em" }}>{emoji}</span>,
    ]);
  const shift = ((t % 45) / 45) * 50;
  return (
    <div style={{ width, overflow: "hidden", border: line, borderRadius: 999, background: NEON, padding: "9px 0", fontFamily: PIXEL, fontSize: 16, color: INK }}>
      <div style={{ display: "flex", width: "max-content", whiteSpace: "nowrap", transform: `translateX(-${shift}%)` }}>
        {items(0)}
        {items(1)}
      </div>
    </div>
  );
}

/** 주요 버튼: 형광 연두 + 검은 선. lift 0~1 = 올렸을 때 들림, press = 누름 */
export function PrimaryButton({ label, width, lift = 0, press = false, padLeft = 0, style }: { label: string; width: number; lift?: number; press?: boolean; padLeft?: number; style?: CSSProperties }) {
  const up = press ? 0 : lift;
  return (
    <div
      style={{
        width,
        height: 56,
        border: line,
        borderRadius: 18,
        background: NEON,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: padLeft,
        fontFamily: PIXEL,
        fontSize: 16,
        color: INK,
        transform: `translate(${-2 * up}px, ${-2 * up}px)`,
        boxShadow: up > 0 ? `${4 * up}px ${4 * up}px 0 ${INK}` : undefined,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

/** 보조 버튼: 흰 바탕 + 검은 선 */
export function SecondaryButton({ label, icon, height = 44, radius = 14 }: { label: string; icon?: string; height?: number; radius?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height, padding: "0 18px", border: line, borderRadius: radius, background: WHITE, fontFamily: PIXEL, fontSize: 16, color: INK }}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {label}
    </div>
  );
}

/** 말풍선: 흰 면 + 검은 선 + 모서리 18px, 왼쪽 아래 꼬리 (styles.css .st-key-result-bubble) */
export function Bubble({ children, style, under = PAPER }: { children: ReactNode; style?: CSSProperties; under?: string }) {
  return (
    <div style={{ position: "relative", border: line, borderRadius: 18, borderBottomLeftRadius: 0, background: WHITE, padding: "16px 21px", fontFamily: PIXEL, fontSize: 16, lineHeight: 1.7, color: INK, ...style }}>
      {children}
      <svg width={40} height={30} style={{ position: "absolute", left: -STROKE - 14, bottom: -STROKE }}>
        <path d="M14 8H40V30H14Z" fill={under} />
        <path d="M14.75 0V8Q14.75 26 1 29.25Q13 29.5 20 20Q25 29.25 40 29.25V0Z" fill={WHITE} />
        <path d="M14.75 0V8Q14.75 26 1 29.25Q13 29.5 20 20Q25 29.25 40 29.25" fill="none" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** 회신 초안 복사 상자 */
export function CopyBox({ children }: { children: ReactNode }) {
  return <div style={{ background: FILL, border: line, borderRadius: 12, padding: "14px 16px", lineHeight: 1.7 }}>{children}</div>;
}
