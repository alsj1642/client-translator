# 💬 눈치봇

클라이언트의 모호한 피드백, 눈치껏 번역해드려요. 디자이너가 받은 피드백을 붙여넣으면, 눈치봇이 아래 4가지를 카드로 정리해줍니다.

1. **해석** – 가능한 뜻 2~3가지
2. **충돌하는 요구** – 서로 부딪히는 요구 (없으면 "없음")
3. **되물을 질문 후보** – 클라이언트에게 그대로 보낼 수 있는 질문 3개
4. **회신 초안** – 정중한 답장 3~5문장

화면은 탭 두 개예요.

- **번역**: 위 4가지를 타자 친 종이처럼 차례대로 보여줘요. 번역이 끝나면 작은 로봇 눈치봇이 결과를 한 줄로 요약해줘요.
- **하소연**: 클라이언트 때문에 힘들었던 일을 적고 구겨서 쓰레기통에 던져요. 원하면 눈치봇이 한마디 해줘요. 적은 글은 저장되지 않아요.

---

## 실행 방법 (처음 하는 분용)

> 아래 명령어는 모두 **PowerShell**(Windows) 또는 **터미널**(Mac)에 한 줄씩 복사해서 붙여넣고 Enter를 누르면 됩니다.

### 0단계. 파이썬 확인

```
python --version
```

- `Python 3.10` 이상이 나오면 OK.
- 오류가 나면 https://www.python.org/downloads/ 에서 설치하세요.
  **Windows는 설치 첫 화면에서 "Add python.exe to PATH" 체크박스를 꼭 켜고** 설치한 뒤, PowerShell을 껐다 다시 여세요.

### 1단계. 프로젝트 폴더로 이동

```
cd 프로젝트폴더경로
```
예: `cd C:\Users\내이름\Desktop\client-translator`

### 2단계. 가상환경 만들기 (처음 한 번만)

이 프로젝트 전용 파이썬 공간을 만듭니다.

```
python -m venv .venv
```

### 3단계. 필요한 라이브러리 설치 (처음 한 번만)

- Windows:
  ```
  .\.venv\Scripts\python -m pip install -r requirements.txt
  ```
- Mac:
  ```
  .venv/bin/python -m pip install -r requirements.txt
  ```

### 4단계. API 키 넣기 (처음 한 번만)

