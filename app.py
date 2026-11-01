# ==============================================
# 설정: 바꾸고 싶으면 여기 두 줄만 고치면 됩니다.
# ==============================================
MODEL_NAME = "gpt-4.1-mini"      # 사용할 OpenAI 모델 이름
PROMPT_FILE = "prompts/v2_1.txt"   # 사용할 프롬프트 파일 (예: "prompts/v2.txt")
VENT_PROMPT_FILE = "prompts/vent_v6.txt"  # 하소연 탭 로봇 한마디용 프롬프트 파일

import os
import random
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


def ask_ai(api_key, system_prompt, feedback, max_tokens=None):
    """
    AI를 호출합니다.
    성공하면 (결과 텍스트, None), 실패하면 (None, 쉬운 안내 문구)를 돌려줍니다.
    오류 원문은 화면에 보여주지 않습니다. (키 값이 섞여 나올 수 있기 때문)
    max_tokens를 주면 AI 답의 최대 길이를 그만큼으로 막습니다 (토큰 아끼기).
    """
    import openai

    limit = {"max_completion_tokens": max_tokens} if max_tokens else {}
    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": feedback},
            ],
            **limit,
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


# 번역 화면 맨 위에 천천히 흘러가는 클라이언트 말투 띠 (말투, 뒤에 붙는 이모지)
TICKER_LINES = [
    ("느낌 아시죠?", "🤔"), ("좀 더 세련되게", "✨"), ("임팩트 있게요", "💥"), ("뭔가 아쉬워요", "😕"),
    ("살짝만 바꿔주세요", "🙏"), ("고급스럽지만 가볍게", "💎"), ("그 느낌 말고요", "🙅"), ("확 튀게 해주세요", "🔥"),
]

# '랜덤 피드백 뽑기' 버튼이 입력 칸에 채워주는 예시 피드백
EXAMPLES = [
    "고급스럽지만 무겁지 않게 해주세요",
    "로고 좀 더 크게 키워주세요",
    "뭔가 아쉬운데 더 세련되게요",
    "임팩트 있게, 근데 너무 튀지는 않게요",
    "전체적으로 좀 더 트렌디하게 가주세요",
    "심플한데 허전하지 않게 부탁드려요",
    "색감을 좀 더 따뜻하게, 그래도 차분하게요",
    "처음 시안 느낌으로 돌아가되 지금 것도 살려주세요",
    "젊은 느낌인데 너무 가볍지 않게요",
    "한눈에 들어오게, 정보는 다 넣어주세요",
]


def pick_random_example():
    """ '랜덤 피드백 뽑기'를 누르면 예시 피드백 하나를 골라 입력 칸에 채웁니다. (지금 칸에 있는 문장은 빼고 고름) """
    current = st.session_state.get("feedback", "")
    st.session_state.feedback = random.choice([e for e in EXAMPLES if e != current])


def render_ticker():
    """ 클라이언트 말투가 옆으로 천천히 흐르는 형광 띠. 끊김 없이 돌도록 같은 내용을 두 번 이어 붙입니다. """
    items = "".join(f'<span>{line}</span><span class="ticker-emoji">{emoji}</span>' for line, emoji in TICKER_LINES)
    st.html(f'<div class="ticker" aria-hidden="true"><div class="ticker-track">{items}{items}</div></div>')


def render_translate_tab():
    """ 번역 탭을 그리고, 작은 로봇 표정에 쓸 상태를 돌려줍니다: "idle"(평소), "result"(결과 나옴), "error"(오류) """
    render_ticker()

    # 입력 칸 = 종이 메모 (머리말 + 입력 칸, 오른쪽 아래가 접힘. 모양은 styles.css의 .st-key-memo)
    with st.container(key="feedback-title"):
        st.markdown("클라이언트 피드백")
    with st.container(key="memo"):
        st.html('<div class="memo-head"><p>FROM. 클라이언트</p><p>TO. 눈치봇</p></div>')
        feedback = st.text_area(
            "클라이언트 피드백",
            key="feedback",
            height=160,
            placeholder="예) 전체적으로 좀 더 고급스럽게, 근데 너무 무겁진 않게 해주세요. 로고는 더 크게요.",
            label_visibility="collapsed",
        )

    with st.container(key="random-pick"):
        st.button("랜덤 피드백 뽑기", icon=":material/casino:", on_click=pick_random_example)

    left, right = st.columns([3, 1], vertical_alignment="center")
    with left:
        st.caption(":material/lock: 실명·연락처·회사명은 지우고 넣어주세요.")
    with right:
        clicked = st.button("번역하기", type="primary", use_container_width=True)

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


# 하소연 탭 설정 (토큰 아끼기: 글은 앞부분만, 답은 한두 문장만)
VENT_FIXED_REPLY = "다 털었어요. 한결 가볍죠?"  # 로봇 한마디를 끈 경우 보여줄 고정 문구
VENT_MAX_CHARS = 300   # AI에게 보내는 하소연 글의 최대 글자 수 (앞부분만)
VENT_MAX_TOKENS = 120  # AI 답의 최대 길이 (한두 문장, '걱정' 말투일 때는 두세 문장)
VENT_TONES = ["정중", "팩폭"]  # 사용자가 고르는 로봇 말투 (로봇 표정 이름과 같음)
VENT_ERROR_REPLY = "앗, 지금은 한마디가 어려워요. 그래도 다 털었어요."

