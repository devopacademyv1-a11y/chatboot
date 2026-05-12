import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, Send, Volume2, StopCircle, User, Bot, Globe } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/chat';

const App = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Salam! Labas? Kif n9dr n3awnk lyoum?', lang: 'darija' }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendText = async () => {
    if (!input.trim()) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/text`, {
        message: input,
        history: messages
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response, lang: res.data.lang }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
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
  };

  const stopRecording = () => {
    mediaRecorder.current.stop();
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

      if (res.data.audioUrl) {
        const audio = new Audio(`http://localhost:5000${res.data.audioUrl}`);
        audio.play();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '800px', margin: '0 auto', background: 'var(--bg-darker)' }}>
      <header style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Trinnova AI</h2>
            <div style={{ fontSize: '0.8rem', color: '#2ed573' }}>● Local Ollama (Aya:8b)</div>
          </div>
        </div>
        <Globe size={20} color="var(--text-muted)" />
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '1.5rem' }}>
            <div style={{ 
              maxWidth: '80%', 
              padding: '1rem', 
              borderRadius: msg.role === 'user' ? '18px 18px 0 18px' : '18px 18px 18px 0',
              background: msg.role === 'user' ? 'var(--primary)' : 'var(--glass)',
              border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)',
              position: 'relative'
            }}>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.4' }}>{msg.content}</div>
              {msg.lang && <div style={{ fontSize: '0.7rem', marginTop: '5px', opacity: 0.6, textTransform: 'uppercase' }}>{msg.lang}</div>}
              {msg.audioUrl && (
                <button 
                  onClick={() => new Audio(`http://localhost:5000${msg.audioUrl}`).play()}
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginTop: '8px' }}
                >
                  <Volume2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>AI is thinking...</div>
        )}
        <div ref={scrollRef} />
      </div>

      <div style={{ padding: '1.5rem', background: 'var(--bg-dark)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onMouseDown={startRecording} 
            onMouseUp={stopRecording}
            style={{ 
              width: '50px', height: '50px', borderRadius: '50%', 
              background: isRecording ? '#ff4757' : 'var(--glass)', 
              border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            {isRecording ? <StopCircle /> : <Mic />}
          </button>
          
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="Type a message (Darija or French)..."
            style={{ 
              flex: 1, padding: '0.8rem 1.2rem', borderRadius: '25px', 
              background: 'var(--glass)', border: '1px solid rgba(255,255,255,0.1)', 
              color: 'white', outline: 'none'
            }}
          />
          
          <button 
            onClick={handleSendText}
            style={{ 
              width: '50px', height: '50px', borderRadius: '50%', 
              background: 'var(--primary)', border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <Send size={20} />
          </button>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px' }}>
          {isRecording ? 'Recording... Release to send' : 'Hold Mic to record voice or type message'}
        </div>
      </div>
    </div>
  );
};

export default App;
