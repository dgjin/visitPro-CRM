import React, { useState, useEffect, useRef } from 'react';
import { Visit, Client, Sentiment, CustomFieldDefinition, User, VisitRecording } from '../types';
import { analyzeVisitNote, generateFollowUpEmail } from '../services/geminiService';
import { IflytekStreamingSession, downsampleBuffer, IflytekError } from '../services/iflytekService';
import { upsertVisit, deleteVisit } from '../services/supabaseService';
import { 
  Calendar, 
  Mic, 
  Square,
  Save, 
  Sparkles, 
  Mail, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
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
  Minimize2,
  Phone,
  Video,
  MapPin,
  Filter,
  XCircle,
  Eye,
  FileText
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

// Custom Icon defined outside component to avoid conflicts/re-creation
const BuildingIcon = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
    <path d="M9 22v-4h6v4"/>
    <path d="M8 6h.01"/>
    <path d="M16 6h.01"/>
    <path d="M12 6h.01"/>
    <path d="M12 10h.01"/>
    <path d="M12 14h.01"/>
    <path d="M16 10h.01"/>
    <path d="M16 14h.01"/>
    <path d="M8 10h.01"/>
    <path d="M8 14h.01"/>
  </svg>
);

interface VisitManagerProps {
  visits: Visit[];
  setVisits: React.Dispatch<React.SetStateAction<Visit[]>>;
  clients: Client[];
  fieldDefinitions?: CustomFieldDefinition[];
  currentUser: User;
  initialVisitId?: string | null;
  onClearInitialVisit?: () => void;
  shouldCreateNew?: boolean;
  onResetTrigger?: () => void;
  initialSearchTerm?: string;
  draftVisit?: Partial<Visit> | null;
  onClearDraft?: () => void;
}

