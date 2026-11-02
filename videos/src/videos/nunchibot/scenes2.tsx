import { Easing } from "remotion";
import { PIXEL } from "../../fonts";
import { UserCursor, cursorAt } from "../../kit/cursor";
import { clamp01, progress } from "../../kit/time";
import { Robot, type Expression } from "../../robot/Robot";
import { b } from "./cues";
import { SeatRobot } from "./SeatRobot";
import { FAINT, HERO_INK, INK, NEON, PAPER, S, STROKE, SUB, VIEW, WHITE } from "./theme";
import { COL, SEAT_BUTTON, TranslatePage } from "./TranslatePage";
import { Bubble, Fold, PrimaryButton, SecondaryButton, Tabs } from "./ui";

const smooth = (u: number) => {
  const c = clamp01(u);
  return c * c * (3 - 2 * c);
};
const easeOut = Easing.bezier(0, 0, 0.58, 1);
const BEAT = b(1, 2);
const rise = (u: number) => ({ opacity: u, transform: `translateY(${(1 - u) * 16}px)` });

// ---------------------------------------------------------------
// 방어 동작 (2마디): 실제 측정에서 안내가 나온 문장 그대로
// - new_v2_1.csv N8 → 짧은 입력 안내 / v2_1_run.csv X9 → 개인정보 안내 (가짜 값)
// 앱처럼 안내가 나오면 버튼 위 로봇은 ^ ^ (docs/screenshots/06)
// ---------------------------------------------------------------
const GUARDS = [
  ["음, 좀 그렇네요.", "내용이 너무 짧아서 뜻을 짐작하기 어려워요. 어느 부분이, 어떻게 마음에 걸리는지 한 가지만 더 적어주세요."],
  ["김00 대표님(연락처 010-0000-0000)이 보시기에 ㈜가나다 로고가 아쉽대요.", "이름, 연락처, 회사명으로 보이는 내용이 있어요. 지우고 다시 입력해주세요."],
] as const;
const GUARD_SCROLL = 230; // v3: 큰 글자 안내 종이가 다 보이게

export function Guard({ t, u }: { t: number; u: number }) {
  const k = u < 8 * BEAT ? 0 : 1; // 한 문장에 2마디씩 (읽을 시간)
  const v = u - k * 8 * BEAT; // 이 문장 안의 시간
  const [input, notice] = GUARDS[k];
  const press = 2 * BEAT; // 3박: 누름
  const answer = 3 * BEAT; // 4박: 안내, 그 뒤 4박 동안 읽을 시간
  return (
    <>
      <TranslatePage
        s={{
          t,
          scroll: GUARD_SCROLL,
          typed: input.slice(0, Math.round(input.length * progress(v, 0, BEAT * 1.6))),
          caret: v < press,
          focus: v < press ? 1 : 0,
          button: { lift: v > press - 0.2 && v < press ? 1 : 0, press: v >= press && v < press + 0.12 },
          loading: v >= press + 0.15 && v < answer,
          result: { title: 0, bubble: 0, papers: [0, 0, 0, 0] },
          notice: [notice, easeOut(clamp01((v - answer) / 0.3))],
        }}
      />
      <SeatRobot t={t} seat={SEAT_BUTTON} scroll={GUARD_SCROLL} state={{ expression: v < press ? "기본" : v < answer ? "생각 중" : "정중", aim: "viewer" }} />
    </>
  );
}

