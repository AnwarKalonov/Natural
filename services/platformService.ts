export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';
import { createClient } from '@supabase/supabase-js';
export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

type OAuthProvider = 'google' | 'github';
type PkcePair = { verifier: string; challenge: string };

export interface UsageStats {
  aiRequests: number;
  tokensUsed: number;
  projectsCreated: number;
  storageBytes: number;
  activeSessions: number;
  aiLimit: number;
}

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  avatar: string;
  bio: string;
  emailVerified: boolean;
  isBanned: boolean;
  isAdmin: boolean;
  subscription: SubscriptionTier;
  usage: UsageStats;
  createdAt: number;
  updatedAt: number;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: TeamRole;
  invitedAt: number;
  accepted: boolean;
}

export interface TeamRecord {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: TeamMember[];
  invites: TeamInvite[];
  createdAt: number;
  updatedAt: number;
}

export interface DirectChatSummary {
  chatId: string;
  otherUserId: string;
  otherName: string;
  otherEmail: string;
  otherAvatar: string;
}

export interface DirectMessageReaction {
  emoji: string;
  count: number;
  active: boolean;
}

export interface DirectMessageAttachment {
  id?: string;
  type: 'image' | 'gif' | 'video' | 'file';
  url: string;
  name: string;
  size?: string;
  file?: File;
}

export interface DirectChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isEdited?: boolean;
  attachments?: DirectMessageAttachment[];
  reactions?: DirectMessageReaction[];
}

export interface GroupChatSummary {
  id: string;
  name: string;
  avatar?: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupChatMessage {
  id: string;
  groupChatId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
  isEdited?: boolean;
  reactions?: DirectMessageReaction[];
}

export interface ChatRequestRecord {
  id: string;
  email: string;
  type: 'direct' | 'group';
  groupName?: string;
  createdAt: string;
}

export interface DirectChatSeenStatus {
  chatId: string;
  otherLastSeenAt: string | null;
}

export interface ChatUserSettings {
  chatKind: 'direct' | 'group' | 'channel';
  chatId: string;
  mutedUntil: string | null;
  notificationsEnabled: boolean;
  soundsEnabled: boolean;
  mentionNotifications: boolean;
  showEmbeds: boolean;
  compactMode: boolean;
  enterToSend: boolean;
  readReceipts: boolean;
  pinned: boolean;
  nickname: string;
  theme: 'default' | 'midnight' | 'forest' | 'sunset';
  extras: Record<string, any>;
}

export interface ChatTypingPresence {
  userId: string;
  name: string;
  avatar: string;
  isAvatarImage: boolean;
}

export interface BasicProfile {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  isAvatarImage: boolean;
}

export type ChatCallSignalType = 'offer' | 'answer' | 'ice' | 'end' | 'reject' | 'busy';

export interface ChatCallSignalRecord {
  id: string;
  chatKind: 'direct' | 'group';
  chatId: string;
  fromUserId: string;
  toUserId: string;
  type: ChatCallSignalType;
  payload: Record<string, any>;
  createdAt: string;
}

export interface ChatMessageBlockStateRecord {
  id: string;
  chatKind: 'direct' | 'group';
  chatId: string;
  messageId: string;
  blockKind: string;
  state: Record<string, any>;
  expiresAt: string | null;
  isSaved: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type SupabaseRealtimeChangeSpec = {
  schema: string;
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
};

export type SupabaseRealtimeChangeEvent = {
  schema: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  newRecord: Record<string, any> | null;
  oldRecord: Record<string, any> | null;
  raw: any;
};

interface PlatformData {
  users: UserRecord[];
  teams: TeamRecord[];
  sessionUserId: string | null;
}

interface SupabaseSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

const STORAGE_KEY = 'natural.platform.v2';
const SESSION_KEY = 'natural.supabase.session.v1';
const PKCE_VERIFIER_KEY = 'natural.supabase.pkce.verifier.v1';
let pkceCache: PkcePair | null = null;
let pkcePromise: Promise<PkcePair> | null = null;
let refreshSessionPromise: Promise<SupabaseSession | null> | null = null;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://ftvxpkhkxgrwcujjtztx.supabase.co';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dnhwa2hreGdyd2N1amp0enR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzk4MjcsImV4cCI6MjA4Njc1NTgyN30.0k6kxhdz2BkClxCbvJ75Cr_jgeoaeRDJWGXXsS7fc-s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AUTH_REDIRECT_URL = (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)?.trim() || '';

const generateId = () => Math.random().toString(36).slice(2, 10);

const slug = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

const isUrl = (value?: string | null) => /^https?:\/\//i.test((value || '').trim());

const toInitials = (value: string, fallback = 'U') => {
  const cleaned = (value || '').trim();
  if (!cleaned) return fallback;
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase().slice(0, 2);
  }
  return cleaned.slice(0, 2).toUpperCase();
};

const normalizeAvatarValue = (rawAvatar: string | null | undefined, name: string, username: string) => {
  const candidate = (rawAvatar || '').trim();
  // If a saved URL exists (Google/GitHub/Supabase), use it directly.
  if (candidate && isUrl(candidate)) return candidate;
  // Otherwise treat custom text input as initials.
  if (candidate) return toInitials(candidate, 'U');
  if (name) return toInitials(name, 'U');
  if (username) return toInitials(username, 'U');
  return 'U';
};

const createDefaultUsage = (): UsageStats => ({
  aiRequests: 0,
  tokensUsed: 0,
  projectsCreated: 0,
  storageBytes: 0,
  activeSessions: 1,
  aiLimit: 100
});

const createDefaultAdmin = (): UserRecord => {
  const now = Date.now();
  return {
    id: 'admin-local',
    name: 'Admin',
    username: 'admin',
    email: 'admin@natural.local',
    password: 'admin123',
    avatar: 'A',
    bio: 'Local admin fallback',
    emailVerified: true,
    isBanned: false,
    isAdmin: true,
    subscription: 'enterprise',
    usage: { ...createDefaultUsage(), aiLimit: 100000 },
    createdAt: now,
    updatedAt: now
  };
};

const read = (): PlatformData => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded: PlatformData = {
      users: [createDefaultAdmin()],
      teams: [],
      sessionUserId: null
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as PlatformData;
    return {
      users: parsed.users || [createDefaultAdmin()],
      teams: parsed.teams || [],
      sessionUserId: parsed.sessionUserId || null
    };
  } catch {
    const seeded: PlatformData = {
      users: [createDefaultAdmin()],
      teams: [],
      sessionUserId: null
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
};

const write = (data: PlatformData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const getStoredSession = (): SupabaseSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SupabaseSession;
  } catch {
    return null;
  }
};

const setStoredSession = (session: SupabaseSession | null) => {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const setPkceVerifier = (verifier: string | null) => {
  if (!verifier) {
    localStorage.removeItem(PKCE_VERIFIER_KEY);
    return;
  }
  localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
};

const getPkceVerifier = (): string | null => localStorage.getItem(PKCE_VERIFIER_KEY);

const requireSupabaseConfig = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
};

const resolveAuthRedirectUrl = (): string => {
  if (AUTH_REDIRECT_URL) return AUTH_REDIRECT_URL;
  const basePath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  return `${window.location.origin}${basePath === '/' ? '/' : basePath}`;
};

const apiHeaders = (accessToken?: string) => {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
};

const parseError = async (res: Response): Promise<never> => {
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    message = data?.msg || data?.message || data?.error_description || data?.error || message;
  } catch { }
  throw new Error(message);
};

const isSessionExpired = (session: SupabaseSession, skewMs = 60_000) =>
  !session.expiresAt || Date.now() + skewMs >= session.expiresAt;

const refreshSupabaseSession = async (session: SupabaseSession): Promise<SupabaseSession> => {
  if (!session.refreshToken) throw new Error('Session expired. Please log in again.');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ refresh_token: session.refreshToken })
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || session.refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000
  };
};

const ensureValidSession = async (): Promise<SupabaseSession | null> => {
  const stored = getStoredSession();
  if (!stored?.accessToken) return null;
  if (!isSessionExpired(stored)) return stored;
  if (!stored.refreshToken) {
    clearCurrentSession();
    return null;
  }
  if (!refreshSessionPromise) {
    refreshSessionPromise = (async () => {
      try {
        const refreshed = await refreshSupabaseSession(stored);
        setStoredSession(refreshed);
        return refreshed;
      } catch (error) {
        clearCurrentSession();
        throw error;
      } finally {
        refreshSessionPromise = null;
      }
    })();
  }
  return refreshSessionPromise;
};

const mapMissingTableError = (error: unknown): never => {
  const message = String((error as any)?.message || '');
  if (message.includes('relation') && message.includes('does not exist')) {
    throw new Error('Direct chat tables are missing. Run the Direct Chat SQL migration first.');
  }
  throw error as any;
};

