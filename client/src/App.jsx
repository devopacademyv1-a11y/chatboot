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

  const handleUpdateSlots = (newSlots) => {
    setSlots(prev => ({
      project_type: newSlots.project_type || prev.project_type,
      amount: newSlots.amount || prev.amount,
      salary: newSlots.salary || prev.salary
    }));
  };

  const handleSendText = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    const currentHistory = [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Add a placeholder assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '', lang: 'mixed', streaming: true }]);

    try {
      const res = await fetch(`${API_BASE}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, history: currentHistory })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = JSON.parse(line.replace('data: ', ''));
          if (data.token) {
            streamedText += data.token;
            let displayContent = streamedText;
            
            // If it looks like JSON, try to extract the message part for a cleaner UI while streaming
            if (streamedText.trim().startsWith('{')) {
              const match = streamedText.match(/"message"\s*:\s*"([^"]*)"/);
              if (match) displayContent = match[1];
              else displayContent = "Analyse en cours...";
            }

            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: displayContent, lang: 'mixed', streaming: true };
              return updated;
            });
          }
          if (data.done) {
            try {
              // Try to parse the full text as JSON if it's structured
              const finalJson = JSON.parse(streamedText);
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { 
                  role: 'assistant', 
                  content: finalJson.message || streamedText, 
                  lang: 'mixed', 
                  streaming: false 
                };
                return updated;
              });
              if (finalJson.slots) handleUpdateSlots(finalJson.slots);
            } catch (e) {
              // Not JSON or partial JSON, just finish streaming
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].streaming = false;
                return updated;
              });
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
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
    formData.append('history', JSON.stringify(messages));

    try {
      const res = await axios.post(`${API_BASE}/voice`, formData);
      setMessages(prev => [
        ...prev, 
        { role: 'user', content: res.data.transcription },
        { role: 'assistant', content: res.data.response, lang: res.data.lang, audioUrl: res.data.audioUrl }
      ]);
      if (res.data.slots) handleUpdateSlots(res.data.slots);
      if (res.data.audioUrl) new Audio(res.data.audioUrl).play();
    } catch (err) {
      console.error(err);
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
                maxWidth: '70%', padding: '1.2rem', borderRadius: '18px',
                background: msg.role === 'user' ? 'var(--primary)' : 'var(--glass)',
                border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ fontSize: '1rem', lineHeight: '1.5' }}>{msg.content}</div>
                {msg.audioUrl && (
                  <button onClick={() => new Audio(msg.audioUrl).play()} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginTop: '10px' }}>
                    <Volume2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Analyse financière...</div>}
          <div ref={scrollRef} />
        </div>

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
