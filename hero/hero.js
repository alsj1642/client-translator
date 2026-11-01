// 맨 위 소개 영역의 움직임
// - 커서가 지나가면 물결처럼 번지는 효과
// - 로고의 두 말풍선(흐릿한 것 → 또렷한 것)이 말랑하게 커서를 따라오고, 누르면 출렁임
// - "애니메이션 줄이기"를 켠 컴퓨터에서는 멈춘 그림 한 장만 보여줌
// 별도 라이브러리 없이 브라우저 기본 WebGL만 씁니다.

const TRAIL = 24; // 물결 자국 개수

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uHover;
uniform float uDark;
uniform vec3 uLayout;   // 말풍선 위치 x, y, 크기
uniform vec2 uOff1;     // 흐릿한 말풍선이 따라온 거리
uniform vec2 uOff2;     // 또렷한 말풍선이 따라온 거리
uniform vec2 uVel;      // 따라오는 속도 (휘어짐)
uniform float uSquash;  // 눌렀을 때 출렁임
uniform vec3 uTrail[${TRAIL}];

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// 로고 좌표(64칸, 가운데 0, 위쪽 +)로 바꾸고 말랑하게 비틀기
vec2 toLogo(vec2 p, vec2 off, vec2 center) {
  float k = uLayout.z / 64.0;
  vec2 q = (p - uLayout.xy - off) / k;
  vec2 m = (uMouse - uLayout.xy - off) / k;
  vec2 c = q - center;
  // 따라오는 속도만큼 휘어짐
  vec2 v = clamp(uVel, -1.6, 1.6);
  q.x -= v.x * c.y * 0.22;
  q.y -= v.y * c.x * 0.14;
  // 눌렀을 때 납작해졌다 튀어오름
  q.y = center.y + (q.y - center.y) * (1.0 + uSquash);
  q.x = center.x + (q.x - center.x) * (1.0 - uSquash * 0.6);
  // 가만히 있어도 살짝 출렁임
  q += vec2(sin(q.y * 0.32 + uTime * 1.6), cos(q.x * 0.28 + uTime * 1.3)) * 0.35;
  // 커서 가까운 쪽이 부풀어 오름
  vec2 dm = q - m;
  q -= dm * exp(-dot(dm, dm) / 60.0) * 0.35 * uHover;
  return q;
}

// 흐릿한 말풍선 (로고 뒤쪽)
float backBubble(vec2 p) {
  vec2 q = toLogo(p, uOff1, vec2(-7.0, 9.5));
  float body = sdRoundBox(q - vec2(-7.0, 9.5), vec2(15.0, 10.5), 10.5);
  float tail = sdTri(q, vec2(-17.0, 2.0), vec2(-20.0, -7.0), vec2(-9.0, 0.0));
  return smin(body, tail, 2.0) * uLayout.z / 64.0;
}
// 또렷한 말풍선 (로고 앞쪽)
float frontBubble(vec2 p) {
  vec2 q = toLogo(p, uOff2, vec2(5.5, -5.0));
  float body = sdRoundBox(q - vec2(5.5, -5.0), vec2(16.5, 12.0), 12.0);
  float tail = sdTri(q, vec2(14.0, -14.0), vec2(20.0, -22.0), vec2(7.0, -16.0));
  return smin(body, tail, 2.0) * uLayout.z / 64.0;
}
// 말풍선 안 글줄
float textLines(vec2 p) {
  vec2 q = toLogo(p, uOff2, vec2(5.5, -5.0));
  float a = sdSeg(q, vec2(-3.0, -2.0), vec2(14.0, -2.0));
  float b = sdSeg(q, vec2(-3.0, -8.5), vec2(7.0, -8.5));
  return (min(a, b) - 1.6) * uLayout.z / 64.0;
}

