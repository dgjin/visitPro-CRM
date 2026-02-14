import { GoogleGenAI, Type } from "@google/genai";
import { generateSparkContent } from "./iflytekService";
import { Visit, Sentiment, AIModelType } from "../types";

const AI_MODEL_KEY = 'visitpro_ai_model';
const DEEPSEEK_KEY_KEY = 'visitpro_deepseek_key';

export const getAIConfig = () => {
  // STRICT ENV PRIORITY
  // Check process.env first for all keys. 
  // If present in env, it overrides any local setting.
  const envDeepSeekKey = process.env.DEEPSEEK_API_KEY;

  return {
    model: localStorage.getItem(AI_MODEL_KEY) || 'gemini',
    // API key exclusively from process.env for Gemini
    geminiKey: process.env.API_KEY, 
    // Deepseek: Env > LocalStorage
    deepseekKey: envDeepSeekKey || localStorage.getItem(DEEPSEEK_KEY_KEY) || ''
  };
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

/**
 * Transcribes audio data to text using Gemini.
 * @param base64Data Base64 encoded audio string (without data:audio/xxx;base64, prefix if possible, but SDK handles it mostly)
 * @param mimeType The mime type of the audio (e.g., 'audio/mp3', 'audio/webm')
 */
export const transcribeAudio = async (base64Data: string, mimeType: string = 'audio/webm') => {
  try {
      // Clean base64 string if it contains the data URL prefix
      const cleanBase64 = base64Data.replace(/^data:audio\/[a-z0-9]+;base64,/, "");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
              {
                  role: 'user',
                  parts: [
                      { 
                          inlineData: { 
                              mimeType: mimeType, 
                              data: cleanBase64 
                          } 
                      },
                      { text: "请将这段音频中的语音逐字转写为中文文本。请忽略语气词，直接输出内容，不要包含任何开场白或结束语。" }
                  ]
              }
          ]
      });

      return response.text || "";
  } catch (error) {
      console.error("Transcribe Audio Error:", error);
      throw new Error("语音转写失败，请确保网络连接正常或音频格式支持。");
  }
};

/**
 * Generates a client profile analysis.
 */
export const generateClientProfile = async (clientName: string, industry: string, region: string, modelOverride?: AIModelType) => {
  const config = getAIConfig();
  const activeModel = modelOverride || config.model;
  
  const systemPrompt = "你是一位资深的行业研究员和财务分析师，擅长通过财务数据和产业链结构挖掘企业价值。";
  const userPrompt = `
    生成一份关于位于 "${region}" 的 "${industry}" 行业公司 "${clientName}" 的虚构但逼真的企业画像分析（中文）。
    
    请严格返回一个 JSON 对象(不要包含 Markdown 代码块标记)，包含以下字段：

    1. financials: (String) 财务分析。**必须基于近三年（例如2021-2023）的财务报表数据进行分析**。请体现专业的财务分析逻辑，内容必须包含：
       - 关键财务指标趋势：列出近三年的营收、净利润、毛利率的具体数值（模拟）及复合增长率 (CAGR)。
       - 盈利能力分析：点评利润结构与成本控制。
       - 偿债与营运能力：简述流动比率、速动比率或应收账款周转天数等体现经营效率的指标。
       - 总结：一句话评价其财务健康度。

    2. supplyChain: (String) 供应链信息。**必须从专业产业链视角列出具体的上下游信息**。内容必须包含：
       - 上游端：明确列出该企业采购的**具体核心原材料、零部件或服务名称**，并列出 3-5 家该行业典型的**上游供应商企业名称**。
       - 下游端：明确列出该企业产品的**具体应用场景、销售渠道或成品名称**，并列出 3-5 家该行业典型的**下游客户企业名称**。

    3. equity: (Array) 一个数组，模拟可能的股东结构（上游）。包含 name (股东名), percentage (持股比例数字, 0-100), type ('individual' 或 'institution')。
    4. subsidiaries: (Array) 一个数组，模拟可能的对外投资/子公司（下游）。包含 name (子公司名), percentage (持股比例, 0-100), industry (行业)。
    
    5. tags: (Array) 基于以上分析，生成 5-8 个简短精准的标签（每个标签不超过6个字）。标签应涵盖以下维度：
       - 行业地位（如：行业龙头、市场挑战者、区域霸主）
       - 财务状况（如：现金流充裕、高负债、盈利能力强）
       - 舆情情况（如：口碑良好、产品争议、品牌溢价高）
       - 核心能力（如：研发强、渠道广、成本控制佳）
  `;

  try {
    let resultText = "{}";

    if (activeModel === 'deepseek') {
        resultText = await callDeepSeek([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ], true);
    } else if (activeModel === 'spark') {
        resultText = await generateSparkContent(systemPrompt + "\n" + userPrompt + "\n请直接返回JSON字符串。");
    } else {
        // Gemini
        // Always use process.env.API_KEY directly as per guidelines
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: systemPrompt,
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
                        },
                        subsidiaries: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    percentage: { type: Type.NUMBER },
                                    industry: { type: Type.STRING }
                                },
                                required: ["name", "percentage"]
                            }
                        },
                        tags: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["financials", "supplyChain", "equity", "subsidiaries", "tags"]
                }
            }
        });
        resultText = response.text || "{}";
    }

    // Cleaning logic
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(resultText);

  } catch (error) {
    console.error("AI Profile Gen Error:", error);
    // Return mock data for demo stability if AI fails
    return {
        financials: "模拟数据：\n\n【近三年财务摘要 (2021-2023)】\n1. 营收趋势：2021年 5.2亿 -> 2022年 6.8亿 -> 2023年 8.5亿，三年CAGR为27.8%，显示出强劲的市场扩张能力。\n2. 盈利能力：毛利率维持在 35%-38% 区间，2023年净利润率达到 12.5%，同比提升 1.5个百分点，得益于规模效应带来的成本摊薄。\n3. 营运效率：应收账款周转天数从 90天缩短至 75天，经营性现金流净额连续三年为正。\n\n总结：公司处于快速成长期，财务结构稳健，具备良好的抗风险能力。",
        supplyChain: "模拟数据：\n\n【上游供应链 (Raw Materials & Components)】\n- 核心采购：高性能芯片、工业级传感器、精密铝合金结构件。\n- 典型供应商：德州仪器 (TI)、博世 (Bosch)、南山铝业、汇川技术。\n\n【下游产业链 (Applications & Clients)】\n- 应用场景：新能源汽车制造、智能仓储物流中心、3C电子组装线。\n- 典型客户：比亚迪汽车、京东物流、立讯精密、宁德时代。",
        equity: [
            { name: "创始人团队", percentage: 40, type: "individual" },
            { name: "红杉资本", percentage: 25, type: "institution" },
        ],
        subsidiaries: [
            { name: "北京研发中心", percentage: 100, industry: "科技研发" },
            { name: "上海分公司", percentage: 100, industry: "销售" }
        ],
        tags: ["行业独角兽", "高成长性", "现金流充裕", "研发强劲", "供应链稳定", "品牌溢价高"]
    };
  }
};