const mapMissingChatFeatureTableError = (error: unknown): never => {
  const message = String((error as any)?.message || '');
  if (message.includes('relation') && message.includes('does not exist')) {
    throw new Error('Chat feature tables are missing. Run the latest chat SQL migration.');
  }
  throw error as any;
};

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

const inferAttachmentType = (mimeType?: string, name?: string, url?: string): DirectMessageAttachment['type'] => {
  const lowerName = (name || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerUrl = (url || '').toLowerCase();
  const isGifUrl =
    lowerUrl.includes('.gif') ||
    lowerUrl.includes('giphy.com') ||
    lowerUrl.includes('media.tenor.com');
  if (lowerMime === 'image/gif' || lowerName.endsWith('.gif')) return 'gif';
  if (isGifUrl) return 'gif';
  if (lowerMime.startsWith('image/')) return 'image';
  if (/\.(png|jpe?g|webp|bmp|svg)(\?|$)/.test(lowerUrl)) return 'image';
  if (lowerMime.startsWith('video/')) return 'video';
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(lowerUrl)) return 'video';
  return 'file';
};

const toStorageObjectUrl = (bucket: string, path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

const signStorageObjectUrl = async (accessToken: string, bucket: string, path: string): Promise<string> => {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: apiHeaders(accessToken),
    body: JSON.stringify({ expiresIn: 3600 })
  });
  if (!res.ok) {
    return toStorageObjectUrl(bucket, path);
  }
  const data = await res.json();
  const signedPath = String(data?.signedURL || '');
  if (!signedPath) return toStorageObjectUrl(bucket, path);
  if (signedPath.startsWith('http')) return signedPath;
  return `${SUPABASE_URL}/storage/v1${signedPath}`;
};

const base64UrlEncode = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const generatePkcePair = async (): Promise<{ verifier: string; challenge: string }> => {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64UrlEncode(random);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
};

const ensurePkcePair = async (): Promise<PkcePair> => {
  if (pkceCache) return pkceCache;
  if (!pkcePromise) {
    pkcePromise = generatePkcePair().then((pair) => {
      pkceCache = pair;
      return pair;
    });
  }
  return pkcePromise;
};

export const primeOAuthPkce = () => {
  void ensurePkcePair().catch(() => {
    pkceCache = null;
    pkcePromise = null;
  });
};

const exchangeCodeForSession = async (code: string): Promise<SupabaseSession> => {
  const codeVerifier = getPkceVerifier();
  if (!codeVerifier) throw new Error('OAuth verifier missing. Please try login again.');

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      auth_code: code,
      code_verifier: codeVerifier
    })
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  setPkceVerifier(null);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || undefined,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000
  };
};

const fetchAuthUser = async (accessToken: string): Promise<any> => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: apiHeaders(accessToken)
  });
  if (!res.ok) await parseError(res);
  return res.json();
};

const fetchProfile = async (userId: string, accessToken: string): Promise<any | null> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, {
    headers: {
      ...apiHeaders(accessToken),
      Prefer: 'return=representation'
    }
  });
  if (!res.ok) await parseError(res);
  const rows = await res.json();
  return rows?.[0] || null;
};

const upsertProfile = async (payload: Record<string, any>, accessToken: string): Promise<any | null> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      ...apiHeaders(accessToken),
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) await parseError(res);
  const rows = await res.json();
  return rows?.[0] || null;
};

const upsertProfileSafe = async (
  payload: Record<string, any>,
  accessToken: string,
  userId: string
): Promise<any | null> => {
  try {
    return await upsertProfile(payload, accessToken);
  } catch (error: any) {
    const message = String(error?.message || '');
    // Avoid OAuth login failure when username collides with an existing profile.
    if (message.toLowerCase().includes('username')) {
      const fallbackUsername = `${slug(payload.username || payload.name || 'user')}-${String(userId).slice(0, 6)}`;
      return upsertProfile({ ...payload, username: fallbackUsername }, accessToken);
    }
    throw error;
  }
};

const normalizeSubscription = (value: string | null | undefined): SubscriptionTier => {
  if (value === 'pro' || value === 'team' || value === 'enterprise') return value;
  return 'free';
};

const mapSupabaseToLocalUser = (authUser: any, profile: any | null): UserRecord => {
  const data = read();
  const existing = data.users.find(u => u.id === authUser.id);
  const email = (authUser.email || profile?.email || '').toLowerCase();
  const name = profile?.name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0] || 'User';
  const usernameBase = profile?.username || slug(name) || email.split('@')[0] || 'user';
  const avatarValue = normalizeAvatarValue(profile?.avatar_url || authUser.user_metadata?.avatar_url || '', name, String(usernameBase));
  const bio = profile?.bio || '';
  const subscription = normalizeSubscription(profile?.subscription);
  const aiLimit = Number(profile?.ai_limit || existing?.usage?.aiLimit || 100);
  const isAdmin = authUser?.app_metadata?.role === 'admin';
  const now = Date.now();

  return {
    id: authUser.id,
    name,
    username: String(usernameBase),
    email,
    password: '',
    avatar: avatarValue,
    bio,
    emailVerified: Boolean(authUser.email_confirmed_at),
    isBanned: false,
    isAdmin,
    subscription,
    usage: {
      ...(existing?.usage || createDefaultUsage()),
      aiLimit,
      activeSessions: Math.max(1, (existing?.usage?.activeSessions || 0) + 1)
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
};

const saveCurrentUser = (user: UserRecord) => {
  const data = read();
  const idx = data.users.findIndex(u => u.id === user.id);
  if (idx >= 0) data.users[idx] = user;
  else data.users.push(user);
  data.sessionUserId = user.id;
  write(data);
};

const clearCurrentSession = () => {
  const data = read();
  if (data.sessionUserId) {
    const user = data.users.find(u => u.id === data.sessionUserId);
    if (user) {
      user.usage.activeSessions = Math.max(0, user.usage.activeSessions - 1);
      user.updatedAt = Date.now();
    }
  }
  data.sessionUserId = null;
  write(data);
  setStoredSession(null);
};

const hydrateFromSession = async (session: SupabaseSession): Promise<UserRecord> => {
  const authUser = await fetchAuthUser(session.accessToken);
  let profile: any | null = null;

  try {
    profile = await fetchProfile(authUser.id, session.accessToken);
  } catch (e) {
    console.warn('Profile read failed, continuing with auth user data.', e);
  }

  if (!profile) {
    try {
      profile = await upsertProfileSafe({
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        username: slug(authUser.email?.split('@')[0] || 'user'),
        avatar_url: normalizeAvatarValue(
          authUser.user_metadata?.avatar_url || '',
          authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
          slug(authUser.email?.split('@')[0] || 'user')
        ),
        bio: '',
        subscription: 'free',
        ai_limit: 100
      }, session.accessToken, authUser.id);
    } catch (e) {
      console.warn('Profile upsert failed, continuing with auth user data.', e);
    }
  }

  const user = mapSupabaseToLocalUser(authUser, profile);
  saveCurrentUser(user);
  return user;
};

export const completeOAuthFromUrl = async (): Promise<UserRecord | null> => {
  requireSupabaseConfig();
  const hash = window.location.hash.replace(/^#/, '');
  const search = window.location.search.replace(/^\?/, '');
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(search);
  const params = hashParams.has('access_token') ? hashParams : searchParams;

  if (params.get('error_description') || params.get('error')) {
    throw new Error(params.get('error_description') || params.get('error') || 'OAuth failed.');
  }

  const code = params.get('code');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresIn = Number(params.get('expires_in') || '3600');

  if (!accessToken && !code) return null;

  const session: SupabaseSession = code
    ? await exchangeCodeForSession(code)
    : {
      accessToken: accessToken as string,
      refreshToken: refreshToken || undefined,
      expiresAt: Date.now() + expiresIn * 1000
    };
  setStoredSession(session);
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  return hydrateFromSession(session);
};

export const restoreSupabaseSession = async (): Promise<UserRecord | null> => {
  const session = await ensureValidSession();
  if (!session?.accessToken) return null;
  try {
    return await hydrateFromSession(session);
  } catch {
    clearCurrentSession();
    return null;
  }
};

export const signInWithOAuth = async (provider: OAuthProvider) => {
  requireSupabaseConfig();
  const { verifier, challenge } = await ensurePkcePair();
  pkceCache = null;
  pkcePromise = null;
  primeOAuthPkce();
  setPkceVerifier(verifier);
  const redirectTo = resolveAuthRedirectUrl();
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
  window.location.assign(url);
};

export const getCurrentUser = (): UserRecord | null => {
  const data = read();
  if (!data.sessionUserId) return null;
  return data.users.find(u => u.id === data.sessionUserId) || null;
};

export const getAllUsers = (): UserRecord[] => read().users;

export const signUp = async (input: { name: string; email: string; password: string }): Promise<UserRecord> => {
  requireSupabaseConfig();
  const email = input.email.trim().toLowerCase();

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      email,
      password: input.password,
      data: { name: input.name, full_name: input.name }
    })
  });
  if (!res.ok) await parseError(res);

  const data = await res.json();
  if (!data?.session || !data?.session?.access_token) {
    // If Supabase does not return a session, try immediate password login.
    // This lets signup continue without app-level email verification gating.
    try {
      return await login({ email, password: input.password });
    } catch {
      throw new Error('Signup created, but login session was not issued. Disable "Confirm email" in Supabase Auth settings to allow instant signup.');
    }
  }

  const session: SupabaseSession = {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token || undefined,
    expiresAt: Date.now() + (data.session.expires_in || 3600) * 1000
  };
  setStoredSession(session);

  const user = await hydrateFromSession(session);
  if (user.name !== input.name.trim()) {
    await updateProfile(user.id, {
      name: input.name.trim(),
      username: user.username,
      avatar: user.avatar,
      bio: user.bio
    });
    return getCurrentUser() || user;
  }

  return user;
};

