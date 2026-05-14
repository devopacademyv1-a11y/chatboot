import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, Send, Volume2, StopCircle, Bot, Globe, Landmark, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') 
  ? 'http://localhost:5000/api/chat' 
  : `${window.location.origin}/api/chat`;

const App = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Salam! Labas? Chnou houwa el machrou3 dialk lyoum (Crédit Auto, Immo, Conso)?', lang: 'darija' }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Banking State (Lead Qualification Slots)
  const [slots, setSlots] = useState({
    project_type: null,
    amount: null,
    salary: null
  });

  const scrollRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Financial Calculations
  const calculateDebtRatio = () => {
    if (!slots.salary || !slots.amount) return 0;
    // Simple estimation: 10% interest over 5 years
    const monthlyPayment = (slots.amount * 1.1) / 60; 
    return Math.round((monthlyPayment / slots.salary) * 100);
  };

  const debtRatio = calculateDebtRatio();

  const handleUpdateSlots = (newSlots = {}) => {
    setSlots(prev => ({
      project_type: newSlots.project_type || prev.project_type,
      amount: newSlots.amount ?? prev.amount,
      salary: newSlots.salary ?? prev.salary
    }));
  };

  const parseAssistantPayload = (text) => {
    if (!text || !text.trim().startsWith('{')) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const handleSendText = async (e, text) => {
    if (e) e.preventDefault();
    const messageToSend = text || input;
    if (!messageToSend.trim()) return;

    const userMsg = { role: 'user', content: messageToSend };
    const historyForRequest = messages;
    const visibleMessages = [...messages, userMsg];
    setMessages(visibleMessages);
    setInput('');
    setIsLoading(true);

    // Placeholder for assistant
    setMessages([...visibleMessages, { role: 'assistant', content: '', lang: 'mixed', streaming: true }]);

    try {
      const res = await fetch(`${API_BASE}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend, history: historyForRequest, slots })
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat stream failed with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = '';
      let buffer = '';
      let finalPayload = null;

      const applyAssistantText = (content, streaming = true) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content, lang: 'mixed', streaming };
          return updated;
        });
      };

      const processEvent = (eventText) => {
        const dataLines = eventText
          .split('\n')
          .filter(line => line.startsWith('data: '));

        dataLines.forEach((line) => {
          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            return;
          }

          if (data.token) {
            streamedText += data.token;
            const parsedPayload = parseAssistantPayload(streamedText);
            applyAssistantText(parsedPayload?.message || streamedText);
          }

          if (data.data) {
            finalPayload = data.data;
          } else if (data.full) {
            finalPayload = parseAssistantPayload(data.full) || finalPayload;
          }
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        events.forEach(processEvent);
      }

      if (buffer.trim()) processEvent(buffer);

      // Final Cleanup & Voice
      const cleanText = finalPayload?.message || parseAssistantPayload(streamedText)?.message || streamedText;
      if (cleanText) {
        try {
          applyAssistantText(cleanText, false);
          if (finalPayload?.slots) handleUpdateSlots(finalPayload.slots);
          
          const ttsRes = await axios.post(`${API_BASE}/tts`, { 
            text: cleanText,
            lang: cleanText.match(/[a-zA-Z]/) ? 'fr' : 'ar' 
          });
          if (ttsRes.data.audioUrl) {
            new Audio(`${window.location.origin}${ttsRes.data.audioUrl}`).play();
          }
        } catch (e) { console.error("Post-stream processing failed", e); }
      }

    } catch (err) {
      console.error("Streaming error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone access is only available over HTTPS or on localhost.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        handleSendVoice(audioBlob);
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    setIsRecording(false);
  };

  const handleSendVoice = async (blob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('audio', blob);

    try {
      const res = await axios.post(`${API_BASE}/transcribe`, formData);
      const text = res.data.transcription;
      if (text) {
        // Now trigger the normal text send logic with the transcribed text!
        handleSendText(null, text);
      }
    } catch (err) {
      console.error("Transcription failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <style>{`
        .dashboard-container {
          display: grid;
          grid-template-columns: 350px 1fr;
          height: 100vh;
          background: var(--bg-darker);
        }
        .chat-main {
          display: flex; 
          flex-direction: column; 
          overflow: hidden;
        }
        .chat-messages {
          flex: 1; 
          overflow-y: auto; 
          padding: 2rem;
        }
        .chat-input-area {
          padding: 2rem; 
          background: var(--bg-dark); 
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        @media (max-width: 900px) {
          .dashboard-container {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
            height: 100dvh;
          }
          aside {
            padding: 1rem !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }
          .card-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .gauge-card {
             grid-column: span 2;
             margin-top: 10px !important;
          }
          .chat-messages {
            padding: 1rem !important;
          }
          .chat-input-area {
            padding: 1rem !important;
          }
          .message-bubble {
            max-width: 85% !important;
            padding: 0.8rem !important;
            font-size: 0.9rem !important;
          }
        }
      `}</style>
      
      {/* SIDEBAR: LEAD QUALIFICATION */}
      <aside style={{ background: 'var(--bg-dark)', borderRight: '1px solid rgba(255,255,255,0.1)', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
          <Landmark color="var(--primary)" size={24} />
          <h3 style={{ margin: 0 }}>Qualification</h3>
        </div>

        <div className="card-grid">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Projet</div>
            <div style={{ fontWeight: 'bold', textTransform: 'capitalize', fontSize: '0.9rem' }}>{slots.project_type || '---'}</div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Montant</div>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{slots.amount ? `${slots.amount.toLocaleString()} DH` : '---'}</div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Salaire</div>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{slots.salary ? `${slots.salary.toLocaleString()} DH` : '---'}</div>
          </div>
        </div>

        {/* DEBT RATIO GAUGE */}
        <div className="card gauge-card" style={{ marginTop: 'auto', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.7rem' }}>Endettement</span>
            <span style={{ fontWeight: 'bold', color: debtRatio > 40 ? '#ff4757' : '#2ed573', fontSize: '0.8rem' }}>{debtRatio}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: `${Math.min(debtRatio, 100)}%`, 
              background: debtRatio > 40 ? '#ff4757' : '#2ed573',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="chat-main">
        <header style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-dark)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Conseiller AI</h3>
          </div>
          <Globe size={18} color="var(--text-muted)" />
        </header>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '1.5rem' }}>
              <div className="message-bubble" style={{ 
                maxWidth: '75%', padding: '1rem 1.4rem', borderRadius: '20px',
                background: msg.role === 'user' ? 'var(--primary)' : 'var(--glass)',
                border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                position: 'relative'
              }}>
                <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#fff' }}>{msg.content}</div>
                {msg.audioUrl && (
                  <button onClick={() => new Audio(msg.audioUrl).play()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Volume2 size={16} /> <span style={{ fontSize: '0.7rem' }}>Écouter</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {/* PREMIUM TYPING INDICATOR */}
          {isLoading && (
            <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', background: 'var(--glass)', borderRadius: '20px', width: 'fit-content', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out' }} />
              <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out 0.2s' }} />
              <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out 0.4s' }} />
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <style>{`
          @keyframes typing {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-6px); opacity: 1; }
          }
          .card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
            padding: 1.2rem;
            border-radius: 16px;
            transition: all 0.3s ease;
          }
          .card:hover {
            background: rgba(255,255,255,0.05);
            border-color: var(--primary);
          }
        `}</style>

        <div className="chat-input-area">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', maxWidth: '900px', margin: '0 auto' }}>
            <button onMouseDown={startRecording} onMouseUp={stopRecording}
              style={{ width: '50px', height: '50px', borderRadius: '50%', background: isRecording ? '#ff4757' : 'var(--glass)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {isRecording ? <StopCircle /> : <Mic size={20} />}
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Message..."
              style={{ flex: 1, padding: '0.8rem 1.2rem', borderRadius: '30px', background: 'var(--glass)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', fontSize: '1rem', minWidth: 0 }} />
            <button onClick={handleSendText}
              style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
