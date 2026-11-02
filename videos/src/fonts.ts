import { continueRender, delayRender, staticFile } from "remotion";

// 앱과 같은 글꼴을 내 컴퓨터 파일로 (videos/public/fonts)
// - Mona12: jsDelivr MonadABXY/mona-font@2026.10.09, SIL OFL
// - Material Symbols Rounded: Google Fonts (Streamlit의 :material/ 아이콘), Apache 2.0
const FACES = [
  ["Mona12 Text KR", "Mona12TextKR.woff2", "400"],
  ["Mona12 Text KR", "Mona12TextKR-Bold.woff2", "700"],
  ["Mona12 Color Emoji", "Mona12ColorEmoji.woff2", "400"],
  ["Mona12", "Mona12.woff2", "400"],
  ["Mona12", "Mona12-Bold.woff2", "700"],
  ["Material Symbols Rounded", "MaterialSymbolsRounded.ttf", "400"],
] as const;

export const PIXEL = '"Mona12 Text KR", "Mona12 Color Emoji", "Mona12", sans-serif';
export const ICONS = '"Material Symbols Rounded"';

const handle = delayRender("fonts");
Promise.all(
  FACES.map(([family, file, weight]) => {
    const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)})`, { weight });
    document.fonts.add(face);
    return face.load();
  }),
).then(() => continueRender(handle));
