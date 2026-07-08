// Database layer — Supabase PostgreSQL
// Replaces the previous JSON-file based storage with Supabase client calls.
// All functions maintain the same interface to minimize changes in pages/routes.

import { getSupabaseServer } from './supabase';

export interface Revision {
  id: string;
  order_id: string;
  notes: string;
  status: string; // 'PENDING' | 'COMPLETED'
  created_at: string;
  // Aliases for backward compatibility with existing components
  orderId?: string;
  createdAt?: string;
}

export interface DbMusicStyle {
  id: string;
  name_es: string;
  name_en: string;
  icon: string;
  color: string;
  audio_url: string;
  created_at?: string;
  // Aliases for backward compatibility
  nameEs?: string;
  nameEn?: string;
  audioUrl?: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  client_email: string;
  recipient_name: string;
  relation: string;
  occasion: string;
  style: string;
  anecdotes: string[] | string; // JSONB array in Supabase, was stringified JSON
  message: string;
  tone: string;
  voice_gender: string;
  tier: string;
  price: number;
  status: string;
  language: string;
  stripe_session_id?: string;
  audio_url?: string;
  instrumental_url?: string;
  created_at: string;
  updated_at: string;
  revisions: Revision[];
  // Aliases for backward compatibility
  clientEmail?: string;
  recipientName?: string;
  voiceGender?: string;
  stripeSessionId?: string;
  audioUrl?: string;
  instrumentalUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

// Helper: add camelCase aliases to a style row from Supabase
function mapStyle(row: DbMusicStyle): DbMusicStyle {
  return {
    ...row,
    nameEs: row.name_es,
    nameEn: row.name_en,
    audioUrl: row.audio_url,
  };
}

// Helper: add camelCase aliases to an order row from Supabase
function mapOrder(row: Order, revisions: Revision[] = []): Order {
  return {
    ...row,
    clientEmail: row.client_email,
    recipientName: row.recipient_name,
    voiceGender: row.voice_gender,
    stripeSessionId: row.stripe_session_id,
    audioUrl: row.audio_url,
    instrumentalUrl: row.instrumental_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id || undefined,
    revisions: revisions.map(mapRevision),
  };
}

// Helper: add camelCase aliases to a revision row
function mapRevision(row: Revision): Revision {
  return {
    ...row,
    orderId: row.order_id,
    createdAt: row.created_at,
  };
}

export const db = {
  // ─── Styles ────────────────────────────────────────────────────────

  getStyles: async (): Promise<DbMusicStyle[]> => {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('music_styles')
      .select('*')
      .order('id');

    if (error) {
      console.error('Error fetching styles:', error);
      return [];
    }
    return (data || []).map(mapStyle);
  },

  getStyleById: async (id: string): Promise<DbMusicStyle | null> => {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('music_styles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return mapStyle(data);
  },

  createStyle: async (styleData: Partial<DbMusicStyle>): Promise<DbMusicStyle> => {
    const supabase = getSupabaseServer();
    const row = {
      id: styleData.id || styleData.id || crypto.randomUUID().slice(0, 8),
      name_es: styleData.name_es || styleData.nameEs || 'Nuevo Estilo',
      name_en: styleData.name_en || styleData.nameEn || 'New Style',
      icon: styleData.icon || '🎵',
      color: styleData.color || '#FF8906',
      audio_url: styleData.audio_url || styleData.audioUrl || '',
    };

    const { data, error } = await supabase
      .from('music_styles')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Error creating style:', error);
      throw new Error(`Failed to create style: ${error.message}`);
    }
    return mapStyle(data);
  },

  updateStyle: async (id: string, updates: Partial<DbMusicStyle>): Promise<DbMusicStyle | null> => {
    const supabase = getSupabaseServer();
    // Map camelCase to snake_case
    const row: Record<string, unknown> = {};
    if (updates.name_es !== undefined || updates.nameEs !== undefined)
      row.name_es = updates.name_es || updates.nameEs;
    if (updates.name_en !== undefined || updates.nameEn !== undefined)
      row.name_en = updates.name_en || updates.nameEn;
    if (updates.icon !== undefined) row.icon = updates.icon;
    if (updates.color !== undefined) row.color = updates.color;
    if (updates.audio_url !== undefined || updates.audioUrl !== undefined)
      row.audio_url = updates.audio_url || updates.audioUrl;

    const { data, error } = await supabase
      .from('music_styles')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return null;
    return mapStyle(data);
  },

  deleteStyle: async (id: string): Promise<boolean> => {
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('music_styles')
      .delete()
      .eq('id', id);

    return !error;
  },

  // ─── Orders ────────────────────────────────────────────────────────

  getOrders: async (filter?: { status?: string; email?: string }): Promise<Order[]> => {
    const supabase = getSupabaseServer();
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

    if (filter?.status) query = query.eq('status', filter.status);
    if (filter?.email) query = query.ilike('client_email', filter.email);

    const { data: orders, error } = await query;
    if (error) {
      console.error('Error fetching orders:', error);
      return [];
    }

    // Fetch all revisions for these orders in one query
    const orderIds = (orders || []).map((o: Order) => o.id);
    let revisions: Revision[] = [];
    if (orderIds.length > 0) {
      const { data: revData } = await supabase
        .from('revisions')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });
      revisions = revData || [];
    }

