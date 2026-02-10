import CryptoJS from 'https://esm.sh/crypto-js@4.2.0';

export const IFLYTEK_APP_ID_KEY = 'iflytek_app_id';
export const IFLYTEK_API_SECRET_KEY = 'iflytek_api_secret';
export const IFLYTEK_API_KEY_KEY = 'iflytek_api_key';
export const IFLYTEK_DOMAIN_KEY = 'iflytek_domain';

export const getIflytekConfig = () => ({
  appId: (localStorage.getItem(IFLYTEK_APP_ID_KEY) || '').trim(),
  apiSecret: (localStorage.getItem(IFLYTEK_API_SECRET_KEY) || '').trim(),
  apiKey: (localStorage.getItem(IFLYTEK_API_KEY_KEY) || '').trim(),
  domain: (localStorage.getItem(IFLYTEK_DOMAIN_KEY) || 'iat').trim(),
});

export const saveIflytekConfig = (appId: string, apiSecret: string, apiKey: string, domain: string = 'iat') => {
  localStorage.setItem(IFLYTEK_APP_ID_KEY, appId.trim());
  localStorage.setItem(IFLYTEK_API_SECRET_KEY, apiSecret.trim());
  localStorage.setItem(IFLYTEK_API_KEY_KEY, apiKey.trim());
  localStorage.setItem(IFLYTEK_DOMAIN_KEY, domain.trim());
};

const getAuthUrl = (config: ReturnType<typeof getIflytekConfig>) => {
  const url = 'wss://iat-api.xfyun.cn/v2/iat';
  const host = 'iat-api.xfyun.cn';
  const date = new Date().toUTCString();
  const algorithm = 'hmac-sha256';
  const headers = 'host date request-line';
  
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
  const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(signatureSha);
  const authorizationOrigin = `api_key="${config.apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
  const authorization = btoa(authorizationOrigin);
  
  return `${url}?authorization=${authorization}&date=${encodeURI(date)}&host=${host}`;
};

/**
 * Downsamples AudioBuffer/Float32Array (44.1/48k) to 16kHz PCM (Int16)
 */
export const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number): Int16Array => {
  const outputSampleRate = 16000;
  if (inputSampleRate === outputSampleRate) {
    const out = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      let s = Math.max(-1, Math.min(1, buffer[i]));
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
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    
    let s = count > 0 ? accum / count : 0;
    s = Math.max(-1, Math.min(1, s));
    result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  
  return result;
};

export class IflytekStreamingSession {
  private ws: WebSocket | null = null;
  private config = getIflytekConfig();
  private status: 'init' | 'connecting' | 'connected' | 'closed' = 'init';
  private queue: string[] = []; 
  private hasSentFirstFrame = false; 
  
  private onTextCallback: (text: string, isFinal: boolean) => void;
  private onErrorCallback: (err: Error) => void;
  private onConnectCallback?: () => void;
  private onCloseCallback?: () => void;

  constructor(
    onText: (text: string, isFinal: boolean) => void, 
    onError: (err: Error) => void,
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
      const url = getAuthUrl(this.config);
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
          this.onErrorCallback(new Error(`讯飞错误 [${jsonData.code}]: ${jsonData.message}`));
          this.stop();
          return;
        }
        
        if (jsonData.data && jsonData.data.result) {
          const wsResult = jsonData.data.result;
          const text = wsResult.ws.map((w: any) => w.cw.map((c: any) => c.w).join('')).join('');
          
          if (text) {
             this.onTextCallback(text, jsonData.data.status === 2);
          }
          
          // Check if server closed session (Status=2 means end of speech/VAD detected)
          if (jsonData.data.status === 2) {
             // Server will close connection shortly. We initiate stop to clean up.
             this.stop();
          }
        }
      };

      this.ws.onerror = (e) => {
        // Only trigger error if not already closed intentionally
        if (this.status !== 'closed') {
           console.error("iFlytek WS Error", e);
           this.onErrorCallback(new Error("连接中断，请检查网络或密钥配置"));
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

     let binary = '';
     const len = pcmData.byteLength;
     const bytes = new Uint8Array(pcmData.buffer);
     for (let i = 0; i < len; i++) {
         binary += String.fromCharCode(bytes[i]);
     }
     const chunkBase64 = btoa(binary);

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
         domain: this.config.domain, // Default 'iat', can be 'pro_large' if configured
         accent: "mandarin",
         // vad_eos: Max silence time before server closes connection. 
         // Set to 10s. Client will auto-restart if recording is still active.
         vad_eos: 10000, 
         dwa: "wpgs", // Enable dynamic correction if desired, but frontend is currently append-only.
         ptt: 1, // Enable punctuation
         nbest: 1, // Return best result
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
            status: 2,
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
