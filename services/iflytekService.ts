import CryptoJS from 'crypto-js';

export const IFLYTEK_APP_ID_KEY = 'iflytek_app_id';
export const IFLYTEK_API_SECRET_KEY = 'iflytek_api_secret';
export const IFLYTEK_API_KEY_KEY = 'iflytek_api_key';
export const IFLYTEK_DOMAIN_KEY = 'iflytek_domain'; // For Spark LLM
export const IFLYTEK_STT_DOMAIN_KEY = 'iflytek_stt_domain'; // For Speech to Text

export const getIflytekConfig = () => {
    // FORCE ENV VARS if configured
    const envAppId = process.env.IFLYTEK_APP_ID;
    const envApiSecret = process.env.IFLYTEK_API_SECRET;
    const envApiKey = process.env.IFLYTEK_API_KEY;
    const envDomain = process.env.IFLYTEK_DOMAIN;
    const envSttDomain = process.env.IFLYTEK_STT_DOMAIN;

    return {
        appId: envAppId || (localStorage.getItem(IFLYTEK_APP_ID_KEY) || '').trim(),
        apiSecret: envApiSecret || (localStorage.getItem(IFLYTEK_API_SECRET_KEY) || '').trim(),
        apiKey: envApiKey || (localStorage.getItem(IFLYTEK_API_KEY_KEY) || '').trim(),
        domain: envDomain || (localStorage.getItem(IFLYTEK_DOMAIN_KEY) || 'generalv3.5').trim(),
        sttDomain: envSttDomain || (localStorage.getItem(IFLYTEK_STT_DOMAIN_KEY) || 'iat').trim(),
    };
};

export const saveIflytekConfig = (
  appId: string, 
  apiSecret: string, 
  apiKey: string, 
  domain: string = 'generalv3.5',
  sttDomain: string = 'iat'
) => {
  localStorage.setItem(IFLYTEK_APP_ID_KEY, appId.trim());
  localStorage.setItem(IFLYTEK_API_SECRET_KEY, apiSecret.trim());
  localStorage.setItem(IFLYTEK_API_KEY_KEY, apiKey.trim());
  localStorage.setItem(IFLYTEK_DOMAIN_KEY, domain.trim());
  localStorage.setItem(IFLYTEK_STT_DOMAIN_KEY, sttDomain.trim());
};

// Helper to determine Spark WebSocket URL based on domain version
const getSparkUrl = (domain: string) => {
    switch (domain) {
        case 'general': return 'wss://spark-api.xf-yun.com/v1.1/chat';
        case 'generalv2': return 'wss://spark-api.xf-yun.com/v2.1/chat';
        case 'generalv3': return 'wss://spark-api.xf-yun.com/v3.1/chat';
        case 'generalv3.5': return 'wss://spark-api.xf-yun.com/v3.5/chat';
        case '4.0Ultra': return 'wss://spark-api.xf-yun.com/v4.0/chat';
        default: return 'wss://spark-api.xf-yun.com/v3.5/chat';
    }
};

