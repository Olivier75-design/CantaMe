'use client';

// Composing a song from the browser, shared by both wizards (home `#studio`
// and `/create/preview`) so they cannot drift apart again.
//
// POST /api/generate-song answers in one of two ways:
//   • JSON — the customer had no credits: the song is saved LOCKED and must be
//     unlocked afterwards (no audio is ever sent).
//   • NDJSON stream — the customer had credits: one song was spent and the
//     MP3 arrives piece by piece while it is composed. The pieces are fed to a
//     MediaSource so playback starts after the first ~10 s of audio instead of
//     after the whole ~2 min composition.
//
// Browsers without MediaSource support for audio/mpeg (older iPhones) keep
// working: they simply wait for the finished song, as before.

import { useCallback, useEffect, useRef, useState } from 'react';
import { authHeaders } from './authClient';

// MiniMax renders at 256 kbps = 32 000 bytes per second of audio. music-2.6
// sends its pieces irregularly, so playback waits for ~10 s of audio before
// starting rather than playing the very first byte.
const START_BYTES = 10 * 32_000;

export type ComposePhase = 'idle' | 'composing' | 'live' | 'done' | 'error';
// failed: nothing was charged · refunded: the credit came back · limit: rate
// limited · interrupted: the connection dropped but the paid song is still
// being saved to the library.
export type ComposeError = 'failed' | 'refunded' | 'limit' | 'interrupted';

class ComposeFail extends Error {
  constructor(readonly kind: ComposeError) { super(kind); }
}

interface LiveAudio {
  url: string;
  append(bytes: ArrayBuffer): void;
  end(): void;
  readonly playable: boolean; // the media element attached and nothing failed
  dispose(): void;
}

function createLiveAudio(): LiveAudio | null {
  if (typeof window === 'undefined') return null;
  // iOS 17.1+ only exposes the "managed" flavour.
  const w = window as unknown as { ManagedMediaSource?: typeof MediaSource; MediaSource?: typeof MediaSource };
  const MS = w.ManagedMediaSource || w.MediaSource;
  if (!MS || typeof MS.isTypeSupported !== 'function' || !MS.isTypeSupported('audio/mpeg')) return null;

  const ms = new MS();
  const url = URL.createObjectURL(ms);
  const queue: ArrayBuffer[] = [];
  let sb: SourceBuffer | null = null;
  let ended = false;
  let failed = false;

  const pump = () => {
    if (!sb || sb.updating || failed || ms.readyState !== 'open') return;
    const next = queue.shift();
    if (next) {
      try { sb.appendBuffer(next); } catch { failed = true; }
      return;
    }
    // Only now is the total duration known, which makes the player seekable.
    if (ended) { try { ms.endOfStream(); } catch { /* already ended */ } }
  };

  ms.addEventListener('sourceopen', () => {
    if (sb) return;
    try {
      sb = ms.addSourceBuffer('audio/mpeg');
      sb.mode = 'sequence'; // MP3 carries no timestamps: play pieces back to back
      sb.addEventListener('updateend', pump);
      sb.addEventListener('error', () => { failed = true; });
      pump();
    } catch {
      failed = true;
    }
  });

  return {
    url,
    append(bytes) { queue.push(bytes); pump(); },
    end() { ended = true; pump(); },
    get playable() { return sb !== null && !failed; },
    dispose() { URL.revokeObjectURL(url); },
  };
}

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

export function useSongComposer() {
  const [phase, setPhase] = useState<ComposePhase>('idle');
  const [paid, setPaid] = useState(false); // this song was paid for at generation
  const [playerSrc, setPlayerSrc] = useState<string | null>(null); // what the player plays
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // the saved file (download, rating)
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<ComposeError | null>(null);
  const liveRef = useRef<LiveAudio | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const release = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    liveRef.current?.dispose();
    liveRef.current = null;
  }, []);

  // Leaving the page stops listening, not composing: a paid song still lands
  // in the library server-side.
  useEffect(() => release, [release]);

  // Returns 'auth' when the visitor must sign in first.
  const compose = useCallback(async (body: object): Promise<'auth' | void> => {
    release();
    setError(null);
    setAudioUrl(null);
    setPlayerSrc(null);
    setOrderId(null);
    setPaid(false);
    setPhase('composing');

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let streaming = false;

    try {
      const res = await fetch('/api/generate-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.status === 401) {
        setPhase('idle');
        return 'auth';
      }

      // No credits: a locked song, as JSON, with no audio.
      if (!(res.headers.get('content-type') || '').includes('ndjson')) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) throw new ComposeFail('limit');
        if (!res.ok || !data?.orderId) throw new ComposeFail('failed');
        setOrderId(data.orderId);
        setPhase('done');
        return;
      }

      // Credits: the song is paid for and streams in.
      streaming = true;
      setPaid(true);
      if (!res.body) throw new ComposeFail('interrupted');
      const live = createLiveAudio();
      liveRef.current = live;
      let received = 0;
      let wentLive = false;
      let finished = false;

      const handle = (line: string) => {
        const msg = JSON.parse(line);
        if (msg.type === 'audio' && typeof msg.data === 'string') {
          const bytes = fromBase64(msg.data);
          received += bytes.byteLength;
          if (!live) return; // no MediaSource: wait for the finished file
          live.append(bytes);
          if (!wentLive && received >= START_BYTES) {
            wentLive = true;
            setPlayerSrc(live.url);
            setPhase('live');
          }
        } else if (msg.type === 'done') {
          finished = true;
          live?.end();
          setOrderId(msg.orderId);
          setAudioUrl(msg.audioUrl);
          // Keep the live source when it is playing (no restart); otherwise
          // hand the player the saved file.
          if (!wentLive || !live?.playable) setPlayerSrc(msg.audioUrl);
          setPhase('done');
        } else if (msg.type === 'error') {
          throw new ComposeFail('refunded');
        }
      };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handle(line);
        }
      }
      buf += decoder.decode();
      if (buf.trim()) handle(buf.trim());
      if (!finished) throw new ComposeFail('interrupted');
    } catch (e) {
      if (ctrl.signal.aborted) return; // restarted or left the page
      const kind: ComposeError = e instanceof ComposeFail ? e.kind : streaming ? 'interrupted' : 'failed';
      setError(kind);
      setPhase('error');
    }
  }, [release]);

  // A locked song was just unlocked with credits: play the saved file.
  const markUnlocked = useCallback((url: string) => {
    setAudioUrl(url);
    setPlayerSrc(url);
  }, []);

  const reset = useCallback(() => {
    release();
    setPhase('idle');
    setPaid(false);
    setPlayerSrc(null);
    setAudioUrl(null);
    setOrderId(null);
    setError(null);
  }, [release]);

  return { phase, paid, playerSrc, audioUrl, orderId, error, compose, markUnlocked, reset };
}

// How many songs the signed-in customer can compose right now (null while
// unknown or signed out). Drives the "this uses 1 song" note on the compose
// button: composing spends a song when there is one.
export function useSongsBalance(userId: string | null | undefined, perSong: number) {
  const [songs, setSongs] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/credits', { headers: await authHeaders() });
        const data = await res.json();
        if (alive && res.ok) setSongs(Math.floor((Number(data.credits) || 0) / perSong));
      } catch { /* the note is optional */ }
    })();
    return () => { alive = false; };
  }, [userId, perSong]);
  return userId ? songs : null;
}
