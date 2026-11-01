# ==============================================
# 설정: 바꾸고 싶으면 여기 두 줄만 고치면 됩니다.
# ==============================================
MODEL_NAME = "gpt-4.1-mini"      # 사용할 OpenAI 모델 이름
PROMPT_FILE = "prompts/v2_1.txt"   # 사용할 프롬프트 파일 (예: "prompts/v2.txt")

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
        return None, "앗, 눈치가 잠깐 꺼졌어요. 잠시 후 다시 시도해주세요."


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
    """ 번역 탭을 그리고, 작은 로봇 표정에 쓸 상태를 돌려줍니다: "idle"(평소), "result"(결과 나옴), "error"(오류) """
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
        clicked = st.button("번역하기", type="primary", icon=":material/north_east:", use_container_width=True)

    if not clicked:
        return "idle"

    # 1) 입력이 비어 있으면 AI를 부르지 않고 안내만
    if not feedback.strip():
        st.warning("눈치챌 문장이 아직 없어요. 피드백을 입력해주세요.")
        return "error"

    # 2) API 키 확인
    api_key = load_api_key()
    if not api_key:
        st.error(
            "API 키가 아직 없어요. 내 컴퓨터라면 프로젝트 폴더의 .env 파일을 열어 "
            "OPENAI_API_KEY= 뒤에 키를 붙여넣고 저장한 뒤 다시 눌러주세요. "
            "배포 사이트라면 앱 설정의 Secrets에 OPENAI_API_KEY를 넣어주세요."
        )
        return "error"

    # 3) 프롬프트 파일 확인
    system_prompt = load_prompt()
    if not system_prompt:
        st.error(f"프롬프트 파일({PROMPT_FILE})을 찾을 수 없어요. 파일 이름과 위치를 확인해주세요.")
        return "error"

    # 4) AI 호출
    with st.spinner("눈치 보는 중…"):
        result, error = ask_ai(api_key, system_prompt, feedback.strip())

    if error:
        st.error(error)
        return "error"

    # 5) 결과 카드 4개로 보여주기
    render_result(result)
    return "result"


# 카드별 아이콘과 색 (색 이름은 .streamlit/config.toml의 테마 색)
CARD_STYLES = [
    (":material/psychology:", "blue"),       # 해석
    (":material/warning:", "orange"),        # 충돌하는 요구
    (":material/help:", "green"),            # 되물을 질문 후보
    (":material/mail:", "violet"),           # 회신 초안
]


KOREAN_COUNTS = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"]


def count_items(text, by_sentence=False):
    """
    항목 개수를 셉니다: 글머리(-, *, 1.)가 붙은 줄 수 → 없으면 줄 수.
    by_sentence=True면 한 줄짜리 글은 문장 수로 셉니다.
    """
    lines = [l for l in text.splitlines() if l.strip()]
    bullets = [l for l in lines if re.match(r"^\s*([-*•]|\d+[.)])\s", l)]
    if bullets:
        return len(bullets)
    if len(lines) == 1 and by_sentence:
        return len(re.split(r"(?<=[.!?])\s+", lines[0].strip()))
    return len(lines)


def summarize(sections):
    """
    로봇 말풍선에 넣을 짧은 요약. AI를 한 번 더 부르지 않고 결과에서 개수만 셉니다.
    예) "번역을 마쳤어요. 해석은 세 가지, 부딪히는 요구는 한 건이에요."
    """
    say = lambda n: KOREAN_COUNTS[n] if n < len(KOREAN_COUNTS) else str(n)
    meanings = max(1, count_items(sections[0], by_sentence=True))

    conflicts = sections[1].strip().strip('"').strip()
    if conflicts == "없음":
        conflict_text = "부딪히는 요구는 없어요."
    else:
        conflict_text = f"부딪히는 요구는 {say(max(1, count_items(conflicts)))} 건이에요."
    return f"번역을 마쳤어요. 해석은 {say(meanings)} 가지, {conflict_text}"


