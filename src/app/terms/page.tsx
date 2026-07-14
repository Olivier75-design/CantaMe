'use client';

import { useLanguage } from '@/context/LanguageContext';

// Simple bilingual legal page. See privacy/page.tsx for the rationale on keeping
// long-form legal copy inline rather than in the locale JSON files.
export default function TermsPage() {
  const { t } = useLanguage();
  const isEn = t('nav.login') === 'Log in';

  const updated = isEn ? 'Last updated: July 2026' : 'Última actualización: julio de 2026';

  const sections = isEn
    ? [
        {
          h: '1. Acceptance of terms',
          p: 'By using cantame.app you agree to these Terms of Service. If you do not agree, please do not use the service.',
        },
        {
          h: '2. The service',
          p: 'CantaMe generates personalized songs (lyrics and audio) using AI based on the brief you provide. Output is generated automatically and results may vary.',
        },
        {
          h: '3. Accounts',
          p: 'You are responsible for keeping your account credentials secure and for all activity under your account. You must provide accurate information.',
        },
        {
          h: '4. Credits & payments',
          p: 'The service works with credits. New accounts receive free credits; creating a song and requesting a revision each consume credits. Additional credits can be purchased in packs. Credits have no cash value and are non-transferable.',
        },
        {
          h: '5. Refunds',
          p: 'Because songs are generated on demand and delivered immediately, credits spent on a completed generation are generally non-refundable. If a generation fails for technical reasons, the credits are returned to your balance.',
        },
        {
          h: '6. Your content & acceptable use',
          p: 'You are responsible for the briefs you submit and confirm you have the right to use any names or details you include. Do not use the service to create hateful, illegal, defamatory, or infringing content, or to impersonate others.',
        },
        {
          h: '7. Ownership of songs',
          p: 'Subject to your payment and these terms, you may use the songs you generate for personal and gift purposes. We retain rights to the underlying technology and the service itself.',
        },
        {
          h: '8. Disclaimer',
          p: 'The service is provided "as is" without warranties of any kind. AI-generated output may contain errors and we do not guarantee any specific result.',
        },
        {
          h: '9. Changes',
          p: 'We may update these terms from time to time. Continued use of the service after changes means you accept the updated terms.',
        },
        {
          h: '10. Contact',
          p: 'Questions about these terms? Email us at hello@cantame.app.',
        },
      ]
    : [
        {
          h: '1. Aceptación de los términos',
          p: 'Al utilizar cantame.app aceptas estos Términos del Servicio. Si no estás de acuerdo, por favor no uses el servicio.',
        },
        {
          h: '2. El servicio',
          p: 'CantaMe genera canciones personalizadas (letra y audio) usando IA a partir del resumen que proporcionas. El resultado se genera automáticamente y puede variar.',
        },
        {
          h: '3. Cuentas',
          p: 'Eres responsable de mantener seguras tus credenciales y de toda la actividad en tu cuenta. Debes proporcionar información veraz.',
        },
        {
          h: '4. Créditos y pagos',
          p: 'El servicio funciona con créditos. Las cuentas nuevas reciben créditos gratis; crear una canción y pedir una revisión consumen créditos. Puedes comprar créditos adicionales en paquetes. Los créditos no tienen valor en efectivo y no son transferibles.',
        },
        {
          h: '5. Reembolsos',
          p: 'Debido a que las canciones se generan bajo demanda y se entregan de inmediato, los créditos gastados en una generación completada generalmente no son reembolsables. Si una generación falla por motivos técnicos, los créditos se devuelven a tu saldo.',
        },
        {
          h: '6. Tu contenido y uso aceptable',
          p: 'Eres responsable de los resúmenes que envías y confirmas que tienes derecho a usar los nombres o detalles que incluyas. No uses el servicio para crear contenido de odio, ilegal, difamatorio o que infrinja derechos, ni para suplantar a otras personas.',
        },
        {
          h: '7. Propiedad de las canciones',
          p: 'Sujeto a tu pago y a estos términos, puedes usar las canciones que generes con fines personales y de regalo. Conservamos los derechos sobre la tecnología subyacente y el propio servicio.',
        },
        {
          h: '8. Descargo de responsabilidad',
          p: 'El servicio se ofrece "tal cual", sin garantías de ningún tipo. El resultado generado por IA puede contener errores y no garantizamos un resultado específico.',
        },
        {
          h: '9. Cambios',
          p: 'Podemos actualizar estos términos ocasionalmente. El uso continuado del servicio tras los cambios significa que aceptas los términos actualizados.',
        },
        {
          h: '10. Contacto',
          p: '¿Preguntas sobre estos términos? Escríbenos a hello@cantame.app.',
        },
      ];

  return (
    <div className="section">
      <div className="container container-narrow">
        <div className="mb-2xl animate-fade-in">
          <h1 className="heading-lg mb-sm">{isEn ? 'Terms of Service' : 'Términos del Servicio'}</h1>
          <p className="body-sm" style={{ color: 'var(--text-muted)' }}>{updated}</p>
        </div>

        <div className="stagger-children">
          {sections.map((s, i) => (
            <div key={i} className="mb-lg">
              <h3 className="heading-md mb-sm">{s.h}</h3>
              <p className="body-md">{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
