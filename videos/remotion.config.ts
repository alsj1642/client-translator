import { Config } from "@remotion/cli/config";

// 3D 로봇(WebGL)을 화면 없이도 그리기 위해
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