// 배경: 하늘색 → 크림색, 비스듬한 빛줄기
vec3 background(vec2 q) {
  vec3 sky = mix(vec3(0.75, 0.87, 0.95), vec3(0.043, 0.051, 0.078), uDark);
  vec3 cream = mix(vec3(0.985, 0.968, 0.925), vec3(0.075, 0.10, 0.18), uDark);
  vec3 c = mix(sky, cream, smoothstep(-0.7, 1.0, q.x * 0.55 + q.y * 0.7 + 0.2));
  float w = sin((q.x * 0.9 - q.y * 1.3) * 7.0 + uTime * 0.12 + sin(q.y * 2.5 + uTime * 0.18) * 1.1);
  float band = smoothstep(0.35, 1.0, w) * smoothstep(-0.4, 0.6, q.x * 0.5 + q.y * 0.6 + 0.3);
  vec3 glow = mix(vec3(1.0, 0.985, 0.95), vec3(0.20, 0.36, 0.90), uDark);
  return mix(c, glow, band * mix(0.6, 0.32, uDark));
}

float puff(float d) { return sqrt(clamp(-d / 0.07, 0.0, 1.0)); }

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float px = 1.5 / uRes.y;

  // 커서 자국마다 동그랗게 퍼지는 물결 + 살짝 확대되는 번짐
  vec2 off = vec2(0.0);
  float shine = 0.0;
  float ink = 0.0;
  for (int i = 0; i < ${TRAIL}; i++) {
    vec3 t = uTrail[i];
    if (t.z <= 0.0) continue;
    vec2 dv = p - t.xy;
    float d = length(dv) + 1e-4;
    float age = 1.0 - t.z;
    float r = age * 0.22;
    float ring = exp(-pow((d - r) * 22.0, 2.0)) * t.z;
    off += dv / d * sin((d - r) * 70.0) * ring * 0.014;
    off -= dv * exp(-d * d * 90.0) * t.z * 0.09;
    shine += ring * (0.5 + 0.5 * cos((d - r) * 70.0));
    // 물감이 번지듯 시간이 지날수록 넓고 옅게 퍼짐
    float rr = 0.035 + age * 0.13;
    ink += exp(-d * d / (rr * rr)) * t.z * t.z;
  }
  vec2 q = p + off;

  vec3 col = background(q);
  vec3 inkCol = mix(vec3(0.97, 0.985, 1.0), vec3(0.30, 0.45, 1.0), uDark);
  col = mix(col, inkCol, clamp(ink, 0.0, 1.0) * mix(0.55, 0.40, uDark));
  col += clamp(shine, 0.0, 1.0) * mix(0.10, 0.12, uDark);

  // 또렷한 말풍선의 그림자
  float sh = 1.0 - smoothstep(-0.02, 0.09, frontBubble(q + vec2(-0.012, 0.03)));
  col *= 1.0 - sh * mix(0.10, 0.35, uDark);

  // 흐릿한 말풍선: 가장자리를 넓게 흐려서 '모호한 말'처럼
  float db = backBubble(q);
  float ab = 1.0 - smoothstep(-0.05, 0.05, db);
  vec3 haze = mix(vec3(0.62, 0.74, 0.96), vec3(0.55, 0.64, 1.0), uDark);
  col = mix(col, haze, ab * mix(0.55, 0.32, uDark));

  // 또렷한 말풍선: 말랑한 젤리처럼 볼록하게
  float e = 1.5 / uRes.y;
  float df = frontBubble(q);
  float h0 = puff(df);
  float hx = puff(frontBubble(q + vec2(e, 0.0)));
  float hy = puff(frontBubble(q + vec2(0.0, e)));
  vec3 n = normalize(vec3((h0 - hx) / e * 0.035, (h0 - hy) / e * 0.035, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.8));
  vec3 refr = background(q + n.xy * 0.06);
  vec3 tint = mix(vec3(0.33, 0.53, 0.95), vec3(0.36, 0.48, 1.0), uDark);
  vec3 jelly = mix(refr, tint, 0.45) * (0.82 + 0.28 * max(dot(n, L), 0.0));
  jelly += pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0) * 0.9;
  jelly += pow(1.0 - n.z, 1.6) * 0.35;
  float al = 1.0 - smoothstep(-e, e, textLines(q));
  jelly = mix(jelly, mix(vec3(0.97, 0.98, 1.0), vec3(0.93, 0.95, 1.0), uDark), al * 0.92);
  float af = 1.0 - smoothstep(-px, px, df);
  col = mix(col, jelly, af);

  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function loadMonoFont() {
  // 타자기 느낌 글꼴. 한글은 Pretendard로 보여요.
  if (document.getElementById("hero-mono-font")) return;
  const link = document.createElement("link");
  link.id = "hero-mono-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap";
  document.head.appendChild(link);
}

