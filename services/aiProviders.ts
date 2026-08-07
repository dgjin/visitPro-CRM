import { GoogleGenAI } from "@google/genai";
import { getStoredToken } from "./apiService";

// ==========================================
// AI 提供商配置与调用层
// 安全约定：所有密钥仅来自用户在系统设置中的本地配置（localStorage），
// 不从环境变量注入，避免密钥进入前端构建产物。
// ==========================================

export const AI_MODEL_KEY = 'visitpro_ai_model';
export const DEEPSEEK_KEY_KEY = 'visitpro_deepseek_key';
export const KIMI_KEY_KEY = 'visitpro_kimi_key';
export const OLLAMA_MODEL_KEY = 'visitpro_ollama_model';
export const GEMINI_KEY_KEY = 'visitpro_gemini_key';

// 本地 Ollama 默认模型（可在系统设置中切换为已安装的任意模型）
export const DEFAULT_OLLAMA_MODEL = 'qwen3.6:latest';

/** 云端提供商配置类错误（密钥无效/鉴权失败/欠费停服），此类错误重试无意义，应回退本地 Ollama */
export const isProviderConfigError = (msg: string) =>
    /API key|authentication|401|403|balance|suspended|quota|invalid_api_key|PERMISSION_DENIED/i.test(msg);

/** 云端模型不可用时自动切换为本地 Ollama，并持久化设置 */
export const fallbackToOllama = (activeModel: string, errorMessage: string) => {
    console.warn(`[AI] ${activeModel} 不可用（${errorMessage}），已自动切换到本地 Ollama`);
    localStorage.setItem(AI_MODEL_KEY, 'ollama');
};

export const getAIConfig = () => {
  return {
    // 默认使用本地 Ollama 模型
    model: localStorage.getItem(AI_MODEL_KEY) || 'ollama',
    // Ollama: 具体模型名称
    ollamaModel: localStorage.getItem(OLLAMA_MODEL_KEY) || DEFAULT_OLLAMA_MODEL,
    geminiKey: localStorage.getItem(GEMINI_KEY_KEY) || '',
    deepseekKey: localStorage.getItem(DEEPSEEK_KEY_KEY) || '',
    kimiKey: localStorage.getItem(KIMI_KEY_KEY) || ''
  };
};

/**
 * 创建 Gemini 客户端。未配置密钥时抛出可被识别的配置类错误，
 * 触发各调用点既有的自动回退 Ollama 逻辑。
 */
export const createGeminiClient = () => {
  const { geminiKey } = getAIConfig();
  if (!geminiKey) {
    throw new Error('Gemini API key 未配置，请在系统设置中填写');
  }
  return new GoogleGenAI({ apiKey: geminiKey });
};

/**
 * 获取本地 Ollama 已安装模型列表（经后端代理）
 */
export const fetchOllamaModels = async (): Promise<string[]> => {
  const token = getStoredToken();
  const res = await fetch('/api/ollama/models', {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || '无法连接 Ollama 服务');
  }
  return data.models || [];
};

/**
 * 调用本地 Ollama 模型（OpenAI 兼容接口，经后端 /api/ollama/chat 代理）
 */
export const callOllama = async (messages: any[], jsonMode: boolean = false) => {
  const config = getAIConfig();
  const token = getStoredToken();
  try {
    const response = await fetch('/api/ollama/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: messages,
        jsonMode: jsonMode
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Ollama API Error: ${response.status}`);
    }
    return data.content || '';
  } catch (error: any) {
    console.error("Ollama Request Failed:", error);
    if (error.message?.includes('Failed to fetch')) {
      throw new Error('后端服务未启动，无法代理 Ollama 请求，请先运行 npm run server');
    }
    throw error;
  }
};

export const callDeepSeek = async (messages: any[], jsonMode: boolean = false) => {
  const config = getAIConfig();
  if (!config.deepseekKey) throw new Error("DeepSeek API Key not configured. Please configure it in Settings.");
  
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.deepseekKey}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: messages,
            response_format: jsonMode ? { type: "json_object" } : undefined,
            temperature: 1.0
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `DeepSeek API Error: ${response.status}`;
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error && errorJson.error.message) {
                errorMsg = errorJson.error.message;
            }
        } catch (e) {
            // ignore parse error, use status text
            if (response.statusText) errorMsg += ` ${response.statusText}`;
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("DeepSeek Request Failed:", error);
    throw error;
  }
};

export const callKimi = async (messages: any[], jsonMode: boolean = false) => {
  const config = getAIConfig();
  if (!config.kimiKey) throw new Error("Kimi API Key not configured. Please configure it in Settings.");
  
  try {
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.kimiKey}`
        },
        body: JSON.stringify({
            model: "moonshot-v1-8k",
            messages: messages,
            response_format: jsonMode ? { type: "json_object" } : undefined,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Kimi API Error: ${response.status}`;
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error && errorJson.error.message) {
                errorMsg = errorJson.error.message;
            }
        } catch (e) {
            if (response.statusText) errorMsg += ` ${response.statusText}`;
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("Kimi Request Failed:", error);
    throw error;
  }
};