    return (orders || []).map((order: Order) => {
      const orderRevisions = revisions.filter((r: Revision) => r.order_id === order.id);
      return mapOrder(order, orderRevisions);
    });
  },

  getOrderById: async (id: string): Promise<Order | null> => {
    const supabase = getSupabaseServer();
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) return null;

    const { data: revData } = await supabase
      .from('revisions')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false });

    return mapOrder(order, revData || []);
  },

  createOrder: async (orderData: Partial<Order>): Promise<Order> => {
    const supabase = getSupabaseServer();

    // Handle anecdotes: accept both string (legacy) and array formats
    let anecdotes = orderData.anecdotes || [];
    if (typeof anecdotes === 'string') {
      try { anecdotes = JSON.parse(anecdotes); } catch { anecdotes = []; }
    }

    const row = {
      id: orderData.id || crypto.randomUUID(),
      user_id: orderData.user_id || orderData.userId || null,
      client_email: orderData.client_email || orderData.clientEmail || '',
      recipient_name: orderData.recipient_name || orderData.recipientName || '',
      relation: orderData.relation || '',
      occasion: orderData.occasion || '',
      style: orderData.style || null,
      anecdotes,
      message: orderData.message || '',
      tone: orderData.tone || 'emotional',
      voice_gender: orderData.voice_gender || orderData.voiceGender || 'female',
      tier: orderData.tier || 'basica',
      price: orderData.price || 10,
      status: orderData.status || 'PENDING_PAYMENT',
      language: orderData.language || 'es',
      stripe_session_id: orderData.stripe_session_id || orderData.stripeSessionId || null,
      audio_url: orderData.audio_url || orderData.audioUrl || null,
      instrumental_url: orderData.instrumental_url || orderData.instrumentalUrl || null,
    };

    const { data, error } = await supabase
      .from('orders')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }
    return mapOrder(data);
  },

  updateOrder: async (id: string, updates: Partial<Order>): Promise<Order | null> => {
    const supabase = getSupabaseServer();

    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (updates.status !== undefined) row.status = updates.status;
    if (updates.audio_url !== undefined || updates.audioUrl !== undefined)
      row.audio_url = updates.audio_url || updates.audioUrl;
    if (updates.instrumental_url !== undefined || updates.instrumentalUrl !== undefined)
      row.instrumental_url = updates.instrumental_url || updates.instrumentalUrl;
    if (updates.stripe_session_id !== undefined || updates.stripeSessionId !== undefined)
      row.stripe_session_id = updates.stripe_session_id || updates.stripeSessionId;
    if (updates.client_email !== undefined || updates.clientEmail !== undefined)
      row.client_email = updates.client_email || updates.clientEmail;

    const { data, error } = await supabase
      .from('orders')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return null;

    const { data: revData } = await supabase
      .from('revisions')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false });

    return mapOrder(data, revData || []);
  },

  createRevision: async (orderId: string, notes: string): Promise<Revision | null> => {
    const supabase = getSupabaseServer();

    // Insert the revision
    const { data: revision, error: revError } = await supabase
      .from('revisions')
      .insert({ order_id: orderId, notes, status: 'PENDING' })
      .select()
      .single();

    if (revError) {
      console.error('Error creating revision:', revError);
      return null;
    }

    // Also update order status to REVISION_REQUESTED
    await supabase
      .from('orders')
      .update({ status: 'REVISION_REQUESTED', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    return mapRevision(revision);
  },
};
