'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

// 👍 / 👎 on a finished song. Drop it anywhere a customer has just heard one.
//
// The settings that produced the song travel with the vote so the admin can
// compare quality per style/voice/tone — a bare thumb tells you the average is
// bad but never which knob to turn.
// Nullable throughout: callers hold these as `string | null` state straight off
// the generation response, and forcing each one to coalesce is just noise.
interface Props {
  audioUrl?: string | null;
  orderId?: string | null;
  style?: string | null;
  tone?: string | null;
  voiceGender?: string | null;
  occasion?: string | null;
}

export default function SongRating({ audioUrl, orderId, style, tone, voiceGender, occasion }: Props) {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const [chosen, setChosen] = useState<'up' | 'down' | null>(null);
  const [failed, setFailed] = useState(false);

  const send = async (rating: 'up' | 'down') => {
    // Optimistic: the thank-you shows immediately. A lost vote is not worth
    // making the customer wait on a spinner.
    setChosen(rating);
    setFailed(false);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ rating, audioUrl, orderId, style, tone, voiceGender, occasion, language: lang }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setChosen(null);
      setFailed(true);
    }
  };

  if (chosen) {
    return (
      <p className="body-sm" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
        {chosen === 'up' ? '👍' : '👎'} {t('rating.thanks')}
      </p>
    );
  }

  return (
    <div className="text-center">
      <p className="body-sm" style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-muted)' }}>
        {t('rating.question')}
      </p>
      <div className="flex gap-sm" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => send('up')} aria-label={t('rating.good')}>
          👍 {t('rating.good')}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => send('down')} aria-label={t('rating.bad')}>
          👎 {t('rating.bad')}
        </button>
      </div>
      {failed && (
        <p className="body-sm" style={{ color: '#DC2626', marginTop: 'var(--space-sm)' }} role="alert">
          {t('rating.failed')}
        </p>
      )}
    </div>
  );
}
