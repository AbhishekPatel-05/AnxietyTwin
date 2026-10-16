import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Sparkles,
  X,
  Send,
  Trash2,
  ShieldCheck,
  Brain,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Info,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { AIAssistantMessage, AIAssistantConfig } from '../types';

export const AIAssistantDrawer: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<AIAssistantMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AIAssistantConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const token = localStorage.getItem('anxietytwin_token');

  // Load configuration and previous history on open
  useEffect(() => {
    if (isOpen && token) {
      loadConfig();
      loadHistory();
    }
  }, [isOpen, token]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  const loadConfig = async () => {
    try {
      const cfg = await api.getAssistantConfig();
      setConfig(cfg);
    } catch {
      // Graceful fallback config
      setConfig({
        active_provider: 'Grounded Clinical Engine',
        model: 'AnxietyTwin-Clinical-RAG-v2',
        is_live_hosted: false,
        supported_providers: ['Grounded Clinical Engine', 'Google Gemini', 'OpenAI'],
        available_tools: ['get_user_baseline', 'get_recent_observations', 'get_ml_prediction_explanation'],
        safety_guardrail_active: true,
      });
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.getAssistantHistory('default');
      if (res.messages && res.messages.length > 0) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.warn('Could not load chat history:', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    setInputMessage('');
    setError(null);

    // Optimistically append user message
    const tempUserMsg: AIAssistantMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const response = await api.chatWithAssistant(text, 'default');
      setMessages((prev) => [...prev, response]);
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with AI Assistant');
      const errorMsg: AIAssistantMessage = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again or inspect your connection.',
        timestamp: new Date().toISOString(),
        provenance: ['Error Notice'],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear your conversation history with the AI Assistant?')) return;
    try {
      await api.clearAssistantHistory('default');
      setMessages([]);
    } catch (err) {
      console.warn('Failed to clear history', err);
    }
  };

  const starterPrompts = [
    'Why is my stress score elevated?',
    'How does the Day-Before-Panic model work?',
    'What do my recent observations show?',
    'Guide me through a 4-7-8 breathing exercise',
    'What are the baseline calibration requirements?',
  ];

  if (!token) return null;

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Open AnxietyTwin AI Clinical Assistant"
          className="fixed bottom-6 right-6 z-40 flex items-center space-x-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-teal-500 via-indigo-600 to-purple-600 text-white font-semibold text-xs shadow-2xl shadow-teal-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-teal-400/30 group"
        >
          <div className="relative">
            <Sparkles className="w-4 h-4 text-teal-200 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span>AI Clinical Assistant</span>
        </button>
      )}

      {/* Slide-out Assistant Drawer */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[460px] h-[640px] max-h-[88vh] bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl transition-all">
          {/* Header */}
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-sm font-bold text-white">AnxietyTwin Assistant</h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30">
                    Clinical RAG
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span>{config?.active_provider || 'Grounded Clinical Engine'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handleClearHistory}
                title="Clear conversation history"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Safety Notice Banner */}
          <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-500/20 flex items-center justify-between text-[11px] text-indigo-300 shrink-0">
            <span className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Non-diagnostic assistant. In crisis, call/text <strong>988</strong>.</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">24/7 Lifeline</span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.length === 0 ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mx-auto border border-teal-500/20">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">How can I assist your Digital Twin?</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    I can explain your Composite Stress Index, summarize recent telemetry, interpret ML models, or guide evidence-based coping.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 text-left">
                  <span className="text-[10px] font-mono uppercase text-slate-500 px-1">Suggested Inquiries</span>
                  {starterPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-teal-500/40 text-slate-200 transition-all text-xs flex items-center justify-between group cursor-pointer"
                    >
                      <span>{prompt}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-teal-400 transition-colors shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={index}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    <div
                      className={`max-w-[88%] p-3.5 rounded-2xl leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white rounded-tr-xs shadow-md shadow-teal-900/20'
                          : 'bg-slate-800/80 border border-slate-700/70 text-slate-200 rounded-tl-xs shadow-md'
                      }`}
                    >
                      <div className="whitespace-pre-line text-xs font-sans">
                        {msg.content}
                      </div>

                      {/* Assistant Provenance & Citations */}
                      {!isUser && msg.provenance && msg.provenance.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-slate-700/60 flex flex-wrap gap-1 items-center">
                          {msg.provenance.map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                p.includes('Safety')
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : p.includes('ML')
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : p.includes('Telemetry')
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              }`}
                            >
                              [{p}]
                            </span>
                          ))}
                        </div>
                      )}

                      {!isUser && msg.citations && msg.citations.length > 0 && (
                        <div className="pt-1 text-[10px] text-slate-400 font-mono italic">
                          Ref: {msg.citations[0]}
                        </div>
                      )}

                      {/* Interactive Coping Trigger (if relevant) */}
                      {!isUser && msg.content.includes('4-7-8') && (
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              setIsOpen(false);
                              navigate('/interventions');
                            }}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-600/30 text-teal-300 border border-teal-500/40 hover:bg-teal-600/50 text-[11px] font-semibold transition-all cursor-pointer"
                          >
                            <span>Launch 4-7-8 Breathing Pacer</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 px-1 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}

            {/* Typing / Loading state */}
            {loading && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs p-3 rounded-2xl bg-slate-800/60 max-w-[60%]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
                <span>Consulting clinical knowledge base...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="px-4 py-2 bg-rose-950/60 border-t border-rose-500/30 text-rose-300 text-[11px] flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Quick Prompts Bar */}
          {messages.length > 0 && (
            <div className="px-3 py-1.5 bg-slate-950/50 border-t border-slate-800/60 flex space-x-1.5 overflow-x-auto text-[10px] shrink-0 no-scrollbar">
              <button
                onClick={() => handleSendMessage('Explain my stress index')}
                className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap cursor-pointer"
              >
                CSI Formula
              </button>
              <button
                onClick={() => handleSendMessage('How does the Day-Before-Panic model work?')}
                className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap cursor-pointer"
              >
                DBP Prediction
              </button>
              <button
                onClick={() => handleSendMessage('Give me a 4-7-8 breathing exercise')}
                className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap cursor-pointer"
              >
                Breathing Exercise
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div className="p-3 bg-slate-950/90 border-t border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about your digital twin, vitals, or coping..."
                disabled={loading}
                className="flex-1 bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || loading}
                title="Send Message"
                className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-600/30 disabled:opacity-40 disabled:hover:bg-teal-600 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
