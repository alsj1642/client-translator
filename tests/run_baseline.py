# 개선 전 기준 기록: 지금 프롬프트로 테스트 문장 21건을 번역해서 저장합니다.
# 실행: .\.venv\Scripts\python tests\run_baseline.py [프롬프트 파일] [결과 파일 이름]
#   예) .\.venv\Scripts\python tests\run_baseline.py prompts/v2.txt v2_run
#       → prompts/v2.txt로 번역해서 results/v2_run.csv, results/v2_run.md에 저장
#   인자를 생략하면 v1 기준 기록과 같음 (prompts/v1.txt → results/v1_baseline)
#
# 앱(app.py)의 함수와 설정을 그대로 가져다 씁니다. (앱 코드는 바꾸지 않음)
# - 키: app.load_api_key()   (st.secrets → .env 순서, 키 값은 출력하지 않음)
# - 프롬프트: app.load_prompt()   (app.PROMPT_FILE을 인자로 받은 파일로 바꿔서 읽음)
# - 번역: app.ask_ai()   (app.MODEL_NAME, 추가 설정 없음)
# - 앱과 같은 검사: 입력 앞뒤 공백을 지우고, 비어 있으면 AI를 부르지 않음

import argparse
import csv
import hashlib
import logging
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
logging.disable(logging.CRITICAL)  # Streamlit 화면 없이 불러올 때 나오는 경고 숨기기

import app  # noqa: E402

T = {
    "T1": "전체적으로 색이 좀 무거워 보여요. 확 밝아지면 좋겠는데, 가벼워 보이는 건 싫어요.",
    "T2": "글씨가 잘 안 보이는 것 같아요. 근데 디자인이 달라지진 않았으면 해요.",
    "T3": "좀 더 신뢰가 가면서도 젊은 느낌이면 좋겠어요.",
    "T4": "요즘 앱 같은 느낌으로 가볍게 가고 싶어요.",
    "T5": "음, 다 괜찮은데 뭔가 하나가 아쉬워요.",
}

CASES = [
    ("T1", "A", "웹사이트", T["T1"]),
    ("T2", "A", "포스터", T["T2"]),
    ("T3", "B", "로고", T["T3"]),
    ("T4", "B", "앱 화면", T["T4"]),
    ("T5", "C", "상세페이지", T["T5"]),
    ("T6", "C", "배너", "처음 시안이 더 나았던 것 같기도 하고, 잘 모르겠네요."),
    ("T7", "D", "브랜드 사이트", "저희가 좀 전문적으로 보였으면 해요. 근데 딱딱하진 않게요."),
    ("T8", "D", "패키지", "선물하기 좋은 느낌이었으면 좋겠어요."),
    ("T9", "E", "앱 화면", "더 깔끔하게 해주세요."),
    ("T10", "E", "웹사이트", "심플한 게 좋아요. 그런데 허전해 보이진 않게요."),
    ("T11", "B", "발표자료", "대표님이 보실 거라 좀 더 임팩트 있게 해주세요."),
    ("T12", "A+B", "카드뉴스", "좀 더 감성적으로 해주세요. 근데 너무 어둡진 않게요."),
    ("X1", "특수(서로 모순)", "-", "눈에 확 띄게 해주세요. 그런데 기존 화면이랑 똑같이 익숙해야 해요."),
    ("X2", "특수(너무 짧음)", "-", "뭔가 아쉬워요."),
    ("X3", "특수(뜻을 알 수 없음)", "-", "음..."),
    ("X4", "특수(여러 사람 의견)", "-", "팀장님은 로고를 키우자고 하시고, 대표님은 오히려 줄이자고 하세요. 마케팅팀은 색을 바꾸자고 하고요."),
    ("X5", "특수(감정적)", "-", "솔직히 이 시안은 마음에 안 들어요. 처음부터 다시 했으면 좋겠어요."),
    ("X7", "특수(영어 혼용)", "-", "로고가 좀 더 pop하게요. clean한데 premium하게 부탁드려요."),
    ("X8", "특수(긴 글)", "-", " ".join(T[k] for k in ["T1", "T2", "T3", "T4", "T5"])),
    ("X9", "특수(개인정보, 가짜 값)", "-", "김00 대표님(연락처 010-0000-0000)이 보시기에 ㈜가나다 로고가 아쉽대요."),
    ("R1", "실제 받은 피드백", "앱 화면", "너무 눈에 띄지 않는다. 좀 더 우리 회사 브랜드 컨셉이 잘 드러나면 좋겠다."),
]

