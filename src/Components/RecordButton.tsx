import React, { useState, useRef, useEffect } from 'react';

interface RecordButtonProps {
  postUrl: string;
  filenamePrefix?: string;
  onAudioReady: (blob: Blob, file: File) => void;
  onError: (error: Error) => void;
  onStateChange: (state: 'idle' | 'recording' | 'finalizing' | 'error') => void;
  useVad?: boolean;
  vadSilenceSeconds?: number;
  mimeTypeOverride?: string;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  postUrl,
  filenamePrefix = 'recording',
  onAudioReady,
  onError,
  onStateChange,
  useVad = false,
  vadSilenceSeconds = 3,
  mimeTypeOverride,
}) => {
  const [state, setState] = useState<'idle' | 'recording' | 'finalizing' | 'error'>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const vadTimeoutRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (vadTimeoutRef.current) window.clearTimeout(vadTimeoutRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = mimeTypeOverride || '';
      if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
        console.warn(`MIME type ${mimeType} not supported, falling back`);
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
         setState('finalizing');
         onStateChange('finalizing');

         const blob = new Blob(audioChunksRef.current, { type: mimeType });
         const file = new File([blob], `${filenamePrefix}-${Date.now()}.webm`, { type: mimeType });

         audioChunksRef.current = []; // cleanup

         onAudioReady(blob, file);

         stream.getTracks().forEach(track => track.stop());

         try {
           const formData = new FormData();
           formData.append('file', file);
           await fetch(postUrl, { method: 'POST', body: formData });

           console.log('[RecordButton] Setting idle (after upload)');
           setState('idle');
           onStateChange('idle');
         } catch (err) {
           onError(err as Error);
           setState('error');
           onStateChange('error');
         }
      };

      mediaRecorder.start();
      setState('recording');
      onStateChange('recording');

      // Voice Activity Detection (optional)
      if (useVad) {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.fftSize = 512;
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        const checkSilence = () => {
          analyser.getByteTimeDomainData(dataArray);
          const rms =
            Math.sqrt(dataArray.reduce((acc, val) => acc + (val - 128) ** 2, 0) / bufferLength) /
            128;

          if (rms < 0.02) {
            if (!vadTimeoutRef.current) {
              vadTimeoutRef.current = window.setTimeout(() => {
                stopRecording();
              }, vadSilenceSeconds * 1000);
            }
          } else {
            if (vadTimeoutRef.current) {
              window.clearTimeout(vadTimeoutRef.current);
              vadTimeoutRef.current = null;
            }
          }

          if (state === 'recording') {
            requestAnimationFrame(checkSilence);
          }
        };

        requestAnimationFrame(checkSilence);
      }
    } catch (err) {
      onError(err as Error);
      setState('error');
      onStateChange('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <button
      onClick={() => {
        if (state === 'idle') {
          startRecording();
        } else if (state === 'recording') {
          stopRecording();
        }
      }}
      disabled={state === 'finalizing'}
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
            : '#2ecc71',
        color: '#fff',
        cursor: state === 'finalizing' ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
      }}
    >
      {state === 'recording'
        ? 'Stop Recording'
        : state === 'finalizing'
        ? 'Finalizing...'
        : 'Start Recording'}
    </button>
  );
};
