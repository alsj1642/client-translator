import { Composition } from "remotion";
import "./fonts";
import { DURATION } from "./videos/nunchibot/cues";
import { Film } from "./videos/nunchibot/Film";
import { PoseSheet } from "./videos/nunchibot/PoseSheet";

export function Root() {
  return (
    <>
      <Composition id="Nunchibot" component={Film} durationInFrames={Math.round(DURATION * 60)} fps={60} width={1920} height={1080} />
      <Composition id="PoseSheet" component={PoseSheet} durationInFrames={120} fps={60} width={1920} height={1080} />
    </>
  );
}