export const login = async (input: { email: string; password: string }): Promise<UserRecord> => {
  requireSupabaseConfig();
  const email = input.email.trim().toLowerCase();

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ email, password: input.password })
  });
  if (!res.ok) await parseError(res);

  const data = await res.json();
  const session: SupabaseSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || undefined,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000
  };
  setStoredSession(session);

  return hydrateFromSession(session);
};

export const logout = async () => {
  const session = await ensureValidSession();
  if (session?.accessToken) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: apiHeaders(session.accessToken)
      });
    } catch { }
  }
  clearCurrentSession();
};

export const requestPasswordReset = async (emailInput: string): Promise<string> => {
  requireSupabaseConfig();
  const email = emailInput.trim().toLowerCase();
  const redirectTo = resolveAuthRedirectUrl();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ email, redirect_to: redirectTo })
  });
  if (!res.ok) await parseError(res);
  return 'Password reset email sent. Check your inbox.';
};

export const resetPassword = async (_token: string, _newPassword: string) => {
  throw new Error('Use the email reset link from Supabase to set a new password.');
};

export const verifyEmail = (_userId: string) => getCurrentUser();

export const updateProfile = async (userId: string, patch: { name: string; username: string; avatar: string; bio: string }) => {
  const session = await ensureValidSession();
  if (!session?.accessToken) throw new Error('Not authenticated.');

  const username = slug(patch.username) || patch.username;
  const avatar = normalizeAvatarValue(patch.avatar, patch.name, username);
  const payload = {
    id: userId,
    name: patch.name.trim(),
    username,
    avatar_url: avatar,
    bio: patch.bio
  };

  const profile = await upsertProfileSafe(payload, session.accessToken, userId);
  const authUser = await fetchAuthUser(session.accessToken);
  const merged = mapSupabaseToLocalUser(authUser, profile);
  saveCurrentUser(merged);
  return merged;
};

export const uploadProfileAvatar = async (file: File): Promise<string> => {
  const session = await ensureValidSession();
  const user = getCurrentUser();
  if (!session?.accessToken || !user?.id) throw new Error('Not authenticated.');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${user.id}/${Date.now()}-${safeName}`;
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: file
  });
  if (!uploadRes.ok) await parseError(uploadRes);

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
  await updateProfile(user.id, {
    name: user.name,
    username: user.username,
    avatar: publicUrl,
    bio: user.bio
  });
  return publicUrl;
};

export const changePassword = async (_userId: string, oldPassword: string, newPassword: string) => {
  const session = await ensureValidSession();
  if (!session?.accessToken) throw new Error('Not authenticated.');
  if (!oldPassword.trim()) throw new Error('Enter your current password.');

  // Verify current password by re-authenticating.
  const currentUser = getCurrentUser();
  if (!currentUser?.email) throw new Error('Current user email missing.');
  await login({ email: currentUser.email, password: oldPassword });

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: apiHeaders(getStoredSession()?.accessToken),
    body: JSON.stringify({ password: newPassword })
  });
  if (!res.ok) await parseError(res);
};

export const deleteAccount = (_userId: string) => {
  // Self-delete needs service-role or edge function; keep local logout fallback.
  clearCurrentSession();
};

export const setSubscription = (userId: string, tier: SubscriptionTier) => {
  const data = read();
  const user = data.users.find(u => u.id === userId);
  if (!user) throw new Error('User not found.');
  user.subscription = tier;
  user.updatedAt = Date.now();
  user.usage.aiLimit = tier === 'free' ? 100 : tier === 'pro' ? 2000 : tier === 'team' ? 10000 : 100000;
  write(data);
  return user;
};

export const incrementUsage = (userId: string, usage: Partial<Pick<UsageStats, 'aiRequests' | 'tokensUsed' | 'projectsCreated' | 'storageBytes'>>) => {
  const data = read();
  const user = data.users.find(u => u.id === userId);
  if (!user) return;
  user.usage.aiRequests += usage.aiRequests || 0;
  user.usage.tokensUsed += usage.tokensUsed || 0;
  user.usage.projectsCreated += usage.projectsCreated || 0;
  user.usage.storageBytes += usage.storageBytes || 0;
  user.updatedAt = Date.now();
  write(data);
};

export const listTeamsForUser = (userId: string) => {
  return read().teams.filter(team => team.members.some(member => member.userId === userId));
};

export const createTeam = (ownerId: string, input: { name: string; description: string }) => {
  const data = read();
  const now = Date.now();
  const team: TeamRecord = {
    id: generateId(),
    name: input.name,
    description: input.description,
    ownerId,
    members: [{ userId: ownerId, role: 'owner' }],
    invites: [],
    createdAt: now,
    updatedAt: now
  };
  data.teams.push(team);
  write(data);
  return team;
};

export const inviteToTeam = (teamId: string, email: string, role: TeamRole) => {
  const data = read();
  const team = data.teams.find(t => t.id === teamId);
  if (!team) throw new Error('Team not found.');
  const invite: TeamInvite = {
    id: generateId(),
    email: email.trim().toLowerCase(),
    role,
    invitedAt: Date.now(),
    accepted: false
  };
  team.invites.push(invite);
  team.updatedAt = Date.now();
  write(data);
  return invite;
};

export const removeTeamMember = (teamId: string, userId: string) => {
  const data = read();
  const team = data.teams.find(t => t.id === teamId);
  if (!team) throw new Error('Team not found.');
  team.members = team.members.filter(m => m.userId !== userId);
  team.updatedAt = Date.now();
  write(data);
};

export const leaveTeam = (teamId: string, userId: string) => {
  removeTeamMember(teamId, userId);
};

const requireAuthContext = async () => {
  const session = await ensureValidSession();
  const user = getCurrentUser();
  if (!session?.accessToken || !user?.id) throw new Error('Not authenticated.');
  return { accessToken: session.accessToken, user };
};

export const listDirectChats = async (): Promise<DirectChatSummary[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const chatsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/direct_chats?or=(user_a.eq.${encodeURIComponent(user.id)},user_b.eq.${encodeURIComponent(user.id)})&select=id,user_a,user_b,created_at&order=created_at.desc`,
      { headers: apiHeaders(accessToken) }
    );
    if (!chatsRes.ok) await parseError(chatsRes);
    const chats = (await chatsRes.json()) as Array<{ id: string; user_a: string; user_b: string }>;
    if (!chats.length) return [];

    const otherIds = Array.from(
      new Set(
        chats.map((chat) => (chat.user_a === user.id ? chat.user_b : chat.user_a)).filter(Boolean)
      )
    );
    if (!otherIds.length) return [];

    const profileIds = otherIds.map((id) => `"${id}"`).join(',');
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${encodeURIComponent(profileIds)})&select=id,name,email,avatar_url`,
      { headers: apiHeaders(accessToken) }
    );
    if (!profilesRes.ok) await parseError(profilesRes);
    const profiles = (await profilesRes.json()) as Array<{ id: string; name?: string; email?: string; avatar_url?: string }>;
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return chats.map((chat) => {
      const otherUserId = chat.user_a === user.id ? chat.user_b : chat.user_a;
      const other = profileMap.get(otherUserId);
      const otherName = other?.name || other?.email?.split('@')[0] || 'User';
      return {
        chatId: chat.id,
        otherUserId,
        otherName,
        otherEmail: other?.email || '',
        otherAvatar: normalizeAvatarValue(other?.avatar_url || '', otherName, otherName)
      };
    });
  } catch (error) {
    return mapMissingTableError(error);
  }
};

export const getProfileBasicById = async (userId: string): Promise<BasicProfile | null> => {
  const { accessToken } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,name,email,avatar_url&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{ id: string; name?: string; email?: string; avatar_url?: string }>;
    const row = rows[0];
    if (!row) return null;
    const name = row.name || row.email?.split('@')[0] || 'User';
    const avatar = normalizeAvatarValue(row.avatar_url || '', name, slug(name));
    return {
      id: row.id,
      name,
      email: row.email,
      avatar,
      isAvatarImage: isUrl(avatar)
    };
  } catch (error) {
    return mapMissingTableError(error);
  }
};

export const createOrGetDirectChatByEmail = async (emailInput: string): Promise<DirectChatSummary> => {
  const { accessToken, user } = await requireAuthContext();
  const email = emailInput.trim().toLowerCase();
  if (!email) throw new Error('Enter an email address.');

  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,name,email,avatar_url&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!profileRes.ok) await parseError(profileRes);
    const profileRows = (await profileRes.json()) as Array<{ id: string; name?: string; email?: string; avatar_url?: string }>;
    const other = profileRows[0];
    if (!other) throw new Error('No user found with that email.');
    if (other.id === user.id) throw new Error('You cannot create a chat with yourself.');

    const [a, b] = [user.id, other.id].sort();
    let chatId: string | null = null;

    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/direct_chats?user_a=eq.${encodeURIComponent(a)}&user_b=eq.${encodeURIComponent(b)}&select=id&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!existingRes.ok) await parseError(existingRes);
    const existingRows = (await existingRes.json()) as Array<{ id: string }>;
    chatId = existingRows[0]?.id || null;

    if (!chatId) {
      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/direct_chats`, {
        method: 'POST',
        headers: {
          ...apiHeaders(accessToken),
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ user_a: a, user_b: b })
      });
      if (!createRes.ok) await parseError(createRes);
      const created = (await createRes.json()) as Array<{ id: string }>;
      chatId = created[0]?.id || null;
    }

    if (!chatId) throw new Error('Failed to create direct chat.');
    return {
      chatId,
      otherUserId: other.id,
      otherName: other.name || other.email?.split('@')[0] || 'User',
      otherEmail: other.email || '',
      otherAvatar: normalizeAvatarValue(
        other.avatar_url || '',
        other.name || other.email?.split('@')[0] || 'User',
        other.name || other.email?.split('@')[0] || 'User'
      )
    };
  } catch (error) {
    return mapMissingTableError(error);
  }
};

