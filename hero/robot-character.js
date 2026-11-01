// 로봇 캐릭터 (3D). 필요한 라이브러리: three@0.186.1  (npm install three@0.186.1)
//
// 사용법:
//   import { createRobot } from './robot-character.js';
//   const robot = createRobot(document.getElementById('robot'));   // 이 요소 크기에 맞춰 그림
//   robot.setExpression('생각 중');   // 기본, 정중, 팩폭, 생각 중, 오류, 하트
//   robot.jump();                    // 양팔 파닥이며 점프 (로봇을 클릭해도 점프)
//   robot.dispose();                 // 화면에서 뗄 때 정리
//
// 옵션: createRobot(element, { background: '#E6E9EE', rotate: false, zoom: false, halo: true, intro: false, lineColor: '#FFFFFF', lineGlow: 2.4 })
//   background: 배경색 (기본 = 투명, 뒤에 있는 페이지가 보임)
//   rotate: 드래그로 돌려보기 (기본 = 꺼짐)
//   zoom: 휠로 확대/축소 (기본 = 꺼짐. 켜면 로봇 위에서 페이지 스크롤이 막힘)
//   halo: 로봇 뒤 은은한 후광 (기본 = 켜짐. 아주 밝은 배경에서 탁해 보이면 false)
//   intro: 처음 나타날 때 격자 윤곽선(설계도)이 위에서부터 그려지다가 3D로 바뀜 (기본 = 꺼짐)
//   lineColor, lineGlow: 등장 효과 윤곽선 색과 밝기 (기본 = 흰색, 2.4. 흰 배경이면 진한 색 + 1)
//   introPixel: 등장 효과를 픽셀(도트) 느낌으로. 칸 크기(px). 3D로 바뀌면서 칸이 작아짐 (기본 = 0, 끔)
//   sparkle: 등장 효과에서 3D로 바뀔 때 주변에 픽셀 별 반짝이가 톡톡 터짐 (기본 = 꺼짐)
//   draggable: 다 나타난 뒤 로봇을 꾹 눌러(0.35초) 끌면 자리를 옮길 수 있음 (기본 = 꺼짐)
//              로봇을 담은 요소(container)를 CSS translate로 옮기고, 그 부모 영역 밖으로는 못 나감
//   pressFace: 로봇을 눌러 점프하는 동안 보일 표정 (기본 = '정중')
//   turnHead: 마우스 쪽으로 고개를 돌림 (기본 = 켜짐. 끄면 고개 각도는 고정, 눈만 마우스를 따라감)
//
// 위치 옮기기: robot.getOffset() / robot.setOffset(x, y) = container를 옮긴 거리(px),
//   robot.isHeld() = 지금 꾹 눌러서 옮기는 중인지, robot.hits(event) = 그 마우스 위치에 로봇이 있는지
//
// - 마우스는 로봇 위가 아니라 페이지 어디에 있든 따라봄
// - 컴퓨터의 "애니메이션 줄이기"가 켜져 있으면 가만히 선 그림으로 멈춤 (표정은 바뀜)
// - 화면 밖으로 스크롤되거나 다른 탭을 보고 있으면 그리기를 쉼
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ============================================================
// 바꿔도 되는 값들 (머리 폭 = 1 기준)
// ============================================================
const SIZE = {
  headWidth: 1,
  headHeight: 0.86,
  headDepth: 0.86,
  bodyWidth: 0.5,
  bodyHeight: 0.3,
  bodyDepth: 0.42,
  armWidth: 0.11,
  armHeight: 0.17,
  armDepth: 0.16,
  hoverHeight: 0.3, // 바닥에서 떠 있는 높이
  headGap: 0.02, // 몸통과 머리 사이 띄운 간격
  // 귀
  earCupWidth: 0.1, // 귀가 옆으로 튀어나온 정도
  earCupSize: 0.5, // 귀 앞뒤/위아래 크기
  earPlateSize: 0.28, // 귀 바깥쪽 작은 판 크기
  // 얼굴 화면
  screenWidth: 0.66,
  screenHeight: 0.5,
  cornerRatio: 0.35, // 화면, 귀 판의 모서리 둥글기 (가장 짧은 변 대비 비율)
};

const COLOR = {
  accent: '#FF6512', // 귀 (주황)
  silver: '#D3D8DF', // 로봇 전체 (은빛)
  face: '#10151F',
  faceGlow: '#E8FBFF',
  // 보송한 무광 질감에 묻어나는 반사광 색
  sheen: '#C8ECFF', // 가장자리 벨벳 광택
  rimCool: '#4FC8FF', // 왼쪽 하늘색 빛
  rimWarm: '#FFA8D2', // 오른쪽 뒤 분홍 빛
  // 윤곽선을 따라 얇게 빛나는 테두리 (위쪽 하늘색 → 아래쪽 분홍)
  edgeTop: '#2FD4FF',
  edgeBottom: '#FF9ACB',
};

// 얇은 빛 테두리
const EDGE_GLOW = {
  strength: 1.4, // 밝기 (1보다 크면 빛나는 느낌)
  thinness: 4, // 클수록 테두리가 얇아짐
  bottomAmount: 0.45, // 아래쪽(분홍) 테두리 진하기 (위쪽 하늘색 = 1)
  noise: 0.18, // 테두리에 얹는 자글자글한 입자 세기
};
const EDGE_SOFT = 0.25; // 가장자리 뿌연 정도 (0 = 또렷, 클수록 넓게 뿌옇게 번짐)

const GLOW = {
  grain: 0.045, // 화면 전체 노이즈 입자감 (0 = 없음)
  halo: 0.85, // 로봇 뒤 후광 진하기
  haloSize: 3, // 후광 크기
};

const HEAD_ROUND = 0.45; // 머리 둥글기 (작을수록 네모, 1 = 공)