// ---------------------------------------------------------------
// 하소연 (4마디): 적기 → 구겨서 던지기 → 로봇 한마디 → 쓰레기통 불태우기
// 값은 vent/vent.html·vent.css·vent.js 그대로. 위치는 docs/screenshots/10을 잰 값.
// 로봇 한마디는 '꺼짐'으로: 이때 앱은 AI를 부르지 않고 고정 문구(app.py VENT_FIXED_REPLY)를 보여줌 → 지어낸 AI 답 없음
// ---------------------------------------------------------------
const VENT_TEXT = "벌써 다섯 번째 시안인데, 결국 처음 거로 가자고 하시네요…";
const FIXED_REPLY = "다 털었어요. 한결 가볍죠?";
export const V = {
  paper: { x: COL.x, y: 444, w: COL.w, h: 222 },
  type: [0.2, 4.0] as const,
  throw: 8 * BEAT, // 9박: 구겨서 던지기
  crumple: 1.1,
  flight: 0.85,
  burn: 18 * BEAT, // 19박: 쓰레기통 불태우기
};
export const LANDED = V.throw + V.crumple + V.flight;
const CRUMPLE_STEPS = [
  [1, 0, 0],
  [0.86, 0.07, -3],
  [0.62, 0.16, 5],
  [0.34, 0.26, -9],
  [0, 0.34, -16],
] as const;
// 가장자리 24점의 움푹한 정도 (앱은 매번 무작위. 영상은 같은 그림이 나오게 고정값)
const DENTS = Array.from({ length: 24 }, (_, i) => (i % 2 ? 0.55 : 0.15) + ((i * 37) % 11) / 11 * 0.45);
function crumpleShape(depth: number) {
  const pts = DENTS.map((dent, i) => {
    const t = (i / 24) * 4;
    const side = Math.floor(t);
    const f = t - side;
    const [x, y] = [[f, 0], [1, f], [1 - f, 1], [0, 1 - f]][side];
    const pull = depth * dent;
    return `${(x + (0.5 - x) * pull) * 100}% ${(y + (0.5 - y) * pull) * 100}%`;
  });
  return `polygon(${pts.join(", ")})`;
}
const crumpleEase = Easing.bezier(0.5, 0, 0.6, 1);
const flightEase = Easing.bezier(0.3, 0, 0.7, 1);

function Capsule({ label, on, dim }: { label: string; on: boolean; dim?: boolean }) {
  return (
    <span style={{ padding: "3px 14px", border: `${STROKE}px solid ${INK}`, borderRadius: 999, background: on ? NEON : WHITE, fontSize: 14, opacity: dim ? 0.5 : 1 }}>{label}</span>
  );
}

function Can({ lid, shake, burnt }: { lid: number; shake: number; burnt: number }) {
  return (
    <svg width={52} height={60} viewBox="0 0 52 60" fill="none" style={{ overflow: "visible", rotate: `${shake}deg`, transformOrigin: "50% 100%", filter: burnt ? `brightness(${1 - 0.85 * burnt})` : undefined }}>
      <g style={{ transformOrigin: "3px 13px", rotate: `${-lid * 28}deg` }}>
        <rect x={20} y={1.5} width={12} height={5} rx={2} fill="#fff" stroke="#111" strokeWidth={1.5} />
        <rect x={3} y={6} width={46} height={7} rx={2} fill="#fff" stroke="#111" strokeWidth={1.5} />
      </g>
      <path d="M7 14 L10 57 H42 L45 14 Z" fill="#fff" stroke="#111" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M18 21 V50 M26 21 V50 M34 21 V50" stroke="#111" strokeWidth={1.5} />
    </svg>
  );
}

