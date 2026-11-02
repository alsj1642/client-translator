// 앱의 로봇(hero/robot-character.js)을 영상용 쌍둥이(src/robot/robot-twin.js)로 바꿔 씁니다.
// 원본은 건드리지 않아요. 로봇을 고치면 이 스크립트를 다시 돌리면 돼요.
//   node scripts/make-robot-twin.mjs
//
// 바꾸는 것 (영상 시간으로만 움직이게):
// - 스스로 도는 애니메이션 루프를 끄고, robot.renderAt(초, 상태)로 한 장씩 그림
// - 고개·팔이 이전 프레임 값을 따라가던 부분(lerp)을 바로 그 값으로
// - 점프·등장 시작 시각과 바라보는 곳을 상태로 받음

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../hero/robot-character.js");
const out = resolve(here, "../src/robot/robot-twin.js");

let code = readFileSync(src, "utf8").replace(/\r\n/g, "\n");

function swap(from, to) {
  if (code.split(from).length !== 2) throw new Error(`한 번만 있어야 해요: ${from}`);
  code = code.replace(from, to);
}

// 상태 변수
swap("  let ready = false;", "  let twin = null; // 영상용: renderAt이 넘겨주는 상태\n  let ready = false;");

// 매 프레임 시작: 점프·등장 시작 시각과 바라보는 곳을 상태에서
swap(
  "    now = ms / 1000;\n",
  `    now = ms / 1000;
    if (twin) {
      const j = twin.jumpAt;
      jumpStart = j != null && now >= j && now < j + MOTION.jumpTime ? j : null;
      if (twin.introAt != null) introStart = twin.introAt;
      lookTarget = twin.aim === "viewer" ? "viewer" : null;
      pointerInside = !!twin.aim && twin.aim !== "viewer";
      if (pointerInside) pointer.set(twin.aim.x, twin.aim.y);
    }
`,
);

// 고개와 팔: 이전 값을 따라가지 않고 바로
swap(
  "    look.yaw += (yaw - look.yaw) * MOTION.lookFollow;\n    look.pitch += (pitch - look.pitch) * MOTION.lookFollow;",
  "    if (twin) { look.yaw = yaw; look.pitch = pitch; } else {\n    look.yaw += (yaw - look.yaw) * MOTION.lookFollow;\n    look.pitch += (pitch - look.pitch) * MOTION.lookFollow; }",
);
swap(
  "      arm.rotation.z += (side * flap - arm.rotation.z) * 0.35;",
  "      if (twin) arm.rotation.z = side * flap; else arm.rotation.z += (side * flap - arm.rotation.z) * 0.35;",
);

// 등장 전(시작 시각 이전)에는 아무것도 안 그려진 상태
swap("      const it = now - introStart;", "      const it = Math.max(-1, now - introStart);");

// 스스로 도는 루프는 끔
swap("    renderer.setAnimationLoop(run ? frame : null);", "    renderer.setAnimationLoop(run && !twin ? frame : null);");

// 영상용 그리기 함수
swap(
  "    setExpression, jump, dispose, expressions: EXPRESSION_NAMES,",
  `    renderAt(seconds, state = {}) {
      twin = state;
      renderer.setAnimationLoop(null);
      if (state.expression) expression = state.expression;
      frame(seconds * 1000);
    },
    setExpression, jump, dispose, expressions: EXPRESSION_NAMES,`,
);

// 장면이 바뀌어 로봇이 사라질 때 WebGL 자리를 바로 돌려줌 (브라우저는 한 번에 16개까지만 허용)
swap("    renderer.dispose();", "    renderer.dispose();\n    renderer.forceContextLoss();");

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, "// 자동 생성 파일: scripts/make-robot-twin.mjs (원본 hero/robot-character.js)\n" + code);
console.log("만듦:", out);
