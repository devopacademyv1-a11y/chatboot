import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, Send, Volume2, StopCircle, Bot, Globe, Landmark, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

const API_BASE = '/api/chat';

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
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: streamedText, lang: 'mixed', streaming: true };
              return updated;
            });
          }
          if (data.done) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1].streaming = false;
              return updated;
            });
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
    <div className="dashboard-container" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', height: '100vh', background: 'var(--bg-darker)' }}>
      
      {/* SIDEBAR: LEAD QUALIFICATION */}
      <aside style={{ background: 'var(--bg-dark)', borderRight: '1px solid rgba(255,255,255,0.1)', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2.5rem' }}>
          <Landmark color="var(--primary)" size={32} />
          <h2 style={{ margin: 0 }}>Qualification</h2>
        </div>

        {/* FINANCIAL DATA CARDS */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Projet</div>
          <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{slots.project_type || 'En attente...'}</div>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Montant Souhaité</div>
          <div style={{ fontWeight: 'bold' }}>{slots.amount ? `${slots.amount.toLocaleString()} MAD` : 'En attente...'}</div>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Salaire Net Mensuel</div>
          <div style={{ fontWeight: 'bold' }}>{slots.salary ? `${slots.salary.toLocaleString()} MAD` : 'En attente...'}</div>
        </div>

        {/* DEBT RATIO GAUGE */}
        <div className="card" style={{ marginTop: 'auto', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem' }}>Taux d'endettement</span>
            <span style={{ fontWeight: 'bold', color: debtRatio > 40 ? '#ff4757' : '#2ed573' }}>{debtRatio}%</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: `${Math.min(debtRatio, 100)}%`, 
              background: debtRatio > 40 ? '#ff4757' : '#2ed573',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ marginTop: '15px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {debtRatio > 40 ? (
              <><AlertCircle size={14} color="#ff4757" /> Dossier Risqué (&gt;40%)</>
            ) : slots.salary ? (
              <><CheckCircle size={14} color="#2ed573" /> Dossier Éligible</>
            ) : null}
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-dark)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Conseiller Bancaire AI</h3>
          </div>
          <Globe size={18} color="var(--text-muted)" />
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ 
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
          {isLoading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Analyse financière en cours...</div>}
          <div ref={scrollRef} />
        </div>

        <div style={{ padding: '2rem', background: 'var(--bg-dark)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', maxWidth: '900px', margin: '0 auto' }}>
            <button onMouseDown={startRecording} onMouseUp={stopRecording}
              style={{ width: '55px', height: '55px', borderRadius: '50%', background: isRecording ? '#ff4757' : 'var(--glass)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isRecording ? <StopCircle /> : <Mic />}
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Ex: Je gagne 8000 dhs et je veux un crédit..."
              style={{ flex: 1, padding: '1rem 1.5rem', borderRadius: '30px', background: 'var(--glass)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', fontSize: '1rem' }} />
            <button onClick={handleSendText}
              style={{ width: '55px', height: '55px', borderRadius: '50%', background: 'var(--primary)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={22} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
