import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { clamp01, useTime } from "../../kit/time";
import { b, SCENES } from "./cues";
import { Punchline, type PWord } from "./Punchline";
import { INPUT, Input, Opening, Result } from "./scenes";
import { Ending, Faces, Guard, LANDED, V, Vent } from "./scenes2";

const BEAT = b(1, 2);

const LINES: Record<string, PWord[]> = {
  line1: [{ text: "피드백,", at: b(4, 1) }, { text: "또", at: b(4, 2) }, { text: "애매한가요?", at: b(4, 3), mark: true }],
  // 번역 중 화면이 흐려진 뒤 한 박 쉬고 시작
  line2: [{ text: "눈치껏,", at: b(10, 2), mark: true }, { text: "네", at: b(10, 3) }, { text: "장으로", at: b(10, 4) }],
  line3: [{ text: "애매하면,", at: b(15, 1) }, { text: "되물어요", at: b(15, 3), mark: true }],
  line4: [{ text: "속상한", at: b(20, 1) }, { text: "날엔,", at: b(20, 2) }, { text: "하소연", at: b(20, 3), mark: true }, { text: "해봐요", at: b(20, 4) }],
  // 표정 모음 뒤 로봇 한 줄 (DESIGN.md §1: 디자이너 편을 드는 친한 친구)
  line5: [{ text: "늘", at: b(29, 1) }, { text: "디자이너", at: b(29, 2) }, { text: "편인", at: b(29, 3) }, { text: "로봇", at: b(30, 1), mark: true }],
};

// 효과음 [파일, 시각(초), 크기]. 짧은 소리는 가장 큰 지점이 그 시각에 오게 (sfx-peaks.json)
const PEAK: Record<string, number> = { click: 0.001, land: 0.061, pop: 0.002 };
const SFX: [string, number, number][] = [
  ["click", SCENES.input + INPUT.click, 0.35],
  ["click", SCENES.input + INPUT.press, 0.4],
  ["click", SCENES.guard + 2 * BEAT, 0.4],
  ["click", SCENES.guard + 10 * BEAT, 0.4],
  ["click", SCENES.vent + V.throw, 0.4],
  ["crumple", SCENES.vent + V.throw, 0.45],
  ["whoosh", SCENES.vent + V.throw + V.crumple, 0.3],
  ["land", SCENES.vent + LANDED, 0.5],
  ["click", SCENES.vent + V.burn, 0.4],
  ["fire", SCENES.vent + V.burn + 0.15, 0.4],
  ["hiss", SCENES.vent + V.burn + 0.15 + 1.4, 0.25],
  ["pop", SCENES.vent + V.burn + 0.15 + 2.6, 0.4],
];

const smooth = (u: number) => {
  const c = clamp01(u);
  return c * c * (3 - 2 * c);
};

export function Film() {
  const t = useTime();
  const { fps } = useVideoConfig();
  let scene;
  let start = 0;
  if (t < SCENES.line1) scene = <Opening t={t} />;
  else if (t < SCENES.input) [start, scene] = [SCENES.line1, <Punchline t={t} words={LINES.line1} />];
  else if (t < SCENES.line2) [start, scene] = [SCENES.input, <Input t={t} u={t - SCENES.input} />];
  else if (t < SCENES.result) [start, scene] = [SCENES.line2, <Punchline t={t} words={LINES.line2} />];
  else if (t < SCENES.line3) [start, scene] = [SCENES.result, <Result t={t} u={t - SCENES.result} />];
  else if (t < SCENES.guard) [start, scene] = [SCENES.line3, <Punchline t={t} words={LINES.line3} />];
  else if (t < SCENES.line4) [start, scene] = [SCENES.guard, <Guard t={t} u={t - SCENES.guard} />];
  else if (t < SCENES.vent) [start, scene] = [SCENES.line4, <Punchline t={t} words={LINES.line4} size={112} />];
  else if (t < SCENES.faces) [start, scene] = [SCENES.vent, <Vent t={t} u={t - SCENES.vent} />];
  else if (t < SCENES.line5) [start, scene] = [SCENES.faces, <Faces t={t} u={t - SCENES.faces} />];
  else if (t < SCENES.ending) [start, scene] = [SCENES.line5, <Punchline t={t} words={LINES.line5} size={120} />];
  else [start, scene] = [SCENES.ending, <Ending t={t} u={t - SCENES.ending} />];

  // 장면이 바뀔 때 흰 화면에서 0.4초 동안 천천히 나타남. 번역 중 화면은 끝에서 0.9초 동안 천천히 흐려짐. 영상 끝도 1.2초
  const fadeIn = start > 0 ? 1 - smooth((t - start) / 0.4) : 0;
  const fadeOutInput = t >= SCENES.input && t < SCENES.line2 ? smooth((t - (SCENES.line2 - 0.9)) / 0.9) : 0;
  const fadeEnd = smooth((t - (SCENES.end - 1.2)) / 1.2);
  const white = Math.max(fadeIn, fadeOutInput, fadeEnd);

  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      {scene}
      {white > 0 ? <AbsoluteFill style={{ background: "#FFFFFF", opacity: white }} /> : null}
      <Audio src={staticFile("audio/nunchibot/music/nunchibot-edit.wav")} />
      {SFX.map(([name, at, volume], i) => (
        <Sequence key={i} from={Math.round((at - (PEAK[name] ?? 0)) * fps)} layout="none">
          <Audio src={staticFile(`audio/nunchibot/sfx/${name}.wav`)} volume={volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
