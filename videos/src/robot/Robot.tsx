import { useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { createRobot } from "./robot-twin.js";

export type Expression = "기본" | "정중" | "팩폭" | "생각 중" | "오류" | "하트";
export type RobotState = {
  expression?: Expression;
  /** 점프 시작 시각(초) */
  jumpAt?: number | null;
  /** 등장 효과 시작 시각(초). intro 옵션과 함께 */
  introAt?: number | null;
  /** 바라보는 곳: 화면 비율 좌표(-1~1) 또는 정면 */
  aim?: { x: number; y: number } | "viewer" | null;
};

/** 앱의 3D 로봇을 영상 시간 t(초)로 그림. 같은 t면 언제나 같은 그림. */
export function Robot({ t, size, state, options = {} }: { t: number; size: number; state: RobotState; options?: Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null);
  const robot = useRef<{ renderAt: (s: number, st: RobotState) => void; dispose: () => void } | null>(null);
  const [handle] = useState(() => delayRender("robot"));

  useLayoutEffect(() => {
    robot.current = createRobot(ref.current, { halo: false, ...options });
    continueRender(handle);
    return () => robot.current?.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    robot.current?.renderAt(t, state);
  });

  return <div ref={ref} style={{ width: size, height: size, flex: "none" }} />; // flex 안에서 줄어들지 않게
}
