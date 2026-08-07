import { Type } from "@google/genai";
import { generateSparkContent } from "./iflytekService";
import { isLocalAsrAvailable, transcribeAudioWithLocalAsr } from "./localAsrService";
import {
  getAIConfig,
  createGeminiClient,
  callOllama,
  callDeepSeek,
  callKimi,
  isProviderConfigError,
  fallbackToOllama,
  GEMINI_KEY_KEY,
} from "./aiProviders";
import { Visit, Sentiment, AIModelType } from "../types";

// 兼容性再导出：提供商配置与调用实现已迁移至 aiProviders.ts
export {
  getAIConfig,
  createGeminiClient,
  callOllama,
  callDeepSeek,
  callKimi,
  GEMINI_KEY_KEY,
  DEFAULT_OLLAMA_MODEL,
  fetchOllamaModels,
} from "./aiProviders";

/**
 * Transcribes audio data to text.
 * 统一使用本地 FunASR 服务（local-asr，SenseVoiceSmall 模型），不依赖云端。
 * @param base64Data Base64 encoded audio string (with or without data:audio/xxx;base64, prefix)
 * @param mimeType The mime type of the audio (e.g., 'audio/mp3', 'audio/webm')
 */
export const transcribeAudio = async (base64Data: string, mimeType: string = 'audio/webm') => {
  if (!(await isLocalAsrAvailable())) {
    throw new Error("语音转写失败：本地 FunASR 服务不可用，请确认 local-asr 服务已启动（默认端口 8321）。");
  }
  try {
      const result = await transcribeAudioWithLocalAsr(base64Data, mimeType);
      return result || "";
  } catch (error: any) {
      console.error("Transcribe Audio Error:", error);
      throw new Error(error.message || "语音转写失败：本地 FunASR 服务异常。");
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
    生成一份关于位于 "${region}" 的 "${industry}" 行业公司 "${clientName}" 的真实的企业画像分析（中文），一定要基于真实的数据，同时必须在底部注明数据的来源。
    
    请严格返回一个 JSON 对象(不要包含 Markdown 代码块标记)，包含以下字段：

    1. financials: (String) 财务分析。**必须基于近三年（例如2021-2023）的财务报表数据进行分析**。请体现专业的财务分析逻辑，内容必须包含：
       - 关键财务指标趋势：列出近三年的营收、净利润、毛利率的具体数值（真实数据）及复合增长率 (CAGR)。
       - 盈利能力分析：点评利润结构与成本控制。
       - 偿债与营运能力：简述流动比率、速动比率或应收账款周转天数等体现经营效率的指标。
       - 总结：一句话评价其财务健康度。

    2. supplyChain: (String) 供应链信息。**必须从专业产业链视角列出具体的上下游信息**。内容必须包含：
       - 上游端：明确列出该企业采购的**具体核心原材料、零部件或服务名称**，并列出 3-10 家该行业典型的**上游供应商企业名称**。
       - 下游端：明确列出该企业产品的**具体应用场景、销售渠道或成品名称**，并列出 3-10 家该行业典型的**下游客户企业名称**。

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

    if (activeModel === 'ollama') {
        resultText = await callOllama([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ], true);
    } else if (activeModel === 'deepseek') {
        resultText = await callDeepSeek([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ], true);
    } else if (activeModel === 'kimi') {
        resultText = await callKimi([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ], true);
    } else if (activeModel === 'spark') {
        resultText = await generateSparkContent(systemPrompt + "\n" + userPrompt + "\n请直接返回JSON字符串。");
    } else {
        // Gemini
        const ai = createGeminiClient();
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

  } catch (error: any) {
    console.error("AI Profile Gen Error:", error);
    
    // 解析具体的错误信息
    let errorMessage = error.message || '请检查AI配置和网络连接';
    if (activeModel !== 'ollama' && isProviderConfigError(errorMessage)) {
        fallbackToOllama(activeModel, errorMessage);
        return generateClientProfile(clientName, industry, region, 'ollama');
    }
    let suggestion = '';
    
    if (errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('503')) {
      errorMessage = 'Gemini模型当前需求量过高，暂时不可用';
      suggestion = '建议：请切换到DeepSeek、Kimi或讯飞星火模型，或稍后重试';
    } else if (errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
      errorMessage = 'API密钥无效或已过期';
      suggestion = '建议：请检查系统设置中的API密钥配置';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      errorMessage = '请求过于频繁，已达到速率限制';
      suggestion = '建议：请稍等片刻后重试，或切换到其他模型';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')) {
      errorMessage = '网络连接失败';
      suggestion = '建议：请检查网络连接，或稍后重试';
    }
    
    const fullMessage = suggestion ? `${errorMessage}。${suggestion}` : `AI分析失败: ${errorMessage}`;
    throw new Error(fullMessage);
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

        if (activeModel === 'ollama') {
             resultText = await callOllama([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
             ], true);
        } else if (activeModel === 'deepseek') {
             resultText = await callDeepSeek([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
             ], true);
        } else if (activeModel === 'kimi') {
             resultText = await callKimi([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
             ], true);
        } else if (activeModel === 'spark') {
             resultText = await generateSparkContent(systemPrompt + "\n" + userPrompt + "\n请直接返回JSON字符串。");
        } else {
             // Default to Gemini
             const ai = createGeminiClient();
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
        
        // 解析具体的错误信息
        let errorMessage = e.message || `${activeModel} 服务暂时不可用`;
        if (activeModel !== 'ollama' && isProviderConfigError(errorMessage)) {
            fallbackToOllama(activeModel, errorMessage);
            return analyzeVisitNote(note, clientName, 'ollama');
        }
        let suggestion = '';
        
        if (errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('503')) {
            errorMessage = 'Gemini模型当前需求量过高，暂时不可用';
            suggestion = '建议：请切换到DeepSeek、Kimi或讯飞星火模型，或稍后重试';
        } else if (errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
            errorMessage = 'API密钥无效或已过期';
            suggestion = '建议：请检查系统设置中的API密钥配置';
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
            errorMessage = '请求过于频繁，已达到速率限制';
            suggestion = '建议：请稍等片刻后重试，或切换到其他模型';
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')) {
            errorMessage = '网络连接失败';
            suggestion = '建议：请检查网络连接，或稍后重试';
        }
        
        const fullMessage = suggestion ? `${errorMessage}。${suggestion}` : `AI分析失败: ${errorMessage}`;
        throw new Error(fullMessage);
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
        if (activeModel === 'ollama') {
            return await callOllama([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);
        } else if (activeModel === 'deepseek') {
            return await callDeepSeek([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);
        } else if (activeModel === 'kimi') {
            return await callKimi([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);
        } else if (activeModel === 'spark') {
            return await generateSparkContent(systemPrompt + "\n" + userPrompt);
        } else {
            const ai = createGeminiClient();
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
        
        // 解析具体的错误信息
        let errorMessage = e.message || '请检查AI配置和网络连接';
        if (activeModel !== 'ollama' && isProviderConfigError(errorMessage)) {
            fallbackToOllama(activeModel, errorMessage);
            return generateFollowUpEmail(visit, tone, 'ollama');
        }
        let suggestion = '';
        
        // 处理Gemini模型的高需求错误
        if (errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('503')) {
            errorMessage = 'Gemini模型当前需求量过高，暂时不可用';
            suggestion = '建议：请切换到DeepSeek、Kimi或讯飞星火模型，或稍后重试';
        }
        // 处理API Key错误
        else if (errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
            errorMessage = 'API密钥无效或已过期';
            suggestion = '建议：请检查系统设置中的API密钥配置';
        }
        // 处理速率限制错误
        else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
            errorMessage = '请求过于频繁，已达到速率限制';
            suggestion = '建议：请稍等片刻后重试，或切换到其他模型';
        }
        // 处理网络错误
        else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')) {
            errorMessage = '网络连接失败';
            suggestion = '建议：请检查网络连接，或稍后重试';
        }
        
        const fullMessage = suggestion ? `${errorMessage}。${suggestion}` : `邮件生成失败: ${errorMessage}`;
        throw new Error(fullMessage);
    }
};

/**
 * Organize voice transcript content into structured visit note
 * This function takes raw voice-to-text content and organizes it into a well-structured visit record
 */
export const organizeVoiceTranscript = async (transcript: string, clientName: string, modelOverride?: AIModelType) => {
    const config = getAIConfig();
    const activeModel = modelOverride || config.model;

    const systemPrompt = "你是一位专业的销售助理，擅长整理和结构化语音转文字的拜访记录。请将杂乱的语音转文字内容整理成清晰、专业的拜访记录。";
    const userPrompt = `
    请将以下语音转文字的拜访记录进行整理和优化：

    客户名称：${clientName}
    原始语音转文字内容：
    """
    ${transcript}
    """

    请对内容进行以下处理：
    1. 去除语气词、重复词和无意义的填充词（如"嗯"、"啊"、"那个"、"然后"等）
    2. 修正明显的语音识别错误（如错别字、标点错误）
    3. 将内容组织成结构化的拜访记录，包括：
       - 会议基本信息（时间、地点、参与人员）
       - 客户背景和需求
       - 讨论的主要议题
       - 达成的共识和决策
       - 下一步行动计划
    4. 保持原始信息完整性，不添加未提及的内容
    5. 使用专业、简洁的语言风格

    请返回一个JSON对象，包含以下字段：
    1. organizedContent (string): 整理后的完整拜访记录内容，使用Markdown格式
    2. summary (string): 100字以内的执行摘要
    3. sentiment (string): 客户情感倾向，必须为 "积极"、"中性" 或 "消极" 之一
    4. actionItems (string[]): 后续待办事项列表
    5. keyPoints (string[]): 讨论的关键要点列表
    `;

    try {
        let resultText = "{}";

        if (activeModel === 'ollama') {
             resultText = await callOllama([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
             ], true);
        } else if (activeModel === 'deepseek') {
             resultText = await callDeepSeek([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
             ], true);
        } else if (activeModel === 'kimi') {
             resultText = await callKimi([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
             ], true);
        } else if (activeModel === 'spark') {
             resultText = await generateSparkContent(systemPrompt + "\n" + userPrompt + "\n请直接返回JSON字符串。");
        } else {
             // Default to Gemini
             const ai = createGeminiClient();
             const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: [{ parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            organizedContent: { type: Type.STRING },
                            summary: { type: Type.STRING },
                            sentiment: { type: Type.STRING, enum: ["积极", "中性", "消极"] },
                            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["organizedContent", "summary", "sentiment", "actionItems", "keyPoints"]
                    }
                }
             });
             resultText = response.text || "{}";
        }
        
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(resultText);
    } catch (e: any) {
        console.error("Organize Voice Transcript Error", e);
        
        // 解析具体的错误信息
        let errorMessage = e.message || `${activeModel} 服务暂时不可用`;
        if (activeModel !== 'ollama' && isProviderConfigError(errorMessage)) {
            fallbackToOllama(activeModel, errorMessage);
            return organizeVoiceTranscript(transcript, clientName, 'ollama');
        }
        let suggestion = '';
        
        if (errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('503')) {
            errorMessage = 'Gemini模型当前需求量过高，暂时不可用';
            suggestion = '建议：请切换到DeepSeek、Kimi或讯飞星火模型，或稍后重试';
        } else if (errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
            errorMessage = 'API密钥无效或已过期';
            suggestion = '建议：请检查系统设置中的API密钥配置';
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
            errorMessage = '请求过于频繁，已达到速率限制';
            suggestion = '建议：请稍等片刻后重试，或切换到其他模型';
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')) {
            errorMessage = '网络连接失败';
            suggestion = '建议：请检查网络连接，或稍后重试';
        }
        
        const fullMessage = suggestion ? `${errorMessage}。${suggestion}` : `语音内容整理失败: ${errorMessage}`;
        throw new Error(fullMessage);
    }
};