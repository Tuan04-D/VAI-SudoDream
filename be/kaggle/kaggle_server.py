import subprocess
import sys

subprocess.run([
    sys.executable, "-m", "pip", "install", "-q",
    "fastapi", "uvicorn[standard]",
    "sherpa-onnx", "edge-tts",
    "transformers>=4.40.0", "accelerate", "soundfile",
    "numpy", "scipy", "pydub", "huggingface_hub",
    "nest_asyncio", "unidecode", "phonemizer", "Cython",
], check=True)

subprocess.run(["apt-get", "install", "-y", "-q", "ffmpeg", "espeak-ng", "nodejs", "npm"], check=True)
subprocess.run(["npm", "install", "-g", "localtunnel"], check=True)

import asyncio
import base64
import io
import os
import threading
import time

import re
import threading

import nest_asyncio
import numpy as np
import sherpa_onnx
import soundfile as sf
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import snapshot_download
from pydantic import BaseModel

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

_gpu_lock = threading.Lock()

hmong_asr_model = None
hmong_asr_processor = None
viet_asr_recognizer = None
hmong_tts_model = None
hmong_tts_hps = None
hmong_tts_text_fn = None

KAGGLE_MODELS_DIR = "/kaggle/working/models"
SHERPA_VI_ASR_DIR = os.path.join(KAGGLE_MODELS_DIR, "sherpa-onnx-zipformer-vi-2025-04-20")


def _load_audio(audio_b64: str):
    from pydub import AudioSegment

    audio_bytes = base64.b64decode(audio_b64)
    try:
        segment = AudioSegment.from_file(io.BytesIO(audio_bytes))
    except Exception:
        segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format="webm")
    segment = segment.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    wav_io = io.BytesIO()
    segment.export(wav_io, format="wav")
    wav_io.seek(0)
    audio_np, _ = sf.read(wav_io, dtype="float32")
    return audio_np


def _is_hallucination(text: str) -> bool:
    words = text.split()
    if not words:
        return False
    if len(words) > 12:
        unique = len(set(words))
        if unique / len(words) < 0.4:
            return True
    if len(words) >= 6:
        chunk = " ".join(words[:4])
        if text.count(chunk) >= 3:
            return True
    return False


def _sentence_case(text: str) -> str:
    if not text:
        return text
    words = text.split()
    alpha_words = [w for w in words if any(c.isalpha() for c in w)]
    if alpha_words and sum(1 for w in alpha_words if w == w.upper()) / len(alpha_words) > 0.7:
        text = text.lower()
    return text[0].upper() + text[1:] if text else text


def _hmong_asr_infer(audio_np: np.ndarray) -> str:
    if audio_np.shape[0] < 1600:
        return ""
    rms = float(np.sqrt(np.mean(audio_np ** 2)))
    if rms < 0.002:
        return ""
    t0 = time.time()
    dtype = torch.float16 if DEVICE == "cuda" else torch.float32
    inputs = hmong_asr_processor(audio_np, sampling_rate=16000, return_tensors="pt")
    inputs = {k: v.to(DEVICE, dtype=dtype) if v.dtype.is_floating_point else v.to(DEVICE)
              for k, v in inputs.items()}
    with torch.inference_mode():
        ids = hmong_asr_model.generate(
            **inputs,
            forced_decoder_ids=None,
            num_beams=1,
            do_sample=False,
            no_repeat_ngram_size=4,
            repetition_penalty=1.3,
            max_new_tokens=200,
        )
    text = hmong_asr_processor.batch_decode(ids, skip_special_tokens=True)[0].strip()
    print(f"[LATENCY] hmong_asr: {time.time()-t0:.2f}s | text={text[:50]!r}")
    if _is_hallucination(text):
        return ""
    return _sentence_case(text)


def load_hmong_asr():
    global hmong_asr_model, hmong_asr_processor
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    repo_id = "Pakorn2112/whisper-model-large-hmong-multi-speech"
    print("Loading H'Mong ASR (FP16 + greedy)...")
    hmong_asr_processor = WhisperProcessor.from_pretrained(repo_id)
    hmong_asr_model = (
        WhisperForConditionalGeneration.from_pretrained(
            repo_id,
            torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
        )
        .to(DEVICE)
        .eval()
    )
    dummy = np.zeros(3200, dtype=np.float32)
    _hmong_asr_infer(dummy)
    print("H'Mong ASR loaded")