1. OpenAI 사이트(https://platform.openai.com/api-keys)에서 API 키를 발급받습니다.
2. 폴더에 `.env` 파일이 없다면 `.env.example`을 복사해서 이름을 `.env`로 바꿉니다.
3. `.env` 파일을 메모장으로 열고 `=` 뒤에 키를 붙여넣고 저장합니다.
   ```
   OPENAI_API_KEY=sk-여기에-본인-키
   ```
   - 따옴표나 띄어쓰기는 넣지 마세요.
   - ⚠️ 이 키는 비밀번호와 같아요. 다른 사람에게 보내거나 채팅에 붙여넣지 마세요.
   - `.env`는 `.gitignore`에 들어 있어서 GitHub에 올라가지 않습니다.

### 5단계. 앱 실행

- Windows:
  ```
  .\.venv\Scripts\python -m streamlit run app.py
  ```
- Mac:
  ```
  .venv/bin/python -m streamlit run app.py
  ```

잠시 뒤 브라우저가 자동으로 열립니다. 안 열리면 주소창에 `http://localhost:8501` 을 입력하세요.
(처음 실행 때 이메일을 물어보면 그냥 Enter를 누르면 됩니다.)

### 끄는 방법

PowerShell/터미널 창에서 `Ctrl + C`를 누르세요.

### 다음부터는

1단계(폴더 이동) → 5단계(실행)만 하면 됩니다.

---

## 자주 바꾸는 설정

`app.py` 맨 위 세 줄만 고치면 됩니다.

```python
MODEL_NAME = "gpt-4.1-mini"      # 사용할 모델
PROMPT_FILE = "prompts/v2_1.txt"   # 번역 탭 프롬프트 파일
VENT_PROMPT_FILE = "prompts/vent_v6.txt"  # 하소연 탭 로봇 한마디용 프롬프트 파일
```

- **모델 바꾸기**: `MODEL_NAME`의 따옴표 안을 다른 모델 이름으로 바꾸세요. 번역과 하소연 탭이 같은 모델을 써요.
- **새 프롬프트 시험하기**: 지금 쓰는 파일을 복사해 새 이름(예: `prompts/v3.txt`)으로 만들고 내용을 고친 뒤, `PROMPT_FILE = "prompts/v3.txt"`로 바꾸세요.

저장 후 브라우저에서 새로고침하면 반영됩니다.

### 디자인 바꾸기

디자인 기준은 `DESIGN.md`에 정리되어 있어요. 흰 바탕에 검은 선, 형광 연두 포인트, 픽셀 글꼴 Mona12를 써요.

- **기본 글자색, 버튼색, 모서리**: `.streamlit/config.toml`
  (`[theme.light]`는 밝은 화면, `[theme.dark]`는 컴퓨터가 다크 모드일 때 색. 지금은 둘 다 흰 바탕 + 검은 글자)
- **번역 탭 세부 모양 (탭, 입력 메모, 버튼, 결과 종이, 커지는 박스)**: `styles.css`
- **맨 위 소개 영역 (큰 카피, 가운데 3D 로봇, 등장 효과)**: `hero/` 폴더
  - 글자 바꾸기: `hero/hero.html` · 배치·크기: `hero/hero.css` · 움직임: `hero/hero.js`
  - 3D 로봇 그림: `hero/robot-character.js` (원본은 따로 있는 robot-character 프로젝트예요. 원본을 고쳐서 복사해요)
- **'번역하기' 버튼 옆 작은 로봇**: `buddy/` 폴더
- **하소연 탭 (화면, 구겨 던지기·불태우기 효과, 효과음)**: `vent/` 폴더

저장 후 브라우저에서 새로고침하면 반영돼요.

`config.toml`을 고친 뒤에는 앱을 껐다가(`Ctrl + C`) 다시 실행해야 반영돼요.
메모장으로 저장할 때 인코딩은 **UTF-8**로 저장해주세요.

## 프롬프트 버전

| 파일 | 설명 |
|---|---|
| `prompts/v1.txt` | 처음 버전 |
| `prompts/v2.txt` | 과잉 차단이 생긴 시도 (번역해야 할 문장도 '너무 짧다'고 막음) |
| `prompts/v2_1.txt` | **현재 사용** |
| `prompts/vent_v1.txt` ~ `vent_v5.txt` | 하소연 탭 한마디의 이전 버전 |
| `prompts/vent_v6.txt` | 하소연 탭 한마디 **현재 사용** |

기존 버전 파일은 고치지 않고, 새 버전은 새 파일로 만듭니다.

## 측정하기

> 측정할 때마다 문장 수만큼 OpenAI를 호출해요 (크레딧이 쓰여요). 같은 문장도 실행할 때마다 답이 조금씩 달라질 수 있어요.

### 1) 프롬프트로 문장 번역해서 저장: `tests/run_baseline.py`

앱과 같은 모델·설정·키 읽는 방식·빈 입력 검사를 그대로 씁니다. 앱 코드는 바꾸지 않아요.

```
.\.venv\Scripts\python tests\run_baseline.py [프롬프트 파일] [결과 이름] [문장 파일]
```

- 예) 기존 21건을 v2_1로: `.\.venv\Scripts\python tests\run_baseline.py prompts/v2_1.txt v2_1_run`
- 예) 새 문장 10건을 v2_1로: `.\.venv\Scripts\python tests\run_baseline.py prompts/v2_1.txt new_v2_1 tests/new_sentences.csv`
- 결과는 `results/결과이름.csv`(엑셀용)와 `results/결과이름.md`(읽기용)로 저장돼요. 같은 이름이면 덮어써요.
- 인자를 모두 생략하면 v1 기준 기록과 같아요 (`prompts/v1.txt`, 21건 → `results/v1_baseline`).
- 문장 파일(`번호, 유형, 업무, 입력, 기대 동작` 열)을 주면 `기대 동작`, `실제 동작`, `일치 여부` 열이 추가돼요.
- 판정 칸(해석 통과, 질문 통과, 회신 통과, 쓸만함, 메모)은 비워 두고, 사람이 직접 채웁니다.

### 2) 결과 숫자 세기: `tests/measure_metrics.py`

결과 CSV를 읽기만 하고 고치지 않아요.

```
.\.venv\Scripts\python tests\measure_metrics.py results/v1_baseline.csv results/v2_1_run.csv
```

- 응답 건수, 고정 안내 문장(개인정보 / 짧은 입력) 건수, '가능한 뜻 2~3가지'가 그대로 찍힌 건수,
  되물을 질문의 개수·평균·중앙값·최대 자수(공백 포함)·60자 초과 개수를 표로 보여줘요.
- 파일 이름을 생략하면 `results/` 폴더의 CSV를 모두 읽어요.

## results 폴더

