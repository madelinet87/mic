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

  useEffect(() => {
    if (!stream) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    const draw = () => {
      if (!ctx) return;
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} width={width} height={height} />;
};