function isDarkPage() {
  // 앱 배경색이 어두우면 어두운 화면으로 판단
  const el = document.querySelector(".stApp") || document.body;
  const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!m) return false;
  const [r, g, b] = m.map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

function createHero(root, logo) {
  const section = root.querySelector(".hero");
  const canvas = root.querySelector(".hero-canvas");
  const clock = root.querySelector(".clock");
  const coords = root.querySelector(".coords");
  const img = root.querySelector(".brand-logo");
  if (logo) img.src = logo;
  loadMonoFont();

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cleanups = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  // 시계
  const tick = () => {
    const t = new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
    clock.textContent = `서울 GMT+9 ${t}`;
  };
  tick();
  const clockTimer = setInterval(tick, 10000);
  cleanups.push(() => clearInterval(clockTimer));

  // 밝은/어두운 화면
  let dark = isDarkPage();
  let darkMix = dark ? 1 : 0;
  section.dataset.theme = dark ? "dark" : "light";

  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  if (!gl) return () => cleanups.forEach((fn) => fn()); // 그림 없이 글자와 배경색만

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.warn("소개 영역 그림을 그리지 못했어요.", err);
    canvas.style.display = "none";
    return () => cleanups.forEach((fn) => fn());
  }
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  for (const name of ["uRes", "uTime", "uMouse", "uHover", "uDark", "uLayout", "uOff1", "uOff2", "uVel", "uSquash", "uTrail"]) {
    u[name] = gl.getUniformLocation(program, name);
  }

  // 화면 크기에 맞추기
  let W = 1, H = 1, layout = [0, 0, 0.8];
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.max(1, Math.round(rect.width * dpr));
    H = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = W;
    canvas.height = H;
    gl.viewport(0, 0, W, H);
    const aspect = rect.width / Math.max(rect.height, 1);
    layout = aspect > 1.3 ? [aspect * 0.5 * 0.42, 0.0, 0.92] : [0.0, -0.02, Math.min(0.8, aspect * 1.05)];
    if (reduceMotion) draw(0, 0);
  };

  // 커서 상태
  const mouse = { x: 0, y: 0, inside: false, px: 0, py: 0 };
  let hover = 0;
  const trail = new Float32Array(TRAIL * 3);
  const trailTimes = new Float64Array(TRAIL).fill(-1e9);
  let trailHead = 0;
  let lastTrail = { x: 1e9, y: 1e9 };

  const springs = {
    o1: { x: 0, y: 0, vx: 0, vy: 0 },
    o2: { x: 0, y: 0, vx: 0, vy: 0 },
    sq: { x: 0, v: 0 },
  };

  listen(window, "pointermove", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const lx = ev.clientX - rect.left;
    const ly = ev.clientY - rect.top;
    mouse.inside = lx >= 0 && ly >= 0 && lx <= rect.width && ly <= rect.height;
    mouse.x = (lx - rect.width / 2) / rect.height;
    mouse.y = (rect.height / 2 - ly) / rect.height;
    if (mouse.inside) {
      coords.textContent = `${String(Math.round(lx)).padStart(4, "0")} X ${String(Math.round(ly)).padStart(4, "0")} Y`;
    }
  }, { passive: true });
  listen(canvas, "pointerdown", () => { springs.sq.v -= 2.4; });

  let running = !reduceMotion;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  const start = last;
  let frame = 0;

  function draw(time, dt) {
    if (frame++ % 30 === 0) {
      const d = isDarkPage();
      if (d !== dark) { dark = d; section.dataset.theme = dark ? "dark" : "light"; }
    }
    darkMix = reduceMotion ? (dark ? 1 : 0) : darkMix + ((dark ? 1 : 0) - darkMix) * Math.min(1, dt * 6);

    // 물결 자국 남기기
    if (mouse.inside && Math.hypot(mouse.x - lastTrail.x, mouse.y - lastTrail.y) > 0.012) {
      trail[trailHead * 3] = mouse.x;
      trail[trailHead * 3 + 1] = mouse.y;
      trailTimes[trailHead] = time;
      trailHead = (trailHead + 1) % TRAIL;
      lastTrail = { x: mouse.x, y: mouse.y };
    }
    for (let i = 0; i < TRAIL; i++) trail[i * 3 + 2] = Math.max(0, 1 - (time - trailTimes[i]) / 1.4);

    // 말풍선이 커서를 말랑하게 따라오기 (스프링)
    hover += ((mouse.inside ? 1 : 0) - hover) * Math.min(1, dt * 5);
    const follow = (s, f) => {
      const tx = mouse.inside ? Math.max(-0.08, Math.min(0.08, (mouse.x - layout[0]) * f)) : 0;
      const ty = mouse.inside ? Math.max(-0.08, Math.min(0.08, (mouse.y - layout[1]) * f)) : 0;
      s.vx += ((tx - s.x) * 90 - s.vx * 9) * dt;
      s.vy += ((ty - s.y) * 90 - s.vy * 9) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    };
    follow(springs.o1, 0.05);
    follow(springs.o2, 0.11);
    springs.sq.v += (-springs.sq.x * 170 - springs.sq.v * 7) * dt;
    springs.sq.x += springs.sq.v * dt;
    springs.sq.x = Math.max(-0.3, Math.min(0.3, springs.sq.x));

    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uMouse, mouse.x, mouse.y);
    gl.uniform1f(u.uHover, hover);
    gl.uniform1f(u.uDark, darkMix);
    gl.uniform3f(u.uLayout, layout[0], layout[1], layout[2]);
    gl.uniform2f(u.uOff1, springs.o1.x, springs.o1.y);
    gl.uniform2f(u.uOff2, springs.o2.x, springs.o2.y);
    gl.uniform2f(u.uVel, springs.o2.vx * 4, springs.o2.vy * 4);
    gl.uniform1f(u.uSquash, springs.sq.x);
    gl.uniform3fv(u.uTrail, trail);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    raf = 0;
    if (!running || !visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    draw((now - start) / 1000, dt);
    raf = requestAnimationFrame(loop);
  }
  const wake = () => {
    if (running && visible && !document.hidden && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  // 화면 밖에 있거나 다른 탭을 보고 있으면 멈춰서 컴퓨터 부담 줄이기
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); });
  io.observe(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  listen(document, "visibilitychange", wake);
  cleanups.push(() => { io.disconnect(); ro.disconnect(); });

  resize();
  if (reduceMotion) {
    // 움직임 없이 한 장만 그리고, 밝기/어둡기 바뀔 때만 다시 그림
    draw(0, 0);
    const themeTimer = setInterval(() => { if (isDarkPage() !== dark) { frame = 0; draw(0, 0); } }, 1000);
    cleanups.push(() => clearInterval(themeTimer));
  } else {
    wake();
  }

  return () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    cleanups.forEach((fn) => fn());
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}

// Streamlit이 화면을 다시 그려도 그림은 처음 한 번만 만들고 계속 이어지게
const heroes = new WeakMap();
export default function ({ parentElement, data }) {
  if (!heroes.has(parentElement)) {
    heroes.set(parentElement, createHero(parentElement, data && data.logo));
  }
  return () => {
    const dispose = heroes.get(parentElement);
    if (dispose) dispose();
    heroes.delete(parentElement);
  };
}
