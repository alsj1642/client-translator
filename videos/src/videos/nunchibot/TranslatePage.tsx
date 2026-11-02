import { PIXEL } from "../../fonts";
import { clamp01 } from "../../kit/time";
import { SECTIONS, SUMMARY } from "./demo";
import { FAINT, INK, PAPER, S, STROKE, SUB, VIEW } from "./theme";
import { Bubble, CopyBox, Dashes, Icon, Paper, PrimaryButton, SecondaryButton, Tabs, Ticker } from "./ui";

// 번역 탭 화면 한 장 (앱 px). 위치는 docs/screenshots/02, 04를 잰 값 (가운데 920px 칸).
export const COL = { x: (VIEW.w - 920) / 2, w: 920 };
export const POS = {
  tabs: 74,
  ticker: 180,
  title: 268,
  memo: { y: 317, h: 271 },
  random: 605,
  button: { x: COL.x + 920 - 221, y: 663, w: 221 },
  resultTitle: 760,
  talk: 815,
  papers: 961,
};
const BUTTON_PAD = 84; // styles.css: 로봇 자리만큼 글자를 오른쪽으로
/** 버튼에 앉은 로봇 (buddy.js SEAT: 200px, 글자 왼쪽 45px, 그림의 74%가 버튼 아래끝까지) */
export const SEAT_BUTTON = (() => {
  const textLeft = POS.button.x + POS.button.w / 2 + BUTTON_PAD / 2 - 32;
  return { x: textLeft - 45 - 100, y: POS.button.y + 56 - 200 * 0.74, size: 200, clip: 0.26 };
})();
/** 결과 제목 아래 로봇 자리 (132px 칸 가운데에 200px 그림) */
export const SEAT_RESULT = { x: COL.x + 66 - 100, y: POS.talk + 66 - 100, size: 200, clip: 0 };

export type PageState = {
  t: number;
  scroll: number;
  typed: string;
  caret: boolean;
  focus: number;
  button: { lift: number; press: boolean };
  loading: boolean;
  result: { title: number; bubble: number; papers: number[] };
  /** 번역하지 않고 안내만 하는 답 (짧은 입력, 개인정보). [문구, 나타난 정도 0~1] */
  notice?: [string, number];
};

const rise = (u: number) => ({ opacity: u, transform: `translateY(${(1 - u) * 16}px)` });

