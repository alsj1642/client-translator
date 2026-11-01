# ==============================================
# 설정: 바꾸고 싶으면 여기 두 줄만 고치면 됩니다.
# ==============================================
MODEL_NAME = "gpt-4.1-mini"      # 사용할 OpenAI 모델 이름
PROMPT_FILE = "prompts/v2_1.txt"   # 사용할 프롬프트 파일 (예: "prompts/v2.txt")

import base64
import os
import re
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent

# 결과 카드 4개의 제목 (프롬프트의 [출력 형식] 순서와 같아야 합니다)
SECTION_TITLES = ["해석", "충돌하는 요구", "되물을 질문 후보", "회신 초안"]


def load_api_key():
    """
    OPENAI_API_KEY를 읽어옵니다. 없으면 None.
    1) 배포 사이트의 비밀 값 보관함(st.secrets)을 먼저 보고
    2) 없으면 내 컴퓨터의 .env 파일을 봅니다.
    """
    try:
        key = str(st.secrets.get("OPENAI_API_KEY", "")).strip()
    except Exception:
        # 내 컴퓨터에 secrets.toml이 없으면 여기로 옵니다. 정상이에요.
        key = ""
    if key:
        return key

    load_dotenv(BASE_DIR / ".env", override=True)
    key = os.getenv("OPENAI_API_KEY", "").strip()
    return key or None


def load_prompt():
    """ PROMPT_FILE에 적힌 프롬프트 파일을 읽어옵니다. 없으면 None. """
    path = BASE_DIR / PROMPT_FILE
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8").strip()


def ask_ai(api_key, system_prompt, feedback):
    """
    AI를 호출합니다.
    성공하면 (결과 텍스트, None), 실패하면 (None, 쉬운 안내 문구)를 돌려줍니다.
    오류 원문은 화면에 보여주지 않습니다. (키 값이 섞여 나올 수 있기 때문)
    """
    import openai

    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": feedback},
            ],
        )
        return response.choices[0].message.content or "", None
    except openai.AuthenticationError:
        return None, "API 키가 올바르지 않아요. OPENAI_API_KEY 값(내 컴퓨터는 .env, 배포 사이트는 Secrets)을 다시 확인해주세요."
    except openai.NotFoundError:
        return None, f"모델 '{MODEL_NAME}'을(를) 찾을 수 없어요. app.py 맨 위의 MODEL_NAME을 확인해주세요."
    except openai.RateLimitError:
        return None, "사용량 한도에 걸렸거나 크레딧이 부족해요. 잠시 후 다시 시도하거나 OpenAI 결제 상태를 확인해주세요."
    except openai.APIConnectionError:
        return None, "OpenAI 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요."
    except openai.APITimeoutError:
        return None, "응답이 너무 오래 걸려요. 잠시 후 다시 시도해주세요."
    except Exception:
        return None, "AI 호출 중 알 수 없는 문제가 생겼어요. 잠시 후 다시 시도해주세요."


def split_sections(text):
    """
    AI 답변을 4개 카드로 나눕니다.
    "1. 해석:" 같은 제목을 찾아서 자르고, 4개를 모두 찾지 못하면 None을 돌려줍니다.
    (예: 입력이 너무 짧아서 AI가 '더 자세히 알려달라'고만 답한 경우)
    """
    titles = "|".join(re.escape(t) for t in SECTION_TITLES)
    pattern = re.compile(
        rf"^[#>\s*]*([1-4])\s*[.)]\s*\**\s*({titles})\s*\**\s*[:：]?\s*\**",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(text))
    found = {}
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        found.setdefault(m.group(2), text[m.end():end].strip())

    if len(found) != len(SECTION_TITLES):
        return None
    return [found[t] for t in SECTION_TITLES]


