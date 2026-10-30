# 💬 클라이언트 피드백 번역기

디자이너가 클라이언트에게 받은 모호한 피드백을 붙여넣으면, AI가 아래 4가지를 카드로 정리해줍니다.

1. **해석** – 가능한 뜻 2~3가지
2. **충돌하는 요구** – 서로 부딪히는 요구 (없으면 "없음")
3. **되물을 질문 후보** – 클라이언트에게 그대로 보낼 수 있는 질문 3개
4. **회신 초안** – 정중한 답장 3~5문장

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

`app.py` 맨 위 두 줄만 고치면 됩니다.

```python
MODEL_NAME = "gpt-4.1-mini"      # 사용할 모델
PROMPT_FILE = "prompts/v1.txt"   # 사용할 프롬프트 파일
```

- **모델 바꾸기**: `MODEL_NAME`의 따옴표 안을 다른 모델 이름으로 바꾸세요.
- **프롬프트 v2 시험하기**: `prompts/v1.txt`를 복사해 `prompts/v2.txt`를 만들고 내용을 고친 뒤, `PROMPT_FILE = "prompts/v2.txt"`로 바꾸세요.

저장 후 브라우저에서 새로고침하면 반영됩니다.

### 디자인(색·글꼴) 바꾸기

- **색, 글꼴, 모서리 둥글기**: `.streamlit/config.toml`
  (`[theme.light]`는 밝은 화면, `[theme.dark]`는 컴퓨터가 다크 모드일 때 색)
- **카드 왼쪽 색 띠, 여백 등 세부 모양**: `styles.css`

`config.toml`을 고친 뒤에는 앱을 껐다가(`Ctrl + C`) 다시 실행해야 반영돼요.
메모장으로 저장할 때 인코딩은 **UTF-8**로 저장해주세요.

## 이런 안내가 뜨면

| 화면 안내 | 해결 방법 |
|---|---|
| 피드백을 입력해주세요 | 입력창에 피드백을 넣고 다시 누르세요. |
| API 키가 아직 없어요 | 4단계를 다시 확인하세요. `.env` 저장을 잊지 않았는지 확인! |
| API 키가 올바르지 않아요 | 키를 다시 복사해 붙여넣으세요. 앞뒤 공백이 없어야 해요. |
| 사용량 한도 / 크레딧 부족 | OpenAI 결제(Billing) 페이지에서 크레딧을 확인하세요. |
| 모델을 찾을 수 없어요 | `app.py`의 `MODEL_NAME`이 올바른지 확인하세요. |

## 배포하기 (Streamlit Community Cloud)

배포 주소: (배포 후 여기에 적기)

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
- 글꼴과 로봇 시험용 3D 라이브러리는 인터넷(jsDelivr CDN)에서 불러와요. 이 주소가 막힌 환경에서는 글꼴이 기본 글꼴로 보이고 로봇이 뜨지 않을 수 있어요.

## 폴더 구성

```
client-translator/
├─ app.py             # 앱 본체
├─ styles.css         # 화면 세부 디자인 (카드 색 띠 등)
├─ assets/
│  └─ logo-mark.svg   # 앱 로고 (브라우저 탭 아이콘 + 상단 로고)
├─ .streamlit/
│  └─ config.toml     # 색·글꼴 테마 (밝은/어두운 화면)
├─ prompts/
│  └─ v1.txt          # AI에게 주는 지시문 (버전별로 파일 추가)
├─ requirements.txt   # 필요한 라이브러리 목록
├─ .env               # 내 API 키 (비공개, git에 안 올라감)
├─ .env.example       # 키 없는 예시 파일 (공유용)
├─ .gitignore
├─ robot_test/        # 3D 로봇 시험용 코드 (서비스 앱과 별개)
├─ robot_test_app.py  # 로봇 시험판 v1 (표정 바꾸면 다시 시작됨)
├─ robot_test_v2_app.py # 로봇 시험판 v2 (표정만 바뀜)
├─ CLAUDE.md          # 프로젝트 규칙
└─ README.md
```