export const VisitManager: React.FC<VisitManagerProps> = ({ 
  visits, 
  setVisits, 
  clients, 
  fieldDefinitions = [], 
  currentUser,
  initialVisitId,
  onClearInitialVisit,
  shouldCreateNew,
  onResetTrigger,
  initialSearchTerm,
  draftVisit,
  onClearDraft
}) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'EDITOR'>('LIST');
  const [currentVisit, setCurrentVisit] = useState<Partial<Visit>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'notes' | 'ai' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // List View Filters
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Client Search State (Editor)
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Template Dropdown
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

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

  // Permission Logic
  const canEdit = (visit: Partial<Visit>) => {
      // New visit (no ID) -> Allow
      if (!visit.id) return true;
      // Admin -> Allow
      if (currentUser?.role === '管理员') return true;
      // Owner -> Allow
      if (visit.ownerId && currentUser?.id === visit.ownerId) return true;
      // Others -> Read Only
      return false;
  };

  const isReadOnly = currentVisit ? !canEdit(currentVisit) : false;

  // Handle Initial Visit ID (Deep Linking)
  useEffect(() => {
    if (initialVisitId) {
      const visit = visits.find(v => v.id === initialVisitId);
      if (visit) {
        const d = new Date(visit.date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        const formattedDate = d.toISOString().slice(0, 16);
        
        let recs = visit.recordings || [];
        if (recs.length === 0 && visit.recordingData) {
            recs = [{ id: 'legacy', url: visit.recordingData, timestamp: visit.date }];
        }

        setCurrentVisit({ ...visit, date: formattedDate, recordings: recs });
        setViewMode('EDITOR');
        
        if (onClearInitialVisit) {
            onClearInitialVisit();
        }
      }
    }
  }, [initialVisitId, visits, onClearInitialVisit]);

  // Handle Voice Trigger for new visit
  useEffect(() => {
    if (shouldCreateNew) {
      startNewVisit();
      if (onResetTrigger) onResetTrigger();
    }
  }, [shouldCreateNew, onResetTrigger]);

  // Handle Draft Visit (Smart Check-in)
  useEffect(() => {
      if (draftVisit) {
          startNewVisit(draftVisit);
          if (onClearDraft) onClearDraft();
      }
  }, [draftVisit]);

  // Handle Initial Search Term (Voice Command)
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setListSearchTerm(initialSearchTerm);
      if (initialSearchTerm) {
          setViewMode('LIST');
          setCurrentPage(1);
      }
    }
  }, [initialSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
      if (templateRef.current && !templateRef.current.contains(event.target as Node)) {
        setIsTemplateOpen(false);
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
    const editor = editorRef.current;
    if (editor) {
        const safeContent = currentVisit.content || '';
        
        // Prevent cursor jumping: Only update innerHTML if the editor is NOT focused, 
        // OR if the content is empty (initial load), 
        // OR if the content is significantly different (e.g. Voice update or new visit loaded)
        // AND we are not currently typing (simple check: if innerHTML matches state, do nothing)
        
        const shouldUpdate = 
            document.activeElement !== editor || 
            (editor.innerHTML !== safeContent && isRecording); // Allow update if recording

        if (shouldUpdate) {
            // Check if content is actually different to avoid unnecessary resets
            if (editor.innerHTML !== safeContent) {
                editor.innerHTML = safeContent;
            }
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

  const startNewVisit = (overrides?: Partial<Visit>) => {
    setCurrentVisit({
      id: '', // Empty ID indicates new
      date: getLocalISOString(),
      content: '',
      type: '线下拜访',
      clientName: '',
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      customFields: {},
      recordings: [],
      ...overrides
    });
    setClientSearchTerm(overrides?.clientName || '');
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

  const insertTemplate = (template: 'SPIN' | 'MEETING') => {
      if (isReadOnly) return;
      
      let html = '';
      if (template === 'SPIN') {
          html = `
            <p><b>背景问题 (Situation):</b></p><ul><li>客户目前的现状是...</li></ul>
            <p><b>难点问题 (Problem):</b></p><ul><li>遇到的主要挑战是...</li></ul>
            <p><b>暗示问题 (Implication):</b></p><ul><li>如果不解决，会导致...</li></ul>
            <p><b>需求-收益 (Need-Payoff):</b></p><ul><li>如果能解决，价值在于...</li></ul>
          `;
      } else {
          html = `
            <p><b>参会人:</b> </p>
            <p><b>会议目标:</b> </p>
            <p><b>核心决议:</b></p><ul><li>决议1</li></ul>
            <p><b>下一步计划:</b></p><ul><li>计划1 (负责人: , 截止: )</li></ul>
          `;
      }

      const editor = editorRef.current;
      if (editor) {
          editor.focus();
          document.execCommand('insertHTML', false, html);
          // Sync state
          setCurrentVisit(prev => ({...prev, content: editor.innerHTML}));
      }
      setIsTemplateOpen(false);
  };

  const startRecording = async () => {
    try {
      // Request Mic Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // --- 1. Audio Storage (MediaRecorder) ---
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handler for when saving stops
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

      // --- 2. Real-time Processing (AudioContext) ---
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      // Use buffer size 2048 for ~42ms latency @ 48kHz (closer to iFlytek's 40ms frame)
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = processor;

      setRecordingState('connecting');

      // --- 3. iFlytek Streaming Session ---
      const initSession = () => {
        console.log("Initializing iFlytek Session...");
        const session = new IflytekStreamingSession(
          (text, isFinal) => {
             // Intelligently append text
             setCurrentVisit(prev => {
                const prevContent = prev.content || '';
                // Avoid duplicating text if iFlytek sends corrections, 
                // but since we are append-only here, just append.
                return {
                    ...prev,
                    content: prevContent + text
                };
             });
          },
          (err) => {
             console.error("Stream Error", err);
             if (err instanceof IflytekError) {
                 if (err.isFatal) {
                     alert(`讯飞语音转写失败：${err.message}\n建议检查配置或套餐状态。`);
                     stopRecordingResources(); 
                     return;
                 } else {
                     console.warn(`Non-fatal error: ${err.message}. Retrying...`);
                 }
             }
          },
          () => setRecordingState('recording'),
          () => {
             if (isRecordingRef.current) {
                console.log("iFlytek Session Closed, Auto-Restarting...");
                setRecordingState('connecting');
                // Re-connect delay
                setTimeout(() => {
                   if (isRecordingRef.current) {
                      iflytekSessionRef.current = initSession();
                   }
                }, 100);
             }
          }
        );
        session.start();
        return session;
      };

      iflytekSessionRef.current = initSession();

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0); 
        // Clone to ensure we don't hold reference to buffer that might be recycled
        const dataClone = new Float32Array(inputData);
        // Convert Float32 audio to Int16 PCM
        const pcmData = downsampleBuffer(dataClone, audioCtx.sampleRate);
        
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
    isRecordingRef.current = false;

    // 1. Stop Saving File
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // 2. Stop Audio Context & Processor
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

    // 3. Stop Stream Tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // 4. Stop iFlytek Session
    if (iflytekSessionRef.current) {
        iflytekSessionRef.current.stop();
        iflytekSessionRef.current = null;
    }

    // 5. Cleanup UI
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    setIsRecording(false);
    setRecordingState('idle');
  };

  const handleVoiceToggle = () => {
    if(isReadOnly) return;
    if (isRecording) {
      stopRecordingResources();
    } else {
      startRecording();
    }
  };

  const handleDeleteRecording = (index: number) => {
      if(isReadOnly) return;
      // Confirm deletion
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

  const handleDeleteVisit = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("确定要删除这条拜访记录吗？此操作无法撤销。")) return;
    
    setVisits(prev => prev.filter(v => v.id !== id));
    
    if (viewMode === 'EDITOR' && currentVisit.id === id) {
      setViewMode('LIST');
      setCurrentVisit({});
    }

    await deleteVisit(id);
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    if (!currentVisit.clientId || !currentVisit.clientName) {
      alert("请搜索并选择一个客户。");
      return;
    }
    
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
        clientContact: currentVisit.clientContact,
        clientContactRole: currentVisit.clientContactRole,
        clientParticipants: currentVisit.clientParticipants,
        ourParticipants: currentVisit.ourParticipants,
        ownerId: currentVisit.ownerId,
        ownerName: currentVisit.ownerName,
        recordings: currentVisit.recordings || [],
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
    } catch (error: any) {
      console.error("Save failed", error);
      
      if (error.message && error.message.startsWith("PARTIAL_SUCCESS:")) {
         const msg = error.message.replace("PARTIAL_SUCCESS: ", "");
         alert(`⚠️ ${msg}\n\n建议联系管理员更新数据库结构。`);
         setIsSaving(false);
         setViewMode('LIST');
         
         const visitToSave: Visit = {
            id: currentVisit.id || Date.now().toString(),
            clientId: currentVisit.clientId!,
            clientName: currentVisit.clientName!,
            date: currentVisit.date || new Date().toISOString(),
            content: contentToSave,
            type: currentVisit.type || '线下拜访',
            location: currentVisit.location,
            clientContact: currentVisit.clientContact,
            clientContactRole: currentVisit.clientContactRole,
            clientParticipants: currentVisit.clientParticipants,
            ourParticipants: currentVisit.ourParticipants,
            ownerId: currentVisit.ownerId,
            ownerName: currentVisit.ownerName,
            recordings: currentVisit.recordings || [],
            recordingData: null, 
            summary: currentVisit.summary,
            sentiment: currentVisit.sentiment,
            actionItems: currentVisit.actionItems,
            followUpDraft: currentVisit.followUpDraft,
            customFields: currentVisit.customFields || {}
          };
          
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
         return;
      }
      
      alert("保存失败，请检查网络或控制台日志。");
      setIsSaving(false);
    }
  };

  const handleAIAnalyze = async () => {
    if(isReadOnly) return;
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
    if(isReadOnly) return;
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
    if(isReadOnly) return;
    document.execCommand(command, false);
    const editor = editorRef.current;
    if (editor) {
        editor.focus();
        const content = editor.innerHTML || '';
        setCurrentVisit(prev => ({...prev, content}));
    }
  };

  const filteredVisits = visits.filter(v => {
      const searchLower = listSearchTerm.toLowerCase();
      const matchSearch = 
        v.clientName.toLowerCase().includes(searchLower) || 
        (v.content || '').toLowerCase().includes(searchLower) ||
        (v.summary || '').toLowerCase().includes(searchLower) ||
        (v.ownerName || '').toLowerCase().includes(searchLower) ||
        (v.location || '').toLowerCase().includes(searchLower) ||
        (v.clientParticipants || '').toLowerCase().includes(searchLower) ||
        (v.clientContact || '').toLowerCase().includes(searchLower);
      
      const matchType = filterType === 'ALL' || v.type === filterType;
      
      let matchDate = true;
      if (startDate) {
          matchDate = matchDate && new Date(v.date) >= new Date(startDate);
      }
      if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchDate = matchDate && new Date(v.date) <= end;
      }
      
      return matchSearch && matchType && matchDate;
  });

  const totalPages = Math.ceil(filteredVisits.length / ITEMS_PER_PAGE);
  const paginatedVisits = filteredVisits.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    c.industry.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case '线上会议': return <Video className="w-4 h-4 text-blue-500" />;
      case '电话沟通': return <Phone className="w-4 h-4 text-emerald-500" />;
      case '客户到访': return <BuildingIcon className="w-4 h-4 text-amber-500" />;
      default: return <UserIcon className="w-4 h-4 text-indigo-500" />;
    }
  };

  // LIST VIEW
  if (viewMode === 'LIST') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">拜访历史</h2>
          <button 
            onClick={() => startNewVisit()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center font-medium shadow-sm"
          >
            <Calendar className="w-5 h-5 mr-2" />
            新建拜访
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
             {/* Search */}
             <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                 <input 
                     type="text"
                     placeholder="搜索客户、内容、人员、地点..."
                     className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                     value={listSearchTerm}
                     onChange={e => { setListSearchTerm(e.target.value); setCurrentPage(1); }}
                 />
             </div>
             
             {/* Type Filter */}
             <div className="relative">
                 <select
                     className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white text-slate-900"
                     value={filterType}
                     onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
                 >
                     <option value="ALL">所有类型</option>
                     <option value="线下拜访">线下拜访</option>
                     <option value="线上会议">线上会议</option>
                     <option value="电话沟通">电话沟通</option>
                     <option value="客户到访">客户到访</option>
                 </select>
                 <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
             </div>

             {/* Date Range */}
             <div className="md:col-span-2 flex items-center space-x-2">
                 <input 
                     type="date"
                     className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                     value={startDate}
                     onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }}
                     title="开始日期"
                 />
                 <span className="text-slate-400">-</span>
                 <input 
                     type="date"
                     className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                     value={endDate}
                     onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }}
                     title="结束日期"
                 />
                 {(startDate || endDate || listSearchTerm || filterType !== 'ALL') && (
                     <button 
                        onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            setListSearchTerm('');
                            setFilterType('ALL');
                            setCurrentPage(1);
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="重置筛选"
                     >
                        <XCircle className="w-5 h-5" />
                     </button>
                 )}
             </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {paginatedVisits.map((visit, index) => {
              const canEditVisit = canEdit(visit);
              const dateObj = new Date(visit.date);
              const day = dateObj.getDate();
              const month = dateObj.getMonth() + 1;
              const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div 
                  key={visit.id}
                  onClick={() => {
                    const d = new Date(visit.date);
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    const formattedDate = d.toISOString().slice(0, 16);
                    
                    let recs = visit.recordings || [];
                    if (recs.length === 0 && visit.recordingData) {
                        recs = [{ id: 'legacy', url: visit.recordingData, timestamp: visit.date }];
                    }

                    setCurrentVisit({ ...visit, date: formattedDate, recordings: recs });
                    setViewMode('EDITOR');
                  }}
                  className={`flex items-start p-4 hover:bg-slate-50 transition-colors cursor-pointer group border-b border-slate-50 last:border-0`}
                >
                   {/* Left: Time & Type */}
                   <div className="w-24 flex-shrink-0 flex flex-col items-center justify-center mr-4 border-r border-slate-100 pr-4">
                      <div className="text-xl font-bold text-slate-700 leading-none">{month}/{day}</div>
                      <div className="text-xs text-slate-400 mt-1 mb-2">{time}</div>
                      <div className="p-1.5 bg-slate-100 rounded-lg" title={visit.type}>
                        {getTypeIcon(visit.type)}
                      </div>
                   </div>

                   {/* Middle: Content */}
                   <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center mb-1">
                         <h3 className="font-bold text-slate-800 text-base truncate">{visit.clientName}</h3>
                         {visit.sentiment && (
                            <div className={`ml-2 h-2 w-2 rounded-full ${
                                visit.sentiment === Sentiment.Positive ? 'bg-emerald-500' :
                                visit.sentiment === Sentiment.Negative ? 'bg-red-500' : 'bg-slate-300'
                            }`} title={`情感倾向: ${visit.sentiment}`}></div>
                         )}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                         {visit.summary || visit.content?.replace(/<[^>]+>/g, '') || <span className="text-slate-300 italic">无内容</span>}
                      </p>
                      
                      <div className="flex items-center gap-3 mt-2">
                         {(visit.recordings?.length ?? 0) > 0 && (
                            <span className="flex items-center text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                               <Volume2 className="w-3 h-3 mr-1" /> {visit.recordings?.length}
                            </span>
                         )}
                         {visit.actionItems && visit.actionItems.length > 0 && (
                            <span className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                               <CheckSquare className="w-3 h-3 mr-1" /> {visit.actionItems.length} 待办
                            </span>
                         )}
                      </div>
                   </div>

                   {/* Right: Meta & Actions */}
                   <div className="w-32 flex-shrink-0 flex flex-col items-end justify-between self-stretch pl-4 border-l border-slate-50">
                      <div className="flex items-center text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                         <UserIcon className="w-3 h-3 mr-1" />
                         <span className="truncate max-w-[80px]">{visit.ownerName || 'Unknown'}</span>
                      </div>
                      
                      {canEditVisit ? (
                         <button
                           onClick={(e) => handleDeleteVisit(visit.id, e)}
                           className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                           title="删除记录"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      ) : (
                         <span className="opacity-0 group-hover:opacity-100 text-xs text-slate-300 flex items-center mt-2">
                            <Eye className="w-3 h-3 mr-1"/> 只读
                         </span>
                      )}
                   </div>
                </div>
              );
            })}
            {filteredVisits.length === 0 && (
              <div className="text-center py-20 text-slate-400">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p>暂无符合条件的拜访记录</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredVisits.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
               <span className="text-xs text-slate-500">
                  显示 {Math.min(filteredVisits.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} - {Math.min(filteredVisits.length, currentPage * ITEMS_PER_PAGE)} 共 {filteredVisits.length} 条
               </span>
               <div className="flex space-x-2">
                  <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs flex items-center px-2 font-medium text-slate-600">
                     {currentPage} / {totalPages}
                  </span>
                  <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages}
                     className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
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
        <div className="flex gap-2">
          {isReadOnly && (
              <span className="text-slate-400 text-xs flex items-center bg-slate-100 px-3 py-1 rounded-full mr-2">
                  <Eye className="w-3 h-3 mr-1" /> 您仅有查看权限
              </span>
          )}
          {currentVisit.id && visits.find(v => v.id === currentVisit.id) && !isReadOnly && (
            <button 
               onClick={() => currentVisit.id && handleDeleteVisit(currentVisit.id)}
               className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center text-sm font-medium transition-colors"
               title="删除记录"
            >
               <Trash2 className="w-4 h-4 mr-1" /> 删除
            </button>
          )}
          {!isReadOnly && (
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium disabled:opacity-70"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {isSaving ? '保存中...' : '保存记录'}
              </button>
          )}
        </div>
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
                     className="w-full pl-9 pr-8 p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                     placeholder="搜索选择客户..."
                     value={clientSearchTerm}
                     onFocus={() => !isReadOnly && setIsClientDropdownOpen(true)}
                     onChange={(e) => {
                       setClientSearchTerm(e.target.value);
                       setIsClientDropdownOpen(true);
                       if (currentVisit.clientId && e.target.value !== currentVisit.clientName) {
                         setCurrentVisit(prev => ({ ...prev, clientId: undefined }));
                       }
                     }}
                     disabled={isReadOnly}
                   />
                   {isClientDropdownOpen && !isReadOnly && (
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
                     className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                     value={currentVisit.type}
                     onChange={(e: any) => setCurrentVisit(prev => ({ ...prev, type: e.target.value }))}
                     disabled={isReadOnly}
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
                      {!isReadOnly && (
                          <button 
                            onClick={() => setCurrentVisit(prev => ({ ...prev, date: getLocalISOString() }))}
                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center font-medium"
                            title="设置为当前时间"
                          >
                             <RefreshCw className="w-3 h-3 mr-1" />
                             当前时间
                          </button>
                      )}
                   </div>
                   <input 
                     type="datetime-local"
                     className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                     value={currentVisit.date || ''}
                     onChange={(e) => setCurrentVisit(prev => ({ ...prev, date: e.target.value }))}
                     disabled={isReadOnly}
                   />
                </div>
             </div>
             
             {/* Participants & Location (Added Section) */}
             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-3">
                 {/* Location */}
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">拜访地点</label>
                    <div className="relative">
                       <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                       <input 
                          className="w-full pl-9 pr-3 p-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500"
                          placeholder="输入地址或会议室..."
                          value={currentVisit.location || ''}
                          onChange={(e) => setCurrentVisit(prev => ({ ...prev, location: e.target.value }))}
                          disabled={isReadOnly}
                       />
                    </div>
                 </div>

                 {/* Contact Person (New) */}
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">拜访对象</label>
                       <input 
                           className="w-full p-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500"
                           value={currentVisit.clientContact || ''}
                           placeholder="姓名"
                           onChange={(e) => setCurrentVisit(prev => ({ ...prev, clientContact: e.target.value }))}
                           disabled={isReadOnly}
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">职位</label>
                       <input 
                           className="w-full p-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500"
                           value={currentVisit.clientContactRole || ''}
                           placeholder="职位"
                           onChange={(e) => setCurrentVisit(prev => ({ ...prev, clientContactRole: e.target.value }))}
                           disabled={isReadOnly}
                       />
                    </div>
                 </div>

                 {/* Participants */}
                 <div className="grid grid-cols-2 gap-3">
                      <div>
                         <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">其他客户参与人</label>
                         <input 
                             className="w-full p-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500"
                             value={currentVisit.clientParticipants || ''}
                             placeholder="姓名, 职位..."
                             onChange={(e) => setCurrentVisit(prev => ({ ...prev, clientParticipants: e.target.value }))}
                             disabled={isReadOnly}
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">我方参与人</label>
                         <input 
                             className="w-full p-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500"
                             value={currentVisit.ourParticipants || ''}
                             placeholder="同事姓名..."
                             onChange={(e) => setCurrentVisit(prev => ({ ...prev, ourParticipants: e.target.value }))}
                             disabled={isReadOnly}
                         />
                      </div>
                 </div>
                 
                  {/* Owner */}
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">负责人 (录入人)</label>
                    <div className="flex items-center p-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm">
                        <UserIcon className="w-4 h-4 mr-2 text-slate-400" />
                        {currentVisit.ownerName || currentUser.name}
                    </div>
                 </div>
             </div>

             {/* Custom Fields - Optimized for Type Safety */}
             {fieldDefinitions.length > 0 && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {fieldDefinitions.map(field => (
                    <div key={field.id}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{field.label}</label>
                      {field.type === 'select' ? (
                         <select
                            className="w-full p-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                            value={currentVisit.customFields?.[field.key] || ''}
                            onChange={(e) => {
                                setCurrentVisit(prev => ({
                                  ...prev,
                                  customFields: { ...prev.customFields, [field.key]: e.target.value }
                                }));
                            }}
                            disabled={isReadOnly}
                         >
                            <option value="">请选择</option>
                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                         </select>
                      ) : (
                          <input 
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            className="w-full p-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                            value={currentVisit.customFields?.[field.key] || ''}
                            onChange={(e) => {
                                let val: any = e.target.value;
                                // Optimize: Cast number types to actual numbers
                                if (field.type === 'number') {
                                    val = val === '' ? null : Number(val);
                                }
                                setCurrentVisit(prev => ({
                                  ...prev,
                                  customFields: { ...prev.customFields, [field.key]: val }
                                }));
                            }}
                            disabled={isReadOnly}
                          />
                      )}
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
                              {!isReadOnly && (
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteRecording(index);
                                    }} 
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-3 flex-shrink-0 z-10 relative cursor-pointer"
                                    title="删除此录音"
                                  >
                                     <Trash2 className="w-4 h-4" />
                                  </button>
                              )}
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
                      className={`p-1.5 rounded text-slate-600 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200'}`} title="Bold"
                      type="button"
                      disabled={isReadOnly}
                    >
                      <Bold className="w-4 h-4"/>
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleFormat('italic'); }}
                      className={`p-1.5 rounded text-slate-600 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200'}`} title="Italic"
                      type="button"
                      disabled={isReadOnly}
                    >
                      <Italic className="w-4 h-4"/>
                    </button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleFormat('insertUnorderedList'); }}
                      className={`p-1.5 rounded text-slate-600 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200'}`} title="Bullet List"
                      type="button"
                      disabled={isReadOnly}
                    >
                      <List className="w-4 h-4"/>
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleFormat('insertOrderedList'); }}
                      className={`p-1.5 rounded text-slate-600 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200'}`} title="Ordered List"
                      type="button"
                      disabled={isReadOnly}
                    >
                      <ListOrdered className="w-4 h-4"/>
                    </button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    {/* Template Button */}
                    <div className="relative" ref={templateRef}>
                        <button 
                            onClick={(e) => { e.preventDefault(); !isReadOnly && setIsTemplateOpen(!isTemplateOpen); }}
                            className={`p-1.5 rounded text-slate-600 flex items-center ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200'}`}
                            title="Insert Template"
                            type="button"
                            disabled={isReadOnly}
                        >
                            <FileText className="w-4 h-4 mr-1"/> <span className="text-xs">模板</span>
                        </button>
                        {isTemplateOpen && !isReadOnly && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-100 rounded-lg shadow-xl z-20 w-32 py-1">
                                <button 
                                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => insertTemplate('SPIN')}
                                >
                                    SPIN 销售法
                                </button>
                                <button 
                                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => insertTemplate('MEETING')}
                                >
                                    会议纪要
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Editable Area */}
                <div 
                  ref={editorRef}
                  contentEditable={!isReadOnly}
                  suppressContentEditableWarning
                  className={`flex-1 p-4 bg-white outline-none overflow-y-auto text-slate-900 leading-relaxed text-base [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none ${isReadOnly ? 'cursor-default bg-slate-50' : ''}`}
                  onInput={(e) => {
                     // Sync state on manual input - capture value immediately to prevent stale event issues
                     const newContent = e.currentTarget.innerHTML;
                     setCurrentVisit(prev => ({...prev, content: newContent}));
                  }}
                  onBlur={(e) => {
                     // Ensure state is synced on blur - capture value immediately
                     const newContent = e.currentTarget.innerHTML;
                     setCurrentVisit(prev => ({...prev, content: newContent}));
                  }}
                  data-placeholder={isReadOnly ? "无内容" : "开始输入，或点击右下角麦克风进行实时语音转写..."}
                />
             </div>
             
             {/* Floating Record Button - Hide in full screen mode to avoid clutter or overlap issues */}
             {!expandedSection && !isReadOnly && (
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
               {!isReadOnly && (
                   <button 
                     onClick={handleAIAnalyze}
                     disabled={isAnalyzing || !currentVisit.content}
                     className="text-xs bg-white border border-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-50 disabled:opacity-50 flex items-center"
                   >
                     {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mr-1"/> : null}
                     {isAnalyzing ? '分析中...' : '生成分析'}
                   </button>
               )}
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
                   {!isReadOnly && (
                       <button 
                          onClick={handleGenerateEmail}
                          disabled={isGeneratingEmail}
                          className="text-xs text-indigo-600 hover:underline disabled:opacity-50 flex items-center"
                       >
                         {isGeneratingEmail ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                         {isGeneratingEmail ? '起草中...' : '生成邮件'}
                       </button>
                   )}
                </div>
                {currentVisit.followUpDraft && (
                  <div className="relative">
                    <textarea 
                      readOnly
                      className="w-full h-32 text-xs bg-white p-3 rounded-lg border border-slate-100 text-slate-800 font-mono resize-none focus:outline-none"
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