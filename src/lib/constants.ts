// Occasion and Style data constants used across the app

export interface Occasion {
  id: string;
  icon: string;
  nameKey: string;
}

export interface MusicStyle {
  id: string;
  icon: string;
  nameKey: string;
  color: string;
  audioUrl: string;
}

export const OCCASIONS: Occasion[] = [
  { id: 'quinceanera', icon: '👑', nameKey: 'occasions.quinceanera' },
  { id: 'boda', icon: '💒', nameKey: 'occasions.boda' },
  { id: 'cumpleanos', icon: '🎂', nameKey: 'occasions.cumpleanos' },
  { id: 'serenata', icon: '🌙', nameKey: 'occasions.serenata' },
  { id: 'diaMadres', icon: '🌹', nameKey: 'occasions.diaMadres' },
  { id: 'graduacion', icon: '🎓', nameKey: 'occasions.graduacion' },
  { id: 'declaracion', icon: '💘', nameKey: 'occasions.declaracion' },
  { id: 'sanValentin', icon: '❤️', nameKey: 'occasions.sanValentin' },
  { id: 'bautizo', icon: '⛪', nameKey: 'occasions.bautizo' },
  { id: 'otro', icon: '🎵', nameKey: 'occasions.otro' },
];

export const MUSIC_STYLES: MusicStyle[] = [
  { id: 'bachata', icon: '💃', nameKey: 'styles.bachata', color: '#E040A0', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'cumbia', icon: '🥁', nameKey: 'styles.cumbia', color: '#FFD700', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'reggaeton', icon: '🔥', nameKey: 'styles.reggaeton', color: '#FF8906', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 'corridos', icon: '🤠', nameKey: 'styles.corridos', color: '#2CB67D', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: 'vallenato', icon: '🪗', nameKey: 'styles.vallenato', color: '#7F5AF0', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: 'salsa', icon: '🎺', nameKey: 'styles.salsa', color: '#F25F4C', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { id: 'ranchera', icon: '🎸', nameKey: 'styles.ranchera', color: '#FF6B35', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { id: 'bolero', icon: '🌹', nameKey: 'styles.bolero', color: '#C850C0', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 'merengue', icon: '🎶', nameKey: 'styles.merengue', color: '#00D2FF', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { id: 'balada', icon: '🎤', nameKey: 'styles.balada', color: '#A855F7', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
];

// Recommended style per occasion (for "Surprise Me" feature)
export const OCCASION_STYLE_MAP: Record<string, string[]> = {
  quinceanera: ['bachata', 'vallenato', 'cumbia'],
  boda: ['bolero', 'bachata', 'balada'],
  cumpleanos: ['cumbia', 'reggaeton', 'merengue'],
  serenata: ['bolero', 'ranchera', 'bachata'],
  diaMadres: ['bolero', 'ranchera', 'balada'],
  graduacion: ['reggaeton', 'cumbia', 'balada'],
  declaracion: ['bachata', 'bolero', 'balada'],
  sanValentin: ['bachata', 'bolero', 'balada'],
  bautizo: ['bolero', 'balada', 'ranchera'],
  otro: ['bachata', 'cumbia', 'reggaeton'],
};

export const TIERS = {
  basica: { price: 10, delivery: '48h' },
  especial: { price: 20, delivery: '48h' },
  premium: { price: 35, delivery: '24h' },
} as const;

export type TierKey = keyof typeof TIERS;

// Sample gallery entries for demo purposes
export interface GalleryEntry {
  id: string;
  occasion: string;
  style: string;
  recipientName: string;
  description: string;
  audioUrl: string;
}

export const GALLERY_SAMPLES: GalleryEntry[] = [
  { id: 'g1', occasion: 'quinceanera', style: 'bachata', recipientName: 'Valentina', description: 'A sweet bachata for her quinceañera', audioUrl: '/audio/g1.mp3' },
  { id: 'g2', occasion: 'boda', style: 'bolero', recipientName: 'Ana & Miguel', description: 'A romantic bolero for their wedding', audioUrl: '/audio/g2.mp3' },
  { id: 'g3', occasion: 'cumpleanos', style: 'cumbia', recipientName: 'Don Roberto', description: 'A festive cumbia for his 60th birthday', audioUrl: '/audio/g3.mp3' },
  { id: 'g4', occasion: 'serenata', style: 'ranchera', recipientName: 'Sofía', description: 'A heartfelt ranchera serenade', audioUrl: '/audio/g4.mp3' },
  { id: 'g5', occasion: 'diaMadres', style: 'balada', recipientName: 'Mamá Rosa', description: 'An emotional ballad for Mother\'s Day', audioUrl: '/audio/g5.mp3' },
  { id: 'g6', occasion: 'declaracion', style: 'bachata', recipientName: 'Camila', description: 'A romantic bachata love declaration', audioUrl: '/audio/g6.mp3' },
  { id: 'g7', occasion: 'graduacion', style: 'reggaeton', recipientName: 'Diego', description: 'A celebratory reggaeton for his graduation', audioUrl: '/audio/g7.mp3' },
  { id: 'g8', occasion: 'cumpleanos', style: 'salsa', recipientName: 'Abuela Carmen', description: 'A lively salsa for grandma\'s birthday', audioUrl: '/audio/g8.mp3' },
  { id: 'g9', occasion: 'sanValentin', style: 'bolero', recipientName: 'Mi Amor', description: 'A tender bolero for Valentine\'s Day', audioUrl: '/audio/g9.mp3' },
  { id: 'g10', occasion: 'serenata', style: 'vallenato', recipientName: 'Lucía', description: 'A beautiful vallenato serenade', audioUrl: '/audio/g10.mp3' },
  { id: 'g11', occasion: 'quinceanera', style: 'cumbia', recipientName: 'Isabella', description: 'A joyful cumbia for her quinceañera', audioUrl: '/audio/g11.mp3' },
  { id: 'g12', occasion: 'boda', style: 'bachata', recipientName: 'Carlos & María', description: 'A passionate bachata wedding song', audioUrl: '/audio/g12.mp3' },
];
