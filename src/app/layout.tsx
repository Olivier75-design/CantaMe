import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "CantaMe — Canciones Personalizadas en Estilos Latinos",
  description:
    "Crea una canción personalizada en Bachata, Cumbia, Reggaetón, Corridos, Vallenato, Salsa y más. El regalo perfecto para quinceañeras, bodas, serenatas y cumpleaños. Create personalized songs in authentic Latin styles.",
  keywords: [
    "canción personalizada",
    "personalized song",
    "bachata",
    "cumbia",
    "reggaeton",
    "corridos",
    "vallenato",
    "quinceañera",
    "serenata",
    "regalo musical",
    "AI music",
    "Latin music",
  ],
  openGraph: {
    title: "CantaMe — A Song Made Just for Them",
    description:
      "Create personalized songs in authentic Latin styles for any special occasion.",
    type: "website",
    locale: "es_LA",
    alternateLocale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <AuthProvider>
            <Header />
            <main className="page-wrapper">{children}</main>
            <Footer />
          </AuthProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
