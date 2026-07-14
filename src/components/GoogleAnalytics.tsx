'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Google Analytics 4. Loads gtag and reports a page_view on the first load and
// on every client-side route change (App Router navigations don't reload the
// page, so we re-run `config` with the new path).
export default function GoogleAnalytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    // @ts-expect-error gtag is injected by the script below
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    // @ts-expect-error gtag is injected by the script below
    window.gtag('config', gaId, { page_path: pathname });
  }, [pathname, gaId]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
      </Script>
    </>
  );
}
