// 로봇 캐릭터 (3D). 필요한 라이브러리: three@0.186.1  (npm install three@0.186.1)
//
// 사용법:
//   import { createRobot } from './robot-character.js';
//   const robot = createRobot(document.getElementById('robot'));   // 이 요소 크기에 맞춰 그림
//   robot.setExpression('생각 중');   // 기본, 정중, 팩폭, 생각 중, 오류, 하트
//   robot.jump();                    // 양팔 파닥이며 점프 (로봇을 클릭해도 점프)
//   robot.dispose();                 // 화면에서 뗄 때 정리
//
// 옵션: createRobot(element, { background: '#E6E9EE', rotate: false, halo: true })
//   background: 배경색 (기본 = 투명, 뒤에 있는 페이지가 보임)
//   rotate: 드래그로 돌려보기 / 휠 확대 (기본 = 꺼짐)
//   halo: 로봇 뒤 은은한 후광 (기본 = 켜짐. 아주 밝은 배경에서 탁해 보이면 false)
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
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
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
      gl_FragColor.a *= clamp(smoothstep(0.0, ${EDGE_SOFT.toFixed(3)}, facing) + edgeNoise * 0.6, 0.0, 1.0);`
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

// 얇은 판 (화면, 귀): 앞면 모서리를 둥근 사각형으로. z 방향이 두께
function plate(w, h, d, color, edge = Math.min(0.015, d / 3)) { // edge: 앞면과 옆면이 만나는 모서리 둥글기
  const ow = w - edge * 2;
  const oh = h - edge * 2;
  const r = Math.min(w, h) * SIZE.cornerRatio - edge;
  const shape = new THREE.Shape();
  shape.moveTo(-ow / 2 + r, -oh / 2);
  shape.lineTo(ow / 2 - r, -oh / 2);
  shape.quadraticCurveTo(ow / 2, -oh / 2, ow / 2, -oh / 2 + r);
  shape.lineTo(ow / 2, oh / 2 - r);
  shape.quadraticCurveTo(ow / 2, oh / 2, ow / 2 - r, oh / 2);
  shape.lineTo(-ow / 2 + r, oh / 2);
  shape.quadraticCurveTo(-ow / 2, oh / 2, -ow / 2, oh / 2 - r);
  shape.lineTo(-ow / 2, -oh / 2 + r);
  shape.quadraticCurveTo(-ow / 2, -oh / 2, -ow / 2 + r, -oh / 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - edge * 2,
    bevelEnabled: true,
    bevelThickness: edge,
    bevelSize: edge,
    bevelSegments: 8,
    curveSegments: 16,
  });
  geo.center();
  return shadowed(new THREE.Mesh(smoothed(geo), material(color)));
}

// 윗부분은 평평, 아래로 갈수록 둥글게 말리는 모양 (머리, 몸통, 팔에 사용)
// 구를 늘려서 위쪽은 납작한 상자처럼, 아래쪽은 타원처럼 만든다. 원점 = 평평한 부분과 둥근 부분의 경계
//   topHeight: 평평한 윗부분 높이 (나머지는 둥근 아랫부분)
//   topRound: 윗면 모서리 (작을수록 평평하고 각짐)
//   bottomRound: 아랫면 (1 = 타원처럼 완전 둥글게)
//   planRound: 위에서 본 모양 (작을수록 네모, 1 = 원)
function roundBottomGeometry(w, h, d, { topHeight, topRound, bottomRound, planRound }) {
  const geo = new THREE.SphereGeometry(1, 96, 72);
  const pos = geo.attributes.position;
  const p = (v, e) => Math.sign(v) * Math.abs(v) ** e;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const lat = Math.asin(THREE.MathUtils.clamp(y, -1, 1));
    const lon = Math.atan2(z, x);
    const top = y > 0;
    const e = top ? topRound : bottomRound;
    const ring = p(Math.cos(lat), e);
    pos.setXYZ(
      i,
      (w / 2) * ring * p(Math.cos(lon), planRound),
      (top ? topHeight : h - topHeight) * p(Math.sin(lat), e),
      (d / 2) * ring * p(Math.sin(lon), planRound)
    );
  }
  return smoothed(geo);
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
export function createRobot(container, { background = null, rotate = false, halo = true } = {}) {
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
  controls.enableDamping = true;
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
  const body = shadowed(new THREE.Mesh(
    roundBottomGeometry(SIZE.bodyWidth, SIZE.bodyHeight, SIZE.bodyDepth, BODY_SHAPE),
    material(COLOR.silver)
  ));
  body.position.y = bodyTop - BODY_SHAPE.topHeight;
  robot.add(body);

  // 팔 두 개: 어깨(위)는 평평, 길쭉하게 내려와서 끝은 반원 (위쪽 끝을 기준으로 회전)
  const ARM_SHAPE = { topHeight: SIZE.armHeight - SIZE.armWidth / 2, topRound: 0.25, bottomRound: 1, planRound: 0.7 };
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (SIZE.bodyWidth / 2 + SIZE.armWidth / 2 - 0.01), bodyTop - 0.04, 0);
    const arm = shadowed(new THREE.Mesh(
      roundBottomGeometry(SIZE.armWidth, SIZE.armHeight, SIZE.armDepth, ARM_SHAPE),
      material(COLOR.silver)
    ));
    arm.position.y = -ARM_SHAPE.topHeight;
    pivot.add(arm);
    robot.add(pivot);
    return pivot;
  });

  // 머리 (몸 위에 살짝 띄워서, 따로 움직이도록 그룹). 둥근 큐브라 윗면에 선이 생기지 않음
  const head = new THREE.Group();
  head.position.y = headY;
  robot.add(head);
  head.add(shadowed(new THREE.Mesh(
    roundBottomGeometry(SIZE.headWidth, SIZE.headHeight, SIZE.headDepth, {
      topHeight: SIZE.headHeight / 2, topRound: HEAD_ROUND, bottomRound: HEAD_ROUND, planRound: HEAD_ROUND,
    }),
    material(COLOR.silver)
  )));

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
  }

  // ----- 크기: container 크기가 바뀌면 따라감 -----
  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // ----- 마우스 따라보기 + 클릭 점프 -----
  const pointer = new THREE.Vector2();
  let pointerInside = false;
  const raycaster = new THREE.Raycaster();

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    pointerInside = true;
  }
  function onPointerLeave() {
    pointerInside = false;
  }
  // 드래그(돌려보기)와 클릭을 구분: 거의 안 움직이고 뗐을 때만 클릭
  let downAt = null;
  function onPointerDown(e) {
    downAt = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    onPointerMove(e);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(robot, true).length) jump();
  }
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);

  let jumpStart = null;
  let now = 0;
  function jump() {
    if (jumpStart !== null) return;
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
  renderer.setAnimationLoop((ms) => {
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
    const shadowScale = SIZE.hoverHeight / robot.position.y; // 높이 올라갈수록 작고 옅게
    groundShadow.scale.setScalar(shadowScale);
    groundShadow.material.opacity = shadowScale;

    // 머리: 마우스 따라보기 + 살짝 까딱
    updateLook();
    head.position.y = headY + Math.sin(t * 1.2 - 0.8) * MOTION.headBob;
    head.rotation.set(-look.pitch, look.yaw, Math.sin(t) * MOTION.headTilt);

    // 팔: 평소엔 앞뒤로 살랑, 점프 중엔 옆으로 파닥
    arms.forEach((arm, i) => {
      const side = i ? 1 : -1;
      arm.rotation.x = Math.sin(t * 2 + i * Math.PI) * MOTION.armSwing;
      const flap = jumpP === null ? 0 : MOTION.flapAngle * (0.6 + 0.4 * Math.sin(jumpP * Math.PI * 2 * MOTION.flapCount));
      arm.rotation.z += (side * flap - arm.rotation.z) * 0.35;
    });

    // 얼굴: 점프 중엔 '정중'(^ ^), 눈은 마우스 쪽으로 이동 + 가끔 깜빡임
    const shown = jumpP === null ? expression : '정중';
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

    // '생각 중' 점 세 개: 하나씩 차례로 켜지고 다 켜지면 다시 처음부터
    const thinking = !!EXPRESSIONS[shown].thinking;
    const lit = Math.floor(now * 2.2) % 4;
    thinkingDots.forEach((dot, i) => {
      dot.visible = thinking;
      dot.material.opacity = i < lit ? 1 : 0.18;
    });

    if (rotate) controls.update();
    // 후광은 로봇 가운데에서 카메라 반대쪽으로 살짝 밀어서 로봇 뒤에 둠
    haloCenter.set(0, robot.position.y + 0.65, 0);
    haloSprite.position.copy(haloCenter).addScaledVector(camera.position.clone().sub(haloCenter).normalize(), -0.8);
    grainPass.uniforms.time.value = now;

    composer.render();
  });

  // ----- 정리 -----
  function dispose() {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
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

  return { setExpression, jump, dispose, expressions: EXPRESSION_NAMES };
}
