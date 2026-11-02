import { at, type Grid } from "../../kit/time";

// 측정한 박자 (beats.json: 199.998BPM, 오차 8.8ms). 영상은 반박자로 묶어 100BPM, 한 마디 2.4초.
// 음악 파일은 첫 박(0.254초)부터 잘라서 영상 0초 = 1마디 1박.
export const GRID: Grid = { bpm: 99.999, firstBeat: 0, pickupBeats: 0, beatsPerBar: 4 };
export const b = (bar: number, beat = 1, fraction = 0) => at(GRID, bar, beat, fraction);

// 장면 시작 마디 (v3: 사용자 의견으로 전체를 여유 있게 늘림, 79.2초)
export const SCENES = {
  opening: b(1),     // 메인 화면 (3마디): 로봇 등장 → 천천히 둘러보며 카피가 또렷해짐 → 형광펜
  line1: b(4),       // "피드백, 또 애매한가요?"
  input: b(5),       // 흐르는 띠 → 타이핑 → 번역하기 → 눈치 보는 중… (5마디, 끝에 천천히 흐려짐)
  line2: b(10),      // "눈치껏, 네 장으로"
  result: b(11),     // 종이 4장 (4마디)
  line3: b(15),      // "애매하면, 되물어요"
  guard: b(16),      // 짧은 입력 → 개인정보 안내 (각 2마디)
  line4: b(20),      // "속상한 날엔, 하소연 해봐요"
  vent: b(21),       // 하소연 (6마디): 구겨 던지기 → 한마디 → 불태우기
  faces: b(27),      // 표정 모음 (2마디)
  line5: b(29),      // 로봇 한 줄 (2마디)
  ending: b(31),     // 눈치봇👀 + 한 줄 + 점프 (3마디)
  end: b(34),        // 79.2초
} as const;

export const DURATION = SCENES.end;
