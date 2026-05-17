import { useState, useEffect, useRef } from 'react';
import { CreateMLCEngine } from '@mlc-ai/web-llm';

// Wir nutzen das kleine Gemma-Modell, optimiert für Browser/Mobile
const SELECTED_MODEL = "gemma-2b-it-q4f32_1-MLC";

function App() {
  const [engine, setEngine] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('Modell noch nicht geladen');
  const [isModelReady, setIsModelReady] = useState(false);
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalResult, setFinalResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef(null);

  useEffect(() => {
    // Setup Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'de-DE';

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          // Wir sammeln die iterativen Zwischenergebnisse
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(prev => prev + ' ' + currentTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setLoadingStatus('Dein Browser unterstützt die Web Speech API leider nicht (bitte Chrome/Safari nutzen).');
    }
  }, []);

  const initLLM = async () => {
    try {
      setLoadingStatus('Lade KI-Modell... (Das kann beim ersten Mal etwas dauern)');
      const initProgressCallback = (initProgress) => {
        setLoadingStatus(`Lade: ${Math.round(initProgress.progress * 100)}%`);
      };

      const newEngine = await CreateMLCEngine(
        SELECTED_MODEL,
        { initProgressCallback: initProgressCallback }
      );

      setEngine(newEngine);
      setIsModelReady(true);
      setLoadingStatus('Modell bereit! Alles läuft lokal.');
    } catch (error) {
      console.error(error);
      setLoadingStatus('Fehler beim Laden des KI-Modells.');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setFinalResult('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const processTranscript = async () => {
    if (!engine || !transcript) return;

    setIsProcessing(true);
    try {
      const messages = [
        {
          role: "system",
          content: "Du bist ein intelligenter Assistent. Der Nutzer diktiert Texte über Sprache-zu-Text. Deine Aufgabe: 1. Korrigiere alle Rechtschreib-, Grammatik- und Erkennungsfehler. 2. Wenn der Nutzer Befehle gibt (z.B. 'Füge XYZ zur Liste hinzu' oder 'Mach eine Einkaufsliste daraus'), führe die logische Formatierung aus (z.B. Erstellung einer Checkliste). Antworte NUR mit dem finalen Ergebnis. Füge keine eigenen Erklärungen oder Begrüßungen hinzu."
        },
        {
          role: "user",
          content: transcript
        }
      ];

      const reply = await engine.chat.completions.create({
        messages,
        temperature: 0.1, // Sehr niedrige Temperatur für deterministische, klare Antworten
      });

      setFinalResult(reply.choices[0].message.content);
    } catch (error) {
      console.error(error);
      setFinalResult("Fehler bei der KI-Verarbeitung.");
    }
    setIsProcessing(false);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', paddingBottom: '50px' }}>
      <h1 style={{ textAlign: 'center' }}>Web-LLM Transcriber</h1>
      
      <div style={{ background: '#e0e0e0', padding: '15px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Status: {loadingStatus}</h4>
        {!isModelReady && (
          <button 
            onClick={initLLM}
            style={{ padding: '12px 24px', fontSize: '16px', fontWeight: 'bold', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%' }}
          >
            🧠 Lokales KI-Modell (Gemma) starten
          </button>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button 
          disabled={!isModelReady}
          onClick={toggleListening}
          style={{ 
            padding: '20px', 
            fontSize: '20px', 
            fontWeight: 'bold',
            background: isListening ? '#dc3545' : (isModelReady ? '#28a745' : '#ccc'), 
            color: 'white', 
            border: 'none', 
            borderRadius: '12px',
            cursor: isModelReady ? 'pointer' : 'not-allowed',
            width: '100%',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          {isListening ? '🛑 Aufnahme stoppen' : '🎤 Sprechen / Diktieren'}
        </button>
      </div>

      <div style={{ background: 'white', padding: '15px', borderRadius: '12px', minHeight: '120px', border: '1px solid #ccc', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Roh-Transkript (Browser-Erkennung):</h4>
        <p style={{ color: '#666', fontStyle: 'italic', margin: 0 }}>
          {transcript || 'Dein gesprochener Text erscheint hier in Echtzeit...'}
        </p>
        
        {transcript && !isListening && (
          <button 
            onClick={processTranscript}
            disabled={isProcessing}
            style={{ padding: '12px', marginTop: '15px', fontSize: '16px', fontWeight: 'bold', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%' }}
          >
            {isProcessing ? '✨ KI arbeitet...' : '✨ Text bereinigen & formatieren'}
          </button>
        )}
      </div>

      {finalResult && (
        <div style={{ background: '#e8f4f8', padding: '20px', borderRadius: '12px', border: '1px solid #bce8f1' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0c5460' }}>Ergebnis (bereinigt & ausgeführt):</h4>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '16px', lineHeight: '1.5' }}>{finalResult}</p>
        </div>
      )}
    </div>
  );
}

export default App;