export const listDirectMessages = async (chatId: string): Promise<DirectChatMessage[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const fetchRows = async (withEditedAt: boolean) => {
      const selectCols = withEditedAt
        ? 'id,chat_id,sender_id,content,created_at,edited_at'
        : 'id,chat_id,sender_id,content,created_at';
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/direct_messages?chat_id=eq.${encodeURIComponent(chatId)}&select=${selectCols}&order=created_at.asc`,
        { headers: apiHeaders(accessToken) }
      );
      if (!res.ok) {
        let msg = '';
        try {
          const body = await res.json();
          msg = String(body?.message || body?.error || body?.hint || '');
        } catch { }
        if (withEditedAt && msg.includes('edited_at')) {
          return fetchRows(false);
        }
        await parseError(res);
      }
      return (await res.json()) as Array<{
        id: string | number;
        chat_id: string;
        sender_id: string;
        content: string;
        created_at: string;
        edited_at?: string | null;
      }>;
    };

    const rows = await fetchRows(true) as Array<{
      id: string | number;
      chat_id: string;
      sender_id: string;
      content: string;
      created_at: string;
      edited_at?: string | null;
    }>;

    const messageIds = rows.map((row) => String(row.id));
    const attachmentsByMessage = new Map<string, DirectMessageAttachment[]>();
    const reactionsByMessage = new Map<string, DirectMessageReaction[]>();

    if (messageIds.length > 0) {
      const idFilter = messageIds.map((id) => `"${id}"`).join(',');

      const attachmentsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/direct_message_attachments?message_id=in.(${encodeURIComponent(idFilter)})&select=id,message_id,bucket_id,path,file_name,mime_type,size_bytes,external_url`,
        { headers: apiHeaders(accessToken) }
      );
      if (attachmentsRes.ok) {
        const attachmentsRows = (await attachmentsRes.json()) as Array<{
          id: string;
          message_id: string | number;
          bucket_id: string;
          path: string | null;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          external_url?: string | null;
        }>;

        for (const row of attachmentsRows) {
          const mid = String(row.message_id);
          const existing = attachmentsByMessage.get(mid) || [];
          const url = row.external_url
            ? row.external_url
            : row.path
              ? await signStorageObjectUrl(accessToken, row.bucket_id || 'direct-attachments', row.path)
              : '';
          existing.push({
            id: row.id,
            type: inferAttachmentType(row.mime_type || undefined, row.file_name, url),
            url,
            name: row.file_name,
            size: row.size_bytes ? `${Math.max(1, Math.round(row.size_bytes / 1024))} KB` : undefined
          });
          attachmentsByMessage.set(mid, existing);
        }
      }

      const reactionsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/direct_message_reactions?message_id=in.(${encodeURIComponent(idFilter)})&select=message_id,user_id,emoji`,
        { headers: apiHeaders(accessToken) }
      );
      if (reactionsRes.ok) {
        const reactionRows = (await reactionsRes.json()) as Array<{
          message_id: string | number;
          user_id: string;
          emoji: string;
        }>;
        const grouped = new Map<string, Map<string, { count: number; active: boolean }>>();
        for (const row of reactionRows) {
          const mid = String(row.message_id);
          const byEmoji = grouped.get(mid) || new Map<string, { count: number; active: boolean }>();
          const current = byEmoji.get(row.emoji) || { count: 0, active: false };
          current.count += 1;
          if (row.user_id === user.id) current.active = true;
          byEmoji.set(row.emoji, current);
          grouped.set(mid, byEmoji);
        }
        for (const [mid, byEmoji] of grouped.entries()) {
          reactionsByMessage.set(
            mid,
            Array.from(byEmoji.entries()).map(([emoji, info]) => ({
              emoji,
              count: info.count,
              active: info.active
            }))
          );
        }
      }
    }

    return rows.map((row) => {
      const mid = String(row.id);
      return {
        id: mid,
        chatId: row.chat_id,
        senderId: row.sender_id,
        content: row.content || '',
        createdAt: row.created_at,
        isEdited: Boolean(row.edited_at),
        attachments: attachmentsByMessage.get(mid) || [],
        reactions: reactionsByMessage.get(mid) || []
      };
    });
  } catch (error) {
    return mapMissingTableError(error);
  }
};

const uploadDirectAttachment = async (
  accessToken: string,
  chatId: string,
  attachment: DirectMessageAttachment
): Promise<{
  bucket_id: string;
  path: string | null;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  external_url: string | null;
}> => {
  const bucket = 'direct-attachments';
  if (!attachment.file) {
    return {
      bucket_id: bucket,
      path: null,
      file_name: attachment.name,
      mime_type: null,
      size_bytes: 0,
      external_url: attachment.url || null
    };
  }

  const path = `${chatId}/${Date.now()}-${safeFileName(attachment.file.name)}`;
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': attachment.file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: attachment.file
  });
  if (!uploadRes.ok) await parseError(uploadRes);

  return {
    bucket_id: bucket,
    path,
    file_name: attachment.file.name,
    mime_type: attachment.file.type || null,
    size_bytes: attachment.file.size || 0,
    external_url: null
  };
};

export const sendDirectMessage = async (
  chatId: string,
  content: string,
  attachments: DirectMessageAttachment[] = []
): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/direct_messages`, {
      method: 'POST',
      headers: {
        ...apiHeaders(accessToken),
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        chat_id: chatId,
        sender_id: user.id,
        content
      })
    });
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{ id: string | number }>;
    const messageId = rows?.[0]?.id;
    if (!messageId || attachments.length === 0) return;

    const uploaded = await Promise.all(
      attachments.map((att) => uploadDirectAttachment(accessToken, chatId, att))
    );
    const attachmentRows = uploaded.map((att) => ({
      message_id: messageId,
      uploader_id: user.id,
      ...att
    }));

    const insertAttachmentsRes = await fetch(`${SUPABASE_URL}/rest/v1/direct_message_attachments`, {
      method: 'POST',
      headers: apiHeaders(accessToken),
      body: JSON.stringify(attachmentRows)
    });
    if (!insertAttachmentsRes.ok) await parseError(insertAttachmentsRes);
  } catch (error) {
    mapMissingTableError(error);
  }
};

