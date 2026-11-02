// DESIGN.md §2 색 (움직이는 색은 hex로)
export const INK = "#111111";
export const HERO_INK = "#0E0E0E";
export const WHITE = "#FFFFFF";
export const PAPER = "#F4F4EF";
export const FILL = "#EBEBE6";
export const NEON = "#76F25C";
export const SUB = "#55554F";
export const FAINT = "#8A8A85";
export const STROKE = 1.5;

/** 앱 화면을 영상에 키워서 보여주는 배율 (앱 1px = 영상 1.5px). 앱 16px 글자 → 24px */
export const S = 1.5;
/** 영상 화면에 들어가는 앱 화면 크기 (앱 px) */
export const VIEW = { w: 1920 / S, h: 1080 / S };
