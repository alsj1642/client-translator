import { Robot, type RobotState } from "../../robot/Robot";
import { S } from "./theme";

/** 앱 화면(앱 px) 위 자리에 로봇을 영상 px로 또렷하게 그림. clip = 아래에서 잘라낼 비율 */
export function SeatRobot({ t, seat, scroll, state }: { t: number; seat: { x: number; y: number; size: number; clip: number }; scroll: number; state: RobotState }) {
  return (
    <div style={{ position: "absolute", left: seat.x * S, top: (seat.y - scroll) * S, clipPath: seat.clip ? `inset(0 0 ${seat.clip * 100}% 0)` : undefined }}>
      <Robot t={t} size={seat.size * S} state={state} options={{ turnHead: false }} />
    </div>
  );
}

/** 영상 px의 한 점을 로봇 그림 기준 좌표(-1~1)로 */
export function aimAt(point: { x: number; y: number }, seat: { x: number; y: number; size: number }, scroll: number) {
  const left = seat.x * S;
  const top = (seat.y - scroll) * S;
  const size = seat.size * S;
  return { x: ((point.x - left) / size) * 2 - 1, y: -(((point.y - top) / size) * 2 - 1) };
}