function Fire({ sway }: { sway: number }) {
  const flame = (d: string[], fills: string[], k: number) => (
    <g style={{ transformOrigin: "55px 118px", scale: `${1 + 0.06 * Math.sin(sway * 7 + k)} ${1 + 0.1 * Math.sin(sway * 9 + k * 2)}` }}>
      {d.map((p, i) => <path key={i} d={p} fill={fills[i]} stroke="#111" strokeWidth={1.5 - i * 0.25} strokeLinejoin="round" />)}
    </g>
  );
  return (
    <svg width={110} height={120} viewBox="0 0 110 120" fill="none">
      {flame(["M28 30 C36 46 50 56 48 80 C46 100 38 116 28 116 C16 116 6 104 6 86 C6 68 16 56 20 44 C23 52 25 56 28 60 C29 48 28 40 28 30 Z", "M28 64 C33 74 38 82 37 94 C36 104 32 110 28 110 C23 110 18 104 18 96 C18 86 25 80 28 64 Z"], ["#FF7A1A", "#FFC93C"], 1)}
      {flame(["M82 30 C74 46 60 56 62 80 C64 100 72 116 82 116 C94 116 104 104 104 86 C104 68 94 56 90 44 C87 52 85 56 82 60 C81 48 82 40 82 30 Z", "M82 64 C77 74 72 82 73 94 C74 104 78 110 82 110 C87 110 92 104 92 96 C92 86 85 80 82 64 Z"], ["#FF7A1A", "#FFC93C"], 2)}
      {flame(["M55 2 C68 26 88 40 84 72 C81 98 68 118 55 118 C40 118 26 100 26 76 C24 56 38 44 43 24 C49 36 51 42 55 48 C56 32 55 18 55 2 Z", "M55 48 C64 64 72 74 70 90 C68 104 62 112 55 112 C47 112 40 104 40 92 C40 78 50 70 55 48 Z", "M55 80 C59 88 62 94 61 100 C60 106 58 110 55 110 C51 110 49 106 49 101 C49 95 53 90 55 80 Z"], ["#FF7A1A", "#FFC93C", "#FFF3C4"], 3)}
    </svg>
  );
}

