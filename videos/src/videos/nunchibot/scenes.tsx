import { Easing } from "remotion";
import { PIXEL } from "../../fonts";
import { UserCursor, cursorAt } from "../../kit/cursor";
import { clamp01, progress } from "../../kit/time";
import { Robot } from "../../robot/Robot";
import { b } from "./cues";
import { FEEDBACK, SECTIONS } from "./demo";
import { aimAt, SeatRobot } from "./SeatRobot";
import { HERO_INK, NEON, S } from "./theme";
import { POS, SEAT_BUTTON, SEAT_RESULT, TranslatePage, type PageState } from "./TranslatePage";

const smooth = (u: number) => {
  const c = clamp01(u);
  return c * c * (3 - 2 * c);
};
const easeOut = Easing.bezier(0, 0, 0.58, 1);
const steps5 = (u: number) => Math.floor(clamp01(u) * 5) / 5;
const BEAT = b(1, 2);

type Pt = { x: number; y: number };
/** 정해진 때에 정해진 곳을 바라보며, 사이는 0.25초 동안 부드럽게 */
function gaze(t: number, keys: readonly (readonly [number, Pt])[], turn = 0.25): Pt {
  let p = keys[0][1];
  for (const [at, to] of keys) {
    if (t < at) break;
    const u = smooth((t - at) / turn);
    p = { x: p.x + (to.x - p.x) * u, y: p.y + (to.y - p.y) * u };
  }
  return p;
}

// ---------------------------------------------------------------
// 오프닝: 메인 화면 (hero.css / hero.js 값 그대로, 1920×1080 실제 크기)
// 로봇이 설계도 도트로 그려짐 → 3D → '모호한' → '피드백🤔' → 아랫줄을 박자마다 바라보면 그 글자부터 또렷해짐 → 정면 ^ ^ + 형광펜
// ---------------------------------------------------------------
const HERO = {
  robot: 560,
  font: (1920 - 80) / 12.45,
  intro: 0.3,
  look: [b(2, 1), b(2, 3), b(3, 1)], // 바라보는 때: 모호한, 피드백🤔, 아랫줄 (2박마다 천천히)
  smile: b(3, 3),
};
const ROBOT_BOX = { x: 960 - HERO.robot / 2, y: 540 - HERO.robot * 0.06 - HERO.robot / 2 };
const heroAim = (p: Pt) => ({ x: ((p.x - ROBOT_BOX.x) / HERO.robot) * 2 - 1, y: -(((p.y - ROBOT_BOX.y) / HERO.robot) * 2 - 1) });

export function Opening({ t }: { t: number }) {
  const line1Y = 540 - (HERO.font * 2.2 + HERO.robot * 0.12) / 2 + HERO.font * 0.55;
  const line2Y = line1Y + HERO.font * 1.1 + HERO.robot * 0.12;
  const targets: Pt[] = [
    { x: 820 - HERO.font * 1.5, y: line1Y },
    { x: 1100 + HERO.font * 2, y: line1Y },
    { x: 960, y: line2Y },
  ];
  const ahead: Pt = { x: 960, y: ROBOT_BOX.y + HERO.robot * 0.38 };
  const aim = heroAim(gaze(t, [[0, ahead], ...HERO.look.map((at, i) => [at, targets[i]] as const), [HERO.smile, ahead]], 0.7)); // 고개는 0.7초에 걸쳐 천천히
  const jitter = [[0, 0], [-2, 1], [1, -1], [2, 1]][Math.floor(t / 0.06) % 4];
  const word = (i: number) => {
    const c = steps5((t - HERO.look[i] - 0.15) / 0.5);
    return {
      filter: c < 1 ? `blur(${0.09 * (1 - c)}em)` : undefined,
      opacity: 0.45 + 0.55 * c,
      translate: c < 1 ? `${jitter[0]}px ${jitter[1]}px` : undefined,
    };
  };
  const mark = (delay: number) => easeOut(clamp01((t - HERO.smile - delay) / 0.5)) * 100;
  const part = (delay: number) => ({
    background: `linear-gradient(transparent 52%, ${NEON} 52%, ${NEON} 94%, transparent 94%) no-repeat 0 0 / ${mark(delay)}% 100%`,
  });

  return (
    <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", color: HERO_INK, fontFamily: PIXEL, wordBreak: "keep-all" }}>
      <div style={{ position: "absolute", top: 28, left: 56, fontSize: 18, fontWeight: 700 }}>눈치봇👀</div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "0 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: HERO.robot * 0.12,
          fontSize: HERO.font,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: `1fr ${HERO.robot * 0.5}px 1fr` }}>
          <span style={{ textAlign: "right", ...word(0) }}>모호한</span>
          <span />
          <span style={{ textAlign: "left", ...word(1) }}>피드백🤔</span>
        </div>
        <div style={{ textAlign: "center", ...word(2) }}>
          <span style={part(0)}>눈치껏👀</span> <span style={part(0.35)}>번역해드릴게요👌</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: ROBOT_BOX.x, top: ROBOT_BOX.y }}>
        <Robot
          t={t}
          size={HERO.robot}
          state={{ expression: t >= HERO.smile ? "정중" : "기본", introAt: HERO.intro, aim }}
          options={{ intro: true, lineColor: "#8A9099", lineGlow: 1, introPixel: 6, sparkle: true }}
        />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 140, textAlign: "center", fontSize: 16 }}>번역하러 가기 ↓</div>
    </div>
  );
}