const MOTION = {
  // 가만히 있을 때: 둥둥 떠오르내림, 머리 까딱, 팔 살랑, 가끔 눈 깜빡
  floatBob: 0.035, // 전체가 둥둥 떠오르내리는 폭
  headBob: 0.015, // 머리가 몸통보다 살짝 늦게 따라 움직이는 폭
  headTilt: 0.05, // 머리 좌우 기울기 (라디안)
  armSwing: 0.08, // 팔 앞뒤 흔들림 (라디안)
  speed: 1.6,
  blinkEvery: 3.5, // 눈 깜빡임 간격 (초)
  blinkLength: 0.14,
  // 마우스 따라보기
  lookYaw: 0.7, // 고개 좌우 최대 (라디안)
  lookPitch: 0.25, // 고개 위아래 최대
  eyeShiftX: 0.045, // 화면 안에서 눈이 움직이는 최대 거리
  eyeShiftY: 0.05,
  lookFollow: 0.1, // 따라가는 빠르기 (0~1)
  // 점프
  jumpHeight: 0.28,
  jumpTime: 0.75, // 초
  flapAngle: 0.9, // 팔 벌리는 각도
  flapCount: 4, // 점프 동안 파닥이는 횟수
};

// ============================================================
// 표정: 둥근 픽셀로 그림 (# = 빛나는 픽셀, . = 빈칸). 획 굵기는 기본 눈에 맞춰 2~3칸
// left/right = 왼쪽/오른쪽 눈 (보는 사람 기준), 두 눈이 같으면 eye 하나로
// brow = 오른쪽 눈 위에만 붙는 눈썹 (깜빡일 때 같이 접히지 않음)
// ============================================================
const PIXEL = 0.017; // 픽셀 한 칸 크기
const EYE = {
  gap: 0.158, // 미간 (두 눈 안쪽 끝 사이 거리, 모든 표정 공통)
  y: 0.02, // 눈 높이 (얼굴 기준)
  browGap: 0.05, // 눈과 눈썹 사이 띄우는 거리
};

const EXPRESSIONS = {
  기본: { eye: ['######', '######', '######', '######', '######', '######', '######', '######'] },
  정중: { eye: ['....##....', '...####...', '..######..', '.###..###.', '###....###', '##......##'] },
  팩폭: {
    eye: ['########', '########', '########'],
    // 눈(8칸)보다 조금 짧은 7칸, 안쪽(왼쪽)이 낮은 완만한 사선
    brow: ['....###', '.######', '######.', '###....'],
    eyeY: -0.03,
  },
  '생각 중': {
    left: ['######', '######', '######', '######', '######', '######', '######', '######'],
    right: ['......', '......', '......', '######', '######', '......', '......', '......'],
    thinking: true, // 머리 위 점 세 개
  },
  오류: {
    eye: ['##....##', '###..###', '.######.', '..####..', '..####..', '.######.', '###..###', '##....##'],
    color: '#FF4D5E',
  },
  하트: { eye: ['.###..###.', '##########', '##########', '##########', '.########.', '..######..', '...####...', '....##....'] },
};

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);

// ============================================================
// 모양, 재질 만드는 도구
// ============================================================
const glsl = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

// 등장 효과(블루프린트) 값: createRobot이 로봇마다 하나씩 만들고, 그 로봇의 재질들이 함께 씀
//   amount: 1 = 흰 윤곽선만 보임(설계도), 0 = 원래 3D 모습
//   reveal: 이 높이보다 위쪽만 보임 (위에서부터 그려지는 효과)
let currentBlueprint = null;
// 등장 효과 반짝이: 윤곽선이 다 그려질 즈음(2초)부터 1.6초 동안 하나씩 터지고, 하나는 0.7초 동안 보임
const INTRO_SPARKLE = { start: 2.0, spread: 1.6, life: 0.7 };
// 등장 효과 격자 윤곽선의 촘촘함 (픽셀 느낌일 땐 선이 뭉치지 않게 듬성듬성): createRobot이 정함
let currentGrid = { rings: 9, meridians: 16, innerRings: true };

