'use client';

import { useLanguage } from '@/context/LanguageContext';

// Simple bilingual legal page. Content is kept inline (not in locale JSON) to
// avoid bloating the translation files with long-form legal copy; language is
// detected with the same pattern used elsewhere (t('nav.login') === 'Log in').
export default function PrivacyPage() {
  const { t } = useLanguage();
  const isEn = t('nav.login') === 'Log in';

  const updated = isEn ? 'Last updated: July 2026' : 'Última actualización: julio de 2026';

  const sections = isEn
    ? [
        {
          h: '1. Who we are',
          p: 'CantaMe ("we", "us") creates personalized songs using AI. This policy explains what data we collect and how we use it when you use cantame.app.',
        },
        {
          h: '2. Information we collect',
          p: 'Account data (name, email) when you sign up; the details you provide to generate a song (recipient name, occasion, message, style); and technical data such as your browser type and usage of the site. If you sign in with Google, we receive your name and email from Google.',
        },
        {
          h: '3. How we use your information',
          p: 'To create and deliver your songs, manage your account and credits, process payments, provide support, and improve the service. We do not sell your personal data.',
        },
        {
          h: '4. Payments',
          p: 'Payments are processed by our payment provider (Moneroo). We do not store your full card details on our servers; they are handled directly by the provider.',
        },
        {
          h: '5. AI generation',
          p: 'The brief you submit (recipient, occasion, message, style) is sent to our AI providers to generate lyrics and audio. Do not include sensitive personal information you would not want processed this way.',
        },
        {
          h: '6. Storage & security',
          p: 'Your songs and account data are stored securely with our infrastructure providers. We take reasonable measures to protect your information, though no method of transmission over the internet is 100% secure.',
        },
        {
          h: '7. Your rights',
          p: 'You may request access to, correction of, or deletion of your personal data, and you can delete your account at any time by contacting us.',
        },
        {
          h: '8. Contact',
          p: 'Questions about this policy? Email us at hello@cantame.app.',
        },
      ]
    : [
        {
          h: '1. Quiénes somos',
          p: 'CantaMe ("nosotros") crea canciones personalizadas usando IA. Esta política explica qué datos recopilamos y cómo los usamos cuando utilizas cantame.app.',
        },
        {
          h: '2. Información que recopilamos',
          p: 'Datos de cuenta (nombre, correo) al registrarte; los detalles que proporcionas para generar una canción (nombre del destinatario, ocasión, mensaje, estilo); y datos técnicos como el tipo de navegador y el uso del sitio. Si inicias sesión con Google, recibimos tu nombre y correo desde Google.',
        },
        {
          h: '3. Cómo usamos tu información',
          p: 'Para crear y entregar tus canciones, gestionar tu cuenta y créditos, procesar pagos, dar soporte y mejorar el servicio. No vendemos tus datos personales.',
        },
        {
          h: '4. Pagos',
          p: 'Los pagos son procesados por nuestro proveedor de pagos (Moneroo). No almacenamos los datos completos de tu tarjeta en nuestros servidores; los gestiona directamente el proveedor.',
        },
        {
          h: '5. Generación con IA',
          p: 'El resumen que envías (destinatario, ocasión, mensaje, estilo) se envía a nuestros proveedores de IA para generar la letra y el audio. No incluyas información personal sensible que no quieras que se procese de esta forma.',
        },
        {
          h: '6. Almacenamiento y seguridad',
          p: 'Tus canciones y datos de cuenta se almacenan de forma segura con nuestros proveedores de infraestructura. Tomamos medidas razonables para proteger tu información, aunque ningún método de transmisión por internet es 100% seguro.',
        },
        {
          h: '7. Tus derechos',
          p: 'Puedes solicitar el acceso, la corrección o la eliminación de tus datos personales, y puedes eliminar tu cuenta en cualquier momento contactándonos.',
        },
        {
          h: '8. Contacto',
          p: '¿Preguntas sobre esta política? Escríbenos a hello@cantame.app.',
        },
      ];

  return (
    <div className="section">
      <div className="container container-narrow">
        <div className="mb-2xl animate-fade-in">
          <h1 className="heading-lg mb-sm">{isEn ? 'Privacy Policy' : 'Política de Privacidad'}</h1>
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