export function TranslatePage({ s }: { s: PageState }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: VIEW.w, height: VIEW.h, transform: `scale(${S})`, transformOrigin: "0 0", overflow: "hidden", background: "#FFFFFF" }}>
      <div style={{ position: "absolute", left: 0, top: -s.scroll, width: VIEW.w, fontFamily: PIXEL, color: INK, wordBreak: "keep-all" }}>
        {/* 미색 스크롤 박스 */}
        <div style={{ position: "absolute", left: 8, right: 8, top: 0, height: 2400, background: PAPER, border: `${STROKE}px solid ${INK}`, borderRadius: 28 }} />

        <div style={{ position: "absolute", left: COL.x, top: POS.tabs }}>
          <Tabs active="번역" />
        </div>
        <div style={{ position: "absolute", left: COL.x, top: POS.ticker }}>
          <Ticker t={s.t} width={COL.w} />
        </div>
        <div style={{ position: "absolute", left: COL.x, top: POS.title, fontSize: 36, lineHeight: 1.2 }}>클라이언트 피드백</div>

        {/* 종이 메모 */}
        <Paper shadow={s.focus} style={{ position: "absolute", left: COL.x, top: POS.memo.y, width: COL.w, height: POS.memo.h, padding: "17.6px 24px 22.4px" }}>
          <div style={{ fontSize: 18, lineHeight: 1.6 }}>
            <div>FROM. 클라이언트</div>
            <div>TO. 눈치봇</div>
          </div>
          <Dashes style={{ marginTop: 4, fontSize: 18 }} />
          <div style={{ padding: "9.6px 0", fontSize: 26, lineHeight: 1.5, color: s.typed ? INK : FAINT }}>
            {s.typed || "예) 전체적으로 좀 더 고급스럽게, 근데 너무 무겁진 않게 해주세요. 로고는 더 크게요."}
            {s.caret ? <span style={{ display: "inline-block", width: 1.5, height: "1.1em", background: INK, verticalAlign: "-0.15em", marginLeft: 1 }} /> : null}
          </div>
        </Paper>

        <div style={{ position: "absolute", left: COL.x, top: POS.random }}>
          <SecondaryButton label="랜덤 피드백 뽑기" icon="casino" />
        </div>
        <div style={{ position: "absolute", left: COL.x, top: POS.button.y + 28, transform: "translateY(-50%)", fontSize: 16, color: SUB }}>
          <Icon name="lock" size={14} /> 실명·연락처·회사명은 지우고 넣어주세요.
        </div>
        <div style={{ position: "absolute", left: POS.button.x, top: POS.button.y }}>
          <PrimaryButton label="번역하기" width={POS.button.w} lift={s.button.lift} press={s.button.press} padLeft={BUTTON_PAD} />
        </div>

        {/* 번역 중 (Streamlit 스피너) */}
        {s.loading ? (
          <div style={{ position: "absolute", left: COL.x, top: POS.resultTitle - 4, display: "flex", alignItems: "center", gap: 10, fontSize: 16 }}>
            <svg width={18} height={18} viewBox="0 0 18 18" style={{ rotate: `${(s.t * 360) % 360}deg` }}>
              <circle cx={9} cy={9} r={7} fill="none" stroke="#D5D5D0" strokeWidth={2} />
              <path d="M9 2a7 7 0 0 1 7 7" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
            </svg>
            눈치 보는 중…
          </div>
        ) : null}

        {/* AI 안내 종이 (docs/screenshots/06) */}
        {s.notice ? (
          <div style={{ position: "absolute", left: COL.x, top: 738, width: COL.w, ...rise(s.notice[1]) }}>
            <Paper style={{ padding: "24px 28.8px 25.6px" }}>
              <div style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="info" size={24} />
                AI 안내
              </div>
              <Dashes style={{ marginTop: 2, fontSize: 16 }} />
              <div style={{ marginTop: 16, fontSize: 22, lineHeight: 1.7 }}>{s.notice[0]}</div>
            </Paper>
          </div>
        ) : null}

        {/* 번역 결과 */}
        <div style={{ position: "absolute", left: COL.x, top: POS.resultTitle, fontSize: 24, fontWeight: 700, ...rise(s.result.title) }}>번역 결과</div>
        <div style={{ position: "absolute", left: COL.x + 137, top: POS.talk + 37, width: COL.w - 137, ...rise(clamp01(s.result.bubble * 4)) }}>
          <Bubble style={{ fontSize: 20 }}>
            {SUMMARY.slice(0, Math.round(SUMMARY.length * s.result.bubble))}
            <span style={{ visibility: "hidden" }}>{SUMMARY.slice(Math.round(SUMMARY.length * s.result.bubble))}</span>
          </Bubble>
        </div>
        <div style={{ position: "absolute", left: COL.x, top: POS.papers, width: COL.w, display: "flex", flexDirection: "column", gap: 30 }}>
          {SECTIONS.map((section, i) => (
            <div key={section.title} style={rise(s.result.papers[i] ?? 0)}>
              <Paper style={{ padding: "24px 28.8px 25.6px" }}>
                <div style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name={section.icon} size={24} />
                  {section.title}
                </div>
                <Dashes style={{ marginTop: 2, fontSize: 16 }} />
                {"items" in section ? (
                  <ul style={{ margin: "16px 0 0", paddingLeft: 24, fontSize: 20, lineHeight: 1.7 }}>
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <div style={{ marginTop: 16, fontSize: 20 }}>
                    <CopyBox>{section.reply}</CopyBox>
                    <div style={{ marginTop: 14, fontSize: 16, color: SUB }}>오른쪽 위 아이콘을 누르면 복사돼요.</div>
                  </div>
                )}
              </Paper>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