| 파일 | 내용 |
|---|---|
| `v1_baseline.*`, `v2_run.*`, `v2_1_run.*` | 기존 21건 측정 결과 (v1, v2, v2_1) |
| `new_v1.*`, `new_v2.*`, `new_v2_1.*` | 새 문장 10건 측정 결과 |
| `*_judged.csv` | 사람이 판정 칸을 채운 파일 |
| `blind/` | 버전을 가린 판정 자료 (어느 버전 응답인지 모르게 섞어서 판정) |
| `judging_rules.md` | 판정 기준과 변경 이력, 측정 조건 |

## 이런 안내가 뜨면

| 화면 안내 | 해결 방법 |
|---|---|
| 눈치챌 문장이 아직 없어요. 피드백을 입력해주세요. | 입력창에 피드백을 넣고 다시 누르세요. |
| API 키가 아직 없어요 | 4단계를 다시 확인하세요. `.env` 저장을 잊지 않았는지 확인! |
| API 키가 올바르지 않아요 | 키를 다시 복사해 붙여넣으세요. 앞뒤 공백이 없어야 해요. |
| 사용량 한도 / 크레딧 부족 | OpenAI 결제(Billing) 페이지에서 크레딧을 확인하세요. |
| 모델을 찾을 수 없어요 | `app.py`의 `MODEL_NAME`이 올바른지 확인하세요. |

## 배포하기 (Streamlit Community Cloud)

배포 주소: https://client-translator-uhxurpistedfmtpk5ln27q.streamlit.app/

1. 이 프로젝트를 GitHub 저장소에 올립니다. (`.env`는 자동으로 빠져요)
2. https://share.streamlit.io 에 GitHub 계정으로 로그인하고 **Create app**을 누릅니다.
3. 저장소와 브랜치를 고르고, **Main file path**에 `app.py`를 입력합니다.
4. **Advanced settings**를 열고:
   - **Python version**: 가능하면 3.14 (시험한 버전). 없으면 기본값을 고르세요.
   - **Secrets** 칸에 아래 형식으로 키를 넣습니다. 따옴표 안에 본인 키를 붙여넣으세요.
     ```toml
     OPENAI_API_KEY = "여기에-본인-키"
     ```
5. **Deploy**를 누르면 몇 분 뒤 앱이 열립니다.

- 배포 후에 키를 바꾸려면: 앱 화면 오른쪽 아래 **Manage app** → 점 세 개 → **Settings** → **Secrets**.
- 키는 GitHub에 절대 올리지 마세요. 배포 사이트의 Secrets에만 넣습니다.
- 앱은 Secrets를 먼저 읽고, 없으면 내 컴퓨터의 `.env`를 읽어요. 그래서 내 컴퓨터에서는 지금처럼 `.env`만 있으면 됩니다.
- 픽셀 글꼴(Mona12)과 3D 로봇 라이브러리(Three.js)는 인터넷(jsDelivr CDN)에서 불러와요. 이 주소가 막힌 환경에서는 글꼴이 기본 글꼴로 보이고 로봇 자리만 비어 있어요. 번역과 하소연 기능은 그대로 써요.

## 폴더 구성

```
client-translator/
├─ app.py             # 앱 본체
├─ styles.css         # 번역 탭 세부 디자인 (입력 메모, 버튼, 결과 종이 등)
├─ hero/              # 맨 위 소개 영역 (글자 hero.html, 모양 hero.css, 움직임 hero.js, 3D 로봇 robot-character.js)
├─ buddy/             # '번역하기' 버튼 옆 작은 로봇
├─ vent/              # 하소연 탭 (화면 vent.html, 모양 vent.css, 움직임·소리 vent.js)
├─ assets/
│  └─ logo-mark.svg   # 예전 로고 (지금은 쓰지 않음. 탭 아이콘은 👀)
├─ .streamlit/
│  └─ config.toml     # 색 테마 (밝은/어두운 화면)
├─ prompts/           # AI에게 주는 지시문 (번역 v1~v2_1, 하소연 vent_v1~v6. 버전별로 파일 추가)
├─ tests/             # 프롬프트 측정 스크립트
├─ results/           # 측정 결과
├─ requirements.txt   # 필요한 라이브러리 목록
├─ .env               # 내 API 키 (비공개, git에 안 올라감)
├─ .env.example       # 키 없는 예시 파일 (공유용)
├─ .gitignore
├─ robot_test/        # 3D 로봇 시험용 코드 (서비스 앱과 별개)
├─ robot_test_app.py  # 로봇 시험판 v1 (표정 바꾸면 다시 시작됨)
├─ robot_test_v2_app.py # 로봇 시험판 v2 (표정만 바뀜)
├─ DESIGN.md          # 디자인 기준
├─ CLAUDE.md          # 프로젝트 규칙
└─ README.md
```
