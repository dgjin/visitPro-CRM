/**
 * 本地 FunASR 语音识别服务（local-asr/server.py，默认端口 8321）
 * OpenAI 兼容接口：POST /v1/audio/transcriptions
 */

export const LOCAL_ASR_URL_KEY = 'local_asr_url';
export const DEFAULT_LOCAL_ASR_URL = 'http://127.0.0.1:8321';

export const getLocalAsrUrl = (): string =>
  (localStorage.getItem(LOCAL_ASR_URL_KEY) || DEFAULT_LOCAL_ASR_URL).trim().replace(/\/$/, '');

export const saveLocalAsrUrl = (url: string) => {
  localStorage.setItem(LOCAL_ASR_URL_KEY, url.trim());
};

/**
 * 检查本地 ASR 服务是否可用（健康检查）
 */
export const isLocalAsrAvailable = async (timeoutMs: number = 2000): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${getLocalAsrUrl()}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json();
    return data.ready === true;
  } catch {
    return false;
  }
};

const base64ToBlob = (base64Data: string, mimeType: string): Blob => {
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

/** 将任意音频 Blob 解码并重采样为 16kHz 单声道 WAV（服务端 torchaudio 不支持 webm 等容器格式） */
const blobToWavBlob = async (blob: Blob): Promise<Blob> => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const targetRate = 16000;
    const sourceData = audioBuffer.getChannelData(0);

    // 重采样到 16kHz（均值降采样，与讯飞链路保持一致）
    let pcm: Int16Array;
    if (audioBuffer.sampleRate === targetRate) {
      pcm = new Int16Array(sourceData.length);
      for (let i = 0; i < sourceData.length; i++) {
        const s = Math.max(-1, Math.min(1, sourceData[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
    } else {
      const ratio = audioBuffer.sampleRate / targetRate;
      const newLength = Math.round(sourceData.length / ratio);
      pcm = new Int16Array(newLength);
      let offsetResult = 0;
      let offsetBuffer = 0;
      while (offsetResult < newLength) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
        let accum = 0;
        let count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < sourceData.length; i++) {
          accum += sourceData[i];
          count++;
        }
        const s = Math.max(-1, Math.min(1, count > 0 ? accum / count : 0));
        pcm[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
      }
    }

    // 拼装 44 字节 WAV 头（PCM 16-bit mono）
    const dataSize = pcm.length * 2;
    const header = new DataView(new ArrayBuffer(44));
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) header.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    header.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    header.setUint32(16, 16, true);
    header.setUint16(20, 1, true); // PCM
    header.setUint16(22, 1, true); // mono
    header.setUint32(24, targetRate, true);
    header.setUint32(28, targetRate * 2, true);
    header.setUint16(32, 2, true);
    header.setUint16(34, 16, true);
    writeStr(36, 'data');
    header.setUint32(40, dataSize, true);

    return new Blob([header.buffer, pcm.buffer], { type: 'audio/wav' });
  } finally {
    audioCtx.close();
  }
};

/**
 * 使用本地 FunASR 服务转写音频
 * @param base64Data Base64 编码音频（可带 data:xxx;base64, 前缀）
 * @param mimeType 音频 MIME 类型（如 audio/webm、audio/mp3）
 */
export const transcribeAudioWithLocalAsr = async (
  base64Data: string,
  mimeType: string = 'audio/webm'
): Promise<string> => {
  const sourceBlob = base64ToBlob(base64Data, mimeType);
  const wavBlob = await blobToWavBlob(sourceBlob);

  const formData = new FormData();
  formData.append('file', wavBlob, 'audio.wav');

  const res = await fetch(`${getLocalAsrUrl()}/v1/audio/transcriptions`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let detail = `本地语音识别服务错误 (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.detail) detail = errJson.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  const data = await res.json();
  return (data.text || '').trim();
};