export const analyzeVisitNote = async (note: string, clientName: string, modelOverride?: AIModelType) => {
    const config = getAIConfig();
    const activeModel = modelOverride || config.model;

    const systemPrompt = "你是一位专业的销售管理顾问。请分析拜访记录，提取关键信息。";
    const userPrompt = `
    请分析以下关于客户 "${clientName}" 的拜访记录：
    "${note}"

    请返回一个JSON对象，包含以下字段：
    1. summary (string): 100字以内的执行摘要。
    2. sentiment (string): 客户情感倾向，必须为 "积极"、"中性" 或 "消极" 之一。
    3. actionItems (string[]): 后续待办事项列表。
    `;

    try {
        let resultText = "{}";

        if (activeModel === 'deepseek') {
             resultText = await callDeepSeek([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
             ], true);
        } else if (activeModel === 'spark') {
             resultText = await generateSparkContent(systemPrompt + "\n" + userPrompt + "\n请直接返回JSON字符串。");
        } else {
             // Default to Gemini
             const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
             const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: [{ parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: systemPrompt,
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
             resultText = response.text || "{}";
        }
        
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(resultText);
    } catch (e: any) {
        console.error("Analyze Visit Error", e);
        // Fallback for when API fails (e.g. Insufficient Balance)
        return {
            summary: `(自动生成) 由于 ${activeModel} 服务暂时不可用或余额不足，无法生成智能摘要。原始记录片段：${note.substring(0, 100)}...`,
            sentiment: Sentiment.Neutral,
            actionItems: ["检查 AI 服务配置", "手动整理会议纪要"]
        };
    }
};

export const generateFollowUpEmail = async (visit: Visit, tone: string, modelOverride?: AIModelType) => {
    const config = getAIConfig();
    const activeModel = modelOverride || config.model;

    const systemPrompt = "你是一位专业的销售。请根据拜访记录写一封跟进邮件。";
    const userPrompt = `
    背景：
    客户：${visit.clientName}
    拜访内容摘要：${visit.summary || visit.content}
    待办事项：${visit.actionItems?.join(', ')}
    
    请撰写一封 ${tone === 'Formal' ? '正式' : '亲切'} 的跟进邮件。
    邮件应包含感谢语、会议回顾和后续步骤。
    请直接返回邮件正文，不要包含标题或其他解释。
    `;
    
    try {
        if (activeModel === 'deepseek') {
            return await callDeepSeek([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);
        } else if (activeModel === 'spark') {
            return await generateSparkContent(systemPrompt + "\n" + userPrompt);
        } else {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: [{ parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: systemPrompt
                }
            });
            return response.text;
        }
    } catch (e: any) {
        console.error("Email Gen Error", e);
        // Fallback email
        return `尊敬的 ${visit.clientName} 团队：\n\n您好！\n\n感谢您拨冗与我们会面。此次沟通非常有建设性。\n\n由于系统 AI 服务暂时繁忙，无法自动生成个性化邮件。我们会尽快整理详细方案并发送给您。\n\n如有任何疑问，请随时联系。\n\n祝好，\n\n${visit.ownerName || '销售团队'}`;
    }
};