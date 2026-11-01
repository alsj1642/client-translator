// 맨 위 소개 영역
// - 흰 배경, 검정 글자 Mona12(픽셀 글꼴, 픽셀 이모지 포함). 큰 카피는 가운데 정렬로 로봇 뒤에 깔림
// - 가운데: 3D 로봇(눈치봇). 처음엔 회색 격자 윤곽선(설계도)이 위에서부터 그려지다가 3D로 바뀜
//   이후 마우스를 따라보고, 드래그로 돌려보고, 누르면 점프
// - 큰 카피는 처음에 흐릿하게 떨리다가, 로봇이 3D로 바뀌며 눈치를 살피듯 '모호한' → '피드백🤔' → 아랫줄을
//   차례로 바라보면 바라본 글자부터 또렷해짐. 마지막에 로봇이 정면을 보며 ^ ^
// - 아래로 스크롤하면 소개 영역에 불투명 유리가 점점 덮임
// - "애니메이션 줄이기"를 켠 컴퓨터에서는 등장 효과 없이 멈춘 로봇만 보여줌
// 로봇은 robot-character.js(Three.js)로 그립니다.

// 글꼴 불러오기: 타자기 느낌 글꼴(아래 입력 화면의 작은 안내 문구) + 픽셀 글꼴 Mona12(소개 영역)
function loadFonts() {
  const fonts = {
    "hero-mono-font": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap",
    "hero-pixel-font": "https://cdn.jsdelivr.net/gh/MonadABXY/mona-font@2026.10.09/web/mona.css",
  };
  for (const [id, href] of Object.entries(fonts)) {
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

// 로봇 불러오기: 앱(파이썬)이 넘겨준 로봇 코드를 모듈로 읽어서 로봇 자리에 붙임
// 인터넷이 끊겨 라이브러리를 못 받으면 로봇 자리만 비고 나머지 소개 영역은 그대로 보여요.
async function mountRobot(root, robotCode, cleanups, copyIntro) {
  const slot = root.querySelector(".hero-robot");
  if (!slot || !robotCode) return;
  const url = URL.createObjectURL(new Blob([robotCode], { type: "text/javascript" }));
  let robot = null;
  let removed = false;
  cleanups.push(() => {
    removed = true;
    robot?.dispose();
  });
  try {
    const { createRobot } = await import(url);
    if (removed) return;
    // halo: 로봇 뒤 밝은 빛 번짐은 끔 / intro: 설계도 윤곽선 → 3D 등장 효과 (흰 배경이라 회색 선)
    // introPixel: 픽셀 글꼴에 맞춰 등장 효과를 도트 느낌으로 (칸 크기 px)
    // sparkle: 나타날 때 주변에 픽셀 별 반짝이 / draggable: 다 나타난 뒤 꾹 눌러서 끌면 자리 옮기기
    robot = createRobot(slot, {
      rotate: true, halo: false, intro: true, lineColor: "#8A9099", lineGlow: 1, introPixel: 6,
      sparkle: true, draggable: true,
      onReveal: () => copyIntro.play(robot), // 3D로 바뀌는 순간 큰 카피 등장 시작
    });
  } catch (err) {
    console.warn("로봇을 불러오지 못했어요.", err);
    slot.style.display = "none";
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 스크롤에 맞춰 두 가지 값을 바꿈
// - --frost (소개 영역): 불투명 유리 정도. 소개 영역 높이의 70%만큼 내리면 다 덮임
// - --sheet (스크롤 상자, styles.css가 씀): 아래 박스가 커진 정도. 박스 윗변이 화면 맨 위에 닿으면 1
function followScroll(root, cleanups) {
  const section = root.querySelector(".hero");
  const scroller = document.querySelector('[data-testid="stMain"]') || document.scrollingElement;
  if (!section || !scroller) return;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  let raf = 0;
  const update = () => {
    raf = 0;
    const app = document.querySelector(".stApp") || document.body;
    const peek = parseFloat(getComputedStyle(app).getPropertyValue("--peek")) || 120;
    const frost = clamp01(scroller.scrollTop / (section.offsetHeight * 0.7));
    const sheet = clamp01(scroller.scrollTop / Math.max(1, section.offsetHeight - peek));
    section.style.setProperty("--frost", frost.toFixed(3));
    scroller.style.setProperty("--sheet", sheet.toFixed(3));
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  update();
  cleanups.push(() => {
    scroller.removeEventListener("scroll", onScroll);
    if (raf) cancelAnimationFrame(raf);
  });
}

// 큰 카피 등장: 흐릿한 글자 → 로봇이 눈치를 살피며 바라본 글자부터 또렷해짐
// 1) 로봇이 설계도 윤곽선으로 그려지는 동안 큰 카피는 흐릿하게 떨림 (hero.css의 .fuzzy)
// 2) 로봇이 3D로 바뀌면(onReveal) '모호한' → '피드백🤔' → 아랫줄 순서로 바라보고, 바라본 글자가 또렷해짐 (.clear)
// 3) 마지막에 정면(보는 사람)을 보며 '정중'(^ ^) 표정, 잠시 뒤 평소 표정으로 돌아가고 다시 마우스를 따라봄
const GAZE = {
  start: 100,  // 3D로 바뀐 뒤 처음 바라보기까지(ms)
  step: 420,   // 한 곳을 바라보는 시간(ms)
  clearAfter: 150, // 바라본 뒤 글자가 또렷해지기 시작하기까지(ms)
  smile: 1200, // 정면을 보며 웃는 시간(ms)
  fallback: 9000, // 로봇이 이 시간 안에 안 나타나면 그냥 글자를 또렷하게(ms)
};

function setupCopyIntro(root, cleanups) {
  const title = root.querySelector(".hero-title");
  const words = [".left", ".right", ".single"].map((s) => title?.querySelector(s)).filter(Boolean);
  if (!title || matchMedia("(prefers-reduced-motion: reduce)").matches) return { play() {} };

  title.classList.add("fuzzy");
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearAll = () => words.forEach((w) => w.classList.add("clear"));
  later(GAZE.fallback, clearAll);
  cleanups.push(() => timers.forEach(clearTimeout));

  let played = false;
  return {
    // 로봇이 3D로 바뀌는 순간 불림
    play(robot) {
      if (played) return;
      played = true;
      words.forEach((word, i) => {
        const at = GAZE.start + i * GAZE.step;
        later(at, () => {
          const r = word.getBoundingClientRect();
          // 글자 덩어리 가운데 (.left/.right는 칸 전체가 아니라 실제 글자 쪽)
          const range = document.createRange();
          range.selectNodeContents(word);
          const t = range.getBoundingClientRect();
          robot.lookAt({ x: t.left + t.width / 2 || r.left + r.width / 2, y: t.top + t.height / 2 || r.top + r.height / 2 });
        });
        later(at + GAZE.clearAfter, () => word.classList.add("clear"));
      });
      const front = GAZE.start + words.length * GAZE.step;
      later(front, () => {
        robot.lookAt("viewer");
        robot.setExpression("정중");
      });
      later(front + GAZE.smile, () => {
        robot.setExpression("기본");
        robot.lookAt(null);
      });
    },
  };
}

// '번역하러 가기 ↓'를 누르면 아래 박스가 화면을 다 채우는 곳(입력 화면)까지 부드럽게 내려감
// 애니메이션 줄이기를 켠 컴퓨터에서는 바로 이동
function goToTranslate(root, cleanups) {
  const hint = root.querySelector(".hint");
  const section = root.querySelector(".hero");
  if (!hint || !section) return;
  const onClick = () => {
    const scroller = document.querySelector('[data-testid="stMain"]') || document.scrollingElement;
    const app = document.querySelector(".stApp") || document.body;
    const peek = parseFloat(getComputedStyle(app).getPropertyValue("--peek")) || 120;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ top: section.offsetHeight - peek, behavior: smooth ? "smooth" : "instant" });
  };
  hint.addEventListener("click", onClick);
  cleanups.push(() => hint.removeEventListener("click", onClick));
}

function createHero(root, robotCode) {
  loadFonts();
  const cleanups = [];
  const copyIntro = setupCopyIntro(root, cleanups);
  mountRobot(root, robotCode, cleanups, copyIntro);
  followScroll(root, cleanups);
  goToTranslate(root, cleanups);
  return () => cleanups.forEach((fn) => fn());
}

// Streamlit이 화면을 다시 그려도 로봇은 처음 한 번만 만들고 계속 이어지게
const heroes = new WeakMap();
export default function ({ parentElement, data }) {
  if (!heroes.has(parentElement)) {
    heroes.set(parentElement, createHero(parentElement, data?.robotCode));
  }
  return () => {
    const dispose = heroes.get(parentElement);
    if (dispose) dispose();
    heroes.delete(parentElement);
  };
}
