"""효과음 만들기: 소리 파일 없이 잡음과 짧은 음을 섞어 만들어요 (앱 vent/vent.js의 SOUND와 같은 방식).
    uv run --with numpy python scripts/make-sfx.py
→ public/audio/nunchibot/sfx/*.wav, 소리가 가장 큰 지점(초)은 sfx-peaks.json
"""

import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
OUT = Path(__file__).resolve().parent.parent / "public/audio/nunchibot/sfx"
rng = np.random.default_rng(7)  # 매번 같은 소리


def env(n, attack, release):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / release)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    for i in range(1, len(x)):
        y[i] = (1 - a) * x[i] + a * y[i - 1]
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def noise(sec):
    return rng.standard_normal(int(round(SR * sec)))


def click():  # 마우스 딸깍
    n = int(SR * 0.05)
    x = highpass(noise(0.05), 1500) * env(n, 0.0005, 0.006)
    x += np.sin(2 * np.pi * 2200 * np.arange(n) / SR) * env(n, 0.0005, 0.004) * 0.5
    return x


def crumple():  # 바스락바스락: 뒤로 갈수록 촘촘하게 (1.1초)
    sec = 1.1
    x = np.zeros(int(SR * sec))
    t = 0.0
    while t < sec - 0.05:
        n = int(SR * rng.uniform(0.015, 0.05))
        start = int(SR * t)
        burst = highpass(noise(n / SR), 2500) * env(n, 0.001, rng.uniform(0.006, 0.02)) * rng.uniform(0.4, 1)
        x[start:start + n] += burst[: len(x) - start]
        t += 0.09 * (1 - t / sec) + 0.018 + rng.uniform(0, 0.02)
    return x


def whoosh():  # 휙 (0.85초)
    sec = 0.85
    n = int(SR * sec)
    shape = np.sin(np.pi * np.arange(n) / n) ** 2
    return lowpass(noise(sec), 1800) * shape * 1.6


def land():  # 툭 + 뚜껑 딸깍
    n = int(SR * 0.25)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * (140 - 60 * t / 0.25) * t) * env(n, 0.001, 0.05)
    c = np.pad(click(), (int(SR * 0.06), 0))
    x = thud + 0.6 * np.pad(c, (0, max(0, n - len(c))))[:n]
    return x


def fire():  # 화르륵 + 타닥타닥 (1.6초)
    sec = 1.6
    n = int(SR * sec)
    t = np.arange(n) / SR
    roar = lowpass(noise(sec), 900) * np.minimum(1, t / 0.15) * np.exp(-np.maximum(0, t - 1.2) / 0.2)
    roar *= 1 + 0.4 * np.sin(2 * np.pi * 3.1 * t)
    crackle = np.zeros(n)
    for _ in range(26):
        s = int(rng.uniform(0.05, 1.4) * SR)
        m = int(SR * 0.01)
        crackle[s:s + m] += highpass(noise(0.01), 3000) * env(m, 0.0005, 0.002) * rng.uniform(0.3, 0.8)
    return roar * 2.2 + crackle


def hiss():  # 치익 (꺼지기)
    sec = 0.6
    n = int(SR * sec)
    return highpass(noise(sec), 4000) * env(n, 0.02, 0.2)


def pop():  # 톡 (새 쓰레기통)
    n = int(SR * 0.12)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * (520 + 300 * np.exp(-t / 0.02)) * t) * env(n, 0.001, 0.03)


def write(name, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    data = (x * 32767).astype(np.int16)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    return float(np.argmax(np.abs(x)) / SR)


OUT.mkdir(parents=True, exist_ok=True)
peaks = {name: write(name, fn()) for name, fn in [("click", click), ("crumple", crumple), ("whoosh", whoosh), ("land", land), ("fire", fire), ("hiss", hiss), ("pop", pop)]}
(OUT / "sfx-peaks.json").write_text(json.dumps(peaks, indent=1))
print(peaks)
