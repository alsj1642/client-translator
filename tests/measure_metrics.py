# 결과 CSV의 'AI 응답 전문' 열을 읽어서 숫자를 세어 표로 보여줍니다. (CSV는 읽기만 하고 고치지 않음)
# 실행: .\.venv\Scripts\python tests\measure_metrics.py results/v1_baseline.csv results/v2_run.csv
#
# - 질문 자수는 공백 포함 글자 수. 앞의 "- ", "1. " 같은 표시와 양쪽 따옴표는 빼고 셉니다.
# - 질문은 "3. 되물을 질문 후보" 제목 아래, "4. 회신 초안" 제목 전까지의 빈 줄이 아닌 줄 하나를 질문 1개로 봅니다.

import csv
import io
import re
import statistics
import sys
from pathlib import Path

FIXED_PRIVACY = "이름, 연락처, 회사명으로 보이는 내용이 있어요. 지우고 다시 입력해주세요."
FIXED_SHORT = "내용이 너무 짧아서 뜻을 짐작하기 어려워요. 어느 부분이, 어떻게 마음에 걸리는지 한 가지만 더 적어주세요."
ECHO = "가능한 뜻 2~3가지"
LIMIT = 60

# 앱(app.py)의 카드 나누기와 같은 제목 찾기 규칙
HEADING = re.compile(r"^[#>\s*]*([1-4])\s*[.)]\s*\**\s*(해석|충돌하는 요구|되물을 질문 후보|회신 초안)\s*\**\s*[:：]?\s*\**", re.MULTILINE)
MARKER = re.compile(r"^\s*(?:[-*·•]|\d+[.)])\s*")


def read_answers(path):
    """ CSV에서 'AI 응답 전문' 열만 읽습니다. 읽기 전용. """
    text = Path(path).read_text(encoding="utf-8-sig")
    rows = list(csv.reader(io.StringIO(text, newline="")))
    head = next(i for i, r in enumerate(rows) if r and r[0] == "번호")
    col = rows[head].index("AI 응답 전문")
    return [r[col] for r in rows[head + 1:] if r and r[0].strip()]


def questions(answer):
    """ '3. 되물을 질문 후보' 부분의 질문 목록. 제목이 없으면 빈 목록. """
    found = list(HEADING.finditer(answer))
    for i, m in enumerate(found):
        if m.group(1) == "3":
            end = found[i + 1].start() if i + 1 < len(found) else len(answer)
            lines = answer[m.end():end].splitlines()
            return [MARKER.sub("", s).strip().strip('"“”').strip() for s in lines if s.strip()]
    return []


def measure(path):
    answers = read_answers(path)
    qs = [q for a in answers for q in questions(a)]
    lens = [len(q) for q in qs]
    return {
        "응답 건수": len(answers),
        "고정 안내: 개인정보": sum(FIXED_PRIVACY in a for a in answers),
        "고정 안내: 짧은 입력": sum(FIXED_SHORT in a for a in answers),
        f"'{ECHO}' 그대로 찍힘": sum(ECHO in a for a in answers),
        "질문 개수": len(qs),
        "질문 평균 자수": round(statistics.mean(lens), 1) if lens else "-",
        "질문 중앙값 자수": statistics.median(lens) if lens else "-",
        "질문 최대 자수": max(lens) if lens else "-",
        f"{LIMIT}자 초과 질문": sum(n > LIMIT for n in lens),
    }


def main():
    paths = sys.argv[1:] or sorted(str(p) for p in Path("results").glob("*.csv"))
    results = {Path(p).stem: measure(p) for p in paths}
    names = list(results)
    print("| 항목 | " + " | ".join(names) + " |")
    print("|---|" + "---|" * len(names))
    for key in next(iter(results.values())):
        print(f"| {key} | " + " | ".join(str(results[n][key]) for n in names) + " |")


if __name__ == "__main__":
    main()