export function Vent({ t, u }: { t: number; u: number }) {
  const thrown = u >= V.throw;
  const typed = VENT_TEXT.slice(0, Math.round(VENT_TEXT.length * progress(u, V.type[0], V.type[1] - V.type[0])));
  const talk = easeOut(clamp01((u - LANDED - 0.2) / 0.35)); // 로봇과 말풍선이 나타남
  const shift = smooth((u - LANDED - 0.2) / 0.35); // 로봇 자리만큼 버튼이 아래로
  const btnY = 720 + (913 - 720) * shift;
  const scroll = 140 + 150 * shift;
  const can = { x: COL.x + COL.w - 52, y: btnY - 2 };

  // 구기기 → 날아가기
  const c = clamp01((u - V.throw) / V.crumple);
  const ce = crumpleEase(c) * (CRUMPLE_STEPS.length - 1);
  const i0 = Math.min(CRUMPLE_STEPS.length - 2, Math.floor(ce));
  const f = ce - i0;
  const mix = (k: number) => CRUMPLE_STEPS[i0][k] + (CRUMPLE_STEPS[i0 + 1][k] - CRUMPLE_STEPS[i0][k]) * f;
  const ball = 58;
  const w = ball + (V.paper.w - ball) * mix(0);
  const h = ball + (V.paper.h - ball) * mix(0);
  const fl = flightEase(clamp01((u - V.throw - V.crumple) / V.flight));
  const startX = V.paper.x + V.paper.w / 2 - ball / 2;
  const startY = V.paper.y + V.paper.h / 2 - ball / 2;
  const dx = can.x + 26 - ball / 2 - startX;
  const dy = can.y + 26 - ball / 2 - startY;
  const lift = Math.max(90, -dy + 90);
  const flying = u >= V.throw && u < LANDED;
  const lid = u >= V.throw + V.crumple && u < LANDED ? smooth((u - V.throw - V.crumple) / 0.18) : u >= LANDED ? 1 - smooth((u - LANDED) / 0.18) : 0;
  const sh = (u - LANDED) / 0.42;
  const shake = sh > 0 && sh < 1 ? [0, -6, 4, -2, 0][Math.floor(sh * 4)] + ([0, -6, 4, -2, 0][Math.floor(sh * 4) + 1] - [0, -6, 4, -2, 0][Math.floor(sh * 4)]) * ((sh * 4) % 1) : 0;
  const paperBack = easeOut(clamp01((u - LANDED) / 0.3));

  // 불태우기: 불길(1.4초) → 재 → 새 쓰레기통
  const burnU = u - V.burn - 0.15;
  const fire = burnU > 0 && burnU < 1.7 ? Math.min(smooth(burnU / 0.3), 1 - smooth((burnU - 1.4) / 0.3)) : 0;
  const burnt = burnU > 0 ? smooth(burnU / 1.4) : 0;
  const ash = burnU > 1.5 && burnU < 2.6 ? 1 : 0;
  const fresh = burnU >= 2.6;
  const drop = fresh ? 1 - easeOut(clamp01((burnU - 2.6) / 0.3)) : 0;

  const cursor = cursorAt(
    u,
    [
      { t: 0, x: 1100, y: 1040 },
      { t: V.throw, x: (COL.x + 78) * S, y: (720 + 47 - 140) * S, click: true },
      { t: V.throw + 0.8, x: (COL.x + 300) * S, y: (720 + 120 - 140) * S },
      { t: V.burn, x: (COL.x + 768) * S, y: (913 + 47 - 290) * S, click: true },
    ],
    (x, y) => ({ x, y }),
  );

  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: VIEW.w, height: VIEW.h, transform: `scale(${S})`, transformOrigin: "0 0", overflow: "hidden", background: WHITE }}>
        <div style={{ position: "absolute", left: 0, top: -scroll, width: VIEW.w, fontFamily: PIXEL, color: INK, wordBreak: "keep-all" }}>
          <div style={{ position: "absolute", left: 8, right: 8, top: 0, height: 2400, background: PAPER, border: `${STROKE}px solid ${INK}`, borderRadius: 28 }} />
          <div style={{ position: "absolute", left: COL.x, top: 74 }}>
            <Tabs active="하소연" />
          </div>
          {/* 핀 꽂힌 인사 메모 */}
          <div style={{ position: "absolute", left: COL.x, top: 177, width: COL.w, padding: "22px 22px", background: WHITE, border: `${STROKE}px solid ${INK}`, rotate: "-0.8deg", boxShadow: "4px 4px 0 rgba(17,17,17,0.12)" }}>
            <svg width={30} height={34} viewBox="0 0 30 34" fill="none" style={{ position: "absolute", left: COL.w / 2 - 15, top: -16 }}>
              <path d="M15 20 L15 32" stroke="#111" strokeWidth={1.5} strokeLinecap="round" />
              <ellipse cx={15} cy={21} rx={9} ry={3} fill="#fff" stroke="#111" strokeWidth={1.5} />
              <circle cx={15} cy={11} r={9.25} fill={NEON} stroke="#111" strokeWidth={1.5} />
              <path d="M10.5 8.5 Q12 5.5 15 5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: 19 }}>오늘 클라이언트 때문에 힘들었나요?</div>
            <div style={{ fontSize: 13, color: SUB, marginTop: 6 }}>여기에 다 털어놓고 가세요. 적은 글은 저장되지 않고, 던지면 사라져요.</div>
          </div>
          <div style={{ position: "absolute", left: COL.x, top: 308, fontSize: 36, lineHeight: 1.2 }}>하소연 적기</div>
          <div style={{ position: "absolute", left: COL.x, top: 370, display: "flex", alignItems: "center", gap: 6, fontSize: 15 }}>
            <span style={{ marginRight: 4 }}>눈치봇의 한마디</span>
            <Capsule label="켜짐" on={false} />
            <Capsule label="꺼짐" on />
            <span style={{ margin: "0 4px 0 34px" }}>말투</span>
            <Capsule label="정중" on dim />
            <Capsule label="팩폭" on={false} dim />
          </div>
          <div style={{ position: "absolute", left: COL.x, top: 410, fontSize: 13, color: SUB }}>켜면 로봇이 한마디 해줘요. 적은 글이 AI에게 전달돼요.</div>

          {/* 줄 종이 (던지는 동안은 숨김) */}
          <div style={{ position: "absolute", left: V.paper.x, top: V.paper.y, width: V.paper.w, height: V.paper.h, visibility: thrown && u < LANDED ? "hidden" : "visible", ...(u >= LANDED ? { opacity: paperBack, translate: `0 ${(1 - paperBack) * 8}px` } : {}) }}>
            <div style={{ position: "absolute", inset: 0, border: `${STROKE}px solid ${INK}`, background: `repeating-linear-gradient(${WHITE} 0 43px, #D9D9D3 43px 44px)`, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 48, top: 0, bottom: 0, width: 1, background: "#D9D9D3" }} />
              <div style={{ position: "absolute", left: 66, top: 0, right: 20, fontSize: 26, lineHeight: "44px", color: typed && !thrown ? INK : FAINT }}>
                {thrown ? "이런 요청을 받았다면 누구라도 답답하죠. 마음껏 적어보세요." : typed || "이런 요청을 받았다면 누구라도 답답하죠. 마음껏 적어보세요."}
              </div>
            </div>
            <Fold />
          </div>
          <div style={{ position: "absolute", left: COL.x, top: 680, width: COL.w, display: "flex", justifyContent: "space-between", fontSize: 13, color: SUB }}>
            <span>이름, 연락처, 회사명은 쓰지 마세요.</span>
            <span>{thrown ? 0 : typed.length}자</span>
          </div>

          {/* 로봇 한마디 (말풍선) */}
          <div style={{ position: "absolute", left: COL.x + 137, top: 742, width: COL.w - 137, ...rise(talk) }}>
            <Bubble style={{ fontSize: 24 }}>{FIXED_REPLY}</Bubble>
          </div>

          {/* 버튼 + 쓰레기통 */}
          <div style={{ position: "absolute", left: COL.x, top: btnY }}>
            <PrimaryButton label="구겨서 던지기" width={156} press={u >= V.throw && u < V.throw + 0.12} lift={u > V.throw - 0.25 && u < V.throw ? 1 : 0} />
          </div>
          <div style={{ position: "absolute", left: COL.x + 678, top: btnY }}>
            <SecondaryButton label="쓰레기통 불태우기" height={56} radius={18} />
          </div>
          <div style={{ position: "absolute", left: can.x, top: can.y - drop * 40, opacity: ash ? 0 : 1 }}>
            <Can lid={lid} shake={shake} burnt={fresh ? 0 : burnt} />
          </div>
          {fire > 0 ? (
            <div style={{ position: "absolute", left: can.x + 26 - 55, top: can.y + 62 - 120, transformOrigin: "50% 100%", scale: String(fire * 0.85) }}>
              <Fire sway={u} />
            </div>
          ) : null}
          {ash ? (
            <svg width={60} height={26} viewBox="0 0 60 26" fill="none" style={{ position: "absolute", left: can.x - 4, top: can.y + 36 }}>
              <path d="M3 24 C9 12 19 8 30 10 C41 8 51 13 57 24 Z" fill="#55554F" stroke="#111" strokeWidth={1.5} strokeLinejoin="round" />
              <path d="M16 18 L19 16 M28 15 L31 14 M40 17 L43 19" stroke="#EBEBE6" strokeWidth={1.5} strokeLinecap="round" />
              <circle cx={23} cy={20} r={1.6} fill="#FF7A1A" />
              <circle cx={37} cy={21} r={1.3} fill="#FF7A1A" />
            </svg>
          ) : null}

          {/* 구겨지는 종이 → 공 */}
          {flying ? (
            <div
              style={{
                position: "absolute",
                left: V.paper.x + (V.paper.w - w) / 2,
                top: V.paper.y + (V.paper.h - h) / 2,
                width: w,
                height: h,
                rotate: `${mix(2)}deg`,
                translate: `${dx * fl}px ${dy * fl - 4 * lift * fl * (1 - fl)}px`,
                filter: `drop-shadow(1px 0 0 ${INK}) drop-shadow(-1px 0 0 ${INK}) drop-shadow(0 1px 0 ${INK}) drop-shadow(0 -1px 0 ${INK})`,
              }}
            >
              <div style={{ width: "100%", height: "100%", background: WHITE, clipPath: crumpleShape(mix(1)), rotate: `${fl * 540}deg`, scale: String(1 - fl * 0.5) }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", opacity: Math.min(1, c * 1.4) }}>
                  <g fill="#111">
                    <polygon points="0,0 38,18 22,52 0,40" opacity="0.07" />
                    <polygon points="38,18 70,0 100,30 64,44" opacity="0.12" />
                    <polygon points="22,52 64,44 58,100 18,100" opacity="0.09" />
                    <polygon points="64,44 100,30 100,78 58,100" opacity="0.15" />
                  </g>
                  <path d="M0 0 L38 18 L70 0 M38 18 L22 52 L0 40 M22 52 L64 44 L100 30 M64 44 L58 100 M22 52 L18 100 M64 44 L38 18" fill="none" stroke="#111" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ opacity: talk }}>
        <SeatRobot t={t} seat={{ x: COL.x + 66 - 100, y: 742 + 44 - 100, size: 200, clip: 0 }} scroll={scroll} state={{ expression: "정중", aim: "viewer" }} />
      </div>
      <UserCursor x={cursor.x} y={cursor.y} squash={cursor.squash} />
    </>
  );
}