# 안전장치: AI에게만 맡기지 않고 코드에서 먼저 확인합니다 (글 전체를 브라우저에서 검사, 파이썬에서 한 번 더)
# 1) 자해·죽음 신호가 있는 글: AI에 보내지 않고, 스위치와 상관없이 바로 도움받을 곳을 알려줍니다.
#    ('짜증나 죽겠네', '목숨 걸고', '극단적인 요청'처럼 흔히 쓰는 표현은 걸리지 않게 뺐습니다)
VENT_CRISIS_WORDS = [
    "죽고 싶", "죽고싶", "자살", "자해", "사라지고 싶", "사라지고싶",
    "살기 싫", "살고 싶지 않", "그만 살", "뛰어내리",
]
VENT_CRISIS_REPLY = "많이 힘들었겠어요. 그런 마음이 들 땐 혼자 견디지 말고 자살예방상담전화 109에 이야기해보세요. 언제든 들어줘요."
# 2) 힘듦이 심해 보이는 글: 고른 말투와 상관없이 '걱정' 말투로 (스위치를 끄면 아래 고정 문구)
VENT_DISTRESS_WORDS = [
    "번아웃", "잠도 못", "잠을 못", "못 자", "그만두고 싶", "그만두고싶", "우울",
    "숨이 막", "버티기 힘", "너무 지쳐", "울었", "눈물",
]
VENT_DISTRESS_REPLY = "오늘 정말 많이 지쳤겠어요. 일은 잠깐 내려놓고 푹 쉬고, 힘들면 믿을 만한 사람에게 꼭 이야기해요."


def has_any(text, words):
    """ 글에 words 중 하나라도 들어 있으면 True """
    return any(w in text for w in words)


def vent_reply(payload):
    """
    하소연 글을 받아 로봇 한마디를 만듭니다. AI는 한 번만, 짧게 부릅니다.
    돌려주는 값: {"id": 던진 번호, "text": 한마디, "face": 로봇 표정}
    글은 어디에도 저장하지 않습니다.
    """
    reply_id = payload.get("id")
    text = str(payload.get("text", "")).strip()[:VENT_MAX_CHARS]
    tone = payload.get("tone") if payload.get("tone") in VENT_TONES else VENT_TONES[0]
    if not text:
        return {"id": reply_id, "text": VENT_FIXED_REPLY, "face": "정중"}
    # 안전장치 (브라우저에서도 먼저 걸러서 보통은 여기까지 오지 않음)
    if has_any(text, VENT_CRISIS_WORDS):
        return {"id": reply_id, "text": VENT_CRISIS_REPLY, "face": "기본"}
    distress = bool(payload.get("distress")) or has_any(text, VENT_DISTRESS_WORDS)
    if distress:
        tone = "걱정"
    fallback = VENT_DISTRESS_REPLY if distress else VENT_ERROR_REPLY

    api_key = load_api_key()
    path = BASE_DIR / VENT_PROMPT_FILE
    if not api_key or not path.exists():
        return {"id": reply_id, "text": fallback, "face": "기본" if distress else "오류"}

    system_prompt = path.read_text(encoding="utf-8").strip()
    reply, error = ask_ai(api_key, system_prompt, f"말투: {tone}\n하소연: {text}", max_tokens=VENT_MAX_TOKENS)
    lines = [l.strip().strip('"') for l in (reply or "").splitlines() if l.strip()]
    if error or not lines:
        return {"id": reply_id, "text": fallback, "face": "기본" if distress else "오류"}
    # '걱정' 말투면 웃거나 발끈한 표정 대신 평소 표정
    return {"id": reply_id, "text": " ".join(lines)[:160], "face": "기본" if distress else tone}


def render_vent_tab():
    """
    하소연 탭: 줄 종이에 적고 '구겨서 던지기'를 누르면 종이가 구겨져 쓰레기통으로 날아가고,
    로봇이 한마디 해줍니다. 화면과 움직임은 vent/ 폴더의 파일에 있습니다.
    로봇 한마디를 켠 경우에만 글이 파이썬으로 와서 AI에게 한 번 전달되고, 답을 받으면 화면을 다시 그립니다.
    """
    files = [VENT_DIR / name for name in ("vent.html", "vent.css", "vent.js")]
    if not all(f.exists() for f in files):
        st.info("하소연 탭 파일을 찾을 수 없어요.", icon=":material/construction:")
        return
    html, css, js = (f.read_text(encoding="utf-8") for f in files)
    vent = st.components.v2.component("vent", html=html, css=css, js=js)
    result = vent(
        data={
            "robotCode": load_robot_code(),
            "fixedReply": VENT_FIXED_REPLY,
            "crisisWords": VENT_CRISIS_WORDS,
            "crisisReply": VENT_CRISIS_REPLY,
            "distressWords": VENT_DISTRESS_WORDS,
            "distressReply": VENT_DISTRESS_REPLY,
            "reply": st.session_state.get("vent_reply"),
        },
        key="vent",
        on_throw_change=lambda: None,
    )
    if result.throw:
        st.session_state.vent_reply = vent_reply(result.throw)
        st.rerun()


def load_styles():
    """ styles.css 파일의 디자인을 앱에 적용합니다. """
    css_path = BASE_DIR / "styles.css"
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)


HERO_DIR = BASE_DIR / "hero"
BUDDY_DIR = BASE_DIR / "buddy"
VENT_DIR = BASE_DIR / "vent"

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
    '번역하기' 버튼에 앉은 작은 로봇. status("idle"/"result"/"error")에 맞춰 표정이 바뀌고,
    결과가 나오면 '번역 결과' 제목 아래로 옮겨 앉아 말풍선으로 요약을 말해줍니다.
    모양과 움직임은 buddy/ 폴더의 파일에 있습니다. 파일이 없으면 그냥 건너뜁니다.
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
        page_icon="👀",  # 브라우저 탭 아이콘 (파비콘)
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
