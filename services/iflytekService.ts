import CryptoJS from 'crypto-js';

export const IFLYTEK_APP_ID_KEY = 'iflytek_app_id';
export const IFLYTEK_API_SECRET_KEY = 'iflytek_api_secret';
export const IFLYTEK_API_KEY_KEY = 'iflytek_api_key';
export const IFLYTEK_DOMAIN_KEY = 'iflytek_domain'; // For Spark LLM

export const getIflytekConfig = () => {
    // 安全约定：密钥仅来自用户在系统设置中的本地配置（localStorage），
    // 不从环境变量注入，避免密钥进入前端构建产物。
    // 语音识别已全面切换为本地 FunASR（localAsrService.ts），此处仅保留星火大模型配置。
    return {
        appId: (localStorage.getItem(IFLYTEK_APP_ID_KEY) || '').trim(),
        apiSecret: (localStorage.getItem(IFLYTEK_API_SECRET_KEY) || '').trim(),
        apiKey: (localStorage.getItem(IFLYTEK_API_KEY_KEY) || '').trim(),
        domain: (localStorage.getItem(IFLYTEK_DOMAIN_KEY) || 'generalv3.5').trim(),
    };
};

export const saveIflytekConfig = (
  appId: string, 
  apiSecret: string, 
  apiKey: string, 
  domain: string = 'generalv3.5'
) => {
  localStorage.setItem(IFLYTEK_APP_ID_KEY, appId.trim());
  localStorage.setItem(IFLYTEK_API_SECRET_KEY, apiSecret.trim());
  localStorage.setItem(IFLYTEK_API_KEY_KEY, apiKey.trim());
  localStorage.setItem(IFLYTEK_DOMAIN_KEY, domain.trim());
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

const getAuthUrl = (config: ReturnType<typeof getIflytekConfig>, url: string, host: string) => {
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