def render_translate_tab():
    feedback = st.text_area(
        "클라이언트 피드백",
        height=160,
        placeholder="예) 전체적으로 좀 더 고급스럽게, 근데 너무 무겁진 않게 해주세요. 로고는 더 크게요.",
        help="실제 사람 이름, 연락처, 회사명은 지우고 넣어주세요.",
    )

    left, right = st.columns([3, 1], vertical_alignment="center")
    with left:
        st.caption(":material/lock: 실명·연락처·회사명은 지우고 넣어주세요.")
    with right:
        clicked = st.button("번역하기", type="primary", icon=":material/translate:", use_container_width=True)

    if not clicked:
        return

    # 1) 입력이 비어 있으면 AI를 부르지 않고 안내만
    if not feedback.strip():
        st.warning("피드백을 입력해주세요")
        return

    # 2) API 키 확인
    api_key = load_api_key()
    if not api_key:
        st.error(
            "API 키가 아직 없어요. 내 컴퓨터라면 프로젝트 폴더의 .env 파일을 열어 "
            "OPENAI_API_KEY= 뒤에 키를 붙여넣고 저장한 뒤 다시 눌러주세요. "
            "배포 사이트라면 앱 설정의 Secrets에 OPENAI_API_KEY를 넣어주세요."
        )
        return

    # 3) 프롬프트 파일 확인
    system_prompt = load_prompt()
    if not system_prompt:
        st.error(f"프롬프트 파일({PROMPT_FILE})을 찾을 수 없어요. 파일 이름과 위치를 확인해주세요.")
        return

    # 4) AI 호출
    with st.spinner("피드백을 해석하는 중이에요..."):
        result, error = ask_ai(api_key, system_prompt, feedback.strip())

    if error:
        st.error(error)
        return

    # 5) 결과 카드 4개로 보여주기
    render_result(result)


# 카드별 아이콘과 색 (색 이름은 .streamlit/config.toml의 테마 색)
CARD_STYLES = [
    (":material/psychology:", "blue"),       # 해석
    (":material/warning:", "orange"),        # 충돌하는 요구
    (":material/help:", "green"),            # 되물을 질문 후보
    (":material/mail:", "violet"),           # 회신 초안
]


def render_result(result):
    sections = split_sections(result)
    if sections is None:
        # 4개로 나눌 수 없는 답변(추가 정보 요청, 개인정보 안내 등)은 그대로 보여줍니다.
        with st.container(border=True, key="card-notice"):
            st.markdown("**:material/info: AI 안내**")
            st.markdown(result)
        return

    st.markdown("**번역 결과**")
    for row in (0, 2):
        cols = st.columns(2, gap="medium")
        for col, idx in zip(cols, (row, row + 1)):
            icon, color = CARD_STYLES[idx]
            with col, st.container(border=True, key=f"card-{idx}"):
                st.markdown(f"**:{color}[{icon} {idx + 1}. {SECTION_TITLES[idx]}]**")
                body = sections[idx]
                if idx == 1 and body.strip().strip('"').strip() == "없음":
                    st.markdown(":gray[:material/check_circle: 서로 부딪히는 요구는 없어요.]")
                elif idx == 3:
                    # 회신 초안은 오른쪽 위 버튼으로 바로 복사할 수 있게
                    st.code(body, language=None, wrap_lines=True)
                    st.caption("오른쪽 위 아이콘을 누르면 복사돼요.")
                else:
                    st.markdown(body)

    st.caption(f"모델: {MODEL_NAME} · 프롬프트: {PROMPT_FILE}")


def render_schedule_tab():
    # 일정 탭은 나중에 추가할 예정입니다. 지금은 자리만 잡아둡니다.
    st.info("일정 탭은 준비 중이에요.", icon=":material/construction:")


def load_styles():
    """ styles.css 파일의 디자인을 앱에 적용합니다. """
    css_path = BASE_DIR / "styles.css"
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)


LOGO_PATH = BASE_DIR / "assets" / "logo-mark.svg"
HERO_DIR = BASE_DIR / "hero"


def logo_data_uri():
    """ 로고 SVG를 화면에 넣을 수 있는 주소(data URI)로 만듭니다. 파일이 없으면 빈 문자열. """
    if not LOGO_PATH.exists():
        return ""
    data = base64.b64encode(LOGO_PATH.read_bytes()).decode()
    return f"data:image/svg+xml;base64,{data}"


def render_hero():
    """
    맨 위 소개 영역 (커서 물결 효과 + 말랑한 말풍선).
    모양과 움직임은 hero/ 폴더의 파일에 있습니다. 파일이 없으면 제목만 보여줍니다.
    """
    files = [HERO_DIR / name for name in ("hero.html", "hero.css", "hero.js")]
    if not all(f.exists() for f in files):
        st.title("클라이언트 피드백 번역기")
        return
    html, css, js = (f.read_text(encoding="utf-8") for f in files)
    hero = st.components.v2.component("hero", html=html, css=css, js=js)
    hero(data={"logo": logo_data_uri()}, key="hero")


def main():
    st.set_page_config(
        page_title="클라이언트 피드백 번역기",
        page_icon=str(LOGO_PATH) if LOGO_PATH.exists() else ":material/forum:",
        layout="wide",
    )
    load_styles()
    render_hero()

    translate_tab, schedule_tab = st.tabs([":material/translate: 번역", ":material/calendar_month: 일정"])
    with translate_tab:
        render_translate_tab()
    with schedule_tab:
        render_schedule_tab()


main()
