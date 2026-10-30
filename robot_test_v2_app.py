# 3D 로봇 시험판 v2 (st.components.v2 방식, 서비스 앱 app.py와는 별개)
# 실행: .\.venv\Scripts\python -m streamlit run robot_test_v2_app.py

from pathlib import Path

import streamlit as st

THREE = "https://cdn.jsdelivr.net/npm/three@0.186.1"
EXPRESSIONS = ["기본", "정중", "팩폭", "생각 중", "오류", "하트"]

# 로봇 코드의 짧은 이름('three')을 CDN 전체 주소로 바꿔서 읽기 (원본 파일은 그대로)
code = (Path(__file__).parent / "robot_test" / "robot-character.js").read_text(encoding="utf-8")
code = code.replace("from 'three/addons/", f"from '{THREE}/examples/jsm/").replace("from 'three'", f"from '{THREE}/+esm'")
code = code.replace(".js';", ".js/+esm';")

# 로봇은 처음 한 번만 만들고, 이후에는 표정만 바꿈
JS = code + """
const robots = new WeakMap();
export default function ({ parentElement, data }) {
  let robot = robots.get(parentElement);
  if (!robot) {
    robot = createRobot(parentElement.querySelector('.robot'));
    robots.set(parentElement, robot);
    window.__robotCreated = (window.__robotCreated || 0) + 1; // 시험용: 로봇을 만든 횟수
  }
  robot.setExpression(data.expression);
  return () => { robot.dispose(); robots.delete(parentElement); };
}
"""

robot_component = st.components.v2.component(
    "robot_v2",
    html='<div class="robot" style="width:100%;height:420px"></div>',
    js=JS,
)

st.set_page_config(page_title="로봇 시험 v2", layout="centered")
st.title("3D 로봇 시험 v2")
expression = st.radio("표정", EXPRESSIONS, horizontal=True)
robot_component(data={"expression": expression}, key="robot")
st.caption("로봇을 누르면 점프해요. 마우스를 움직이면 머리가 따라와요.")
