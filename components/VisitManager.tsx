import React, { useState, useEffect, useRef } from 'react';
import { Visit, Client, Sentiment, CustomFieldDefinition, User, VisitRecording } from '../types';
import { analyzeVisitNote, generateFollowUpEmail } from '../services/geminiService';
import { IflytekStreamingSession, downsampleBuffer } from '../services/iflytekService';
import { upsertVisit, deleteVisit } from '../services/supabaseService';
import { 
  Calendar, 
  Mic, 
  Square,
  Save, 
  Sparkles, 
  Mail, 
  ChevronRight, 
  Loader2,
  Clock,
  CheckSquare,
  User as UserIcon,
  PlayCircle,
  Search,
  Trash2,
  Volume2,
  Wifi,
  RefreshCw,
  Bold,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface VisitManagerProps {
  visits: Visit[];
  setVisits: React.Dispatch<React.SetStateAction<Visit[]>>;
  clients: Client[];
  fieldDefinitions?: CustomFieldDefinition[];
  currentUser: User;
}

export const VisitManager: React.FC<VisitManagerProps> = ({ visits, setVisits, clients, fieldDefinitions = [], currentUser }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'EDITOR'>('LIST');
  const [currentVisit, setCurrentVisit] = useState<Partial<Visit>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'notes' | 'ai' | null>(null);
  
  // Client Search State
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false); // Ref to track recording state in closures
  const [recordingState, setRecordingState] = useState<'idle' | 'connecting' | 'recording'>('idle');
  const [currentAudioDuration, setCurrentAudioDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Refs for cleanup
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const iflytekSessionRef = useRef<IflytekStreamingSession | null>(null);
  
  // Editor Ref
  const editorRef = useRef<HTMLDivElement>(null);
  
  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentVisit.clientName) {
      setClientSearchTerm(currentVisit.clientName);
    } else {
      setClientSearchTerm('');
    }
  }, [currentVisit.id, currentVisit.clientName]);

  // Sync content to editor div when switching visits or external updates (like voice)
  useEffect(() => {
    if (editorRef.current) {
        // Prevent cursor jumping: Only update innerHTML if the editor is NOT focused, 
        // OR if the content is empty (initial load), 
        // OR if the content is significantly different (e.g. Voice update or new visit loaded)
        // AND we are not currently typing (simple check: if innerHTML matches state, do nothing)
        
        const shouldUpdate = 
            document.activeElement !== editorRef.current || 
            (editorRef.current.innerHTML !== currentVisit.content && isRecording); // Allow update if recording

        if (shouldUpdate && currentVisit.content !== undefined) {
            // Check if content is actually different to avoid unnecessary resets
            if (editorRef.current.innerHTML !== currentVisit.content) {
                editorRef.current.innerHTML = currentVisit.content;
            }
        } else if (currentVisit.content === undefined) {
             editorRef.current.innerHTML = '';
        }
    }
  }, [currentVisit.id, currentVisit.content, isRecording]);

  useEffect(() => {
    return () => {
      stopRecordingResources();
    };
  }, []);

  const getLocalISOString = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const startNewVisit = () => {
    setCurrentVisit({
      id: Date.now().toString(),
      date: getLocalISOString(),
      content: '',
      type: '线下拜访',
      clientName: '',
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      customFields: {},
      recordings: []
    });
    setClientSearchTerm('');
    setViewMode('EDITOR');
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // 1. Setup MediaRecorder (File)
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
        const base64Audio = await blobToBase64(audioBlob);
        
        const newRecording: VisitRecording = {
            id: Date.now().toString(),
            url: base64Audio,
            duration: currentAudioDuration,
            timestamp: new Date().toISOString()
        };

        setCurrentVisit(prev => ({
            ...prev,
            recordings: [...(prev.recordings || []), newRecording]
        }));
        
        setCurrentAudioDuration(0);
      };

      mediaRecorder.start();

      // 2. Setup AudioContext (Stream)
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      // Use buffer size 2048 for ~42ms latency @ 48kHz (closer to iFlytek's 40ms frame)
      // This improves real-time feel compared to 4096.
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = processor;

      setRecordingState('connecting');

      // 3. Setup iFlytek with Auto-Restart
      const initSession = () => {
        console.log("Initializing iFlytek Session...");
        const session = new IflytekStreamingSession(
          (text, isFinal) => {
             setCurrentVisit(prev => ({
                ...prev,
                // Append text. For Rich Text, we just append content.
                // The browser will render this text inside the div.
                content: (prev.content || '') + text
             }));
          },
          (err) => {
             console.error("Stream Error", err);
             // Don't alert on every error to avoid spamming if it's a transient network issue
             // The onClose will handle restart if needed
          },
          () => setRecordingState('recording'),
          () => {
             // Session closed (e.g. VAD timeout or Network close)
             // Check ref to see if user intends to keep recording
             if (isRecordingRef.current) {
                console.log("iFlytek Session Closed, Auto-Restarting...");
                setRecordingState('connecting'); // Update UI to show reconnecting
                setTimeout(() => {
                   if (isRecordingRef.current) {
                      iflytekSessionRef.current = initSession();
                   }
                }, 50);
             } else {
                console.log("iFlytek Session Closed normally.");
             }
          }
        );
        session.start();
        return session;
      };

      iflytekSessionRef.current = initSession();

      processor.onaudioprocess = (e) => {
        // Only process if session exists and is connected/connecting
        const inputData = e.inputBuffer.getChannelData(0); 
        const pcmData = downsampleBuffer(inputData, audioCtx.sampleRate);
        
        if (iflytekSessionRef.current) {
            iflytekSessionRef.current.send(pcmData);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination); 

      // Update State
      isRecordingRef.current = true;
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setCurrentAudioDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Mic Error:", err);
      alert(`无法访问麦克风: ${err.message}`);
      setRecordingState('idle');
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const stopRecordingResources = () => {
    isRecordingRef.current = false; // Important: set first to prevent auto-restart

    // Stop Media Recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop Stream Tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Stop Audio Processing
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    
    // Stop Session
    if (iflytekSessionRef.current) {
        iflytekSessionRef.current.stop();
        iflytekSessionRef.current = null;
    }

    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    setIsRecording(false);
    setRecordingState('idle');
  };

  const handleVoiceToggle = () => {
    if (isRecording) {
      stopRecordingResources();
    } else {
      startRecording();
    }
  };

  const handleDeleteRecording = (index: number, e: React.MouseEvent) => {
      // Use index instead of ID for more reliable deletion in local state
      e.stopPropagation();
      e.preventDefault();
      
      if(!window.confirm("确定要删除这条录音吗？此操作将永久移除该音频文件。")) return;
      
      setCurrentVisit(prev => {
          const updatedRecordings = [...(prev.recordings || [])];
          updatedRecordings.splice(index, 1);
          return {
              ...prev,
              recordings: updatedRecordings
          };
      });
  };

  const handleDeleteVisit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这条拜访记录吗？此操作无法撤销。")) return;
    
    setVisits(prev => prev.filter(v => v.id !== id));
    await deleteVisit(id);
    
    // If we are currently editing the visit we just deleted, go back to list
    if (viewMode === 'EDITOR' && currentVisit.id === id) {
      setViewMode('LIST');
      setCurrentVisit({});
    }
  };

  const handleSave = async () => {
    if (!currentVisit.clientId || !currentVisit.clientName) {
      alert("请搜索并选择一个客户。");
      return;
    }
    // Get content from ref to ensure latest HTML is saved
    const contentToSave = editorRef.current?.innerHTML || currentVisit.content || '';
    
    if (!contentToSave && (!currentVisit.recordings || currentVisit.recordings.length === 0)) {
      alert("请输入拜访笔记或录音。");
      return;
    }
    
    setIsSaving(true);
    try {
      const visitToSave: Visit = {
        id: currentVisit.id || Date.now().toString(),
        clientId: currentVisit.clientId,
        clientName: currentVisit.clientName,
        date: currentVisit.date || new Date().toISOString(),
        content: contentToSave,
        type: currentVisit.type || '线下拜访',
        location: currentVisit.location,
        clientParticipants: currentVisit.clientParticipants,
        ourParticipants: currentVisit.ourParticipants,
        ownerId: currentVisit.ownerId,
        ownerName: currentVisit.ownerName,
        recordings: currentVisit.recordings || [],
        // Explicitly clear legacy recordingData to prevent "zombie" recordings from reappearing after migration
        recordingData: null, 
        summary: currentVisit.summary,
        sentiment: currentVisit.sentiment,
        actionItems: currentVisit.actionItems,
        followUpDraft: currentVisit.followUpDraft,
        customFields: currentVisit.customFields || {}
      };

      await upsertVisit(visitToSave);

      setVisits(prev => {
        const index = prev.findIndex(v => v.id === visitToSave.id);
        if (index >= 0) {
          const newVisits = [...prev];
          newVisits[index] = visitToSave;
          return newVisits;
        } else {
          return [visitToSave, ...prev];
        }
      });

      setIsSaving(false);
      setViewMode('LIST');
    } catch (error) {
      console.error("Save failed", error);
      alert("保存失败，请检查网络或控制台日志。");
      setIsSaving(false);
    }
  };

  const handleAIAnalyze = async () => {
    // Strip HTML for analysis to avoid token waste and confusion
    const rawText = editorRef.current?.innerText || currentVisit.content || '';
    if (!rawText) return;
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeVisitNote(rawText, currentVisit.clientName || "Unknown");
      setCurrentVisit(prev => ({ ...prev, ...result }));
    } catch (e) {
      alert("AI 分析失败。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!currentVisit.summary) {
      alert("请先生成摘要。");
      return;
    }
    setIsGeneratingEmail(true);
    try {
      const email = await generateFollowUpEmail(currentVisit as Visit, 'Formal');
      setCurrentVisit(prev => ({ ...prev, followUpDraft: email }));
    } catch (e) {
      alert("邮件生成失败。");
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleFormat = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
        editorRef.current.focus();
        setCurrentVisit(prev => ({...prev, content: editorRef.current?.innerHTML || ''}));
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    c.industry.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  // LIST VIEW
  if (viewMode === 'LIST') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">拜访历史</h2>
          <button 
            onClick={startNewVisit}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center font-medium shadow-sm"
          >
            <Calendar className="w-5 h-5 mr-2" />
            新建拜访
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pb-20">
          {visits.map(visit => {
            const canDelete = currentUser?.role === '管理员' || (visit.ownerId && currentUser?.id === visit.ownerId);
            return (
              <div 
                key={visit.id}
                onClick={() => {
                  const dateObj = new Date(visit.date);
                  dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
                  const formattedDate = dateObj.toISOString().slice(0, 16);
                  
                  // Migrate old singular recording to array if needed
                  let recs = visit.recordings || [];
                  if (recs.length === 0 && visit.recordingData) {
                      recs = [{ id: 'legacy', url: visit.recordingData, timestamp: visit.date }];
                  }

                  setCurrentVisit({ ...visit, date: formattedDate, recordings: recs });
                  setViewMode('EDITOR');
                }}
                className="bg-white p-5 rounded-2xl border border-slate-100 hover:shadow-md cursor-pointer group transition-all relative"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-bold text-slate-800">{visit.clientName}</h3>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{visit.type}</span>
                      {(visit.recordings?.length ?? 0) > 0 && (
                          <span className="flex items-center text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            <Volume2 className="w-3 h-3 mr-1" /> {visit.recordings?.length}
                          </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 mt-2">
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(visit.date).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="flex items-center">
                            <UserIcon className="w-3 h-3 mr-1" />
                            {visit.ownerName || '未知'}
                          </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {visit.sentiment && (
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        visit.sentiment === Sentiment.Positive ? 'bg-green-100 text-green-700' :
                        visit.sentiment === Sentiment.Negative ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {visit.sentiment}
                      </span>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => handleDeleteVisit(visit.id, e)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="删除记录"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600 line-clamp-2">
                  {/* Strip HTML for list preview */}
                  {(visit.summary || visit.content || '').replace(/<[^>]+>/g, '')}
                </p>
              </div>
            );
          })}
          {visits.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p>暂无拜访记录</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // EDITOR MODE
  return (
    <div className="h-full flex flex-col animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
        <button 
          onClick={() => { stopRecordingResources(); setViewMode('LIST'); }}
          className="text-slate-500 hover:text-indigo-600 flex items-center text-sm font-medium"
        >
          <ChevronRight className="w-4 h-4 mr-1 rotate-180" /> 返回
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium disabled:opacity-70"
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isSaving ? '保存中...' : '保存记录'}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        
        {/* LEFT COLUMN: Input & Record */}
        <div className="flex flex-col h-full overflow-y-auto pr-2">
          
          {/* 1. Meta Fields */}
          <div className="space-y-4 mb-4">
             {/* Client Selection */}
             <div className="relative" ref={clientDropdownRef}>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">客户</label>
                 <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                   <input 
                     type="text"
                     className="w-full pl-9 pr-8 p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                     placeholder="搜索选择客户..."
                     value={clientSearchTerm}
                     onFocus={() => setIsClientDropdownOpen(true)}
                     onChange={(e) => {
                       setClientSearchTerm(e.target.value);
                       setIsClientDropdownOpen(true);
                       if (currentVisit.clientId && e.target.value !== currentVisit.clientName) {
                         setCurrentVisit(prev => ({ ...prev, clientId: undefined }));
                       }
                     }}
                   />
                   {isClientDropdownOpen && (
                     <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map(client => (
                            <div 
                              key={client.id}
                              className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                              onClick={() => {
                                setCurrentVisit(prev => ({ ...prev, clientId: client.id, clientName: client.name }));
                                setClientSearchTerm(client.name);
                                setIsClientDropdownOpen(false);
                              }}
                            >
                              <div className="font-medium text-slate-800 text-sm">{client.name}</div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-slate-400 text-xs">未找到相关客户</div>
                        )}
                     </div>
                   )}
                 </div>
             </div>

             {/* Type & Date */}
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">方式</label>
                   <select 
                     className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm"
                     value={currentVisit.type}
                     onChange={(e: any) => setCurrentVisit(prev => ({ ...prev, type: e.target.value }))}
                   >
                     <option>线下拜访</option>
                     <option>线上会议</option>
                     <option>电话沟通</option>
                     <option>客户到访</option>
                   </select>
                </div>
                <div>
                   <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-slate-500 uppercase">拜访时间</label>
                      <button 
                        onClick={() => setCurrentVisit(prev => ({ ...prev, date: getLocalISOString() }))}
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center font-medium"
                        title="设置为当前时间"
                      >
                         <RefreshCw className="w-3 h-3 mr-1" />
                         当前时间
                      </button>
                   </div>
                   <input 
                     type="datetime-local"
                     className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-sm"
                     value={currentVisit.date || ''}
                     onChange={(e) => setCurrentVisit(prev => ({ ...prev, date: e.target.value }))}
                   />
                </div>
             </div>
             
             {/* Custom Fields */}
             {fieldDefinitions.length > 0 && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {fieldDefinitions.map(field => (
                    <div key={field.id}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{field.label}</label>
                      <input 
                        className="w-full p-2 rounded-lg border border-slate-200 bg-white text-sm"
                        value={currentVisit.customFields?.[field.key] || ''}
                        onChange={(e) => setCurrentVisit(prev => ({
                          ...prev,
                          customFields: { ...prev.customFields, [field.key]: e.target.value }
                        }))}
                      />
                    </div>
                  ))}
                </div>
             )}
          </div>

          {/* 2. Recording List */}
          {(currentVisit.recordings?.length ?? 0) > 0 && (
              <div className="mb-4 space-y-2">
                 <label className="block text-xs font-semibold text-slate-500 uppercase">录音文件 ({currentVisit.recordings?.length})</label>
                 <div className="grid gap-2">
                    {currentVisit.recordings?.map((rec, index) => (
                        <div key={rec.id || index} className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                           <div className="flex items-center overflow-hidden">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-3 flex-shrink-0 text-indigo-600">
                                 <PlayCircle className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                 <p className="text-xs font-medium text-slate-700">录音 {index + 1}</p>
                                 <p className="text-[10px] text-slate-400">{rec.duration ? formatDuration(rec.duration) : '未知时长'} • {new Date(rec.timestamp).toLocaleTimeString()}</p>
                              </div>
                           </div>
                           <div className="flex items-center">
                              <audio src={rec.url} controls className="h-6 w-32 md:w-48 mr-2" />
                              <button 
                                type="button"
                                onClick={(e) => handleDeleteRecording(index, e)} 
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-3 flex-shrink-0 z-10 relative cursor-pointer"
                                title="删除此录音"
                              >
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                        </div>
                    ))}
                 </div>
              </div>
          )}

          {/* 3. Main Input (Rich Text Editor) */}
          <div className={`flex flex-col transition-all ${expandedSection === 'notes' ? 'fixed inset-0 z-50 bg-white p-6' : 'relative flex-1 min-h-[350px]'}`}>
             <div className="flex justify-between items-end mb-1">
               <label className="block text-xs font-semibold text-slate-500 uppercase">
                 拜访笔记 
                 {isRecording && (
                    <span className="ml-2 text-xs normal-case font-normal inline-flex items-center">
                       {recordingState === 'connecting' ? (
                          <span className="text-amber-500 animate-pulse flex items-center"><Wifi className="w-3 h-3 mr-1"/> 连接云端中...</span>
                       ) : (
                          <span className="text-red-500 animate-pulse flex items-center"><Mic className="w-3 h-3 mr-1"/> 正在转写 {formatDuration(currentAudioDuration)}</span>
                       )}
                    </span>
                 )}
               </label>
               <button 
                  onClick={() => setExpandedSection(expandedSection === 'notes' ? null : 'notes')}
                  className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100"
                  title={expandedSection === 'notes' ? "最小化" : "全屏编辑"}
               >
                  {expandedSection === 'notes' ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-3 h-3"/>}
               </button>
             </div>
             
             {/* Rich Text Toolbar & Editor */}
             <div className={`flex-1 flex flex-col border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all ${expandedSection === 'notes' ? 'shadow-2xl' : ''}`}>
                {/* Toolbar */}
                <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50">
                    <button 
                      onClick={(e) => { e.preventDefault(); handleFormat('bold'); }}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="Bold"
                      type="button"
                    >
                      <Bold className="w-4 h-4"/>
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleFormat('italic'); }}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="Italic"
                      type="button"
                    >
                      <Italic className="w-4 h-4"/>
                    </button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleFormat('insertUnorderedList'); }}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="Bullet List"
                      type="button"
                    >
                      <List className="w-4 h-4"/>
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleFormat('insertOrderedList'); }}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="Ordered List"
                      type="button"
                    >
                      <ListOrdered className="w-4 h-4"/>
                    </button>
                </div>
                
                {/* Editable Area */}
                <div 
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="flex-1 p-4 bg-white outline-none overflow-y-auto text-slate-700 leading-relaxed text-base [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
                  onInput={(e) => {
                     // Sync state on manual input
                     setCurrentVisit(prev => ({...prev, content: e.currentTarget.innerHTML}));
                  }}
                  onBlur={() => {
                     // Ensure state is synced on blur
                     if (editorRef.current) {
                        setCurrentVisit(prev => ({...prev, content: editorRef.current?.innerHTML || ''}));
                     }
                  }}
                  data-placeholder="开始输入，或点击右下角麦克风进行实时语音转写..."
                />
             </div>
             
             {/* Floating Record Button - Hide in full screen mode to avoid clutter or overlap issues */}
             {!expandedSection && (
               <button 
                 onClick={handleVoiceToggle}
                 className={`absolute bottom-4 right-4 p-4 rounded-full shadow-lg transition-all transform hover:scale-105 ${
                   isRecording 
                     ? 'bg-red-500 text-white shadow-red-200 ring-4 ring-red-100' 
                     : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                 }`}
                 title={isRecording ? "停止录音" : "开始录音转写"}
               >
                 {isRecording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
               </button>
             )}
          </div>
        </div>

        {/* RIGHT COLUMN: AI Insights */}
        <div className={`flex flex-col bg-slate-50 rounded-2xl border border-slate-200 p-6 overflow-y-auto transition-all ${expandedSection === 'ai' ? 'fixed inset-0 z-50 h-full' : 'h-full'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-indigo-600" /> AI 智能洞察
            </h3>
            <div className="flex space-x-2">
               <button 
                 onClick={handleAIAnalyze}
                 disabled={isAnalyzing || !currentVisit.content}
                 className="text-xs bg-white border border-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-50 disabled:opacity-50"
               >
                 {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : '生成分析'}
               </button>
               <button 
                  onClick={() => setExpandedSection(expandedSection === 'ai' ? null : 'ai')}
                  className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-slate-200"
                  title={expandedSection === 'ai' ? "最小化" : "全屏查看"}
               >
                  {expandedSection === 'ai' ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-4 h-4"/>}
               </button>
            </div>
          </div>

          {!currentVisit.summary ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
              <Sparkles className="w-8 h-8 mb-2 opacity-20" />
              <p>记录或输入笔记以解锁 AI 洞察</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in-up">
              {/* Summary */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">执行摘要</h4>
                <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                  {currentVisit.summary}
                </p>
              </div>

              {/* Sentiment */}
              <div>
                 <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">情感分析</h4>
                 <div className="flex items-center">
                    <div className={`flex-1 h-2 rounded-full bg-slate-200 overflow-hidden`}>
                       <div 
                         className={`h-full ${
                           currentVisit.sentiment === Sentiment.Positive ? 'bg-emerald-500 w-3/4' : 
                           currentVisit.sentiment === Sentiment.Negative ? 'bg-red-500 w-1/4' : 'bg-blue-400 w-1/2'
                         }`}
                       ></div>
                    </div>
                    <span className="ml-3 text-sm font-medium text-slate-700">{currentVisit.sentiment}</span>
                 </div>
              </div>

              {/* To-Dos */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">待办事项</h4>
                <div className="space-y-2">
                  {currentVisit.actionItems?.map((item, idx) => (
                    <div key={idx} className="flex items-start bg-white p-2 rounded-lg border border-slate-100">
                      <CheckSquare className="w-4 h-4 text-indigo-600 mt-0.5 mr-2 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email Generator */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex justify-between items-center mb-2">
                   <h4 className="text-xs font-bold text-slate-500 uppercase">跟进邮件草稿</h4>
                   <button 
                      onClick={handleGenerateEmail}
                      disabled={isGeneratingEmail}
                      className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                   >
                     {isGeneratingEmail ? '起草中...' : '生成邮件'}
                   </button>
                </div>
                {currentVisit.followUpDraft && (
                  <div className="relative">
                    <textarea 
                      readOnly
                      className="w-full h-32 text-xs bg-white p-3 rounded-lg border border-slate-100 text-slate-600 font-mono resize-none focus:outline-none"
                      value={currentVisit.followUpDraft}
                    />
                    <button className="absolute bottom-2 right-2 p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100">
                       <Mail className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};