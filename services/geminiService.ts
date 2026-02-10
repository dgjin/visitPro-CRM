import { GoogleGenAI, Type } from "@google/genai";
import { Visit, Sentiment } from "../types";

// Initialize Gemini Client
const getClient = () => {
  const apiKey = process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

/**
 * Analyzes raw visit notes to extract structured insights.
 */
export const analyzeVisitNote = async (noteContent: string, clientName: string) => {
  if (!process.env.API_KEY) {
    // Return mock data if no key for demo purposes
    return {
      summary: "模拟数据：客户对新产品线表现出浓厚兴趣，但对价格阶梯存有顾虑。",
      sentiment: Sentiment.Neutral,
      actionItems: ["发送报价单 PDF", "安排技术团队跟进会议"],
    };
  }

  const ai = getClient();
  
  const prompt = `
    你是一个专业的 CRM 助理。请分析客户 "${clientName}" 的以下拜访笔记。
    
    笔记内容: "${noteContent}"
    
    请返回一个 JSON 对象，包含：
    1. summary: 简洁的专业摘要（中文，不超过3句）。
    2. sentiment: 情感倾向，必须是 "积极" (Positive), "中性" (Neutral), "消极" (Negative) 之一。
    3. actionItems: 字符串数组，列出具体的下一步行动或待办事项（中文）。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            sentiment: { type: Type.STRING, enum: ["积极", "中性", "消极"] },
            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "sentiment", "actionItems"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze visit notes.");
  }
};

/**
 * Transcribes audio data to text using Gemini Multimodal capabilities.
 */
export const transcribeAudioNote = async (base64Audio: string, mimeType: string = 'audio/webm') => {
  if (!process.env.API_KEY) {
    return "（模拟转写）: 检测到录音，但未配置 API Key。请在系统设置中配置 Supabase 和 API Key 以启用真实 AI 功能。";
  }

  const ai = getClient();
  
  try {
    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025', // Specialized for audio
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          },
          {
            text: "请将这段会议录音逐字转写为中文文本。如果是对话，请区分发言人（如发言人1、发言人2）。只输出转写内容，不要包含任何解释性文字。"
          }
        ]
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw new Error("语音转文字失败，请检查网络或音频格式。");
  }
};

/**
 * Generates a follow-up email based on the visit.
 */
export const generateFollowUpEmail = async (visit: Visit, tone: 'Formal' | 'Casual' | 'Concise') => {
  if (!process.env.API_KEY) return `主题：关于拜访的跟进\n\n尊敬的 ${visit.clientName}：\n\n（这是模拟邮件，因为未检测到 API Key）。感谢您抽出时间与我会面。`;

  const ai = getClient();
  const prompt = `
    根据以下会议摘要，为客户 "${visit.clientName}" 写一封中文跟进邮件。
    语气风格：${tone}。
    
    会议摘要：
    "${visit.summary || visit.content}"
    
    邮件应包含以下行动项的确认：${visit.actionItems?.join(', ') || '一般跟进'}。
    请保留 [姓名] 和 [日期] 等占位符。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Email Gen Error:", error);
    return "生成邮件草稿失败。";
  }
};

/**
 * Generates a client profile analysis.
 */
export const generateClientProfile = async (clientName: string, industry: string, region: string) => {
  // Mock Data
  if (!process.env.API_KEY) return {
    financials: "模拟数据：第三季度表现强劲，同比增长 15%。现金流健康。",
    supplyChain: "模拟数据：主要供应商集中在东南亚地区，物流网络覆盖全国。",
    equity: [
      { name: "创始人团队", percentage: 40, type: "individual" },
      { name: "红杉资本", percentage: 25, type: "institution" },
      { name: "腾讯投资", percentage: 15, type: "institution" },
      { name: "公众持股", percentage: 20, type: "individual" }
    ]
  };

  const ai = getClient();
  const prompt = `
    生成一份关于位于 "${region}" 的 "${industry}" 行业公司 "${clientName}" 的虚构但逼真的企业画像分析（中文）。
    
    请返回一个 JSON 对象，包含：
    1. financials: 一段简短的财务趋势分析。
    2. supplyChain: 一段关于典型供应链结构的描述。
    3. equity: 一个数组，模拟可能的股权结构。包含 name (股东名), percentage (持股比例数字, 0-100), type ('individual' 或 'institution')。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
         responseSchema: {
          type: Type.OBJECT,
          properties: {
            financials: { type: Type.STRING },
            supplyChain: { type: Type.STRING },
            equity: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  percentage: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["individual", "institution"] }
                },
                required: ["name", "percentage"]
              }
            }
          },
          required: ["financials", "supplyChain", "equity"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Profile Gen Error:", error);
    throw error;
  }
};