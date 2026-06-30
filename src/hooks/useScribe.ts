import { useCallback, useEffect, useRef, useState } from 'react';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import LiveAudioStream from 'react-native-live-audio-stream';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { api, API_BASE_URL } from '../lib/api';

export type ScribeLanguage = 'english' | 'bengali';
export type ScribeStatus =
  | 'idle'
  | 'starting'
  | 'active'
  | 'stopping'
  | 'generating'
  | 'done'
  | 'error';

const SAMPLE_RATE = 16000;

// Derive the WebSocket origin from the REST base URL. websocket_url from the
// backend already includes the `/v1` prefix, so strip it from the host root.
function wsOrigin(): string {
  // API_BASE_URL e.g. http://192.168.1.19:8000/v1
  const noPath = API_BASE_URL.replace(/\/v1\/?$/, '');
  return noPath.replace(/^http/, 'ws');
}

export function useScribe(consultationId: string) {
  const [status, setStatus] = useState<ScribeStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const recordingRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    recordingRef.current = false;
    try {
      LiveAudioStream.stop();
    } catch {
      // not started / already stopped
    }
  }, []);

  // Detach handlers and close the socket without triggering the error path.
  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    if (ws.readyState <= WebSocket.OPEN) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    stopTimer();
    stopAudio();
    closeSocket();
  }, [stopTimer, stopAudio, closeSocket]);

  useEffect(() => cleanup, [cleanup]);

  /**
   * Finalize the current session: tell the server to stop and settle the
   * transcript. Does NOT generate SOAP notes — that happens only when the
   * doctor taps "Generate SOAP Notes with AI". Safe to call from both an
   * explicit Stop and an unexpected disconnect.
   */
  const finalize = useCallback(async (): Promise<boolean> => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      setStatus('idle');
      return false;
    }
    try {
      await api.post('/ai/scribe/stop', { session_id: sessionId });
      setStatus('done');
      return true;
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join('\n')
          : (detail ?? err?.message ?? 'Failed to stop recording'),
      );
      setStatus('error');
      return false;
    }
  }, []);

  const start = useCallback(
    async (language: ScribeLanguage) => {
      if (!consultationId) return;
      if (status === 'starting' || status === 'active') return;

      setError(null);
      setTranscript('');
      setStatus('starting');
      intentionalCloseRef.current = false;

      try {
        // 1. Microphone permission
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setError('Microphone permission denied.');
          setStatus('error');
          return;
        }

        // 2. Open a scribe session on the backend
        const startRes = await api.post('/ai/scribe/start', {
          consultation_id: consultationId,
          language,
        });
        const sessionId: string = startRes.data.data.session_id;
        const websocketUrl: string = startRes.data.data.websocket_url;
        sessionIdRef.current = sessionId;

        // 3. Build authenticated WS URL using the backend access token
        const token = await SecureStore.getItemAsync('backend-token');
        const wsUrl = `${wsOrigin()}${websocketUrl}?token=${token}`;

        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
          setStatus('active');
          recordingRef.current = true;
          const startedAt = Date.now();
          setElapsed(0);
          timerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
          }, 1000);

          // Tell the server our sample rate
          ws.send(JSON.stringify({ type: 'config', sample_rate: SAMPLE_RATE }));

          // 4. Start native PCM capture and stream raw LINEAR16 chunks
          LiveAudioStream.init({
            sampleRate: SAMPLE_RATE,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6, // Android VOICE_RECOGNITION
            wavFile: 'scribe.wav',
            bufferSize: 4096,
          });
          LiveAudioStream.on('data', (base64Chunk: string) => {
            if (!recordingRef.current || ws.readyState !== WebSocket.OPEN) return;
            const bytes = Buffer.from(base64Chunk, 'base64');
            ws.send(
              bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
              ),
            );
          });
          LiveAudioStream.start();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (
              (msg.type === 'transcript' || msg.type === 'context_validated') &&
              msg.text
            ) {
              setTranscript(msg.text);
            } else if (msg.type === 'error') {
              setError(msg.message ?? 'Transcription error');
            }
          } catch {
            // ignore non-JSON frames
          }
        };

        // RN fires onerror alongside onclose; let onclose own the decision.
        ws.onerror = () => {};

        ws.onclose = () => {
          if (intentionalCloseRef.current) return; // handled by stop()
          stopTimer();
          stopAudio();
          // Connection dropped mid-recording. The transcript is saved
          // server-side, so salvage it by finalizing instead of erroring.
          if (sessionIdRef.current) {
            finalize();
          } else {
            setError('WebSocket connection closed.');
            setStatus('error');
          }
        };
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        setError(
          Array.isArray(detail)
            ? detail.map((d: any) => d.msg).join('\n')
            : (detail ?? err?.message ?? 'Failed to start scribe'),
        );
        setStatus('error');
        cleanup();
      }
    },
    [consultationId, status, cleanup, finalize, stopTimer, stopAudio],
  );

  /** Explicit Stop & Generate from the UI. */
  const stop = useCallback(async (): Promise<boolean> => {
    if (status !== 'active') return false;
    setStatus('stopping');
    intentionalCloseRef.current = true;

    stopTimer();
    stopAudio();

    // Politely tell the server we're done, then detach + close so the
    // close event can't flip us into the error state.
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'stop' }));
      } catch {
        // ignore
      }
    }
    closeSocket();

    return finalize();
  }, [status, stopTimer, stopAudio, closeSocket, finalize]);

  const reset = useCallback(() => {
    cleanup();
    sessionIdRef.current = null;
    intentionalCloseRef.current = false;
    setStatus('idle');
    setTranscript('');
    setError(null);
    setElapsed(0);
  }, [cleanup]);

  return { status, transcript, error, elapsed, start, stop, reset };
}
