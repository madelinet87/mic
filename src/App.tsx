import { useState } from 'react';
import { RecordButton } from './Components/RecordButton';
import { AudioVisualizer } from './Components/AudioVisualizer';

function App() {
  // Holds the current audio stream for visualization and cleanup
  const [stream, setStream] = useState<MediaStream | null>(null);
  // Holds any error message to display to the user
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Tracks the current recording state for UI and logic
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'finalizing' | 'completed' | 'error'>('idle');

  // Called when audio is finalized and ready
  const handleAudioReady = (blob: Blob, file: File) => {
    console.log('Audio ready:', blob, file);
    setStream(null); // stop visualizer
  };

  // Called when an error occurs during recording
  function handleError(error: Error) {
    console.error('Recording error:', error);
    setStream(null);
    setErrorMsg(error.message || 'An unknown error occurred.');
  }

  // Handles state transitions from the RecordButton
  const handleStateChange = (state: 'idle' | 'recording' | 'finalizing' | 'completed' | 'error') => {
    console.log('Recording state:', state);
    setRecordingState(state);
    if (state === 'recording') {
      // Only request a new stream if not already set
      if (!stream) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(setStream);
      }
      setErrorMsg(null);
    } else if (state === 'finalizing' || state === 'error' || state === 'completed' || state === 'idle') {
      // Forcefully stop all tracks before clearing stream
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') track.stop();
        });
      }
      setStream(null);
      setErrorMsg(null);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Show error message and retry button if an error occurs */}
      {errorMsg && (
        <div
          style={{
            background: '#e74c3c',
            color: '#fff',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontWeight: 'bold',
          }}
          role="alert"
          aria-live="assertive"
        >
          {errorMsg}
          <button
            style={{
              marginLeft: '16px',
              padding: '6px 16px',
              borderRadius: '4px',
              border: 'none',
              background: '#fff',
              color: '#e74c3c',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
            onClick={() => setErrorMsg(null)}
          >
            Retry
          </button>
        </div>
      )}
      {/* Show finalizing spinner and message when audio is being processed */}
      {recordingState === 'finalizing' && (
        <div
          style={{
            background: '#f39c12',
            color: '#fff',
            padding: '10px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
          aria-live="polite"
        >
          <span>Finalizing recording...</span>
          <span style={{ width: 18, height: 18, border: '3px solid #fff', borderTop: '3px solid #f39c12', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {/* Main recording button and visualizer */}
      <RecordButton
        onAudioReady={handleAudioReady}
        onError={handleError}
        onStateChange={handleStateChange}
        useVad
        vadSilenceSeconds={5}
      />
      <div style={{ marginTop: '20px' }}>
        {/* Show live audio visualizer while recording */}
        <AudioVisualizer stream={stream} width={400} height={80} />
      </div>
    </div>
  );
}

export default App;
