// Shared song-generation pipeline (MiniMax lyrics + music), used by
// /api/generate-song (the customer's song) and /api/orders/[id] (live revision).
// Audio is uploaded to Supabase Storage instead of local filesystem.
import { randomUUID } from 'node:crypto';
import { buildStylePrompt, type SongBrief } from './musicPrompts';
import { writeLyrics } from './lyrics';
import { getSupabaseServer } from './supabase';
import { streamMusic } from './minimaxStream';

const HOST = process.env.MINIMAX_API_HOST || 'https://api.minimax.io';
const KEY = process.env.MINIMAX_API_KEY;

// music-2.6 on purpose: music-3.0 was judged by ear and rejected (an audible
// breath artefact at the end of the track). Any swap must be re-listened to.
const MODEL = 'music-2.6';
const AUDIO_SETTING = { sample_rate: 44100, bitrate: 256000, format: 'mp3' };

async function generateMusic(
  prompt: string,
  lyrics: string,
  onAudio?: (chunk: Buffer) => void,
): Promise<Buffer> {
  // Streaming mode: same song, but its first seconds arrive while the rest is
  // still being composed, so a paying customer can start listening early.
  if (onAudio) {
    // 270 s: under the route's maxDuration (300), with room left to upload,
    // save the order — or refund. A full stream measured ~160 s.
    return streamMusic({
      host: HOST, key: KEY!, model: MODEL, prompt, lyrics,
      audioSetting: AUDIO_SETTING, onChunk: onAudio, timeoutMs: 270_000,
    });
  }
  const res = await fetch(`${HOST}/v1/music_generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      lyrics,
      audio_setting: AUDIO_SETTING,
    }),
  });
  const data = await res.json();
  if (data?.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax (musica): ${data?.base_resp?.status_code} ${data?.base_resp?.status_msg}`);
  }
  const hex: string = data?.data?.audio;
  if (!hex) throw new Error('MiniMax no devolvio audio.');
  return Buffer.from(hex, 'hex');
}

export interface GenerateInput extends SongBrief {
  songLanguage?: string;
  lyrics?: string; // pre-written / user-edited lyrics; skips generation when present
  title?: string;
}

// MiniMax silently truncates over-long lyrics, which cuts the vocal off
// mid-phrase and sounds broken. If the writer overshoots, cut it ourselves at a
// clean boundary instead: prefer the end of a tagged section, else the last
// whole line. A slightly shorter song always beats a garbled one.
const LYRICS_MAX_CHARS = 1500;

function fitLyricsToWindow(full: string): string {
  if (full.length <= LYRICS_MAX_CHARS) return full;

  const lines = full.split('\n');
  let used = 0;
  let lastLine = 0; // lines kept up to the last complete line
  let lastSection = 0; // lines kept up to the end of the last complete section

  for (let i = 0; i < lines.length; i++) {
    const next = used + lines[i].length + 1;
    if (next > LYRICS_MAX_CHARS) break;
    // A new section tag means everything before it is a complete section.
    if (/^\s*\[[^\]]+\]/.test(lines[i]) && i > 0) lastSection = i;
    used = next;
    lastLine = i + 1;
  }

  const cut = lastSection > 0 ? lastSection : lastLine;
  const result = lines.slice(0, cut).join('\n').trim();
  return result || full.slice(0, LYRICS_MAX_CHARS);
}

// Full pipeline: lyrics -> music -> uploaded to Supabase Storage. Returns the public URL + metadata.
// `onAudio`, when given, switches MiniMax to streaming and receives each piece
// of the MP3 as it is produced. Only pass it once the song is paid for: those
// bytes are the song itself.
export async function generateSongFile(
  input: GenerateInput,
  revisionNotes?: string,
  onAudio?: (chunk: Buffer) => void,
): Promise<{ audioUrl: string; title: string; lyrics: string }> {
  if (!KEY) {
    throw new Error('MINIMAX_API_KEY manquant cote serveur. Ajoute-le dans .env.local puis redemarre le serveur.');
  }
  const language = input.songLanguage || 'es';

  // Use the caller's edited lyrics when provided; otherwise write them now.
  let title: string;
  let lyrics: string;
  if (input.lyrics && input.lyrics.trim()) {
    lyrics = input.lyrics;
    title = input.title || 'Cancion';
  } else {
    ({ title, lyrics } = await writeLyrics(input, language, revisionNotes));
  }

  const prompt = buildStylePrompt(input.style, input.tone, input.voiceGender);
  // One generation produces the real, full-length (~2 min) song the customer
  // keeps — there is no separate preview render. Guard the lyrics window so the
  // vocal never gets cut off mid-phrase by the music model.
  const audio = await generateMusic(prompt, fitLyricsToWindow(lyrics), onAudio);

  // Upload to Supabase Storage
  const supabase = getSupabaseServer();
  const fileId = randomUUID();
  const filePath = `generated/${fileId}.mp3`;

  const { error: uploadError } = await supabase.storage
    .from('songs')
    .upload(filePath, audio, {
      contentType: 'audio/mpeg',
      upsert: false,
    });

  if (uploadError) {
    console.error('Supabase Storage upload error:', uploadError);
    throw new Error(`Failed to upload audio: ${uploadError.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('songs')
    .getPublicUrl(filePath);

  const audioUrl = publicUrlData.publicUrl;

  return { audioUrl, title, lyrics };
}