export const editDirectMessage = async (messageId: number | string, content: string): Promise<void> => {
  const { accessToken } = await requireAuthContext();
  try {
    const runPatch = async (withEditedAt: boolean) => {
      const payload: Record<string, any> = { content };
      if (withEditedAt) payload.edited_at = new Date().toISOString();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/direct_messages?id=eq.${encodeURIComponent(String(messageId))}`, {
        method: 'PATCH',
        headers: {
          ...apiHeaders(accessToken),
          Prefer: 'return=representation'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let msg = '';
        try {
          const body = await res.json();
          msg = String(body?.message || body?.error || '');
        } catch { }
        if (withEditedAt && msg.includes('edited_at')) {
          return runPatch(false);
        }
        await parseError(res);
      }
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('Message not found or not editable.');
      }
    };
    await runPatch(true);
  } catch (error) {
    mapMissingTableError(error);
  }
};

export const deleteDirectMessage = async (messageId: number | string): Promise<void> => {
  const { accessToken } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/direct_messages?id=eq.${encodeURIComponent(String(messageId))}`, {
      method: 'DELETE',
      headers: {
        ...apiHeaders(accessToken),
        Prefer: 'return=representation'
      }
    });
    if (!res.ok) await parseError(res);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Message not found or not deletable.');
    }
  } catch (error) {
    mapMissingTableError(error);
  }
};

