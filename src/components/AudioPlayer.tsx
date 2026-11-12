'use client';

import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';

interface AudioPlayerProps {
  src?: string;
  title?: string;
  variant?: 'default' | 'large' | 'mini';
  showVisualizer?: boolean;
  maxDuration?: number; // limit playback to N seconds (for previews)
  onEnded?: () => void;
  autoPlay?: boolean; // try to start on its own (browsers may refuse: ▶ stays)
  // The song is still being composed and streams in (MediaSource): its total
  // length is unknown, so there is nothing to seek to yet.
  live?: boolean;
}

export default function AudioPlayer({
  src,
  title,
  variant = 'default',
  showVisualizer = false,
  maxDuration,
  onEnded,
  autoPlay = false,
  live = false,
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
      audio.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, [isPlaying, src]);

  // Safari only opens a streamed (Managed)MediaSource on an element whose
  // remote playback (AirPlay) is disabled. Set before the source loads.
  useLayoutEffect(() => {
    const audio = audioRef.current as (HTMLAudioElement & { disableRemotePlayback?: boolean }) | null;
    if (live && audio) audio.disableRemotePlayback = true;
  }, [live]);

  useEffect(() => {
    if (!autoPlay || !src) return;
    audioRef.current?.play().catch(() => { /* needs a tap: ▶ stays visible */ });
  }, [autoPlay, src]);

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

    // A streamed song has no finite duration until it is complete.
    const onLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEndedHandler = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEndedHandler);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
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
    if (!audio || live || !effectiveDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const targetTime = ratio * effectiveDuration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const progress = !live && effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  if (variant === 'mini') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <audio ref={audioRef} src={src} preload="metadata" />
        <button
          className="audio-player-play"
          onClick={togglePlay}
          disabled={!src}
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
        disabled={!src}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div className="audio-player-info">
        {title && <div className="audio-player-title">{title}</div>}
        <div className={`audio-player-progress ${live ? 'is-live' : ''}`} onClick={handleProgressClick}>
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
          {live ? formatTime(currentTime) : `${formatTime(currentTime)} / ${formatTime(effectiveDuration)}`}
        </span>
      )}
    </div>
  );
}
