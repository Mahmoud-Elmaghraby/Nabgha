import { useState, useRef, useCallback } from 'react';

interface UseVoiceSearchOptions {
  lang?: string;
  onResult: (text: string) => void;
}

export function useVoiceSearch({ lang = 'ar-EG', onResult }: UseVoiceSearchOptions) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('المتصفح لا يدعم البحث الصوتي');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript.trim());
    };

    recognition.onerror = (event: any) => {
      setError(event.error === 'not-allowed' ? 'يرجى السماح بالوصول للميكروفون' : 'حدث خطأ في التعرف على الصوت');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang, onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, startListening, stopListening, error };
}