def _viet_asr_infer(audio_np: np.ndarray) -> str:
    if audio_np.ndim > 1:
        audio_np = audio_np.mean(axis=1)
    samples = audio_np.astype(np.float32)
    t0 = time.time()
    stream = viet_asr_recognizer.create_stream()
    stream.accept_waveform(16000, samples)
    viet_asr_recognizer.decode_stream(stream)
    text = stream.result.text.strip()
    print(f"[LATENCY] viet_asr: {time.time()-t0:.2f}s | text={text[:50]!r}")
    return _sentence_case(text)


def load_viet_asr():
    global viet_asr_recognizer

    os.makedirs(SHERPA_VI_ASR_DIR, exist_ok=True)
    if not os.listdir(SHERPA_VI_ASR_DIR):
        print("Downloading Vietnamese ASR model from HuggingFace (sherpa-onnx zipformer-vi)...")
        snapshot_download(
            "csukuangfj/sherpa-onnx-zipformer-vi-2025-04-20",
            local_dir=SHERPA_VI_ASR_DIR,
        )

    encoder = decoder = joiner = tokens = bpe_vocab = None
    for f in os.listdir(SHERPA_VI_ASR_DIR):
        fpath = os.path.join(SHERPA_VI_ASR_DIR, f)
        if f.startswith("encoder") and f.endswith(".onnx"):
            encoder = fpath
        elif f.startswith("decoder") and f.endswith(".onnx"):
            decoder = fpath
        elif f.startswith("joiner") and f.endswith(".onnx"):
            joiner = fpath
        elif f == "tokens.txt":
            tokens = fpath
        elif f == "bpe.model":
            bpe_vocab = fpath

    if not all([encoder, decoder, joiner, tokens]):
        raise RuntimeError(f"Missing sherpa-onnx ASR model files in {SHERPA_VI_ASR_DIR}")

    print("Initializing Vietnamese ASR (sherpa-onnx zipformer)...")
    viet_asr_recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=encoder,
        decoder=decoder,
        joiner=joiner,
        tokens=tokens,
        num_threads=4,
        provider="cpu",
        modeling_unit="bpe" if bpe_vocab else "char",
        bpe_vocab=bpe_vocab or "",
    )
    dummy = np.zeros(3200, dtype=np.float32)
    _viet_asr_infer(dummy)
    print("Vietnamese ASR loaded")


async def _edge_tts_async(text: str) -> bytes:
    import edge_tts
    comm = edge_tts.Communicate(text, voice="vi-VN-HoaiMyNeural")
    chunks = []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


def _viet_tts_generate(text: str) -> bytes:
    from pydub import AudioSegment
    t0 = time.time()
    loop = asyncio.get_event_loop()
    mp3_bytes = loop.run_until_complete(_edge_tts_async(text))
    seg = AudioSegment.from_mp3(io.BytesIO(mp3_bytes))
    seg = seg.set_frame_rate(22050).set_channels(1).set_sample_width(2)
    wav_io = io.BytesIO()
    seg.export(wav_io, format="wav")
    print(f"[LATENCY] viet_tts: {time.time()-t0:.2f}s | chars={len(text)}")
    return wav_io.getvalue()


def load_hmong_tts():
    global hmong_tts_model, hmong_tts_hps, hmong_tts_text_fn

    repo_path = snapshot_download(repo_id="leejnus/HmongTTS", repo_type="space")

    old_cwd = os.getcwd()
    monotonic_dir = os.path.join(repo_path, "monotonic_align")

    import shutil
    for f in os.listdir(monotonic_dir):
        if f.endswith((".so", ".pyd", ".c")):
            os.remove(os.path.join(monotonic_dir, f))
    build_dir = os.path.join(monotonic_dir, "build")
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)

    os.chdir(monotonic_dir)
    subprocess.run(
        [sys.executable, "setup.py", "build_ext", "--inplace"],
        check=True,
    )
    os.chdir(old_cwd)

    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)

    import commons as _commons
    import utils as _utils
    from models import SynthesizerTrn
    from text import text_to_sequence
    from text.symbols import symbols

    hps = _utils.get_hparams_from_file(os.path.join(repo_path, "hmong.json"))
    net_g = SynthesizerTrn(
        len(symbols),
        hps.data.filter_length // 2 + 1,
        hps.train.segment_size // hps.data.hop_length,
        n_speakers=hps.data.n_speakers,
        **hps.model,
    ).to(DEVICE)
    net_g.eval()
    
    _utils.load_checkpoint(os.path.join(repo_path, "G_60000.pth"), net_g, None)

    hmong_tts_model = net_g
    hmong_tts_hps = hps
    hmong_tts_text_fn = (text_to_sequence, _commons)

    if repo_path in sys.path:
        sys.path.remove(repo_path)

    _hmong_tts_infer("Nyob zoo")
    print("H'Mong TTS loaded")


