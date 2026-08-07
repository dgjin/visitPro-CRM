import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Mic, Square, Sparkles, Loader2, X } from 'lucide-react';
import { getAIConfig } from '../services/geminiService';

interface VoiceCommand {
  action: 'NAVIGATE' | 'SEARCH' | 'CREATE_VISIT' | 'CREATE_CLIENT' | 'SWITCH_THEME' | 'UNKNOWN';
  parameters?: {
    view?: 'DASHBOARD' | 'CLIENTS' | 'VISITS' | 'ADMIN' | 'USERS' | 'DEPARTMENTS' | 'ROLES';
    query?: string;
    theme?: string;
  };
  transcript?: string;
}

interface VoiceAssistantProps {
  onCommand: (cmd: VoiceCommand) => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string>('点击麦克风开始说话');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioCommand(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
      setFeedback('正在聆听...');
    } catch (err) {
      console.error("Mic Error:", err);
      setFeedback('无法访问麦克风');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      setFeedback('正在分析指令...');
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data url prefix
        const base64 = base64String.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processAudioCommand = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const { geminiKey } = getAIConfig();
      if (!geminiKey) {
        setFeedback('请先在系统设置中配置 Gemini API Key');
        setIsProcessing(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
      const systemPrompt = `You are a CRM Voice Assistant. Analyze the user's audio command (in Chinese) and extract the intent into a JSON object.

Supported Actions:
1. NAVIGATE: Switch views (e.g. "Go to Dashboard", "Show users").
2. SEARCH: Search for a specific term (e.g. "Find client ABC").
3. CREATE_VISIT: User wants to add a new visit record.
4. CREATE_CLIENT: User wants to add a new client.
5. SWITCH_THEME: User wants to change color theme. Supported themes: indigo, blue, emerald, rose, amber, slate.

Output JSON Schema:
{
  "action": "NAVIGATE" | "SEARCH" | "CREATE_VISIT" | "CREATE_CLIENT" | "SWITCH_THEME" | "UNKNOWN",
  "parameters": {
     "view": "DASHBOARD" | "CLIENTS" | "VISITS" | "ADMIN" | "USERS" | "DEPARTMENTS" | "ROLES",
     "query": "string",
     "theme": "indigo" | "blue" | "emerald" | "rose" | "amber" | "slate"
  },
  "transcript": "string"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
                    { text: "Parse this command." }
                ]
            }
        ],
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    action: { type: Type.STRING, enum: ['NAVIGATE', 'SEARCH', 'CREATE_VISIT', 'CREATE_CLIENT', 'SWITCH_THEME', 'UNKNOWN'] },
                    parameters: {
                        type: Type.OBJECT,
                        properties: {
                            view: { type: Type.STRING, enum: ['DASHBOARD', 'CLIENTS', 'VISITS', 'ADMIN', 'USERS', 'DEPARTMENTS', 'ROLES'] },
                            query: { type: Type.STRING },
                            theme: { type: Type.STRING, enum: ['indigo', 'blue', 'emerald', 'rose', 'amber', 'slate'] }
                        }
                    },
                    transcript: { type: Type.STRING }
                },
                required: ['action', 'transcript']
            }
        }
      });

      const resultText = response.text;
      if (resultText) {
          const command = JSON.parse(resultText) as VoiceCommand;
          setFeedback(command.transcript || '指令已识别');
          
          setTimeout(() => {
              onCommand(command);
              setIsOpen(false); 
              setFeedback('点击麦克风开始说话');
          }, 1000);
      } else {
          setFeedback('无法识别指令');
      }

    } catch (e) {
      console.error("AI Processing Error", e);
      setFeedback('处理失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) {
      return (
        <button 
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50 hover:scale-105 animate-bounce-in"
            title="AI 语音助手"
        >
            <Sparkles className="w-6 h-6" />
        </button>
      );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end animate-scale-in origin-bottom-right">
       <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 p-4 w-72 mb-2">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-slate-800 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-indigo-600" />
                AI 助手
             </h3>
             <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
             </button>
          </div>
          
          <div className="bg-slate-50 rounded-xl p-4 min-h-[80px] flex items-center justify-center text-center mb-4 border border-slate-100">
             {isProcessing ? (
                 <div className="flex flex-col items-center text-indigo-600">
                     <Loader2 className="w-6 h-6 animate-spin mb-2" />
                     <span className="text-xs font-medium">正在理解您的意图...</span>
                 </div>
             ) : (
                 <p className="text-sm text-slate-600">{feedback}</p>
             )}
          </div>

          <div className="flex justify-center">
             <button
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessing}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md ${
                    isListening 
                    ? 'bg-red-500 text-white ring-4 ring-red-100 animate-pulse' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
                {isListening ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-8 h-8" />}
             </button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">
             试着说："切换到蓝色主题" 或 "查找客户张三"
          </p>
       </div>
    </div>
  );
};