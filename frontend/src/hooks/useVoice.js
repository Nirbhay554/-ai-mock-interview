import { useState, useCallback, useRef } from 'react';
import { transcribeAudio } from '../lib/api';

const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ── Speech to Text (STT) via local MediaRecorder and backend transcription ──
  const startListening = useCallback(async () => {
    try {
      setTranscript('');
      setVoiceError('');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsListening(true);
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        
        // Stop all tracks to release the mic hardware immediately
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) return;

        setIsTranscribing(true);
        setVoiceError('');

        try {
          const data = await transcribeAudio(audioBlob);

          if (data.transcript) {
            setTranscript(data.transcript);
          } else {
            setVoiceError('No speech detected. Please speak clearly or try typing.');
          }
        } catch (err) {
          console.error('Audio transcription error:', err);
          setVoiceError(err.message || 'Failed to connect to transcription server.');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Mic access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('Microphone access denied. Please click the lock/settings icon in your browser address bar and choose "Allow".');
      } else {
        setVoiceError('Failed to access microphone. Please check your mic settings.');
      }
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Text to Speech (TTS) ──────────────────────────────────────────────────
  const speak = useCallback((text) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.92;    // slightly slower = clearer
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick a good voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.name.includes('Google') && v.lang === 'en-US'
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    transcript,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    setTranscript,
    voiceError,
    isTranscribing
  };
};

export default useVoice;
