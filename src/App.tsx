import { useState } from 'react';
import { RecordButton } from './Components/RecordButton';
import { AudioVisualizer } from './Components/AudioVisualizer';

function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleAudioReady = (blob: Blob, file: File) => {
    console.log('Audio ready:', blob, file);
    setStream(null); // stop visualizer
  };

  function handleError(error: Error) {
    console.error('Recording error:', error);
    setStream(null);
  }

  const handleStateChange = (state: 'idle' | 'recording' | 'finalizing' | 'error') => {
    console.log('Recording state:', state);
    if (state === 'idle') {
      console.log('[App] Setting idle (handleStateChange)');
      setStream(null);
    } else if (state === 'recording') {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(setStream);
    } else if (state === 'error') {
      setStream(null);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <RecordButton
        postUrl="https://example.com/upload"
        onAudioReady={handleAudioReady}
        onError={handleError}
        onStateChange={handleStateChange}
        useVad
        vadSilenceSeconds={3}
      />
      <div style={{ marginTop: '20px' }}>
        <AudioVisualizer stream={stream} width={400} height={80} />
      </div>
    </div>
  );
}

export default App;
