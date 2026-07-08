'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
  src?: string;
  title?: string;
  variant?: 'default' | 'large' | 'mini';
  showVisualizer?: boolean;
  maxDuration?: number; // limit playback to N seconds (for previews)
  onEnded?: () => void;
}

export default function AudioPlayer({
  src,
  title,
  variant = 'default',
  showVisualizer = false,
  maxDuration,
  onEnded,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const effectiveDuration = maxDuration && maxDuration < duration ? maxDuration : duration;

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (maxDuration && audio.currentTime >= maxDuration) {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
        setCurrentTime(0);
        onEnded?.();
      }
    };

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEndedHandler = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEndedHandler);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEndedHandler);
    };
  }, [maxDuration, onEnded]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const targetTime = ratio * effectiveDuration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  if (variant === 'mini') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <audio ref={audioRef} src={src} preload="metadata" />
        <button
          className="audio-player-play"
          onClick={togglePlay}
          style={{ width: 32, height: 32, fontSize: '0.7rem' }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        {showVisualizer && isPlaying && (
          <div className="audio-visualizer">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="audio-visualizer-bar" />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isLarge = variant === 'large';

  return (
    <div className={`audio-player ${isLarge ? 'audio-player-lg' : ''}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        className="audio-player-play"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div className="audio-player-info">
        {title && <div className="audio-player-title">{title}</div>}
        <div className="audio-player-progress" onClick={handleProgressClick}>
          <div
            className="audio-player-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {showVisualizer && isPlaying ? (
        <div className="audio-visualizer">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="audio-visualizer-bar" />
          ))}
        </div>
      ) : (
        <span className="audio-player-time">
          {formatTime(currentTime)} / {formatTime(effectiveDuration)}
        </span>
      )}
    </div>
  );
}