export const toggleDirectMessageReaction = async (messageId: number | string, emoji: string): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  const msgId = String(messageId);
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/direct_message_reactions?message_id=eq.${encodeURIComponent(msgId)}&user_id=eq.${encodeURIComponent(user.id)}&emoji=eq.${encodeURIComponent(emoji)}&select=message_id&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!existingRes.ok) await parseError(existingRes);
    const existingRows = (await existingRes.json()) as Array<{ message_id: string }>;
    const exists = existingRows.length > 0;

    if (exists) {
      const delRes = await fetch(
        `${SUPABASE_URL}/rest/v1/direct_message_reactions?message_id=eq.${encodeURIComponent(msgId)}&user_id=eq.${encodeURIComponent(user.id)}&emoji=eq.${encodeURIComponent(emoji)}`,
        { method: 'DELETE', headers: apiHeaders(accessToken) }
      );
      if (!delRes.ok) await parseError(delRes);
      return;
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/direct_message_reactions`, {
      method: 'POST',
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        message_id: messageId,
        user_id: user.id,
        emoji
      })
    });
    if (!insertRes.ok) await parseError(insertRes);
  } catch (error) {
    mapMissingTableError(error);
  }
};

const createOrGetDirectChatByUserId = async (otherUserId: string): Promise<string> => {
  const { accessToken, user } = await requireAuthContext();
  const [a, b] = [user.id, otherUserId].sort();

  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/direct_chats?user_a=eq.${encodeURIComponent(a)}&user_b=eq.${encodeURIComponent(b)}&select=id&limit=1`,
    { headers: apiHeaders(accessToken) }
  );
  if (!existingRes.ok) await parseError(existingRes);
  const existingRows = (await existingRes.json()) as Array<{ id: string }>;
  if (existingRows[0]?.id) return existingRows[0].id;

  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/direct_chats`, {
    method: 'POST',
    headers: { ...apiHeaders(accessToken), Prefer: 'return=representation' },
    body: JSON.stringify({ user_a: a, user_b: b })
  });
  if (!createRes.ok) await parseError(createRes);
  const created = (await createRes.json()) as Array<{ id: string }>;
  if (!created[0]?.id) throw new Error('Failed to create direct chat.');
  return created[0].id;
};

export const listGroupChats = async (): Promise<GroupChatSummary[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const memberRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_chat_members?user_id=eq.${encodeURIComponent(user.id)}&select=group_chat_id`,
      { headers: apiHeaders(accessToken) }
    );
    if (!memberRes.ok) await parseError(memberRes);
    const members = (await memberRes.json()) as Array<{ group_chat_id: string }>;
    if (!members.length) return [];
    const ids = Array.from(new Set(members.map(m => m.group_chat_id)));
    const idList = ids.map(id => `"${id}"`).join(',');

    const groupsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_chats?id=in.(${encodeURIComponent(idList)})&select=id,name,avatar,created_at&order=created_at.desc`,
      { headers: apiHeaders(accessToken) }
    );
    if (!groupsRes.ok) await parseError(groupsRes);
    const groups = (await groupsRes.json()) as Array<{ id: string; name: string; avatar?: string | null; created_at: string }>;

    const allMembersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_chat_members?group_chat_id=in.(${encodeURIComponent(idList)})&select=group_chat_id`,
      { headers: apiHeaders(accessToken) }
    );
    if (!allMembersRes.ok) await parseError(allMembersRes);
    const allMembers = (await allMembersRes.json()) as Array<{ group_chat_id: string }>;
    const counts = new Map<string, number>();
    for (const row of allMembers) counts.set(row.group_chat_id, (counts.get(row.group_chat_id) || 0) + 1);

    return groups.map(group => ({
      id: group.id,
      name: group.name,
      avatar: group.avatar || undefined,
      createdAt: group.created_at,
      memberCount: counts.get(group.id) || 1
    }));
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const createGroupChat = async (name: string, memberEmails: string[]): Promise<GroupChatSummary> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const cleaned = Array.from(new Set(memberEmails.map(email => email.trim().toLowerCase()).filter(Boolean)));
    let memberIds: string[] = [];
    if (cleaned.length > 0) {
      const emailList = cleaned.map(email => `"${email}"`).join(',');
      const profilesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?email=in.(${encodeURIComponent(emailList)})&select=id,email`,
        { headers: apiHeaders(accessToken) }
      );
      if (!profilesRes.ok) await parseError(profilesRes);
      const profiles = (await profilesRes.json()) as Array<{ id: string; email: string }>;
      memberIds = profiles.map(p => p.id);
    }
    const uniqueIds = Array.from(new Set([user.id, ...memberIds]));

    const createRes = await fetch(`${SUPABASE_URL}/rest/v1/group_chats`, {
      method: 'POST',
      headers: { ...apiHeaders(accessToken), Prefer: 'return=representation' },
      body: JSON.stringify({ name: name.trim() })
    });
    if (!createRes.ok) await parseError(createRes);
    const created = (await createRes.json()) as Array<{ id: string; name: string; avatar?: string | null; created_at: string }>;
    const group = created[0];
    if (!group?.id) throw new Error('Failed to create group chat.');

    const memberRows = uniqueIds.map(memberId => ({
      group_chat_id: group.id,
      user_id: memberId,
      role: memberId === user.id ? 'owner' : 'member'
    }));
    const membersRes = await fetch(`${SUPABASE_URL}/rest/v1/group_chat_members`, {
      method: 'POST',
      headers: apiHeaders(accessToken),
      body: JSON.stringify(memberRows)
    });
    if (!membersRes.ok) await parseError(membersRes);

    return {
      id: group.id,
      name: group.name,
      avatar: group.avatar || undefined,
      createdAt: group.created_at,
      memberCount: memberRows.length
    };
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const updateGroupChatAvatar = async (groupChatId: string, avatar: string): Promise<void> => {
  const { accessToken } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/group_chats?id=eq.${encodeURIComponent(groupChatId)}`, {
      method: 'PATCH',
      headers: apiHeaders(accessToken),
      body: JSON.stringify({ avatar: avatar.trim() })
    });
    if (!res.ok) await parseError(res);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const uploadGroupChatAvatar = async (groupChatId: string, file: File): Promise<string> => {
  const { accessToken } = await requireAuthContext();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${groupChatId}/${Date.now()}-${safeName}`;
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/group-avatars/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: file
  });
  if (!uploadRes.ok) await parseError(uploadRes);
  const url = `${SUPABASE_URL}/storage/v1/object/public/group-avatars/${path}`;
  await updateGroupChatAvatar(groupChatId, url);
  return url;
};

export const addGroupChatMembers = async (groupChatId: string, memberUserIds: string[]): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  const unique = Array.from(new Set(memberUserIds.map(id => id.trim()).filter(Boolean)))
    .filter(id => id !== user.id);
  if (unique.length === 0) return;
  try {
    const rows = unique.map(memberId => ({
      group_chat_id: groupChatId,
      user_id: memberId,
      role: 'member'
    }));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/group_chat_members`, {
      method: 'POST',
      headers: { ...apiHeaders(accessToken), Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(rows)
    });
    if (!res.ok) await parseError(res);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const listGroupMessages = async (groupChatId: string): Promise<GroupChatMessage[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/group_messages?group_chat_id=eq.${encodeURIComponent(groupChatId)}&select=id,group_chat_id,sender_id,content,created_at,edited_at&order=created_at.asc`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{
      id: string | number;
      group_chat_id: string;
      sender_id: string;
      content: string;
      created_at: string;
      edited_at?: string | null;
    }>;
    const messageIds = rows.map(row => String(row.id));
    const reactionsByMessage = new Map<string, DirectMessageReaction[]>();
    if (messageIds.length > 0) {
      const idFilter = messageIds.map(id => `"${id}"`).join(',');
      const reactionsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/group_message_reactions?message_id=in.(${encodeURIComponent(idFilter)})&select=message_id,user_id,emoji`,
        { headers: apiHeaders(accessToken) }
      );
      if (reactionsRes.ok) {
        const reactionRows = (await reactionsRes.json()) as Array<{ message_id: string | number; user_id: string; emoji: string }>;
        const grouped = new Map<string, Map<string, { count: number; active: boolean }>>();
        for (const row of reactionRows) {
          const mid = String(row.message_id);
          const byEmoji = grouped.get(mid) || new Map<string, { count: number; active: boolean }>();
          const current = byEmoji.get(row.emoji) || { count: 0, active: false };
          current.count += 1;
          if (row.user_id === user.id) current.active = true;
          byEmoji.set(row.emoji, current);
          grouped.set(mid, byEmoji);
        }
        for (const [mid, byEmoji] of grouped.entries()) {
          reactionsByMessage.set(
            mid,
            Array.from(byEmoji.entries()).map(([emoji, info]) => ({ emoji, count: info.count, active: info.active }))
          );
        }
      }
    }

    const senderIds = Array.from(new Set(rows.map(row => row.sender_id).filter(Boolean)));
    const senderMap = new Map<string, { name: string; avatar: string }>();
    if (senderIds.length > 0) {
      const ids = senderIds.map(id => `"${id}"`).join(',');
      const profilesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${encodeURIComponent(ids)})&select=id,name,email,avatar_url`,
        { headers: apiHeaders(accessToken) }
      );
      if (profilesRes.ok) {
        const profiles = (await profilesRes.json()) as Array<{ id: string; name?: string; email?: string; avatar_url?: string }>;
        for (const profile of profiles) {
          const name = profile.name || profile.email?.split('@')[0] || 'User';
          senderMap.set(profile.id, {
            name,
            avatar: normalizeAvatarValue(profile.avatar_url || '', name, name)
          });
        }
      }
    }
    return rows.map(row => {
      const sender = senderMap.get(row.sender_id);
      return {
        id: String(row.id),
        groupChatId: row.group_chat_id,
        senderId: row.sender_id,
        senderName: sender?.name || 'User',
        senderAvatar: sender?.avatar || 'U',
        content: row.content || '',
        createdAt: row.created_at,
        isEdited: Boolean(row.edited_at),
        reactions: reactionsByMessage.get(String(row.id)) || []
      };
    });
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const sendGroupMessage = async (groupChatId: string, content: string): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/group_messages`, {
      method: 'POST',
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        group_chat_id: groupChatId,
        sender_id: user.id,
        content
      })
    });
    if (!res.ok) await parseError(res);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const editGroupMessage = async (messageId: number | string, content: string): Promise<void> => {
  const { accessToken } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/group_messages?id=eq.${encodeURIComponent(String(messageId))}`, {
      method: 'PATCH',
      headers: { ...apiHeaders(accessToken), Prefer: 'return=representation' },
      body: JSON.stringify({ content, edited_at: new Date().toISOString() })
    });
    if (!res.ok) await parseError(res);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Message not found or not editable.');
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const deleteGroupMessage = async (messageId: number | string): Promise<void> => {
  const { accessToken } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/group_messages?id=eq.${encodeURIComponent(String(messageId))}`, {
      method: 'DELETE',
      headers: { ...apiHeaders(accessToken), Prefer: 'return=representation' }
    });
    if (!res.ok) await parseError(res);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Message not found or not deletable.');
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const toggleGroupMessageReaction = async (messageId: number | string, emoji: string): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  const msgId = String(messageId);
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_message_reactions?message_id=eq.${encodeURIComponent(msgId)}&user_id=eq.${encodeURIComponent(user.id)}&emoji=eq.${encodeURIComponent(emoji)}&select=message_id&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!existingRes.ok) await parseError(existingRes);
    const existingRows = (await existingRes.json()) as Array<{ message_id: string }>;
    if (existingRows.length > 0) {
      const delRes = await fetch(
        `${SUPABASE_URL}/rest/v1/group_message_reactions?message_id=eq.${encodeURIComponent(msgId)}&user_id=eq.${encodeURIComponent(user.id)}&emoji=eq.${encodeURIComponent(emoji)}`,
        { method: 'DELETE', headers: apiHeaders(accessToken) }
      );
      if (!delRes.ok) await parseError(delRes);
      return;
    }
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/group_message_reactions`, {
      method: 'POST',
      headers: apiHeaders(accessToken),
      body: JSON.stringify({ message_id: messageId, user_id: user.id, emoji })
    });
    if (!insertRes.ok) await parseError(insertRes);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const listChatMessageBlockStates = async (
  chatKind: 'direct' | 'group',
  chatId: string
): Promise<ChatMessageBlockStateRecord[]> => {
  const { accessToken } = await requireAuthContext();
  const nowIso = new Date().toISOString();
  try {
    const cleanupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_message_blocks?chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}&is_saved=eq.false&expires_at=lt.${encodeURIComponent(nowIso)}`,
      { method: 'DELETE', headers: apiHeaders(accessToken) }
    );
    if (!cleanupRes.ok && cleanupRes.status !== 404) await parseError(cleanupRes);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_message_blocks?chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}&select=id,chat_kind,chat_id,message_id,block_kind,state,expires_at,is_saved,created_by,created_at,updated_at&order=updated_at.desc`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{
      id: string;
      chat_kind: 'direct' | 'group';
      chat_id: string;
      message_id: string;
      block_kind: string;
      state: Record<string, any> | null;
      expires_at: string | null;
      is_saved: boolean | null;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>;
    return rows.map(row => ({
      id: row.id,
      chatKind: row.chat_kind,
      chatId: row.chat_id,
      messageId: String(row.message_id),
      blockKind: row.block_kind,
      state: (row.state && typeof row.state === 'object') ? row.state : {},
      expiresAt: row.expires_at,
      isSaved: Boolean(row.is_saved),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const upsertChatMessageBlockState = async (params: {
  chatKind: 'direct' | 'group';
  chatId: string;
  messageId: number | string;
  blockKind: string;
  state: Record<string, any>;
  expiresAt?: string | null;
  isSaved?: boolean;
}): Promise<ChatMessageBlockStateRecord> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_message_blocks?on_conflict=chat_kind,chat_id,message_id`,
      {
        method: 'POST',
        headers: { ...apiHeaders(accessToken), Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          chat_kind: params.chatKind,
          chat_id: params.chatId,
          message_id: String(params.messageId),
          block_kind: params.blockKind,
          state: params.state || {},
          expires_at: params.expiresAt || null,
          is_saved: Boolean(params.isSaved),
          created_by: user.id
        })
      }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{
      id: string;
      chat_kind: 'direct' | 'group';
      chat_id: string;
      message_id: string;
      block_kind: string;
      state: Record<string, any> | null;
      expires_at: string | null;
      is_saved: boolean | null;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>;
    const row = rows[0];
    if (!row) throw new Error('Failed to persist block state.');
    return {
      id: row.id,
      chatKind: row.chat_kind,
      chatId: row.chat_id,
      messageId: String(row.message_id),
      blockKind: row.block_kind,
      state: (row.state && typeof row.state === 'object') ? row.state : {},
      expiresAt: row.expires_at,
      isSaved: Boolean(row.is_saved),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const blockUser = async (blockedUserId: string): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_blocks`, {
      method: 'POST',
      headers: { ...apiHeaders(accessToken), Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        user_id: user.id,
        blocked_user_id: blockedUserId
      })
    });
    if (!res.ok) await parseError(res);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const unblockUser = async (blockedUserId: string): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_blocks?user_id=eq.${encodeURIComponent(user.id)}&blocked_user_id=eq.${encodeURIComponent(blockedUserId)}`,
      { method: 'DELETE', headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const listBlockedUsers = async (): Promise<string[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_blocks?user_id=eq.${encodeURIComponent(user.id)}&select=blocked_user_id`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{ blocked_user_id: string }>;
    return rows.map(row => row.blocked_user_id);
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const listUsersWhoBlockedMe = async (): Promise<string[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_blocks?blocked_user_id=eq.${encodeURIComponent(user.id)}&select=user_id`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{ user_id: string }>;
    return rows.map(row => row.user_id);
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const hideMessageForMe = async (chatKind: 'direct' | 'group', chatId: string, messageId: number | string): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_hidden_messages`, {
      method: 'POST',
      headers: { ...apiHeaders(accessToken), Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        user_id: user.id,
        chat_kind: chatKind,
        chat_id: chatId,
        message_id: String(messageId)
      })
    });
    if (!res.ok) await parseError(res);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const listHiddenMessageIds = async (chatKind: 'direct' | 'group', chatId: string): Promise<string[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_hidden_messages?user_id=eq.${encodeURIComponent(user.id)}&chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}&select=message_id`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{ message_id: string }>;
    return rows.map(row => row.message_id);
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const listStarredMessageIds = async (chatKind: 'direct' | 'group', chatId: string): Promise<string[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/starred_messages?user_id=eq.${encodeURIComponent(user.id)}&chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}&select=message_id`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{ message_id: string }>;
    return rows.map(row => row.message_id);
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const toggleStarredMessage = async (
  chatKind: 'direct' | 'group',
  chatId: string,
  messageId: number | string
): Promise<boolean> => {
  const { accessToken, user } = await requireAuthContext();
  const msgId = String(messageId);
  try {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/starred_messages?user_id=eq.${encodeURIComponent(user.id)}&chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}&message_id=eq.${encodeURIComponent(msgId)}&select=message_id&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!checkRes.ok) await parseError(checkRes);
    const exists = ((await checkRes.json()) as Array<{ message_id: string }>).length > 0;
    if (exists) {
      const delRes = await fetch(
        `${SUPABASE_URL}/rest/v1/starred_messages?user_id=eq.${encodeURIComponent(user.id)}&chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}&message_id=eq.${encodeURIComponent(msgId)}`,
        { method: 'DELETE', headers: apiHeaders(accessToken) }
      );
      if (!delRes.ok) await parseError(delRes);
      return false;
    }
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/starred_messages`, {
      method: 'POST',
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        user_id: user.id,
        chat_kind: chatKind,
        chat_id: chatId,
        message_id: msgId
      })
    });
    if (!insRes.ok) await parseError(insRes);
    return true;
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const markDirectChatSeen = async (chatId: string): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/direct_chat_reads`, {
      method: 'POST',
      headers: { ...apiHeaders(accessToken), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        chat_id: chatId,
        user_id: user.id,
        last_seen_at: new Date().toISOString()
      })
    });
    if (!res.ok) await parseError(res);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const getDirectChatSeenStatus = async (chatId: string): Promise<DirectChatSeenStatus> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const chatRes = await fetch(
      `${SUPABASE_URL}/rest/v1/direct_chats?id=eq.${encodeURIComponent(chatId)}&select=id,user_a,user_b&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!chatRes.ok) await parseError(chatRes);
    const chats = (await chatRes.json()) as Array<{ id: string; user_a: string; user_b: string }>;
    const chat = chats[0];
    if (!chat) return { chatId, otherLastSeenAt: null };
    const otherUserId = chat.user_a === user.id ? chat.user_b : chat.user_a;
    const readRes = await fetch(
      `${SUPABASE_URL}/rest/v1/direct_chat_reads?chat_id=eq.${encodeURIComponent(chatId)}&user_id=eq.${encodeURIComponent(otherUserId)}&select=last_seen_at&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!readRes.ok) await parseError(readRes);
    const rows = (await readRes.json()) as Array<{ last_seen_at: string | null }>;
    return { chatId, otherLastSeenAt: rows[0]?.last_seen_at || null };
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

const toChatSettings = (
  chatKind: 'direct' | 'group' | 'channel',
  chatId: string,
  row?: Record<string, any>
): ChatUserSettings => ({
  chatKind,
  chatId,
  mutedUntil: row?.muted_until || null,
  notificationsEnabled: row?.notifications_enabled ?? true,
  soundsEnabled: row?.sounds_enabled ?? true,
  mentionNotifications: row?.mention_notifications ?? true,
  showEmbeds: row?.show_embeds ?? true,
  compactMode: row?.compact_mode ?? false,
  enterToSend: row?.enter_to_send ?? true,
  readReceipts: row?.read_receipts ?? true,
  pinned: row?.pinned ?? false,
  nickname: row?.nickname || '',
  theme: row?.theme || 'default',
  extras: (row?.extras && typeof row.extras === 'object') ? row.extras : {}
});

export const getChatUserSettings = async (
  chatKind: 'direct' | 'group' | 'channel',
  chatId: string
): Promise<ChatUserSettings> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_user_settings?user_id=eq.${encodeURIComponent(user.id)}&chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}&select=*&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<Record<string, any>>;
    return toChatSettings(chatKind, chatId, rows[0]);
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const upsertChatUserSettings = async (
  chatKind: 'direct' | 'group' | 'channel',
  chatId: string,
  updates: Partial<Omit<ChatUserSettings, 'chatKind' | 'chatId'>>
): Promise<ChatUserSettings> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const payload: Record<string, any> = {
      user_id: user.id,
      chat_kind: chatKind,
      chat_id: chatId
    };
    if (updates.mutedUntil !== undefined) payload.muted_until = updates.mutedUntil;
    if (updates.notificationsEnabled !== undefined) payload.notifications_enabled = updates.notificationsEnabled;
    if (updates.soundsEnabled !== undefined) payload.sounds_enabled = updates.soundsEnabled;
    if (updates.mentionNotifications !== undefined) payload.mention_notifications = updates.mentionNotifications;
    if (updates.showEmbeds !== undefined) payload.show_embeds = updates.showEmbeds;
    if (updates.compactMode !== undefined) payload.compact_mode = updates.compactMode;
    if (updates.enterToSend !== undefined) payload.enter_to_send = updates.enterToSend;
    if (updates.readReceipts !== undefined) payload.read_receipts = updates.readReceipts;
    if (updates.pinned !== undefined) payload.pinned = updates.pinned;
    if (updates.nickname !== undefined) payload.nickname = updates.nickname;
    if (updates.theme !== undefined) payload.theme = updates.theme;
    if (updates.extras !== undefined) payload.extras = updates.extras;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_user_settings`, {
      method: 'POST',
      headers: {
        ...apiHeaders(accessToken),
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<Record<string, any>>;
    return toChatSettings(chatKind, chatId, rows[0]);
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const listArchivedChatIds = async (chatKind: 'direct' | 'group' | 'channel'): Promise<string[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_archives?user_id=eq.${encodeURIComponent(user.id)}&chat_kind=eq.${encodeURIComponent(chatKind)}&select=chat_id`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{ chat_id: string }>;
    return rows.map(row => row.chat_id);
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const setChatArchived = async (
  chatKind: 'direct' | 'group' | 'channel',
  chatId: string,
  archived: boolean
): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    if (archived) {
      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/chat_archives`, {
        method: 'POST',
        headers: { ...apiHeaders(accessToken), Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({
          user_id: user.id,
          chat_kind: chatKind,
          chat_id: chatId
        })
      });
      if (!insRes.ok) await parseError(insRes);
      return;
    }
    const delRes = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_archives?user_id=eq.${encodeURIComponent(user.id)}&chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}`,
      { method: 'DELETE', headers: apiHeaders(accessToken) }
    );
    if (!delRes.ok) await parseError(delRes);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const listChatUserSettingsForKind = async (
  chatKind: 'direct' | 'group' | 'channel'
): Promise<ChatUserSettings[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_user_settings?user_id=eq.${encodeURIComponent(user.id)}&chat_kind=eq.${encodeURIComponent(chatKind)}&select=*`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<Record<string, any>>;
    return rows.map(row => toChatSettings(chatKind, String(row.chat_id || ''), row));
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const setTypingPresence = async (
  chatKind: 'direct' | 'group',
  chatId: string,
  payload: { name: string; avatar: string; isAvatarImage: boolean } | null
): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    if (!payload) {
      const delRes = await fetch(
        `${SUPABASE_URL}/rest/v1/chat_typing_presence?chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}&user_id=eq.${encodeURIComponent(user.id)}`,
        { method: 'DELETE', headers: apiHeaders(accessToken) }
      );
      if (!delRes.ok) await parseError(delRes);
      return;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_typing_presence`, {
      method: 'POST',
      headers: {
        ...apiHeaders(accessToken),
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        chat_kind: chatKind,
        chat_id: chatId,
        user_id: user.id,
        name: payload.name,
        avatar: payload.avatar,
        is_avatar_image: payload.isAvatarImage,
        expires_at: new Date(Date.now() + 9000).toISOString()
      })
    });
    if (!res.ok) await parseError(res);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const listTypingPresence = async (chatKind: 'direct' | 'group', chatId: string): Promise<ChatTypingPresence[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const nowIso = new Date().toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_typing_presence?chat_kind=eq.${encodeURIComponent(chatKind)}&chat_id=eq.${encodeURIComponent(chatId)}&expires_at=gt.${encodeURIComponent(nowIso)}&user_id=neq.${encodeURIComponent(user.id)}&select=user_id,name,avatar,is_avatar_image`,
      { headers: apiHeaders(accessToken) }
    );
    if (!res.ok) await parseError(res);
    const rows = (await res.json()) as Array<{ user_id: string; name: string; avatar: string; is_avatar_image?: boolean }>;
    return rows.map(row => ({
      userId: row.user_id,
      name: row.name || 'User',
      avatar: row.avatar || 'U',
      isAvatarImage: Boolean(row.is_avatar_image)
    }));
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const sendChatCallSignal = async (input: {
  chatKind: 'direct' | 'group';
  chatId: string;
  toUserId: string;
  type: ChatCallSignalType;
  payload?: Record<string, any>;
}): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_call_signals`, {
      method: 'POST',
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        chat_kind: input.chatKind,
        chat_id: input.chatId,
        from_user_id: user.id,
        to_user_id: input.toUserId,
        signal_type: input.type,
        payload: input.payload || {}
      })
    });
    if (!res.ok) await parseError(res);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const createChatRequestByEmail = async (
  emailInput: string,
  type: 'direct' | 'group' = 'direct',
  groupName?: string
): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  const email = emailInput.trim().toLowerCase();
  if (!email) throw new Error('Enter an email address.');
  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email&limit=1`,
      { headers: apiHeaders(accessToken) }
    );
    if (!profileRes.ok) await parseError(profileRes);
    const rows = (await profileRes.json()) as Array<{ id: string; email: string }>;
    const target = rows[0];
    if (!target) throw new Error('No user found with that email.');
    if (target.id === user.id) throw new Error('You cannot send a chat request to yourself.');

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/chat_requests`, {
      method: 'POST',
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        from_user_id: user.id,
        to_user_id: target.id,
        type,
        group_name: groupName || null,
        status: 'pending'
      })
    });
    if (!insertRes.ok) await parseError(insertRes);
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const listIncomingChatRequests = async (): Promise<ChatRequestRecord[]> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const reqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_requests?to_user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending&select=id,type,group_name,created_at,from_user_id&order=created_at.desc`,
      { headers: apiHeaders(accessToken) }
    );
    if (!reqRes.ok) await parseError(reqRes);
    const requests = (await reqRes.json()) as Array<{
      id: string;
      type: 'direct' | 'group';
      group_name?: string | null;
      created_at: string;
      from_user_id: string;
    }>;
    if (!requests.length) return [];

    const ids = Array.from(new Set(requests.map(req => req.from_user_id)));
    const idList = ids.map(id => `"${id}"`).join(',');
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${encodeURIComponent(idList)})&select=id,email`,
      { headers: apiHeaders(accessToken) }
    );
    if (!profilesRes.ok) await parseError(profilesRes);
    const profiles = (await profilesRes.json()) as Array<{ id: string; email: string }>;
    const profileMap = new Map(profiles.map(p => [p.id, p.email]));

    return requests.map(req => ({
      id: req.id,
      email: profileMap.get(req.from_user_id) || 'unknown@user',
      type: req.type,
      groupName: req.group_name || undefined,
      createdAt: req.created_at
    }));
  } catch (error) {
    return mapMissingChatFeatureTableError(error);
  }
};

export const respondToChatRequest = async (requestId: string, action: 'accepted' | 'declined'): Promise<void> => {
  const { accessToken, user } = await requireAuthContext();
  try {
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_requests?id=eq.${encodeURIComponent(requestId)}&to_user_id=eq.${encodeURIComponent(user.id)}&select=id,status,type,group_name,from_user_id`,
      { headers: apiHeaders(accessToken) }
    );
    if (!fetchRes.ok) await parseError(fetchRes);
    const rows = (await fetchRes.json()) as Array<{
      id: string;
      status: string;
      type: 'direct' | 'group';
      group_name?: string | null;
      from_user_id: string;
    }>;
    const request = rows[0];
    if (!request) throw new Error('Chat request not found.');

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/chat_requests?id=eq.${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      headers: apiHeaders(accessToken),
      body: JSON.stringify({ status: action })
    });
    if (!patchRes.ok) await parseError(patchRes);

    if (action === 'accepted') {
      if (request.type === 'direct') {
        await createOrGetDirectChatByUserId(request.from_user_id);
      } else {
        const group = await createGroupChat(request.group_name || 'Group Chat', []);
        const joinRes = await fetch(`${SUPABASE_URL}/rest/v1/group_chat_members`, {
          method: 'POST',
          headers: { ...apiHeaders(accessToken), Prefer: 'resolution=ignore-duplicates' },
          body: JSON.stringify({
            group_chat_id: group.id,
            user_id: request.from_user_id,
            role: 'member'
          })
        });
        if (!joinRes.ok) await parseError(joinRes);
      }
    }
  } catch (error) {
    mapMissingChatFeatureTableError(error);
  }
};

