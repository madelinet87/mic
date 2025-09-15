import React, { useState, useRef, useEffect } from 'react';

interface RecordButtonProps {
  filenamePrefix?: string;
  onAudioReady: (blob: Blob, file: File) => void;
  onError: (error: Error) => void;
  onStateChange: (state: 'idle' | 'recording' | 'finalizing' | 'completed' | 'error') => void;
  useVad?: boolean;
  vadSilenceSeconds?: number;
  mimeTypeOverride?: string;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  filenamePrefix = 'recording',
  onAudioReady,
  onError,
  onStateChange,
  useVad = false,
  vadSilenceSeconds = 3,
  mimeTypeOverride,
}) => {
  // Debug flag for logging
  const DEBUG = true;
  // Check for browser support
  const isSupported = typeof window !== 'undefined' && window.MediaRecorder && navigator.mediaDevices;
  const [state, setState] = useState<'idle' | 'recording' | 'finalizing' | 'completed' | 'error'>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          if (track.readyState === 'live') track.stop();
        });
        streamRef.current = null;
      }
      if (vadIntervalRef.current) {
        window.clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    if (!isSupported) {
      alert('Your browser does not support audio recording.');
      setState('error');
      onStateChange('error');
      onError(new Error('MediaRecorder or mediaDevices not supported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = mimeTypeOverride || '';
      if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
        if (DEBUG) console.warn(`[RecordButton] MIME type ${mimeType} not supported, falling back`);
        mimeType = '';
      }
      if (!mimeType) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (DEBUG) console.log('[RecordButton] MediaRecorder onstop called');
        setState('finalizing');
        onStateChange('finalizing');

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const file = new File([blob], `${filenamePrefix}-${Date.now()}.webm`, { type: mimeType });
        audioChunksRef.current = []; // cleanup
        onAudioReady(blob, file);
        if (streamRef.current) {
          if (DEBUG) console.log('[RecordButton] Aggressively stopping all stream tracks');
          streamRef.current.getTracks().forEach(track => {
            if (track.readyState === 'live') track.stop();
          });
          streamRef.current = null;
        } else {
          if (DEBUG) console.log('[RecordButton] No streamRef to stop');
        }

        setState('completed');
        onStateChange('completed');
      };

      try {
        mediaRecorder.start();
        if (DEBUG) console.log('[RecordButton] Started recording');
        setState('recording');
        onStateChange('recording');
      } catch (err) {
        if (DEBUG) console.error('[RecordButton] Error starting recording:', err);
        streamRef.current?.getTracks().forEach(track => track.stop());
        setState('idle');
        onStateChange('idle');
        // User-friendly error message
        let message = 'Microphone access denied. Please allow access and try again.';
        if (err instanceof Error && err.message) {
          message += `\nDetails: ${err.message}`;
        }
        alert(message);
        onError(err as Error);
      }

      // Voice Activity Detection (optional)
      if (useVad) {
        let audioContext: AudioContext;
        let source: MediaStreamAudioSourceNode;
        let analyser: AnalyserNode;
        try {
          audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          source.connect(analyser);
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.8;
        } catch (err) {
          if (DEBUG) console.error('[RecordButton] Error initializing audio context for VAD:', err);
          alert('Error initializing audio context for VAD.');
          setState('error');
          onStateChange('error');
          onError(err as Error);
          return;
        }
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        let silentFrames = 0;
        let minRecordingMs = 1500;
        let recordingStart = Date.now();
        const silenceThreshold = 0.025;
        const speechThreshold = 0.04;
        const requiredSilenceFrames = Math.round((vadSilenceSeconds * 1000) / (1000 / 45)); // ~45fps

        vadIntervalRef.current = window.setInterval(() => {
          try {
            analyser.getByteTimeDomainData(dataArray);
            // Exponential moving average for RMS
            let rms = 0;
            for (let i = 0; i < bufferLength; i++) {
              rms += (dataArray[i] - 128) * (dataArray[i] - 128);
            }
            rms = Math.sqrt(rms / bufferLength) / 128;

            // Hysteresis: only count as silent if below silenceThreshold, reset if above speechThreshold
            if (rms < silenceThreshold) {
              silentFrames++;
            } else if (rms > speechThreshold) {
              silentFrames = 0;
            }

            // Only stop if enough silent frames AND minimum recording duration met
            if (
              silentFrames > requiredSilenceFrames &&
              Date.now() - recordingStart > minRecordingMs
            ) {
              stopRecording();
            }
          } catch (err) {
            if (DEBUG) console.error('[RecordButton] Error during VAD analysis:', err);
            alert('Error during VAD analysis.');
            setState('error');
            onStateChange('error');
            onError(err as Error);
          }
        }, 1000 / 45);
      }
    } catch (err) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      setState('idle');
      onStateChange('idle');
      onError(err as Error);
    }
  };

  const stopRecording = () => {
    try {
      if (DEBUG) console.log('[RecordButton] stopRecording called');
      // Stop VAD interval if running
      if (vadIntervalRef.current) {
        window.clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
        if (DEBUG) console.log('[RecordButton] VAD interval cleared');
      }
      // Close audio context if used
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        if (DEBUG) console.log('[RecordButton] AudioContext closed');
      }
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        if (DEBUG) console.log('[RecordButton] Stopping MediaRecorder');
        mediaRecorderRef.current.stop();
      } else {
        if (DEBUG) console.log('[RecordButton] MediaRecorder already inactive');
      }
      // Do NOT stop stream here; let mediaRecorder.onstop handle it for proper cleanup
    } catch (err) {
      if (DEBUG) console.error('[RecordButton] Error stopping recording:', err);
      setState('idle');
      onStateChange('idle');
      alert('Error stopping recording. Please try again.');
      onError(err as Error);
    }
  };

  return (
    <button
      onClick={() => {
        if (state === 'idle' || state === 'completed') {
          setState('idle');
          onStateChange('idle');
          startRecording();
        } else if (state === 'recording') {
          stopRecording();
        }
      }}
      disabled={state === 'finalizing' || state === 'error'}
      aria-live="assertive"
      style={{
        padding: '10px 20px',
        fontSize: '1rem',
        borderRadius: '6px',
        border: 'none',
        background:
          state === 'recording'
            ? '#e74c3c'
            : state === 'finalizing'
            ? '#f39c12'
            : state === 'error'
            ? '#bdc3c7'
            : '#2ecc71',
        color: '#fff',
        cursor: state === 'finalizing' || state === 'error' ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
      }}
    >
      {state === 'recording' && 'Stop Recording'}
      {state === 'finalizing' && 'Finalizing...'}
      {state === 'error' && 'Error'}
      {(state === 'idle' || state === 'completed') && 'Start Recording'}
    </button>
    );
  };
