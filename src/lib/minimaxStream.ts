// MiniMax music generation in streaming mode (`stream: true`).
//
// Kept free of imports on purpose: it is the one piece of the live-playback
// path that talks to MiniMax, and a self-contained module can be exercised
// against a local mock SSE server without a build or a paid generation.
//
// What the stream looks like (measured 2026-08-25 on the production key):
//   • Content-Type text/event-stream, lines `data: {"data":{"audio":"<hex>","status":1}}`.
//   • `status: 1` messages carry the song INCREMENTALLY, in order.
//   • One closing `status: 2` message carries the COMPLETE file again — it is
//     byte-identical to the concatenated `status: 1` chunks. Never append it to
//     them: that produces a song that plays twice.
//   • The closing message lands well after the last audio chunk, so the
//     listener is already near the end of the song by the time it arrives.
//   • An error comes back as a plain JSON body (or an SSE message) with a
//     non-zero `base_resp.status_code`.

type MiniMaxMessage = {
  data?: { audio?: string; status?: number };
  base_resp?: { status_code?: number; status_msg?: string };
};

function failIfError(msg: MiniMaxMessage) {
  const code = msg?.base_resp?.status_code;
  if (code !== undefined && code !== 0) {
    throw new Error(`MiniMax (musica): ${code} ${msg?.base_resp?.status_msg ?? ''}`.trim());
  }
}

// Calls MiniMax with `stream: true`, hands every incremental chunk to `onChunk`
// as soon as it arrives, and resolves with the complete MP3.
export async function streamMusic(opts: {
  host: string;
  key: string;
  model: string;
  prompt: string;
  lyrics: string;
  audioSetting: Record<string, unknown>;
  onChunk: (chunk: Buffer) => void;
  // Give up (and let the caller refund) before the platform kills the
  // function: a killed function cannot refund the song it already charged.
  timeoutMs?: number;
}): Promise<Buffer> {
  const res = await fetch(`${opts.host}/v1/music_generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      lyrics: opts.lyrics,
      stream: true,
      output_format: 'hex', // streaming only exists in hex mode
      audio_setting: opts.audioSetting,
    }),
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });

  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/event-stream')) {
    // Not a stream: an error reply (bad key, invalid params, quota...).
    const text = await res.text();
    let msg: MiniMaxMessage = {};
    try { msg = JSON.parse(text); } catch { /* not JSON */ }
    failIfError(msg);
    throw new Error(`MiniMax (musica): unexpected reply ${res.status} ${type}`);
  }
  if (!res.body) throw new Error('MiniMax (musica): empty stream');

  const parts: Buffer[] = [];
  // `as`: assigned inside handle(), so TS must not narrow it to null.
  let complete = null as Buffer | null;

  const handle = (line: string) => {
    if (!line.startsWith('data:')) return; // comments, event names, keep-alives
    const json = line.slice(5).trim();
    if (!json || json === '[DONE]') return;
    const msg = JSON.parse(json) as MiniMaxMessage;
    failIfError(msg);
    const hex = msg?.data?.audio;
    if (!hex) return;
    const bytes = Buffer.from(hex, 'hex');
    if (msg.data?.status === 2) {
      complete = bytes; // the whole file again: archive it, don't replay it
    } else {
      parts.push(bytes);
      opts.onChunk(bytes);
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, '');
      buffer = buffer.slice(nl + 1);
      handle(line);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) handle(buffer.trim());

  const streamed = Buffer.concat(parts);
  if (complete) {
    if (streamed.length && complete.length !== streamed.length) {
      // The listener heard `streamed`; the archive keeps MiniMax's own file.
      console.warn(`MiniMax stream: chunks ${streamed.length}B vs complete ${complete.length}B`);
    }
    return complete;
  }
  if (!streamed.length) throw new Error('MiniMax no devolvio audio.');
  return streamed;
}