const getAuthUrl = (config: ReturnType<typeof getIflytekConfig>, url: string = 'wss://iat-api.xfyun.cn/v2/iat', host: string = 'iat-api.xfyun.cn') => {
  const date = new Date().toUTCString();
  const algorithm = 'hmac-sha256';
  const headers = 'host date request-line';
  
  // Extract path from url
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(signatureSha);
  const authorizationOrigin = `api_key="${config.apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
  const authorization = btoa(authorizationOrigin);
  
  return `${url}?authorization=${authorization}&date=${encodeURI(date)}&host=${host}`;
};

/**
 * Generate content using Spark LLM (WebSocket)
 */
export const generateSparkContent = async (prompt: string): Promise<string> => {
    const config = getIflytekConfig();
    if (!config.appId || !config.apiKey || !config.apiSecret) {
        throw new Error("讯飞配置不完整，请在系统设置中配置。");
    }

    const url = getSparkUrl(config.domain);
    const host = new URL(url).host;
    const authUrl = getAuthUrl(config, url, host);

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(authUrl);
        let fullText = "";

        ws.onopen = () => {
            const params = {
                header: {
                    app_id: config.appId,
                    uid: "user_" + Date.now().toString().slice(-6)
                },
                parameter: {
                    chat: {
                        domain: config.domain,
                        temperature: 0.5,
                        max_tokens: 4096 
                    }
                },
                payload: {
                    message: {
                        text: [
                            { role: "user", content: prompt }
                        ]
                    }
                }
            };
            ws.send(JSON.stringify(params));
        };

        ws.onmessage = (e) => {
            const res = JSON.parse(e.data);
            if (res.header.code !== 0) {
                ws.close();
                reject(new Error(`Spark Error [${res.header.code}]: ${res.header.message}`));
                return;
            }

            if (res.payload && res.payload.choices && res.payload.choices.text) {
                const text = res.payload.choices.text[0].content;
                fullText += text;
            }

            if (res.header.status === 2) {
                ws.close();
                resolve(fullText);
            }
        };

        ws.onerror = (e) => {
            reject(new Error("Spark WebSocket connection failed"));
        };

        ws.onclose = () => {
             // If closed without status 2 (handled in onmessage), ensure we resolve if we have text, or reject
             if (fullText) resolve(fullText);
        };
    });
};


/**
 * Downsamples AudioBuffer/Float32Array (44.1/48k) to 16kHz PCM (Int16)
 * This is critical for iFlytek API compatibility.
 */
export const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number): Int16Array => {
  const outputSampleRate = 16000;
  
  if (inputSampleRate === outputSampleRate) {
    const out = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      // Clamp values
      let s = Math.max(-1, Math.min(1, buffer[i]));
      // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Int16Array(newLength);
  
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    let nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    
    // Use average value for downsampling to prevent aliasing (simple filter)
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    
    let s = count > 0 ? accum / count : 0;
    // Clamp
    s = Math.max(-1, Math.min(1, s));
    // Convert
    result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  
  return result;
};

// --- Error Handling & Session ---

const ERROR_MAP: Record<number, { message: string, isFatal: boolean }> = {
    10105: { message: "没有权限 (10105)", isFatal: true },
    10313: { message: "Token错误 (10313)", isFatal: true },
    10406: { message: "AppID无效 (10406)", isFatal: true },
    10407: { message: "鉴权失败 (10407) - 请检查API Key/Secret", isFatal: true },
    11200: { message: "授权不足 (11200) - 请在后台检查是否开通对应版本的语音识别服务", isFatal: true },
    11201: { message: "日调用量超限 (11201)", isFatal: true },
    163: { message: "会话超时", isFatal: false },
    10163: { message: "会话超时(VAD) - 请继续说话", isFatal: false },
};

export class IflytekError extends Error {
  code: number;
  isFatal: boolean;

  constructor(originalMessage: string, code: number) {
    const mapped = ERROR_MAP[code];
    const finalMessage = mapped ? mapped.message : originalMessage;
    super(finalMessage);
    this.code = code;
    this.isFatal = mapped ? mapped.isFatal : false; 
    this.name = 'IflytekError';
  }
}

export class IflytekStreamingSession {
  private ws: WebSocket | null = null;
  private config = getIflytekConfig();
  private status: 'init' | 'connecting' | 'connected' | 'closed' = 'init';
  private queue: string[] = []; 
  private hasSentFirstFrame = false; 
  
  private onTextCallback: (text: string, isFinal: boolean) => void;
  private onErrorCallback: (err: IflytekError | Error) => void;
  private onConnectCallback?: () => void;
  private onCloseCallback?: () => void;

  constructor(
    onText: (text: string, isFinal: boolean) => void, 
    onError: (err: IflytekError | Error) => void,
    onConnect?: () => void,
    onClose?: () => void
  ) {
    this.onTextCallback = onText;
    this.onErrorCallback = onError;
    this.onConnectCallback = onConnect;
    this.onCloseCallback = onClose;
  }

  start() {
    if (!this.config.appId || !this.config.apiKey || !this.config.apiSecret) {
      this.onErrorCallback(new Error("未配置科大讯飞密钥，请前往系统设置进行配置。"));
      return;
    }

    this.status = 'connecting';
    this.hasSentFirstFrame = false;
    this.queue = [];

    try {
      const url = getAuthUrl(this.config); // Default IAT url
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        this.status = 'connected';
        if (this.onConnectCallback) this.onConnectCallback();
        this.processQueue();
      };

      this.ws.onmessage = (e) => {
        const jsonData = JSON.parse(e.data);
        if (jsonData.code !== 0) {
          console.error("iFlytek API Error:", jsonData);
          const err = new IflytekError(jsonData.message || `讯飞API错误 [${jsonData.code}]`, jsonData.code);
          this.onErrorCallback(err);
          this.stop();
          return;
        }
        
        if (jsonData.data && jsonData.data.result) {
          const wsResult = jsonData.data.result;
          const text = wsResult.ws.map((w: any) => w.cw.map((c: any) => c.w).join('')).join('');
          
          if (text) {
             this.onTextCallback(text, jsonData.data.status === 2);
          }
          
          if (jsonData.data.status === 2) {
             this.stop();
          }
        }
      };

      this.ws.onerror = (e) => {
        if (this.status !== 'closed') {
           console.error("iFlytek WS Error", e);
           this.onErrorCallback(new Error("网络连接中断"));
           this.stop();
        }
      };

      this.ws.onclose = (e) => {
        this.status = 'closed';
        if (this.onCloseCallback) this.onCloseCallback();
      };

    } catch (e: any) {
      this.onErrorCallback(e);
      this.status = 'closed';
    }
  }

  send(pcmData: Int16Array) {
     if (this.status === 'closed') return;

     // Stack-safe binary conversion (avoid spreading large arrays)
     const len = pcmData.byteLength;
     const bytes = new Uint8Array(pcmData.buffer);
     let binary = '';
     for (let i = 0; i < len; i++) {
         binary += String.fromCharCode(bytes[i]);
     }
     const chunkBase64 = btoa(binary);

     // Status: 0=First, 1=Intermediate, 2=Last (Handled in stop)
     const frameStatus = this.hasSentFirstFrame ? 1 : 0;
     
     const frame: any = {
       data: {
         status: frameStatus,
         format: "audio/L16;rate=16000",
         encoding: "raw",
         audio: chunkBase64
       }
     };

     if (frameStatus === 0) {
       frame.common = { app_id: this.config.appId };
       frame.business = {
         language: "zh_cn",
         domain: this.config.sttDomain || 'iat',
         accent: "mandarin",
         vad_eos: 10000, 
         dwa: "wpgs", 
         ptt: 1, 
         nbest: 1, 
       };
       // Disable wpgs for now to avoid complex text replacement logic in frontend
       delete frame.business.dwa;
       
       this.hasSentFirstFrame = true;
     }
     
     const json = JSON.stringify(frame);

     if (this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(json);
     } else {
        this.queue.push(json);
     }
  }
  
  processQueue() {
      while (this.queue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
          const msg = this.queue.shift();
          if (msg) this.ws.send(msg);
      }
  }

  stop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const endFrame = JSON.stringify({
          data: {
            status: 2, // Last Frame
            format: "audio/L16;rate=16000",
            encoding: "raw",
            audio: ""
          }
        });
        this.ws.send(endFrame);
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        if (this.ws) this.ws.close();
      }, 100);
    }
    this.status = 'closed';
    this.queue = [];
  }
}