def _hmong_tts_infer(text: str):
    t0 = time.time()
    text_to_seq, commons_mod = hmong_tts_text_fn
    hps = hmong_tts_hps
    seq = text_to_seq(text, hps.data.text_cleaners)
    if hps.data.add_blank:
        seq = commons_mod.intersperse(seq, 0)
    x = torch.LongTensor(seq).to(DEVICE).unsqueeze(0)
    x_len = torch.LongTensor([x.size(1)]).to(DEVICE)

    with torch.no_grad():
        audio = hmong_tts_model.infer(
            x, x_len,
            noise_scale=0.667,
            noise_scale_w=0.8,
            length_scale=1.0,
        )[0][0, 0]

    result = audio.float().data.cpu().numpy(), hps.data.sampling_rate
    print(f"[LATENCY] hmong_tts: {time.time()-t0:.2f}s | chars={len(text)}")
    return result


print(f"Loading models on {DEVICE}...")
load_hmong_asr()
load_viet_asr()
load_hmong_tts()
print("All models ready")

app = FastAPI(title="HmongBridge Model Server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ASRRequest(BaseModel):
    audio: str
    language: str


class TTSRequest(BaseModel):
    text: str
    language: str


@app.post("/asr")
def asr(request: ASRRequest):
    if request.language not in ("hmong", "vietnamese"):
        raise HTTPException(status_code=400, detail="Invalid language")

    t0 = time.time()
    try:
        audio_np = _load_audio(request.audio)

        if request.language == "hmong":
            with _gpu_lock:
                text = _hmong_asr_infer(audio_np)
        else:
            text = _viet_asr_infer(audio_np)

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"text": text, "latency_ms": int((time.time() - t0) * 1000)}


@app.post("/tts")
def tts(request: TTSRequest):
    if request.language not in ("hmong", "vietnamese"):
        raise HTTPException(status_code=400, detail="Invalid language")
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    t0 = time.time()
    try:
        if request.language == "hmong":
            with _gpu_lock:
                audio_np, sample_rate = _hmong_tts_infer(request.text)
            buf = io.BytesIO()
            sf.write(buf, audio_np, sample_rate, format="WAV")
            audio_b64 = base64.b64encode(buf.getvalue()).decode()
        else:
            wav_bytes = _viet_tts_generate(request.text)
            audio_b64 = base64.b64encode(wav_bytes).decode()

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"audio": audio_b64, "latency_ms": int((time.time() - t0) * 1000)}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": DEVICE,
        "hmong_asr": "transformers/whisper-FP16+greedy",
        "viet_asr": "sherpa-onnx/zipformer-vi-2025-04-20",
        "viet_tts": "edge-tts/vi-VN-HoaiMyNeural",
        "gpu": torch.cuda.get_device_name(0) if DEVICE == "cuda" else "cpu",
    }


nest_asyncio.apply()

public_url = None
_url_ready = threading.Event()


def _run_localtunnel():
    global public_url
    proc = subprocess.Popen(
        ["lt", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    for raw in proc.stdout:
        line = raw.decode(errors="replace").strip()
        print(f"[localtunnel] {line}")
        m = re.search(r"https://[a-z0-9\-]+\.loca\.lt", line)
        if m:
            public_url = m.group(0)
            _url_ready.set()


_lt_thread = threading.Thread(target=_run_localtunnel, daemon=True)
_lt_thread.start()
_url_ready.wait(timeout=30)

if not public_url:
    raise RuntimeError("LocalTunnel did not provide a URL within 30s")

print("\n" + "=" * 60)
print(f"LocalTunnel URL: {public_url}")
print(f"Set in local .env: KAGGLE_NGROK_URL={public_url}")
print("=" * 60 + "\n")

_config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="warning")
_server = uvicorn.Server(_config)
asyncio.get_event_loop().run_until_complete(_server.serve())
