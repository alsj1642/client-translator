// 입력 화면의 작은 로봇 (눈치봇): '번역하기' 버튼 왼쪽에 고정으로 앉아 있음 (버튼 위로 튀어나와도 됨)
// - 번역이 끝나면 버튼에서 빠져서 '번역 결과' 제목 아래 자리(.st-key-result-robot)로 옮겨 앉음. 옆에 요약 말풍선
// - 고개 각도는 고정. 눈만 마우스 커서를 따라감. 누르면 점프 (돌려보기, 옮기기는 없음)
// - 표정: 평소 '기본', 번역 중 '생각 중', 결과가 나오면 '정중', 오류면 '오류', 누르면 '하트'
// 상태(status)는 앱(파이썬)이 넘겨줌: idle / result / error. 번역 중인지는 화면의 로딩 표시로 알아챔.
// 로봇을 버튼 안에 넣으면 로봇을 눌러도 번역이 시작되므로, body에 따로 붙이고 버튼 위치에 맞춰 겹쳐 그림.

const FACES = { idle: "기본", result: "정중", error: "오류" };
const THINKING_FACE = "생각 중";
const SEAT = {
  size: 200,   // 로봇 그림 크기(px). 로봇은 그림 가운데 절반쯤을 차지함
  centerX: 52, // 버튼 왼쪽 끝에서 로봇 가운데까지(px)
  drop: 0.74,  // 버튼 아래 끝에 맞출 그림 높이 비율. 작을수록 로봇이 위로 튀어나옴
};

function createBuddy(root, robotCode) {
  const anchor = root.querySelector(".buddy-anchor");
  const host = anchor.getRootNode().host || anchor;

  // 화면 전체를 덮는 투명한 판 (클릭은 통과) + 그 위의 로봇 자리
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:50;pointer-events:none;display:none;";
  const slot = document.createElement("div");
  slot.style.cssText = `position:absolute;width:${SEAT.size}px;height:${SEAT.size}px;pointer-events:none;`;
  overlay.appendChild(slot);
  document.body.appendChild(overlay);

  let status = "idle";
  let robot = null;
  let removed = false;
  let raf = 0;
  let face = null;

  const scroller = () => document.querySelector('[data-testid="stMain"]');
  const panel = () => host.closest('[role="tabpanel"]') || document;
  const button = () => panel().querySelector('[data-testid="stBaseButton-primary"]');
  const resultSpot = () => panel().querySelector(".st-key-result-robot");

  function visibleNow() {
    if (!anchor.getClientRects().length) return 0; // 다른 탭을 보고 있음
    const sheet = parseFloat(scroller()?.style.getPropertyValue("--sheet")) || 0;
    return Math.min(1, Math.max(0, (sheet - 0.6) * 2.5)); // 입력 화면이 나타나는 정도와 같게
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    const btnEl = button();
    const spotEl = status === "result" ? resultSpot() : null; // 결과가 나왔으면 제목 아래 자리로
    btnEl?.toggleAttribute("data-buddy", !spotEl); // 로봇이 버튼에 앉아 있을 때만 버튼 글자를 오른쪽으로 (styles.css)
    const seat = (spotEl || btnEl)?.getBoundingClientRect();
    const show = robot && seat?.width ? visibleNow() : 0;
    overlay.style.display = show > 0 ? "block" : "none";
    overlay.style.opacity = show;
    if (!show) return;

    // 자리에 맞춰 겹침 (스크롤하면 같이 움직임)
    // 휴대폰처럼 좁으면 결과 자리의 로봇은 조금 작게
    const size = spotEl && innerWidth <= 720 ? SEAT.size * 0.7 : SEAT.size;
    slot.style.width = slot.style.height = `${size}px`;
    if (spotEl) {
      slot.style.left = `${seat.left + seat.width / 2 - size / 2}px`;
      slot.style.top = `${seat.top + seat.height / 2 - size / 2}px`;
      slot.style.clipPath = "none";
    } else {
      slot.style.left = `${seat.left + SEAT.centerX - SEAT.size / 2}px`;
      slot.style.top = `${seat.bottom - SEAT.size * SEAT.drop}px`;
      // 버튼 아래로 삐져나온 부분(바닥 그림자)은 잘라서 로봇이 버튼 안에 앉은 것처럼
      slot.style.clipPath = `inset(0 0 ${(1 - SEAT.drop) * 100}% 0)`;
    }

    // 표정: 번역 중(로딩 표시가 보임)이면 '생각 중', 아니면 상태에 맞게
    const thinking = !!document.querySelector('[data-testid="stSpinner"]');

    const next = thinking ? THINKING_FACE : FACES[status] || FACES.idle;
    if (next !== face) robot.setExpression((face = next));
  }

  // 마우스가 로봇 위에 있을 때만 로봇이 클릭을 받음 (빈 곳은 아래 버튼으로 통과)
  function onPointerMove(e) {
    if (robot) slot.style.pointerEvents = robot.hits(e) ? "auto" : "none";
  }
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  (async () => {
    if (!robotCode) return;
    const url = URL.createObjectURL(new Blob([robotCode], { type: "text/javascript" }));
    try {
      const { createRobot } = await import(url);
      if (removed) return;
      // 등장 효과 없이 바로 3D / 고개 고정, 눈만 마우스 따라감 / 누르면 점프하며 '하트'
      robot = createRobot(slot, { halo: false, turnHead: false, pressFace: "하트" });
      slot.querySelector("canvas").style.cursor = "pointer";
    } catch (err) {
      console.warn("작은 로봇을 불러오지 못했어요.", err);
    } finally {
      URL.revokeObjectURL(url);
    }
  })();
  raf = requestAnimationFrame(tick);

  return {
    setStatus(value) {
      status = value;
    },
    dispose() {
      removed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      robot?.dispose();
      overlay.remove();
    },
  };
}

// Streamlit이 화면을 다시 그려도 로봇은 처음 한 번만 만들고, 상태만 바꿈
const buddies = new WeakMap();
export default function ({ parentElement, data }) {
  if (!buddies.has(parentElement)) {
    buddies.set(parentElement, createBuddy(parentElement, data?.robotCode));
  }
  buddies.get(parentElement).setStatus(data?.status || "idle");
  return () => {
    buddies.get(parentElement)?.dispose();
    buddies.delete(parentElement);
  };
}