COLUMNS = ["번호", "유형", "업무", "입력", "AI 응답 전문", "오류",
           "해석 통과", "질문 통과", "회신 통과", "쓸만함", "메모"]


def translate(api_key, prompt, text):
    """ 앱과 같은 순서: 공백 정리 → 빈 입력이면 중단 → ask_ai 호출. (응답, 오류) """
    feedback = text.strip()
    if not feedback:
        return "", "피드백을 입력해주세요 (빈 입력이라 AI를 부르지 않음)"
    try:
        result, error = app.ask_ai(api_key, prompt, feedback)
    except Exception as e:  # ask_ai가 놓친 예외. 오류 종류만 기록 (키가 섞일 수 있는 원문은 남기지 않음)
        return "", f"예상 못한 오류: {type(e).__name__}"
    return result or "", error or ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("prompt_file", nargs="?", default="prompts/v1.txt")
    parser.add_argument("out_name", nargs="?", default="v1_baseline")
    args = parser.parse_args()
    app.PROMPT_FILE = args.prompt_file  # 앱 파일은 그대로 두고, 이번 실행에서만 바꿈

    api_key = app.load_api_key()
    prompt = app.load_prompt()
    if not api_key:
        sys.exit("API 키를 찾지 못했어요. .env 또는 Secrets를 확인해주세요.")
    if not prompt:
        sys.exit(f"프롬프트 파일({app.PROMPT_FILE})을 찾지 못했어요.")

    prompt_path = ROOT / app.PROMPT_FILE
    info = {
        "측정 날짜": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "모델 이름": app.MODEL_NAME,
        "프롬프트 파일": app.PROMPT_FILE,
        "프롬프트 해시(SHA-256)": hashlib.sha256(prompt_path.read_bytes()).hexdigest(),
    }

    rows = []
    for no, kind, task, text in CASES:
        print(f"{no} 번역 중...", flush=True)
        answer, error = translate(api_key, prompt, text)
        rows.append({"번호": no, "유형": kind, "업무": task, "입력": text,
                     "AI 응답 전문": answer, "오류": error})
        print(f"  → {'실패: ' + error if error else '성공'}", flush=True)

    out = ROOT / "results"
    out.mkdir(exist_ok=True)

    # CSV: 엑셀에서 한글이 깨지지 않도록 utf-8-sig. 맨 위에 측정 정보, 한 줄 띄우고 표
    with open(out / f"{args.out_name}.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        for k, v in info.items():
            w.writerow([k, v])
        w.writerow([])
        w.writerow(COLUMNS)
        for r in rows:
            w.writerow([r.get(c, "") for c in COLUMNS])

    # Markdown: 읽기 쉬운 버전
    ok = sum(1 for r in rows if not r["오류"])
    lines = [f"# {args.out_name} 측정 기록", ""]
    lines += [f"- **{k}**: `{v}`" for k, v in info.items()]
    lines += [f"- **결과**: 성공 {ok}건 / 실패 {len(rows) - ok}건 (전체 {len(rows)}건)", "",
              "> 판정 칸(해석 통과, 질문 통과, 회신 통과, 쓸만함, 메모)은 CSV에서 직접 채웁니다.", ""]
    for r in rows:
        lines += [f"## {r['번호']} · {r['유형']} · {r['업무']}", "",
                  f"**입력**: {r['입력']}", ""]
        if r["오류"]:
            lines += [f"**오류**: {r['오류']}", ""]
        else:
            lines += ["**AI 응답 전문**:", "", r["AI 응답 전문"].strip(), ""]
        lines += ["---", ""]
    (out / f"{args.out_name}.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"\n완료: 성공 {ok}건 / 실패 {len(rows) - ok}건 → results/{args.out_name}.csv, results/{args.out_name}.md")


if __name__ == "__main__":
    main()
