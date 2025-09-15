import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  width?: number;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  stream,
  width = 300,
  height = 60,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if (!stream) return;
    let audioContext: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let analyser: AnalyserNode | undefined;
    try {
      audioContext = new AudioContext();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 256;
    } catch (err) {
      console.error('AudioVisualizer error:', err);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    // Number of bars to show in history
    const numBars = Math.floor(width / 4);
    historyRef.current = Array(numBars).fill(0);

    const draw = () => {
      if (!ctx) return;
      try {
        analyser.getByteFrequencyData(dataArray);
        // Get peak value for this frame, normalized
        const peak = Math.max(...dataArray) / 255;
        // Smooth transition: blend with previous value
        const last = historyRef.current.length ? historyRef.current[historyRef.current.length - 1] : 0;
        const smoothedPeak = last * 0.6 + peak * 0.4;
        // Scroll history left, add new peak to right
        historyRef.current.push(smoothedPeak);
        if (historyRef.current.length > numBars) {
          historyRef.current.shift();
        }
        ctx.clearRect(0, 0, width, height);
        // Draw history bars, oldest (left) to newest (right)
        const barWidth = 3;
        for (let i = 0; i < historyRef.current.length; i++) {
          const value = historyRef.current[i];
          const barHeight = Math.max(2, value * height);
          ctx.fillStyle = '#2ecc71'; // always green
          ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
      } catch (err) {
        console.error('AudioVisualizer draw error:', err);
      }
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      try {
        source?.disconnect();
        analyser?.disconnect();
        audioContext?.close();
      } catch (err) {
        console.error('AudioVisualizer cleanup error:', err);
      }
    };
  }, [stream, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} />;
};
