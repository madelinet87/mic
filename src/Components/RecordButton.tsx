import React, { useState, useRef } from 'react';

interface RecordButtonProps {
  postUrl: string;
  filenamePrefix?: string;
  onAudioReady: (blob: Blob, file: File) => void;
  onError: (error: Error) => void;
  onStateChange: (state: 'idle' | 'recording' | 'finalizing' | 'error') => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  postUrl,
  filenamePrefix = 'recording',
  onAudioReady,
  onError,
  onStateChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      onStateChange('recording');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        onStateChange('finalizing');

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `${filenamePrefix}-${Date.now()}.webm`, { type: 'audio/webm' });

    
        onAudioReady(blob, file);

     
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

        try {
          const formData = new FormData();
          formData.append('file', file);
          await fetch(postUrl, { method: 'POST', body: formData });

        
          onStateChange('idle');
        } catch (err) {
          onError(err as Error);
          onStateChange('error');
        }
      };

      mediaRecorder.start();
    } catch (err) {
      onError(err as Error);
      onStateChange('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false); 
    }
  };

  return (
    <button
      onClick={() => {
        if (!isRecording) {
          setIsRecording(true);
          startRecording();
        } else {
          stopRecording();
        }
      }}
      style={{
        padding: '10px 20px',
        fontSize: '1rem',
        borderRadius: '6px',
        border: 'none',
        background: isRecording ? '#e74c3c' : '#2ecc71',
        color: '#fff',
        cursor: 'pointer',
        transition: 'background 0.2s',
      }}
    >
      {isRecording ? 'Stop Recording' : 'Start Recording'}
    </button>
  );
};
