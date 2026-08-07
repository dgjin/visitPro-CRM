"""
VisitPro 本地语音识别服务（FunASR / SenseVoice）

提供 OpenAI 兼容的转写接口：
    POST /v1/audio/transcriptions   (multipart 字段名: file)
    GET  /health

用法：
    ASR_PORT=8321 ASR_MODEL=iic/SenseVoiceSmall python server.py
"""
import os
import tempfile

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from funasr import AutoModel
from funasr.utils.postprocess_utils import rich_transcription_postprocess

MODEL_ID = os.environ.get("ASR_MODEL", "iic/SenseVoiceSmall")
PORT = int(os.environ.get("ASR_PORT", "8321"))
HOST = os.environ.get("ASR_HOST", "127.0.0.1")

app = FastAPI(title="VisitPro Local ASR", version="1.0")

# 允许前端开发服务器跨域调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model: AutoModel | None = None


@app.on_event("startup")
def load_model() -> None:
    """启动时加载模型：SenseVoice（自带标点）+ FSMN-VAD（长音频切分）"""
    global model
    print(f"[ASR] 加载模型 {MODEL_ID} ...")
    model = AutoModel(
        model=MODEL_ID,
        vad_model="fsmn-vad",
        vad_kwargs={"max_single_segment_time": 30000},
        device="cpu",
        disable_update=True,
    )
    print("[ASR] 模型加载完成，服务就绪")


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID, "ready": model is not None}


@app.post("/v1/audio/transcriptions")
async def transcribe(file: UploadFile = File(...)):
    """OpenAI 兼容转写接口：上传音频文件，返回 {"text": "..."}"""
    if model is None:
        raise HTTPException(status_code=503, detail="模型尚未加载完成，请稍后重试")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="上传的音频文件为空")

    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(data)
            tmp_path = f.name

        res = model.generate(
            input=tmp_path,
            language="auto",
            use_itn=True,
            batch_size_s=60,
            merge_vad=True,
        )
        text = rich_transcription_postprocess(res[0]["text"]).strip()
        return {"text": text}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"语音识别失败：{e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)
