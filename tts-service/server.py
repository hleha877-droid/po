"""
Minimal Silero TTS microservice for PodMind AI.

    pip install fastapi uvicorn torch numpy soundfile
    uvicorn server:app --host 0.0.0.0 --port 8000

Contract used by the Next.js backend (src/server/services/ttsService.js):
    GET  /health -> {"ok": true, "speakers": ["aidar", "kseniya", ...]}
    POST /tts    {"text": "...", "speaker": "aidar", "sample_rate": 24000, "language": "ru"} -> audio/wav
"""
import io
import torch
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="PodMind Silero TTS")
device = torch.device("cpu")
MODELS = {}
RU_SPEAKERS = ["aidar", "baya", "kseniya", "xenia", "eugene"]
EN_SPEAKERS = ["en_0", "en_1"]


def load(language: str):
    key = "ru" if language == "ru" else "en"
    if key not in MODELS:
        model_id = "v4_ru" if key == "ru" else "v3_en"
        model, _ = torch.hub.load(repo_or_dir="snakers4/silero-models", model="silero_tts", language=key, speaker=model_id)
        model.to(device)
        MODELS[key] = model
    return MODELS[key]


class TtsRequest(BaseModel):
    text: str
    speaker: str = "aidar"
    sample_rate: int = 24000
    language: str = "ru"
    model: str | None = None


@app.get("/health")
def health():
    return {"ok": True, "speakers": RU_SPEAKERS + EN_SPEAKERS}


@app.post("/tts")
def tts(req: TtsRequest):
    if req.speaker not in RU_SPEAKERS + EN_SPEAKERS:
        raise HTTPException(400, f"unknown speaker {req.speaker}")
    if req.sample_rate not in (8000, 24000, 48000):
        raise HTTPException(400, "sample_rate must be 8000, 24000 or 48000")
    model = load("ru" if req.speaker in RU_SPEAKERS else "en")
    try:
        audio = model.apply_tts(text=req.text, speaker=req.speaker, sample_rate=req.sample_rate, put_accent=True, put_yo=True)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"synthesis failed: {type(e).__name__}: {e!r}")
    buf = io.BytesIO()
    sf.write(buf, audio.numpy(), req.sample_rate, format="WAV", subtype="PCM_16")
    return Response(content=buf.getvalue(), media_type="audio/wav")
