import { useCallback, useEffect, useRef, useState } from 'react';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import LiveAudioStream from 'react-native-live-audio-stream';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { api, API_BASE_URL } from '../lib/api';

export type IntakeLanguage = 'english' | 'bengali';
export type IntakeStatus = 'idle' | 'starting' | 'active' | 'stopping' | 'extracting' | 'done' | 'error';

const SAMPLE_RATE = 16000;

function wsOrigin(): string {
  const noPath = API_BASE_URL.replace(/\/v1\/?$/, '');
  return noPath.replace(/^http/, 'ws');
}

/** Live patient-intake voice session → transcript → AI-extracted patient data. */
export function useIntake(organizationId?: string) {
  const [status, setStatus] = useState<IntakeStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const recordingRef = useRef(false);
  const intentionalRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);
  const stopAudio = useCallback(() => {
    recordingRef.current = false;
    try { LiveAudioStream.stop(); } catch { /* not started */ }
  }, []);
  const closeSocket = useCallback(() => {
    const ws = wsRef.current; wsRef.current = null;
    if (!ws) return;
    ws.onmessage = null; ws.onerror = null; ws.onclose = null;
    if (ws.readyState <= WebSocket.OPEN) { try { ws.close(); } catch { /* ignore */ } }
  }, []);
  const cleanup = useCallback(() => { stopTimer(); stopAudio(); closeSocket(); }, [stopTimer, stopAudio, closeSocket]);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async (language: IntakeLanguage) => {
    if (!organizationId) { setError('No organization on your account.'); setStatus('error'); return; }
    if (status === 'starting' || status === 'active') return;
    setError(null); setTranscript(''); setStatus('starting'); intentionalRef.current = false;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { setError('Microphone permission denied.'); setStatus('error'); return; }

      const startRes = await api.post('/intake/start', { organization_id: organizationId, language });
      const sessionId: string = startRes.data.data.session_id;
      const websocketUrl: string = startRes.data.data.websocket_url;
      sessionIdRef.current = sessionId;

      const token = await SecureStore.getItemAsync('backend-token');
      const ws = new WebSocket(`${wsOrigin()}${websocketUrl}?token=${token}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('active');
        recordingRef.current = true;
        const startedAt = Date.now();
        setElapsed(0);
        timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
        ws.send(JSON.stringify({ type: 'config', sample_rate: SAMPLE_RATE }));
        LiveAudioStream.init({ sampleRate: SAMPLE_RATE, channels: 1, bitsPerSample: 16, audioSource: 6, wavFile: 'intake.wav', bufferSize: 4096 });
        LiveAudioStream.on('data', (b64: string) => {
          if (!recordingRef.current || ws.readyState !== WebSocket.OPEN) return;
          const bytes = Buffer.from(b64, 'base64');
          ws.send(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        });
        LiveAudioStream.start();
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if ((msg.type === 'transcript' || msg.type === 'context_validated') && msg.text) setTranscript(msg.text);
          else if (msg.type === 'error') setError(msg.message ?? 'Transcription error');
        } catch { /* ignore non-JSON */ }
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        if (intentionalRef.current) return;
        stopTimer(); stopAudio();
      };
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? err?.message ?? 'Failed to start intake'));
      setStatus('error'); cleanup();
    }
  }, [organizationId, status, cleanup, stopTimer, stopAudio]);

  /** Stop, finalize, and AI-extract structured patient data. Returns the extract or null. */
  const stop = useCallback(async (): Promise<any | null> => {
    if (status !== 'active') return null;
    setStatus('stopping'); intentionalRef.current = true;
    stopTimer(); stopAudio();
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) { try { ws.send(JSON.stringify({ type: 'stop' })); } catch { /* ignore */ } }
    closeSocket();

    const sessionId = sessionIdRef.current;
    if (!sessionId) { setStatus('idle'); return null; }
    try {
      await api.post('/intake/stop', { session_id: sessionId });
      await new Promise((r) => setTimeout(r, 1500));
      setStatus('extracting');
      const res = await api.post('/intake/extract', { session_id: sessionId });
      setStatus('done');
      return { data: res.data.data, sessionId };
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? err?.message ?? 'Failed to extract data'));
      setStatus('error');
      return null;
    }
  }, [status, stopTimer, stopAudio, closeSocket]);

  const reset = useCallback(() => {
    cleanup(); sessionIdRef.current = null; intentionalRef.current = false;
    setStatus('idle'); setTranscript(''); setError(null); setElapsed(0);
  }, [cleanup]);

  return { status, transcript, error, elapsed, start, stop, reset };
}
