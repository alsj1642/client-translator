// 하소연 탭 (4단계)
// 1) 적기: 줄 종이에 적는 동안 로봇은 옆에서 가만히 들어줌 (마우스를 따라봄)
// 2) 구겨지는 중: '구겨서 던지기'를 누르면 종이가 몇 단계로 구겨지며 공이 되고, 글은 그 순간 지워짐
// 3) 던지기: 구겨진 종이가 포물선을 그리며 쓰레기통으로 날아감 (쓰레기통이 살짝 흔들림)
// 4) 로봇 반응: AI 답을 기다리는 동안 '생각 중', 답이 오면 고른 말투 표정(정중/팩폭)으로 말풍선에 한마디
// 로봇 한마디를 끄면 글은 어디에도 보내지 않고, 고정 문구(data.fixedReply)만 보여줌
// 켜면 글(앞부분)과 말투를 파이썬에 보내고(setTriggerValue 'throw'), 파이썬이 AI 답을 data.reply로 돌려줌
// "애니메이션 줄이기"를 켠 컴퓨터에서는 구겨지기/날아가기 없이 바로 비움

const EMPTY_PAPER = "먼저 적어주세요. 빈 종이는 못 던져요.";
const WAITING = "음…";
const MAX_CHARS = 300;     // 파이썬에 보내는 글자 수 (앞부분만. 파이썬에서도 한 번 더 자름)
const REPLY_TIMEOUT = 25000; // 이 시간 안에 답이 안 오면 고정 문구로 마무리(ms)
const MOTION = {
  crumple: 1100, // 구겨지는 시간(ms)
  flight: 850,   // 날아가는 시간(ms)
  ball: 58,      // 다 구겨진 종이 공 크기(px)
  lid: 180,      // 쓰레기통 뚜껑이 열리고 닫히는 시간(ms)
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// 구겨지는 단계: [크기 비율(종이 → 공), 가장자리가 안쪽으로 패이는 정도, 기울기(deg)]
// 처음엔 가장자리가 쭈글쭈글해지고 → 반으로 접히듯 줄고 → 꾹 뭉쳐 공이 됨
const CRUMPLE_STEPS = [
  [1, 0, 0],
  [0.86, 0.07, -3],
  [0.62, 0.16, 5],
  [0.34, 0.26, -9],
  [0, 0.34, -16],
];
const EDGE_POINTS = 24; // 가장자리 점 개수 (많을수록 울퉁불퉁이 잘게)

// 사각형 둘레를 따라 점을 찍고, 점마다 정해진 만큼 가운데로 당겨서 울퉁불퉁한 모양을 만듦
function crumpleShape(depth, dents) {
  const pts = dents.map((dent, i) => {
    const t = (i / EDGE_POINTS) * 4; // 0~4: 위 → 오른쪽 → 아래 → 왼쪽 변
    const side = Math.floor(t);
    const f = t - side;
    const [x, y] = [[f, 0], [1, f], [1 - f, 1], [0, 1 - f]][side];
    const pull = depth * dent;
    return `${(x + (0.5 - x) * pull) * 100}% ${(y + (0.5 - y) * pull) * 100}%`;
  });
  return `polygon(${pts.join(", ")})`;
}

// 구김 무늬: 접힌 면의 그늘 + 구김 선 (구겨질수록 진해짐). 선 굵기는 크기가 줄어도 그대로
const CREASES_SVG = `<svg class="vent-creases" viewBox="0 0 100 100" preserveAspectRatio="none">
  <g fill="#111">
    <polygon points="0,0 38,18 22,52 0,40" opacity="0.07"/>
    <polygon points="38,18 70,0 100,30 64,44" opacity="0.12"/>
    <polygon points="22,52 64,44 58,100 18,100" opacity="0.09"/>
    <polygon points="64,44 100,30 100,78 58,100" opacity="0.15"/>
    <polygon points="0,40 22,52 18,100 0,100" opacity="0.05"/>
  </g>
  <g fill="none" stroke="#111" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linejoin="round">
    <path d="M0 0 L38 18 L70 0 M38 18 L22 52 L0 40 M22 52 L64 44 L100 30 M64 44 L58 100 M22 52 L18 100 M64 44 L38 18"/>
    <path d="M10 70 L22 52 M40 74 L58 100 M80 60 L64 44 M50 30 L64 44" opacity="0.6"/>
  </g>
</svg>`;

function createVent(root, data) {
  const $ = (s) => root.querySelector(s);
  const vent = $(".vent");
  const textarea = $("#vent-text");
  const paper = $(".vent-paper");
  const count = $(".vent-count");
  const title = $(".vent-bubble-title");
  const sub = $(".vent-bubble-sub");
  const throwBtn = $(".vent-throw");
  const burnBtn = $(".vent-burn");
  const bin = $(".vent-bin");
  const aiBox = $(".vent-ai");
  const aiSwitch = $(".vent-switch");
  const toneButtons = [...root.querySelectorAll(".vent-tone button")];
  const can = $(".vent-can");

  let robot = null;
  let removed = false;
  let tone = "정중";
  let pendingId = null;   // 지금 답을 기다리는 던지기 번호
  let landed = null;      // 종이가 쓰레기통에 들어가면 풀리는 약속
  let timeout = 0;
  let sendThrow = () => {};
  const fixedReply = data?.fixedReply || "다 털었어요. 한결 가볍죠?";

  function say(text, more = "") {
    title.textContent = text;
    sub.textContent = more;
  }
  function face(name) {
    robot?.setExpression(name);
  }
  function updateCount() {
    count.textContent = `${Array.from(textarea.value).length}자`;
  }
  function setBusy(busy) {
    throwBtn.disabled = busy;
    burnBtn.disabled = busy;
  }

  // 로봇
  (async () => {
    if (!data?.robotCode) return;
    const url = URL.createObjectURL(new Blob([data.robotCode], { type: "text/javascript" }));
    try {
      const { createRobot } = await import(url);
      if (removed) return;
      robot = createRobot($(".vent-robot"), { halo: false });
    } catch (err) {
      console.warn("하소연 로봇을 불러오지 못했어요.", err);
    } finally {
      URL.revokeObjectURL(url);
    }
  })();

  // 말투 고르기 / 로봇 한마디 켜기·끄기
  toneButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      tone = btn.dataset.tone;
      toneButtons.forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
    }),
  );
  aiSwitch.addEventListener("click", () => {
    const on = aiSwitch.getAttribute("aria-checked") !== "true";
    aiSwitch.setAttribute("aria-checked", String(on));
    aiBox.classList.toggle("off", !on);
  });
  const aiOn = () => aiSwitch.getAttribute("aria-checked") === "true";

  textarea.addEventListener("input", updateCount);

  // 위치를 하소연 영역 기준으로
  function boxOf(el) {
    const v = vent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - v.left, y: r.top - v.top, w: r.width, h: r.height };
  }

  // 쓰레기통 뚜껑 열기/닫기 (왼쪽 끝을 축으로 들림)
  const lid = $(".vent-lid");
  function moveLid(open) {
    return lid.animate(
      [{ rotate: open ? "0deg" : "-38deg" }, { rotate: open ? "-38deg" : "0deg" }],
      { duration: MOTION.lid, easing: "ease-out", fill: "forwards" },
    ).finished;
  }

  // 2) 구겨지기 + 3) 던지기
  async function crumpleAndThrow() {
    if (reduceMotion) return;
    const p = boxOf(paper);
    const size = MOTION.ball;
    const dents = Array.from({ length: EDGE_POINTS }, (_, i) => (i % 2 ? 0.55 : 0.15) + Math.random() * 0.45);

    // 줄 종이를 그대로 본뜬 한 장을 겹치고, 뒤에 있던 종이는 숨김 (그 종이가 구겨지는 것처럼)
    const outline = document.createElement("div");
    outline.className = "vent-ghost-outline";
    const ghost = document.createElement("div");
    ghost.className = "vent-ghost";
    ghost.innerHTML = CREASES_SVG;
    outline.appendChild(ghost);
    vent.appendChild(outline);
    paper.style.visibility = "hidden";

    // 단계마다 크기, 울퉁불퉁함, 기울기가 바뀜 (가운데를 기준으로 줄어듦)
    const frames = CRUMPLE_STEPS.map(([scale, depth, tilt], i) => {
      const w = size + (p.w - size) * scale;
      const h = size + (p.h - size) * scale;
      return {
        offset: i / (CRUMPLE_STEPS.length - 1),
        left: `${p.x + (p.w - w) / 2}px`,
        top: `${p.y + (p.h - h) / 2}px`,
        width: `${w}px`,
        height: `${h}px`,
        clipPath: crumpleShape(depth, dents),
        rotate: `${tilt}deg`,
      };
    });
    const creases = ghost.querySelector(".vent-creases");
    creases.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.35 }, { opacity: 1 }], { duration: MOTION.crumple, fill: "forwards" });
    await ghost.animate(frames, { duration: MOTION.crumple, easing: "cubic-bezier(0.5, 0, 0.6, 1)", fill: "forwards" }).finished;

    // 구겨진 종이 그대로 쓰레기통까지 포물선 (날아가는 동안 뚜껑이 열림)
    const c = boxOf(can);
    const startX = p.x + p.w / 2 - size / 2;
    const startY = p.y + p.h / 2 - size / 2;
    const dx = c.x + c.w / 2 - size / 2 - startX;
    const dy = c.y + 26 - size / 2 - startY; // 쓰레기통 입구 조금 안쪽
    const lift = Math.max(90, -dy + 90); // 포물선 높이
    const flight = Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      return {
        translate: `${dx * t}px ${dy * t - 4 * lift * t * (1 - t)}px`,
        rotate: `${-16 + t * 540}deg`,
        scale: `${1 - t * 0.5}`,
        opacity: i === 12 ? 0 : 1, // 입구에 닿는 마지막 순간에 쏙 들어감
      };
    });
    const opened = moveLid(true);
    await ghost.animate(flight, { duration: MOTION.flight, easing: "cubic-bezier(0.3, 0, 0.7, 1)", fill: "forwards" }).finished;
    outline.remove();
    await opened;

    // 들어가면 뚜껑이 닫히고 쓰레기통이 살짝 흔들림. 빈 줄 종이가 다시 나타남
    moveLid(false);
    can.animate(
      [{ rotate: "0deg" }, { rotate: "-6deg" }, { rotate: "4deg" }, { rotate: "-2deg" }, { rotate: "0deg" }],
      { duration: 420, easing: "ease-out" },
    );
    paper.style.visibility = "";
    paper.animate([{ opacity: 0, translate: "0 8px" }, { opacity: 1, translate: "0 0" }], { duration: 300, easing: "ease-out" });
  }

  async function onThrow() {
    const text = textarea.value.trim();
    if (!text) {
      say(EMPTY_PAPER);
      return;
    }
    setBusy(true);
    const id = Date.now();
    const useAi = aiOn();
    if (useAi) {
      // 애니메이션과 동시에 AI 답을 받으러 보냄 (기다리는 시간을 줄이려고)
      pendingId = id;
      sendThrow({ id, text: Array.from(text).slice(0, MAX_CHARS).join(""), tone });
    }
    textarea.value = ""; // 글은 이 순간 사라짐
    updateCount();
    landed = crumpleAndThrow().catch(() => {});
    await landed;

    if (!useAi) {
      say(fixedReply);
      face("정중");
      setBusy(false);
      return;
    }
    // 4) 답을 기다리는 동안 '생각 중'
    if (pendingId === id) {
      say(WAITING);
      face("생각 중");
      timeout = setTimeout(() => {
        if (pendingId !== id) return;
        pendingId = null;
        say(fixedReply);
        face("기본");
        setBusy(false);
      }, REPLY_TIMEOUT);
    }
  }

  // 쓰레기통 불태우기: 불길이 솟고 쓰레기통이 까맣게 타다가 → 주저앉아 재 더미 + 연기 → 새 쓰레기통이 톡 떨어짐
  async function onBurn() {
    setBusy(true);
    const fire = $(".vent-fire");
    const ash = $(".vent-ash");
    const smokes = [...root.querySelectorAll(".vent-smoke")];
    const T = reduceMotion ? 0 : 1; // 애니메이션 줄이기면 시간 0 (바로 재 → 새 쓰레기통)

    // 1) 불붙음
    bin.classList.add("burning");
    fire.animate([{ scale: 0 }, { scale: 1 }], { duration: 250 * T, easing: "ease-out", fill: "forwards" });
    await can.animate([{ filter: "brightness(1)" }, { filter: "brightness(0.25)" }], { duration: 1400 * T, fill: "forwards" }).finished;

    // 2) 불이 꺼지며 쓰레기통이 주저앉고 재 더미가 남음, 연기가 피어오름
    fire.animate([{ scale: 1 }, { scale: 0 }], { duration: 300 * T, easing: "ease-in", fill: "forwards" });
    can.animate(
      [{ scale: "1 1", opacity: 1 }, { scale: "1.1 0.2", opacity: 0 }],
      { duration: 400 * T, easing: "ease-in", fill: "forwards" },
    );
    ash.animate([{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }], { duration: 400 * T, easing: "ease-out", fill: "forwards" });
    smokes.forEach((smoke, i) =>
      smoke.animate(
        [{ opacity: 0, translate: "0 0", scale: 0.6 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0, translate: `${i ? 10 : -8}px -46px`, scale: 1.6 }],
        { duration: 1300 * T, delay: (250 + i * 250) * T, easing: "ease-out" },
      ),
    );
    await new Promise((done) => setTimeout(done, 1800 * T));
    bin.classList.remove("burning");

    // 3) 재가 사라지고 새 쓰레기통이 위에서 톡 떨어짐
    await ash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 * T, fill: "forwards" }).finished;
    can.getAnimations().forEach((a) => a.cancel());
    await can.animate(
      [{ translate: "0 -24px", opacity: 0 }, { translate: "0 0", opacity: 1, offset: 0.7 }, { translate: "0 -4px" }, { translate: "0 0" }],
      { duration: 450 * T, easing: "ease-out" },
    ).finished;
    setBusy(false);
  }

  throwBtn.addEventListener("click", onThrow);
  burnBtn.addEventListener("click", onBurn);

  return {
    // 파이썬이 다시 그릴 때마다: 보낼 함수 갱신 + 기다리던 답이 왔으면 보여줌
    update(nextData, setTriggerValue) {
      sendThrow = (value) => setTriggerValue("throw", value);
      const reply = nextData?.reply;
      if (!reply || reply.id !== pendingId) return;
      pendingId = null;
      clearTimeout(timeout);
      Promise.resolve(landed).then(() => {
        say(reply.text);
        face(reply.face || "정중");
        setBusy(false);
      });
    },
    dispose() {
      removed = true;
      clearTimeout(timeout);
      robot?.dispose();
    },
  };
}

// Streamlit이 화면을 다시 그려도 하소연 화면은 처음 한 번만 만들고 이어감
const vents = new WeakMap();
export default function ({ parentElement, data, setTriggerValue }) {
  if (!vents.has(parentElement)) {
    vents.set(parentElement, createVent(parentElement, data));
  }
  vents.get(parentElement).update(data, setTriggerValue);
  return () => {
    vents.get(parentElement)?.dispose();
    vents.delete(parentElement);
  };
}