// ---------------------------------------------------------------
// 표정 모음 (1마디): 한 박마다 표정이 바뀜
// ---------------------------------------------------------------
const FACES: Expression[] = ["기본", "팩폭", "하트", "정중"];
export function Faces({ t, u }: { t: number; u: number }) {
  const i = Math.min(FACES.length - 1, Math.floor(u / (2 * BEAT))); // 2박마다
  return (
    <div style={{ position: "absolute", inset: 0, background: WHITE, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 640, height: 640, flex: "none" }}><Robot t={t} size={640} state={{ expression: FACES[i], aim: "viewer" }} /></div>
      <div style={{ marginTop: -40, fontFamily: PIXEL, fontSize: 40, color: HERO_INK }}>{FACES[i]}</div>
    </div>
  );
}

// ---------------------------------------------------------------
// 끝 (2마디): 눈치봇👀 + 한 줄, 로봇 점프
// ---------------------------------------------------------------
export function Ending({ t, u }: { t: number; u: number }) {
  const name = easeOut(clamp01(u / 0.3));
  const words = [
    { text: "모호한 말,", at: 2 * BEAT },
    { text: "눈치껏", at: 4 * BEAT, mark: true },
    { text: "번역해요", at: 6 * BEAT },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: WHITE, fontFamily: PIXEL, color: HERO_INK, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <Robot t={t} size={420} state={{ expression: "정중", aim: "viewer", jumpAt: b(32, 3) }} />
      <div style={{ marginTop: -30, fontSize: 96, fontWeight: 700, opacity: name }}>눈치봇👀</div>
      <div style={{ marginTop: 28, fontSize: 56, display: "flex", gap: "0.3em" }}>
        {words.map((w) => {
          const c = Math.floor(clamp01((u - w.at) / 0.3) * 5) / 5;
          const m = w.mark ? easeOut(clamp01((u - w.at - 0.35) / 0.5)) : 0;
          return (
            <span
              key={w.text}
              style={{
                opacity: u >= w.at ? 0.45 + 0.55 * c : 0,
                filter: c < 1 ? `blur(${(1 - c) * 0.09}em)` : undefined,
                background: `linear-gradient(transparent 52%, ${NEON} 52%, ${NEON} 94%, transparent 94%) no-repeat 0 0 / ${m * 100}% 100%`,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