// ---------------------------------------------------------------
// 번역 입력 (4마디): 마우스가 메모 클릭 → 타이핑 → '번역하기' 누름 → 로봇 '생각 중'
// ---------------------------------------------------------------
export const INPUT = {
  scroll: 40,
  click: 2 * BEAT, // 메모 클릭 (3박)
  // v3: 타이핑을 천천히, 누른 뒤 '눈치 보는 중…'을 충분히 보여주고 천천히 흐려짐
  typeFrom: 2.5 * BEAT,
  typeTo: 12 * BEAT,
  hover: 14 * BEAT, // 버튼 위 (15박)
  press: 15 * BEAT, // 누름 (16박)
};
const film = (x: number, y: number, scroll: number) => ({ x: x * S, y: (y - scroll) * S });
const EMPTY_RESULT = { title: 0, bubble: 0, papers: [0, 0, 0, 0] };

export function Input({ t, u }: { t: number; u: number }) {
  const memoText = film(420, POS.memo.y + 100, INPUT.scroll);
  const btn = film(POS.button.x + 200, POS.button.y + 30, INPUT.scroll); // 글자 오른쪽 (글자를 가리지 않게)
  // 누른 뒤 화면을 조금 내려서 아래 '눈치 보는 중…'이 잘리지 않게
  const scroll = INPUT.scroll + 70 * smooth((u - INPUT.press - 0.1) / 0.4);
  const cursor = cursorAt(
    u,
    [
      { t: 0, x: 1180, y: 1040 },
      { t: INPUT.click, x: memoText.x, y: memoText.y, click: true },
      { t: INPUT.typeFrom + 0.4, x: memoText.x + 260, y: memoText.y + 170 }, // 글자를 가리지 않게 비켜남
      { t: INPUT.hover, x: btn.x, y: btn.y },
      { t: INPUT.press, x: btn.x, y: btn.y, click: true },
    ],
    (x, y) => ({ x, y }),
  );
  const typing = progress(u, INPUT.typeFrom, INPUT.typeTo - INPUT.typeFrom);
  const typed = FEEDBACK.slice(0, Math.round(FEEDBACK.length * typing));
  const pressed = u >= INPUT.press;
  const page: PageState = {
    t,
    scroll,
    typed,
    caret: u >= INPUT.click && !pressed && (typing > 0 && typing < 1 ? true : Math.floor(u / 0.53) % 2 === 0),
    focus: pressed ? 0 : smooth((u - INPUT.click) / 0.2),
    button: { lift: pressed ? 0 : smooth((u - (INPUT.hover - 0.1)) / 0.15), press: pressed && u < INPUT.press + 0.12 },
    loading: u >= INPUT.press + 0.2,
    result: EMPTY_RESULT,
  };
  return (
    <>
      <TranslatePage s={page} />
      <SeatRobot
        t={t}
        seat={SEAT_BUTTON}
        scroll={scroll}
        state={{ expression: u >= INPUT.press + 0.1 ? "생각 중" : "기본", aim: aimAt(cursor, SEAT_BUTTON, scroll) }}
      />
      <UserCursor x={cursor.x} y={cursor.y} squash={cursor.squash} />
    </>
  );
}

// ---------------------------------------------------------------
// 번역 결과 (3마디, 드럼 시작): 제목 + 로봇 ^ ^ → 말풍선 요약 → 종이 4장이 한 박에 한 장씩
// ---------------------------------------------------------------
// 종이 아래끝 (앱 px). 디버그 정지 화면으로 잰 값으로 맞춤
const PAPER_BOTTOMS = [1147, 1363, 1681, 2095]; // v3 큰 글자 기준 (디버그 정지 화면으로 확인)
const RESULT = { bubble: 1 * BEAT, papers: [3, 5, 7, 9].map((n) => n * BEAT), view: 700 }; // 종이는 2박마다

export function Result({ t, u }: { t: number; u: number }) {
  const land = RESULT.papers.map((at) => easeOut(clamp01((u - at) / 0.3)));
  let scroll = RESULT.view;
  RESULT.papers.forEach((at, i) => {
    const target = Math.max(RESULT.view, PAPER_BOTTOMS[i] - 700);
    scroll += (target - scroll) * smooth((u - at) / 0.45);
  });
  const page: PageState = {
    t,
    scroll,
    typed: FEEDBACK,
    caret: false,
    focus: 0,
    button: { lift: 0, press: false },
    loading: false,
    result: { title: easeOut(clamp01(u / 0.3)), bubble: progress(u, RESULT.bubble, 0.9), papers: land.slice(0, SECTIONS.length) },
  };
  return (
    <>
      <TranslatePage s={page} />
      <SeatRobot t={t} seat={SEAT_RESULT} scroll={scroll} state={{ expression: "정중", aim: "viewer" }} />
    </>
  );
}
