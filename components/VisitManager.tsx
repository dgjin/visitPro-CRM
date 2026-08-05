import React, { useState, useEffect, useRef } from 'react';
import { Visit, Client, Sentiment, CustomFieldDefinition, User, VisitRecording, AIModelType } from '../types';
import { analyzeVisitNote, generateFollowUpEmail, transcribeAudio, organizeVoiceTranscript } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import CopyButton from './CopyButton';
import { IflytekStreamingSession, downsampleBuffer, IflytekError } from '../services/iflytekService';
import { upsertVisit, deleteVisit } from '../services/apiService';
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
  FileText,
  Upload,
  FileAudio,
  BrainCircuit,
  Plus,
  Clock,
  Building2,
  ArrowLeft,
  MoreHorizontal,
  StickyNote,
  BarChart3,
  Edit3
} from 'lucide-react';
import VisitListView, { getSentimentDotClass } from './VisitListView';

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
  
  // Client Search State (Editor)
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Template Dropdown
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [recordingState, setRecordingState] = useState<'idle' | 'connecting' | 'recording'>('idle');
  const [currentAudioDuration, setCurrentAudioDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  
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
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [autoOrganizeEnabled, setAutoOrganizeEnabled] = useState(true); // 自动整理开关
  const [selectedAiModel, setSelectedAiModel] = useState<AIModelType>('ollama');
  
  // Markdown Editor State
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);

  // Load default model from local storage
  useEffect(() => {
      const savedModel = localStorage.getItem('visitpro_ai_model') as AIModelType;
      if (savedModel) {
          setSelectedAiModel(savedModel);
      }
  }, []);

  // Permission Logic
  const canEdit = (visit: Partial<Visit>) => {
      if (!visit.id) return true;
      if (currentUser?.role === '管理员') return true;
      if (visit.ownerId && currentUser?.id === visit.ownerId) return true;
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
    if (initialSearchTerm) {
      setViewMode('LIST');
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

  // Sync content to editor div when switching visits or external updates
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
        const safeContent = currentVisit.content || '';
        const shouldUpdate = 
            document.activeElement !== editor || 
            (editor.innerHTML !== safeContent && isRecording);

        if (shouldUpdate) {
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
      id: '',
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
          setCurrentVisit(prev => ({...prev, content: editor.innerHTML}));
      }
      setIsTemplateOpen(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 25 * 1024 * 1024) {
          alert("文件过大。请上传小于 25MB 的音频文件。");
          return;
      }
      
      try {
          const base64Audio = await blobToBase64(file);
          
          const newRecording: VisitRecording = {
              id: Date.now().toString(),
              url: base64Audio,
              duration: 0,
              timestamp: new Date().toISOString()
          };

          setCurrentVisit(prev => ({
              ...prev,
              recordings: [...(prev.recordings || []), newRecording]
          }));
          
          if (fileInputRef.current) fileInputRef.current.value = '';
          
      } catch (e) {
          console.error("File upload failed", e);
          alert("文件读取失败");
      }
  };

  const handleTranscribeAudio = async (recording: VisitRecording) => {
      if (isReadOnly) return;
      
      setTranscribingId(recording.id);
      try {
          const text = await transcribeAudio(recording.url);
          
          if (text) {
             const newContent = (currentVisit.content || '') + `<p><b>[语音转写 ${new Date().toLocaleTimeString()}]</b>: ${text}</p>`;
             setCurrentVisit(prev => ({ ...prev, content: newContent }));
          } else {
             alert("未能识别到有效语音。");
          }
      } catch (e: any) {
          alert(`转写失败: ${e.message}`);
      } finally {
          setTranscribingId(null);
      }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
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

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = processor;

      setRecordingState('connecting');

      const initSession = () => {
        const session = new IflytekStreamingSession(
          (text, isFinal) => {
             setCurrentVisit(prev => {
                const prevContent = prev.content || '';
                return {
                    ...prev,
                    content: prevContent + text
                };
             });
          },
          (err) => {
             console.error("Stream Error", err);
          },
          () => setRecordingState('recording'),
          () => {
             if (isRecordingRef.current) {
                setRecordingState('connecting');
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
        const dataClone = new Float32Array(inputData);
        const pcmData = downsampleBuffer(dataClone, audioCtx.sampleRate);
        
        if (iflytekSessionRef.current) {
            iflytekSessionRef.current.send(pcmData);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination); 

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

  const stopRecordingResources = async () => {
    isRecordingRef.current = false;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

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

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
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
    
    // Auto-organize voice transcript after recording stops
    if (autoOrganizeEnabled && !isReadOnly) {
      // Wait a moment for the final transcription to be inserted
      setTimeout(async () => {
        const currentContent = editorRef.current?.innerText || currentVisit.content || '';
        if (currentContent && currentContent.length > 50) { // Only organize if there's substantial content
          await handleOrganizeVoiceTranscript();
        }
      }, 1000);
    }
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
      const result = await analyzeVisitNote(rawText, currentVisit.clientName || "Unknown", selectedAiModel);
      setCurrentVisit(prev => ({ ...prev, ...result }));
    } catch (e: any) {
      alert(e.message || "AI 分析失败，请检查AI配置和网络连接。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOrganizeVoiceTranscript = async () => {
    if(isReadOnly) return;
    const rawText = editorRef.current?.innerText || currentVisit.content || '';
    if (!rawText) {
      alert("请先输入或录制拜访笔记内容。");
      return;
    }
    
    setIsOrganizing(true);
    try {
      const result = await organizeVoiceTranscript(rawText, currentVisit.clientName || "Unknown", selectedAiModel);
      
      // Update the visit with organized content
      setCurrentVisit(prev => ({ 
        ...prev, 
        content: result.organizedContent,
        summary: result.summary,
        sentiment: result.sentiment as Sentiment,
        actionItems: result.actionItems
      }));
      
      // Update editor content
      if (editorRef.current) {
        editorRef.current.innerHTML = result.organizedContent.replace(/\n/g, '<br>');
      }
      
      alert("语音内容整理完成！已自动更新拜访记录。");
    } catch (e: any) {
      alert(e.message || "语音内容整理失败，请检查AI配置和网络连接。");
    } finally {
      setIsOrganizing(false);
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
      const email = await generateFollowUpEmail(currentVisit as Visit, 'Formal', selectedAiModel);
      setCurrentVisit(prev => ({ ...prev, followUpDraft: email }));
    } catch (e: any) {
      alert(e.message || "邮件生成失败，请检查AI配置和网络连接。");
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const formatDuration = (sec: number) => {
    if (!sec) return '文件上传';
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

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    c.industry.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const openVisit = (visit: Visit) => {
    const d = new Date(visit.date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    const formattedDate = d.toISOString().slice(0, 16);

    let recs = visit.recordings || [];
    if (recs.length === 0 && visit.recordingData) {
      recs = [{ id: 'legacy', url: visit.recordingData, timestamp: visit.date }];
    }

    setCurrentVisit({ ...visit, date: formattedDate, recordings: recs });
    setViewMode('EDITOR');
  };

  // LIST VIEW
  if (viewMode === 'LIST') {
    return (
      <VisitListView
        visits={visits}
        currentUser={currentUser}
        initialSearchTerm={initialSearchTerm}
        onOpenVisit={openVisit}
        onNewVisit={() => startNewVisit()}
        onDeleteVisit={handleDeleteVisit}
      />
    );
  }

  // EDITOR MODE
  return (
    <div className="h-full flex flex-col animate-fade-in-up">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border)'
      }}>
        <button 
          onClick={() => { stopRecordingResources(); setViewMode('LIST'); }}
          className="btn btn-ghost"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isReadOnly && (
            <span className="badge badge-info">
              <Eye className="w-3 h-3" />
              只读模式
            </span>
          )}
          
          {currentVisit.id && visits.find(v => v.id === currentVisit.id) && !isReadOnly && (
            <button 
              onClick={() => currentVisit.id && handleDeleteVisit(currentVisit.id)}
              className="btn btn-danger"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          )}
          
          {!isReadOnly && (
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary"
              style={{ opacity: isSaving ? 0.7 : 1 }}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? '保存中...' : '保存记录'}
            </button>
          )}
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: expandedSection === 'notes' ? '1fr 0px' : 
                            expandedSection === 'ai' ? '0px 1fr' : 
                            'repeat(auto-fit, minmax(400px, 1fr))',
        gap: expandedSection ? '0px' : '24px',
        flex: 1,
        overflow: 'hidden',
        transition: 'all var(--transition-slow)'
      }}>
        
        {/* LEFT COLUMN: Input & Record */}
        <div style={{ 
          display: expandedSection === 'ai' ? 'none' : 'flex',
          flexDirection: 'column', 
          height: '100%', 
          overflowY: 'auto',
          paddingRight: expandedSection === 'notes' ? '0px' : '8px',
          opacity: expandedSection === 'ai' ? 0 : 1,
          transition: 'opacity var(--transition)'
        }}>
          
          {/* Section 1: Basic Info Card */}
          <div style={{ 
            background: 'var(--bg-primary)', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--text-primary)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <UserIcon className="w-4 h-4" style={{ color: 'var(--primary-500)' }} />
              基本信息
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Client Selection */}
              <div ref={clientDropdownRef}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  color: 'var(--text-secondary)', 
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}>客户 *</label>
                <div style={{ position: 'relative' }}>
                  <Search style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: 'var(--text-tertiary)', 
                    width: '16px', 
                    height: '16px' 
                  }} />
                  <input 
                    type="text"
                    className="input"
                    style={{ paddingLeft: '40px' }}
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
                    <div style={{ 
                      position: 'absolute', 
                      top: 'calc(100% + 4px)', 
                      left: 0, 
                      right: 0, 
                      background: 'var(--bg-primary)', 
                      border: '1px solid var(--border-light)', 
                      borderRadius: 'var(--radius)', 
                      boxShadow: 'var(--shadow-lg)', 
                      zIndex: 20, 
                      maxHeight: '240px', 
                      overflowY: 'auto'
                    }}>
                      {filteredClients.length > 0 ? (
                        filteredClients.map(client => (
                          <div 
                            key={client.id}
                            style={{ 
                              padding: '12px 16px', 
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-light)',
                              transition: 'background var(--transition-fast)'
                            }}
                            className="hover:bg-slate-50"
                            onClick={() => {
                              setCurrentVisit(prev => ({ ...prev, clientId: client.id, clientName: client.name }));
                              setClientSearchTerm(client.name);
                              setIsClientDropdownOpen(false);
                            }}
                          >
                            <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>{client.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{client.industry}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                          未找到相关客户
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Type & Date Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)', 
                    textTransform: 'uppercase',
                    marginBottom: '6px'
                  }}>拜访方式</label>
                  <select 
                    className="input"
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: 'var(--text-secondary)', 
                      textTransform: 'uppercase'
                    }}>拜访时间</label>
                    {!isReadOnly && (
                      <button 
                        onClick={() => setCurrentVisit(prev => ({ ...prev, date: getLocalISOString() }))}
                        style={{ fontSize: '11px', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        className="btn-ghost"
                      >
                        <RefreshCw className="w-3 h-3" />
                        当前
                      </button>
                    )}
                  </div>
                  <input 
                    type="datetime-local"
                    className="input"
                    value={currentVisit.date || ''}
                    onChange={(e) => setCurrentVisit(prev => ({ ...prev, date: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Visit Details Card */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-light)',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--text-primary)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <MapPin className="w-4 h-4" style={{ color: 'var(--primary-500)' }} />
              拜访详情
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Location */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  color: 'var(--text-secondary)', 
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}>拜访地点</label>
                <div style={{ position: 'relative' }}>
                  <MapPin style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: 'var(--text-tertiary)', 
                    width: '16px', 
                    height: '16px' 
                  }} />
                  <input 
                    className="input"
                    style={{ paddingLeft: '40px', background: 'var(--bg-primary)' }}
                    placeholder="输入地址或会议室..."
                    value={currentVisit.location || ''}
                    onChange={(e) => setCurrentVisit(prev => ({ ...prev, location: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Contact Person */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)', 
                    textTransform: 'uppercase',
                    marginBottom: '6px'
                  }}>拜访对象</label>
                  <input 
                    className="input"
                    style={{ background: 'var(--bg-primary)' }}
                    value={currentVisit.clientContact || ''}
                    placeholder="姓名"
                    onChange={(e) => setCurrentVisit(prev => ({ ...prev, clientContact: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)', 
                    textTransform: 'uppercase',
                    marginBottom: '6px'
                  }}>职位</label>
                  <input 
                    className="input"
                    style={{ background: 'var(--bg-primary)' }}
                    value={currentVisit.clientContactRole || ''}
                    placeholder="职位"
                    onChange={(e) => setCurrentVisit(prev => ({ ...prev, clientContactRole: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Participants */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)', 
                    textTransform: 'uppercase',
                    marginBottom: '6px'
                  }}>其他客户参与人</label>
                  <input 
                    className="input"
                    style={{ background: 'var(--bg-primary)' }}
                    value={currentVisit.clientParticipants || ''}
                    placeholder="姓名, 职位..."
                    onChange={(e) => setCurrentVisit(prev => ({ ...prev, clientParticipants: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)', 
                    textTransform: 'uppercase',
                    marginBottom: '6px'
                  }}>我方参与人</label>
                  <input 
                    className="input"
                    style={{ background: 'var(--bg-primary)' }}
                    value={currentVisit.ourParticipants || ''}
                    placeholder="同事姓名..."
                    onChange={(e) => setCurrentVisit(prev => ({ ...prev, ourParticipants: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
              
              {/* Owner */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  color: 'var(--text-secondary)', 
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}>负责人 (录入人)</label>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '10px 14px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  color: 'var(--text-secondary)'
                }}>
                  <UserIcon className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  {currentVisit.ownerName || currentUser.name}
                </div>
              </div>
            </div>
          </div>

          {/* Custom Fields */}
          {fieldDefinitions.length > 0 && (
            <div style={{ 
              background: 'var(--bg-secondary)', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-light)',
              padding: '20px',
              marginBottom: '16px'
            }}>
              <h3 style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: 'var(--text-primary)',
                marginBottom: '16px'
              }}>
                自定义字段
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {fieldDefinitions.map(field => (
                  <div key={field.id}>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: 'var(--text-secondary)', 
                      textTransform: 'uppercase',
                      marginBottom: '6px'
                    }}>{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        className="input"
                        style={{ background: 'var(--bg-primary)' }}
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
                        className="input"
                        style={{ background: 'var(--bg-primary)' }}
                        value={currentVisit.customFields?.[field.key] || ''}
                        onChange={(e) => {
                            let val: any = e.target.value;
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
            </div>
          )}

          {/* Section 3: Recording List */}
          {(currentVisit.recordings?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: 'var(--text-primary)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Volume2 className="w-4 h-4" style={{ color: 'var(--primary-500)' }} />
                录音文件 ({currentVisit.recordings?.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentVisit.recordings?.map((rec, index) => (
                  <div 
                    key={rec.id || index} 
                    style={{ 
                      background: 'var(--bg-primary)', 
                      border: '1px solid var(--border-light)', 
                      borderRadius: 'var(--radius-md)', 
                      padding: '16px',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '50%', 
                          background: 'var(--primary-50)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: 'var(--primary-600)'
                        }}>
                          <PlayCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            录音 {index + 1}
                          </p>
                          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            {new Date(rec.timestamp).toLocaleString('zh-CN', {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})} 
                            {rec.duration ? ` • ${formatDuration(rec.duration)}` : ''}
                          </p>
                        </div>
                      </div>
                      {!isReadOnly && (
                        <button 
                          onClick={() => handleDeleteRecording(index)}
                          style={{ 
                            padding: '8px', 
                            color: 'var(--text-tertiary)', 
                            borderRadius: 'var(--radius)',
                            transition: 'all var(--transition-fast)'
                          }}
                          className="btn-danger"
                          title="删除此录音"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <audio src={rec.url} controls style={{ width: '100%', height: '40px', marginBottom: '12px' }} />
                    
                    {!isReadOnly && (
                      <button 
                        onClick={() => handleTranscribeAudio(rec)}
                        disabled={transcribingId === rec.id}
                        className="btn"
                        style={{ 
                          width: '100%',
                          background: transcribingId === rec.id ? 'var(--bg-tertiary)' : 'var(--success-light)',
                          color: transcribingId === rec.id ? 'var(--text-tertiary)' : '#065f46',
                          border: `1px solid ${transcribingId === rec.id ? 'var(--border)' : 'var(--success)'}`,
                          opacity: transcribingId === rec.id ? 0.7 : 1,
                          fontSize: '13px'
                        }}
                      >
                        {transcribingId === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        {transcribingId === rec.id ? '科大讯飞转写中...' : '转写为文字 (科大讯飞)'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Rich Text Editor */}
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            minHeight: expandedSection === 'notes' ? 'auto' : '350px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '8px'
            }}>
              <label style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: 'var(--text-secondary)', 
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <StickyNote className="w-4 h-4" />
                拜访笔记 (支持 Markdown)
                {isRecording && (
                  <span style={{ 
                    marginLeft: '12px', 
                    fontSize: '13px', 
                    textTransform: 'none', 
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: recordingState === 'connecting' ? '#FEF3C7' : '#FEE2E2',
                    border: `1px solid ${recordingState === 'connecting' ? '#FCD34D' : '#FECACA'}`
                  }}>
                    {recordingState === 'connecting' ? (
                      <span style={{ color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Wifi className="w-3.5 h-3.5 animate-pulse" /> 连接科大讯飞云端中...
                      </span>
                    ) : (
                      <span style={{ color: '#991B1B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          background: '#EF4444',
                          borderRadius: '50%',
                          animation: 'pulse 1.5s ease-in-out infinite'
                        }} />
                        实时转写中 {formatDuration(currentAudioDuration)}
                      </span>
                    )}
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Markdown Preview Toggle */}
                {!isReadOnly && (
                  <button 
                    onClick={() => setIsMarkdownPreview(!isMarkdownPreview)}
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: 'var(--radius-sm)', 
                      color: isMarkdownPreview ? 'var(--primary-600)' : 'var(--text-secondary)',
                      background: isMarkdownPreview ? 'var(--primary-50)' : 'transparent',
                      border: `1px solid ${isMarkdownPreview ? 'var(--primary-300)' : 'var(--border)'}`,
                      fontSize: '12px',
                      fontWeight: 500,
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={isMarkdownPreview ? "切换到编辑模式" : "切换到预览模式"}
                  >
                    {isMarkdownPreview ? <Edit3 className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                    {isMarkdownPreview ? '编辑' : '预览'}
                  </button>
                )}
                <button 
                  onClick={() => setExpandedSection(expandedSection === 'notes' ? null : 'notes')}
                  style={{ 
                    padding: '6px', 
                    color: 'var(--text-tertiary)', 
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all var(--transition-fast)'
                  }}
                  className="btn-ghost"
                  title={expandedSection === 'notes' ? "最小化" : "全屏编辑"}
                >
                  {expandedSection === 'notes' ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            
            {/* Rich Text Toolbar & Editor */}
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden',
              background: 'var(--bg-primary)'
            }}>
              {/* Modern Toolbar */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                padding: '10px 12px', 
                borderBottom: '1px solid var(--border-light)', 
                background: 'var(--bg-tertiary)',
                flexWrap: 'wrap'
              }}>
                <button 
                  onClick={(e) => { e.preventDefault(); handleFormat('bold'); }}
                  style={{ 
                    padding: '8px', 
                    borderRadius: 'var(--radius-sm)', 
                    color: 'var(--text-secondary)',
                    opacity: isReadOnly ? 0.5 : 1,
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className={!isReadOnly ? 'btn-ghost' : ''}
                  title="加粗"
                  type="button"
                  disabled={isReadOnly}
                >
                  <Bold className="w-4 h-4"/>
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); handleFormat('italic'); }}
                  style={{ 
                    padding: '8px', 
                    borderRadius: 'var(--radius-sm)', 
                    color: 'var(--text-secondary)',
                    opacity: isReadOnly ? 0.5 : 1,
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className={!isReadOnly ? 'btn-ghost' : ''}
                  title="斜体"
                  type="button"
                  disabled={isReadOnly}
                >
                  <Italic className="w-4 h-4"/>
                </button>
                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
                <button 
                  onClick={(e) => { e.preventDefault(); handleFormat('insertUnorderedList'); }}
                  style={{ 
                    padding: '8px', 
                    borderRadius: 'var(--radius-sm)', 
                    color: 'var(--text-secondary)',
                    opacity: isReadOnly ? 0.5 : 1,
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className={!isReadOnly ? 'btn-ghost' : ''}
                  title="无序列表"
                  type="button"
                  disabled={isReadOnly}
                >
                  <List className="w-4 h-4"/>
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); handleFormat('insertOrderedList'); }}
                  style={{ 
                    padding: '8px', 
                    borderRadius: 'var(--radius-sm)', 
                    color: 'var(--text-secondary)',
                    opacity: isReadOnly ? 0.5 : 1,
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className={!isReadOnly ? 'btn-ghost' : ''}
                  title="有序列表"
                  type="button"
                  disabled={isReadOnly}
                >
                  <ListOrdered className="w-4 h-4"/>
                </button>
                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
                
                {/* Voice Input Button - iFlytek Real-time Voice Input */}
                <button 
                  onClick={handleVoiceToggle}
                  disabled={isReadOnly}
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: 'var(--radius-sm)', 
                    color: isRecording ? '#EF4444' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    opacity: isReadOnly ? 0.5 : 1,
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)',
                    background: isRecording ? '#FEE2E2' : 'transparent',
                    border: isRecording ? '1px solid #FECACA' : 'none'
                  }}
                  className={!isReadOnly ? 'btn-ghost' : ''}
                  title={isRecording ? "停止录音 (科大讯飞实时转写)" : "开始录音 (科大讯飞实时转写)"}
                  type="button"
                >
                  {isRecording ? (
                    <>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        background: '#EF4444',
                        borderRadius: '50%',
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }} />
                      <Square className="w-4 h-4" fill="currentColor" />
                      <span>停止录音</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>语音录入</span>
                    </>
                  )}
                </button>
                
                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
                
                {/* Upload Button */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: 'var(--radius-sm)', 
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    opacity: isReadOnly || isRecording ? 0.5 : 1,
                    cursor: isReadOnly || isRecording ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className={!isReadOnly && !isRecording ? 'btn-ghost' : ''}
                  title="上传录音文件"
                  type="button"
                  disabled={isReadOnly || isRecording}
                >
                  <Upload className="w-4 h-4"/>
                  <span>上传录音</span>
                </button>
                <input 
                  type="file" 
                  accept="audio/*" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload}
                />
                
                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
                
                {/* Template Dropdown */}
                <div ref={templateRef} style={{ position: 'relative' }}>
                  <button 
                    onClick={(e) => { e.preventDefault(); !isReadOnly && setIsTemplateOpen(!isTemplateOpen); }}
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: 'var(--radius-sm)', 
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '13px',
                      opacity: isReadOnly ? 0.5 : 1,
                      cursor: isReadOnly ? 'not-allowed' : 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    className={!isReadOnly ? 'btn-ghost' : ''}
                    title="插入模板"
                    type="button"
                    disabled={isReadOnly}
                  >
                    <FileText className="w-4 h-4"/> 模板
                  </button>
                  {isTemplateOpen && !isReadOnly && (
                    <div style={{ 
                      position: 'absolute', 
                      top: 'calc(100% + 4px)', 
                      left: 0, 
                      background: 'var(--bg-primary)', 
                      border: '1px solid var(--border-light)', 
                      borderRadius: 'var(--radius)', 
                      boxShadow: 'var(--shadow-lg)', 
                      zIndex: 20, 
                      minWidth: '140px',
                      overflow: 'hidden'
                    }}>
                      <button 
                        style={{ 
                          display: 'block', 
                          width: '100%', 
                          textAlign: 'left', 
                          padding: '10px 14px', 
                          fontSize: '13px', 
                          color: 'var(--text-primary)',
                          transition: 'background var(--transition-fast)',
                          borderBottom: '1px solid var(--border-light)'
                        }}
                        className="hover:bg-slate-50"
                        onClick={() => insertTemplate('SPIN')}
                      >
                        SPIN 销售法
                      </button>
                      <button 
                        style={{ 
                          display: 'block', 
                          width: '100%', 
                          textAlign: 'left', 
                          padding: '10px 14px', 
                          fontSize: '13px', 
                          color: 'var(--text-primary)',
                          transition: 'background var(--transition-fast)'
                        }}
                        className="hover:bg-slate-50"
                        onClick={() => insertTemplate('MEETING')}
                      >
                        会议纪要
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Editable Area or Markdown Preview */}
              {isMarkdownPreview && !isReadOnly ? (
                /* Markdown Preview Mode */
                <div 
                  style={{ 
                    flex: 1, 
                    padding: '16px', 
                    background: 'var(--bg-primary)', 
                    outline: 'none', 
                    overflowY: 'auto',
                    color: 'var(--text-primary)',
                    lineHeight: 1.7,
                    fontSize: '15px'
                  }}
                >
                  {currentVisit.content ? (
                    <MarkdownRenderer content={currentVisit.content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')} />
                  ) : (
                    <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>暂无内容</p>
                  )}
                </div>
              ) : (
                /* Edit Mode */
                <div 
                  ref={editorRef}
                  contentEditable={!isReadOnly}
                  suppressContentEditableWarning
                  style={{ 
                    flex: 1, 
                    padding: '16px', 
                    background: 'var(--bg-primary)', 
                    outline: 'none', 
                    overflowY: 'auto',
                    color: 'var(--text-primary)',
                    lineHeight: 1.7,
                    fontSize: '15px',
                    cursor: isReadOnly ? 'default' : 'text'
                  }}
                  onInput={(e) => {
                     const newContent = e.currentTarget.innerHTML;
                     setCurrentVisit(prev => ({...prev, content: newContent}));
                  }}
                  onBlur={(e) => {
                     const newContent = e.currentTarget.innerHTML;
                     setCurrentVisit(prev => ({...prev, content: newContent}));
                  }}
                  data-placeholder={isReadOnly ? "无内容" : "开始输入拜访笔记，或使用工具栏中的语音录入功能进行实时语音转文字..."}
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI Insights */}
        <div style={{ 
          background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--bg-secondary) 100%)', 
          borderRadius: expandedSection === 'ai' ? '0' : 'var(--radius-md)', 
          border: '1px solid var(--primary-200)',
          boxShadow: 'var(--shadow)',
          padding: expandedSection === 'ai' ? '24px 48px' : '24px', 
          overflowY: 'auto',
          display: expandedSection === 'notes' ? 'none' : 'flex',
          flexDirection: 'column',
          opacity: expandedSection === 'notes' ? 0 : 1,
          transition: 'all var(--transition)'
        }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--primary-100)'
          }}>
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: 700, 
              color: 'var(--primary-800)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: 'var(--radius)', 
                background: 'var(--primary-600)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white'
              }}>
                <Sparkles className="w-5 h-5" />
              </div>
              AI 智能洞察
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Model Selector */}
              {!isReadOnly && (
                <select 
                  value={selectedAiModel}
                  onChange={(e) => setSelectedAiModel(e.target.value as AIModelType)}
                  style={{ 
                    fontSize: '12px', 
                    background: 'var(--bg-primary)', 
                    border: '1px solid var(--primary-200)', 
                    color: 'var(--primary-700)', 
                    padding: '6px 10px', 
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  title="选择分析模型"
                >
                  <option value="ollama">Ollama (本地)</option>
                  <option value="gemini">Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="spark">讯飞星火</option>
                  <option value="kimi">Kimi</option>
                </select>
              )}

              <button 
                onClick={() => setExpandedSection(expandedSection === 'ai' ? null : 'ai')}
                style={{ 
                  padding: '6px', 
                  color: 'var(--primary-600)', 
                  borderRadius: 'var(--radius-sm)',
                  transition: 'all var(--transition-fast)'
                }}
                className="btn-ghost"
                title={expandedSection === 'ai' ? "最小化" : "全屏查看"}
              >
                {expandedSection === 'ai' ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-4 h-4"/>}
              </button>
            </div>
          </div>
          
          {/* Analyze Buttons */}
          {!isReadOnly && (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={handleAIAnalyze}
                disabled={isAnalyzing || !currentVisit.content}
                className="btn"
                style={{ 
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--primary-300)',
                  color: 'var(--primary-700)',
                  fontWeight: 600,
                  opacity: (isAnalyzing || !currentVisit.content) ? 0.6 : 1,
                  cursor: (isAnalyzing || !currentVisit.content) ? 'not-allowed' : 'pointer'
                }}
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <BrainCircuit className="w-4 h-4"/>}
                {isAnalyzing ? `正在使用 ${selectedAiModel} 分析...` : '开始智能分析'}
              </button>
            </div>
          )}

          {!currentVisit.summary ? (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'var(--text-tertiary)', 
              fontSize: '14px',
              border: '2px dashed var(--primary-200)',
              borderRadius: 'var(--radius-md)',
              padding: '40px',
              textAlign: 'center'
            }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: 'var(--primary-100)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <BarChart3 className="w-8 h-8" style={{ color: 'var(--primary-400)' }} />
              </div>
              <p style={{ fontWeight: 500, marginBottom: '4px' }}>记录或输入笔记以解锁 AI 洞察</p>
              <p style={{ fontSize: '13px' }}>AI 将自动生成摘要、情感分析和待办事项</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in-up">
              {/* Summary Card */}
              <div style={{ 
                background: 'var(--bg-primary)', 
                borderRadius: 'var(--radius)', 
                padding: '16px',
                border: '1px solid var(--primary-100)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: 'var(--primary-600)', 
                  textTransform: 'uppercase',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <FileText className="w-3 h-3" />
                  执行摘要
                </h4>
                <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                  {currentVisit.summary}
                </p>
              </div>

              {/* Sentiment Card */}
              <div style={{ 
                background: 'var(--bg-primary)', 
                borderRadius: 'var(--radius)', 
                padding: '16px',
                border: '1px solid var(--primary-100)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: 'var(--primary-600)', 
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <div 
                    className={getSentimentDotClass(currentVisit.sentiment)}
                    style={{ 
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: currentVisit.sentiment === Sentiment.Positive ? 'var(--success)' : 
                                 currentVisit.sentiment === Sentiment.Negative ? 'var(--danger)' : 'var(--text-tertiary)'
                    }}
                  />
                  情感分析
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    flex: 1, 
                    height: '8px', 
                    borderRadius: 'var(--radius-full)', 
                    background: 'var(--bg-tertiary)',
                    overflow: 'hidden'
                  }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        borderRadius: 'var(--radius-full)',
                        background: currentVisit.sentiment === Sentiment.Positive ? 'var(--success)' : 
                                   currentVisit.sentiment === Sentiment.Negative ? 'var(--danger)' : 'var(--primary-400)',
                        width: currentVisit.sentiment === Sentiment.Positive ? '75%' : 
                               currentVisit.sentiment === Sentiment.Negative ? '25%' : '50%',
                        transition: 'width var(--transition-slow)'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', minWidth: '40px' }}>
                    {currentVisit.sentiment}
                  </span>
                </div>
              </div>

              {/* To-Dos Card */}
              <div style={{ 
                background: 'var(--bg-primary)', 
                borderRadius: 'var(--radius)', 
                padding: '16px',
                border: '1px solid var(--primary-100)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: 'var(--primary-600)', 
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <CheckSquare className="w-3 h-3" />
                  待办事项
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentVisit.actionItems?.map((item, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '10px',
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-light)'
                      }}
                    >
                      <div style={{ 
                        width: '20px', 
                        height: '20px', 
                        borderRadius: '4px', 
                        background: 'var(--primary-100)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--primary-600)',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        <CheckSquare className="w-3.5 h-3.5" />
                      </div>
                      <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email Generator Card */}
              <div style={{ 
                background: 'var(--bg-primary)', 
                borderRadius: 'var(--radius)', 
                padding: '16px',
                border: '1px solid var(--primary-100)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: 'var(--primary-600)', 
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Mail className="w-3 h-3" />
                    跟进邮件草稿
                  </h4>
                  {!isReadOnly && (
                    <button 
                      onClick={handleGenerateEmail}
                      disabled={isGeneratingEmail}
                      style={{ 
                        fontSize: '12px', 
                        color: 'var(--primary-600)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        opacity: isGeneratingEmail ? 0.6 : 1,
                        cursor: isGeneratingEmail ? 'not-allowed' : 'pointer'
                      }}
                      className="btn-ghost"
                    >
                      {isGeneratingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {isGeneratingEmail ? '起草中...' : '生成邮件'}
                    </button>
                  )}
                </div>
                {currentVisit.followUpDraft && (
                  <div style={{ position: 'relative' }}>
                    <textarea 
                      readOnly
                      style={{ 
                        width: '100%', 
                        height: expandedSection === 'ai' ? '300px' : '120px', 
                        fontSize: '13px', 
                        background: 'var(--bg-secondary)', 
                        padding: '12px', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)', 
                        fontFamily: 'monospace',
                        resize: 'none',
                        outline: 'none',
                        lineHeight: 1.6
                      }}
                      value={currentVisit.followUpDraft}
                    />
                    <CopyButton text={currentVisit.followUpDraft || ''} />
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
