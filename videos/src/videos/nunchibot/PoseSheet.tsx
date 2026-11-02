import { AbsoluteFill } from "remotion";
import { useTime } from "../../kit/time";
import { PIXEL } from "../../fonts";
import { Robot, type Expression } from "../../robot/Robot";
import { INK, WHITE } from "./theme";

const FACES: Expression[] = ["기본", "정중", "생각 중", "팩폭", "오류", "하트"];

/** 표정 6개를 한 장에: 로봇 쌍둥이가 앱과 같아 보이는지 확인용 */
export function PoseSheet() {
  const t = useTime();
  return (
    <AbsoluteFill style={{ background: WHITE, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", padding: 60 }}>
      {FACES.map((face, i) => (
        <div key={face} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Robot t={t + i * 0.37} size={400} state={{ expression: face, aim: "viewer" }} />
          <div style={{ font: `400 32px ${PIXEL}`, color: INK, marginTop: -20 }}>{face}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
}