def render_result(result):
    sections = split_sections(result)
    if sections is None:
        # 4개로 나눌 수 없는 답변(추가 정보 요청, 개인정보 안내 등)은 그대로 보여줍니다.
        with st.container(key="card-notice"):
            st.markdown("**:material/info: AI 안내**")
            st.markdown(result)
        return

    # 제목 → 로봇이 말풍선으로 요약 → 4가지 항목을 위에서부터 차례대로 (위아래로 읽기)
    with st.container(key="result"):
        st.markdown("**번역 결과**")
        # 왼쪽 빈 자리(result-robot)에 입력 화면의 작은 로봇이 옮겨와 앉습니다 (buddy/buddy.js)
        with st.container(key="result-talk", horizontal=True, vertical_alignment="center"):
            with st.container(key="result-robot"):
                st.html("<div></div>")
            with st.container(key="result-bubble"):
                st.markdown(summarize(sections))
        for idx, title in enumerate(SECTION_TITLES):
            icon, color = CARD_STYLES[idx]
            with st.container(key=f"card-{idx}"):
                st.markdown(f"**:{color}[{icon} {idx + 1}. {title}]**")
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


def render_vent_tab():
    # 하소연 탭은 나중에 추가할 예정입니다. 지금은 자리만 잡아둡니다.
    st.info("하소연 탭은 준비 중이에요.", icon=":material/construction:")


def load_styles():
    """ styles.css 파일의 디자인을 앱에 적용합니다. """
    css_path = BASE_DIR / "styles.css"
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)


LOGO_PATH = BASE_DIR / "assets" / "logo-mark.svg"
HERO_DIR = BASE_DIR / "hero"
BUDDY_DIR = BASE_DIR / "buddy"

# 3D 로봇이 쓰는 그림 라이브러리(Three.js)를 받아올 주소. 버전은 로봇 파일과 맞춰둡니다.
THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.186.1"


def load_robot_code():
    """
    hero/robot-character.js(3D 로봇)를 읽어서, 라이브러리 이름('three')을 인터넷 주소로 바꿔 돌려줍니다.
    원본 파일은 그대로 두고, 읽은 내용만 바꿉니다. 파일이 없으면 None (로봇 없이 소개 영역만 보여요).
    """
    path = HERO_DIR / "robot-character.js"
    if not path.exists():
        return None
    code = path.read_text(encoding="utf-8")
    code = re.sub(r"from 'three/addons/([^']+)'", rf"from '{THREE_CDN}/examples/jsm/\1/+esm'", code)
    return code.replace("from 'three'", f"from '{THREE_CDN}/+esm'")


def render_hero():
    """
    맨 위 소개 영역 (그라데이션 배경 + 3D 로봇 눈치봇).
    모양과 움직임은 hero/ 폴더의 파일에 있습니다. 파일이 없으면 제목만 보여줍니다.
    """
    files = [HERO_DIR / name for name in ("hero.html", "hero.css", "hero.js")]
    if not all(f.exists() for f in files):
        st.title("눈치봇")
        return
    html, css, js = (f.read_text(encoding="utf-8") for f in files)
    hero = st.components.v2.component("hero", html=html, css=css, js=js)
    hero(data={"robotCode": load_robot_code()}, key="hero")


def render_buddy(status):
    """
    입력 화면 옆을 천천히 돌아다니는 작은 로봇. status("idle"/"result"/"error")에 맞춰 표정이 바뀌고,
    결과가 나오면 멈춥니다. 모양과 움직임은 buddy/ 폴더의 파일에 있습니다. 파일이 없으면 그냥 건너뜁니다.
    """
    files = [BUDDY_DIR / name for name in ("buddy.html", "buddy.js")]
    if not all(f.exists() for f in files):
        return
    html, js = (f.read_text(encoding="utf-8") for f in files)
    buddy = st.components.v2.component("buddy", html=html, js=js)
    buddy(data={"robotCode": load_robot_code(), "status": status}, key="buddy")


def main():
    st.set_page_config(
        page_title="눈치봇 · 클라이언트 피드백 번역",
        page_icon=str(LOGO_PATH) if LOGO_PATH.exists() else ":material/forum:",
        layout="wide",
    )
    load_styles()
    render_hero()

    translate_tab, vent_tab = st.tabs([":material/translate: 번역", ":material/sentiment_dissatisfied: 하소연"])
    with translate_tab:
        # 작은 로봇 자리를 맨 앞에 먼저 잡아둬야, 다시 그려질 때 로봇이 새로 만들어지지 않고 이어져요
        buddy_slot = st.container(key="buddy-slot")
        status = render_translate_tab()
        with buddy_slot:
            render_buddy(status)
    with vent_tab:
        render_vent_tab()


main()
