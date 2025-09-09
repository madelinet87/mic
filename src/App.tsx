import { RecordButton } from './Components/RecordButton';
import { useState } from 'react'
import './App.css'

function App() {
  // Callback functions for RecordButton
  const handleAudioReady = (blob: Blob, file: File) => {
    console.log('Audio ready:', blob, file);
  };
  const handleError = (error: Error) => {
    console.error('Recording error:', error);
  };
  const handleStateChange = (state: 'idle' | 'recording' | 'finalizing' | 'error') => {
    console.log('Recording state:', state);
  };

  return (
    <>
      {/* Example usage of RecordButton */}
      <RecordButton
        postUrl="https://example.com/upload"
        onAudioReady={handleAudioReady}
        onError={handleError}
        onStateChange={handleStateChange}
      />
    </>
  );
}

export default App
