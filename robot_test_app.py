# 3D 로봇 시험용 앱 (서비스 앱 app.py와는 별개)
# 실행: .\.venv\Scripts\python -m streamlit run robot_test_app.py

import json
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

ROBOT_DIR = Path(__file__).parent / "robot_test"
EXPRESSIONS = ["기본", "정중", "팩폭", "생각 중", "오류", "하트"]


def robot_html(expression):
    """ index.html 안에 로봇 코드와 표정 값을 끼워 넣어 한 덩어리 HTML로 만듭니다. """
    page = (ROBOT_DIR / "index.html").read_text(encoding="utf-8")
    code = (ROBOT_DIR / "robot-character.js").read_text(encoding="utf-8")
    return page.replace("/*ROBOT_JS*/", code).replace("__EXPRESSION__", json.dumps(expression, ensure_ascii=False))


st.set_page_config(page_title="로봇 시험", layout="centered")
st.title("3D 로봇 시험")

expression = st.radio("표정", EXPRESSIONS, horizontal=True)
components.html(robot_html(expression), height=420)
st.caption("로봇을 누르면 점프해요. 마우스를 움직이면 머리가 따라와요.")