export const subscribeToSupabaseChanges = async (
  specs: SupabaseRealtimeChangeSpec[],
  onEvent: (event: SupabaseRealtimeChangeEvent) => void
): Promise<() => void> => {
  if (!specs.length) return () => { };
  const { accessToken } = await requireAuthContext();
  const topic = `realtime:public:natural_${Math.random().toString(36).slice(2, 10)}`;
  const base = new URL(SUPABASE_URL);
  const wsProtocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${base.host}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;

  let ws: WebSocket | null = null;
  let closed = false;
  let refCounter = 1;
  let heartbeatTimer: number | null = null;
  let reconnectTimer: number | null = null;

  const nextRef = () => String(refCounter++);

  const send = (message: Record<string, any>) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(message));
  };

  const clearTimers = () => {
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const joinPayload = {
    config: {
      broadcast: { ack: false, self: false },
      presence: { enabled: false, key: '' },
      postgres_changes: specs.map(spec => ({
        event: spec.event || '*',
        schema: spec.schema,
        table: spec.table,
        ...(spec.filter ? { filter: spec.filter } : {})
      }))
    },
    access_token: accessToken
  };

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      send({
        topic: 'phoenix',
        event: 'access_token',
        payload: { access_token: accessToken },
        ref: nextRef()
      });

      send({
        topic,
        event: 'phx_join',
        payload: joinPayload,
        ref: nextRef()
      });

      heartbeatTimer = window.setInterval(() => {
        send({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: nextRef()
        });
      }, 25_000);
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(String(evt.data || '{}'));
        if (data?.event !== 'postgres_changes') return;
        const payload = data?.payload?.data || {};
        onEvent({
          schema: String(payload.schema || ''),
          table: String(payload.table || ''),
          eventType: String(payload.type || payload.eventType || ''),
          newRecord: payload.record || null,
          oldRecord: payload.old_record || null,
          raw: data
        });
      } catch {
        // ignore malformed realtime payloads
      }
    };

    ws.onclose = () => {
      clearTimers();
      if (closed) return;
      reconnectTimer = window.setTimeout(() => connect(), 1200);
    };

    ws.onerror = () => {
      // onclose handles reconnect
    };
  };

  connect();

  return () => {
    closed = true;
    clearTimers();
    if (ws && ws.readyState === WebSocket.OPEN) {
      send({
        topic,
        event: 'phx_leave',
        payload: {},
        ref: nextRef()
      });
    }
    try {
      ws?.close();
    } catch { }
    ws = null;
  };
};

export const adminBanUser = (userId: string, banned: boolean) => {
  const data = read();
  const user = data.users.find(u => u.id === userId);
  if (!user) throw new Error('User not found.');
  user.isBanned = banned;
  user.updatedAt = Date.now();
  write(data);
};

export const adminAdjustAiLimit = (userId: string, limit: number) => {
  const data = read();
  const user = data.users.find(u => u.id === userId);
  if (!user) throw new Error('User not found.');
  user.usage.aiLimit = Math.max(0, Math.floor(limit));
  user.updatedAt = Date.now();
  write(data);
};

export const getAdminMetrics = () => {
  const data = read();
  const totalUsers = data.users.length;
  const activeUsers = data.users.filter(u => !u.isBanned).length;
  const aiUsage = data.users.reduce((sum, user) => sum + user.usage.aiRequests, 0);
  const totalTokens = data.users.reduce((sum, user) => sum + user.usage.tokensUsed, 0);
  const totalStorage = data.users.reduce((sum, user) => sum + user.usage.storageBytes, 0);
  return {
    totalUsers,
    activeUsers,
    aiUsage,
    totalTokens,
    totalStorage,
    bannedUsers: data.users.filter(u => u.isBanned).length
  };
};