function material(color, { edgeGlow = true } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    // 보송한 무광: 거칠게 해서 번들거림을 없애고, 가장자리에만 벨벳 같은 광택
    roughness: 0.85,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: COLOR.sheen,
    transparent: true,
  });
  const glowStrength = edgeGlow ? EDGE_GLOW.strength : 0;
  const edgeTop = new THREE.Color(COLOR.edgeTop);
  const edgeBottom = new THREE.Color(COLOR.edgeBottom);
  const blueprint = currentBlueprint;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBlueprint = blueprint.amount;
    shader.uniforms.uReveal = blueprint.reveal;
    shader.uniforms.uBpColor = blueprint.color;
    shader.vertexShader = 'varying vec3 vBpWorld;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vBpWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );
    shader.fragmentShader = 'uniform float uBlueprint;\nuniform float uReveal;\nuniform vec3 uBpColor;\nvarying vec3 vBpWorld;\n' + shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      vec3 n = normalize(normal);
      float facing = abs(dot(n, normalize(vViewPosition)));
      // 윤곽선을 따라 얇게 빛나는 테두리: 왼쪽 위를 향한 면은 하늘색, 오른쪽 아래는 분홍
      float rim = pow(1.0 - facing, ${EDGE_GLOW.thinness.toFixed(1)});
      float topSide = smoothstep(-0.4, 0.4, n.y - n.x * 0.6);
      vec3 rimColor = mix(${glsl(edgeBottom)}, ${glsl(edgeTop)}, topSide);
      float rimAmount = clamp(rim * 1.6, 0.0, 1.0) * mix(${EDGE_GLOW.bottomAmount.toFixed(2)}, 1.0, topSide);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, rimColor * ${glowStrength.toFixed(2)}, rimAmount * ${edgeGlow ? '1.0' : '0.0'});
      // 테두리 쪽에만 자글자글한 입자
      float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      float edgeNoise = grain * ${EDGE_GLOW.noise.toFixed(2)} * clamp(rim * 2.0, 0.0, 1.0) * ${edgeGlow ? '1.0' : '0.0'};
      gl_FragColor.rgb += edgeNoise;
      // 맨 바깥 윤곽은 투명하게 (입자로 흩어지듯) → 배경에 스며드는 뿌연 느낌
      gl_FragColor.a *= clamp(smoothstep(0.0, ${EDGE_SOFT.toFixed(3)}, facing) + edgeNoise * 0.6, 0.0, 1.0);
      // 블루프린트(설계도): 부품마다 바깥 윤곽만 선으로. 안쪽은 비워서 뒤쪽 선은 가려짐
      float bpLine = 1.0 - smoothstep(0.22, 0.4, facing);
      gl_FragColor = mix(gl_FragColor, vec4(uBpColor, bpLine), uBlueprint);
      // 위에서부터 그려지는 효과: uReveal보다 위쪽만 보임
      gl_FragColor.a *= smoothstep(uReveal - 0.03, uReveal + 0.03, vBpWorld.y);`
    );
  };
  mat.customProgramCacheKey = () => `edge-${glowStrength}`;
  return mat;
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function smoothed(geo) {
  // 면 사이 음영이 계단처럼 끊기지 않도록 점을 합쳐서 매끄럽게
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const smooth = mergeVertices(geo, 1e-4);
  smooth.computeVertexNormals();
  return smooth;
}

// 둥근 사각형 모양 (가운데가 원점)
function roundedRectShape(w, h, r) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return shape;
}

// 선 조각 목록([[x,y,z], [x,y,z]] 쌍)을 선 그리기용 모양으로
function segmentsGeometry(points) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  return geo;
}

// 등장 효과용 격자 윤곽선 (판): 앞/가운데/뒤 테두리 + 앞면 안쪽 작은 테두리 + 앞뒤를 잇는 선
function plateGrid(w, h, d) {
  const r = Math.min(w, h) * SIZE.cornerRatio;
  const outline = roundedRectShape(w, h, r).getSpacedPoints(64);
  const segs = [];
  const ring = (scale, z) => {
    for (let i = 0; i < outline.length - 1; i++) {
      const a = outline[i], b = outline[i + 1];
      segs.push([a.x * scale, a.y * scale, z], [b.x * scale, b.y * scale, z]);
    }
  };
  if (currentGrid.outlineOnly) {
    ring(1, d / 2); // 단순한 윤곽: 앞면 테두리 하나만
    return segmentsGeometry(segs);
  }
  [-d / 2, 0, d / 2].forEach((z) => ring(1, z));
  if (currentGrid.innerRings) [0.7, 0.4].forEach((s) => ring(s, d / 2));
  for (let i = 0; i < outline.length - 1; i += currentGrid.innerRings ? 8 : 16) {
    const a = outline[i];
    segs.push([a.x, a.y, -d / 2], [a.x, a.y, d / 2]);
  }
  return segmentsGeometry(segs);
}

// 얇은 판 (화면, 귀): 앞면 모서리를 둥근 사각형으로. z 방향이 두께
function plate(w, h, d, color, edge = Math.min(0.015, d / 3)) { // edge: 앞면과 옆면이 만나는 모서리 둥글기
  const r = Math.min(w, h) * SIZE.cornerRatio - edge;
  const shape = roundedRectShape(w - edge * 2, h - edge * 2, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - edge * 2,
    bevelEnabled: true,
    bevelThickness: edge,
    bevelSize: edge,
    bevelSegments: 8,
    curveSegments: 16,
  });
  geo.center();
  const mesh = shadowed(new THREE.Mesh(smoothed(geo), material(color)));
  mesh.userData.gridGeo = plateGrid(w, h, d);
  return mesh;
}

// 윗부분은 평평, 아래로 갈수록 둥글게 말리는 모양 (머리, 몸통, 팔에 사용)
// 구를 늘려서 위쪽은 납작한 상자처럼, 아래쪽은 타원처럼 만든다. 원점 = 평평한 부분과 둥근 부분의 경계
//   topHeight: 평평한 윗부분 높이 (나머지는 둥근 아랫부분)
//   topRound: 윗면 모서리 (작을수록 평평하고 각짐)
//   bottomRound: 아랫면 (1 = 타원처럼 완전 둥글게)
//   planRound: 위에서 본 모양 (작을수록 네모, 1 = 원)
// lat(위아래 각도), lon(둘레 각도) 위치의 표면 점
function roundBottomPoint(w, h, d, { topHeight, topRound, bottomRound, planRound }, lat, lon) {
  const p = (v, e) => Math.sign(v) * Math.abs(v) ** e;
  const top = lat > 0;
  const e = top ? topRound : bottomRound;
  const ring = p(Math.cos(lat), e);
  return [
    (w / 2) * ring * p(Math.cos(lon), planRound),
    (top ? topHeight : h - topHeight) * p(Math.sin(lat), e),
    (d / 2) * ring * p(Math.sin(lon), planRound),
  ];
}

function roundBottomGeometry(w, h, d, shape) {
  const geo = new THREE.SphereGeometry(1, 96, 72);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const lat = Math.asin(THREE.MathUtils.clamp(y, -1, 1));
    pos.setXYZ(i, ...roundBottomPoint(w, h, d, shape, lat, Math.atan2(z, x)));
  }
  return smoothed(geo);
}

// 등장 효과용 격자 윤곽선 (둥근 모양): 지구본의 위도/경도처럼 가로줄 + 세로줄
function roundBottomGrid(w, h, d, shape, rings = currentGrid.rings, meridians = currentGrid.meridians) {
  const segs = [];
  const steps = 64;
  for (let i = 1; i < rings; i++) {
    const lat = -Math.PI / 2 + (Math.PI * i) / rings;
    for (let j = 0; j < steps; j++) {
      const lon = (j / steps) * Math.PI * 2;
      segs.push(roundBottomPoint(w, h, d, shape, lat, lon), roundBottomPoint(w, h, d, shape, lat, lon + (Math.PI * 2) / steps));
    }
  }
  for (let j = 0; j < meridians; j++) {
    const lon = (j / meridians) * Math.PI * 2;
    for (let i = 0; i < steps; i++) {
      const lat = -Math.PI / 2 + (Math.PI * i) / steps;
      segs.push(roundBottomPoint(w, h, d, shape, lat, lon), roundBottomPoint(w, h, d, shape, lat + Math.PI / steps, lon));
    }
  }
  return segmentsGeometry(segs);
}

// 둥근 모양 부품 하나 (재질 + 등장 효과용 격자 윤곽선까지)
// 작은 부품(몸통, 팔)은 선이 좁은 곳에 몰려 뭉치지 않게 격자를 절반으로
function roundBottomMesh(w, h, d, shape, color) {
  const mesh = shadowed(new THREE.Mesh(roundBottomGeometry(w, h, d, shape), material(color)));
  if (currentGrid.outlineOnly) return mesh; // 단순한 윤곽: 격자선 없이 바깥 윤곽만 (재질이 그림)
  const small = Math.max(w, h, d) < 0.6;
  const rings = small ? Math.max(2, Math.round(currentGrid.rings / 2)) : currentGrid.rings;
  const meridians = small ? Math.max(4, Math.round(currentGrid.meridians / 2)) : currentGrid.meridians;
  mesh.userData.gridGeo = roundBottomGrid(w, h, d, shape, rings, meridians);
  return mesh;
}

function gradientTexture(size, stops) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ============================================================
// 로봇 만들기: container 요소 안에 그 요소 크기만큼 그림
// ============================================================
export function createRobot(container, {
  background = null, rotate = false, zoom = false, halo = true, intro = false, lineColor = '#FFFFFF', lineGlow = 2.4, introPixel = 0,
  sparkle = false, draggable = false, pressFace = '정중', turnHead = true,
} = {}) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ready = false; // 모든 준비가 끝난 뒤에만 그림

  // 등장 효과: 애니메이션 줄이기가 켜져 있으면 건너뛰고 바로 3D
  const playIntro = intro && !reduceMotion;
  const blueprint = {
    amount: { value: playIntro ? 1 : 0 },
    reveal: { value: playIntro ? 99 : -99 },
    color: { value: new THREE.Color(lineColor).multiplyScalar(lineGlow) }, // 윤곽선 색 (밝기를 곱해서 빛나 보이게)
  };
  currentBlueprint = blueprint; // 아래에서 만드는 재질들이 이 값을 씀
  // 픽셀 느낌이면 격자선 없이 부품마다 바깥 윤곽만 (촘촘하면 칸이 다 칠해져서 덩어리처럼 뭉침)
  currentGrid = introPixel > 1
    ? { outlineOnly: true }
    : { rings: 9, meridians: 16, innerRings: true };

  // 장면, 카메라, 렌더러
  const scene = new THREE.Scene();
  if (background) scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(2.1, 1.1, 3.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = canvas.style.height = '100%';
  container.appendChild(canvas);

  // 화면 후처리: 색 보정 + 은은한 입자감 (밝기는 그대로, 투명한 곳에는 안 얹음)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // 등장 효과 픽셀 느낌: 화면을 큰 칸으로 나눠 칸마다 한 색으로 칠함.
  // 얇은 선이 칸 사이로 빠지지 않게, 칸 안을 여러 군데 살펴서 가장 진한(불투명한) 색을 고름
  const pixelPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uPixel: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uPixel; varying vec2 vUv;
      void main() {
        vec2 cell = uPixel / uRes;
        vec2 base = floor(vUv / cell) * cell;
        vec4 best = vec4(0.0);
        for (int i = 0; i < 4; i++) {
          for (int j = 0; j < 4; j++) {
            vec4 c = texture2D(tDiffuse, base + (vec2(float(i), float(j)) + 0.5) / 4.0 * cell);
            if (c.a > best.a) best = c;
          }
        }
        gl_FragColor = best;
      }`,
  });
  pixelPass.enabled = false;
  composer.addPass(pixelPass);
  composer.addPass(new OutputPass());
  const grainPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: GLOW.grain } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float time; uniform float amount; varying vec2 vUv;
      float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        float n = rand(vUv * 1000.0 + fract(time)) - 0.5;
        // 투명 배경 위에 겹칠 때 색이 하얗게 떠 보이지 않도록 투명도를 미리 곱해서 내보냄
        gl_FragColor = vec4((base.rgb + n * amount) * base.a, base.a);
      }`,
  });
  composer.addPass(grainPass);

  // 드래그로 돌려보기 (옵션)
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.72, 0);
  controls.enabled = rotate;
  controls.enableDamping = !reduceMotion; // 놓은 뒤 미끄러지듯 멈추는 움직임 (애니메이션 줄이기면 끔)
  controls.enableZoom = zoom;
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI * 0.47; // 바닥 아래로는 못 내려감
  controls.update();

  // 조명: 은은한 실내 환경광 + 위아래 색이 다른 하늘빛 + 그림자용 조명 + 색 조명 두 개
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight(COLOR.rimCool, COLOR.rimWarm, 0.5));
  const keyLight = new THREE.DirectionalLight(0xfff8f2, 1.4);
  keyLight.position.set(2, 4, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.radius = 6;
  keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -2;
  keyLight.shadow.camera.right = keyLight.shadow.camera.top = 2;
  scene.add(keyLight);
  const rimCool = new THREE.DirectionalLight(COLOR.rimCool, 1.0);
  rimCool.position.set(-3, 2, 0.5);
  scene.add(rimCool);
  const rimWarm = new THREE.DirectionalLight(COLOR.rimWarm, 0.8);
  rimWarm.position.set(2, -1.5, 1);
  scene.add(rimWarm);

  // 바닥에 깔리는 동그란 그림자 (떠 있는 높이에 따라 크기/진하기가 변함)
  const groundShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.1),
    new THREE.MeshBasicMaterial({
      map: gradientTexture(128, [[0, 'rgba(40, 48, 64, 0.55)'], [1, 'rgba(40, 48, 64, 0)']]),
      transparent: true,
      depthWrite: false,
    })
  );
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = 0.001;
  scene.add(groundShadow);

  // 로봇 뒤에서 은은하게 번지는 후광 (항상 카메라를 향하고, 로봇보다 먼저 그려서 얼굴을 가리지 않음)
  const haloSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: gradientTexture(256, [
      [0, 'rgba(255, 250, 252, 1)'],
      [0.35, 'rgba(255, 214, 236, 0.6)'],
      [0.65, 'rgba(190, 230, 255, 0.25)'],
      [1, 'rgba(190, 230, 255, 0)'],
    ]),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    opacity: GLOW.halo,
  }));
  haloSprite.material.color.setScalar(2.2); // 색 보정을 거치면 어두워져서, 밝은 배경 위에서도 회색 링이 아니라 밝은 빛으로 보이게
  haloSprite.scale.setScalar(GLOW.haloSize);
  haloSprite.renderOrder = -1;
  haloSprite.visible = halo;
  scene.add(haloSprite);
  const haloCenter = new THREE.Vector3();

  const robot = new THREE.Group();
  scene.add(robot);

  // 다리 없이 떠 있음: 로봇 그룹 바닥(0)이 몸통 아래 끝, 실제 높이는 애니메이션에서 띄움
  const bodyTop = SIZE.bodyHeight;
  const headY = bodyTop + SIZE.headGap + SIZE.headHeight / 2;

  // 몸: 윗면(머리 쪽)은 평평, 아래는 그릇처럼 둥글게
  const BODY_SHAPE = { topHeight: 0.09, topRound: 0.2, bottomRound: 1, planRound: 0.4 };
  const body = roundBottomMesh(SIZE.bodyWidth, SIZE.bodyHeight, SIZE.bodyDepth, BODY_SHAPE, COLOR.silver);
  body.position.y = bodyTop - BODY_SHAPE.topHeight;
  robot.add(body);

  // 팔 두 개: 어깨(위)는 평평, 길쭉하게 내려와서 끝은 반원 (위쪽 끝을 기준으로 회전)
  const ARM_SHAPE = { topHeight: SIZE.armHeight - SIZE.armWidth / 2, topRound: 0.25, bottomRound: 1, planRound: 0.7 };
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (SIZE.bodyWidth / 2 + SIZE.armWidth / 2 - 0.01), bodyTop - 0.04, 0);
    const arm = roundBottomMesh(SIZE.armWidth, SIZE.armHeight, SIZE.armDepth, ARM_SHAPE, COLOR.silver);
    arm.position.y = -ARM_SHAPE.topHeight;
    pivot.add(arm);
    robot.add(pivot);
    return pivot;
  });

  // 머리 (몸 위에 살짝 띄워서, 따로 움직이도록 그룹). 둥근 큐브라 윗면에 선이 생기지 않음
  const head = new THREE.Group();
  head.position.y = headY;
  robot.add(head);
  head.add(roundBottomMesh(SIZE.headWidth, SIZE.headHeight, SIZE.headDepth, {
    topHeight: SIZE.headHeight / 2, topRound: HEAD_ROUND, bottomRound: HEAD_ROUND, planRound: HEAD_ROUND,
  }, COLOR.silver));

  // 얼굴 화면: 머리 속에 묻고 앞면만 살짝 나오게. 반사를 약하게, 테두리는 빛나지 않게
  const face = new THREE.Group();
  face.position.z = SIZE.headDepth / 2;
  head.add(face);
  const screen = plate(SIZE.screenWidth, SIZE.screenHeight, 0.14, COLOR.face);
  screen.position.set(0, -0.02, -0.05);
  screen.material = material(COLOR.face, { edgeGlow: false });
  Object.assign(screen.material, { roughness: 0.5, sheen: 0, envMapIntensity: 0.25 });
  face.add(screen);

  // 귀 두 개 (머리 양옆에 붙은 큰 판 + 바깥 작은 판). 큰 판은 머리 속에 일부 묻어서 틈 없이 붙음
  const earSink = 0.1; // 머리 속에 묻히는 깊이
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.position.set(side * SIZE.headWidth / 2, 0.02, 0);
    ear.rotation.y = side * Math.PI / 2; // 판의 두께 방향(z)을 옆(x)으로
    const cup = plate(SIZE.earCupSize, SIZE.earCupSize, SIZE.earCupWidth + earSink, COLOR.accent, 0.05);
    cup.position.z = (SIZE.earCupWidth - earSink) / 2;
    const cap = plate(SIZE.earPlateSize, SIZE.earPlateSize, 0.06, COLOR.silver, 0.026);
    cap.position.z = SIZE.earCupWidth + 0.01;
    ear.add(cup, cap);
    head.add(ear);
  });

  // ----- 등장 효과용 격자 윤곽선: 부품마다 붙여서 같이 움직임 -----
  // 모든 선이 겹쳐 보이게(뒤쪽 선도 비침) 그려서 3D 설계도처럼. 위에서부터 그려지는 효과도 같이 씀
  const gridMaterial = new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
  gridMaterial.color.copy(blueprint.color).multiplyScalar(1.6 / lineGlow); // 흰 선은 1보다 밝게 → 파란 배경에서 또렷
  gridMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = blueprint.reveal;
    shader.vertexShader = 'varying vec3 vBpWorld;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vBpWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );
    shader.fragmentShader = 'uniform float uReveal;\nvarying vec3 vBpWorld;\n' + shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      gl_FragColor.a *= smoothstep(uReveal - 0.03, uReveal + 0.03, vBpWorld.y);`
    );
  };
  const gridLines = [];
  robot.traverse((obj) => {
    if (!obj.userData.gridGeo) return;
    const lines = new THREE.LineSegments(obj.userData.gridGeo, gridMaterial);
    lines.renderOrder = 10;
    lines.visible = playIntro;
    obj.add(lines);
    gridLines.push(lines);
  });

  // ----- 등장 효과 반짝이: 3D로 바뀌는 순간 로봇 주변에서 픽셀 별이 톡톡 터짐 -----
  const sparkles = [];
  if (playIntro && sparkle) {
    // 9×9 픽셀 별 (흰색으로 그리고 색은 재질에서 입힘). 확대해도 도트가 뭉개지지 않게 Nearest
    const STAR = ['....#....', '....#....', '....#....', '...###...', '#########', '...###...', '....#....', '....#....', '....#....'];
    const starCanvas = document.createElement('canvas');
    starCanvas.width = starCanvas.height = 9;
    const starCtx = starCanvas.getContext('2d');
    starCtx.fillStyle = '#FFFFFF';
    STAR.forEach((row, y) => [...row].forEach((c, x) => c === '#' && starCtx.fillRect(x, y, 1, 1)));
    const starTexture = new THREE.CanvasTexture(starCanvas);
    starTexture.magFilter = starTexture.minFilter = THREE.NearestFilter;
    starTexture.generateMipmaps = false;
    const colors = ['#FFC93C', '#FF7AB6', '#3DD5FF', '#5B8CFF', '#7CE38B'];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: starTexture, color: colors[i % colors.length], transparent: true, depthWrite: false, toneMapped: false,
      }));
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 0.62 + Math.random() * 0.35;
      s.position.set(Math.cos(angle) * radius, 0.7 + Math.sin(angle) * radius * 0.85, (Math.random() - 0.5) * 0.5);
      s.userData = {
        delay: INTRO_SPARKLE.start + Math.random() * INTRO_SPARKLE.spread, // 언제 터질지 (초)
        size: 0.16 + Math.random() * 0.16,
        spin: (Math.random() - 0.5) * 3,
      };
      s.visible = false;
      robot.add(s);
      sparkles.push(s);
    }
  }

  // ----- 표정 (둥근 픽셀) -----
  // 픽셀 모양의 바깥 모서리만 살짝 둥글게: 칸마다 둥근 블록을 놓고, 이웃한 칸 사이는 네모 다리로 메워서 한 덩어리로
  const pixelGeo = new RoundedBoxGeometry(PIXEL, PIXEL, 0.02, 3, PIXEL * 0.4);
  const bridgeGeo = new THREE.BoxGeometry(PIXEL, PIXEL, 0.021);
  const glowMaterials = {};
  function glowMaterial(color) {
    // 조명 영향 없이 지정한 색 그대로. transparent: 뒤쪽 후광보다 나중에 그려져서 바래지 않도록
    glowMaterials[color] ??= new THREE.MeshBasicMaterial({ color, transparent: true });
    return glowMaterials[color];
  }

  function drawPixels(holder, rows, color) {
    holder.clear();
    if (!rows) return;
    const mat = glowMaterial(color);
    const filled = (x, y) => rows[y]?.[x] === '#';
    const add = (geo, px, py) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, 0);
      holder.add(mesh);
    };
    rows.forEach((row, y) => {
      [...row].forEach((_, x) => {
        if (!filled(x, y)) return;
        const px = (x - (row.length - 1) / 2) * PIXEL;
        const py = ((rows.length - 1) / 2 - y) * PIXEL;
        add(pixelGeo, px, py);
        if (filled(x + 1, y)) add(bridgeGeo, px + PIXEL / 2, py); // 오른쪽 칸과 이음
        if (filled(x, y + 1)) add(bridgeGeo, px, py - PIXEL / 2); // 아래 칸과 이음
      });
    });
  }

  // 눈 두 개 + 눈썹 칸. 마우스를 따라 움직임
  const eyes = [-1, 1].map(() => {
    const holder = new THREE.Group();
    face.add(holder);
    return holder;
  });
  const brow = new THREE.Group();
  face.add(brow);

  // 지금 그려진 표정의 배치 정보 (매 프레임 위치 계산에 사용)
  const layout = { eyeX: [0, 0], eyeY: EYE.y, browX: 0, browY: 0 };
  let shownExpression = null;
  function showExpression(name) {
    if (shownExpression === name) return;
    shownExpression = name;
    const e = EXPRESSIONS[name];
    const color = e.color ?? COLOR.faceGlow;
    const grids = [e.left ?? e.eye, e.right ?? e.eye];
    grids.forEach((rows, i) => {
      drawPixels(eyes[i], rows, color);
      // 눈 폭이 달라도 미간이 같도록
      layout.eyeX[i] = (i ? 1 : -1) * (EYE.gap / 2 + (rows[0].length * PIXEL) / 2);
    });
    layout.eyeY = EYE.y + (e.eyeY ?? 0);
    drawPixels(brow, e.brow, color);
    if (e.brow) {
      layout.browX = layout.eyeX[1];
      layout.browY = layout.eyeY + (grids[1].length * PIXEL) / 2 + EYE.browGap + (e.brow.length * PIXEL) / 2;
    }
  }

  // '생각 중' 머리 위 점 세 개 (하나씩 차례로 켜짐)
  const dotTexture = gradientTexture(64, [
    [0, 'rgba(255, 255, 255, 1)'],
    [0.45, 'rgba(255, 255, 255, 1)'],
    [0.6, 'rgba(200, 240, 255, 0.5)'],
    [1, 'rgba(200, 240, 255, 0)'],
  ]);
  const thinkingDots = [-0.13, 0, 0.13].map((x) => {
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture, transparent: true, depthWrite: false, toneMapped: false }));
    dot.position.set(x, SIZE.headHeight / 2 + 0.2, 0);
    dot.scale.setScalar(0.1);
    dot.visible = false;
    head.add(dot);
    return dot;
  });

  let expression = '기본';
  function setExpression(name) {
    if (!EXPRESSIONS[name]) {
      console.warn(`표정 이름이 없어요: ${name} (가능한 이름: ${EXPRESSION_NAMES.join(', ')})`);
      return;
    }
    expression = name;
    if (reduceMotion) renderStill();
  }

  // ----- 크기: container 크기가 바뀌면 따라감 -----
  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    renderer.getDrawingBufferSize(pixelPass.uniforms.uRes.value);
    if (reduceMotion) renderStill();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // ----- 마우스 따라보기 + 클릭 점프 -----
  // 마우스 위치는 로봇 그림 기준으로 계산 (그림 밖이어도 그쪽 방향을 바라봄)
  const pointer = new THREE.Vector2();
  let pointerInside = false;
  const raycaster = new THREE.Raycaster();

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    pointerInside = !reduceMotion;
  }
  function onPointerLeave() {
    pointerInside = false;
  }
  // 드래그(돌려보기)와 클릭을 구분: 거의 안 움직이고 뗐을 때만 클릭
  let downAt = null;
  function onPointerDown(e) {
    downAt = { x: e.clientX, y: e.clientY };
    startHold(e);
  }
  function onPointerUp(e) {
    if (hold?.moving) return; // 옮기기를 마친 손 떼기는 점프로 치지 않음
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    onPointerMove(e);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(robot, true).length) jump();
  }

  // ----- 꾹 눌러서 옮기기 (draggable) -----
  // 로봇 위를 0.35초 누르고 있으면 잡힘 → 끌면 로봇을 담은 요소가 따라 움직임. 그 전에 움직이면 평소처럼 돌려보기
  const HOLD_MS = 350;
  let hold = null; // { x, y, base, moving, timer }
  const offset = { x: 0, y: 0 };
  container.style.transition = 'scale 0.18s ease';
  function hitsRobot(e) {
    const rect = canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(p, camera);
    return raycaster.intersectObject(robot, true).length > 0;
  }
  function startHold(e) {
    if (!draggable || blueprint.amount.value > 0 || !hitsRobot(e)) return; // 다 나타난 뒤, 로봇 위에서만
    hold = { x: e.clientX, y: e.clientY, base: { ...offset }, moving: false };
    hold.timer = setTimeout(() => {
      hold.moving = true;
      controls.enabled = false; // 옮기는 동안은 돌아가지 않게
      container.style.scale = '1.05'; // 잡혔다는 표시로 살짝 커짐
      container.style.cursor = 'grabbing';
    }, HOLD_MS);
  }
  function onHoldMove(e) {
    if (!hold) return;
    const dx = e.clientX - hold.x;
    const dy = e.clientY - hold.y;
    if (!hold.moving) {
      if (Math.hypot(dx, dy) > 6) { clearTimeout(hold.timer); hold = null; } // 꾹 누르기 전에 움직임 → 돌려보기
      return;
    }
    // 부모 영역 밖으로 로봇 가운데가 나가지 않게
    const parent = container.parentElement.getBoundingClientRect();
    const box = container.getBoundingClientRect();
    const cx = box.left + box.width / 2 - offset.x;
    const cy = box.top + box.height / 2 - offset.y;
    offset.x = THREE.MathUtils.clamp(hold.base.x + dx, parent.left - cx, parent.right - cx);
    offset.y = THREE.MathUtils.clamp(hold.base.y + dy, parent.top - cy, parent.bottom - cy);
    container.style.translate = `${offset.x}px ${offset.y}px`;
  }
  function setOffset(x, y) {
    offset.x = x;
    offset.y = y;
    container.style.translate = `${x}px ${y}px`;
  }
  function onHoldEnd() {
    if (!hold) return;
    clearTimeout(hold.timer);
    if (hold.moving) {
      controls.enabled = rotate;
      container.style.scale = '';
      container.style.cursor = '';
    }
    hold = null;
  }
  window.addEventListener('pointermove', onHoldMove);
  window.addEventListener('pointerup', onHoldEnd);
  window.addEventListener('pointercancel', onHoldEnd);

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);

  let jumpStart = null;
  let now = 0;
  let introStart = null;
  const INTRO = { draw: 2.2, hold: 0.5, fade: 1.2 }; // 초: 윤곽선 그리기, 잠깐 멈춤, 3D로 바뀌기
  function jump() {
    if (jumpStart !== null || reduceMotion) return;
    jumpStart = now;
  }

  // 고개가 바라볼 방향 계산 (카메라 앞쪽 가상 평면에 마우스를 찍고, 머리에서 그쪽으로)
  const look = { yaw: 0, pitch: 0 };
  const headWorld = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const lookPlane = new THREE.Plane();
  const lookPoint = new THREE.Vector3();
  function updateLook() {
    let yaw = 0;
    let pitch = 0;
    if (pointerInside) {
      head.getWorldPosition(headWorld);
      toCamera.subVectors(camera.position, headWorld).normalize();
      lookPlane.setFromNormalAndCoplanarPoint(toCamera, headWorld.clone().addScaledVector(toCamera, 1.2));
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(lookPlane, lookPoint)) {
        lookPoint.sub(headWorld);
        yaw = Math.atan2(lookPoint.x, lookPoint.z);
        pitch = Math.atan2(lookPoint.y, Math.hypot(lookPoint.x, lookPoint.z));
      }
    }
    yaw = THREE.MathUtils.clamp(yaw, -MOTION.lookYaw, MOTION.lookYaw);
    pitch = THREE.MathUtils.clamp(pitch, -MOTION.lookPitch, MOTION.lookPitch);
    look.yaw += (yaw - look.yaw) * MOTION.lookFollow;
    look.pitch += (pitch - look.pitch) * MOTION.lookFollow;
  }

  // ----- 매 프레임 -----
  function frame(ms) {
    now = ms / 1000;
    const t = now * MOTION.speed;

    // 점프 진행도 (0~1), 점프 중이 아니면 null
    let jumpP = null;
    if (jumpStart !== null) {
      jumpP = (now - jumpStart) / MOTION.jumpTime;
      if (jumpP >= 1) jumpStart = jumpP = null;
    }
    const jumpY = jumpP === null ? 0 : 4 * jumpP * (1 - jumpP) * MOTION.jumpHeight;
    robot.position.y = SIZE.hoverHeight + Math.sin(t * 1.2) * MOTION.floatBob + jumpY;
    // 등장 효과: 흰 윤곽선이 위에서부터 그려지고 → 잠깐 멈췄다가 → 3D로 바뀜
    let drawn = 1; // 윤곽선이 그려진 정도 (0~1)
    if (playIntro) {
      if (introStart === null) introStart = now;
      const it = now - introStart;
      const ease = (x) => { const c = THREE.MathUtils.clamp(x, 0, 1); return c * c * (3 - 2 * c); };
      drawn = ease(it / INTRO.draw);
      const top = robot.position.y + SIZE.bodyHeight + SIZE.headHeight + 0.4;
      const bottom = robot.position.y - 0.1;
      blueprint.reveal.value = drawn < 1 ? top + (bottom - top) * drawn : -99;
      blueprint.amount.value = 1 - ease((it - INTRO.draw - INTRO.hold) / INTRO.fade);
      // 반짝이: 각자 정해진 때에 0 → 커졌다 → 0으로 톡 터지며 빙글 돎
      sparkles.forEach((s) => {
        const p = (it - s.userData.delay) / INTRO_SPARKLE.life;
        s.visible = p > 0 && p < 1;
        if (!s.visible) return;
        s.scale.setScalar(s.userData.size * Math.sin(Math.PI * p) * (1 + 0.25 * Math.sin(p * Math.PI * 6)));
        s.material.rotation = p * s.userData.spin;
      });
    }
    const solid = 1 - blueprint.amount.value; // 3D로 바뀐 정도 (0~1)
    // 격자 윤곽선: 3D로 바뀌는 동안 점점 옅어지다가 사라짐
    gridMaterial.opacity = 0.7 * blueprint.amount.value;
    gridLines.forEach((lines) => (lines.visible = blueprint.amount.value > 0.01));
    // 픽셀 느낌: 설계도일 땐 큰 칸, 3D로 바뀌면서 칸이 작아져 매끈해짐
    const pixel = 1 + (introPixel - 1) * blueprint.amount.value;
    pixelPass.enabled = introPixel > 1 && pixel > 1.05;
    pixelPass.uniforms.uPixel.value = pixel * renderer.getPixelRatio();

    const shadowScale = SIZE.hoverHeight / robot.position.y; // 높이 올라갈수록 작고 옅게
    groundShadow.scale.setScalar(shadowScale);
    groundShadow.material.opacity = shadowScale * solid;

    // 머리: 마우스 따라보기 + 살짝 까딱
    updateLook();
    head.position.y = headY + Math.sin(t * 1.2 - 0.8) * MOTION.headBob;
    if (turnHead) head.rotation.set(-look.pitch, look.yaw, Math.sin(t) * MOTION.headTilt);

    // 팔: 평소엔 앞뒤로 살랑, 점프 중엔 옆으로 파닥
    arms.forEach((arm, i) => {
      const side = i ? 1 : -1;
      arm.rotation.x = Math.sin(t * 2 + i * Math.PI) * MOTION.armSwing;
      const flap = jumpP === null ? 0 : MOTION.flapAngle * (0.6 + 0.4 * Math.sin(jumpP * Math.PI * 2 * MOTION.flapCount));
      arm.rotation.z += (side * flap - arm.rotation.z) * 0.35;
    });

    // 얼굴: 점프 중엔 pressFace(기본 '정중' ^ ^), 눈은 마우스 쪽으로 이동 + 가끔 깜빡임
    const shown = jumpP === null ? expression : pressFace;
    const shiftX = (look.yaw / MOTION.lookYaw) * MOTION.eyeShiftX;
    const shiftY = (look.pitch / MOTION.lookPitch) * MOTION.eyeShiftY;
    const sinceBlink = now % MOTION.blinkEvery;
    const blink = sinceBlink < MOTION.blinkLength ? Math.sin((sinceBlink / MOTION.blinkLength) * Math.PI) : 0;
    showExpression(shown);
    eyes.forEach((eye, i) => {
      eye.position.set(layout.eyeX[i] + shiftX, layout.eyeY + shiftY, 0.025);
      eye.scale.y = 1 - blink * 0.9;
    });
    brow.position.set(layout.browX + shiftX, layout.browY + shiftY, 0.025);
    // 설계도 상태에서는 눈을 숨겼다가 3D로 반쯤 바뀌면 나타남 (화면 윤곽선은 그대로)
    eyes.forEach((eye) => (eye.visible = solid > 0.5));
    brow.visible = solid > 0.5;

    // '생각 중' 점 세 개: 하나씩 차례로 켜지고 다 켜지면 다시 처음부터
    const thinking = !!EXPRESSIONS[shown].thinking && solid > 0.5;
    const lit = reduceMotion ? 3 : Math.floor(now * 2.2) % 4; // 멈춘 그림에서는 셋 다 켬
    thinkingDots.forEach((dot, i) => {
      dot.visible = thinking;
      dot.material.opacity = i < lit ? 1 : 0.18;
    });

    if (rotate && !reduceMotion) controls.update(); // 애니메이션 줄이기면 돌려보기가 스스로 갱신하고 'change'로 다시 그림
    // 후광은 로봇 가운데에서 카메라 반대쪽으로 살짝 밀어서 로봇 뒤에 둠
    haloCenter.set(0, robot.position.y + 0.65, 0);
    haloSprite.position.copy(haloCenter).addScaledVector(camera.position.clone().sub(haloCenter).normalize(), -0.8);
    grainPass.uniforms.time.value = now;

    composer.render();
  }

  // 애니메이션 줄이기: 움직이지 않고, 표정/크기/돌려보기가 바뀔 때만 한 장씩 그림
  function renderStill() {
    if (ready) frame(0);
  }

  // 화면에 보이고, 이 탭을 보고 있을 때만 계속 그림
  let visible = true;
  let disposed = false;
  function updateLoop() {
    const run = !disposed && !reduceMotion && visible && !document.hidden;
    renderer.setAnimationLoop(run ? frame : null);
  }
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateLoop();
  });
  intersection.observe(canvas);
  document.addEventListener('visibilitychange', updateLoop);
  ready = true;
  if (reduceMotion) {
    controls.addEventListener('change', renderStill);
    renderStill();
  }
  updateLoop();

  // ----- 정리 -----
  function dispose() {
    disposed = true;
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    intersection.disconnect();
    document.removeEventListener('visibilitychange', updateLoop);
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointermove', onHoldMove);
    window.removeEventListener('pointerup', onHoldEnd);
    window.removeEventListener('pointercancel', onHoldEnd);
    if (hold) clearTimeout(hold.timer);
    controls.dispose();
    scene.traverse((obj) => {
      obj.geometry?.dispose();
      [obj.material].flat().forEach((m) => {
        m?.map?.dispose();
        m?.dispose();
      });
    });
    scene.environment?.dispose();
    pmrem.dispose();
    composer.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return {
    setExpression, jump, dispose, expressions: EXPRESSION_NAMES,
    getOffset: () => ({ ...offset }), setOffset, isHeld: () => !!hold?.moving, hits: hitsRobot,
  };
}
