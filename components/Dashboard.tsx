import React, { useState, useRef, useEffect, useMemo } from 'react';
import Picker from '@emoji-mart/react';
import emojiMartData from '@emoji-mart/data';
import {
    Home as HomeIcon,
    LayoutGrid,
    Globe,
    Box,
    Plus,
    Download,
    Search,
    Sparkles,
    Zap,
    MoreVertical,
    BookOpen,
    GraduationCap,
    Cloud,
    ChevronDown,
    Paperclip,
    ArrowRight,
    PenTool,
    Users,
    Settings,
    UserPlus,
    MessageSquare,
    Send,
    Image as ImageIcon,
  Mic,
  MicOff,
    ChevronUp,
    Copy,
    RotateCcw,
    Check,
    PanelLeft,
    PanelLeftClose,
    MessageSquarePlus,
    Trash2,
    Edit2,
    History,
    SidebarClose,
    SidebarOpen,
    Brain,
    Package,
    MoreHorizontal,
    Bug,
    ChevronRight,
    FolderOpen,
    X,
    Reply,
    ArrowDown,
    Volume2,
    Play,
    Hash,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  Maximize2,
  Minimize2,
    Info,
    Smile,
    Bell,
    Circle,
    Mail,
    Clock3,
    User,
    Pin,
    AtSign,
    Link as LinkIcon,
    List,
    Bold,
    Italic,
    Underline,
    Share,
    X as CloseIcon,
    FileText,
    Strikethrough,
    Lock,
    Star
} from 'lucide-react';
import { Learn } from './Learn';
import { generateEnglishLogic, sendChatMessage } from '../services/geminiService';
import { Preview } from './Preview';
import { OPENROUTER_FREE_MODELS, DEFAULT_OPENROUTER_MODEL } from '../constants';
import {
    addGroupChatMembers,
    blockUser,
    createChatRequestByEmail,
    createOrGetDirectChatByEmail,
    createGroupChat as createGroupChatRecord,
    deleteGroupMessage,
    deleteDirectMessage,
    editDirectMessage,
    editGroupMessage,
    getDirectChatSeenStatus,
    getChatUserSettings,
    getProfileBasicById,
    hideMessageForMe,
    listChatUserSettingsForKind,
    listChatMessageBlockStates,
    listBlockedUsers,
    listUsersWhoBlockedMe,
    listArchivedChatIds,
    listGroupChats,
    listGroupMessages,
    listHiddenMessageIds,
    listIncomingChatRequests,
    listStarredMessageIds,
    listTypingPresence,
    markDirectChatSeen,
    listDirectChats,
    listDirectMessages,
    respondToChatRequest,
    sendDirectMessage,
    toggleGroupMessageReaction,
    sendGroupMessage,
  setTypingPresence,
  setChatArchived,
  sendChatCallSignal,
  supabase,
  subscribeToSupabaseChanges,
    toggleStarredMessage,
    upsertChatUserSettings,
    toggleDirectMessageReaction,
    unblockUser,
    upsertChatMessageBlockState,
    updateGroupChatAvatar,
    uploadGroupChatAvatar,
    type BasicProfile,
    type SupabaseRealtimeChangeSpec,
    type ChatRequestRecord,
    type ChatUserSettings,
    type ChatTypingPresence,
    type DirectChatSummary,
    type DirectMessageAttachment,
    type GroupChatSummary
} from '../services/platformService';

export type DashboardView = 'home' | 'apps' | 'team' | 'learn' | 'ai-chat';

interface ProjectDetails {
    name: string;
    description: string;
    visibility: 'public' | 'private' | 'team';
    type: 'app' | 'website' | 'api' | 'script';
    initialContent?: string;
}

interface DashboardProject {
    id: string;
    name: string;
    description: string;
    visibility: 'public' | 'private' | 'team';
    type: 'app' | 'website' | 'api' | 'script';
    status: 'active' | 'archived';
    updatedAt: number;
}

interface DashboardProps {
    userName?: string;
    userAvatar?: string;
    currentUserId?: string | null;
    currentUserEmail?: string | null;
    userPlan?: string;
    userUsage?: { aiRequests: number; aiLimit: number };
    onNavigate: (view: 'home' | 'editor' | 'auth' | 'docs' | 'dashboard' | 'control') => void;
    onCreateProject: (details: ProjectDetails) => void;
    onOpenProject: (projectId: string) => void;
    onRenameProject: (projectId: string, name: string) => void;
    onDeleteProject: (projectId: string) => void;
    onDuplicateProject: (projectId: string) => void;
    onArchiveProject: (projectId: string) => void;
    onFileUpload: (file: File) => void;
    onOpenCodeInEditor: (payload: { code: string; language: string }) => void;
    projects: DashboardProject[];
    onLogout: () => void;
}

const INITIAL_TEAMS: Array<{ id: string; name: string; members: number; role: string; color: string; initials: string }> = [];

interface ChatAttachment {
    type: 'image' | 'gif' | 'video' | 'file';
    url: string;
    name: string;
    size?: string;
    file?: File;
}

interface ChatMessage {
    id: number;
    user: string;
    avatar: string;
    isAvatarImage?: boolean;
    time: string;
    text: string;
    color: string;
    isMe?: boolean;
    isPrivate?: boolean;
    reactions?: { emoji: string; count: number; active: boolean }[];
    replyToId?: number;
    isEdited?: boolean;
    attachments?: ChatAttachment[];
    createdAt?: string;
}

type ChatBlockKind = 'poll' | 'timer' | 'checklist' | 'progress' | 'decision' | 'note' | 'link';

interface ChatBlockPayload {
    kind: ChatBlockKind;
    title: string;
    createdAt: number;
    data: Record<string, any>;
}

interface CallEventSummary {
    peerName: string;
    durationSec: number;
    startedAt: number;
    endedAt: number;
    screenshotCount: number;
    recordingCount: number;
    callMessages?: Array<{ senderName: string; text: string; createdAt: number }>;
}

const isHttpUrl = (value?: string) => /^https?:\/\//i.test((value || '').trim());
const stripHtmlTags = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const CALL_EVENT_PREFIX = '__CALL_EVENT__:';
const CHAT_BLOCK_PREFIX = '__CHAT_BLOCK__:';
const CHAT_BLOCK_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const DRAW_COLORS = ['#60a5fa', '#34d399', '#f472b6', '#f59e0b', '#f87171', '#e5e7eb'];
const BLOCK_KINDS: ChatBlockKind[] = ['timer', 'poll', 'checklist', 'progress', 'decision', 'note', 'link'];
const BLOCK_META: Record<ChatBlockKind, { label: string; icon: string; hint: string; glow: string; tint: string }> = {
    timer: {
        label: 'Timer',
        icon: '⏱',
        hint: 'Focus sprint with live countdown',
        glow: 'from-cyan-500/30 to-blue-500/10',
        tint: 'text-cyan-200'
    },
    poll: {
        label: 'Poll',
        icon: '📊',
        hint: 'Quick vote with live percentages',
        glow: 'from-indigo-500/30 to-blue-500/10',
        tint: 'text-indigo-200'
    },
    checklist: {
        label: 'Checklist',
        icon: '✅',
        hint: 'Track team tasks in-thread',
        glow: 'from-emerald-500/30 to-teal-500/10',
        tint: 'text-emerald-200'
    },
    progress: {
        label: 'Progress',
        icon: '📈',
        hint: 'Show milestone progress',
        glow: 'from-green-500/30 to-emerald-500/10',
        tint: 'text-green-200'
    },
    decision: {
        label: 'Decision',
        icon: '🎯',
        hint: 'Pick one aligned direction',
        glow: 'from-violet-500/30 to-purple-500/10',
        tint: 'text-violet-200'
    },
    note: {
        label: 'Note',
        icon: '📝',
        hint: 'Pin context for the team',
        glow: 'from-amber-500/30 to-orange-500/10',
        tint: 'text-amber-200'
    },
    link: {
        label: 'Link Card',
        icon: '🔗',
        hint: 'Drop resources with clean preview',
        glow: 'from-sky-500/30 to-blue-500/10',
        tint: 'text-sky-200'
    }
};
const serializeCallEventSummary = (payload: CallEventSummary) => `${CALL_EVENT_PREFIX}${JSON.stringify(payload)}`;
const serializeChatBlock = (payload: ChatBlockPayload) => `${CHAT_BLOCK_PREFIX}${JSON.stringify(payload)}`;
const parseChatBlock = (text: string): ChatBlockPayload | null => {
    if (!text.startsWith(CHAT_BLOCK_PREFIX)) return null;
    try {
        const parsed = JSON.parse(text.slice(CHAT_BLOCK_PREFIX.length));
        if (!parsed || typeof parsed !== 'object') return null;
        const kind = String(parsed.kind || '');
        if (!['poll', 'timer', 'checklist', 'progress', 'decision', 'note', 'link'].includes(kind)) return null;
        return {
            kind: kind as ChatBlockKind,
            title: String(parsed.title || 'Block'),
            createdAt: Number(parsed.createdAt || Date.now()),
            data: typeof parsed.data === 'object' && parsed.data ? parsed.data : {}
        };
    } catch {
        return null;
    }
};
const parseCallEventSummary = (text: string): CallEventSummary | null => {
    if (!text.startsWith(CALL_EVENT_PREFIX)) return null;
    try {
        const parsed = JSON.parse(text.slice(CALL_EVENT_PREFIX.length));
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            peerName: String(parsed.peerName || 'User'),
            durationSec: Number(parsed.durationSec || 0),
            startedAt: Number(parsed.startedAt || Date.now()),
            endedAt: Number(parsed.endedAt || Date.now()),
            screenshotCount: Number(parsed.screenshotCount || 0),
            recordingCount: Number(parsed.recordingCount || 0),
            callMessages: Array.isArray(parsed.callMessages)
                ? parsed.callMessages
                    .map((item: any) => ({
                        senderName: String(item?.senderName || 'User'),
                        text: String(item?.text || ''),
                        createdAt: Number(item?.createdAt || Date.now())
                    }))
                    .filter((item: any) => Boolean(item.text.trim()))
                : []
        };
    } catch {
        return null;
    }
};
const CODE_FILE_LANG_BY_EXT: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    sh: 'bash',
    zsh: 'bash',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown'
};

const getCodeLanguageFromName = (name: string) => {
    const ext = (name.split('.').pop() || '').toLowerCase();
    return CODE_FILE_LANG_BY_EXT[ext] || null;
};

const isCodeAttachmentName = (name: string) => Boolean(getCodeLanguageFromName(name));
const getMessageTimestamp = (msg: ChatMessage) => Date.parse(msg.createdAt || '') || msg.id || Date.now();
const areInSameMessageCluster = (a?: ChatMessage, b?: ChatMessage) => {
    if (!a || !b) return false;
    if (Boolean(a.isMe) !== Boolean(b.isMe)) return false;
    if ((a.user || '') !== (b.user || '')) return false;
    return Math.abs(getMessageTimestamp(a) - getMessageTimestamp(b)) <= 45 * 60 * 1000;
};
const isSameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const formatDayBoundaryLabel = (date: Date) => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((startToday.getTime() - startTarget.getTime()) / 86400000);
    const longDate = date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
    if (diffDays === 0) return `Today - ${longDate}`;
    if (diffDays === 1) return `Yesterday - ${longDate}`;
    return longDate;
};

const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTimerDurationLabel = (seconds: number) => {
    const safe = Math.max(1, Math.floor(Number(seconds) || 0));
    if (safe < 60) return `${safe} second${safe === 1 ? '' : 's'}`;
    const mins = Math.floor(safe / 60);
    const rem = safe % 60;
    if (rem === 0) return `${mins} minute${mins === 1 ? '' : 's'}`;
    return `${mins}m ${rem}s`;
};

const describeChatBlockNotification = (block: ChatBlockPayload, actorName = 'User') => {
    switch (block.kind) {
        case 'timer':
            return `${actorName} created a ${formatTimerDurationLabel(Number(block.data?.durationSec || 0))} timer`;
        case 'poll':
            return `${actorName} started a poll`;
        case 'checklist':
            return `${actorName} created a checklist`;
        case 'progress':
            return `${actorName} shared a progress block`;
        case 'decision':
            return `${actorName} started a decision block`;
        case 'note':
            return `${actorName} shared a note`;
        case 'link':
            return `${actorName} shared a link block`;
        default:
            return `${actorName} created a block`;
    }
};

interface ChatThread {
    id: string;
    title: string;
    messages: { role: 'user' | 'model', text: string }[];
    lastModified: number;
    pinned?: boolean;
}

interface SharedThreadPayload {
    title: string;
    exportedAt: string;
    messages: { role: 'user' | 'model', text: string }[];
}

// AI Logo URL - Updated to match AI Chat tab
const AI_LOGO_URL = "https://image2url.com/r2/default/images/1770704003877-ff97628a-a31a-49b7-bb0f-5223bea264a0.png";
const CHAT_THREADS_STORAGE_KEY = 'natural.ai.chatThreads.v1';
const SHARED_THREAD_HASH_KEY = 'sharedThread';
const TEAM_CHAT_DRAFTS_KEY = 'natural.teamChatDrafts.v1';
const GIPHY_API_KEY = '7UB5XSH4CeIfizxKKME8ipNU3uWO3Ju2';
const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉'];

const INITIAL_CHAT_DATA: Record<string, ChatMessage[]> = {};

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
}

interface GifResult {
    id: string;
    title: string;
    previewUrl: string;
    originalUrl: string;
}

interface ChatPopupNotification {
    id: string;
    chatKind: 'direct' | 'group';
    chatId: string;
    messageId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    senderAvatarIsImage: boolean;
    groupName?: string;
    text: string;
    replyText: string;
}

type CallMode = 'audio' | 'video';
type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active';
type CallOverlayItem =
    | { kind: 'stroke'; color: string; points: Array<{ x: number; y: number }> }
    | { kind: 'text'; color: string; x: number; y: number; text: string };

interface IncomingCallState {
    chatId: string;
    fromUserId: string;
    fromName: string;
    fromAvatar: string;
    fromAvatarIsImage: boolean;
    sessionId: string;
    mode: CallMode;
    offerSdp: RTCSessionDescriptionInit;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => (
    <div className="emoji-picker-container bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl p-1 z-50 w-[360px] h-[430px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <Picker
            data={emojiMartData as any}
            theme="dark"
            previewPosition="none"
            navPosition="top"
            categories={['frequent', 'people', 'nature', 'foods', 'activity', 'places', 'objects', 'symbols', 'flags']}
            skinTonePosition="none"
            searchPosition="top"
            perLine={9}
            maxFrequentRows={2}
            set="native"
            onEmojiSelect={(emoji: any) => onSelect(emoji?.native || '')}
        />
    </div>
);

// --- SOUND UTILS ---
const playNotificationSound = () => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

const playMessageSentSound = () => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = audioCtx.currentTime;

        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(860, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.14);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, now);
        filter.Q.value = 0.7;

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
    } catch (e) {
        console.error("Send sound failed", e);
    }
};

const playTimerBeepSound = () => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const triggerDing = (startAt: number) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1046, startAt);
            osc.frequency.exponentialRampToValueAtTime(987, startAt + 0.08);
            filter.type = 'highshelf';
            filter.frequency.setValueAtTime(1700, startAt);
            filter.gain.setValueAtTime(4, startAt);
            osc.connect(gainNode);
            gainNode.gain.setValueAtTime(0.0001, startAt);
            gainNode.gain.exponentialRampToValueAtTime(0.11, startAt + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);
            gainNode.connect(filter);
            filter.connect(audioCtx.destination);
            osc.start(startAt);
            osc.stop(startAt + 0.24);
        };

        const now = audioCtx.currentTime;
        triggerDing(now);
        triggerDing(now + 0.28);
        triggerDing(now + 0.56);
    } catch (e) {
        console.error("Timer beep failed", e);
    }
};

const playCallRingPattern = (variant: 'outgoing' | 'incoming') => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = ctx.currentTime;
        const notes = variant === 'incoming'
            ? [523.25, 659.25, 783.99]
            : [440.0, 554.37, 659.25];
        notes.forEach((freq, idx) => {
            const start = now + idx * 0.13;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1200, start);
            filter.Q.value = 0.8;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.06, start + 0.018);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.13);
        });
    } catch {}
};

const encodeSharePayload = (payload: SharedThreadPayload) => {
    try {
        return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch {
        return '';
    }
};

const decodeSharePayload = (encoded: string): SharedThreadPayload | null => {
    try {
        const decoded = decodeURIComponent(escape(atob(encoded)));
        const parsed = JSON.parse(decoded) as SharedThreadPayload;
        if (!parsed || !Array.isArray(parsed.messages)) return null;
        return parsed;
    } catch {
        return null;
    }
};

// --- HELPER: WRAP REACT CODE ---
const wrapReactCode = (code: string) => {
    if (code.trim().startsWith('<!DOCTYPE html>') || code.trim().startsWith('<html')) {
        return code;
    }
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body { background-color: #0e1011; color: #e6edf3; font-family: 'Inter', sans-serif; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        const { useState, useEffect, useRef, useMemo } = React;
        const { createRoot } = ReactDOM;
        const App = () => {
            ${code.includes('return') ? '' : 'return ('}
            ${code}
            ${code.includes('return') ? '' : ');'}
        };
        try {
            const root = createRoot(document.getElementById('root'));
            root.render(<App />);
        } catch(e) {
            document.body.innerHTML = '<div class="text-red-500 p-4">Error rendering preview: ' + e.message + '</div>';
        }
    </script>
</body>
</html>`;
};

const wrapVanillaJsCode = (code: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { margin: 0; padding: 16px; background: #0e1011; color: #e6edf3; font-family: Inter, sans-serif; }
    </style>
</head>
<body>
    <div id="app"></div>
    <script>
      try {
        ${code}
      } catch (e) {
        document.body.innerHTML = '<div style="color:#ef4444;padding:12px;">Error running JS: ' + e.message + '</div>';
      }
    </script>
</body>
</html>`;

const wrapHtmlSnippet = (snippet: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <style>
    html, body { margin: 0; padding: 0; min-height: 100%; background: #0e1011; color: #e6edf3; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  </style>
</head>
<body>
${snippet}
</body>
</html>`;

// --- RICH TEXT PARSER & RENDERER ---
const renderInlineMarkdown = (text: string): React.ReactNode[] => {
    const regex = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|_[^_]+_|\$[^$\n]+\$|\[[^\]]+\]\([^)]+\))/g;
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(<React.Fragment key={`txt-${key++}`}>{text.slice(lastIndex, match.index)}</React.Fragment>);
        }
        const token = match[0];

        if (token.startsWith('**') && token.endsWith('**')) {
            nodes.push(<strong key={`b-${key++}`} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
        } else if (token.startsWith('__') && token.endsWith('__')) {
            nodes.push(<strong key={`u-${key++}`} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
        } else if (token.startsWith('~~') && token.endsWith('~~')) {
            nodes.push(<s key={`s-${key++}`} className="opacity-70">{token.slice(2, -2)}</s>);
        } else if (token.startsWith('`') && token.endsWith('`')) {
            nodes.push(<code key={`c-${key++}`} className="px-1 py-0.5 rounded bg-[#1c1e21] border border-[#333] text-[#b5f5d2] font-mono text-[13px]">{token.slice(1, -1)}</code>);
        } else if (token.startsWith('*') && token.endsWith('*')) {
            nodes.push(<em key={`i-${key++}`} className="italic text-[#d9d9d9]">{token.slice(1, -1)}</em>);
        } else if (token.startsWith('_') && token.endsWith('_')) {
            nodes.push(<em key={`i2-${key++}`} className="italic text-[#d9d9d9]">{token.slice(1, -1)}</em>);
        } else if (token.startsWith('$') && token.endsWith('$')) {
            nodes.push(<span key={`m-${key++}`} className="font-mono text-[#c7d2fe] bg-[#1c1e21] border border-[#333] px-1.5 py-0.5 rounded">{token}</span>);
        } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
            const [label, url] = token.slice(1, -1).split('](');
            nodes.push(<a key={`a-${key++}`} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{label}</a>);
        } else {
            nodes.push(<React.Fragment key={`raw-${key++}`}>{token}</React.Fragment>);
        }
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        nodes.push(<React.Fragment key={`tail-${key++}`}>{text.slice(lastIndex)}</React.Fragment>);
    }
    return nodes;
};

const RichTextRenderer = ({
    text,
    parseMarkdown = true,
    allowHtml = true
}: {
    text: string;
    parseMarkdown?: boolean;
    allowHtml?: boolean;
}) => {
    if (!text) return null;
    const isHTML = /<[a-z][\s\S]*>/i.test(text);
    if (isHTML && allowHtml) {
        return (
            <div
                className="text-[15px] leading-relaxed text-[#e3e3e3] font-light whitespace-pre-wrap [&>b]:font-bold [&>strong]:font-bold [&>i]:italic [&>em]:italic [&>u]:underline [&>s]:line-through [&>a]:text-blue-400 [&>a]:underline [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:marker:text-white/50"
                dangerouslySetInnerHTML={{ __html: text }}
            />
        );
    }

    if (!parseMarkdown) {
        return <div className="text-[15px] leading-relaxed text-[#e3e3e3] font-light whitespace-pre-wrap">{text}</div>;
    }

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let idx = 0;

    while (idx < lines.length) {
        const line = lines[idx];
        const trimmed = line.trim();

        if (!trimmed) {
            elements.push(<div key={`sp-${idx}`} className="h-2" />);
            idx++;
            continue;
        }

        if (/^\$\$[\s\S]*\$\$$/.test(trimmed)) {
            elements.push(
                <div key={`math-${idx}`} className="my-2 px-3 py-2 rounded-lg bg-[#1c1e21] border border-[#333] text-[#c7d2fe] font-mono overflow-x-auto">
                    {trimmed}
                </div>
            );
            idx++;
            continue;
        }

        if (/^#{1,3}\s+/.test(trimmed)) {
            const level = (trimmed.match(/^#+/)?.[0].length || 1) as 1 | 2 | 3;
            const content = trimmed.replace(/^#{1,3}\s+/, '');
            const cls = level === 1 ? 'text-xl font-bold' : level === 2 ? 'text-lg font-semibold' : 'text-base font-semibold';
            elements.push(<div key={`h-${idx}`} className={`${cls} text-white mt-2`}>{renderInlineMarkdown(content)}</div>);
            idx++;
            continue;
        }

        if (/^>\s+/.test(trimmed)) {
            elements.push(
                <blockquote key={`q-${idx}`} className="border-l-2 border-[#4b5563] pl-3 text-[#cfd3d8] italic my-1">
                    {renderInlineMarkdown(trimmed.replace(/^>\s+/, ''))}
                </blockquote>
            );
            idx++;
            continue;
        }

        if (/^(-|\*)\s+/.test(trimmed)) {
            const listItems: React.ReactNode[] = [];
            while (idx < lines.length && /^(-|\*)\s+/.test(lines[idx].trim())) {
                const item = lines[idx].trim().replace(/^(-|\*)\s+/, '');
                listItems.push(<li key={`ul-${idx}`} className="my-1">{renderInlineMarkdown(item)}</li>);
                idx++;
            }
            elements.push(<ul key={`ul-wrap-${idx}`} className="list-disc pl-6 marker:text-white/50">{listItems}</ul>);
            continue;
        }

        if (/^\d+\.\s+/.test(trimmed)) {
            const listItems: React.ReactNode[] = [];
            while (idx < lines.length && /^\d+\.\s+/.test(lines[idx].trim())) {
                const item = lines[idx].trim().replace(/^\d+\.\s+/, '');
                listItems.push(<li key={`ol-${idx}`} className="my-1">{renderInlineMarkdown(item)}</li>);
                idx++;
            }
            elements.push(<ol key={`ol-wrap-${idx}`} className="list-decimal pl-6 marker:text-white/50">{listItems}</ol>);
            continue;
        }

        if (/^---+$/.test(trimmed)) {
            elements.push(<hr key={`hr-${idx}`} className="border-[#2b3035] my-3" />);
            idx++;
            continue;
        }

        elements.push(<p key={`p-${idx}`} className="min-h-[1.2em]">{renderInlineMarkdown(line)}</p>);
        idx++;
    }

    return <div className="text-[15px] leading-relaxed text-[#e3e3e3] font-light whitespace-pre-wrap">{elements}</div>;
};

const looksLikeHtmlCode = (value: string) => {
    const text = value.trim().toLowerCase();
    if (!text) return false;
    if (text.includes('<!doctype html') || text.includes('<html')) return true;
    const hasMarkupTags = ['<head', '<body', '<script', '<style', '</div>', '<button', '<input', '<form', '<section', '<main']
        .some(tag => text.includes(tag));
    const tagHits = (text.match(/<[^>]+>/g) || []).length;
    return hasMarkupTags && tagHits >= 3;
};

const extractFencedCode = (value: string) => {
    const input = value || '';
    const open = input.match(/```(?:[a-zA-Z0-9+_-]+)?[ \t]*\n?/);
    if (!open || open.index === undefined) return '';
    const start = open.index + open[0].length;
    const close = input.indexOf('```', start);
    const block = close >= 0 ? input.slice(start, close) : input.slice(start);
    return block.trim();
};

const sanitizeHtmlForPreview = (value: string) => {
    let html = (value || '').replace(/\u0000/g, '').trim();
    if (!html) return html;

    html = html.replace(/^```(?:[a-zA-Z0-9+_-]+)?[ \t]*\n?/i, '').replace(/```+$/g, '').trim();

    const firstTagStart = html.search(/<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]|<main[\s>]|<section[\s>]|<div[\s>]|<script[\s>]|<style[\s>]/i);
    if (firstTagStart > 0) {
        const prefix = html.slice(0, firstTagStart);
        if (!/[<>{}]/.test(prefix) && prefix.length < 3000) {
            html = html.slice(firstTagStart);
        }
    }

    return html.trim();
};

const extractRunnableCode = (raw: string, languageHint = 'text') => {
    const input = (raw || '').trim();
    if (!input) return '';

    const fenced = extractFencedCode(input);
    if (fenced) {
        return looksLikeHtmlCode(fenced) ? sanitizeHtmlForPreview(fenced) : fenced;
    }

    if (looksLikeHtmlCode(input)) {
        const htmlStart = input.search(/<!doctype html|<html|<head|<body|<div|<main|<section|<script|<style/i);
        if (htmlStart >= 0) return sanitizeHtmlForPreview(input.slice(htmlStart));
    }

    const hint = (languageHint || '').toLowerCase();
    if (hint === 'javascript' || hint === 'js') {
        const jsStart = input.search(/(const |let |var |function |\(\)\s*=>|document\.|window\.)/);
        if (jsStart > 0) return input.slice(jsStart).trim();
    }

    return input;
};

type ExtractedCodeBlock = {
    lang: string;
    code: string;
    header: string;
};

const extractCodeBlocksFromText = (value: string): ExtractedCodeBlock[] => {
    const blocks: ExtractedCodeBlock[] = [];
    const input = value || '';
    const regex = /```([^\n`]*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(input)) !== null) {
        const header = String(match[1] || '').trim();
        const lang = (header.split(/\s+/)[0] || 'text').toLowerCase();
        const code = String(match[2] || '').trim();
        if (!code) continue;
        blocks.push({ lang, code, header });
    }
    return blocks;
};

const injectIntoHead = (html: string, content: string) => {
    if (!content.trim()) return html;
    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${content}\n</head>`);
    return html.replace(/<body[^>]*>/i, `<head>\n${content}\n</head>\n$&`);
};

const injectIntoBodyEnd = (html: string, content: string) => {
    if (!content.trim()) return html;
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${content}\n</body>`);
    return `${html}\n${content}`;
};

const buildMultiFilePreviewHtml = (fullText?: string) => {
    if (!fullText) return null;
    const blocks = extractCodeBlocksFromText(fullText);
    if (blocks.length < 2) return null;

    const htmlBlock = blocks.find(block =>
        ['html', 'htm'].includes(block.lang) || /<!doctype html|<html|<head|<body/i.test(block.code)
    );
    const cssBlocks = blocks.filter(block =>
        ['css', 'scss', 'sass', 'less'].includes(block.lang) ||
        block.header.toLowerCase().includes('.css')
    );
    const jsBlocks = blocks.filter(block =>
        ['javascript', 'js', 'typescript', 'ts'].includes(block.lang) ||
        block.header.toLowerCase().includes('.js') ||
        block.header.toLowerCase().includes('.ts')
    );

    if (!htmlBlock && !cssBlocks.length && !jsBlocks.length) return null;

    let html = htmlBlock ? sanitizeHtmlForPreview(htmlBlock.code) : wrapHtmlSnippet('<div id="app"></div>');
    const cssText = cssBlocks.map(block => block.code).join('\n\n').trim();
    const jsText = jsBlocks.map(block => block.code).join('\n\n').trim();

    if (cssText) {
        html = injectIntoHead(html, `<style>\n${cssText}\n</style>`);
    }
    if (jsText) {
        html = injectIntoBodyEnd(html, `<script>\n${jsText}\n</script>`);
    }
    return html;
};

const FormattedMessage = ({
    text,
    onRunCode,
    onOpenInEditor
}: {
    text: string;
    onRunCode: (code: string, lang: string, fullMessageText?: string) => void;
    onOpenInEditor: (code: string, lang: string) => void;
}) => {
    const normalizedText = (() => {
        const fenceCount = (text.match(/```/g) || []).length;
        if (fenceCount % 2 === 1) return `${text}\n\`\`\``;
        return text;
    })();

    const renderCodeCard = (code: string, lang: string, key: string | number) => {
        const safeLang = (lang || 'text').toLowerCase();
        const isRunable = ['html', 'react', 'jsx', 'tsx', 'javascript', 'js'].includes(safeLang);
        return (
            <div key={key} className="bg-[#1e1e1e] rounded-md border border-[#333] overflow-hidden my-3 w-full">
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#252626] border-b border-[#333] select-none">
                    <span className="text-xs text-[#8d96a0] font-mono lowercase">{safeLang}</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigator.clipboard.writeText(code)}
                            className="flex items-center gap-1.5 text-[10px] text-[#8d96a0] hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-[#333]"
                        >
                            <Copy className="w-3 h-3" /> Copy
                        </button>
                        {isRunable && (
                            <button
                                onClick={() => onRunCode(code, safeLang, normalizedText)}
                                className="flex items-center gap-1.5 text-[10px] text-green-400 hover:text-green-300 transition-colors px-1.5 py-0.5 rounded hover:bg-[#333]"
                            >
                                <Play className="w-3 h-3 fill-current" /> Run
                            </button>
                        )}
                        <button
                            onClick={() => onOpenInEditor(code, safeLang)}
                            className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors px-1.5 py-0.5 rounded hover:bg-[#333]"
                        >
                            <PenTool className="w-3 h-3" /> Open in Editor
                        </button>
                    </div>
                </div>
                <div className="p-3 overflow-x-auto custom-scrollbar">
                    <pre className="text-sm font-mono text-[#e3e3e3] whitespace-pre tab-[2]">{code}</pre>
                </div>
            </div>
        );
    };

    const hasFencedCode = /```[\s\S]*?```/.test(normalizedText);
    const canRunMultiFile = Boolean(buildMultiFilePreviewHtml(normalizedText));
    if (!hasFencedCode && looksLikeHtmlCode(normalizedText)) {
        return <div className="space-y-2 w-full min-w-0">{renderCodeCard(normalizedText.trim(), 'html', 'html-whole')}</div>;
    }

    // Split by code blocks
    const parts = normalizedText.split(/(```[\s\S]*?```)/g);

    return (
        <div className="space-y-2 w-full min-w-0">
            {canRunMultiFile && (
                <div className="flex justify-end mb-1">
                    <button
                        onClick={() => onRunCode(normalizedText, 'html', normalizedText)}
                        className="flex items-center gap-1.5 text-[11px] text-emerald-300 hover:text-emerald-200 border border-emerald-400/30 bg-emerald-500/10 rounded px-2 py-1 transition-colors"
                    >
                        <Play className="w-3.5 h-3.5 fill-current" /> Run Full Project
                    </button>
                </div>
            )}
            {parts.map((part, index) => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    // Extract language and code
                    const content = part.slice(3, -3);
                    const match = content.match(/^([a-zA-Z0-9+]+)\n/);
                    let lang = 'text';
                    let code = content;

                    if (match) {
                        lang = match[1];
                        code = content.slice(match[0].length);
                    } else if (content.startsWith('\n')) {
                        code = content.slice(1);
                    }

                    return renderCodeCard(code, lang, index);
                }
                const partTrim = part.trim();
                if (partTrim && looksLikeHtmlCode(partTrim)) {
                    return renderCodeCard(partTrim, 'html', index);
                }
                // Handle normal text
                if (!part.trim()) return null;
                return (
                    <React.Fragment key={index}>
                        <RichTextRenderer text={part} allowHtml={false} />
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const ActionButtons = ({ text, onRedo }: { text: string, onRedo: () => void }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-[#333537] text-[#8d96a0] hover:text-white transition-colors" title="Copy full response">{copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}</button>
            <button onClick={onRedo} className="p-1.5 rounded-md hover:bg-[#333537] text-[#8d96a0] hover:text-white transition-colors" title="Regenerate response"><RotateCcw className="w-4 h-4" /></button>
        </div>
    );
};

// --- PLUS MENU COMPONENT ---
interface PlusMenuProps { onClose: () => void; onSelect: (action: string) => void; }
const PlusMenu: React.FC<PlusMenuProps> = ({ onClose, onSelect }) => {
    const [showMore, setShowMore] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose(); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);
    const MenuItem = ({ icon, label, onClick, hasSubmenu = false }: any) => (
        <button onClick={onClick} className="w-full text-left px-4 py-2.5 hover:bg-[#2b2d30] text-[#e3e3e3] text-sm flex items-center justify-between transition-colors group/menuitem">
            <div className="flex items-center gap-3">
                {typeof icon === 'string' ? <span className="material-symbols-outlined text-[20px] text-[#8d96a0] group-hover/menuitem:text-white">{icon}</span> : React.cloneElement(icon, { className: "w-5 h-5 text-[#8d96a0] group-hover/menuitem:text-white" })}
                <span className="group-hover/menuitem:text-white">{label}</span>
            </div>
            {hasSubmenu && <ChevronRight className="w-4 h-4 text-[#8d96a0]" />}
        </button>
    );
    return (
        <div ref={menuRef} className="absolute bottom-full left-0 mb-2 w-64 bg-[#1e1e1e] border border-[#333] rounded-2xl shadow-2xl overflow-visible z-50 animate-in zoom-in-95 duration-200 origin-bottom-left flex flex-col py-1.5">
            <MenuItem icon={<Paperclip />} label="Add photos & files" onClick={() => onSelect('upload')} />
            <MenuItem icon={<ImageIcon />} label="Generate UI Design" onClick={() => onSelect('ui')} />
            <MenuItem icon={<Brain />} label="Deep Reasoning" onClick={() => onSelect('reasoning')} />
            <MenuItem icon={<Globe />} label="Web Search" onClick={() => onSelect('search')} />
            <MenuItem icon={<Package />} label="Package Search" onClick={() => onSelect('packages')} />
            <div className="relative group">
                <div className="w-full" onMouseEnter={() => setShowMore(true)}><MenuItem icon={<MoreHorizontal />} label="More" onClick={() => { }} hasSubmenu /></div>
                {showMore && <div className="absolute left-[98%] bottom-[-10px] ml-1 w-56 bg-[#1e1e1e] border border-[#333] rounded-2xl shadow-2xl overflow-hidden py-1.5 z-50 animate-in fade-in slide-in-from-left-2 duration-150" onMouseLeave={() => setShowMore(false)}><MenuItem icon={<Bug />} label="Debug Code" onClick={() => onSelect('debug')} /><MenuItem icon={<FolderOpen />} label="Project Context" onClick={() => onSelect('context')} /></div>}
            </div>


        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({
    userName = "Anwar",
    userAvatar = '',
    currentUserId = null,
    currentUserEmail = null,
    userPlan = 'free',
    userUsage,
    onNavigate,
    onCreateProject,
    onOpenProject,
    onRenameProject,
    onDeleteProject,
    onDuplicateProject,
    onArchiveProject,
    onFileUpload,
    onOpenCodeInEditor,
    projects,
    onLogout
}) => {
    const [currentView, setCurrentView] = useState<DashboardView>('home');
    const [prompt, setPrompt] = useState("");
    const [activeTab, setActiveTab] = useState<'app' | 'design'>('app');
    const [isGenerating, setIsGenerating] = useState(false);

    // Intro Animation State
    const [showIntro, setShowIntro] = useState(true);
    const [introFading, setIntroFading] = useState(false);

    // Chat State
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_OPENROUTER_MODEL);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showHistorySidebar, setShowHistorySidebar] = useState(false);
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const [activeToolId, setActiveToolId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // AI Thread State
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<{ text: string } | null>(null);
    const [isTemporaryChat, setIsTemporaryChat] = useState(false);
    const [openThreadMenuId, setOpenThreadMenuId] = useState<string | null>(null);
    const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
    const [editingThreadTitle, setEditingThreadTitle] = useState('');
    const [threadsReady, setThreadsReady] = useState(false);

    // Team & Chat State
    const [teams, setTeams] = useState(INITIAL_TEAMS);
    const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
    const [teamFormData, setTeamFormData] = useState({ name: '', description: '' });
    const [showTeamsSidebar, setShowTeamsSidebar] = useState(false);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [directChats, setDirectChats] = useState<DirectChatSummary[]>([]);
    const [directChatEmailInput, setDirectChatEmailInput] = useState('');
    const [isCreatingDirectChat, setIsCreatingDirectChat] = useState(false);
    const [groupChats, setGroupChats] = useState<GroupChatSummary[]>([]);
    const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
    const [blockedByUserIds, setBlockedByUserIds] = useState<string[]>([]);
    const [chatSendError, setChatSendError] = useState<string | null>(null);
    const [pendingChatRequests, setPendingChatRequests] = useState<ChatRequestRecord[]>([]);
    const [hiddenMessagesByChat, setHiddenMessagesByChat] = useState<Record<string, number[]>>({});
    const [starredMessagesByChat, setStarredMessagesByChat] = useState<Record<string, string[]>>({});
    const [directSeenByChat, setDirectSeenByChat] = useState<Record<string, string | null>>({});
    const [newChatMode, setNewChatMode] = useState<'direct' | 'group' | 'channel'>('direct');
    const [groupChatNameInput, setGroupChatNameInput] = useState('');
    const [groupChatMembersInput, setGroupChatMembersInput] = useState('');
    const [selectedGroupMemberUserIds, setSelectedGroupMemberUserIds] = useState<string[]>([]);
    const [newChannelNameInput, setNewChannelNameInput] = useState('');
    const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
    const [showTeamDetailsRail, setShowTeamDetailsRail] = useState(false);
    const [showTeamSearch, setShowTeamSearch] = useState(false);
    const [showTeamPlusMenu, setShowTeamPlusMenu] = useState(false);
    const [blockComposer, setBlockComposer] = useState<null | {
        kind: ChatBlockKind;
        title: string;
        optionsList: string[];
        checklistItems: string[];
        body: string;
        url: string;
        durationMin: number;
        durationSec: number;
        progressCurrent: number;
        progressMax: number;
    }>(null);
    const [chatBlockStateByMessage, setChatBlockStateByMessage] = useState<Record<number, any>>({});
    const [blockOptimisticUntilByMessage, setBlockOptimisticUntilByMessage] = useState<Record<number, number>>({});
    const [pendingDeleteMessage, setPendingDeleteMessage] = useState<{ msg: ChatMessage; chatId: string } | null>(null);
    const [showAdvancedChatSettings, setShowAdvancedChatSettings] = useState(false);
    const [chatSettingsTab, setChatSettingsTab] = useState<'overview' | 'notifications' | 'privacy' | 'advanced'>('overview');
    const [activeChatSettings, setActiveChatSettings] = useState<ChatUserSettings | null>(null);
    const [archivedDirectChatIds, setArchivedDirectChatIds] = useState<string[]>([]);
    const [settingsNicknameInput, setSettingsNicknameInput] = useState('');
    const [directChatSettingsMap, setDirectChatSettingsMap] = useState<Record<string, ChatUserSettings>>({});
    const [groupChatSettingsMap, setGroupChatSettingsMap] = useState<Record<string, ChatUserSettings>>({});
    const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
    const [chatSearchQuery, setChatSearchQuery] = useState('');
    const [chatSearchResultIds, setChatSearchResultIds] = useState<number[]>([]);
    const [chatSearchIndex, setChatSearchIndex] = useState(0);
  const [openMessageDetailsFor, setOpenMessageDetailsFor] = useState<number | null>(null);
  const [callInfoModal, setCallInfoModal] = useState<null | { summary: CallEventSummary; attachments: ChatAttachment[] }>(null);
    const [chatContextMenu, setChatContextMenu] = useState<null | { x: number; y: number; kind: 'direct' | 'group'; chatId: string; otherUserId?: string }>(null);
    const [showAddMembersModal, setShowAddMembersModal] = useState(false);
    const [targetGroupIdForMembers, setTargetGroupIdForMembers] = useState<string | null>(null);
    const [addMembersSelection, setAddMembersSelection] = useState<string[]>([]);
    const [typingMembers, setTypingMembers] = useState<ChatTypingPresence[]>([]);
    const [typingMembersDisplay, setTypingMembersDisplay] = useState<ChatTypingPresence[]>([]);
    const [typingMembersVisible, setTypingMembersVisible] = useState(false);
  const [chatPopups, setChatPopups] = useState<ChatPopupNotification[]>([]);
  const [groupAvatarInput, setGroupAvatarInput] = useState('');
  const [callPhase, setCallPhase] = useState<CallPhase>('idle');
  const [callMode, setCallMode] = useState<CallMode>('audio');
  const [callPeerName, setCallPeerName] = useState('');
  const [callPeerAvatar, setCallPeerAvatar] = useState('U');
  const [callPeerAvatarIsImage, setCallPeerAvatarIsImage] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null);
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
  const [remotePrimaryView, setRemotePrimaryView] = useState<'screen' | 'camera'>('screen');
  const [remotePipPosition, setRemotePipPosition] = useState<{ x: number; y: number }>({ x: 78, y: 74 });
  const [remoteSpeakingLevel, setRemoteSpeakingLevel] = useState(0);
  const [localSpeakingLevel, setLocalSpeakingLevel] = useState(0);
  const [remoteMediaState, setRemoteMediaState] = useState<{ isScreenSharing: boolean; isCameraOn: boolean }>({ isScreenSharing: false, isCameraOn: true });
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCallFullscreen, setIsCallFullscreen] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [callConnectionLabel, setCallConnectionLabel] = useState('Idle');
  const [showCallChatPanel, setShowCallChatPanel] = useState(true);
  const [callChatInput, setCallChatInput] = useState('');
    const [callChatMessages, setCallChatMessages] = useState<Array<{ id: string; senderId: string; senderName: string; text: string; createdAt: number }>>([]);
    const [blockNowTs, setBlockNowTs] = useState(() => Date.now());
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isDrawToolsOpen, setIsDrawToolsOpen] = useState(false);
  const [drawColor, setDrawColor] = useState('#60a5fa');
  const [drawStrokes, setDrawStrokes] = useState<CallOverlayItem[]>([]);
  const [remoteCursorPoint, setRemoteCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptItems, setTranscriptItems] = useState<Array<{ id: string; senderId: string; senderName: string; text: string; createdAt: number }>>([]);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; text: string } | null>(null);
  const [callScreenshots, setCallScreenshots] = useState<Array<{ id: string; name: string; url: string; createdAt: number; file: File }>>([]);
  const [callRecordings, setCallRecordings] = useState<Array<{ id: string; name: string; url: string; createdAt: number; file: File }>>([]);
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [showCallInfoPanel, setShowCallInfoPanel] = useState(false);
  const [callUiToast, setCallUiToast] = useState<string | null>(null);
  const [isCaptureFlash, setIsCaptureFlash] = useState(false);



    // Team Chat Logic
    const [teamChats, setTeamChats] = useState<Record<string, ChatMessage[]>>(INITIAL_CHAT_DATA);
    const [activeTeamChatId, setActiveTeamChatId] = useState<string | null>(null);
    const [activeTeamTab, setActiveTeamTab] = useState<'chat' | 'files'>('chat');
    const [filesFilter, setFilesFilter] = useState<'all' | 'image' | 'gif' | 'video' | 'file'>('all');
    const [filesSort, setFilesSort] = useState<'newest' | 'oldest' | 'name'>('newest');
    const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());
    const [teamChatInput, setTeamChatInput] = useState(""); // Stores HTML for WYSIWYG

    // New States for enhanced features
    const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
    const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'gif' | 'video'; name: string } | null>(null);
    const [showAIPopup, setShowAIPopup] = useState(false); // Deprecated but kept for compatibility logic removal
    const [aiPopupInput, setAiPopupInput] = useState(""); // Deprecated
    const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<number | null>(null);
    const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
    const [showLinkComposer, setShowLinkComposer] = useState(false);
    const [linkTitleInput, setLinkTitleInput] = useState('');
    const [linkUrlInput, setLinkUrlInput] = useState('');
    const linkSelectionRangeRef = useRef<Range | null>(null);
    const [linkSelectedText, setLinkSelectedText] = useState('');
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [gifQuery, setGifQuery] = useState('');
    const [gifResults, setGifResults] = useState<GifResult[]>([]);
    const [isGifLoading, setIsGifLoading] = useState(false);
    const [activeFormats, setActiveFormats] = useState<string[]>([]);

    // Mention Logic
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);

    // Typing Indicator State
    const [typingUser, setTypingUser] = useState<{ name: string; avatar: string; isAi: boolean } | null>(null);

    // Private AI Mode State
    const [isPrivateAiMode, setIsPrivateAiMode] = useState(false);

    // Reply & Scroll State
    const [showScrollDownBtn, setShowScrollDownBtn] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    // Preview Modal State
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewHtml, setPreviewHtml] = useState("");
    const [previewTab, setPreviewTab] = useState<'live' | 'code'>('live');
    const teamChatsRef = useRef<Record<string, ChatMessage[]>>({});
    const blockOptimisticUntilRef = useRef<Record<number, number>>({});
    const previousBlockNowTsRef = useRef<number>(Date.now());
    const typingTimeoutRef = useRef<number | null>(null);
    const typingMembersHideTimerRef = useRef<number | null>(null);
    const chatRealtimeUnsubscribeRef = useRef<null | (() => void)>(null);
    const metaRealtimeUnsubscribeRef = useRef<null | (() => void)>(null);
    const chatRealtimeReloadTimerRef = useRef<number | null>(null);
    const metaRealtimeReloadTimerRef = useRef<number | null>(null);
  const popupRealtimeUnsubscribeRef = useRef<null | (() => void)>(null);
  const callRealtimeUnsubscribeRef = useRef<null | (() => void)>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const activeCallChatIdRef = useRef<string | null>(null);
  const callPeerUserIdRef = useRef<string | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localCallStreamRef = useRef<MediaStream | null>(null);
  const localCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const localMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenShareTrackRef = useRef<MediaStreamTrack | null>(null);
  const activeCallSessionIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const callBroadcastChannelRef = useRef<any>(null);
  const processedSignalIdsRef = useRef<Set<string>>(new Set());
  const processedOverlayIdsRef = useRef<Set<string>>(new Set());
  const incomingCallRef = useRef<IncomingCallState | null>(null);
  const callChatScrollRef = useRef<HTMLDivElement>(null);
  const callStageRef = useRef<HTMLDivElement>(null);
  const textDraftInputRef = useRef<HTMLInputElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const remoteCallPipVideoRef = useRef<HTMLVideoElement>(null);
  const drawStrokesRef = useRef<CallOverlayItem[]>([]);
  const remoteCompositeStreamRef = useRef<MediaStream | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);
  const cursorSendTsRef = useRef(0);
  const cursorFallbackTsRef = useRef(0);
  const remoteCursorHideTimerRef = useRef<number | null>(null);
  const outgoingRingIntervalRef = useRef<number | null>(null);
  const incomingRingIntervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const screenShareSenderRef = useRef<RTCRtpSender | null>(null);
  const cameraSenderRef = useRef<RTCRtpSender | null>(null);
  const localSpeakingRafRef = useRef<number | null>(null);
  const remoteSpeakingRafRef = useRef<number | null>(null);
  const localAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const pipDragStateRef = useRef<{ dragging: boolean; startX: number; startY: number; baseX: number; baseY: number; moved: boolean }>({ dragging: false, startX: 0, startY: 0, baseX: 78, baseY: 74, moved: false });
  const speechRecognitionRef = useRef<any>(null);
  const isTranscribingRef = useRef(false);

    // Selection Reply State
    const [quoteTooltip, setQuoteTooltip] = useState<{ x: number, y: number, text: string } | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const teamChatContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const justOpenedTeamChatRef = useRef(false);

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Project Connection State (Wrench)
    const [connectedProject, setConnectedProject] = useState<{ id: string; title: string; type: string; icon: string } | null>(null);
    const [showProjectSelector, setShowProjectSelector] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const projectSelectorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const currentViewRef = useRef<DashboardView>('home');
  const activeTeamChatIdRef = useRef<string | null>(null);
  const callPhaseRef = useRef<CallPhase>('idle');

    // Use Div ref for ContentEditable
    const editorRef = useRef<HTMLDivElement>(null);
  const teamFileRef = useRef<HTMLInputElement>(null);
  const groupAvatarFileRef = useRef<HTMLInputElement>(null);
  const groupAvatarRailFileRef = useRef<HTMLInputElement>(null);
  const localCallVideoRef = useRef<HTMLVideoElement>(null);
  const remoteCallVideoRef = useRef<HTMLVideoElement>(null);
  const remoteCallAudioRef = useRef<HTMLAudioElement>(null);

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState<ProjectDetails>({
        name: '',
        description: '',
        visibility: 'public',
        type: 'app'
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
    const selectedModelOption =
        OPENROUTER_FREE_MODELS.find(model => model.id === selectedModel) || OPENROUTER_FREE_MODELS[0];
    const legacyThreadsStorageKey = `${CHAT_THREADS_STORAGE_KEY}.${(userName || 'guest').toLowerCase().replace(/\s+/g, '-')}`;
    const threadOwnerKey = (currentUserId || currentUserEmail || (userName || 'guest')).toString().toLowerCase();
    const threadsStorageKey = `${CHAT_THREADS_STORAGE_KEY}.${threadOwnerKey}`;

    const getRelativeTime = (updatedAt: number) => {
        const diffMs = Date.now() - updatedAt;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours < 1) return 'just now';
        if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
        const diffMonths = Math.floor(diffDays / 30);
        return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    };

    const getProjectIcon = (type: string) => {
        switch (type) {
            case 'website': return 'language';
            case 'api': return 'hub';
            case 'script': return 'terminal';
            default: return 'deployed_code';
        }
    };

    const appProjects = projects
        .map(project => ({
            id: project.id,
            title: project.name,
            time: getRelativeTime(project.updatedAt),
            updatedAt: project.updatedAt,
            icon: getProjectIcon(project.type),
            type: project.type,
            visibility: project.visibility,
            status: project.status,
            color:
                project.visibility === 'public'
                    ? 'bg-blue-500/20 text-blue-400'
                    : project.visibility === 'team'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/10 text-white'
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);

    const visibleApps = appProjects;

    useEffect(() => {
        // Intro Animation Sequence
        const fadeTimer = setTimeout(() => setIntroFading(true), 2500);
        const removeTimer = setTimeout(() => setShowIntro(false), 3300);

        // Load notification preference
        const savedNotif = localStorage.getItem('notificationsEnabled');
        if (savedNotif !== null) {
            setNotificationsEnabled(savedNotif === 'true');
        }

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(threadsStorageKey);
            if (!raw && legacyThreadsStorageKey !== threadsStorageKey) {
                const legacyRaw = localStorage.getItem(legacyThreadsStorageKey);
                if (legacyRaw) {
                    localStorage.setItem(threadsStorageKey, legacyRaw);
                }
            }
            if (!localStorage.getItem(threadsStorageKey)) {
                const prefix = `${CHAT_THREADS_STORAGE_KEY}.`;
                let bestCandidate: string | null = null;
                let bestCount = -1;
                for (let i = 0; i < localStorage.length; i += 1) {
                    const key = localStorage.key(i) || '';
                    if (!key.startsWith(prefix) || key === threadsStorageKey) continue;
                    const value = localStorage.getItem(key);
                    if (!value) continue;
                    try {
                        const parsed = JSON.parse(value);
                        const count = Array.isArray(parsed) ? parsed.length : 0;
                        if (count > bestCount) {
                            bestCandidate = value;
                            bestCount = count;
                        }
                    } catch { }
                }
                if (bestCandidate) {
                    localStorage.setItem(threadsStorageKey, bestCandidate);
                }
            }
            const effectiveRaw = localStorage.getItem(threadsStorageKey);
            if (!effectiveRaw) {
                setThreads([]);
            } else {
                const parsed = JSON.parse(effectiveRaw) as ChatThread[];
                setThreads(Array.isArray(parsed) ? parsed : []);
            }
        } catch (error) {
            console.error('Failed to load chat threads:', error);
            setThreads([]);
        } finally {
            setThreadsReady(true);
        }
    }, [threadsStorageKey]);

    useEffect(() => {
        const hash = window.location.hash || '';
        if (!hash.includes(`${SHARED_THREAD_HASH_KEY}=`)) return;
        const raw = hash.split(`${SHARED_THREAD_HASH_KEY}=`)[1] || '';
        const encoded = decodeURIComponent(raw.split('&')[0] || '');
        const payload = decodeSharePayload(encoded);
        if (!payload) return;

        setCurrentView('ai-chat');
        setShowHistorySidebar(false);
        setIsTemporaryChat(true);
        setActiveThreadId(null);
        setChatHistory(payload.messages);
        setChatInput('');
    }, []);

    useEffect(() => {
        if (!threadsReady) return;
        localStorage.setItem(threadsStorageKey, JSON.stringify(threads));
    }, [threads, threadsReady, threadsStorageKey]);

    useEffect(() => {
        if (!currentUserId) return;
        void (async () => {
            try {
                const [groups, blocked, blockedBy, requests] = await Promise.all([
                    listGroupChats(),
                    listBlockedUsers(),
                    listUsersWhoBlockedMe(),
                    listIncomingChatRequests()
                ]);
                setGroupChats(groups);
                setBlockedUserIds(blocked);
                setBlockedByUserIds(blockedBy);
                setPendingChatRequests(requests);
            } catch (error) {
                console.error('Failed to load chat metadata:', error);
            }
        })();
    }, [currentUserId]);

    useEffect(() => {
        if (!currentUserId) return;
        const intervalId = window.setInterval(() => {
            void (async () => {
                try {
                    const [groups, blocked, blockedBy, requests] = await Promise.all([
                        listGroupChats(),
                        listBlockedUsers(),
                        listUsersWhoBlockedMe(),
                        listIncomingChatRequests()
                    ]);
                    setGroupChats(groups);
                    setBlockedUserIds(blocked);
                    setBlockedByUserIds(blockedBy);
                    setPendingChatRequests(requests);
                } catch (error) {
                    console.error('Failed to refresh chat metadata:', error);
                }
            })();
        }, 30000);
        return () => window.clearInterval(intervalId);
    }, [currentUserId]);

    useEffect(() => {
        if (!showGifPicker) return;
        const controller = new AbortController();
        const timeout = setTimeout(async () => {
            try {
                setIsGifLoading(true);
                const endpoint = gifQuery.trim()
                    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(gifQuery.trim())}&limit=24&rating=pg-13`
                    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=pg-13`;
                const res = await fetch(endpoint, { signal: controller.signal });
                if (!res.ok) throw new Error('GIF request failed');
                const data = await res.json();
                const mapped: GifResult[] = (data?.data || []).map((gif: any) => ({
                    id: gif.id,
                    title: gif.title || 'GIF',
                    previewUrl: gif?.images?.fixed_width_small?.url || gif?.images?.fixed_width?.url || '',
                    originalUrl: gif?.images?.original?.url || gif?.images?.downsized_large?.url || ''
                })).filter((gif: GifResult) => gif.previewUrl && gif.originalUrl);
                setGifResults(mapped);
            } catch (error: any) {
                if (error?.name !== 'AbortError') {
                    console.error('GIF fetch failed', error);
                    setGifResults([]);
                }
            } finally {
                setIsGifLoading(false);
            }
        }, 250);
        return () => {
            controller.abort();
            clearTimeout(timeout);
        };
    }, [showGifPicker, gifQuery]);

    useEffect(() => {
        teamChatsRef.current = teamChats;
    }, [teamChats]);

    useEffect(() => {
        blockOptimisticUntilRef.current = blockOptimisticUntilByMessage;
    }, [blockOptimisticUntilByMessage]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setBlockNowTs(Date.now());
        }, 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        // Auto-scroll logic for chat
        if (currentView === 'ai-chat' && !showScrollDownBtn) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, currentView, showScrollDownBtn]);

    useEffect(() => {
        if (currentView !== 'team' || activeTeamTab !== 'chat') return;
        if (!getExtraBool('autoScrollIncoming', true)) return;
        const container = teamChatContainerRef.current;
        if (!container) return;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom <= 120) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShowScrollDownBtn(false);
        } else {
            setShowScrollDownBtn(true);
        }
    }, [teamChats, typingUser, currentView, activeTeamTab, activeTeamChatId]);

    useEffect(() => {
        if (currentView !== 'team' || activeTeamTab !== 'chat' || !activeTeamChatId) return;
        justOpenedTeamChatRef.current = true;
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            setShowScrollDownBtn(false);
        });
    }, [currentView, activeTeamTab, activeTeamChatId]);

    useEffect(() => {
        if (currentView !== 'team' || activeTeamTab !== 'chat' || !activeTeamChatId) return;
        if (!justOpenedTeamChatRef.current) return;
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            setShowScrollDownBtn(false);
            justOpenedTeamChatRef.current = false;
        });
    }, [teamChats, currentView, activeTeamTab, activeTeamChatId]);

    // Handle Team View Switching
    useEffect(() => {
        if (currentView === 'team') {
            setShowTeamsSidebar(true);
            setShowHistorySidebar(false);
            if (!isSidebarOpen) setIsSidebarOpen(true);
        } else if (currentView === 'ai-chat') {
            setShowTeamsSidebar(false);
            setShowHistorySidebar(true);
            if (!isSidebarOpen) setIsSidebarOpen(true);
        } else {
            setShowTeamsSidebar(false);
            setShowHistorySidebar(false);
        }
    }, [currentView]);

    // Click outside dropdowns to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
            if (projectSelectorRef.current && !projectSelectorRef.current.contains(event.target as Node)) {
                setShowProjectSelector(false);
            }
            if (!(event.target as HTMLElement).closest('.project-menu')) {
                setOpenProjectMenuId(null);
            }
            if (!(event.target as HTMLElement).closest('.thread-menu')) {
                setOpenThreadMenuId(null);
            }
            if (!(event.target as HTMLElement).closest('.chat-settings-menu')) {
                setIsChatSettingsOpen(false);
            }
            if (!(event.target as HTMLElement).closest('.chat-context-menu')) {
                setChatContextMenu(null);
            }
            // Close emoji picker if clicking outside
            if (showEmojiPickerFor !== null && !(event.target as HTMLElement).closest('.emoji-picker-container')) {
                setShowEmojiPickerFor(null);
            }
            if (showInputEmojiPicker && !(event.target as HTMLElement).closest('.input-emoji-picker')) {
                setShowInputEmojiPicker(false);
            }
            if (showLinkComposer && !(event.target as HTMLElement).closest('.link-composer')) {
                setShowLinkComposer(false);
                setLinkTitleInput('');
                setLinkUrlInput('');
                setLinkSelectedText('');
                linkSelectionRangeRef.current = null;
            }
            if (showGifPicker && !(event.target as HTMLElement).closest('.gif-picker-container')) {
                setShowGifPicker(false);
            }
            if (showTeamPlusMenu && !(event.target as HTMLElement).closest('.team-plus-menu')) {
                setShowTeamPlusMenu(false);
            }
            // Close mention popup if clicking outside
            if (mentionQuery !== null && !(event.target as HTMLElement).closest('.mention-popup')) {
                setMentionQuery(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPickerFor, showInputEmojiPicker, showLinkComposer, showGifPicker, mentionQuery, showTeamPlusMenu]);

    // Text Selection Listener
    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || !chatContainerRef.current?.contains(selection.anchorNode)) {
                setQuoteTooltip(null);
                return;
            }
            const text = selection.toString().trim();
            if (text.length < 2) {
                setQuoteTooltip(null);
                return;
            }
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setQuoteTooltip({ x: rect.left + (rect.width / 2), y: rect.top - 45, text: text });
        };
        const handleMouseUp = () => setTimeout(handleSelection, 10);
        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, []);

    // Scroll Listener for "Back to bottom" button
    const handleChatScroll = () => {
        const container = currentView === 'team' ? teamChatContainerRef.current : chatContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        setShowScrollDownBtn(scrollHeight - scrollTop - clientHeight > 200);
    };

    const scrollToBottom = () => {
        if (currentView === 'team') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        else chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShowScrollDownBtn(false);
    };

    const scrollToMessage = (id: number) => {
        const el = document.getElementById(`message-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlight-message');
            setTimeout(() => el.classList.remove('highlight-message'), 2000);
        }
    };

    const handleReplyToSelection = () => {
        if (quoteTooltip) {
            setReplyingTo({ text: quoteTooltip.text });
            if (inputRef.current) {
                inputRef.current.focus();
            }
            setQuoteTooltip(null);
            window.getSelection()?.removeAllRanges();
        }
    };

    const handleRunCode = (code: string, language: string, fullMessageText?: string) => {
        const multiFileHtml = buildMultiFilePreviewHtml(fullMessageText);
        if (multiFileHtml) {
            setPreviewHtml(multiFileHtml);
            setPreviewTab('live');
            setShowPreviewModal(true);
            return;
        }
        const runnableCode = extractRunnableCode(code, language);
        let finalHtml = runnableCode;
        const lang = language.toLowerCase();
        if (['react', 'jsx', 'tsx'].includes(lang)) {
            finalHtml = wrapReactCode(runnableCode);
        } else if (lang === 'html' || looksLikeHtmlCode(runnableCode)) {
            const trimmed = runnableCode.trim();
            finalHtml = (/<!doctype html|<html/i.test(trimmed)) ? trimmed : wrapHtmlSnippet(trimmed);
        } else if (['javascript', 'js'].includes(lang)) {
            const looksLikeReact = /useState|useEffect|ReactDOM|<\w+[^>]*>|return\s*\(/.test(runnableCode);
            finalHtml = looksLikeReact ? wrapReactCode(runnableCode) : wrapVanillaJsCode(runnableCode);
        }
        setPreviewHtml(finalHtml);
        setPreviewTab('live');
        setShowPreviewModal(true);
    };

    const handleOpenCodeInEditor = (code: string, language: string) => {
        onOpenCodeInEditor({ code, language });
    };

    const handleMicClick = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (currentView === 'team') {
                if (editorRef.current) {
                    editorRef.current.innerText += ` ${transcript}`;
                    setTeamChatInput(editorRef.current.innerHTML);
                }
            } else {
                setChatInput(prev => (prev ? prev + ' ' + transcript : transcript));
            }
        };
        recognition.onerror = (event: any) => { console.error("Speech recognition error", event.error); setIsListening(false); };
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
        recognition.start();
    };

    const handleStart = async () => {
        if (prompt.trim()) {
            setIsGenerating(true);
            try {
                const generatedCode = await generateEnglishLogic(prompt, "", selectedModel);
                const content = `// Goal: ${prompt}\n\n${generatedCode}`;
                onCreateProject({ name: 'Untitled App', description: prompt, visibility: 'private', type: 'app', initialContent: content });
            } catch (e) {
                console.error("Failed to generate initial logic:", e);
                onCreateProject({ name: 'Untitled App', description: prompt, visibility: 'private', type: 'app' });
            } finally {
                setIsGenerating(false);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isGenerating) handleStart();
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreateProject(formData);
        setShowCreateModal(false);
        setFormData({ name: '', description: '', visibility: 'public', type: 'app' });
    };

    const handleCreateTeam = (e: React.FormEvent) => {
        e.preventDefault();
        const newTeam = {
            id: Date.now().toString(),
            name: teamFormData.name,
            members: 1,
            role: 'Owner',
            color: 'bg-gradient-to-br from-pink-500 to-rose-500',
            initials: teamFormData.name.substring(0, 2).toUpperCase()
        };
        setTeams([...teams, newTeam]);
        setShowCreateTeamModal(false);
        setTeamFormData({ name: '', description: '' });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) onFileUpload(e.target.files[0]);
    };

    const getToolDetails = (id: string) => {
        switch (id) {
            case 'ui': return { label: 'UI Design', icon: ImageIcon };
            case 'reasoning': return { label: 'Deep Reasoning', icon: Brain };
            case 'search': return { label: 'Web Search', icon: Globe };
            case 'packages': return { label: 'Package Search', icon: Package };
            case 'debug': return { label: 'Debug Code', icon: Bug };
            default: return { label: 'Tool', icon: Sparkles };
        }
    };

    // --- Team Chat Functions ---

    const getParticipants = () => {
        const list: Array<{ id: string; name: string; avatar: string; color: string; isAi: boolean; isAvatarImage: boolean }> = [];
        const pushUnique = (entry: { id: string; name: string; avatar: string; color: string; isAi: boolean; isAvatarImage: boolean }) => {
            const key = entry.name.trim().toLowerCase();
            if (!key) return;
            if (list.some(item => item.name.trim().toLowerCase() === key)) return;
            list.push(entry);
        };

        const selfName = userName || 'You';
        const selfAvatar = isHttpUrl(userAvatar) ? userAvatar : (userAvatar || selfName.slice(0, 2).toUpperCase());
        pushUnique({ id: 'me', name: selfName, avatar: selfAvatar, color: 'bg-indigo-600', isAi: false, isAvatarImage: isHttpUrl(selfAvatar) });

        if (activeTeamChatId?.startsWith('dm-')) {
            const dmId = activeTeamChatId.replace('dm-', '');
            const dm = directChats.find(entry => entry.chatId === dmId);
            if (dm) {
                pushUnique({
                    id: dm.otherUserId || dm.chatId,
                    name: dm.otherName,
                    avatar: dm.otherAvatar || dm.otherName.slice(0, 2).toUpperCase(),
                    color: 'bg-blue-600',
                    isAi: false,
                    isAvatarImage: isHttpUrl(dm.otherAvatar)
                });
            }
        }

        if (activeTeamChatId?.startsWith('gc-') || activeTeamChatId?.startsWith('team-')) {
            const msgs = teamChats[activeTeamChatId] || [];
            for (const msg of msgs) {
                if (!msg.user || msg.user === 'Natural AI') continue;
                pushUnique({
                    id: `msg-${msg.id}`,
                    name: msg.user,
                    avatar: msg.avatar || msg.user.slice(0, 2).toUpperCase(),
                    color: msg.color || 'bg-blue-600',
                    isAi: false,
                    isAvatarImage: Boolean(msg.isAvatarImage)
                });
            }
        }

        // Keep AI mention available for private AI mode.
        pushUnique({ id: 'ai', name: 'Natural AI', avatar: AI_LOGO_URL, color: 'bg-black', isAi: true, isAvatarImage: true });
        return list;
    };

    const messageMentionsCurrentUser = (text: string) => {
        const plain = stripHtmlTags(text || '').toLowerCase();
        const candidates = [
            userName || '',
            (userName || '').split(/\s+/)[0] || '',
            currentUserEmail ? currentUserEmail.split('@')[0] : ''
        ]
            .map(value => value.trim().toLowerCase())
            .filter(Boolean);
        return candidates.some(name => plain.includes(`@${name}`));
    };

    const messageMatchesAlertKeywords = (text: string) => {
        const configured = getExtraString('keywordAlerts', '');
        const keywords = configured.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
        if (!keywords.length) return false;
        const plain = stripHtmlTags(text || '').toLowerCase();
        return keywords.some(keyword => plain.includes(keyword));
    };

    const handleTeamFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
            const isImage = file.type.startsWith('image/') && !isGif;
            const isVideo = file.type.startsWith('video/');
            const attachment: ChatAttachment = {
                type: isGif ? 'gif' : isImage ? 'image' : isVideo ? 'video' : 'file',
                url: URL.createObjectURL(file),
                name: file.name,
                size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
                file
            };
            setChatAttachments(prev => [...prev, attachment]);
        }
    };

    const pushBlockState = (msgId: number, next: any, meta?: { saved?: boolean; expiresAt?: string | null }) => {
        setChatBlockStateByMessage(prev => ({
            ...prev,
            [msgId]: {
                state: next,
                __saved: meta?.saved ?? prev[msgId]?.__saved ?? false,
                __expiresAt: meta?.expiresAt ?? prev[msgId]?.__expiresAt ?? null
            }
        }));
    };

    const markBlockOptimistic = (msgId: number, ttlMs = 2200) => {
        const until = Date.now() + ttlMs;
        setBlockOptimisticUntilByMessage(prev => ({ ...prev, [msgId]: until }));
    };

    const resolveBlockScope = () => {
        if (!activeTeamChatId) return null;
        if (activeTeamChatId.startsWith('dm-')) return { chatKind: 'direct' as const, chatId: activeTeamChatId.replace('dm-', '') };
        if (activeTeamChatId.startsWith('gc-')) return { chatKind: 'group' as const, chatId: activeTeamChatId.replace('gc-', '') };
        return null;
    };

    const resolveBlockMeta = (msgId: number, block: ChatBlockPayload) => {
        const existing = chatBlockStateByMessage[msgId] || {};
        const expiresAt = existing.__expiresAt
            || (block.createdAt ? new Date(block.createdAt + CHAT_BLOCK_TTL_MS).toISOString() : new Date(Date.now() + CHAT_BLOCK_TTL_MS).toISOString());
        const saved = Boolean(existing.__saved);
        return { expiresAt, saved };
    };

    const persistChatBlockState = async (msg: ChatMessage, block: ChatBlockPayload, nextState: Record<string, any>, forceMeta?: { saved?: boolean; expiresAt?: string | null }) => {
        const scope = resolveBlockScope();
        if (!scope) {
            pushBlockState(msg.id, nextState, forceMeta);
            return;
        }
        const prevEnvelope = chatBlockStateByMessage[msg.id] || {};
        const nextSaved = forceMeta?.saved ?? Boolean(prevEnvelope.__saved);
        const nextExpiresAt = forceMeta?.expiresAt ?? prevEnvelope.__expiresAt ?? new Date(block.createdAt + CHAT_BLOCK_TTL_MS).toISOString();
        markBlockOptimistic(msg.id);
        pushBlockState(msg.id, nextState, { saved: nextSaved, expiresAt: nextExpiresAt });
        try {
            await upsertChatMessageBlockState({
                chatKind: scope.chatKind,
                chatId: scope.chatId,
                messageId: msg.id,
                blockKind: block.kind,
                state: nextState,
                expiresAt: nextExpiresAt,
                isSaved: nextSaved
            });
        } catch (error) {
            console.error('Failed to persist block state:', error);
        }
    };

    const toggleSavedChatBlockState = async (msg: ChatMessage, block: ChatBlockPayload) => {
        const scope = resolveBlockScope();
        const prevEnvelope = chatBlockStateByMessage[msg.id] || {};
        const currentState = prevEnvelope.state || {};
        const nextSaved = !Boolean(prevEnvelope.__saved);
        const nextExpiresAt = nextSaved ? null : (prevEnvelope.__expiresAt || new Date(block.createdAt + CHAT_BLOCK_TTL_MS).toISOString());
        markBlockOptimistic(msg.id);
        pushBlockState(msg.id, currentState, { saved: nextSaved, expiresAt: nextExpiresAt });
        if (!scope) return;
        try {
            await upsertChatMessageBlockState({
                chatKind: scope.chatKind,
                chatId: scope.chatId,
                messageId: msg.id,
                blockKind: block.kind,
                state: currentState,
                expiresAt: nextExpiresAt,
                isSaved: nextSaved
            });
        } catch (error) {
            console.error('Failed to toggle saved block state:', error);
        }
    };

    const sendTeamBlockMessage = async (block: ChatBlockPayload) => {
        if (!activeTeamChatId) return;
        if (isActiveDirectBlocked) {
            setChatSendError(isActiveDirectBlockedByOther
                ? 'You cannot send messages. This user has blocked you.'
                : 'You blocked this user. Unblock to send messages.');
            return;
        }
        setChatSendError(null);

        const text = serializeChatBlock(block);
        const outgoingAvatar = isHttpUrl(userAvatar) ? userAvatar : (userAvatar || (userName || "User").substring(0, 2).toUpperCase());
        const userMessage: ChatMessage = {
            id: Date.now(),
            user: userName || "User",
            avatar: outgoingAvatar,
            isAvatarImage: isHttpUrl(outgoingAvatar),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text,
            color: "bg-indigo-600",
            isMe: true,
            createdAt: new Date().toISOString()
        };

        setTeamChats(prev => ({
            ...prev,
            [activeTeamChatId]: [...(prev[activeTeamChatId] || []), userMessage]
        }));
        setShowTeamPlusMenu(false);

        const directChatId = getDirectChatIdFromActive();
        if (directChatId) {
            try {
                await sendDirectMessage(directChatId, text, []);
                await loadDirectMessagesForChat(directChatId);
                try {
                    const latest = (await listDirectMessages(directChatId))
                        .filter(entry => entry.senderId === currentUserId && entry.content === text)
                        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
                    if (latest?.id) {
                        await upsertChatMessageBlockState({
                            chatKind: 'direct',
                            chatId: directChatId,
                            messageId: latest.id,
                            blockKind: block.kind,
                            state: block.data || {},
                            expiresAt: new Date(block.createdAt + CHAT_BLOCK_TTL_MS).toISOString(),
                            isSaved: false
                        });
                        await loadDirectMessagesForChat(directChatId);
                    }
                } catch (stateError) {
                    console.error('Failed to seed direct block state:', stateError);
                }
            } catch (error: any) {
                alert(error?.message || 'Failed to send block.');
            }
            return;
        }

        if (activeTeamChatId.startsWith('gc-')) {
            const groupId = activeTeamChatId.replace('gc-', '');
            try {
                await sendGroupMessage(groupId, text);
                await loadGroupMessagesForChat(groupId);
                try {
                    const latest = (await listGroupMessages(groupId))
                        .filter(entry => entry.senderId === currentUserId && entry.content === text)
                        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
                    if (latest?.id) {
                        await upsertChatMessageBlockState({
                            chatKind: 'group',
                            chatId: groupId,
                            messageId: latest.id,
                            blockKind: block.kind,
                            state: block.data || {},
                            expiresAt: new Date(block.createdAt + CHAT_BLOCK_TTL_MS).toISOString(),
                            isSaved: false
                        });
                        await loadGroupMessagesForChat(groupId);
                    }
                } catch (stateError) {
                    console.error('Failed to seed group block state:', stateError);
                }
            } catch (error: any) {
                alert(error?.message || 'Failed to send block.');
            }
            return;
        }
    };

    const openBlockComposer = (kind: ChatBlockKind) => {
        const presetTitle: Record<ChatBlockKind, string> = {
            timer: 'Focus Sprint',
            poll: 'Quick Poll',
            checklist: 'Checklist',
            progress: 'Progress',
            decision: 'Decision',
            note: 'Team Note',
            link: 'Resource Link'
        };
        setShowTeamPlusMenu(false);
        setBlockComposer({
            kind,
            title: presetTitle[kind],
            optionsList: kind === 'decision' ? ['Option A', 'Option B', 'Option C'] : ['Option A', 'Option B'],
            checklistItems: ['Task 1', 'Task 2', 'Task 3'],
            body: 'Write your note for the team...',
            url: 'https://',
            durationMin: 15,
            durationSec: 0,
            progressCurrent: 35,
            progressMax: 100
        });
    };

    const submitBlockComposer = async () => {
        if (!blockComposer) return;
        const base = {
            kind: blockComposer.kind,
            createdAt: Date.now(),
            title: (blockComposer.title || 'Block').trim()
        } as ChatBlockPayload;
        if (blockComposer.kind === 'timer') {
            const minutes = Number(blockComposer.durationMin);
            const seconds = Number(blockComposer.durationSec);
            const durationSec = Math.max(0, (Number.isFinite(minutes) ? Math.floor(minutes) : 0) * 60 + (Number.isFinite(seconds) ? Math.floor(seconds) : 0));
            const safeDurationSec = durationSec > 0 ? durationSec : 900;
            await sendTeamBlockMessage({ ...base, data: { durationSec: safeDurationSec, endsAt: Date.now() + safeDurationSec * 1000 } });
            setBlockComposer(null);
            return;
        }
        if (blockComposer.kind === 'poll') {
            const options = blockComposer.optionsList.map(v => v.trim()).filter(Boolean).slice(0, 6);
            const safeOptions = options.length ? options : ['Option A', 'Option B'];
            await sendTeamBlockMessage({ ...base, data: { options: safeOptions, votes: safeOptions.map(() => 0) } });
            setBlockComposer(null);
            return;
        }
        if (blockComposer.kind === 'checklist') {
            const items = blockComposer.checklistItems.map(v => v.trim()).filter(Boolean).slice(0, 10).map(text => ({ text, done: false }));
            await sendTeamBlockMessage({ ...base, data: { items: items.length ? items : [{ text: 'Todo item', done: false }] } });
            setBlockComposer(null);
            return;
        }
        if (blockComposer.kind === 'progress') {
            const safeMax = Number.isFinite(blockComposer.progressMax) && blockComposer.progressMax > 0 ? blockComposer.progressMax : 100;
            const safeCurrent = Number.isFinite(blockComposer.progressCurrent) ? Math.max(0, Math.min(blockComposer.progressCurrent, safeMax)) : 0;
            await sendTeamBlockMessage({ ...base, data: { current: safeCurrent, max: safeMax } });
            setBlockComposer(null);
            return;
        }
        if (blockComposer.kind === 'decision') {
            const options = blockComposer.optionsList.map(v => v.trim()).filter(Boolean).slice(0, 5);
            await sendTeamBlockMessage({ ...base, data: { options: options.length ? options : ['Option A', 'Option B'], selected: null } });
            setBlockComposer(null);
            return;
        }
        if (blockComposer.kind === 'note') {
            await sendTeamBlockMessage({ ...base, data: { body: blockComposer.body || '' } });
            setBlockComposer(null);
            return;
        }
        if (blockComposer.kind === 'link') {
            const url = (blockComposer.url || '').trim();
            if (!url) return;
            await sendTeamBlockMessage({ ...base, data: { url } });
            setBlockComposer(null);
        }
    };

    const handleTeamSend = async () => {
        // For contentEditable, we take the HTML content
        const content = editorRef.current ? editorRef.current.innerHTML : teamChatInput;
        const cleanText = editorRef.current?.innerText.trim() || "";

        if ((!cleanText && chatAttachments.length === 0) || !activeTeamChatId) return;
        if (isActiveDirectBlocked) {
            setChatSendError(isActiveDirectBlockedByOther
                ? 'You cannot send messages. This user has blocked you.'
                : 'You blocked this user. Unblock to send messages.');
            return;
        }
        setChatSendError(null);

        const manuallyTagged = cleanText.includes('@Natural AI');
        const isPrivateToAI = isPrivateAiMode || manuallyTagged;

        if (isPrivateToAI && !isPrivateAiMode) {
            setIsPrivateAiMode(true);
        }

        const outgoingAvatar = isHttpUrl(userAvatar) ? userAvatar : (userAvatar || (userName || "User").substring(0, 2).toUpperCase());
        const userMessage: ChatMessage = {
            id: Date.now(),
            user: userName || "User",
            avatar: outgoingAvatar,
            isAvatarImage: isHttpUrl(outgoingAvatar),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: content, // Save HTML
            color: "bg-indigo-600",
            isMe: true,
            isPrivate: isPrivateToAI,
            replyToId: replyingToMessage?.id,
            attachments: chatAttachments.length > 0 ? [...chatAttachments] : undefined,
            createdAt: new Date().toISOString()
        };

        setTeamChats(prev => ({
            ...prev,
            [activeTeamChatId]: [...(prev[activeTeamChatId] || []), userMessage]
        }));

        // Clear Input
        if (editorRef.current) {
            editorRef.current.innerHTML = "";
        }
        setTeamChatInput("");
        if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
        void publishTypingState(false);
        if (activeTeamChatId) {
            setChatDrafts(prev => ({ ...prev, [activeTeamChatId]: '' }));
        }
        setReplyingToMessage(null);
        setChatAttachments([]);
        setShowGifPicker(false);
        setShowTeamPlusMenu(false);
        setGifQuery("");
        setShowLinkComposer(false);
        setLinkTitleInput('');
        setLinkUrlInput('');

        if (canPlayChatSounds) playMessageSentSound();

        const directChatId = getDirectChatIdFromActive();
        if (directChatId && !isPrivateToAI) {
            try {
                const dmAttachments: DirectMessageAttachment[] = chatAttachments.map(att => ({
                    type: att.type,
                    url: att.url,
                    name: att.name,
                    size: att.size,
                    file: att.file
                }));

                await sendDirectMessage(directChatId, content || '', dmAttachments);
                await loadDirectMessagesForChat(directChatId);
            } catch (error: any) {
                console.error('Failed to send direct message:', error);
                const raw = String(error?.message || '');
                if (/blocked|row-level security|permission/i.test(raw)) {
                    setChatSendError('Message not sent. This conversation is blocked.');
                } else {
                    alert(error?.message || 'Failed to send message.');
                }
            }
            return;
        }

        if (activeTeamChatId.startsWith('gc-') && !isPrivateToAI) {
            const groupId = activeTeamChatId.replace('gc-', '');
            try {
                await sendGroupMessage(groupId, content || '');
                await loadGroupMessagesForChat(groupId);
            } catch (error: any) {
                console.error('Failed to send group message:', error);
                alert(error?.message || 'Failed to send message.');
            }
            return;
        }

        // Check for AI Mention
        if (isPrivateToAI) {
            const userQuery = cleanText.replace('@Natural AI', '').trim();

            setTypingUser({ name: 'Natural AI', avatar: AI_LOGO_URL, isAi: true });

            try {
                const response = await sendChatMessage([], `Context: You are a helpful AI assistant in a team chat channel. You are being privately messaged by the user. The user asked: ${userQuery}`, selectedModel);

                const aiMessage: ChatMessage = {
                    id: Date.now() + 1,
                    user: "Natural AI",
                    avatar: AI_LOGO_URL,
                    isAvatarImage: true,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    text: response,
                    color: "bg-transparent",
                    isMe: false,
                    isPrivate: true
                };

                setTeamChats(prev => ({
                    ...prev,
                    [activeTeamChatId]: [...(prev[activeTeamChatId] || []), aiMessage]
                }));

                if (canPlayChatSounds) playNotificationSound();
            } catch (e) {
                console.error("Team Chat AI Error", e);
                const errText = e instanceof Error ? e.message : String(e || 'AI request failed.');
                const aiErrorMsg: ChatMessage = {
                    id: Date.now() + 2,
                    user: "Natural AI",
                    avatar: AI_LOGO_URL,
                    isAvatarImage: true,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    text: `I couldn't respond right now.\n\n${errText}`,
                    color: "bg-transparent",
                    isMe: false,
                    isPrivate: true
                };
                setTeamChats(prev => ({
                    ...prev,
                    [activeTeamChatId]: [...(prev[activeTeamChatId] || []), aiErrorMsg]
                }));
            } finally {
                setTypingUser(null);
            }
        }
    };

    const handleEditMessage = async (msgId: number, newText: string) => {
        if (!activeTeamChatId) return;
        const directChatId = getDirectChatIdFromActive();
        if (directChatId) {
            try {
                await editDirectMessage(msgId, newText);
                await loadDirectMessagesForChat(directChatId);
            } catch (error: any) {
                alert(error?.message || 'Failed to edit message.');
            } finally {
                setEditingMessageId(null);
            }
            return;
        }
        if (activeTeamChatId.startsWith('gc-')) {
            const groupId = activeTeamChatId.replace('gc-', '');
            try {
                await editGroupMessage(msgId, newText);
                await loadGroupMessagesForChat(groupId);
            } catch (error: any) {
                alert(error?.message || 'Failed to edit message.');
            } finally {
                setEditingMessageId(null);
            }
            return;
        }

        setTeamChats(prev => ({
            ...prev,
            [activeTeamChatId]: prev[activeTeamChatId].map(msg =>
                msg.id === msgId ? { ...msg, text: newText, isEdited: true } : msg
            )
        }));
        setEditingMessageId(null);
    };

    const openDeleteMessageConfirm = (msg: ChatMessage) => {
        if (!activeTeamChatId) return;
        if (!getExtraBool('confirmDelete', true)) {
            void performDeleteMessage({ msg, chatId: activeTeamChatId });
            return;
        }
        setPendingDeleteMessage({ msg, chatId: activeTeamChatId });
    };

    const performDeleteMessage = async (payload: { msg: ChatMessage; chatId: string }) => {
        const { msg, chatId } = payload;
        const directChatId = chatId.startsWith('dm-') ? chatId.replace('dm-', '') : null;
        const rollback = () => {
            setTeamChats(prev => {
                const existing = prev[chatId] || [];
                if (existing.some(entry => entry.id === msg.id)) return prev;
                return {
                    ...prev,
                    [chatId]: [...existing, msg].sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b))
                };
            });
        };

        if (directChatId) {
            if (msg.isMe) {
                setTeamChats(prev => ({
                    ...prev,
                    [chatId]: (prev[chatId] || []).filter(entry => entry.id !== msg.id)
                }));
                try {
                    await deleteDirectMessage(msg.id);
                } catch (error) {
                    rollback();
                    throw error;
                }
            } else {
                hideMessageForCurrentUser(chatId, msg.id);
            }
        } else if (chatId.startsWith('gc-')) {
            if (msg.isMe) {
                setTeamChats(prev => ({
                    ...prev,
                    [chatId]: (prev[chatId] || []).filter(entry => entry.id !== msg.id)
                }));
                try {
                    await deleteGroupMessage(msg.id);
                } catch (error) {
                    rollback();
                    throw error;
                }
            } else {
                hideMessageForCurrentUser(chatId, msg.id);
            }
        } else if (msg.isMe) {
            setTeamChats(prev => ({
                ...prev,
                [chatId]: (prev[chatId] || []).filter(entry => entry.id !== msg.id)
            }));
        } else {
            hideMessageForCurrentUser(chatId, msg.id);
        }
    };

    const hideMessageForCurrentUser = (chatId: string, msgId: number) => {
        if (chatId.startsWith('dm-') || chatId.startsWith('gc-')) {
            const kind = chatId.startsWith('dm-') ? 'direct' : 'group';
            const storageChatId = chatId.replace(/^dm-|^gc-/, '');
            void hideMessageForMe(kind, storageChatId, msgId).catch((error) => {
                console.error('Failed to hide message on server:', error);
            });
        }
        setHiddenMessagesByChat(prev => {
            const current = new Set(prev[chatId] || []);
            current.add(msgId);
            return { ...prev, [chatId]: Array.from(current) };
        });
    };

    const handleConfirmDeleteMessage = async () => {
        const payload = pendingDeleteMessage;
        if (!payload) return;

        try {
            await performDeleteMessage(payload);
        } catch (error: any) {
            alert(error?.message || 'Failed to delete message.');
        } finally {
            setPendingDeleteMessage(null);
        }
    };

    // Rich Text Command Executor
    const execFormat = (command: string, value: string | undefined = undefined) => {
        // We rely on standard browser commands for contentEditable
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
            setTeamChatInput(editorRef.current.innerHTML);
            checkFormats();
        }
    };

    const checkFormats = () => {
        if (!document) return;
        const formats: string[] = [];
        if (document.queryCommandState('bold')) formats.push('bold');
        if (document.queryCommandState('italic')) formats.push('italic');
        if (document.queryCommandState('underline')) formats.push('underline');
        if (document.queryCommandState('strikethrough')) formats.push('strikeThrough');
        if (document.queryCommandState('insertUnorderedList')) formats.push('insertUnorderedList');
        setActiveFormats(formats);
    };

    const insertMention = (name: string) => {
        if (!editorRef.current) return;

        if (name === 'Natural AI') {
            // Remove the @query part so input is clean for the private chat
            // Simple strategy: we assume the user just typed @Natural or part of it at the end.
            // Since we can't easily undo the last few chars cleanly without range magic in pure react state context,
            // we will rely on deleting the 'mentionQuery' characters + 1 for '@'.
            const queryLen = mentionQuery ? mentionQuery.length : 0;
            for (let i = 0; i <= queryLen; i++) {
                document.execCommand('delete', false);
            }
            setIsPrivateAiMode(true);
            setMentionQuery(null);
            setMentionIndex(0);
            return;
        }

        const text = editorRef.current.innerText;
        // Replace the last @... with @Name
        const lastAt = text.lastIndexOf('@');
        if (lastAt !== -1) {
            // Strategy: Delete 'mentionQuery' length + 1 (for @), then insert HTML span
            const queryLen = mentionQuery ? mentionQuery.length : 0;
            for (let i = 0; i <= queryLen; i++) {
                document.execCommand('delete', false);
            }

            const html = `<span class="text-blue-400 font-bold" contenteditable="false">@${name}</span>&nbsp;`;
            document.execCommand('insertHTML', false, html);

            setMentionQuery(null);
            setMentionIndex(0);
        }
    };

    const handleInsertLink = () => {
        const nextOpen = !showLinkComposer;
        if (!nextOpen) {
            setShowLinkComposer(false);
            setLinkSelectedText('');
            linkSelectionRangeRef.current = null;
            return;
        }

        let selectedText = '';
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorRef.current) {
            const range = selection.getRangeAt(0);
            if (editorRef.current.contains(range.commonAncestorContainer)) {
                linkSelectionRangeRef.current = range.cloneRange();
                selectedText = selection.toString().trim();
            } else {
                linkSelectionRangeRef.current = null;
            }
        } else {
            linkSelectionRangeRef.current = null;
        }

        setLinkSelectedText(selectedText);
        setLinkTitleInput(selectedText);
        setShowLinkComposer(true);
        setTimeout(() => {
            const targetId = selectedText ? 'link-url-input' : 'link-title-input';
            const el = document.getElementById(targetId) as HTMLInputElement | null;
            el?.focus();
        }, 10);
    };

    const handleLinkInsertSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        let url = linkUrlInput.trim();
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }
        if (!editorRef.current) return;
        editorRef.current.focus();

        const selection = window.getSelection();
        if (selection) {
            if (linkSelectionRangeRef.current) {
                selection.removeAllRanges();
                selection.addRange(linkSelectionRangeRef.current);
            } else if (selection.rangeCount === 0) {
                const fallbackRange = document.createRange();
                fallbackRange.selectNodeContents(editorRef.current);
                fallbackRange.collapse(false);
                selection.addRange(fallbackRange);
            }

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = selection.toString().trim();
                const linkText = linkTitleInput.trim() || selectedText || url;
                const linkNode = document.createElement('a');
                linkNode.href = url;
                linkNode.target = '_blank';
                linkNode.rel = 'noopener noreferrer';
                linkNode.textContent = linkText;

                range.deleteContents();
                range.insertNode(linkNode);

                const spacer = document.createTextNode('\u00A0');
                linkNode.parentNode?.insertBefore(spacer, linkNode.nextSibling);

                const nextRange = document.createRange();
                nextRange.setStartAfter(spacer);
                nextRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(nextRange);
            }
        }

        setTeamChatInput(editorRef.current.innerHTML);
        setLinkTitleInput('');
        setLinkUrlInput('');
        setLinkSelectedText('');
        linkSelectionRangeRef.current = null;
        setShowLinkComposer(false);
    };

    const handleEditorKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            handleInsertLink();
            return;
        }

        // Mention Navigation
        if (mentionQuery !== null) {
            const participants = getParticipants().filter(p => p.name.toLowerCase().includes(mentionQuery!.toLowerCase()));
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % participants.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + participants.length) % participants.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (participants[mentionIndex]) {
                    insertMention(participants[mentionIndex].name);
                }
                return;
            }
            if (e.key === 'Escape') {
                setMentionQuery(null);
                return;
            }
        }

        // 1. Shift+Enter Handling:
        if (e.key === 'Enter' && e.shiftKey) {
            if (document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList')) {
                e.preventDefault();
                document.execCommand('insertParagraph');
            }
            return;
        }

        // 2. Enter (No Shift) -> Send Message
        if (e.key === 'Enter' && !e.shiftKey) {
            const allowEnterToSend = activeChatSettings?.enterToSend ?? true;
            if (allowEnterToSend) {
                e.preventDefault();
                handleTeamSend();
            } else {
                document.execCommand('insertLineBreak');
            }
            return;
        }

        // 3. Tab Handling for List Nesting
        if (e.key === 'Tab') {
            const cleanText = editorRef.current?.innerText.replace(/\u00A0/g, ' ').trim() || '';
            if (!cleanText && !isPrivateAiMode) {
                e.preventDefault();
                setIsPrivateAiMode(true);
                setMentionQuery(null);
                setMentionIndex(0);
                return;
            }

            e.preventDefault();
            // Check if we are inside a list to handle indentation
            if (document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList')) {
                if (e.shiftKey) {
                    document.execCommand('outdent');
                } else {
                    document.execCommand('indent');
                }
            } else {
                // Not in list? Tab inserts spaces
                document.execCommand('insertText', false, '    ');
            }
        }
    };

    const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        setTeamChatInput(target.innerHTML);
        if (activeTeamChatId) {
            setChatDrafts(prev => ({ ...prev, [activeTeamChatId]: target.innerHTML }));
        }
        const clean = target.innerText.replace(/\u00A0/g, ' ').trim();
        if (clean) {
            void publishTypingState(true);
            if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = window.setTimeout(() => {
                void publishTypingState(false);
            }, 3500);
        } else {
            if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
            void publishTypingState(false);
        }
        checkFormats();

        // Mention Detection
        // Get text up to cursor
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // Only trigger if we are in a text node
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                const text = range.startContainer.textContent || "";
                const textBeforeCursor = text.substring(0, range.startOffset);
                const words = textBeforeCursor.split(/\s/);
                const lastWord = words[words.length - 1];

                if (lastWord.startsWith('@')) {
                    setMentionQuery(lastWord.substring(1));
                    setMentionIndex(0);
                } else {
                    setMentionQuery(null);
                }
            } else {
                setMentionQuery(null);
            }
        }

        // Auto-list detection for "* "
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                const text = node.textContent;
                // Detect if user typed "* " at start of a line/block
                if (text.endsWith('* ') && text.trim() === '* ') {
                    // If the line is JUST "* ", convert to list
                    if (target.innerText.trim() === '* ') {
                        // Clear the "* " text then convert block to list
                        node.textContent = '';
                        document.execCommand('insertUnorderedList');
                    }
                }
            }
        }
    };

    const handleReaction = async (msgId: number, emoji: string) => {
        if (!activeTeamChatId) return;
        const applyOptimistic = () => {
            setTeamChats(prev => {
                const messages = prev[activeTeamChatId] || [];
                return {
                    ...prev,
                    [activeTeamChatId]: messages.map(msg => {
                        if (msg.id !== msgId) return msg;
                        const existingReaction = msg.reactions?.find(r => r.emoji === emoji);
                        let newReactions = msg.reactions || [];

                        if (existingReaction) {
                            if (existingReaction.active) {
                                newReactions = newReactions
                                    .map(r => r.emoji === emoji ? { ...r, count: r.count - 1, active: false } : r)
                                    .filter(r => r.count > 0);
                            } else {
                                newReactions = newReactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, active: true } : r);
                            }
                        } else {
                            newReactions = [...newReactions, { emoji, count: 1, active: true }];
                        }
                        return { ...msg, reactions: newReactions };
                    })
                };
            });
        };

        const directChatId = getDirectChatIdFromActive();
        if (directChatId) {
            applyOptimistic();
            try {
                await toggleDirectMessageReaction(msgId, emoji);
            } catch (error: any) {
                await loadDirectMessagesForChat(directChatId);
                alert(error?.message || 'Failed to update reaction.');
            }
            setShowEmojiPickerFor(null);
            return;
        }

        if (activeTeamChatId.startsWith('gc-')) {
            const groupId = activeTeamChatId.replace('gc-', '');
            applyOptimistic();
            try {
                await toggleGroupMessageReaction(msgId, emoji);
            } catch (error: any) {
                await loadGroupMessagesForChat(groupId);
                alert(error?.message || 'Failed to update reaction.');
            }
            setShowEmojiPickerFor(null);
            return;
        }

        applyOptimistic();
        setShowEmojiPickerFor(null);
    };

    const handleToggleStarMessage = async (msgId: number) => {
        if (!activeTeamChatId) return;
        const isDirect = activeTeamChatId.startsWith('dm-');
        const isGroup = activeTeamChatId.startsWith('gc-');
        if (!isDirect && !isGroup) return;

        const chatKind = isDirect ? 'direct' as const : 'group' as const;
        const chatId = activeTeamChatId.replace(/^dm-|^gc-/, '');
        const msgKey = String(msgId);
        const current = new Set(starredMessagesByChat[activeTeamChatId] || []);
        const wasStarred = current.has(msgKey);
        if (wasStarred) current.delete(msgKey);
        else current.add(msgKey);
        setStarredMessagesByChat(prev => ({ ...prev, [activeTeamChatId]: Array.from(current) }));

        try {
            const nowStarred = await toggleStarredMessage(chatKind, chatId, msgId);
            setStarredMessagesByChat(prev => {
                const next = new Set(prev[activeTeamChatId] || []);
                if (nowStarred) next.add(msgKey);
                else next.delete(msgKey);
                return { ...prev, [activeTeamChatId]: Array.from(next) };
            });
        } catch (error: any) {
            setStarredMessagesByChat(prev => {
                const rollback = new Set(prev[activeTeamChatId] || []);
                if (wasStarred) rollback.add(msgKey);
                else rollback.delete(msgKey);
                return { ...prev, [activeTeamChatId]: Array.from(rollback) };
            });
            alert(error?.message || 'Failed to update star.');
        }
    };

    const handleMessageReply = (msg: ChatMessage) => {
        setReplyingToMessage(msg);
        if (editorRef.current) {
            editorRef.current.focus();
        }
    };

    const insertEmoji = (emoji: string) => {
        document.execCommand('insertText', false, emoji);
        setShowInputEmojiPicker(false);
        if (editorRef.current) editorRef.current.focus();
    };

    const handleGifSelect = (gif: GifResult) => {
        const attachment: ChatAttachment = {
            type: 'gif',
            url: gif.originalUrl,
            name: `${(gif.title || 'GIF').replace(/\s+/g, '-').toLowerCase()}.gif`
        };
        setChatAttachments(prev => [...prev, attachment]);
        setShowGifPicker(false);
    };

    const readAttachmentText = async (att: ChatAttachment) => {
        if (att.file) {
            return await att.file.text();
        }
        const res = await fetch(att.url);
        if (!res.ok) throw new Error('Could not load file content.');
        return await res.text();
    };

    const handleOpenAttachmentCode = async (att: ChatAttachment) => {
        const language = getCodeLanguageFromName(att.name) || 'text';
        try {
            const code = await readAttachmentText(att);
            handleOpenCodeInEditor(code, language);
        } catch (error: any) {
            alert(error?.message || 'Failed to open code file.');
        }
    };

    const handleCopyAttachmentCode = async (att: ChatAttachment) => {
        try {
            const code = await readAttachmentText(att);
            await navigator.clipboard.writeText(code);
        } catch (error: any) {
            alert(error?.message || 'Failed to copy code file.');
        }
    };

    const openMediaPreview = (asset: { url: string; type: 'image' | 'gif' | 'video'; name: string }) => {
        setMediaPreview(asset);
    };

    const handleMessageShare = (text: string) => {
        // Strip HTML tags for clipboard copy
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = text;
        const plainText = tempDiv.textContent || tempDiv.innerText || "";
        navigator.clipboard.writeText(plainText);
    };

    const getReplyPreviewText = (msg: ChatMessage) => {
        const parts = [];
        const block = parseChatBlock(msg.text);
        if (block) {
            return `${block.kind[0].toUpperCase()}${block.kind.slice(1)} block: ${block.title}`;
        }
        const callEvent = parseCallEventSummary(msg.text);
        if (callEvent) {
            return `Call ended (${formatCallDuration(callEvent.durationSec)})`;
        }

        // Strip HTML for text preview
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = msg.text;
        const textContent = tempDiv.textContent || tempDiv.innerText || "";

        if (textContent.trim()) {
            parts.push(textContent);
        } else if (msg.attachments && msg.attachments.length > 0) {
            // If no text but has attachments, label it
            const firstType = msg.attachments[0].type;
            parts.push(firstType === 'image' ? 'Image' : 'File');
        } else {
            parts.push("Message");
        }

        return parts.join(' ');
    };

    const getReplySnippetFromMessage = (text: string) => {
        const withoutCodeBlocks = text.replace(/```[\s\S]*?```/g, '').trim();
        const withoutHtml = withoutCodeBlocks.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!withoutHtml) return 'Selected message';
        return withoutHtml.length > 120 ? `${withoutHtml.slice(0, 120)}...` : withoutHtml;
    };

    const renderChatBlock = (msg: ChatMessage, block: ChatBlockPayload) => {
        const envelope = chatBlockStateByMessage[msg.id] || {};
        const state = envelope.state || {};
        const { expiresAt, saved } = resolveBlockMeta(msg.id, block);
        const isExpired = !saved && Boolean(expiresAt) && Date.parse(String(expiresAt)) <= blockNowTs;
        if (isExpired) return null;
        const meta = BLOCK_META[block.kind];
        const shell = `rounded-2xl border border-[#2b3345] bg-[linear-gradient(165deg,#0f1522_5%,#0b1019_60%,#090d14_100%)] p-3.5 shadow-[0_16px_36px_rgba(0,0,0,0.35)]`;
        const header = (
            <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[#7f93b5]">Interactive Block</div>
                    <div className="text-sm font-semibold text-white truncate">{block.title}</div>
                    <div className="text-[11px] text-[#8fa0bb] mt-0.5 flex items-center gap-2">
                        <span>{meta.hint}</span>
                        {!saved && expiresAt && (
                            <span className="text-[10px] text-[#9fb0c7]">Expires {new Date(expiresAt).toLocaleDateString()}</span>
                        )}
                        {saved && <span className="text-[10px] text-emerald-300">Saved</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => void toggleSavedChatBlockState(msg, block)}
                        className={`px-2.5 py-1 text-[10px] rounded-lg border transition-colors ${saved ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20' : 'border-[#2f3d56] bg-[#1b2435] text-[#cbd5e1] hover:bg-[#273244]'}`}
                    >
                        {saved ? 'Unsave' : 'Save'}
                    </button>
                    <div className={`h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-gradient-to-br ${meta.glow} flex items-center justify-center text-base`}>
                        {meta.icon}
                    </div>
                </div>
            </div>
        );

        if (block.kind === 'timer') {
            const endsAt = Number(state.endsAt ?? block.data.endsAt ?? (block.createdAt + Number(block.data.durationSec || 900) * 1000));
            const remaining = Math.max(0, endsAt - blockNowTs);
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            return (
                <div className={`${shell} block-card-enter`}>
                    {header}
                    <div className={`text-[11px] uppercase tracking-wider ${meta.tint}`}>{meta.label}</div>
                    <div className="text-3xl font-bold text-[#d8e4ff] mt-2 tabular-nums">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</div>
                    <div className="mt-3 flex gap-2">
                        <button onClick={() => void persistChatBlockState(msg, block, { ...state, endsAt: Date.now() + 5 * 60 * 1000 }, { saved, expiresAt })} className="px-2.5 py-1.5 text-[11px] rounded-lg bg-[#1b2435] border border-[#2f3d56] text-[#d1d5db] hover:bg-[#273244] transition-colors">+5m</button>
                        <button onClick={() => void persistChatBlockState(msg, block, { ...state, endsAt: Date.now() + 15 * 60 * 1000 }, { saved, expiresAt })} className="px-2.5 py-1.5 text-[11px] rounded-lg bg-[#1b2435] border border-[#2f3d56] text-[#d1d5db] hover:bg-[#273244] transition-colors">+15m</button>
                        <button onClick={() => void persistChatBlockState(msg, block, { ...state, endsAt: Date.now() }, { saved, expiresAt })} className="px-2.5 py-1.5 text-[11px] rounded-lg bg-red-500/12 border border-red-400/25 text-red-200 hover:bg-red-500/20 transition-colors">Stop</button>
                    </div>
                </div>
            );
        }
        if (block.kind === 'poll') {
            const options: string[] = Array.isArray(block.data.options) ? block.data.options : [];
            const votes: number[] = (state.votes || block.data.votes || options.map(() => 0)).map((v: any) => Number(v) || 0);
            const votedBy = (state.votedBy && typeof state.votedBy === 'object') ? state.votedBy as Record<string, number> : {};
            const myVote = currentUserId && Number.isInteger(votedBy[currentUserId]) ? Number(votedBy[currentUserId]) : null;
            const total = votes.reduce((sum, value) => sum + value, 0);
            return (
                <div className={`${shell} block-card-enter`}>
                    {header}
                    <div className={`text-[11px] uppercase tracking-wider ${meta.tint}`}>{meta.label}</div>
                    <div className="mt-2 space-y-2">
                        {options.map((option, idx) => {
                            const pct = total > 0 ? Math.round((votes[idx] / total) * 100) : 0;
                            return (
                                <button
                                    key={`${msg.id}-poll-${idx}`}
                                    onClick={() => {
                                        const nextVotes = [...votes];
                                        const nextVotedBy: Record<string, number> = { ...votedBy };
                                        let nextMyVote: number | null = myVote;
                                        if (myVote === idx) {
                                            nextVotes[idx] = Math.max(0, nextVotes[idx] - 1);
                                            nextMyVote = null;
                                            if (currentUserId) delete nextVotedBy[currentUserId];
                                        } else {
                                            if (myVote !== null && myVote >= 0 && myVote < nextVotes.length) nextVotes[myVote] = Math.max(0, nextVotes[myVote] - 1);
                                            nextVotes[idx] += 1;
                                            nextMyVote = idx;
                                            if (currentUserId) nextVotedBy[currentUserId] = idx;
                                        }
                                        void persistChatBlockState(msg, block, { ...state, votes: nextVotes, votedBy: nextVotedBy, myVote: nextMyVote }, { saved, expiresAt });
                                    }}
                                    className={`w-full text-left rounded-xl border px-2.5 py-2 transition-all duration-200 ${myVote === idx ? 'border-blue-400/50 bg-blue-500/15 shadow-[0_0_0_1px_rgba(96,165,250,0.2)]' : 'border-[#2b3035] bg-[#151a22] hover:bg-[#1a2130]'}`}
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[#e5e7eb]">{option}</span>
                                        <span className="text-[#8ea2c7]">{votes[idx]} • {pct}%</span>
                                    </div>
                                    <div className="mt-1 h-1.5 w-full bg-[#1f2937] rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-400/70 transition-all duration-300" style={{ width: `${pct}%` }} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }
        if (block.kind === 'checklist') {
            const items = (state.items || block.data.items || []) as Array<{ text: string; done: boolean }>;
            return (
                <div className={`${shell} block-card-enter`}>
                    {header}
                    <div className={`text-[11px] uppercase tracking-wider ${meta.tint}`}>{meta.label}</div>
                    <div className="mt-2 space-y-1.5">
                        {items.map((item, idx) => (
                            <button
                                key={`${msg.id}-check-${idx}`}
                                onClick={() => {
                                    const next = items.map((entry, itemIdx) => itemIdx === idx ? { ...entry, done: !entry.done } : entry);
                                    void persistChatBlockState(msg, block, { ...state, items: next }, { saved, expiresAt });
                                }}
                                className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#151a22] border border-[#273143] hover:bg-[#1a2130] transition-colors"
                            >
                                <span className={`w-4 h-4 rounded border flex items-center justify-center ${item.done ? 'bg-green-500/20 border-green-400/50' : 'border-[#3a4150]'}`}>
                                    {item.done && <Check className="w-3 h-3 text-green-300" />}
                                </span>
                                <span className={`text-sm ${item.done ? 'text-[#8d96a0] line-through' : 'text-[#e5e7eb]'}`}>{item.text}</span>
                            </button>
                        ))}
                    </div>
                </div>
            );
        }
        if (block.kind === 'progress') {
            const max = Number(block.data.max || 100);
            const current = Number(state.current ?? block.data.current ?? 0);
            const pct = Math.max(0, Math.min(100, Math.round((current / Math.max(1, max)) * 100)));
            return (
                <div className={`${shell} block-card-enter`}>
                    {header}
                    <div className={`text-[11px] uppercase tracking-wider ${meta.tint}`}>{meta.label}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-[#9aa3ad]">
                        <span>{current} / {max}</span>
                        <span>{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full bg-[#1f2937] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400/80 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button onClick={() => void persistChatBlockState(msg, block, { ...state, current: Math.max(0, current - 5) }, { saved, expiresAt })} className="px-2.5 py-1.5 text-[11px] rounded-lg bg-[#1b2435] border border-[#2f3d56] text-[#d1d5db] hover:bg-[#273244] transition-colors">-5</button>
                        <button onClick={() => void persistChatBlockState(msg, block, { ...state, current: Math.min(max, current + 5) }, { saved, expiresAt })} className="px-2.5 py-1.5 text-[11px] rounded-lg bg-[#1b2435] border border-[#2f3d56] text-[#d1d5db] hover:bg-[#273244] transition-colors">+5</button>
                    </div>
                </div>
            );
        }
        if (block.kind === 'decision') {
            const options: string[] = Array.isArray(block.data.options) ? block.data.options : [];
            const selected = Number.isInteger(state.selected) ? state.selected : Number.isInteger(block.data.selected) ? block.data.selected : null;
            return (
                <div className={`${shell} block-card-enter`}>
                    {header}
                    <div className={`text-[11px] uppercase tracking-wider ${meta.tint}`}>{meta.label}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {options.map((option, idx) => (
                            <button
                                key={`${msg.id}-decision-${idx}`}
                                onClick={() => void persistChatBlockState(msg, block, { ...state, selected: idx }, { saved, expiresAt })}
                                className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all duration-200 ${selected === idx ? 'bg-purple-500/20 border-purple-400/50 text-purple-200 shadow-[0_0_0_1px_rgba(167,139,250,0.25)]' : 'bg-[#151a22] border-[#2b3035] text-[#d1d5db] hover:bg-[#1a2130]'}`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }
        if (block.kind === 'note') {
            return (
                <div className={`${shell} block-card-enter`}>
                    {header}
                    <div className={`text-[11px] uppercase tracking-wider ${meta.tint}`}>{meta.label}</div>
                    <div className="mt-2 text-sm text-[#d1d5db] whitespace-pre-wrap">{String(block.data.body || '')}</div>
                </div>
            );
        }
        if (block.kind === 'link') {
            const url = String(block.data.url || '');
            return (
                <a href={url} target="_blank" rel="noopener noreferrer" className={`block ${shell} block-card-enter hover:bg-[linear-gradient(165deg,#111a2a_5%,#0d1320_60%,#0a0f16_100%)] transition-colors`}>
                    {header}
                    <div className={`text-[11px] uppercase tracking-wider ${meta.tint}`}>{meta.label}</div>
                    <div className="mt-1 text-xs text-[#9fb0c7] truncate">{url}</div>
                </a>
            );
        }
        return null;
    };

    const resetComposerHeight = () => {
        const el = inputRef.current;
        if (!el || !(el instanceof HTMLTextAreaElement)) return;
        el.style.height = 'auto';
    };

    const getTitleFromFirstMessage = (text: string) => {
        const clean = text
            .replace(/^>\s*Replying to:[^\n]*\n*/i, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!clean) return 'New Chat';
        return clean.length > 60 ? `${clean.slice(0, 60)}...` : clean;
    };

    // --- AI View Exit Logic ---
    const exitAiMode = () => {
        setIsPrivateAiMode(false);
        if (editorRef.current) {
            // Clean up any stray tokens if needed, but primary job is just switching state off
            editorRef.current.focus();
        }
    };

    // --- AI Chat Logic ---
    const handleSendChat = async (overrideInput?: string) => {
        // ... (Existing AI Chat Logic - kept for 'ai-chat' view)
        const textToSend = overrideInput || chatInput;
        if ((!textToSend.trim() && !activeToolId) || isChatLoading) return;

        let msgText = textToSend;
        if (replyingTo) {
            msgText = `> Replying to: "${replyingTo.text}"\n\n${msgText}`;
            setReplyingTo(null);
        }

        const userMsg = { role: 'user' as const, text: msgText };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput("");
        resetComposerHeight();
        if (canPlayChatSounds) playMessageSentSound();

        let currentThreadId = activeThreadId;
        let isNewThread = false;
        if (!currentThreadId && !isTemporaryChat) {
            isNewThread = true;
            currentThreadId = Date.now().toString();
            setActiveThreadId(currentThreadId);
            const newThread: ChatThread = { id: currentThreadId, title: getTitleFromFirstMessage(msgText), messages: [userMsg], lastModified: Date.now() };
            setThreads(prev => [newThread, ...prev]);
        } else if (currentThreadId) {
            setThreads(prev => prev.map(t => t.id === currentThreadId ? { ...t, messages: [...t.messages, userMsg], lastModified: Date.now() } : t));
        }

        setIsChatLoading(true);
        try {
            let systemContext = "";
            if (connectedProject) systemContext += `[System: The user has connected the project "${connectedProject.title}" (Type: ${connectedProject.type}). Answer questions specifically about this context if asked.]\n`;
            if (activeToolId) {
                const tool = getToolDetails(activeToolId);
                systemContext += `[System: The user has activated the "${tool.label}" tool. Focus your response on this task.]\n`;
            }

            const historyForApi = isTemporaryChat ? chatHistory : (isNewThread ? [] : chatHistory);
            const response = await sendChatMessage(historyForApi, systemContext + msgText, selectedModel);

            const modelMsg = { role: 'model' as const, text: response };
            setChatHistory(prev => [...prev, modelMsg]);
            if (!isTemporaryChat && currentThreadId) {
                setThreads(prev => prev.map(t => t.id === currentThreadId ? { ...t, messages: [...t.messages, modelMsg], lastModified: Date.now() } : t));
            }

            if (canPlayChatSounds) playNotificationSound();
            setActiveToolId(null);
        } catch (e) {
            console.error(e);
            const errText = e instanceof Error ? e.message : String(e || 'AI request failed.');
            const errorMsg = { role: 'model' as const, text: `Sorry, I couldn't respond right now.\n\n${errText}` };
            setChatHistory(prev => [...prev, errorMsg]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleRedo = async () => {
        if (chatHistory.length < 2) return;
        let lastUserMsgIndex = -1;
        for (let i = chatHistory.length - 1; i >= 0; i--) {
            if (chatHistory[i].role === 'user') { lastUserMsgIndex = i; break; }
        }
        if (lastUserMsgIndex !== -1) {
            const lastUserText = chatHistory[lastUserMsgIndex].text;
            const newHistory = chatHistory.slice(0, lastUserMsgIndex + 1);
            setChatHistory(newHistory);
            setIsChatLoading(true);
            try {
                const historyForApi = newHistory.slice(0, -1);
                const responseText = await sendChatMessage(historyForApi, lastUserText, selectedModel);
                setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
            } catch (e) { setChatHistory(prev => [...prev, { role: 'model', text: "Error regenerating." }]); } finally { setIsChatLoading(false); }
        }
    };

    const handleNewThread = (temporary: boolean = false) => {
        setChatHistory([]);
        setChatInput("");
        resetComposerHeight();
        setConnectedProject(null);
        setActiveToolId(null);
        setReplyingTo(null);
        setActiveThreadId(null);
        setIsTemporaryChat(temporary);
        setOpenThreadMenuId(null);
        setEditingThreadId(null);
        setEditingThreadTitle('');
    };

    const loadThread = (thread: ChatThread) => {
        setChatHistory(thread.messages);
        setActiveThreadId(thread.id);
        setChatInput("");
        resetComposerHeight();
        setIsTemporaryChat(false);
        setOpenThreadMenuId(null);
        setEditingThreadId(null);
        if (window.innerWidth < 768) setShowHistorySidebar(false);
    };

    const handleDeleteThread = (threadId: string) => {
        setThreads(prev => prev.filter(thread => thread.id !== threadId));
        if (activeThreadId === threadId) {
            handleNewThread(false);
        }
        setOpenThreadMenuId(null);
    };

    const handleTogglePinThread = (threadId: string) => {
        setThreads(prev => prev.map(thread => (
            thread.id === threadId ? { ...thread, pinned: !thread.pinned, lastModified: Date.now() } : thread
        )));
        setOpenThreadMenuId(null);
    };

    const handleStartRenameThread = (thread: ChatThread) => {
        setEditingThreadId(thread.id);
        setEditingThreadTitle(thread.title);
        setOpenThreadMenuId(null);
    };

    const handleSaveRenameThread = (threadId: string) => {
        const title = editingThreadTitle.trim();
        if (!title) {
            setEditingThreadId(null);
            setEditingThreadTitle('');
            return;
        }
        setThreads(prev => prev.map(thread => (
            thread.id === threadId ? { ...thread, title, lastModified: Date.now() } : thread
        )));
        setEditingThreadId(null);
        setEditingThreadTitle('');
    };

    const handleShareThread = async (thread: ChatThread) => {
        try {
            const payload: SharedThreadPayload = {
                title: thread.title,
                exportedAt: new Date().toISOString(),
                messages: thread.messages
            };
            const encoded = encodeSharePayload(payload);
            if (!encoded) throw new Error('Failed to encode share payload');
            const baseUrl = `${window.location.origin}${window.location.pathname}`;
            const link = `${baseUrl}#${SHARED_THREAD_HASH_KEY}=${encodeURIComponent(encoded)}`;
            await navigator.clipboard.writeText(link);
        } catch (error) {
            console.error('Failed to share thread:', error);
        } finally {
            setOpenThreadMenuId(null);
        }
    };

    const handleShareThreadToTeam = (thread: ChatThread) => {
        try {
            const payload: SharedThreadPayload = {
                title: thread.title,
                exportedAt: new Date().toISOString(),
                messages: thread.messages
            };
            const encoded = encodeSharePayload(payload);
            if (!encoded) throw new Error('Failed to encode share payload');
            const baseUrl = `${window.location.origin}${window.location.pathname}`;
            const link = `${baseUrl}#${SHARED_THREAD_HASH_KEY}=${encodeURIComponent(encoded)}`;

            const targetChatId = activeTeamChatId || (directChats[0] ? `dm-${directChats[0].chatId}` : null);
            if (!targetChatId) return;
            const shareAvatar = isHttpUrl(userAvatar) ? userAvatar : ((userAvatar || userName || 'User').substring(0, 2).toUpperCase());
            const shareMessage: ChatMessage = {
                id: Date.now(),
                user: userName || 'User',
                avatar: shareAvatar,
                isAvatarImage: isHttpUrl(shareAvatar),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                text: `Shared chat: <b>${thread.title}</b><br/><a href="${link}" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline">${link}</a>`,
                color: 'bg-indigo-600',
                isMe: true
            };

            setTeamChats(prev => ({
                ...prev,
                [targetChatId]: [...(prev[targetChatId] || []), shareMessage]
            }));
        } catch (error) {
            console.error('Failed to share thread to team:', error);
        } finally {
            setOpenThreadMenuId(null);
        }
    };

    const handleAIChatClick = () => {
        setCurrentView('ai-chat');
        setShowHistorySidebar(true);
        if (!isSidebarOpen) setIsSidebarOpen(true);
    };

    const handleMenuSelect = (action: string) => {
        setShowPlusMenu(false);
        switch (action) {
            case 'upload': fileInputRef.current?.click(); break;
            case 'context': setShowProjectSelector(true); break;
            default: setActiveToolId(action); if (inputRef.current) inputRef.current.focus(); break;
        }
    };

    const loadDirectChats = async () => {
        if (!currentUserId) return;
        try {
            const [chats, directSettings, groupSettings] = await Promise.all([
                listDirectChats(),
                listChatUserSettingsForKind('direct'),
                listChatUserSettingsForKind('group')
            ]);
            const directSettingsMap: Record<string, ChatUserSettings> = {};
            directSettings.forEach(setting => {
                directSettingsMap[setting.chatId] = setting;
            });
            const groupSettingsMap: Record<string, ChatUserSettings> = {};
            groupSettings.forEach(setting => {
                groupSettingsMap[setting.chatId] = setting;
            });
            setDirectChatSettingsMap(directSettingsMap);
            setGroupChatSettingsMap(groupSettingsMap);
            setDirectChats(chats);
        } catch (error: any) {
            console.error('Failed to load direct chats:', error);
        }
    };

    const upsertChatPopup = (popup: ChatPopupNotification) => {
        setChatPopups(prev => {
            const existingIndex = prev.findIndex(item => item.id === popup.id);
            if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = popup;
                return next;
            }
            const next = [popup, ...prev];
            return next.slice(0, 4);
        });
    };

    const dismissChatPopup = (popupId: string) => {
        setChatPopups(prev => prev.filter(item => item.id !== popupId));
    };

    const updateChatPopupReply = (popupId: string, value: string) => {
        setChatPopups(prev => prev.map(item => item.id === popupId ? { ...item, replyText: value } : item));
    };

  const isChatCurrentlyOpen = (kind: 'direct' | 'group', chatId: string) => {
      if (currentViewRef.current !== 'team') return false;
      // If the user has this chat selected (chat or files tab), don't show popup.
      if (kind === 'direct') return activeTeamChatIdRef.current === `dm-${chatId}`;
      return activeTeamChatIdRef.current === `gc-${chatId}`;
  };

  const syncLocalTrackRefs = (stream: MediaStream | null) => {
      if (!stream) {
          localCameraTrackRef.current = null;
          localMicTrackRef.current = null;
          return;
      }
      localCameraTrackRef.current = stream.getVideoTracks()[0] || null;
      localMicTrackRef.current = stream.getAudioTracks()[0] || null;
      setIsCameraOff(localCameraTrackRef.current ? !localCameraTrackRef.current.enabled : true);
      setIsMicMuted(localMicTrackRef.current ? !localMicTrackRef.current.enabled : false);
  };

  const refreshLocalStreamState = () => {
      if (!localCallStreamRef.current) {
          setLocalCallStream(null);
          return;
      }
      setLocalCallStream(new MediaStream(localCallStreamRef.current.getTracks()));
  };

  const generateCallSessionId = () => `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const generateSignalId = () => `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const getIceServers = () => {
      const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
      const turnUrl = (import.meta.env.VITE_TURN_URL as string | undefined)?.trim();
      const turnUsername = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim();
      const turnCredential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim();
      if (turnUrl && turnUsername && turnCredential) {
          servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
      }
      return servers;
  };

  const drawStrokesOnCanvas = (
      canvas: HTMLCanvasElement | null,
      strokes: CallOverlayItem[]
  ) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const item of strokes) {
          if (item.kind === 'text') {
              const x = item.x * width;
              const y = item.y * height;
              ctx.fillStyle = item.color || '#ffffff';
              ctx.font = '600 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
              ctx.textBaseline = 'top';
              ctx.fillText(item.text || '', x, y);
              continue;
          }
          if (!item.points.length) continue;
          if (item.points.length === 1) {
              const x = item.points[0].x * width;
              const y = item.points[0].y * height;
              ctx.beginPath();
              ctx.fillStyle = item.color || '#60a5fa';
              ctx.arc(x, y, 1.8, 0, Math.PI * 2);
              ctx.fill();
              continue;
          }
          ctx.beginPath();
          ctx.strokeStyle = item.color || '#60a5fa';
          ctx.moveTo(item.points[0].x * width, item.points[0].y * height);
          for (let i = 1; i < item.points.length; i += 1) {
              ctx.lineTo(item.points[i].x * width, item.points[i].y * height);
          }
          ctx.stroke();
      }
  };

  const normalizeCanvasPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(1, rect.height)));
      return { x, y };
  };

  const isLikelyScreenTrack = (track: MediaStreamTrack | null | undefined) => {
      if (!track) return false;
      const label = (track.label || '').toLowerCase();
      if (label.includes('screen') || label.includes('window') || label.includes('display') || label.includes('tab')) return true;
      const settings = track.getSettings?.();
      if (settings && typeof settings.displaySurface === 'string' && settings.displaySurface.length > 0) return true;
      return false;
  };

  const stopSpeakingMeters = () => {
      if (localSpeakingRafRef.current) window.cancelAnimationFrame(localSpeakingRafRef.current);
      if (remoteSpeakingRafRef.current) window.cancelAnimationFrame(remoteSpeakingRafRef.current);
      localSpeakingRafRef.current = null;
      remoteSpeakingRafRef.current = null;
      if (localAudioCtxRef.current) {
          void localAudioCtxRef.current.close().catch(() => undefined);
          localAudioCtxRef.current = null;
      }
      if (remoteAudioCtxRef.current) {
          void remoteAudioCtxRef.current.close().catch(() => undefined);
          remoteAudioCtxRef.current = null;
      }
      setLocalSpeakingLevel(0);
      setRemoteSpeakingLevel(0);
  };

  const startSpeakingMeter = (
      stream: MediaStream | null,
      side: 'local' | 'remote'
  ) => {
      const track = stream?.getAudioTracks?.()[0];
      if (!track) {
          if (side === 'local') setLocalSpeakingLevel(0);
          else setRemoteSpeakingLevel(0);
          return;
      }
      try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = ctx.createMediaStreamSource(new MediaStream([track]));
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.75;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
              analyser.getByteTimeDomainData(data);
              let sum = 0;
              for (let i = 0; i < data.length; i += 1) {
                  const v = (data[i] - 128) / 128;
                  sum += v * v;
              }
              const rms = Math.sqrt(sum / data.length);
              const level = Math.max(0, Math.min(1, (rms - 0.02) * 7));
              if (side === 'local') {
                  setLocalSpeakingLevel(prev => prev * 0.7 + level * 0.3);
                  localSpeakingRafRef.current = window.requestAnimationFrame(tick);
              } else {
                  setRemoteSpeakingLevel(prev => prev * 0.7 + level * 0.3);
                  remoteSpeakingRafRef.current = window.requestAnimationFrame(tick);
              }
          };
          if (side === 'local') {
              if (localAudioCtxRef.current) void localAudioCtxRef.current.close().catch(() => undefined);
              if (localSpeakingRafRef.current) window.cancelAnimationFrame(localSpeakingRafRef.current);
              localAudioCtxRef.current = ctx;
              localSpeakingRafRef.current = window.requestAnimationFrame(tick);
          } else {
              if (remoteAudioCtxRef.current) void remoteAudioCtxRef.current.close().catch(() => undefined);
              if (remoteSpeakingRafRef.current) window.cancelAnimationFrame(remoteSpeakingRafRef.current);
              remoteAudioCtxRef.current = ctx;
              remoteSpeakingRafRef.current = window.requestAnimationFrame(tick);
          }
      } catch {
          if (side === 'local') setLocalSpeakingLevel(0);
          else setRemoteSpeakingLevel(0);
      }
  };

  const stopOutgoingRing = () => {
      if (outgoingRingIntervalRef.current) {
          window.clearInterval(outgoingRingIntervalRef.current);
          outgoingRingIntervalRef.current = null;
      }
  };

  const stopIncomingRing = () => {
      if (incomingRingIntervalRef.current) {
          window.clearInterval(incomingRingIntervalRef.current);
          incomingRingIntervalRef.current = null;
      }
  };

  const pushProcessedSignalId = (id: string) => {
      const set = processedSignalIdsRef.current;
      set.add(id);
      if (set.size > 200) {
          const items = Array.from(set);
          processedSignalIdsRef.current = new Set(items.slice(items.length - 120));
      }
  };

  const pushProcessedOverlayId = (id: string) => {
      const set = processedOverlayIdsRef.current;
      set.add(id);
      if (set.size > 400) {
          const items = Array.from(set);
          processedOverlayIdsRef.current = new Set(items.slice(items.length - 220));
      }
  };

  const stopAndClearCall = () => {
      stopSpeakingMeters();
      if (speechRecognitionRef.current) {
          try {
              speechRecognitionRef.current.stop();
          } catch {}
          speechRecognitionRef.current = null;
      }
      isTranscribingRef.current = false;
      stopOutgoingRing();
      stopIncomingRing();
      if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
      }
      try {
          peerConnectionRef.current?.close();
      } catch {}
      if (screenShareTrackRef.current) {
          try {
              screenShareTrackRef.current.stop();
          } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try {
              mediaRecorderRef.current.stop();
          } catch {}
      }
      setIsRecordingCall(false);
      peerConnectionRef.current = null;
      if (localCallStreamRef.current) {
          localCallStreamRef.current.getTracks().forEach(track => track.stop());
      }
      setLocalCallStream(null);
      setRemoteCallStream(null);
      remoteCompositeStreamRef.current = null;
      setRemoteMediaState({ isScreenSharing: false, isCameraOn: true });
      setRemotePrimaryView('screen');
      setRemotePipPosition({ x: 78, y: 74 });
      setIncomingCall(null);
      setIsMicMuted(false);
      setIsCameraOff(false);
      setIsScreenSharing(false);
      setIsCallFullscreen(false);
      setCallStartedAt(null);
      setCallDurationSec(0);
      setCallConnectionLabel('Idle');
      setCallChatMessages([]);
      setCallChatInput('');
      setDrawStrokes([]);
      setIsDrawMode(false);
      setIsDrawToolsOpen(false);
      setIsTextMode(false);
      setTextDraft(null);
      setIsTranscribing(false);
      setTranscriptItems([]);
      setShowCallInfoPanel(false);
      setCallUiToast(null);
      setIsCaptureFlash(false);
      setCallPhase('idle');
      callPeerUserIdRef.current = null;
      activeCallChatIdRef.current = null;
      pendingIceCandidatesRef.current = [];
      activeCallSessionIdRef.current = null;
      screenShareTrackRef.current = null;
      screenShareSenderRef.current = null;
      cameraSenderRef.current = null;
      localCameraTrackRef.current = null;
      localMicTrackRef.current = null;
  };

  const createPeerConnection = (chatId: string, otherUserId: string, sessionId: string) => {
      const peerConnection = new RTCPeerConnection({
          iceServers: getIceServers()
      });
      peerConnectionRef.current = peerConnection;
      activeCallChatIdRef.current = chatId;
      callPeerUserIdRef.current = otherUserId;
      activeCallSessionIdRef.current = sessionId;

      peerConnection.onicecandidate = (event) => {
          if (!event.candidate) return;
          void sendChatCallSignal({
              chatKind: 'direct',
              chatId,
              toUserId: otherUserId,
              type: 'ice',
              payload: { candidate: event.candidate.toJSON(), sessionId }
          });
          void sendCallSignalRealtime({
              chatId,
              toUserId: otherUserId,
              type: 'ice',
              payload: { candidate: event.candidate.toJSON(), sessionId }
          });
      };

      peerConnection.ontrack = (event) => {
          if (!remoteCompositeStreamRef.current) {
              remoteCompositeStreamRef.current = new MediaStream();
          }
          const stream = remoteCompositeStreamRef.current;
          const alreadyExists = stream.getTracks().some(track => track.id === event.track.id);
          if (!alreadyExists) stream.addTrack(event.track);
          setRemoteCallStream(new MediaStream(stream.getTracks()));
          event.track.onunmute = () => {
              setRemoteCallStream(new MediaStream(stream.getTracks()));
          };
          event.track.onended = () => {
              try {
                  stream.removeTrack(event.track);
              } catch {}
              setRemoteCallStream(new MediaStream(stream.getTracks()));
          };
      };

      peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState;
          if (state === 'new') setCallConnectionLabel('Preparing');
          if (state === 'connecting') setCallConnectionLabel('Connecting');
          if (state === 'connected') {
              stopOutgoingRing();
              stopIncomingRing();
              setCallConnectionLabel('Connected');
              setCallPhase('active');
              setCallStartedAt(prev => prev || Date.now());
          }
          if (state === 'failed' || state === 'disconnected') {
              setCallConnectionLabel('Reconnecting');
              try {
                  peerConnection.restartIce();
              } catch {}
              if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = window.setTimeout(() => {
                  if (peerConnection.connectionState !== 'connected') {
                      stopAndClearCall();
                  }
              }, 12000);
          }
          if (state === 'connected' && reconnectTimerRef.current) {
              window.clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
          }
          if (state === 'closed') {
              stopAndClearCall();
          }
      };

      return peerConnection;
  };

  const startOutgoingCall = async (mode: CallMode) => {
      if (!activeDirectChat || isActiveDirectBlocked || callPhase !== 'idle') return;
      const chatId = activeDirectChat.chatId;
      const targetUserId = activeDirectChat.otherUserId;
      const sessionId = generateCallSessionId();
      try {
          setCallMode(mode);
          setCallPhase('outgoing');
          setCallConnectionLabel('Starting call');
          setCallChatMessages([]);
          setCallScreenshots([]);
          setCallRecordings([]);
          setTranscriptItems([]);
          setCallPeerName(activeDirectChat.otherName || 'User');
          setCallPeerAvatar(activeDirectChat.otherAvatar || 'U');
          setCallPeerAvatarIsImage(isHttpUrl(activeDirectChat.otherAvatar));

          const localStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: mode === 'video'
          });
          setLocalCallStream(localStream);
          syncLocalTrackRefs(localStream);

          const peerConnection = createPeerConnection(chatId, targetUserId, sessionId);
          localStream.getTracks().forEach(track => {
              const sender = peerConnection.addTrack(track, localStream);
              if (track.kind === 'video') cameraSenderRef.current = sender;
          });
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          await sendChatCallSignal({
              chatKind: 'direct',
              chatId,
              toUserId: targetUserId,
              type: 'offer',
              payload: {
                  sdp: offer.sdp,
                  mode,
                  fromName: userName || 'User',
                  fromAvatar: userAvatar || (userName || 'U').slice(0, 2).toUpperCase(),
                  fromAvatarIsImage: isHttpUrl(userAvatar),
                  activeChatId: `dm-${chatId}`,
                  sessionId
              }
          });
          await sendCallSignalRealtime({
              chatId,
              toUserId: targetUserId,
              type: 'offer',
              payload: {
                  sdp: offer.sdp,
                  mode,
                  fromName: userName || 'User',
                  fromAvatar: userAvatar || (userName || 'U').slice(0, 2).toUpperCase(),
                  fromAvatarIsImage: isHttpUrl(userAvatar),
                  activeChatId: `dm-${chatId}`,
                  sessionId
              }
          });
          setCallPhase('connecting');
          setCallConnectionLabel('Ringing');
          stopOutgoingRing();
          outgoingRingIntervalRef.current = window.setInterval(() => {
              playCallRingPattern('outgoing');
          }, 1200);
      } catch (error) {
          console.error('Failed to start call', error);
          stopAndClearCall();
      }
  };

  const handleEndCall = async () => {
      const chatId = activeCallChatIdRef.current;
      const peerUserId = callPeerUserIdRef.current;
      if (chatId && peerUserId) {
          await sendChatCallSignal({
              chatKind: 'direct',
              chatId,
              toUserId: peerUserId,
              type: 'end',
              payload: { sessionId: activeCallSessionIdRef.current }
          });
          await sendCallSignalRealtime({
              chatId,
              toUserId: peerUserId,
              type: 'end',
              payload: { sessionId: activeCallSessionIdRef.current }
          });
      }
      await postCallSummaryToChat();
      stopAndClearCall();
  };

  const acceptIncomingCall = async () => {
      if (!incomingCall || callPhase !== 'incoming') return;
      try {
          stopIncomingRing();
          setCurrentView('team');
          setActiveTeamChatId(`dm-${incomingCall.chatId}`);
          setCallMode(incomingCall.mode);
          setCallPhase('connecting');
          setCallConnectionLabel('Joining');
          setCallScreenshots([]);
          setCallRecordings([]);
          setTranscriptItems([]);
          setCallPeerName(incomingCall.fromName);
          setCallPeerAvatar(incomingCall.fromAvatar);
          setCallPeerAvatarIsImage(incomingCall.fromAvatarIsImage);

          let localStream: MediaStream;
          try {
              localStream = await navigator.mediaDevices.getUserMedia({
                  audio: true,
                  video: incomingCall.mode === 'video'
              });
          } catch {
              localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              setCallMode('audio');
          }
          setLocalCallStream(localStream);
          syncLocalTrackRefs(localStream);

          const peerConnection = createPeerConnection(incomingCall.chatId, incomingCall.fromUserId, incomingCall.sessionId);
          localStream.getTracks().forEach(track => {
              const sender = peerConnection.addTrack(track, localStream);
              if (track.kind === 'video') cameraSenderRef.current = sender;
          });

          await peerConnection.setRemoteDescription(incomingCall.offerSdp);
          if (pendingIceCandidatesRef.current.length) {
              const pending = [...pendingIceCandidatesRef.current];
              pendingIceCandidatesRef.current = [];
              pending.forEach(candidate => {
                  void peerConnection.addIceCandidate(candidate).catch(() => undefined);
              });
          }
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          await sendChatCallSignal({
              chatKind: 'direct',
              chatId: incomingCall.chatId,
              toUserId: incomingCall.fromUserId,
              type: 'answer',
              payload: { sdp: answer.sdp, sessionId: incomingCall.sessionId }
          });
          await sendCallSignalRealtime({
              chatId: incomingCall.chatId,
              toUserId: incomingCall.fromUserId,
              type: 'answer',
              payload: { sdp: answer.sdp, sessionId: incomingCall.sessionId }
          });
          setIncomingCall(null);
      } catch (error) {
          console.error('Failed to accept call', error);
          stopAndClearCall();
      }
  };

  const declineIncomingCall = async () => {
      if (!incomingCall) return;
      stopIncomingRing();
      await sendChatCallSignal({
          chatKind: 'direct',
          chatId: incomingCall.chatId,
          toUserId: incomingCall.fromUserId,
          type: 'reject',
          payload: { sessionId: incomingCall.sessionId }
      });
      await sendCallSignalRealtime({
          chatId: incomingCall.chatId,
          toUserId: incomingCall.fromUserId,
          type: 'reject',
          payload: { sessionId: incomingCall.sessionId }
      });
      setIncomingCall(null);
      stopAndClearCall();
  };

  const sendCallBroadcastEvent = async (eventName: string, payload: Record<string, any>) => {
      if (!callBroadcastChannelRef.current) return;
      await callBroadcastChannelRef.current.send({
          type: 'broadcast',
          event: eventName,
          payload
      });
  };

  const sendCallOverlaySignal = async (
      overlayType: 'draw' | 'cursor' | 'media-state',
      payload: Record<string, any>,
      options?: { cursorFallback?: boolean }
  ) => {
      const chatId = activeCallChatIdRef.current;
      const toUserId = callPeerUserIdRef.current;
      const sessionId = activeCallSessionIdRef.current;
      if (!chatId || !toUserId || !sessionId) return;
      const overlayId = String(payload.overlayId || generateSignalId());
      pushProcessedOverlayId(overlayId);
      const payloadWithOverlayId = { ...payload, overlayId };
      if (callBroadcastChannelRef.current) {
          await sendCallBroadcastEvent(`call-${overlayType}`, payloadWithOverlayId);
      }
      if (overlayType === 'cursor' && !options?.cursorFallback) return;
      if (overlayType === 'media-state' && options?.cursorFallback === false) return;
      await sendChatCallSignal({
          chatKind: 'direct',
          chatId,
          toUserId,
          type: 'ice',
          payload: {
              overlayType,
              sessionId,
              ...payloadWithOverlayId
          }
      });
  };

  const emitCallMediaState = async () => {
      const chatId = activeCallChatIdRef.current;
      const toUserId = callPeerUserIdRef.current;
      const sessionId = activeCallSessionIdRef.current;
      if (!chatId || !toUserId || !sessionId || !currentUserId) return;
      const hasCameraTrack = Boolean(localCameraTrackRef.current && localCameraTrackRef.current.enabled);
      await sendCallOverlaySignal('media-state', {
          chatId,
          sessionId,
          fromUserId: currentUserId,
          toUserId,
          isScreenSharing,
          isCameraOn: hasCameraTrack
      }, { cursorFallback: false });
  };

  const postCallSummaryToChat = async () => {
      const chatId = activeCallChatIdRef.current;
      if (!chatId) return;
      const startedAtTs = callStartedAt || Date.now();
      const endedAtTs = Date.now();
      const summary: CallEventSummary = {
          peerName: callPeerName || 'User',
          durationSec: callDurationSec,
          startedAt: startedAtTs,
          endedAt: endedAtTs,
          screenshotCount: callScreenshots.length,
          recordingCount: callRecordings.length,
          callMessages: callChatMessages.map((item) => ({
              senderName: item.senderName,
              text: item.text,
              createdAt: item.createdAt
          }))
      };
      const attachments = [
          ...callScreenshots.map((item) => ({
              type: 'image' as const,
              name: item.name,
              url: item.url,
              file: item.file
          })),
          ...callRecordings.map((item) => ({
              type: 'video' as const,
              name: item.name,
              url: item.url,
              file: item.file
          }))
      ];
      try {
          await sendDirectMessage(chatId, serializeCallEventSummary(summary), attachments);
      } catch (error) {
          console.error('Failed to post call summary', error);
      }
  };

  const sendCallSignalRealtime = async (input: {
      chatId: string;
      toUserId: string;
      type: 'offer' | 'answer' | 'ice' | 'end' | 'reject' | 'busy';
      payload?: Record<string, any>;
  }) => {
      if (!currentUserId) return;
      const signalId = generateSignalId();
      pushProcessedSignalId(signalId);
      await sendCallBroadcastEvent('call-signal', {
          signalId,
          chatKind: 'direct',
          chatId: input.chatId,
          fromUserId: currentUserId,
          toUserId: input.toUserId,
          signalType: input.type,
          payload: input.payload || {}
      });
  };

  const renegotiateActiveCall = async () => {
      const peerConnection = peerConnectionRef.current;
      const chatId = activeCallChatIdRef.current;
      const toUserId = callPeerUserIdRef.current;
      const sessionId = activeCallSessionIdRef.current;
      if (!peerConnection || !chatId || !toUserId || !sessionId) return;
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      const payload = { sdp: offer.sdp, mode: 'video', sessionId, renegotiate: true };
      await sendChatCallSignal({
          chatKind: 'direct',
          chatId,
          toUserId,
          type: 'offer',
          payload
      });
      await sendCallSignalRealtime({
          chatId,
          toUserId,
          type: 'offer',
          payload
      });
  };

  const handleCallSignalEvent = (evt: {
      chatId: string;
      fromUserId: string;
      signalType: string;
      payload: Record<string, any>;
      signalId?: string;
  }) => {
      const { chatId, fromUserId, signalType, payload } = evt;
      const signalId = evt.signalId || '';
      if (!chatId || !fromUserId) return;
      if (signalId && processedSignalIdsRef.current.has(signalId)) return;
      if (signalId) pushProcessedSignalId(signalId);

      const signalSessionId = String(payload.sessionId || '');
      if (signalType === 'offer') {
          if (
              signalSessionId &&
              activeCallSessionIdRef.current &&
              signalSessionId === activeCallSessionIdRef.current &&
              peerConnectionRef.current &&
              payload.renegotiate
          ) {
              const remoteSdp = String(payload.sdp || '');
              if (!remoteSdp) return;
              void (async () => {
                  await peerConnectionRef.current!.setRemoteDescription({ type: 'offer', sdp: remoteSdp });
                  const answer = await peerConnectionRef.current!.createAnswer();
                  await peerConnectionRef.current!.setLocalDescription(answer);
                  const responsePayload = { sdp: answer.sdp, sessionId: signalSessionId };
                  if (!activeCallChatIdRef.current || !callPeerUserIdRef.current) return;
                  await sendChatCallSignal({
                      chatKind: 'direct',
                      chatId: activeCallChatIdRef.current,
                      toUserId: callPeerUserIdRef.current,
                      type: 'answer',
                      payload: responsePayload
                  });
                  await sendCallSignalRealtime({
                      chatId: activeCallChatIdRef.current,
                      toUserId: callPeerUserIdRef.current,
                      type: 'answer',
                      payload: responsePayload
                  });
              })().catch((error) => console.error('Renegotiation failed', error));
              return;
          }
          const activeSessionId = activeCallSessionIdRef.current || '';
          const incomingSessionId = incomingCallRef.current?.sessionId || '';
          // Ignore duplicate offers for the same call session coming from another signaling path.
          if (signalSessionId && (signalSessionId === activeSessionId || signalSessionId === incomingSessionId)) {
              return;
          }
          if (callPhaseRef.current !== 'idle') {
              void sendChatCallSignal({
                  chatKind: 'direct',
                  chatId,
                  toUserId: fromUserId,
                  type: 'busy',
                  payload: { sessionId: signalSessionId }
              });
              void sendCallSignalRealtime({
                  chatId,
                  toUserId: fromUserId,
                  type: 'busy',
                  payload: { sessionId: signalSessionId }
              });
              return;
          }
          const offerSdp = String(payload.sdp || '');
          if (!offerSdp) return;
          setCallMode(payload.mode === 'video' ? 'video' : 'audio');
          setCallPeerName(String(payload.fromName || 'User'));
          setCallPeerAvatar(String(payload.fromAvatar || 'U'));
          setCallPeerAvatarIsImage(Boolean(payload.fromAvatarIsImage));
          setIncomingCall({
              chatId,
              fromUserId,
              fromName: String(payload.fromName || 'User'),
              fromAvatar: String(payload.fromAvatar || 'U'),
              fromAvatarIsImage: Boolean(payload.fromAvatarIsImage),
              sessionId: signalSessionId || generateCallSessionId(),
              mode: payload.mode === 'video' ? 'video' : 'audio',
              offerSdp: { type: 'offer', sdp: offerSdp }
          });
          setCallPhase('incoming');
          stopIncomingRing();
          incomingRingIntervalRef.current = window.setInterval(() => {
              playCallRingPattern('incoming');
          }, 900);
          return;
      }

      if (signalType === 'answer' && peerConnectionRef.current && chatId === activeCallChatIdRef.current) {
          if (signalSessionId && activeCallSessionIdRef.current && signalSessionId !== activeCallSessionIdRef.current) return;
          const sdp = String(payload.sdp || '');
          if (!sdp) return;
          stopOutgoingRing();
          setCallConnectionLabel('Joining');
          void peerConnectionRef.current.setRemoteDescription({ type: 'answer', sdp }).then(() => {
              if (pendingIceCandidatesRef.current.length) {
                  const pending = [...pendingIceCandidatesRef.current];
                  pendingIceCandidatesRef.current = [];
                  pending.forEach(candidate => {
                      void peerConnectionRef.current?.addIceCandidate(candidate).catch(() => undefined);
                  });
              }
          });
          return;
      }

      if (signalType === 'ice' && chatId === activeCallChatIdRef.current) {
          if (signalSessionId && activeCallSessionIdRef.current && signalSessionId !== activeCallSessionIdRef.current) return;
          const overlayType = String(payload.overlayType || '');
          const overlayId = String(payload.overlayId || '');
          if (overlayId && processedOverlayIdsRef.current.has(overlayId)) return;
          if (overlayId) pushProcessedOverlayId(overlayId);
          if (overlayType === 'draw') {
              const action = String(payload.action || '');
              if (action === 'clear') {
                  setDrawStrokes([]);
                  return;
              }
              if (action === 'text') {
                  const color = String(payload.color || '#60a5fa');
                  const text = String(payload.text || '').trim();
                  const x = Number(payload.x);
                  const y = Number(payload.y);
                  if (!text || !Number.isFinite(x) || !Number.isFinite(y)) return;
                  setDrawStrokes(prev => [...prev, { kind: 'text', color, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), text }]);
                  return;
              }
              const color = String(payload.color || '#60a5fa');
              const points = Array.isArray(payload.points) ? payload.points : [];
              const normalized = points
                  .map((point: any) => ({ x: Number(point?.x || 0), y: Number(point?.y || 0) }))
                  .filter((point: any) => Number.isFinite(point.x) && Number.isFinite(point.y));
              if (!normalized.length) return;
              setDrawStrokes(prev => [...prev, { kind: 'stroke', color, points: normalized }]);
              return;
          }
          if (overlayType === 'cursor') {
              const x = Number(payload.x);
              const y = Number(payload.y);
              if (!Number.isFinite(x) || !Number.isFinite(y)) return;
              setRemoteCursorPoint({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
              if (remoteCursorHideTimerRef.current) window.clearTimeout(remoteCursorHideTimerRef.current);
              remoteCursorHideTimerRef.current = window.setTimeout(() => setRemoteCursorPoint(null), 1800);
              return;
          }
          if (overlayType === 'media-state') {
              setRemoteMediaState({
                  isScreenSharing: Boolean(payload.isScreenSharing),
                  isCameraOn: Boolean(payload.isCameraOn)
              });
              if (Boolean(payload.isScreenSharing)) setRemotePrimaryView('screen');
              return;
          }
          const candidate = payload.candidate as RTCIceCandidateInit | undefined;
          if (!candidate) return;
          if (peerConnectionRef.current?.remoteDescription) {
              void peerConnectionRef.current.addIceCandidate(candidate).catch(() => undefined);
          } else {
              pendingIceCandidatesRef.current.push(candidate);
          }
          return;
      }

      if (signalType === 'reject' || signalType === 'busy' || signalType === 'end') {
          if (signalSessionId && activeCallSessionIdRef.current && signalSessionId !== activeCallSessionIdRef.current) return;
          stopOutgoingRing();
          stopIncomingRing();
          stopAndClearCall();
      }
  };

  const sendCallChatMessage = async () => {
      const text = callChatInput.trim();
      const chatId = activeCallChatIdRef.current;
      const toUserId = callPeerUserIdRef.current;
      const sessionId = activeCallSessionIdRef.current;
      if (!text || !chatId || !toUserId || !sessionId || !currentUserId) return;

      const message = {
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          senderId: currentUserId,
          senderName: userName || 'You',
          text,
          createdAt: Date.now()
      };
      setCallChatMessages(prev => [...prev, message]);
      setCallChatInput('');

      await sendCallBroadcastEvent('call-chat', {
          chatId,
          sessionId,
          fromUserId: currentUserId,
          toUserId,
          text,
          senderName: userName || 'User',
          createdAt: message.createdAt
      });

  };

  const sendCursorPoint = async (point: { x: number; y: number }) => {
      const now = Date.now();
      if (now - cursorSendTsRef.current < 30) return;
      cursorSendTsRef.current = now;
      const chatId = activeCallChatIdRef.current;
      const toUserId = callPeerUserIdRef.current;
      const sessionId = activeCallSessionIdRef.current;
      if (!chatId || !toUserId || !sessionId || !currentUserId) return;
      const shouldSendDbFallback = now - cursorFallbackTsRef.current >= 180;
      if (shouldSendDbFallback) cursorFallbackTsRef.current = now;
      await sendCallOverlaySignal('cursor', {
          chatId,
          sessionId,
          fromUserId: currentUserId,
          toUserId,
          x: point.x,
          y: point.y
      }, { cursorFallback: shouldSendDbFallback });
  };

  const clearCallDrawings = async () => {
      const chatId = activeCallChatIdRef.current;
      const toUserId = callPeerUserIdRef.current;
      const sessionId = activeCallSessionIdRef.current;
      if (!chatId || !toUserId || !sessionId || !currentUserId) return;
      setDrawStrokes([]);
      await sendCallOverlaySignal('draw', {
          action: 'clear',
          chatId,
          sessionId,
          fromUserId: currentUserId,
          toUserId
      });
  };

  const captureCallScreenshot = async () => {
      const stage = callStageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const screenshotCanvas = document.createElement('canvas');
      screenshotCanvas.width = width;
      screenshotCanvas.height = height;
      const ctx = screenshotCanvas.getContext('2d');
      if (!ctx) return;
      try {
          if (remoteCallVideoRef.current && remoteMainShouldUseTrack) {
              ctx.drawImage(remoteCallVideoRef.current, 0, 0, width, height);
          } else if (localCallVideoRef.current && hasLocalVideo) {
              ctx.drawImage(localCallVideoRef.current, 0, 0, width, height);
          } else {
              ctx.fillStyle = '#0b0f14';
              ctx.fillRect(0, 0, width, height);
          }
      } catch {
          ctx.fillStyle = '#0b0f14';
          ctx.fillRect(0, 0, width, height);
      }

      // Local preview tile (bottom-right)
      const previewW = Math.round(width * 0.22);
      const previewH = Math.round(height * 0.22);
      const previewX = width - previewW - 12;
      const previewY = height - previewH - 12;
      ctx.fillStyle = '#000';
      ctx.fillRect(previewX, previewY, previewW, previewH);
      try {
          if (localCallVideoRef.current && hasLocalVideo && !isCameraOff) {
              ctx.drawImage(localCallVideoRef.current, previewX, previewY, previewW, previewH);
          } else {
              ctx.fillStyle = '#0f131a';
              ctx.fillRect(previewX, previewY, previewW, previewH);
              ctx.fillStyle = '#9aa3ad';
              ctx.font = '12px ui-sans-serif, system-ui';
              ctx.fillText('You', previewX + 8, previewY + 18);
          }
      } catch {}

      // Remote PiP bubble if visible
      if (remotePipTrack || remoteMediaState.isScreenSharing) {
          const pipSize = Math.round(Math.min(width, height) * 0.2);
          const pipCx = (remotePipPosition.x / 100) * width;
          const pipCy = (remotePipPosition.y / 100) * height;
          const pipX = Math.round(pipCx - pipSize / 2);
          const pipY = Math.round(pipCy - pipSize / 2);
          ctx.save();
          ctx.beginPath();
          ctx.arc(pipCx, pipCy, pipSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          try {
              if (remoteCallPipVideoRef.current && remotePipTrack) {
                  ctx.drawImage(remoteCallPipVideoRef.current, pipX, pipY, pipSize, pipSize);
              } else if (callPeerAvatarIsImage) {
                  // avatar image may be cross-origin, fallback fill on error
                  const img = new Image();
                  img.src = callPeerAvatar;
                  ctx.drawImage(img, pipX, pipY, pipSize, pipSize);
              } else {
                  ctx.fillStyle = '#2b3035';
                  ctx.fillRect(pipX, pipY, pipSize, pipSize);
              }
          } catch {
              ctx.fillStyle = '#2b3035';
              ctx.fillRect(pipX, pipY, pipSize, pipSize);
          }
          ctx.restore();
      }

      drawStrokesOnCanvas(screenshotCanvas, drawStrokesRef.current);

      // Cursor overlay
      if (remoteCursorPoint) {
          const cx = remoteCursorPoint.x * width;
          const cy = remoteCursorPoint.y * height;
          ctx.beginPath();
          ctx.fillStyle = '#22d3ee';
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fill();
      }

      // Transcript overlay
      if (isTranscribing) {
          ctx.fillStyle = 'rgba(10,14,20,0.86)';
          ctx.fillRect(12, 12, Math.min(width - 24, 360), 120);
          ctx.fillStyle = '#ffffff';
          ctx.font = '600 11px ui-sans-serif, system-ui';
          const lines = transcriptItems.slice(-4).map(item => `${item.senderName}: ${item.text}`);
          lines.forEach((line, idx) => {
              const y = 36 + (idx * 20);
              ctx.fillText(line.slice(0, 64), 20, y);
          });
      }

      // Call info overlay
      if (showCallInfoPanel) {
          const panelW = 220;
          const panelX = width - panelW - 12;
          const panelY = 12;
          ctx.fillStyle = 'rgba(10,14,20,0.9)';
          ctx.fillRect(panelX, panelY, panelW, 92);
          ctx.fillStyle = '#d5dbe3';
          ctx.font = '11px ui-sans-serif, system-ui';
          ctx.fillText(`With: ${callPeerName || 'User'}`, panelX + 10, panelY + 18);
          ctx.fillText(`Duration: ${formatCallDuration(callDurationSec)}`, panelX + 10, panelY + 36);
          ctx.fillText(`Screenshots: ${callScreenshots.length}`, panelX + 10, panelY + 54);
          ctx.fillText(`Recordings: ${callRecordings.length}`, panelX + 10, panelY + 72);
      }

      const blob = await new Promise<Blob | null>((resolve) => screenshotCanvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const fileName = `call-screenshot-${Date.now()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      const localUrl = URL.createObjectURL(blob);
      setIsCaptureFlash(true);
      window.setTimeout(() => setIsCaptureFlash(false), 200);
      setCallScreenshots(prev => [...prev, { id: fileName, name: fileName, url: localUrl, createdAt: Date.now(), file }]);
      setCallUiToast('Screenshot captured');
  };

  const toggleCallRecording = async () => {
      if (isRecordingCall) {
          const recorder = mediaRecorderRef.current;
          if (recorder && recorder.state !== 'inactive') {
              recorder.stop();
          } else {
              setIsRecordingCall(false);
          }
          return;
      }
      const sourceStream = remoteCallStream || localCallStream;
      if (!sourceStream) return;
      try {
          const recorder = new MediaRecorder(sourceStream, { mimeType: 'video/webm;codecs=vp8,opus' });
          recordingChunksRef.current = [];
          recorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) recordingChunksRef.current.push(event.data);
          };
          recorder.onstop = async () => {
              const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
              recordingChunksRef.current = [];
              mediaRecorderRef.current = null;
              setIsRecordingCall(false);
              if (!blob.size) return;
              const fileName = `call-recording-${Date.now()}.webm`;
              const file = new File([blob], fileName, { type: 'video/webm' });
              const localUrl = URL.createObjectURL(blob);
              setCallRecordings(prev => [...prev, { id: fileName, name: fileName, url: localUrl, createdAt: Date.now(), file }]);
              setCallUiToast('Recording saved');
          };
          recorder.start(1000);
          mediaRecorderRef.current = recorder;
          setIsRecordingCall(true);
          setCallUiToast('Recording started');
      } catch (error) {
          console.error('Failed to start recording', error);
      }
  };

  const toggleLiveTranscription = async () => {
      if (callPhaseRef.current === 'idle') return;
      if (isTranscribingRef.current) {
          isTranscribingRef.current = false;
          if (speechRecognitionRef.current) {
              try {
                  speechRecognitionRef.current.stop();
              } catch {}
          }
          speechRecognitionRef.current = null;
          setIsTranscribing(false);
          return;
      }
      const RecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!RecognitionCtor) {
          setCallConnectionLabel('Transcription unsupported');
          return;
      }
      const recognition = new RecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
              const result = event.results[i];
              const text = String(result?.[0]?.transcript || '').trim();
              if (!text || !result.isFinal) continue;
              const item = {
                  id: `local_transcript_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  senderId: currentUserId || 'me',
                  senderName: userName || 'You',
                  text,
                  createdAt: Date.now()
              };
              setTranscriptItems(prev => [...prev, item]);
          }
      };
      recognition.onerror = () => {
          isTranscribingRef.current = false;
          setIsTranscribing(false);
          speechRecognitionRef.current = null;
      };
      recognition.onend = () => {
          if (isTranscribingRef.current && callPhaseRef.current !== 'idle') {
              try {
                  recognition.start();
                  return;
              } catch {}
          }
          isTranscribingRef.current = false;
          setIsTranscribing(false);
          speechRecognitionRef.current = null;
      };
      try {
          recognition.start();
          speechRecognitionRef.current = recognition;
          isTranscribingRef.current = true;
          setIsTranscribing(true);
      } catch {
          isTranscribingRef.current = false;
          setIsTranscribing(false);
          speechRecognitionRef.current = null;
      }
  };

  const commitTextDraft = async () => {
      if (!textDraft || !drawCanvasRef.current) return;
      const text = textDraft.text.trim();
      if (!text) {
          setTextDraft(null);
          return;
      }
      const x = Math.max(0, Math.min(1, textDraft.x));
      const y = Math.max(0, Math.min(1, textDraft.y));
      setDrawStrokes(prev => [...prev, { kind: 'text', color: drawColor, x, y, text }]);
      const chatId = activeCallChatIdRef.current;
      const toUserId = callPeerUserIdRef.current;
      const sessionId = activeCallSessionIdRef.current;
      if (chatId && toUserId && sessionId && currentUserId) {
          await sendCallOverlaySignal('draw', {
              action: 'text',
              chatId,
              sessionId,
              fromUserId: currentUserId,
              toUserId,
              color: drawColor,
              x,
              y,
              text
          });
      }
      setTextDraft(null);
  };

  const handleDrawPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawMode || !drawCanvasRef.current || callPhaseRef.current === 'idle') return;
      event.preventDefault();
      try {
          event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
      const point = normalizeCanvasPoint(drawCanvasRef.current, event.clientX, event.clientY);
      if (isTextMode) {
          setTextDraft({ x: point.x, y: point.y, text: '' });
          return;
      }
      isDrawingRef.current = true;
      currentStrokeRef.current = [point];
      const previewStroke: CallOverlayItem = { kind: 'stroke', color: drawColor, points: [point] };
      drawStrokesOnCanvas(drawCanvasRef.current, [...drawStrokesRef.current, previewStroke]);
  };

  const handleDrawPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawMode || !drawCanvasRef.current) return;
      event.preventDefault();
      const point = normalizeCanvasPoint(drawCanvasRef.current, event.clientX, event.clientY);
      void sendCursorPoint(point);
      if (!isDrawingRef.current) return;
      currentStrokeRef.current = [...currentStrokeRef.current, point];
      const previewStroke: CallOverlayItem = { kind: 'stroke', color: drawColor, points: currentStrokeRef.current };
      drawStrokesOnCanvas(drawCanvasRef.current, [...drawStrokesRef.current, previewStroke]);
  };

  const finishDrawStroke = async (event?: React.PointerEvent<HTMLCanvasElement>) => {
      if (event) {
          event.preventDefault();
          try {
              event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {}
      }
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const points = currentStrokeRef.current;
      currentStrokeRef.current = [];
      if (!points.length) return;
      setDrawStrokes(prev => [...prev, { kind: 'stroke', color: drawColor, points }]);
      const chatId = activeCallChatIdRef.current;
      const toUserId = callPeerUserIdRef.current;
      const sessionId = activeCallSessionIdRef.current;
      if (!chatId || !toUserId || !sessionId || !currentUserId) return;
      await sendCallOverlaySignal('draw', {
          action: 'stroke',
          chatId,
          sessionId,
          fromUserId: currentUserId,
          toUserId,
          color: drawColor,
          points
      });
  };

  const handleRemotePipPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      const state = pipDragStateRef.current;
      state.dragging = true;
      state.moved = false;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.baseX = remotePipPosition.x;
      state.baseY = remotePipPosition.y;
      try {
          event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
  };

  const handleRemotePipPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const state = pipDragStateRef.current;
      if (!state.dragging || !callStageRef.current) return;
      const rect = callStageRef.current.getBoundingClientRect();
      const dxPct = ((event.clientX - state.startX) / Math.max(1, rect.width)) * 100;
      const dyPct = ((event.clientY - state.startY) / Math.max(1, rect.height)) * 100;
      if (Math.abs(dxPct) > 0.3 || Math.abs(dyPct) > 0.3) state.moved = true;
      const nextX = Math.max(4, Math.min(84, state.baseX + dxPct));
      const nextY = Math.max(8, Math.min(84, state.baseY + dyPct));
      setRemotePipPosition({ x: nextX, y: nextY });
  };

  const handleRemotePipPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
      const state = pipDragStateRef.current;
      if (!state.dragging) return;
      state.dragging = false;
      try {
          event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
      if (!state.moved && remoteHasSplitView) {
          setRemotePrimaryView(prev => prev === 'screen' ? 'camera' : 'screen');
      }
  };

  const toggleCallMic = () => {
      const track = localMicTrackRef.current;
      if (!track) return;
      track.enabled = !track.enabled;
      setIsMicMuted(!track.enabled);
  };

  const toggleCallCamera = () => {
      const track = localCameraTrackRef.current;
      if (track) {
          track.enabled = !track.enabled;
          setIsCameraOff(!track.enabled);
          if (track.enabled) setCallMode('video');
          refreshLocalStreamState();
          void emitCallMediaState();
          return;
      }
      void (async () => {
          try {
              const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
              const cameraTrack = cameraStream.getVideoTracks()[0];
              if (!cameraTrack || !peerConnectionRef.current) return;
              if (!localCallStreamRef.current) {
                  localCallStreamRef.current = new MediaStream();
              }
              localCallStreamRef.current.addTrack(cameraTrack);
              refreshLocalStreamState();
              localCameraTrackRef.current = cameraTrack;
              if (cameraSenderRef.current) {
                  await cameraSenderRef.current.replaceTrack(cameraTrack);
              } else {
                  cameraSenderRef.current = peerConnectionRef.current.addTrack(cameraTrack, localCallStreamRef.current);
              }
              await renegotiateActiveCall();
              cameraTrack.enabled = true;
              setIsCameraOff(false);
              setCallMode('video');
              void emitCallMediaState();
          } catch (error) {
              console.error('Failed to enable camera', error);
          }
      })();
  };

  const toggleScreenShare = async () => {
      if (!peerConnectionRef.current) return;
      if (isScreenSharing && screenShareTrackRef.current) {
          try {
              screenShareTrackRef.current.stop();
          } catch {}
          if (screenShareSenderRef.current) {
              try {
                  peerConnectionRef.current.removeTrack(screenShareSenderRef.current);
              } catch {}
          }
          if (localCallStreamRef.current && screenShareTrackRef.current) {
              try {
                  localCallStreamRef.current.removeTrack(screenShareTrackRef.current);
              } catch {}
          }
          screenShareSenderRef.current = null;
          screenShareTrackRef.current = null;
          setIsScreenSharing(false);
          refreshLocalStreamState();
          await renegotiateActiveCall();
          void emitCallMediaState();
          return;
      }
      try {
          const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          const screenTrack = display.getVideoTracks()[0];
          if (!screenTrack) return;
          if (!localCallStreamRef.current) localCallStreamRef.current = new MediaStream();
          localCallStreamRef.current.addTrack(screenTrack);
          refreshLocalStreamState();
          screenShareTrackRef.current = screenTrack;
          screenShareSenderRef.current = peerConnectionRef.current.addTrack(screenTrack, localCallStreamRef.current);
          await renegotiateActiveCall();
          setIsScreenSharing(true);
          setCallMode('video');
          void emitCallMediaState();
          screenTrack.onended = () => {
              if (!peerConnectionRef.current) {
                  setIsScreenSharing(false);
                  screenShareTrackRef.current = null;
                  screenShareSenderRef.current = null;
                  return;
              }
              if (screenShareSenderRef.current) {
                  try {
                      peerConnectionRef.current.removeTrack(screenShareSenderRef.current);
                  } catch {}
              }
              if (localCallStreamRef.current && screenTrack) {
                  try {
                      localCallStreamRef.current.removeTrack(screenTrack);
                  } catch {}
              }
              screenShareSenderRef.current = null;
              setIsScreenSharing(false);
              screenShareTrackRef.current = null;
              refreshLocalStreamState();
              void renegotiateActiveCall();
              void emitCallMediaState();
          };
      } catch (error) {
          console.error('Screen share failed', error);
      }
  };

    useEffect(() => {
        currentViewRef.current = currentView;
    }, [currentView]);

  useEffect(() => {
      activeTeamChatIdRef.current = activeTeamChatId;
  }, [activeTeamChatId]);

  useEffect(() => {
      callPhaseRef.current = callPhase;
  }, [callPhase]);

  useEffect(() => {
      isTranscribingRef.current = isTranscribing;
  }, [isTranscribing]);

  useEffect(() => {
      if (callPhase === 'idle') {
          stopSpeakingMeters();
          return;
      }
      startSpeakingMeter(localCallStream, 'local');
      startSpeakingMeter(remoteCallStream, 'remote');
      return () => {
          // keep meters managed by next effect run
      };
  }, [localCallStream, remoteCallStream, callPhase]);

  useEffect(() => {
      if (callPhase === 'idle') return;
      void emitCallMediaState();
  }, [isScreenSharing, isCameraOff, callPhase]);

  useEffect(() => {
      const tracks = remoteCallStream?.getVideoTracks?.() || [];
      const screenTrack = tracks.find(track => isLikelyScreenTrack(track))
          || (remoteMediaState.isScreenSharing ? tracks[0] : null)
          || null;
      const cameraTrack = tracks.find(track => track.id !== screenTrack?.id)
          || (remoteMediaState.isScreenSharing ? null : tracks[0] || null);
      if (screenTrack && cameraTrack) {
          if (remoteMediaState.isScreenSharing && remotePrimaryView !== 'screen') {
              setRemotePrimaryView('screen');
          }
          return;
      }
      if (cameraTrack && !screenTrack && remotePrimaryView !== 'camera') {
          setRemotePrimaryView('camera');
          return;
      }
      if (screenTrack && !cameraTrack && remotePrimaryView !== 'screen') {
          setRemotePrimaryView('screen');
      }
  }, [remoteCallStream, remoteMediaState.isScreenSharing, remotePrimaryView]);

  useEffect(() => {
      if (!textDraft) return;
      window.setTimeout(() => textDraftInputRef.current?.focus(), 0);
  }, [textDraft]);

  useEffect(() => {
      if (!callUiToast) return;
      const timer = window.setTimeout(() => setCallUiToast(null), 1800);
      return () => window.clearTimeout(timer);
  }, [callUiToast]);

  useEffect(() => {
      incomingCallRef.current = incomingCall;
  }, [incomingCall]);

    useEffect(() => {
        if (!currentUserId) return;
        metaRealtimeUnsubscribeRef.current?.();
        metaRealtimeUnsubscribeRef.current = null;
        if (metaRealtimeReloadTimerRef.current) {
            window.clearTimeout(metaRealtimeReloadTimerRef.current);
            metaRealtimeReloadTimerRef.current = null;
        }

        const refreshMetadata = () => {
            if (metaRealtimeReloadTimerRef.current) window.clearTimeout(metaRealtimeReloadTimerRef.current);
            metaRealtimeReloadTimerRef.current = window.setTimeout(() => {
                void loadDirectChats();
                void (async () => {
                    try {
                        const [groups, blocked, blockedBy, requests] = await Promise.all([
                            listGroupChats(),
                            listBlockedUsers(),
                            listUsersWhoBlockedMe(),
                            listIncomingChatRequests()
                        ]);
                        setGroupChats(groups);
                        setBlockedUserIds(blocked);
                        setBlockedByUserIds(blockedBy);
                        setPendingChatRequests(requests);
                    } catch (error) {
                        console.error('Failed realtime metadata refresh:', error);
                    }
                })();
            }, 120);
        };

        const specs: SupabaseRealtimeChangeSpec[] = [
            { schema: 'public', table: 'direct_chats', event: '*', filter: `user_a=eq.${currentUserId}` },
            { schema: 'public', table: 'direct_chats', event: '*', filter: `user_b=eq.${currentUserId}` },
            { schema: 'public', table: 'group_chats', event: '*' },
            { schema: 'public', table: 'group_chat_members', event: '*', filter: `user_id=eq.${currentUserId}` },
            { schema: 'public', table: 'chat_requests', event: '*', filter: `to_user_id=eq.${currentUserId}` },
            { schema: 'public', table: 'chat_blocks', event: '*', filter: `user_id=eq.${currentUserId}` },
            { schema: 'public', table: 'chat_blocks', event: '*', filter: `blocked_user_id=eq.${currentUserId}` },
            { schema: 'public', table: 'chat_archives', event: '*', filter: `user_id=eq.${currentUserId}` }
        ];

        void (async () => {
            try {
                const unsubscribe = await subscribeToSupabaseChanges(specs, () => {
                    refreshMetadata();
                });
                metaRealtimeUnsubscribeRef.current = unsubscribe;
            } catch (error) {
                console.error('Failed to start metadata realtime:', error);
            }
        })();

        return () => {
            if (metaRealtimeReloadTimerRef.current) {
                window.clearTimeout(metaRealtimeReloadTimerRef.current);
                metaRealtimeReloadTimerRef.current = null;
            }
            metaRealtimeUnsubscribeRef.current?.();
            metaRealtimeUnsubscribeRef.current = null;
        };
    }, [currentUserId]);

  useEffect(() => {
      if (!currentUserId) return;
      popupRealtimeUnsubscribeRef.current?.();
        popupRealtimeUnsubscribeRef.current = null;

        const profileCache = new Map<string, BasicProfile>();
        const resolveSenderProfile = async (senderId: string, fallbackName = 'User'): Promise<BasicProfile> => {
            if (profileCache.has(senderId)) return profileCache.get(senderId)!;
            const profile = await getProfileBasicById(senderId);
            const safe: BasicProfile = profile || {
                id: senderId,
                name: fallbackName,
                avatar: fallbackName.slice(0, 2).toUpperCase() || 'U',
                isAvatarImage: false
            };
            profileCache.set(senderId, safe);
            return safe;
        };

        const specs: SupabaseRealtimeChangeSpec[] = [
            { schema: 'public', table: 'direct_messages', event: 'INSERT' },
            { schema: 'public', table: 'group_messages', event: 'INSERT' }
        ];

        void (async () => {
            try {
                const unsubscribe = await subscribeToSupabaseChanges(specs, (event) => {
                    if (event.eventType !== 'INSERT' || !event.newRecord) return;
                    const row = event.newRecord as Record<string, any>;
                    if (row.sender_id && String(row.sender_id) === String(currentUserId)) return;

                    if (event.table === 'direct_messages') {
                        const chatId = String(row.chat_id || '');
                        const senderId = String(row.sender_id || '');
                        if (!chatId || !senderId) return;
                        if (isChatCurrentlyOpen('direct', chatId)) return;
                        if (!isScopeNotificationsEnabled('direct', chatId) || isScopeMuted('direct', chatId)) return;
                        const dm = directChats.find(item => item.chatId === chatId);
                        const fallbackName = dm?.otherName || 'User';
                        const fallbackAvatar = dm?.otherAvatar || fallbackName.slice(0, 2).toUpperCase();
                        const popupId = `direct:${chatId}:${String(row.id || Date.now())}`;
                        void (async () => {
                            const sender = await resolveSenderProfile(senderId, fallbackName);
                            const rawText = String(row.content || '').trim();
                            const callEvent = rawText ? parseCallEventSummary(rawText) : null;
                            const blockEvent = rawText ? parseChatBlock(rawText) : null;
                            upsertChatPopup({
                                id: popupId,
                                chatKind: 'direct',
                                chatId,
                                messageId: String(row.id || popupId),
                                senderId,
                                senderName: sender.name || fallbackName,
                                senderAvatar: sender.avatar || fallbackAvatar,
                                senderAvatarIsImage: sender.isAvatarImage || isHttpUrl(sender.avatar || fallbackAvatar),
                                text: callEvent
                                    ? 'Call Ended'
                                    : blockEvent
                                        ? describeChatBlockNotification(blockEvent, sender.name || fallbackName)
                                        : (rawText || '(Attachment)'),
                                replyText: ''
                            });
                            if (canScopePlaySound('direct', chatId, messageMentionsCurrentUser(rawText))) {
                                playNotificationSound();
                            }
                        })();
                        return;
                    }

                    if (event.table === 'group_messages') {
                        const groupId = String(row.group_chat_id || '');
                        const senderId = String(row.sender_id || '');
                        if (!groupId || !senderId) return;
                        if (isChatCurrentlyOpen('group', groupId)) return;
                        if (!isScopeNotificationsEnabled('group', groupId) || isScopeMuted('group', groupId)) return;
                        const group = groupChats.find(item => item.id === groupId);
                        const fallbackName = 'User';
                        const popupId = `group:${groupId}:${String(row.id || Date.now())}`;
                        void (async () => {
                            const sender = await resolveSenderProfile(senderId, fallbackName);
                            const rawText = String(row.content || '').trim();
                            const blockEvent = rawText ? parseChatBlock(rawText) : null;
                            upsertChatPopup({
                                id: popupId,
                                chatKind: 'group',
                                chatId: groupId,
                                messageId: String(row.id || popupId),
                                senderId,
                                senderName: sender.name || fallbackName,
                                senderAvatar: sender.avatar || fallbackName.slice(0, 2).toUpperCase(),
                                senderAvatarIsImage: sender.isAvatarImage || isHttpUrl(sender.avatar || ''),
                                groupName: group?.name || 'Group chat',
                                text: blockEvent
                                    ? describeChatBlockNotification(blockEvent, sender.name || fallbackName)
                                    : (rawText || '(Attachment)'),
                                replyText: ''
                            });
                            if (canScopePlaySound('group', groupId, messageMentionsCurrentUser(rawText))) {
                                playNotificationSound();
                            }
                        })();
                    }
                });
                popupRealtimeUnsubscribeRef.current = unsubscribe;
            } catch (error) {
                console.error('Failed to start popup realtime:', error);
            }
        })();

      return () => {
          popupRealtimeUnsubscribeRef.current?.();
          popupRealtimeUnsubscribeRef.current = null;
      };
  }, [currentUserId, currentView, activeTeamTab, activeTeamChatId, directChats, groupChats, directChatSettingsMap, groupChatSettingsMap, activeChatSettings]);

  useEffect(() => {
      if (!currentUserId) return;
      callRealtimeUnsubscribeRef.current?.();
      callRealtimeUnsubscribeRef.current = null;

      void (async () => {
          try {
              const specs: SupabaseRealtimeChangeSpec[] = [
                  { schema: 'public', table: 'chat_call_signals', event: 'INSERT', filter: `to_user_id=eq.${currentUserId}` }
              ];
              const unsubscribe = await subscribeToSupabaseChanges(specs, (event) => {
                  if (event.table !== 'chat_call_signals' || event.eventType !== 'INSERT' || !event.newRecord) return;
                  const row = event.newRecord as Record<string, any>;
                  const chatId = String(row.chat_id || '');
                  const fromUserId = String(row.from_user_id || '');
                  const signalType = String(row.signal_type || '');
                  const payload = (row.payload || {}) as Record<string, any>;
                  if (!chatId || !fromUserId || row.chat_kind !== 'direct') return;
                  handleCallSignalEvent({ chatId, fromUserId, signalType, payload, signalId: String(row.id || '') });
              });
              callRealtimeUnsubscribeRef.current = unsubscribe;
          } catch (error) {
              console.error('Failed to start call realtime:', error);
          }
      })();

      return () => {
          callRealtimeUnsubscribeRef.current?.();
          callRealtimeUnsubscribeRef.current = null;
      };
  }, [currentUserId]);

  useEffect(() => {
      if (!currentUserId) return;
      const channel = supabase.channel('natural-call-signals');
      channel
          .on('broadcast', { event: 'call-signal' }, ({ payload }) => {
              const toUserId = String(payload?.toUserId || '');
              const fromUserId = String(payload?.fromUserId || '');
              const chatId = String(payload?.chatId || '');
              const signalType = String(payload?.signalType || '');
              const signalPayload = (payload?.payload || {}) as Record<string, any>;
              const signalId = String(payload?.signalId || '');
              if (!toUserId || toUserId !== currentUserId) return;
              if (!fromUserId || fromUserId === currentUserId) return;
              handleCallSignalEvent({ chatId, fromUserId, signalType, payload: signalPayload, signalId });
          })
          .on('broadcast', { event: 'call-chat' }, ({ payload }) => {
              const fromUserId = String(payload?.fromUserId || '');
              const chatId = String(payload?.chatId || '');
              const sessionId = String(payload?.sessionId || '');
              const text = String(payload?.text || '');
              const senderName = String(payload?.senderName || 'User');
              const createdAt = Number(payload?.createdAt || Date.now());
              if (fromUserId === currentUserId) return;
              if (!activeCallSessionIdRef.current || sessionId !== activeCallSessionIdRef.current) return;
              if (!activeCallChatIdRef.current || chatId !== activeCallChatIdRef.current) return;
              if (!text.trim()) return;
              setCallChatMessages(prev => [
                  ...prev,
                  { id: `remote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, senderId: fromUserId, senderName, text, createdAt }
              ]);
          })
          .on('broadcast', { event: 'call-draw' }, ({ payload }) => {
              const fromUserId = String(payload?.fromUserId || '');
              const chatId = String(payload?.chatId || '');
              const sessionId = String(payload?.sessionId || '');
              const action = String(payload?.action || '');
              if (fromUserId === currentUserId) return;
              if (!activeCallSessionIdRef.current || sessionId !== activeCallSessionIdRef.current) return;
              if (!activeCallChatIdRef.current || chatId !== activeCallChatIdRef.current) return;
              const overlayId = String(payload?.overlayId || '');
              if (overlayId && processedOverlayIdsRef.current.has(overlayId)) return;
              if (overlayId) pushProcessedOverlayId(overlayId);
              if (action === 'clear') {
                  setDrawStrokes([]);
                  return;
              }
              if (action === 'text') {
                  const color = String(payload?.color || '#60a5fa');
                  const text = String(payload?.text || '').trim();
                  const x = Number(payload?.x);
                  const y = Number(payload?.y);
                  if (!text || !Number.isFinite(x) || !Number.isFinite(y)) return;
                  setDrawStrokes(prev => [...prev, { kind: 'text', color, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), text }]);
                  return;
              }
              if (action === 'stroke') {
                  const color = String(payload?.color || '#60a5fa');
                  const points = Array.isArray(payload?.points) ? payload.points : [];
                  const normalized = points
                      .map((point: any) => ({ x: Number(point?.x || 0), y: Number(point?.y || 0) }))
                      .filter((point: any) => Number.isFinite(point.x) && Number.isFinite(point.y));
                  if (!normalized.length) return;
                  setDrawStrokes(prev => [...prev, { kind: 'stroke', color, points: normalized }]);
              }
          })
          .on('broadcast', { event: 'call-cursor' }, ({ payload }) => {
              const fromUserId = String(payload?.fromUserId || '');
              const chatId = String(payload?.chatId || '');
              const sessionId = String(payload?.sessionId || '');
              const x = Number(payload?.x);
              const y = Number(payload?.y);
              if (fromUserId === currentUserId) return;
              if (!activeCallSessionIdRef.current || sessionId !== activeCallSessionIdRef.current) return;
              if (!activeCallChatIdRef.current || chatId !== activeCallChatIdRef.current) return;
              const overlayId = String(payload?.overlayId || '');
              if (overlayId && processedOverlayIdsRef.current.has(overlayId)) return;
              if (overlayId) pushProcessedOverlayId(overlayId);
              if (!Number.isFinite(x) || !Number.isFinite(y)) return;
              setRemoteCursorPoint({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
              if (remoteCursorHideTimerRef.current) window.clearTimeout(remoteCursorHideTimerRef.current);
              remoteCursorHideTimerRef.current = window.setTimeout(() => setRemoteCursorPoint(null), 1800);
          })
          .on('broadcast', { event: 'call-media-state' }, ({ payload }) => {
              const fromUserId = String(payload?.fromUserId || '');
              const chatId = String(payload?.chatId || '');
              const sessionId = String(payload?.sessionId || '');
              const overlayId = String(payload?.overlayId || '');
              if (fromUserId === currentUserId) return;
              if (!activeCallSessionIdRef.current || sessionId !== activeCallSessionIdRef.current) return;
              if (!activeCallChatIdRef.current || chatId !== activeCallChatIdRef.current) return;
              if (overlayId && processedOverlayIdsRef.current.has(overlayId)) return;
              if (overlayId) pushProcessedOverlayId(overlayId);
              setRemoteMediaState({
                  isScreenSharing: Boolean(payload?.isScreenSharing),
                  isCameraOn: Boolean(payload?.isCameraOn)
              });
              if (Boolean(payload?.isScreenSharing)) setRemotePrimaryView('screen');
          })
          .subscribe((status) => {
              if (status === 'SUBSCRIBED') callBroadcastChannelRef.current = channel;
          });

      return () => {
          callBroadcastChannelRef.current = null;
          if (remoteCursorHideTimerRef.current) {
              window.clearTimeout(remoteCursorHideTimerRef.current);
              remoteCursorHideTimerRef.current = null;
          }
          try {
              supabase.removeChannel(channel);
          } catch {}
      };
  }, [currentUserId]);

  useEffect(() => {
      if (localCallVideoRef.current) localCallVideoRef.current.srcObject = localCallStream;
      localCallStreamRef.current = localCallStream;
  }, [localCallStream]);

  useEffect(() => {
      if (!remoteCallVideoRef.current) return;
      const tracks = remoteCallStream?.getVideoTracks?.() || [];
      const screenTrack = tracks.find(track => isLikelyScreenTrack(track))
          || (remoteMediaState.isScreenSharing ? tracks[0] : null)
          || null;
      const cameraTrack = tracks.find(track => track.id !== screenTrack?.id)
          || (remoteMediaState.isScreenSharing ? null : tracks[0] || null);
      const hasSplit = Boolean(screenTrack && cameraTrack);
      const mainTrack = hasSplit
          ? (remotePrimaryView === 'camera' ? cameraTrack : screenTrack)
          : (screenTrack || cameraTrack || null);
      const shouldUseTrack = Boolean(mainTrack) && !(remotePrimaryView === 'camera' && !remoteMediaState.isCameraOn);
      if (!mainTrack || !shouldUseTrack) {
          remoteCallVideoRef.current.srcObject = null;
          return;
      }
      remoteCallVideoRef.current.srcObject = new MediaStream([mainTrack]);
      void remoteCallVideoRef.current.play().catch(() => undefined);
  }, [remoteCallStream, remoteMediaState.isScreenSharing, remotePrimaryView]);

  useEffect(() => {
      if (!remoteCallPipVideoRef.current) return;
      const tracks = remoteCallStream?.getVideoTracks?.() || [];
      const screenTrack = tracks.find(track => isLikelyScreenTrack(track))
          || (remoteMediaState.isScreenSharing ? tracks[0] : null)
          || null;
      const cameraTrack = tracks.find(track => track.id !== screenTrack?.id)
          || (remoteMediaState.isScreenSharing ? null : tracks[0] || null);
      const hasSplit = Boolean(screenTrack && cameraTrack);
      const pipTrack = hasSplit
          ? (remotePrimaryView === 'camera' ? screenTrack : cameraTrack)
          : null;
      const shouldUseTrack = Boolean(pipTrack) && !(remotePrimaryView === 'screen' && !remoteMediaState.isCameraOn);
      if (!pipTrack || !shouldUseTrack) {
          remoteCallPipVideoRef.current.srcObject = null;
          return;
      }
      remoteCallPipVideoRef.current.srcObject = new MediaStream([pipTrack]);
      void remoteCallPipVideoRef.current.play().catch(() => undefined);
  }, [remoteCallStream, remoteMediaState.isScreenSharing, remotePrimaryView]);

  useEffect(() => {
      if (!remoteCallAudioRef.current) return;
      const remoteAudioTrack = remoteCallStream?.getAudioTracks?.()[0] || null;
      remoteCallAudioRef.current.srcObject = remoteAudioTrack ? new MediaStream([remoteAudioTrack]) : null;
      void remoteCallAudioRef.current.play().catch(() => undefined);
  }, [remoteCallStream]);

  useEffect(() => {
      drawStrokesOnCanvas(drawCanvasRef.current, drawStrokes);
  }, [drawStrokes, isCallFullscreen]);

  useEffect(() => {
      drawStrokesRef.current = drawStrokes;
  }, [drawStrokes]);

  useEffect(() => {
      const handleResize = () => drawStrokesOnCanvas(drawCanvasRef.current, drawStrokes);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [drawStrokes]);

  useEffect(() => {
      if (!callChatScrollRef.current) return;
      callChatScrollRef.current.scrollTop = callChatScrollRef.current.scrollHeight;
  }, [callChatMessages]);

  useEffect(() => {
      if (!callStartedAt || callPhase === 'idle') {
          setCallDurationSec(0);
          return;
      }
      const timer = window.setInterval(() => {
          setCallDurationSec(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
      }, 1000);
      return () => window.clearInterval(timer);
  }, [callStartedAt, callPhase]);

  useEffect(() => {
      return () => {
          stopAndClearCall();
      };
  }, []);

    const mapDirectMessagesToChatMessages = (chatId: string, items: Awaited<ReturnType<typeof listDirectMessages>>) => {
        const dm = directChats.find(c => c.chatId === chatId);
        return items.map((item, index) => {
            const isMe = item.senderId === currentUserId;
            const senderName = isMe ? (userName || 'You') : (dm?.otherName || 'User');
            const avatarValue = isMe
                ? (isHttpUrl(userAvatar) ? userAvatar : (userAvatar || (userName || 'You').slice(0, 2).toUpperCase()))
                : (dm?.otherAvatar || senderName.slice(0, 2).toUpperCase());
            const avatarIsImage = isHttpUrl(avatarValue);
            const parsedId = Number(item.id);
            return {
                id: Number.isFinite(parsedId) ? parsedId : Date.parse(item.createdAt) + index,
                user: senderName,
                avatar: avatarValue,
                isAvatarImage: avatarIsImage,
                time: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                text: item.content || '',
                color: isMe ? 'bg-indigo-600' : 'bg-blue-600',
                isMe,
                isEdited: item.isEdited,
                attachments: (item.attachments || []).map(att => ({
                    type: att.type,
                    url: att.url,
                    name: att.name,
                    size: att.size
                })),
                reactions: item.reactions || [],
                createdAt: item.createdAt
            } as ChatMessage;
        });
    };

    const mapGroupMessagesToChatMessages = (items: Awaited<ReturnType<typeof listGroupMessages>>) => {
        return items.map((item, index) => {
            const isMe = item.senderId === currentUserId;
            const avatarValue = isMe
                ? (isHttpUrl(userAvatar) ? userAvatar : (userAvatar || (userName || 'You').slice(0, 2).toUpperCase()))
                : (item.senderAvatar || item.senderName.slice(0, 2).toUpperCase());
            const avatarIsImage = isHttpUrl(avatarValue);
            const parsedId = Number(item.id);
            return {
                id: Number.isFinite(parsedId) ? parsedId : Date.parse(item.createdAt) + index,
                user: isMe ? (userName || 'You') : item.senderName,
                avatar: avatarValue,
                isAvatarImage: avatarIsImage,
                time: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                text: item.content || '',
                color: isMe ? 'bg-indigo-600' : 'bg-orange-600',
                isMe,
                isEdited: item.isEdited,
                reactions: item.reactions || [],
                createdAt: item.createdAt
            } as ChatMessage;
        });
    };

    const loadDirectMessagesForChat = async (chatId: string) => {
        if (!chatId) return;
        try {
            const [messages, starredIds, typers, blockStates] = await Promise.all([
                listDirectMessages(chatId),
                listStarredMessageIds('direct', chatId),
                listTypingPresence('direct', chatId),
                listChatMessageBlockStates('direct', chatId)
            ]);
            const chatKey = `dm-${chatId}`;
            const mapped = mapDirectMessagesToChatMessages(chatId, messages);
            const prevMessages = teamChatsRef.current[chatKey] || [];
            const prevIds = new Set(prevMessages.map(msg => msg.id));
            const preservedLocal = prevMessages.filter(msg => !mapped.some(item => item.id === msg.id) && (msg.isPrivate || msg.user === 'Natural AI'));
            const merged = [...mapped, ...preservedLocal].sort((a, b) => {
                const aTs = Date.parse(a.createdAt || '') || a.id;
                const bTs = Date.parse(b.createdAt || '') || b.id;
                return aTs - bTs;
            });
            const hasMention = mapped.some(msg => !prevIds.has(msg.id) && !msg.isMe && messageMentionsCurrentUser(msg.text));
            const hasKeyword = mapped.some(msg => !prevIds.has(msg.id) && !msg.isMe && messageMatchesAlertKeywords(msg.text));
            if (hasMention && canScopePlaySound('direct', chatId, true)) playNotificationSound();
            if (hasKeyword && canScopePlaySound('direct', chatId, false)) playNotificationSound();
            setTeamChats(prev => ({ ...prev, [chatKey]: merged }));
            setStarredMessagesByChat(prev => ({ ...prev, [chatKey]: starredIds }));
            setChatBlockStateByMessage(prev => {
                const merged: Record<number, any> = { ...prev };
                const serverIds = new Set<number>();
                for (const row of blockStates) {
                    const msgId = Number(row.messageId);
                    if (!Number.isFinite(msgId)) continue;
                    serverIds.add(msgId);
                    const optimisticUntil = blockOptimisticUntilRef.current[msgId] || 0;
                    if (optimisticUntil > Date.now()) continue;
                    merged[msgId] = {
                        state: row.state || {},
                        __saved: Boolean(row.isSaved),
                        __expiresAt: row.expiresAt || null
                    };
                }
                Object.keys(merged).forEach((key) => {
                    const msgId = Number(key);
                    if (!Number.isFinite(msgId) || serverIds.has(msgId)) return;
                    const optimisticUntil = blockOptimisticUntilRef.current[msgId] || 0;
                    if (optimisticUntil > Date.now()) return;
                    delete merged[msgId];
                });
                return merged;
            });
            if (activeTeamChatId === chatKey) setTypingMembers(typers);
            await markDirectChatSeen(chatId);
            const seenStatus = await getDirectChatSeenStatus(chatId);
            setDirectSeenByChat(prev => ({ ...prev, [chatKey]: seenStatus.otherLastSeenAt }));
        } catch (error) {
            console.error('Failed to load direct messages:', error);
        }
    };

    const loadGroupMessagesForChat = async (groupId: string) => {
        if (!groupId) return;
        try {
            const [messages, starredIds, typers, blockStates] = await Promise.all([
                listGroupMessages(groupId),
                listStarredMessageIds('group', groupId),
                listTypingPresence('group', groupId),
                listChatMessageBlockStates('group', groupId)
            ]);
            const chatKey = `gc-${groupId}`;
            const mapped = mapGroupMessagesToChatMessages(messages);
            const prevMessages = teamChatsRef.current[chatKey] || [];
            const prevIds = new Set(prevMessages.map(msg => msg.id));
            const preservedLocal = prevMessages.filter(msg => !mapped.some(item => item.id === msg.id) && (msg.isPrivate || msg.user === 'Natural AI'));
            const merged = [...mapped, ...preservedLocal].sort((a, b) => {
                const aTs = Date.parse(a.createdAt || '') || a.id;
                const bTs = Date.parse(b.createdAt || '') || b.id;
                return aTs - bTs;
            });
            const hasMention = mapped.some(msg => !prevIds.has(msg.id) && !msg.isMe && messageMentionsCurrentUser(msg.text));
            const hasKeyword = mapped.some(msg => !prevIds.has(msg.id) && !msg.isMe && messageMatchesAlertKeywords(msg.text));
            if (hasMention && canScopePlaySound('group', groupId, true)) playNotificationSound();
            if (hasKeyword && canScopePlaySound('group', groupId, false)) playNotificationSound();
            setTeamChats(prev => ({ ...prev, [chatKey]: merged }));
            setStarredMessagesByChat(prev => ({ ...prev, [chatKey]: starredIds }));
            setChatBlockStateByMessage(prev => {
                const merged: Record<number, any> = { ...prev };
                const serverIds = new Set<number>();
                for (const row of blockStates) {
                    const msgId = Number(row.messageId);
                    if (!Number.isFinite(msgId)) continue;
                    serverIds.add(msgId);
                    const optimisticUntil = blockOptimisticUntilRef.current[msgId] || 0;
                    if (optimisticUntil > Date.now()) continue;
                    merged[msgId] = {
                        state: row.state || {},
                        __saved: Boolean(row.isSaved),
                        __expiresAt: row.expiresAt || null
                    };
                }
                Object.keys(merged).forEach((key) => {
                    const msgId = Number(key);
                    if (!Number.isFinite(msgId) || serverIds.has(msgId)) return;
                    const optimisticUntil = blockOptimisticUntilRef.current[msgId] || 0;
                    if (optimisticUntil > Date.now()) return;
                    delete merged[msgId];
                });
                return merged;
            });
            if (activeTeamChatId === chatKey) setTypingMembers(typers);
        } catch (error) {
            console.error('Failed to load group messages:', error);
        }
    };

    const getDirectChatIdFromActive = () => {
        if (!activeTeamChatId?.startsWith('dm-')) return null;
        return activeTeamChatId.replace('dm-', '');
    };

    const getActiveChatScope = () => {
        if (!activeTeamChatId) return null;
        if (activeTeamChatId.startsWith('dm-')) return { chatKind: 'direct' as const, chatId: activeTeamChatId.replace('dm-', '') };
        if (activeTeamChatId.startsWith('gc-')) return { chatKind: 'group' as const, chatId: activeTeamChatId.replace('gc-', '') };
        if (activeTeamChatId.startsWith('team-')) return { chatKind: 'channel' as const, chatId: activeTeamChatId };
        return null;
    };

    const getActiveTypingScope = () => {
        if (!activeTeamChatId) return null;
        if (activeTeamChatId.startsWith('dm-')) return { chatKind: 'direct' as const, chatId: activeTeamChatId.replace('dm-', '') };
        if (activeTeamChatId.startsWith('gc-')) return { chatKind: 'group' as const, chatId: activeTeamChatId.replace('gc-', '') };
        return null;
    };

    const publishTypingState = async (typing: boolean) => {
        const scope = getActiveTypingScope();
        if (!scope || isPrivateAiMode || isActiveDirectBlocked) return;
        try {
            if (!typing) {
                await setTypingPresence(scope.chatKind, scope.chatId, null);
                return;
            }
            const avatarValue = isHttpUrl(userAvatar) ? userAvatar : (userAvatar || (userName || 'You').slice(0, 2).toUpperCase());
            await setTypingPresence(scope.chatKind, scope.chatId, {
                name: userName || 'You',
                avatar: avatarValue,
                isAvatarImage: isHttpUrl(avatarValue)
            });
        } catch (error) {
            console.error('Failed typing presence update', error);
        }
    };

    const loadActiveChatSettings = async () => {
        const scope = getActiveChatScope();
        if (!scope) {
            setActiveChatSettings(null);
            return;
        }
        try {
            const settings = await getChatUserSettings(scope.chatKind, scope.chatId);
            setActiveChatSettings(settings);
            setSettingsNicknameInput(settings.nickname || '');
            if (scope.chatKind === 'group') {
                const gc = groupChats.find(group => group.id === scope.chatId);
                setGroupAvatarInput(gc?.avatar || '');
            }
        } catch (error) {
            console.error('Failed to load chat settings:', error);
        }
    };

    const patchActiveChatSettings = async (patch: Partial<Omit<ChatUserSettings, 'chatKind' | 'chatId'>>) => {
        const scope = getActiveChatScope();
        if (!scope) return;
        try {
            const next = await upsertChatUserSettings(scope.chatKind, scope.chatId, patch);
            setActiveChatSettings(next);
            if (scope.chatKind === 'direct') {
                setDirectChatSettingsMap(prev => ({ ...prev, [scope.chatId]: next }));
            } else if (scope.chatKind === 'group') {
                setGroupChatSettingsMap(prev => ({ ...prev, [scope.chatId]: next }));
            }
        } catch (error: any) {
            alert(error?.message || 'Failed to update chat settings.');
        }
    };

    const getExtraBool = (key: string, fallback: boolean) => {
        const value = activeChatSettings?.extras?.[key];
        return typeof value === 'boolean' ? value : fallback;
    };

    const getExtraString = (key: string, fallback = '') => {
        const value = activeChatSettings?.extras?.[key];
        return typeof value === 'string' ? value : fallback;
    };

    const isFutureIso = (value?: string | null) => Boolean(value && Date.parse(value) > Date.now());

    const getChatSettingsForScope = (chatKind: 'direct' | 'group', chatId: string) => {
        if (chatKind === 'direct') {
            if (activeTeamChatId === `dm-${chatId}` && activeChatSettings) return activeChatSettings;
            return directChatSettingsMap[chatId] || null;
        }
        if (activeTeamChatId === `gc-${chatId}` && activeChatSettings) return activeChatSettings;
        return groupChatSettingsMap[chatId] || null;
    };

    const isScopeMuted = (chatKind: 'direct' | 'group', chatId: string) => {
        const settings = getChatSettingsForScope(chatKind, chatId);
        return isFutureIso(settings?.mutedUntil);
    };

    const isScopeNotificationsEnabled = (chatKind: 'direct' | 'group', chatId: string) => {
        const settings = getChatSettingsForScope(chatKind, chatId);
        return settings?.notificationsEnabled ?? true;
    };

    const canScopePlaySound = (chatKind: 'direct' | 'group', chatId: string, requireMentionPermission = false) => {
        const settings = getChatSettingsForScope(chatKind, chatId);
        if (isFutureIso(settings?.mutedUntil)) return false;
        if ((settings?.soundsEnabled ?? true) === false) return false;
        if (requireMentionPermission && (settings?.mentionNotifications ?? true) === false) return false;
        return true;
    };

    const patchActiveExtra = async (key: string, value: any) => {
        const nextExtras = { ...(activeChatSettings?.extras || {}), [key]: value };
        await patchActiveChatSettings({ extras: nextExtras });
    };

    const toggleActiveMute = async () => {
        await patchActiveChatSettings({
            mutedUntil: isChatMuted ? null : new Date(Date.now() + 60 * 60 * 1000).toISOString()
        });
    };

    const saveActiveGroupAvatarUrl = async () => {
        const scope = getActiveChatScope();
        if (!scope || scope.chatKind !== 'group') return;
        if (!groupAvatarInput.trim()) return;
        try {
            await updateGroupChatAvatar(scope.chatId, groupAvatarInput.trim());
            const groups = await listGroupChats();
            setGroupChats(groups);
        } catch (error: any) {
            alert(error?.message || 'Failed to update group avatar.');
        }
    };

    const handleGroupAvatarFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const scope = getActiveChatScope();
        if (!scope || scope.chatKind !== 'group') return;
        try {
            const url = await uploadGroupChatAvatar(scope.chatId, file);
            setGroupAvatarInput(url);
            const groups = await listGroupChats();
            setGroupChats(groups);
        } catch (error: any) {
            alert(error?.message || 'Failed to upload group avatar.');
        } finally {
            if (groupAvatarFileRef.current) groupAvatarFileRef.current.value = '';
            if (groupAvatarRailFileRef.current) groupAvatarRailFileRef.current.value = '';
        }
    };

    const formatMessageTime = (message: ChatMessage) => {
        if (!message.createdAt) return message.time;
        const use24h = getExtraBool('use24HourTime', false);
        return new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !use24h });
    };

    const handleCreateDirectChat = async () => {
        const email = directChatEmailInput.trim().toLowerCase();
        if (!email) return;
        try {
            setIsCreatingDirectChat(true);
            const chat = await createOrGetDirectChatByEmail(email);
            setDirectChatEmailInput('');
            await loadDirectChats();
            selectDM(chat.chatId);
            setShowNewChatModal(false);
        } catch (error: any) {
            alert(error?.message || 'Failed to create direct chat.');
        } finally {
            setIsCreatingDirectChat(false);
        }
    };

    const handleSendChatRequest = () => {
        const email = directChatEmailInput.trim().toLowerCase();
        if (!email) return;
        void (async () => {
            try {
                await createChatRequestByEmail(email, newChatMode === 'group' ? 'group' : 'direct', groupChatNameInput.trim() || undefined);
                setDirectChatEmailInput('');
                const requests = await listIncomingChatRequests();
                setPendingChatRequests(requests);
            } catch (error: any) {
                alert(error?.message || 'Failed to send chat request.');
            }
        })();
    };

    const handleAcceptChatRequest = async (requestId: string) => {
        const request = pendingChatRequests.find(req => req.id === requestId);
        try {
            await respondToChatRequest(requestId, 'accepted');
            const [requests, chats, groups] = await Promise.all([
                listIncomingChatRequests(),
                listDirectChats(),
                listGroupChats()
            ]);
            setPendingChatRequests(requests);
            setDirectChats(chats);
            setGroupChats(groups);
            const accepted = request ? chats.find(chat => chat.otherEmail === request.email) : null;
            if (accepted) selectDM(accepted.chatId);
            setShowNewChatModal(false);
        } catch (error: any) {
            alert(error?.message || 'Failed to accept chat request.');
        }
    };

    const handleDeclineChatRequest = (requestId: string) => {
        void (async () => {
            try {
                await respondToChatRequest(requestId, 'declined');
                const requests = await listIncomingChatRequests();
                setPendingChatRequests(requests);
            } catch (error: any) {
                alert(error?.message || 'Failed to decline request.');
            }
        })();
    };

    const handleCreateGroupChat = () => {
        const name = groupChatNameInput.trim();
        if (!name) return;
        const members = groupChatMembersInput
            .split(',')
            .map(value => value.trim().toLowerCase())
            .filter(Boolean);
        void (async () => {
            try {
                const created = await createGroupChatRecord(name, members);
                if (selectedGroupMemberUserIds.length > 0) {
                    await addGroupChatMembers(created.id, selectedGroupMemberUserIds);
                }
                setGroupChats(prev => [created, ...prev.filter(group => group.id !== created.id)]);
                setTeamChats(prev => ({ ...prev, [`gc-${created.id}`]: prev[`gc-${created.id}`] || [] }));
                setGroupChatNameInput('');
                setGroupChatMembersInput('');
                setSelectedGroupMemberUserIds([]);
                setShowNewChatModal(false);
                setActiveTeamChatId(`gc-${created.id}`);
                setActiveTeamTab('chat');
            } catch (error: any) {
                alert(error?.message || 'Failed to create group chat.');
            }
        })();
    };

    const handleCreateChannelFromModal = () => {
        const channel = newChannelNameInput.trim();
        if (!channel) return;
        if (!teams.length) {
            setShowCreateTeamModal(true);
            return;
        }
        const targetTeam = teams[0];
        const channelId = `team-${targetTeam.id}-${channel}`;
        setTeamChats(prev => ({ ...prev, [channelId]: prev[channelId] || [] }));
        setNewChannelNameInput('');
        setShowNewChatModal(false);
        setActiveTeamChatId(channelId);
        setActiveTeamTab('chat');
    };

    const selectGroupChat = (groupId: string) => {
        const id = `gc-${groupId}`;
        setActiveTeamChatId(id);
        setActiveTeamTab('chat');
        setIsChatSettingsOpen(false);
        if (!teamChats[id]) {
            setTeamChats(prev => ({ ...prev, [id]: [] }));
        }
        void loadGroupMessagesForChat(groupId);
    };

    const toggleBlockActiveUser = () => {
        const directChatId = getDirectChatIdFromActive();
        if (!directChatId) return;
        const dm = directChats.find(entry => entry.chatId === directChatId);
        if (!dm) return;
        const willBlock = !blockedUserIds.includes(dm.otherUserId);
        void (async () => {
            try {
                if (willBlock) await blockUser(dm.otherUserId);
                else await unblockUser(dm.otherUserId);
                const blocked = await listBlockedUsers();
                setBlockedUserIds(blocked);
                setIsChatSettingsOpen(false);
            } catch (error: any) {
                alert(error?.message || 'Failed to update block list.');
            }
        })();
    };

    const openChatSettingsPanel = () => {
        setIsChatSettingsOpen(false);
        setChatSettingsTab('overview');
        void loadActiveChatSettings();
        setShowAdvancedChatSettings(false);
        setShowTeamDetailsRail(true);
    };

    const handleArchiveActiveChat = async (archived: boolean) => {
        const scope = getActiveChatScope();
        if (!scope) return;
        try {
            await setChatArchived(scope.chatKind, scope.chatId, archived);
            if (scope.chatKind === 'direct') {
                const archivedIds = await listArchivedChatIds('direct');
                setArchivedDirectChatIds(archivedIds);
            }
            if (archived) {
                setActiveTeamChatId(null);
            }
        } catch (error: any) {
            alert(error?.message || 'Failed to update archive state.');
        }
    };

    const handleClearChatForMe = () => {
        if (!activeTeamChatId) return;
        const target = teamChats[activeTeamChatId] || [];
        target.forEach(msg => hideMessageForCurrentUser(activeTeamChatId, msg.id));
    };

    const jumpToSearchResult = (direction: 'next' | 'prev') => {
        if (!chatSearchResultIds.length) return;
        const delta = direction === 'next' ? 1 : -1;
        const nextIndex = (chatSearchIndex + delta + chatSearchResultIds.length) % chatSearchResultIds.length;
        setChatSearchIndex(nextIndex);
        scrollToMessage(chatSearchResultIds[nextIndex]);
    };

    const exportActiveChat = (format: 'json' | 'txt') => {
        if (!activeTeamChatId) return;
        const payload = currentTeamMessages.map(msg => ({
            id: msg.id,
            user: msg.user,
            text: stripHtmlTags(msg.text),
            createdAt: msg.createdAt || msg.time
        }));
        const content = format === 'json'
            ? JSON.stringify(payload, null, 2)
            : payload.map(row => `[${row.createdAt}] ${row.user}: ${row.text}`).join('\n');
        const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${activeTeamChatId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const openChatContextMenu = (
        e: React.MouseEvent,
        payload: { kind: 'direct' | 'group'; chatId: string; otherUserId?: string }
    ) => {
        e.preventDefault();
        setChatContextMenu({
            x: e.clientX,
            y: e.clientY,
            ...payload
        });
    };

    const handleContextTogglePin = async () => {
        if (!chatContextMenu) return;
        const currentPinned = chatContextMenu.kind === 'direct'
            ? Boolean(directChatSettingsMap[chatContextMenu.chatId]?.pinned)
            : Boolean(groupChatSettingsMap[chatContextMenu.chatId]?.pinned);
        try {
            const next = await upsertChatUserSettings(chatContextMenu.kind, chatContextMenu.chatId, { pinned: !currentPinned });
            if (chatContextMenu.kind === 'direct') {
                setDirectChatSettingsMap(prev => ({ ...prev, [chatContextMenu.chatId]: next }));
            } else {
                setGroupChatSettingsMap(prev => ({ ...prev, [chatContextMenu.chatId]: next }));
            }
        } catch (error: any) {
            alert(error?.message || 'Failed to update pin.');
        } finally {
            setChatContextMenu(null);
        }
    };

    const handleContextMuteHour = async () => {
        if (!chatContextMenu) return;
        const next = await upsertChatUserSettings(chatContextMenu.kind, chatContextMenu.chatId, { mutedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
        if (chatContextMenu.kind === 'direct') {
            setDirectChatSettingsMap(prev => ({ ...prev, [chatContextMenu.chatId]: next }));
        } else {
            setGroupChatSettingsMap(prev => ({ ...prev, [chatContextMenu.chatId]: next }));
        }
        setChatContextMenu(null);
    };

    const handleContextArchiveToggle = async () => {
        if (!chatContextMenu) return;
        const isArchived = chatContextMenu.kind === 'direct' && archivedDirectChatIds.includes(chatContextMenu.chatId);
        await setChatArchived(chatContextMenu.kind, chatContextMenu.chatId, !isArchived);
        if (chatContextMenu.kind === 'direct') {
            const archived = await listArchivedChatIds('direct');
            setArchivedDirectChatIds(archived);
        }
        setChatContextMenu(null);
    };

    const handleContextBlockToggle = async () => {
        if (!chatContextMenu?.otherUserId) return;
        const isBlocked = blockedUserIds.includes(chatContextMenu.otherUserId);
        if (isBlocked) await unblockUser(chatContextMenu.otherUserId);
        else await blockUser(chatContextMenu.otherUserId);
        const blocked = await listBlockedUsers();
        setBlockedUserIds(blocked);
        setChatContextMenu(null);
    };

    const openAddMembersFromContext = () => {
        if (!chatContextMenu || chatContextMenu.kind !== 'group') return;
        setTargetGroupIdForMembers(chatContextMenu.chatId);
        setAddMembersSelection([]);
        setShowAddMembersModal(true);
        setChatContextMenu(null);
    };

    const handleConfirmAddMembers = async () => {
        if (!targetGroupIdForMembers || addMembersSelection.length === 0) {
            setShowAddMembersModal(false);
            return;
        }
        try {
            await addGroupChatMembers(targetGroupIdForMembers, addMembersSelection);
            await loadGroupMessagesForChat(targetGroupIdForMembers);
        } catch (error: any) {
            alert(error?.message || 'Failed to add members.');
        } finally {
            setShowAddMembersModal(false);
            setTargetGroupIdForMembers(null);
            setAddMembersSelection([]);
        }
    };

    // --- Helpers for Chat/Team Selection ---
    const toggleTeam = (teamId: string) => {
        const newExpanded = new Set(expandedTeamIds);
        if (newExpanded.has(teamId)) newExpanded.delete(teamId);
        else newExpanded.add(teamId);
        setExpandedTeamIds(newExpanded);
    };

    const selectChannel = (teamId: string, channelName: string) => {
        const id = `team-${teamId}-${channelName}`;
        setActiveTeamChatId(id);
        setActiveTeamTab('chat');
        setIsChatSettingsOpen(false);
        if (!teamChats[id]) {
            setTeamChats(prev => ({ ...prev, [id]: [] })); // Init empty if new
        }
    };

    const selectDM = (chatId: string) => {
        const id = `dm-${chatId}`;
        setActiveTeamChatId(id);
        setActiveTeamTab('chat');
        setIsChatSettingsOpen(false);
        if (!teamChats[id]) {
            setTeamChats(prev => ({ ...prev, [id]: [] })); // Init empty if new
        }
        void loadDirectMessagesForChat(chatId);
    };

    const openChatFromPopup = (popup: ChatPopupNotification) => {
        setCurrentView('team');
        setActiveTeamTab('chat');
        if (popup.chatKind === 'direct') {
            const id = `dm-${popup.chatId}`;
            setActiveTeamChatId(id);
            if (!teamChats[id]) setTeamChats(prev => ({ ...prev, [id]: [] }));
            void loadDirectMessagesForChat(popup.chatId);
        } else {
            const id = `gc-${popup.chatId}`;
            setActiveTeamChatId(id);
            if (!teamChats[id]) setTeamChats(prev => ({ ...prev, [id]: [] }));
            void loadGroupMessagesForChat(popup.chatId);
        }
        dismissChatPopup(popup.id);
    };

    const sendReplyFromPopup = async (popup: ChatPopupNotification) => {
        const reply = popup.replyText.trim();
        if (!reply) return;
        try {
            if (popup.chatKind === 'direct') {
                await sendDirectMessage(popup.chatId, reply);
                await loadDirectMessagesForChat(popup.chatId);
            } else {
                await sendGroupMessage(popup.chatId, reply);
                await loadGroupMessagesForChat(popup.chatId);
            }
            dismissChatPopup(popup.id);
        } catch (error: any) {
            alert(error?.message || 'Failed to send quick reply.');
        }
    };

    useEffect(() => {
        if (!currentUserId) return;
        void loadDirectChats();
        void (async () => {
            try {
                const archived = await listArchivedChatIds('direct');
                setArchivedDirectChatIds(archived);
            } catch (error) {
                console.error('Failed to load archived chats:', error);
            }
        })();
        const intervalId = window.setInterval(() => {
            void loadDirectChats();
        }, 45000);
        return () => window.clearInterval(intervalId);
    }, [currentUserId]);

    useEffect(() => {
        void loadActiveChatSettings();
    }, [activeTeamChatId]);

    useEffect(() => {
        if (!activeTeamChatId || !editorRef.current) return;
        const draft = chatDrafts[activeTeamChatId] || '';
        editorRef.current.innerHTML = draft;
        setTeamChatInput(draft);
        setChatSendError(null);
    }, [activeTeamChatId]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(`${TEAM_CHAT_DRAFTS_KEY}.${currentUserId || 'guest'}`);
            if (raw) {
                const parsed = JSON.parse(raw) as Record<string, string>;
                setChatDrafts(parsed || {});
            }
        } catch { }
    }, [currentUserId]);

    useEffect(() => {
        try {
            localStorage.setItem(`${TEAM_CHAT_DRAFTS_KEY}.${currentUserId || 'guest'}`, JSON.stringify(chatDrafts));
        } catch { }
    }, [chatDrafts, currentUserId]);

    useEffect(() => {
        const onDocClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('.message-details-menu') || target.closest('.message-details-trigger')) return;
            setOpenMessageDetailsFor(null);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    useEffect(() => {
        if (!activeTeamChatId) return;
        setTypingMembers([]);
        if (activeTeamChatId.startsWith('dm-')) {
            const directChatId = activeTeamChatId.replace('dm-', '');
            void loadDirectMessagesForChat(directChatId);
        } else if (activeTeamChatId.startsWith('gc-')) {
            const groupId = activeTeamChatId.replace('gc-', '');
            void loadGroupMessagesForChat(groupId);
        }
    }, [activeTeamChatId, currentUserId]);

    useEffect(() => {
        chatRealtimeUnsubscribeRef.current?.();
        chatRealtimeUnsubscribeRef.current = null;
        if (chatRealtimeReloadTimerRef.current) {
            window.clearTimeout(chatRealtimeReloadTimerRef.current);
            chatRealtimeReloadTimerRef.current = null;
        }
        if (!activeTeamChatId || !currentUserId) return;
        if (!activeTeamChatId.startsWith('dm-') && !activeTeamChatId.startsWith('gc-')) return;

        const scheduleReload = () => {
            if (chatRealtimeReloadTimerRef.current) window.clearTimeout(chatRealtimeReloadTimerRef.current);
            chatRealtimeReloadTimerRef.current = window.setTimeout(() => {
                if (!activeTeamChatId) return;
                if (activeTeamChatId.startsWith('dm-')) {
                    void loadDirectMessagesForChat(activeTeamChatId.replace('dm-', ''));
                    return;
                }
                if (activeTeamChatId.startsWith('gc-')) {
                    void loadGroupMessagesForChat(activeTeamChatId.replace('gc-', ''));
                }
            }, 100);
        };

        const specs: SupabaseRealtimeChangeSpec[] = activeTeamChatId.startsWith('dm-')
            ? [
                { schema: 'public', table: 'direct_messages', event: '*', filter: `chat_id=eq.${activeTeamChatId.replace('dm-', '')}` },
                { schema: 'public', table: 'direct_message_reactions', event: '*' },
                { schema: 'public', table: 'direct_message_attachments', event: '*' },
                { schema: 'public', table: 'chat_message_blocks', event: '*', filter: `chat_id=eq.${activeTeamChatId.replace('dm-', '')}` },
                { schema: 'public', table: 'direct_chat_reads', event: '*', filter: `chat_id=eq.${activeTeamChatId.replace('dm-', '')}` },
                { schema: 'public', table: 'chat_typing_presence', event: '*', filter: `chat_id=eq.${activeTeamChatId.replace('dm-', '')}` }
            ]
            : [
                { schema: 'public', table: 'group_messages', event: '*', filter: `group_chat_id=eq.${activeTeamChatId.replace('gc-', '')}` },
                { schema: 'public', table: 'group_message_reactions', event: '*' },
                { schema: 'public', table: 'chat_message_blocks', event: '*', filter: `chat_id=eq.${activeTeamChatId.replace('gc-', '')}` },
                { schema: 'public', table: 'chat_typing_presence', event: '*', filter: `chat_id=eq.${activeTeamChatId.replace('gc-', '')}` }
            ];

        void (async () => {
            try {
                const unsubscribe = await subscribeToSupabaseChanges(specs, (event) => {
                    if (event.table === 'chat_typing_presence' && event.newRecord?.user_id === currentUserId) return;
                    scheduleReload();
                });
                chatRealtimeUnsubscribeRef.current = unsubscribe;
            } catch (error) {
                console.error('Failed to start chat realtime:', error);
            }
        })();

        return () => {
            if (chatRealtimeReloadTimerRef.current) {
                window.clearTimeout(chatRealtimeReloadTimerRef.current);
                chatRealtimeReloadTimerRef.current = null;
            }
            chatRealtimeUnsubscribeRef.current?.();
            chatRealtimeUnsubscribeRef.current = null;
        };
    }, [activeTeamChatId, currentUserId]);

    useEffect(() => {
        if (!activeTeamChatId) return;
        if (!activeTeamChatId.startsWith('dm-') && !activeTeamChatId.startsWith('gc-')) return;
        const fallbackInterval = window.setInterval(() => {
            if (activeTeamChatId.startsWith('dm-')) {
                void loadDirectMessagesForChat(activeTeamChatId.replace('dm-', ''));
                return;
            }
            if (activeTeamChatId.startsWith('gc-')) {
                void loadGroupMessagesForChat(activeTeamChatId.replace('gc-', ''));
            }
        }, 20000);
        return () => window.clearInterval(fallbackInterval);
    }, [activeTeamChatId, currentUserId]);

    useEffect(() => {
        if (typingMembersHideTimerRef.current) {
            window.clearTimeout(typingMembersHideTimerRef.current);
            typingMembersHideTimerRef.current = null;
        }
        if (typingMembers.length > 0) {
            setTypingMembersDisplay(typingMembers);
            setTypingMembersVisible(true);
            return;
        }
        setTypingMembersVisible(false);
        typingMembersHideTimerRef.current = window.setTimeout(() => {
            setTypingMembersDisplay([]);
        }, 220);
    }, [typingMembers]);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
            if (typingMembersHideTimerRef.current) window.clearTimeout(typingMembersHideTimerRef.current);
            void publishTypingState(false);
        };
    }, []);

    useEffect(() => {
        if (!activeTeamChatId) return;
        if (!activeTeamChatId.startsWith('dm-') && !activeTeamChatId.startsWith('gc-')) {
            setHiddenMessagesByChat(prev => ({ ...prev, [activeTeamChatId]: [] }));
            return;
        }
        const kind = activeTeamChatId.startsWith('dm-') ? 'direct' : 'group';
        const chatId = activeTeamChatId.replace(/^dm-|^gc-/, '');
        void (async () => {
            try {
                const hiddenIds = await listHiddenMessageIds(kind, chatId);
                setHiddenMessagesByChat(prev => ({
                    ...prev,
                    [activeTeamChatId]: hiddenIds.map(id => Number(id)).filter(Number.isFinite)
                }));
            } catch (error) {
                console.error('Failed to load hidden messages:', error);
            }
        })();
    }, [activeTeamChatId]);

    // Resolve Active Chat Metadata
    const getActiveChatMeta = () => {
        if (!activeTeamChatId) return null;
        if (activeTeamChatId.startsWith('dm-')) {
            const id = activeTeamChatId.replace('dm-', '');
            const dm = directChats.find(chat => chat.chatId === id);
            if (!dm) return { title: 'Direct Message', subtitle: currentUserEmail || 'DM', avatar: 'DM', color: 'bg-blue-600', isDm: true };
            const dmSettings = directChatSettingsMap[id];
            return {
                title: (dmSettings?.nickname || '').trim() || dm.otherName,
                subtitle: dm.otherEmail || 'Direct Message',
                avatar: dm.otherAvatar,
                avatarIsImage: isHttpUrl(dm.otherAvatar),
                color: 'bg-blue-600',
                isDm: true,
                kind: 'dm' as const
            };
        }
        if (activeTeamChatId.startsWith('gc-')) {
            const id = activeTeamChatId.replace('gc-', '');
            const gc = groupChats.find(group => group.id === id);
            const groupAvatar = gc?.avatar || 'GC';
            const groupAvatarIsImage = isHttpUrl(groupAvatar);
            return gc
                ? { title: gc.name, subtitle: `${gc.memberCount} members`, avatar: groupAvatar, avatarIsImage: groupAvatarIsImage, color: 'bg-orange-600', isDm: false, kind: 'group' as const }
                : { title: 'Group Chat', subtitle: 'Group', avatar: 'GC', color: 'bg-orange-600', isDm: false, kind: 'group' as const };
        }
        if (activeTeamChatId.startsWith('team-')) {
            const [, teamId, channelName] = activeTeamChatId.split('-');
            const team = teams.find(t => t.id === teamId);
            return team ? { title: `# ${channelName}`, subtitle: team.name, avatar: '#', color: 'bg-gray-700', isDm: false, kind: 'channel' as const } : null;
        }
        return null;
    };

    const visibleDirectChats = directChats
        .filter(dm => !archivedDirectChatIds.includes(dm.chatId))
        .sort((a, b) => {
            const aPinned = directChatSettingsMap[a.chatId]?.pinned ? 1 : 0;
            const bPinned = directChatSettingsMap[b.chatId]?.pinned ? 1 : 0;
            return bPinned - aPinned;
        });
    const hiddenIdsForActiveChat = new Set<number>((activeTeamChatId ? hiddenMessagesByChat[activeTeamChatId] : []) || []);
    const activeChat = getActiveChatMeta();
    const displayChatTitle = (activeChatSettings?.nickname || '').trim() || activeChat?.title || '';
    const activeDirectChat = activeTeamChatId?.startsWith('dm-')
        ? directChats.find(dm => dm.chatId === activeTeamChatId.replace('dm-', ''))
        : null;
    const isActiveDirectBlockedByMe = Boolean(activeDirectChat && blockedUserIds.includes(activeDirectChat.otherUserId));
    const isActiveDirectBlockedByOther = Boolean(activeDirectChat && blockedByUserIds.includes(activeDirectChat.otherUserId));
    const isActiveDirectBlocked = isActiveDirectBlockedByMe || isActiveDirectBlockedByOther;
    const isChatMuted = Boolean(activeChatSettings?.mutedUntil && Date.parse(activeChatSettings.mutedUntil) > Date.now());
    const canPlayChatSounds = (activeChatSettings?.soundsEnabled ?? true) && !isChatMuted;
    const canShowReadReceipts = activeChatSettings?.readReceipts ?? true;
    const activeTheme = activeChatSettings?.theme || 'default';
    const themedShellClass = activeTheme === 'midnight'
        ? 'bg-gradient-to-b from-[#070c19] via-[#060a14] to-[#04070f]'
        : activeTheme === 'forest'
            ? 'bg-gradient-to-b from-[#06120d] via-[#08160f] to-[#050d09]'
            : activeTheme === 'sunset'
                ? 'bg-gradient-to-b from-[#1a0f10] via-[#140d12] to-[#0d0b12]'
                : 'bg-[#050505]';
    const themedHeaderClass = activeTheme === 'midnight'
        ? 'bg-[#0d1424]'
        : activeTheme === 'forest'
            ? 'bg-[#0d1a14]'
            : activeTheme === 'sunset'
                ? 'bg-[#1b1216]'
                : 'bg-[#0e1011]';
    const themedInputClass = activeTheme === 'midnight'
        ? 'bg-[#0b1220] border-[#22304a] focus-within:border-[#3b82f6]/60'
        : activeTheme === 'forest'
            ? 'bg-[#0b1812] border-[#294235] focus-within:border-[#22c55e]/50'
            : activeTheme === 'sunset'
                ? 'bg-[#171117] border-[#46323c] focus-within:border-[#fb7185]/50'
                : 'bg-[#0e1011] border-[#333] focus-within:border-[#4f52b2]/50';
  const currentTeamMessages = activeTeamChatId
      ? (teamChats[activeTeamChatId] || []).filter(msg => !hiddenIdsForActiveChat.has(msg.id))
      : [];
  useEffect(() => {
      const prevNow = previousBlockNowTsRef.current;
      const now = blockNowTs;
      if (!canPlayChatSounds) {
          previousBlockNowTsRef.current = now;
          return;
      }
      for (const msg of currentTeamMessages) {
          const block = parseChatBlock(msg.text);
          if (!block || block.kind !== 'timer') continue;
          const envelope = chatBlockStateByMessage[msg.id] || {};
          const state = envelope.state || {};
          const endsAt = Number(state.endsAt ?? block.data.endsAt ?? (block.createdAt + Number(block.data.durationSec || 900) * 1000));
          if (!Number.isFinite(endsAt) || endsAt <= 0) continue;
          if (prevNow < endsAt && now >= endsAt) {
              playTimerBeepSound();
          }
      }
      previousBlockNowTsRef.current = now;
  }, [blockNowTs, currentTeamMessages, chatBlockStateByMessage, canPlayChatSounds]);
  const hasRemoteVideo = Boolean(remoteCallStream && remoteCallStream.getVideoTracks().length > 0);
  const hasLocalVideo = Boolean(localCallStream && localCallStream.getVideoTracks().length > 0);
  const remoteVideoTracks = remoteCallStream?.getVideoTracks() || [];
  const remoteScreenTrack = remoteVideoTracks.find(track => isLikelyScreenTrack(track))
      || (remoteMediaState.isScreenSharing ? remoteVideoTracks[0] : null)
      || null;
  const remoteCameraTrack = remoteVideoTracks.find(track => track.id !== remoteScreenTrack?.id) || (remoteMediaState.isScreenSharing ? null : remoteVideoTracks[0] || null);
  const remoteHasSplitView = Boolean(remoteScreenTrack && remoteCameraTrack);
  const remoteMainTrack = remoteHasSplitView
      ? (remotePrimaryView === 'camera' ? remoteCameraTrack : remoteScreenTrack)
      : (remoteScreenTrack || remoteCameraTrack || null);
  const remotePipTrack = remoteHasSplitView
      ? (remotePrimaryView === 'camera' ? remoteScreenTrack : remoteCameraTrack)
      : null;
  const remoteMainShouldUseTrack = Boolean(remoteMainTrack) && !(remotePrimaryView === 'camera' && !remoteMediaState.isCameraOn);
  const remotePipShouldUseTrack = Boolean(remotePipTrack) && !(remotePrimaryView === 'screen' && !remoteMediaState.isCameraOn);
  const localSpeakingActive = localSpeakingLevel > 0.08;
  const remoteSpeakingActive = remoteSpeakingLevel > 0.08;
    const searchedTeamMessages = chatSearchQuery.trim()
        ? currentTeamMessages.filter(msg => stripHtmlTags(msg.text).toLowerCase().includes(chatSearchQuery.trim().toLowerCase()))
        : currentTeamMessages;
    useEffect(() => {
        if (activeTeamTab !== 'chat') setShowTeamSearch(false);
    }, [activeTeamTab]);
    const starredIdsForActiveChat = new Set<string>((activeTeamChatId ? starredMessagesByChat[activeTeamChatId] : []) || []);
    const directSeenAt = activeTeamChatId ? (directSeenByChat[activeTeamChatId] || null) : null;
    const lastOutgoingMessage = currentTeamMessages
        .filter(msg => msg.isMe)
        .reduce<ChatMessage | null>((latest, msg) => {
            const latestTs = latest ? Date.parse(latest.createdAt || '') || latest.id : -1;
            const msgTs = Date.parse(msg.createdAt || '') || msg.id;
            return msgTs > latestTs ? msg : latest;
        }, null);
    const isLastOutgoingSeen = Boolean(
        activeTeamChatId?.startsWith('dm-') &&
        canShowReadReceipts &&
        directSeenAt &&
        lastOutgoingMessage &&
        (Date.parse(lastOutgoingMessage.createdAt || '') || lastOutgoingMessage.id) <= Date.parse(directSeenAt)
    );
    const chatAssets = currentTeamMessages.flatMap(msg =>
        (msg.attachments || []).map(att => ({
            ...att,
            id: `${msg.id}-${att.url}`,
            messageId: msg.id,
            user: msg.user,
            createdAt: msg.id,
            time: msg.time
        }))
    );
    const filteredChatAssets = chatAssets
        .filter(asset => filesFilter === 'all' || asset.type === filesFilter)
        .sort((a, b) => {
            if (filesSort === 'oldest') return a.createdAt - b.createdAt;
            if (filesSort === 'name') return a.name.localeCompare(b.name);
            return b.createdAt - a.createdAt;
        });
    const pinnedThreads = threads
        .filter(thread => thread.pinned)
        .sort((a, b) => b.lastModified - a.lastModified);
    const recentThreads = threads
        .filter(thread => !thread.pinned)
        .sort((a, b) => b.lastModified - a.lastModified);

    useEffect(() => {
        const ids = searchedTeamMessages.map(msg => msg.id);
        setChatSearchResultIds(ids);
        setChatSearchIndex(0);
    }, [chatSearchQuery, activeTeamChatId, teamChats]);

    if (showIntro) {
        return (
            <div className={`fixed inset-0 z-[100] bg-[#0e1011] flex items-center justify-center transition-opacity duration-700 ${introFading ? 'opacity-0' : 'opacity-100'}`}>
                <img src="https://image2url.com/r2/default/images/1770704490590-af63d05f-5fbb-4c0f-98a3-b54623647393.png" alt="Natural AI" className="w-[300px] h-[300px] object-contain animate-in zoom-in-90 fade-in duration-1000" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#0e1011] text-[#e6edf3] font-sans overflow-hidden animate-in fade-in duration-300 relative">
            <style>{`
        @keyframes msgFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes highlight {
            0% { background-color: rgba(79, 82, 178, 0.3); border-radius: 8px; }
            100% { background-color: transparent; border-radius: 8px; }
        }
        .highlight-message {
            animation: highlight 2s ease-out;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
        }
        .typing-dot {
            animation: bounce 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes blockCardEnter {
            from { opacity: 0; transform: translateY(8px) scale(0.985); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .block-card-enter {
            animation: blockCardEnter 220ms ease-out;
        }
      `}</style>

            {chatPopups.length > 0 && (
                <div className="fixed top-4 right-4 z-[90] w-[360px] max-w-[calc(100vw-1rem)] flex flex-col gap-3 pointer-events-none">
                    {chatPopups.map((popup) => (
                        <div key={popup.id} className="pointer-events-auto rounded-2xl border border-[#2b3035] bg-[#0f1113]/95 backdrop-blur-xl shadow-2xl p-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-start gap-3">
                                {popup.senderAvatarIsImage ? (
                                    <img src={popup.senderAvatar} alt={popup.senderName} className="w-9 h-9 rounded-full object-cover border border-[#2b3035] mt-0.5" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-[#2b3035] text-white text-xs font-bold flex items-center justify-center border border-[#3a3f45] mt-0.5">
                                        {popup.senderAvatar.slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-white truncate">{popup.senderName}</div>
                                        <button
                                            onClick={() => dismissChatPopup(popup.id)}
                                            className="text-[#8d96a0] hover:text-white transition-colors"
                                            title="Dismiss"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="text-[11px] text-[#8d96a0] mt-0.5">
                                        {popup.chatKind === 'group' ? `New message in ${popup.groupName || 'group chat'}` : 'New direct message'}
                                    </div>
                                    <div className="text-sm text-[#d1d5db] mt-2 line-clamp-2 break-words">{popup.text}</div>
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <input
                                    value={popup.replyText}
                                    onChange={(e) => updateChatPopupReply(popup.id, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            void sendReplyFromPopup(popup);
                                        }
                                    }}
                                    placeholder="Reply here..."
                                    className="flex-1 h-9 bg-[#17191c] border border-[#2b3035] rounded-lg px-3 text-sm text-white placeholder-[#6b7280] outline-none focus:border-[#4f52b2]"
                                />
                                <button
                                    onClick={() => void sendReplyFromPopup(popup)}
                                    className="h-9 px-3 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#e5e7eb] transition-colors"
                                >
                                    Reply
                                </button>
                                <button
                                    onClick={() => openChatFromPopup(popup)}
                                    className="h-9 px-3 rounded-lg bg-[#1f2328] border border-[#2b3035] text-[#d1d5db] text-xs font-semibold hover:bg-[#262b31] transition-colors"
                                >
                                    View
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SIDEBAR CONTAINER */}
            <aside className={`relative border-r border-[#2b3035] bg-[#0e1011] shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 border-none'}`}>
                {/* ... (Sidebar panels omitted for brevity, unchanged) ... */}
                {/* PANEL 1: MAIN NAVIGATION (Default) */}
                <div className={`absolute inset-0 flex flex-col bg-[#0e1011] transition-transform duration-500 ease-in-out z-10 ${(showHistorySidebar || showTeamsSidebar) ? '-translate-x-full opacity-50' : 'translate-x-0 opacity-100'}`}>
                    <div className="flex flex-col px-4 pt-6 pb-2">
                        <div className="flex items-center justify-between mb-2">
                            <button className="flex items-center gap-3 w-full hover:bg-[#1c1e21] p-2 -ml-2 rounded-xl transition-all border border-transparent hover:border-[#2b3035] group">
                                {isHttpUrl(userAvatar) ? (
                                    <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-lg object-cover border border-[#2b3035]" />
                                ) : (
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                                        {(userAvatar || userName).slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex flex-col items-start truncate"><span className="text-sm font-bold text-gray-200 group-hover:text-white truncate max-w-[100px]">{userName}'s Team</span><span className="text-[10px] text-gray-500">{userPlan.toUpperCase()} Plan</span></div>
                            </button>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 rounded-lg text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] transition-colors" title="Collapse Sidebar"><SidebarClose className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="px-3 py-2 space-y-2 mt-2">
                        <button onClick={() => setShowCreateModal(true)} className="w-full flex items-center gap-2 bg-[#1c1e21] hover:bg-[#25282c] border border-[#2b3035] text-white text-sm font-medium px-3 py-2 rounded-lg transition-all shadow-sm hover:border-gray-600"><Plus className="w-4 h-4" /> Create App</button>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent hover:border-[#2b3035]"><Download className="w-4 h-4" /> Import</button>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".js,.jsx,.ts,.tsx,.html,.css,.json,.md,.txt,.en" />
                    </div>
                    <nav className="flex-1 px-3 mt-4 space-y-0.5">
                        <button onClick={() => setCurrentView('home')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'home' ? 'bg-[#1c1e21] text-white' : 'text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]'}`}><HomeIcon className="w-4 h-4" /> Home</button>
                        <button onClick={() => setCurrentView('apps')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'apps' ? 'bg-[#1c1e21] text-white' : 'text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]'}`}><LayoutGrid className="w-4 h-4" /> Apps</button>
                        <button onClick={() => { setCurrentView('team'); setShowTeamsSidebar(true); if (!isSidebarOpen) setIsSidebarOpen(true); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'team' ? 'bg-[#1c1e21] text-white' : 'text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]'}`}><Users className="w-4 h-4" /> Team</button>
                        <button onClick={handleAIChatClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'ai-chat' ? 'bg-[#1c1e21] text-white' : 'text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]'}`}><MessageSquare className="w-4 h-4" /> AI Chat</button>
                    </nav>
                    <div className="p-3 space-y-1">
                        <button onClick={() => setCurrentView('learn')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'learn' ? 'bg-[#1c1e21] text-white' : 'text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]'}`}><GraduationCap className="w-4 h-4" /> Learn</button>
                        <button onClick={() => onNavigate('control')} className="w-full flex items-center gap-3 text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] px-3 py-2 rounded-lg text-sm font-medium transition-colors"><Settings className="w-4 h-4" /> Account & Admin</button>
                        <button onClick={() => onNavigate('docs')} className="w-full flex items-center gap-3 text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] px-3 py-2 rounded-lg text-sm font-medium transition-colors"><BookOpen className="w-4 h-4" /> Documentation</button>
                        <button onClick={onLogout} className="w-full flex items-center gap-3 text-[#efb3b3] hover:text-[#ffd4d4] hover:bg-[#1c1e21] px-3 py-2 rounded-lg text-sm font-medium transition-colors"><Trash2 className="w-4 h-4" /> Logout</button>
                        <div className="mt-4 pt-4 border-t border-[#2b3035]">
                            <div className="px-2 mb-2"><span className="text-xs font-semibold text-[#8d96a0]">Your Starter Plan</span></div>
                            <div className="px-2 space-y-2 mb-3">
                                <div className="flex justify-between text-xs text-[#8d96a0]"><div className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Agent credits</div><span>{userUsage ? `${Math.min(100, Math.round((userUsage.aiRequests / Math.max(1, userUsage.aiLimit)) * 100))}% used` : '0% used'}</span></div>
                                <div className="flex justify-between text-xs text-[#8d96a0]"><div className="flex items-center gap-1.5"><Cloud className="w-3 h-3" /> Cloud credits</div><span>0% used</span></div>
                            </div>
                            <button className="w-full flex items-center justify-center gap-2 bg-[#1c1e21] hover:bg-[#25282c] border border-[#2b3035] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"><Zap className="w-3 h-3 fill-yellow-400 text-yellow-400" /> Upgrade to Core</button>
                        </div>
                    </div>
                </div>

                {/* PANEL 2: CHAT HISTORY */}
                <div className={`absolute inset-0 flex flex-col bg-[#0e1011] transition-transform duration-500 ease-in-out z-20 ${showHistorySidebar ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-50'}`}>
                    <div className="flex flex-col h-full">
                        <div className="h-14 flex items-center justify-between px-4 border-b border-[#2b3035] shrink-0">
                            <button onClick={() => setShowHistorySidebar(false)} className="p-1.5 -ml-2 rounded-lg text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] transition-colors" title="Back to Menu"><PanelLeftClose className="w-5 h-5" /></button>
                            <span className="text-sm font-bold text-white tracking-tight flex items-center gap-2"><History className="w-4 h-4" /> History</span>
                            <button onClick={() => handleNewThread(false)} className="p-1.5 -mr-2 rounded-lg text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] transition-colors" title="New Thread"><Edit2 className="w-4 h-4" /></button>
                        </div>
                        <div className="p-3 space-y-2">
                            <button onClick={() => handleNewThread(false)} className="w-full flex items-center gap-3 bg-white text-black hover:bg-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"><MessageSquarePlus className="w-4 h-4" /><span>New Thread</span></button>
                            <button
                                onClick={() => handleNewThread(true)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${isTemporaryChat && !activeThreadId
                                    ? 'bg-[#1f3a2f] border-[#2f6b54] text-[#b5f5d2]'
                                    : 'bg-[#151719] border-[#2b3035] text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]'
                                    }`}
                            >
                                <Lock className="w-4 h-4" />
                                <span>Temporary Chat</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-6">
                            {threads.length === 0 ? (
                                <div className="text-center text-[#8d96a0] text-xs pt-10">No saved history yet</div>
                            ) : (
                                <>
                                    {pinnedThreads.length > 0 && (
                                        <div>
                                            <h4 className="text-[11px] font-bold text-[#666] uppercase tracking-wider mb-2 px-2">Pinned</h4>
                                            <div className="space-y-1">
                                                {pinnedThreads.map((thread) => (
                                                    <div key={thread.id} className={`thread-menu relative w-full px-2 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-1 group/item ${activeThreadId === thread.id ? 'bg-[#1c1e21] text-white' : 'text-[#e3e3e3] hover:bg-[#1c1e21]'}`}>
                                                        {editingThreadId === thread.id ? (
                                                            <form
                                                                onSubmit={(e) => {
                                                                    e.preventDefault();
                                                                    handleSaveRenameThread(thread.id);
                                                                }}
                                                                className="flex-1"
                                                            >
                                                                <input
                                                                    autoFocus
                                                                    value={editingThreadTitle}
                                                                    onChange={(e) => setEditingThreadTitle(e.target.value)}
                                                                    onBlur={() => handleSaveRenameThread(thread.id)}
                                                                    className="w-full bg-[#0f1113] border border-[#2b3035] rounded px-2 py-1 text-xs text-white outline-none focus:border-[#3b82f6]"
                                                                />
                                                            </form>
                                                        ) : (
                                                            <button onClick={() => loadThread(thread)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[13px] text-yellow-400">keep</span>
                                                                <span className="truncate">{thread.title}</span>
                                                            </button>
                                                        )}
                                                        <button onClick={() => setOpenThreadMenuId(openThreadMenuId === thread.id ? null : thread.id)} className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1 rounded hover:bg-[#2b3035] text-[#8d96a0] hover:text-white">
                                                            <MoreVertical className="w-3.5 h-3.5" />
                                                        </button>
                                                        {openThreadMenuId === thread.id && (
                                                            <div className="thread-menu absolute right-0 top-9 z-40 w-40 bg-[#151719] border border-[#2b3035] rounded-lg shadow-xl p-1">
                                                                <button onClick={() => handleStartRenameThread(thread)} className="w-full text-left px-2 py-1.5 text-xs text-[#e3e3e3] hover:bg-[#1c1e21] rounded flex items-center gap-2"><Edit2 className="w-3.5 h-3.5" />Rename</button>
                                                                <button onClick={() => handleTogglePinThread(thread.id)} className="w-full text-left px-2 py-1.5 text-xs text-[#e3e3e3] hover:bg-[#1c1e21] rounded flex items-center gap-2"><span className="material-symbols-outlined text-[14px]">keep_off</span>Unpin</button>
                                                                <button onClick={() => handleShareThread(thread)} className="w-full text-left px-2 py-1.5 text-xs text-[#e3e3e3] hover:bg-[#1c1e21] rounded flex items-center gap-2"><Share className="w-3.5 h-3.5" />Copy Share Link</button>
                                                                <button onClick={() => handleShareThreadToTeam(thread)} className="w-full text-left px-2 py-1.5 text-xs text-[#e3e3e3] hover:bg-[#1c1e21] rounded flex items-center gap-2"><Users className="w-3.5 h-3.5" />Send to Team</button>
                                                                <button onClick={() => handleDeleteThread(thread.id)} className="w-full text-left px-2 py-1.5 text-xs text-red-300 hover:bg-[#1c1e21] rounded flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-[11px] font-bold text-[#666] uppercase tracking-wider mb-2 px-2">Recent</h4>
                                        <div className="space-y-1">
                                            {recentThreads.map((thread) => (
                                                <div key={thread.id} className={`thread-menu relative w-full px-2 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-1 group/item ${activeThreadId === thread.id ? 'bg-[#1c1e21] text-white' : 'text-[#e3e3e3] hover:bg-[#1c1e21]'}`}>
                                                    {editingThreadId === thread.id ? (
                                                        <form
                                                            onSubmit={(e) => {
                                                                e.preventDefault();
                                                                handleSaveRenameThread(thread.id);
                                                            }}
                                                            className="flex-1"
                                                        >
                                                            <input
                                                                autoFocus
                                                                value={editingThreadTitle}
                                                                onChange={(e) => setEditingThreadTitle(e.target.value)}
                                                                onBlur={() => handleSaveRenameThread(thread.id)}
                                                                className="w-full bg-[#0f1113] border border-[#2b3035] rounded px-2 py-1 text-xs text-white outline-none focus:border-[#3b82f6]"
                                                            />
                                                        </form>
                                                    ) : (
                                                        <button onClick={() => loadThread(thread)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                                                            <span className="truncate">{thread.title}</span>
                                                        </button>
                                                    )}
                                                    <button onClick={() => setOpenThreadMenuId(openThreadMenuId === thread.id ? null : thread.id)} className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1 rounded hover:bg-[#2b3035] text-[#8d96a0] hover:text-white">
                                                        <MoreVertical className="w-3.5 h-3.5" />
                                                    </button>
                                                    {openThreadMenuId === thread.id && (
                                                        <div className="thread-menu absolute right-0 top-9 z-40 w-40 bg-[#151719] border border-[#2b3035] rounded-lg shadow-xl p-1">
                                                            <button onClick={() => handleStartRenameThread(thread)} className="w-full text-left px-2 py-1.5 text-xs text-[#e3e3e3] hover:bg-[#1c1e21] rounded flex items-center gap-2"><Edit2 className="w-3.5 h-3.5" />Rename</button>
                                                            <button onClick={() => handleTogglePinThread(thread.id)} className="w-full text-left px-2 py-1.5 text-xs text-[#e3e3e3] hover:bg-[#1c1e21] rounded flex items-center gap-2"><span className="material-symbols-outlined text-[14px]">keep</span>Pin</button>
                                                            <button onClick={() => handleShareThread(thread)} className="w-full text-left px-2 py-1.5 text-xs text-[#e3e3e3] hover:bg-[#1c1e21] rounded flex items-center gap-2"><Share className="w-3.5 h-3.5" />Copy Share Link</button>
                                                            <button onClick={() => handleShareThreadToTeam(thread)} className="w-full text-left px-2 py-1.5 text-xs text-[#e3e3e3] hover:bg-[#1c1e21] rounded flex items-center gap-2"><Users className="w-3.5 h-3.5" />Send to Team</button>
                                                            <button onClick={() => handleDeleteThread(thread.id)} className="w-full text-left px-2 py-1.5 text-xs text-red-300 hover:bg-[#1c1e21] rounded flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* PANEL 3: UNIFIED CHAT SIDEBAR (Teams & DMs) */}
                <div className={`absolute inset-0 flex flex-col bg-[#0e1011] transition-transform duration-500 ease-in-out z-20 ${showTeamsSidebar ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-50'}`}>
                    <div className="flex flex-col h-full">
                        <div className="h-14 flex items-center justify-between px-4 border-b border-[#2b3035] shrink-0">
                            <button onClick={() => setShowTeamsSidebar(false)} className="p-1.5 -ml-2 rounded-lg text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] transition-colors" title="Back to Menu"><PanelLeftClose className="w-5 h-5" /></button>
                            <span className="text-sm font-bold text-white tracking-tight flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Chat</span>
                            <button onClick={() => setShowNewChatModal(true)} className="p-1.5 -mr-2 rounded-lg text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] transition-colors" title="Create"><Plus className="w-4 h-4" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pt-2 px-2">
                            {/* Teams Section */}
                            <div className="mb-5">
                                <div className="px-2 py-2 mb-1 flex justify-between items-center group cursor-pointer" onClick={() => { setNewChatMode('group'); setShowNewChatModal(true); }}>
                                    <span className="text-[10px] font-semibold text-[#8d96a0] uppercase tracking-[0.18em] group-hover:text-white transition-colors">Teams</span>
                                    <Plus className="w-3 h-3 text-[#8d96a0] opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                                <div className="space-y-0.5">
                                    {teams.map(team => (
                                        <div key={team.id}>
                                            <button
                                                onClick={() => toggleTeam(team.id)}
                                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-[#191c21] rounded-lg text-[#e3e3e3] transition-colors group/team"
                                            >
                                                <span className="p-0.5 rounded text-[#8d96a0] group-hover/team:text-white transition-colors">
                                                    {expandedTeamIds.has(team.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                </span>
                                                <div className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white ${team.color}`}>{team.initials}</div>
                                                <span className="truncate text-[13px] font-medium opacity-90 group-hover/team:opacity-100">{team.name}</span>
                                            </button>
                                            {expandedTeamIds.has(team.id) && (
                                                <div className="ml-2.5 pl-2.5 border-l border-[#232831] my-1 space-y-0.5">
                                                    {['General', 'Design', 'Engineering', 'Random'].map(channel => {
                                                        const channelId = `team-${team.id}-${channel}`;
                                                        return (
                                                            <button
                                                                key={channel}
                                                                onClick={() => selectChannel(team.id, channel)}
                                                                className={`w-full text-left px-3 py-1.5 rounded-lg text-[13px] flex items-center gap-2 transition-colors ${activeTeamChatId === channelId ? 'bg-[#191c21] text-white font-medium' : 'text-[#8d96a0] hover:text-white hover:bg-[#191c21]'}`}
                                                            >
                                                                <Hash className="w-3 h-3 opacity-50" /> {channel}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {groupChats.length > 0 && (
                                        <div className="pt-2 mt-2 border-t border-[#232831]">
                                            <div className="px-2 py-1 text-[10px] font-semibold text-[#7f8aa0] uppercase tracking-[0.16em]">Team Rooms</div>
                                            <div className="space-y-0.5 mt-1">
                                                {groupChats.map(group => {
                                                    const id = `gc-${group.id}`;
                                                    const isActive = activeTeamChatId === id;
                                                    return (
                                                        <button
                                                            key={group.id}
                                                            onClick={() => selectGroupChat(group.id)}
                                                            onContextMenu={(e) => openChatContextMenu(e, { kind: 'group', chatId: group.id })}
                                                            className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${isActive ? 'bg-[#22274f] text-white shadow-[inset_0_0_0_1px_rgba(129,140,248,0.35)]' : 'text-[#d5dbe4] hover:bg-[#191c21] hover:text-white'}`}
                                                        >
                                                            {isHttpUrl(group.avatar) ? (
                                                                <img src={group.avatar} alt={group.name} className="w-6 h-6 rounded-md object-cover border border-[#2b3035]" />
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white bg-orange-600">{(group.avatar || 'TM').slice(0, 2).toUpperCase()}</div>
                                                            )}
                                                            <span className={`text-[13px] truncate flex-1 text-left ${isActive ? 'font-medium' : 'opacity-90'}`}>{group.name}</span>
                                                            <span className="text-[10px] text-[#8ea2c7]">{group.memberCount}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* DMs Section */}
                            <div>
                                <div className="px-2 py-2 mb-1 flex justify-between items-center group cursor-pointer" onClick={() => setShowNewChatModal(true)}>
                                    <span className="text-[10px] font-semibold text-[#8d96a0] uppercase tracking-[0.18em] group-hover:text-white transition-colors">Direct Messages</span>
                                    <Plus className="w-3 h-3 text-[#8d96a0] opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                                <div className="space-y-0.5">
                                    {visibleDirectChats.map(dm => {
                                        const dmId = `dm-${dm.chatId}`;
                                        const isActive = activeTeamChatId === dmId;
                                        const isBlocked = blockedUserIds.includes(dm.otherUserId);
                                        const dmLabel = (directChatSettingsMap[dm.chatId]?.nickname || '').trim() || dm.otherName;
                                        return (
                                            <button
                                                key={dm.chatId}
                                                onClick={() => selectDM(dm.chatId)}
                                                onContextMenu={(e) => openChatContextMenu(e, { kind: 'direct', chatId: dm.chatId, otherUserId: dm.otherUserId })}
                                                className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${isActive ? 'bg-[#22274f] text-white shadow-[inset_0_0_0_1px_rgba(129,140,248,0.35)]' : 'text-[#d5dbe4] hover:bg-[#191c21] hover:text-white'}`}
                                            >
                                                <div className="relative">
                                                    {isHttpUrl(dm.otherAvatar) ? (
                                                        <img src={dm.otherAvatar} alt={dm.otherName} className="w-6 h-6 rounded-md object-cover border border-[#2b3035]" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white bg-blue-600">{dm.otherAvatar.slice(0, 2).toUpperCase()}</div>
                                                    )}
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 border-2 border-[#0e1011] rounded-full ${isBlocked ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                                </div>
                                                <span className={`text-[13px] truncate flex-1 text-left ${isActive ? 'font-medium' : 'opacity-90'}`}>{dmLabel}</span>
                                                {isBlocked && <span className="text-[10px] text-red-300">Blocked</span>}
                                            </button>
                                        );
                                    })}
                                    {visibleDirectChats.length === 0 && (
                                        <div className="px-2 py-3 text-xs text-[#8d96a0]">No direct chats yet.</div>
                                    )}
                                </div>
                            </div>

                        </div>
                        <div className="shrink-0 border-t border-[#232831] px-2 py-2 relative">
                            {showTeamSearch && (
                                <div className="absolute bottom-full left-2 right-2 mb-2 z-50 rounded-xl border border-[#2a2f3a] bg-[#101621]/98 p-2 shadow-2xl backdrop-blur-xl">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-[#8d96a0] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <input
                                            value={chatSearchQuery}
                                            onChange={(e) => setChatSearchQuery(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') jumpToSearchResult('next');
                                                if (e.key === 'Escape') setShowTeamSearch(false);
                                            }}
                                            placeholder="Search messages"
                                            className="w-full bg-[#141925] border border-[#273042] rounded-lg pl-8 pr-16 py-2 text-xs text-white outline-none focus:border-[#5f74d9] focus:shadow-[0_0_0_3px_rgba(95,116,217,0.22)] placeholder:text-[#748199]"
                                            autoFocus
                                        />
                                        {chatSearchQuery.trim() && (
                                            <button
                                                onClick={() => setChatSearchQuery('')}
                                                className="absolute right-8 top-1/2 -translate-y-1/2 text-[#8d96a0] hover:text-white"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8d96a0]">
                                            {searchedTeamMessages.length}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowTeamSearch(v => !v)}
                                    className={`flex-1 h-9 rounded-lg border transition-colors flex items-center justify-center gap-2 text-sm ${showTeamSearch ? 'border-[#41557f] bg-[#1b2230] text-white' : 'border-[#2a2f3a] text-[#8d96a0] hover:text-white hover:bg-[#191c21]'}`}
                                    title="Search"
                                >
                                    <Search className="w-4 h-4" />
                                    Search
                                </button>
                                <button
                                    onClick={() => { setChatSettingsTab('overview'); setShowTeamDetailsRail(v => !v); }}
                                    className={`flex-1 h-9 rounded-lg border transition-colors flex items-center justify-center gap-2 text-sm ${showTeamDetailsRail ? 'border-[#41557f] bg-[#1b2230] text-white' : 'border-[#2a2f3a] text-[#8d96a0] hover:text-white hover:bg-[#191c21]'}`}
                                    title="Settings"
                                >
                                    <Settings className="w-4 h-4" />
                                    Settings
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            {/* ... (Header logic unchanged) ... */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#0e1011] relative overflow-y-auto custom-scrollbar">
                {/* Header - Only show if NOT in team view (Team view has its own header) */}
                {!activeTeamChatId && (currentView as string) !== 'team' && (
                    <header className="h-16 flex items-center justify-between px-8 sticky top-0 z-10 bg-[#0e1011]/80 backdrop-blur-sm shrink-0">
                        <div className="flex items-center gap-4">
                            {!isSidebarOpen && (
                                <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-lg text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] transition-colors" title="Open Sidebar"><SidebarOpen className="w-5 h-5" /></button>
                            )}
                            {/* Mobile Toggles */}
                            {!showHistorySidebar && !showTeamsSidebar && currentView === 'ai-chat' && isSidebarOpen && <button className="md:hidden p-2 text-[#8d96a0]" onClick={() => setShowHistorySidebar(true)}><PanelLeft className="w-5 h-5" /></button>}
                            {!showTeamsSidebar && currentView === 'team' && isSidebarOpen && <button className="md:hidden p-2 text-[#8d96a0]" onClick={() => setShowTeamsSidebar(true)}><PanelLeft className="w-5 h-5" /></button>}

                            <div className="w-full max-w-sm relative group hidden sm:block">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8d96a0] group-focus-within:text-white transition-colors" />
                                <input type="text" placeholder="Search" className="w-full bg-transparent border border-transparent group-hover:border-[#2b3035] focus:border-[#2b3035] focus:bg-[#1c1e21] rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-[#8d96a0] outline-none transition-all" />
                            </div>
                        </div>
                        <img src="https://image2url.com/r2/default/images/1770671775593-5b527895-259d-46ef-9a60-d72b5b2dce9c.png" alt="Logo" className="absolute top-0 right-4 w-24 h-24 object-contain mix-blend-screen opacity-90 hover:opacity-100 transition-opacity" />
                    </header>
                )}

                <div className={`flex-1 flex flex-col ${activeTeamChatId ? '' : 'p-6'} h-full`}>

                    {/* VIEW: HOME */}
                    {currentView === 'home' && (
                        <div className="flex flex-col items-center pt-10">
                            <h1 className="text-3xl font-medium text-white mb-8 text-center animate-in slide-in-from-bottom-4 duration-500">Hi {userName}, what do you want to make?</h1>
                            <div className="w-full max-w-2xl bg-[#1c1e21] border border-[#2b3035] rounded-xl shadow-2xl overflow-hidden mb-20 animate-in slide-in-from-bottom-5 duration-700 delay-100">
                                <div className="flex border-b border-[#2b3035]"><button onClick={() => setActiveTab('app')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${activeTab === 'app' ? 'text-white' : 'text-[#8d96a0] hover:text-white'}`}><Box className="w-4 h-4" /> App{activeTab === 'app' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white"></div>}</button><button onClick={() => setActiveTab('design')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${activeTab === 'design' ? 'text-white' : 'text-[#8d96a0] hover:text-white'}`}><PenTool className="w-4 h-4" /> Design{activeTab === 'design' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white"></div>}</button></div>
                                <div className="p-4"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown} placeholder="Describe your idea, use '/' for integrations..." className="w-full h-32 bg-transparent text-white placeholder-[#8d96a0] resize-none outline-none text-base font-light leading-relaxed" autoFocus /></div>
                                <div className="px-4 py-3 border-t border-[#2b3035] flex items-center justify-between bg-[#151719]"><div className="flex items-center gap-3"><button className="flex items-center gap-1 text-xs font-medium text-[#8d96a0] hover:text-white transition-colors bg-[#1c1e21] border border-[#2b3035] px-2 py-1 rounded hover:border-gray-500"><Box className="w-3 h-3" />Build<ChevronDown className="w-3 h-3 ml-1" /></button><button className="text-[#8d96a0] hover:text-white transition-colors p-1 rounded hover:bg-[#2b3035]"><Paperclip className="w-4 h-4" /></button></div><button onClick={handleStart} disabled={!prompt.trim() || isGenerating} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${prompt.trim() && !isGenerating ? 'bg-white text-black hover:bg-gray-200' : 'bg-[#2b3035] text-[#8d96a0] cursor-not-allowed'}`}>{isGenerating ? <><span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>Thinking...</> : <>Start <ArrowRight className="w-3 h-3" /></>}</button></div>
                            </div>
                            <div className="w-full max-w-4xl">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-medium text-white">Your recent Apps</h2>
                                </div>
                                {appProjects.length === 0 ? (
                                    <div className="w-full flex flex-col items-center justify-center py-12 bg-[#1c1e21] border border-[#2b3035] border-dashed rounded-xl">
                                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4"><Plus className="w-8 h-8 text-white/50" /></div>
                                        <h3 className="text-white font-medium mb-2">No projects yet</h3>
                                        <p className="text-[#8d96a0] text-sm mb-6">Start building your next big idea.</p>
                                        <button onClick={() => setShowCreateModal(true)} className="px-5 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors shadow-lg shadow-white/5">Create Your First Project</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {appProjects.slice(0, 4).map((app) => (
                                            <button
                                                key={app.id}
                                                onClick={() => onOpenProject(app.id)}
                                                className="text-left bg-[#1c1e21] border border-[#2b3035] rounded-xl p-4 hover:bg-[#25282c] transition-colors"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white font-medium truncate">{app.title}</span>
                                                    {app.status === 'archived' && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">Archived</span>}
                                                </div>
                                                <div className="text-xs text-[#8d96a0] flex items-center gap-2">
                                                    <span>{app.time}</span>
                                                    <span>•</span>
                                                    <span className="uppercase">{app.type}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VIEW: APPS */}
                    {currentView === 'apps' && (
                        <div className="max-w-6xl mx-auto w-full">
                            <h1 className="text-2xl font-bold mb-6">All Applications</h1>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {visibleApps.map((app) => (
                                    <div key={app.id} onClick={() => onOpenProject(app.id)} className="group bg-[#1c1e21] hover:bg-[#25282c] border border-[#2b3035] rounded-xl p-4 cursor-pointer transition-all hover:border-[#454545] relative flex flex-col h-[180px]">
                                        <div className="flex items-start justify-between mb-auto">
                                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${app.color}`}>
                                                <span className="material-symbols-outlined text-2xl">{app.icon}</span>
                                            </div>
                                            {appProjects.length > 0 && (
                                                <div className="relative project-menu">
                                                    <button
                                                        className="text-[#8d96a0] hover:text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenProjectMenuId(openProjectMenuId === app.id ? null : app.id);
                                                        }}
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                    {openProjectMenuId === app.id && (
                                                        <div className="absolute right-0 mt-1 w-40 rounded-lg border border-[#2b3035] bg-[#111315] shadow-xl z-20">
                                                            <button onClick={(e) => { e.stopPropagation(); onOpenProject(app.id); setOpenProjectMenuId(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-[#1c1e21]">Open</button>
                                                            <button onClick={(e) => { e.stopPropagation(); onDuplicateProject(app.id); setOpenProjectMenuId(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-[#1c1e21]">Duplicate</button>
                                                            <button onClick={(e) => { e.stopPropagation(); const nextName = window.prompt('Rename project', app.title); if (nextName?.trim()) onRenameProject(app.id, nextName.trim()); setOpenProjectMenuId(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-[#1c1e21]">Rename</button>
                                                            <button onClick={(e) => { e.stopPropagation(); onArchiveProject(app.id); setOpenProjectMenuId(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-[#1c1e21]">{app.status === 'archived' ? 'Unarchive' : 'Archive'}</button>
                                                            <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${app.title}"?`)) onDeleteProject(app.id); setOpenProjectMenuId(null); }} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-[#1c1e21]">Delete</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-white mb-1">{app.title}</h3>
                                            <div className="flex items-center gap-2 text-xs text-[#8d96a0] mb-2">
                                                <span>{app.time}</span>
                                                <span>•</span>
                                                <span className="uppercase text-[10px] border border-[#2b3035] px-1 rounded bg-[#0e1011]">{app.type}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-[#8d96a0]">
                                                {app.visibility === 'public' ? <Globe className="w-3 h-3" /> : app.visibility === 'team' ? <Users className="w-3 h-3" /> : <span className="material-symbols-outlined text-[12px]">lock</span>}
                                                <span className="capitalize">{app.visibility}</span>
                                                {app.status === 'archived' && <span className="ml-2 text-amber-300">archived</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div onClick={() => setShowCreateModal(true)} className="bg-[#1c1e21] hover:bg-[#25282c] border border-[#2b3035] border-dashed rounded-xl p-4 cursor-pointer transition-all hover:border-[#454545] flex flex-col items-center justify-center h-[180px] gap-3">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center"><Plus className="w-6 h-6 text-white/50" /></div>
                                    <span className="text-sm font-medium text-[#8d96a0]">Create New App</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW: TEAM */}
                    {currentView === 'team' && (
                        activeChat ? (
                            <div className={`flex flex-1 h-full relative flex-col ${themedShellClass} bg-[radial-gradient(circle_at_top,#111725_0%,#0b0d10_45%,#090b0d_100%)]`}>
                                {/* Chat Header */}
                                <div className={`h-16 border-b border-[#232831] flex items-center justify-between px-6 shrink-0 relative z-20 bg-[#0d1015]/95 backdrop-blur-xl ${themedHeaderClass}`}>
                                    <div className="flex items-center gap-3">
                                        {!isSidebarOpen && (
                                            <button
                                                onClick={() => setIsSidebarOpen(true)}
                                                className="mr-2 text-[#8d96a0] hover:text-white p-1 rounded-lg transition-colors"
                                                title="Open Sidebar"
                                            >
                                                <SidebarOpen className="w-5 h-5" />
                                            </button>
                                        )}
                                        {(activeChat.isDm || activeChat.kind === 'group') ? (
                                            activeChat.avatarIsImage ? (
                                                <img src={activeChat.avatar} alt={displayChatTitle} className="w-8 h-8 rounded-full object-cover border border-[#2b3035]" />
                                            ) : (
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${activeChat.color}`}>{String(activeChat.avatar).slice(0, 2).toUpperCase()}</div>
                                            )
                                        ) : (
                                            <Hash className="w-5 h-5 text-[#8d96a0]" />
                                        )}
                                        <div className="flex flex-col leading-tight">
                                            <span className="font-semibold text-white text-sm tracking-tight">{displayChatTitle}</span>
                                            {activeChat.subtitle && <span className="text-[11px] text-[#8d96a0] mt-0.5">{activeChat.subtitle}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1 mr-2 text-[#8d96a0] rounded-xl border border-[#232831] bg-[#121722]/80 p-1">
                                            <button
                                                onClick={() => void startOutgoingCall('audio')}
                                                disabled={!activeTeamChatId?.startsWith('dm-') || isActiveDirectBlocked || callPhase !== 'idle'}
                                                className={`p-2 rounded-lg transition-colors ${activeTeamChatId?.startsWith('dm-') && !isActiveDirectBlocked && callPhase === 'idle' ? 'hover:text-white hover:bg-[#1e2531]' : 'opacity-40 cursor-not-allowed'}`}
                                                title="Start voice call"
                                            >
                                                <Phone className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => void startOutgoingCall('video')}
                                                disabled={!activeTeamChatId?.startsWith('dm-') || isActiveDirectBlocked || callPhase !== 'idle'}
                                                className={`p-2 rounded-lg transition-colors ${activeTeamChatId?.startsWith('dm-') && !isActiveDirectBlocked && callPhase === 'idle' ? 'hover:text-white hover:bg-[#1e2531]' : 'opacity-40 cursor-not-allowed'}`}
                                                title="Start video call"
                                            >
                                                <Video className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setShowTeamDetailsRail(v => !v)}
                                                className={`p-2 rounded-lg transition-colors ${showTeamDetailsRail ? 'text-white bg-[#1e2531]' : 'hover:text-white hover:bg-[#1e2531]'}`}
                                                title={showTeamDetailsRail ? 'Hide details panel' : 'Show details panel'}
                                            >
                                                <Info className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Tabs */}
                                <div className="flex items-center gap-3 px-6 py-2 border-b border-[#232831] bg-[#0b0f15]/90 backdrop-blur-xl text-sm">
                                    <button onClick={() => setActiveTeamTab('chat')} className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${activeTeamTab === 'chat' ? 'text-white bg-[#1a2030]' : 'text-[#8d96a0] hover:text-white hover:bg-[#141a24]'}`}>Chat</button>
                                    <button onClick={() => setActiveTeamTab('files')} className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${activeTeamTab === 'files' ? 'text-white bg-[#1a2030]' : 'text-[#8d96a0] hover:text-white hover:bg-[#141a24]'}`}>Files ({chatAssets.length})</button>
                                    {activeTeamTab === 'chat' && <div className="ml-auto" />}
                                </div>

                                <>
                                    {showTeamDetailsRail && (
                                        <aside className="hidden xl:flex absolute right-4 top-[92px] bottom-4 w-[336px] z-20 flex-col rounded-2xl border border-[#2a2f3a] bg-[#0a0d12]/96 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-in slide-in-from-right-2 duration-200">
                                            <div className="rounded-2xl border border-[#232a36] bg-[#0d1118] p-4 shrink-0">
                                                <div className="flex items-center justify-end mb-2">
                                                    <button onClick={() => setShowTeamDetailsRail(false)} className="w-7 h-7 rounded-full bg-[#1e232d] text-[#8d96a0] hover:text-white hover:bg-[#293142] transition-colors">
                                                        <X className="w-4 h-4 mx-auto" />
                                                    </button>
                                                </div>
                                                <div className="flex flex-col items-center text-center">
                                                    {activeChat?.avatarIsImage ? (
                                                        <img src={activeChat.avatar} alt={displayChatTitle} className="w-16 h-16 rounded-full object-cover border border-[#2f3747]" />
                                                    ) : (
                                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold ${activeChat?.color || 'bg-blue-600'}`}>
                                                            {String(activeChat?.avatar || 'U').slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="mt-3 text-xl font-semibold text-white tracking-tight">{displayChatTitle}</div>
                                                    <div className="text-xs text-[#8d96a0] mt-1">{activeDirectChat?.otherEmail || activeChat?.subtitle || 'Team chat'}</div>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 mt-4">
                                                    <button onClick={() => void patchActiveChatSettings({ pinned: !(activeChatSettings?.pinned ?? false) })} className="flex flex-col items-center gap-1 rounded-xl border border-[#263042] bg-[#101826] py-2 text-[#c7d2e3] hover:bg-[#182235] transition-colors">
                                                        <Pin className="w-4 h-4" />
                                                        <span className="text-[10px]">{(activeChatSettings?.pinned ?? false) ? 'Pinned' : 'Pin'}</span>
                                                    </button>
                                                    <button onClick={openChatSettingsPanel} className="flex flex-col items-center gap-1 rounded-xl border border-[#263042] bg-[#101826] py-2 text-[#c7d2e3] hover:bg-[#182235] transition-colors">
                                                        <User className="w-4 h-4" />
                                                        <span className="text-[10px]">Profile</span>
                                                    </button>
                                                    <button onClick={() => void toggleActiveMute()} className={`flex flex-col items-center gap-1 rounded-xl border py-2 transition-colors ${isChatMuted ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15' : 'border-[#263042] bg-[#101826] text-[#c7d2e3] hover:bg-[#182235]'}`}>
                                                        <Bell className="w-4 h-4" />
                                                        <span className="text-[10px]">{isChatMuted ? 'Unmute' : 'Mute'}</span>
                                                    </button>
                                                    <button onClick={() => void startOutgoingCall('audio')} disabled={!activeTeamChatId?.startsWith('dm-') || isActiveDirectBlocked || callPhase !== 'idle'} className={`flex flex-col items-center gap-1 rounded-xl border border-[#263042] bg-[#101826] py-2 text-[#c7d2e3] transition-colors ${activeTeamChatId?.startsWith('dm-') && !isActiveDirectBlocked && callPhase === 'idle' ? 'hover:bg-[#182235]' : 'opacity-50 cursor-not-allowed'}`}>
                                                        <Phone className="w-4 h-4" />
                                                        <span className="text-[10px]">Call</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-[#232a36] bg-[#0d1118] px-3 py-2 mt-3 shrink-0">
                                                <div className="text-[10px] uppercase tracking-[0.16em] text-[#7f8ba0] mb-1.5">Status</div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <div className="rounded-lg border border-[#263042] bg-[#101826] px-2 py-1.5 text-[11px] text-[#c7d2e3]">
                                                        {isChatMuted ? 'Muted' : 'Unmuted'}
                                                    </div>
                                                    <div className="rounded-lg border border-[#263042] bg-[#101826] px-2 py-1.5 text-[11px] text-[#c7d2e3]">
                                                        {(activeChatSettings?.pinned ?? false) ? 'Pinned' : 'Not pinned'}
                                                    </div>
                                                    <div className="rounded-lg border border-[#263042] bg-[#101826] px-2 py-1.5 text-[11px] text-[#c7d2e3]">
                                                        {activeChatSettings?.readReceipts ?? true ? 'Read receipts on' : 'Read receipts off'}
                                                    </div>
                                                    <div className="rounded-lg border border-[#263042] bg-[#101826] px-2 py-1.5 text-[11px] text-[#c7d2e3]">
                                                        {activeChatSettings?.showEmbeds ?? true ? 'Media previews on' : 'Media previews off'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-[#232a36] bg-[#0d1118] px-3 py-3 mt-3 flex-1 overflow-y-auto custom-scrollbar space-y-3.5">
                                                <div className="rounded-xl border border-[#232a36] bg-[#0b121d] px-3 py-2 space-y-2">
                                                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#7f8ba0]">Identity & Appearance</div>
                                                    <div className="grid grid-cols-[1fr_auto] gap-2">
                                                        <input
                                                            value={settingsNicknameInput}
                                                            onChange={(e) => setSettingsNicknameInput(e.target.value)}
                                                            placeholder="Nickname in this chat"
                                                            className="bg-[#151b24] border border-[#2b3443] rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-[#4f52b2]"
                                                        />
                                                        <button onClick={() => void patchActiveChatSettings({ nickname: settingsNicknameInput.trim() })} className="px-2.5 py-2 rounded-lg text-xs bg-white text-black font-semibold hover:bg-gray-200 transition-colors">
                                                            Save
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {(['default', 'midnight', 'forest', 'sunset'] as const).map(theme => (
                                                            <button
                                                                key={`rail-theme-${theme}`}
                                                                onClick={() => void patchActiveChatSettings({ theme })}
                                                                className={`px-2 py-1.5 rounded-lg border text-[11px] capitalize transition-colors ${activeChatSettings?.theme === theme ? 'border-white text-white bg-[#1f2632]' : 'border-[#2b3443] text-[#9aa3ad] hover:text-white hover:bg-[#1b2230]'}`}
                                                            >
                                                                {theme}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="space-y-1.5 text-xs">
                                                        <div className="flex items-center justify-between text-[#d8deea]"><span>Show avatars</span><button onClick={() => void patchActiveExtra('showAvatars', !getExtraBool('showAvatars', true))} className={`px-2 py-1 rounded ${getExtraBool('showAvatars', true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('showAvatars', true) ? 'On' : 'Off'}</button></div>
                                                        <div className="flex items-center justify-between text-[#d8deea]"><span>Show timestamps</span><button onClick={() => void patchActiveExtra('showTimestamps', !getExtraBool('showTimestamps', true))} className={`px-2 py-1 rounded ${getExtraBool('showTimestamps', true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('showTimestamps', true) ? 'On' : 'Off'}</button></div>
                                                        <div className="flex items-center justify-between text-[#d8deea]"><span>24-hour time</span><button onClick={() => void patchActiveExtra('use24HourTime', !getExtraBool('use24HourTime', false))} className={`px-2 py-1 rounded ${getExtraBool('use24HourTime', false) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('use24HourTime', false) ? 'On' : 'Off'}</button></div>
                                                        <div className="flex items-center justify-between text-[#d8deea]"><span>Compact mode</span><button onClick={() => void patchActiveChatSettings({ compactMode: !(activeChatSettings?.compactMode ?? false) })} className={`px-2 py-1 rounded ${(activeChatSettings?.compactMode ?? false) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{(activeChatSettings?.compactMode ?? false) ? 'On' : 'Off'}</button></div>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-[#232a36] bg-[#0b121d] px-3 py-2 space-y-2">
                                                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#7f8ba0]">Notifications</div>
                                                    <div className="space-y-1.5 text-xs">
                                                        <div className="flex items-center justify-between text-[#d8deea]"><span>Message notifications</span><button onClick={() => void patchActiveChatSettings({ notificationsEnabled: !(activeChatSettings?.notificationsEnabled ?? true) })} className={`px-2 py-1 rounded ${(activeChatSettings?.notificationsEnabled ?? true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{(activeChatSettings?.notificationsEnabled ?? true) ? 'On' : 'Off'}</button></div>
                                                        <div className="flex items-center justify-between text-[#d8deea]"><span>Sound effects</span><button onClick={() => void patchActiveChatSettings({ soundsEnabled: !(activeChatSettings?.soundsEnabled ?? true) })} className={`px-2 py-1 rounded ${(activeChatSettings?.soundsEnabled ?? true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{(activeChatSettings?.soundsEnabled ?? true) ? 'On' : 'Off'}</button></div>
                                                        <div className="flex items-center justify-between text-[#d8deea]"><span>@mention alerts</span><button onClick={() => void patchActiveChatSettings({ mentionNotifications: !(activeChatSettings?.mentionNotifications ?? true) })} className={`px-2 py-1 rounded ${(activeChatSettings?.mentionNotifications ?? true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{(activeChatSettings?.mentionNotifications ?? true) ? 'On' : 'Off'}</button></div>
                                                    </div>
                                                    <input
                                                        value={getExtraString('keywordAlerts', '')}
                                                        onChange={(e) => void patchActiveExtra('keywordAlerts', e.target.value)}
                                                        placeholder="Keyword alerts (comma separated)"
                                                        className="w-full bg-[#151b24] border border-[#2b3443] rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-[#4f52b2]"
                                                    />
                                                    <div className="grid grid-cols-3 gap-1">
                                                        <button onClick={() => void patchActiveChatSettings({ mutedUntil: null })} className="px-2 py-1 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">Unmute</button>
                                                        <button onClick={() => void patchActiveChatSettings({ mutedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() })} className="px-2 py-1 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">1h</button>
                                                        <button onClick={() => void patchActiveChatSettings({ mutedUntil: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() })} className="px-2 py-1 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">8h</button>
                                                        <button onClick={() => void patchActiveChatSettings({ mutedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })} className="px-2 py-1 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">24h</button>
                                                        <button onClick={() => void patchActiveChatSettings({ mutedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })} className="px-2 py-1 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">7d</button>
                                                        <button onClick={() => void patchActiveChatSettings({ mutedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })} className="px-2 py-1 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">30d</button>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-[#232a36] bg-[#0b121d] px-3 py-2 space-y-1.5">
                                                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#7f8ba0] mb-1">Privacy & Behavior</div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Read receipts</span><button onClick={() => void patchActiveChatSettings({ readReceipts: !(activeChatSettings?.readReceipts ?? true) })} className={`px-2 py-1 rounded ${(activeChatSettings?.readReceipts ?? true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{(activeChatSettings?.readReceipts ?? true) ? 'On' : 'Off'}</button></div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Show media previews</span><button onClick={() => void patchActiveChatSettings({ showEmbeds: !(activeChatSettings?.showEmbeds ?? true) })} className={`px-2 py-1 rounded ${(activeChatSettings?.showEmbeds ?? true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{(activeChatSettings?.showEmbeds ?? true) ? 'On' : 'Off'}</button></div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Highlight mentions</span><button onClick={() => void patchActiveExtra('highlightMentions', !getExtraBool('highlightMentions', true))} className={`px-2 py-1 rounded ${getExtraBool('highlightMentions', true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('highlightMentions', true) ? 'On' : 'Off'}</button></div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Enter to send</span><button onClick={() => void patchActiveChatSettings({ enterToSend: !(activeChatSettings?.enterToSend ?? true) })} className={`px-2 py-1 rounded ${(activeChatSettings?.enterToSend ?? true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{(activeChatSettings?.enterToSend ?? true) ? 'On' : 'Off'}</button></div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Render markdown</span><button onClick={() => void patchActiveExtra('renderMarkdown', !getExtraBool('renderMarkdown', true))} className={`px-2 py-1 rounded ${getExtraBool('renderMarkdown', true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('renderMarkdown', true) ? 'On' : 'Off'}</button></div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Message animations</span><button onClick={() => void patchActiveExtra('messageAnimations', !getExtraBool('messageAnimations', true))} className={`px-2 py-1 rounded ${getExtraBool('messageAnimations', true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('messageAnimations', true) ? 'On' : 'Off'}</button></div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Typing indicators</span><button onClick={() => void patchActiveExtra('showTypingIndicator', !getExtraBool('showTypingIndicator', true))} className={`px-2 py-1 rounded ${getExtraBool('showTypingIndicator', true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('showTypingIndicator', true) ? 'On' : 'Off'}</button></div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Auto scroll incoming</span><button onClick={() => void patchActiveExtra('autoScrollIncoming', !getExtraBool('autoScrollIncoming', true))} className={`px-2 py-1 rounded ${getExtraBool('autoScrollIncoming', true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('autoScrollIncoming', true) ? 'On' : 'Off'}</button></div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Spell check</span><button onClick={() => void patchActiveExtra('spellCheck', !getExtraBool('spellCheck', true))} className={`px-2 py-1 rounded ${getExtraBool('spellCheck', true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('spellCheck', true) ? 'On' : 'Off'}</button></div>
                                                    <div className="flex items-center justify-between text-xs text-[#d8deea]"><span>Delete confirmation</span><button onClick={() => void patchActiveExtra('confirmDelete', !getExtraBool('confirmDelete', true))} className={`px-2 py-1 rounded ${getExtraBool('confirmDelete', true) ? 'bg-white text-black' : 'bg-[#222a37] text-[#d8deea]'}`}>{getExtraBool('confirmDelete', true) ? 'On' : 'Off'}</button></div>
                                                </div>

                                                {activeChat?.kind === 'group' && (
                                                    <div className="rounded-xl border border-[#232a36] bg-[#0b121d] px-3 py-2 space-y-2">
                                                        <div className="text-[10px] uppercase tracking-[0.15em] text-[#7f8ba0]">Group Controls</div>
                                                        <input
                                                            value={groupAvatarInput}
                                                            onChange={(e) => setGroupAvatarInput(e.target.value)}
                                                            placeholder="Group avatar URL"
                                                            className="w-full bg-[#151b24] border border-[#2b3443] rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-[#4f52b2]"
                                                        />
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button onClick={() => void saveActiveGroupAvatarUrl()} className="px-2.5 py-1.5 rounded-lg text-xs bg-white text-black font-semibold hover:bg-gray-200 transition-colors">Save avatar URL</button>
                                                            <button onClick={() => groupAvatarRailFileRef.current?.click()} className="px-2.5 py-1.5 rounded-lg text-xs bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">Upload avatar</button>
                                                        </div>
                                                        <input ref={groupAvatarRailFileRef} type="file" accept="image/*" className="hidden" onChange={handleGroupAvatarFilePick} />
                                                    </div>
                                                )}

                                                <div className="rounded-xl border border-[#232a36] bg-[#0b121d] px-3 py-2 space-y-2">
                                                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#7f8ba0]">Moderation & Data</div>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        <button onClick={() => void patchActiveChatSettings({ pinned: !(activeChatSettings?.pinned ?? false) })} className="px-2 py-1.5 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">{(activeChatSettings?.pinned ?? false) ? 'Unpin chat' : 'Pin chat'}</button>
                                                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?chat=${activeTeamChatId || ''}`); }} className="px-2 py-1.5 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">Copy chat link</button>
                                                        <button onClick={handleClearChatForMe} className="px-2 py-1.5 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">Clear for me</button>
                                                        {activeDirectChat && (
                                                            <button onClick={() => void handleArchiveActiveChat(!archivedDirectChatIds.includes(activeDirectChat.chatId))} className="px-2 py-1.5 rounded-lg text-[11px] bg-[#222a37] text-[#d8deea] hover:bg-[#2a3445]">
                                                                {archivedDirectChatIds.includes(activeDirectChat.chatId) ? 'Unarchive' : 'Archive'}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {activeDirectChat && (
                                                        <button onClick={toggleBlockActiveUser} className={`w-full px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors ${isActiveDirectBlocked ? 'text-[#9fe5b2] bg-[#173124]/40 hover:bg-[#173124]' : 'text-[#ffbfbf] bg-[#311717]/40 hover:bg-[#311717]'}`}>
                                                            {isActiveDirectBlocked ? 'Unblock user in this chat' : 'Block user in this chat'}
                                                        </button>
                                                    )}
                                                    <div className="text-[11px] text-[#8d96a0]">
                                                        {chatAssets.length > 0 ? `${chatAssets.length} attachment(s) stored in this chat` : 'No attachments yet.'}
                                                    </div>
                                                </div>
                                            </div>
                                        </aside>
                                    )}
                                </>

                                {/* Messages Area */}
                                {activeTeamTab === 'chat' ? (
                                    <div ref={teamChatContainerRef} onScroll={handleChatScroll} className={`flex-1 overflow-y-auto custom-scrollbar ${themedShellClass} ${activeChatSettings?.compactMode ? 'px-4 py-3' : 'px-6 py-4'} ${showTeamDetailsRail ? 'xl:pr-[390px]' : ''}`}>
                                        {searchedTeamMessages.map((msg, idx) => {
                                            const prevMsg = idx > 0 ? searchedTeamMessages[idx - 1] : undefined;
                                            const nextMsg = idx < searchedTeamMessages.length - 1 ? searchedTeamMessages[idx + 1] : undefined;
                                            const clusterWithPrev = areInSameMessageCluster(prevMsg, msg);
                                            const clusterWithNext = areInSameMessageCluster(msg, nextMsg);
                                            const currentDate = new Date(getMessageTimestamp(msg));
                                            const prevDate = prevMsg ? new Date(getMessageTimestamp(prevMsg)) : null;
                                            const showDayBoundary = !prevDate || !isSameCalendarDay(prevDate, currentDate);
                                            return (
                                                <React.Fragment key={msg.id}>
                                                    {showDayBoundary && (
                                                        <div className="relative my-4">
                                                            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[#232a35]" />
                                                            <div className="relative mx-auto w-fit px-2.5 py-1 rounded-full bg-[#0f141d] border border-[#293243] text-[10px] tracking-[0.14em] text-[#8d96a0] uppercase">
                                                                {formatDayBoundaryLabel(currentDate)}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div
                                                        id={`message-${msg.id}`}
                                                        className={`group relative rounded-lg px-2 -mx-2 ${clusterWithPrev ? 'py-0 mt-0' : 'py-1.5 mt-1'} ${getExtraBool('messageAnimations', true) ? 'transition-all duration-300 animate-[msgFadeIn_0.24s_ease]' : ''} hover:bg-white/[0.02] ${chatSearchResultIds[chatSearchIndex] === msg.id ? 'ring-1 ring-blue-400/40' : ''} ${getExtraBool('highlightMentions', true) && !msg.isMe && messageMentionsCurrentUser(msg.text) ? 'bg-blue-500/5 border border-blue-500/20' : ''}`}
                                                    >
                                                        <div className={`${getExtraBool('messageAnimations', true) ? 'transition-transform duration-200 group-hover:translate-x-0.5' : ''} flex gap-4`}>
                                                            {getExtraBool('showAvatars', true) && !clusterWithPrev && (msg.isAvatarImage ? (
                                                                <img src={msg.avatar} alt="Bot" className="w-9 h-9 rounded-full object-contain bg-black border border-[#333] mt-0.5 shrink-0" />
                                                            ) : (
                                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 ${msg.color}`}>
                                                                    {msg.avatar}
                                                                </div>
                                                            ))}
                                                            {getExtraBool('showAvatars', true) && clusterWithPrev && (
                                                                <div className="w-9 shrink-0 relative flex items-start justify-end pr-1 pt-0.5">
                                                                    <span className="text-[10px] text-[#6b7280] opacity-0 group-hover:opacity-100 transition-opacity select-none">
                                                                        {formatMessageTime(msg)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="flex-1 max-w-4xl relative">
                                                                {clusterWithPrev && (
                                                                    <div className="absolute -left-2 top-0 bottom-0 w-px bg-[#3a3f46] rounded-full" />
                                                                )}
                                                                {!clusterWithPrev && (
                                                                    <div className="flex items-baseline gap-2 mb-0.5">
                                                                        <span className="font-bold text-white text-sm flex items-center gap-2">
                                                                            {msg.user}
                                                                            {msg.isPrivate && (
                                                                                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-blue-500/20">
                                                                                    <Lock className="w-3 h-3" /> Only visible to you
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                        {getExtraBool('showTimestamps', true) && (
                                                                            <span className="text-[10px] text-[#8d96a0] opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none">{formatMessageTime(msg)}</span>
                                                                        )}
                                                                        {starredIdsForActiveChat.has(String(msg.id)) && (
                                                                            <span className="text-[10px] text-amber-300 flex items-center gap-1">
                                                                                <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                                                                                Starred
                                                                            </span>
                                                                        )}
                                                                        {msg.isEdited && <span className="text-[10px] text-[#666] italic">(edited)</span>}
                                                                    </div>
                                                                )}

                                                                {/* Reply Context Render */}
                                                                {msg.replyToId && (
                                                                    <div
                                                                        className="flex items-center gap-2 mb-2 group/reply cursor-pointer select-none"
                                                                        onClick={() => scrollToMessage(msg.replyToId!)}
                                                                    >
                                                                        {/* Curved Arrow Icon */}
                                                                        <div className="w-4 flex justify-end">
                                                                            <div className="w-3 h-3 border-l-2 border-t-2 border-[#555] rounded-tl-lg mt-1 group-hover/reply:border-[#4f52b2] transition-colors"></div>
                                                                        </div>

                                                                        {/* Preview Pill */}
                                                                        <div className="bg-[#1e1e1e]/80 hover:bg-[#252526] px-3 py-1.5 rounded-lg border border-[#333] flex items-center gap-2 text-xs text-[#8d96a0] transition-colors max-w-full overflow-hidden">
                                                                            <span className="material-symbols-outlined text-[14px] text-[#4f52b2]">reply</span>
                                                                            <span className="font-bold text-white whitespace-nowrap">
                                                                                {(() => {
                                                                                    const replyMsg = currentTeamMessages.find(m => m.id === msg.replyToId);
                                                                                    return replyMsg?.user || "Unknown";
                                                                                })()}
                                                                            </span>
                                                                            <span className="truncate opacity-70">
                                                                                {(() => {
                                                                                    const replyMsg = currentTeamMessages.find(m => m.id === msg.replyToId);
                                                                                    if (!replyMsg) return "Message deleted";
                                                                                    // Strip HTML
                                                                                    const temp = document.createElement('div');
                                                                                    temp.innerHTML = replyMsg.text;
                                                                                    return temp.textContent || temp.innerText || "";
                                                                                })()}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {editingMessageId === msg.id ? (
                                                                    <div className="mt-1">
                                                                        <textarea
                                                                            defaultValue={msg.text}
                                                                            className="w-full bg-[#1e1e1e] text-white border border-[#333] rounded p-2 text-sm outline-none focus:border-blue-500"
                                                                            rows={3}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                                    e.preventDefault();
                                                                                    handleEditMessage(msg.id, e.currentTarget.value);
                                                                                } else if (e.key === 'Escape') {
                                                                                    setEditingMessageId(null);
                                                                                }
                                                                            }}
                                                                            autoFocus
                                                                        />
                                                                        <div className="flex gap-2 mt-2 text-xs">
                                                                            <span className="text-[#8d96a0]">Esc to cancel • Enter to save</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="group/text relative">
                                                                        {(() => {
                                                                            const block = parseChatBlock(msg.text);
                                                                            if (block) {
                                                                                return renderChatBlock(msg, block);
                                                                            }
                                                                            const callEvent = parseCallEventSummary(msg.text);
                                                                            if (!callEvent) {
                                                                                return <RichTextRenderer text={msg.text} parseMarkdown={getExtraBool('renderMarkdown', true)} />;
                                                                            }
                                                                            return (
                                                                                <div className="rounded-xl border border-[#2b3035] bg-[#11161d] p-3 space-y-2">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <div className="text-sm font-semibold text-white">Call ended</div>
                                                                                        <button
                                                                                            onClick={() => setCallInfoModal({ summary: callEvent, attachments: msg.attachments || [] })}
                                                                                            className="px-2 py-1 text-[11px] rounded-md border border-[#2b3035] text-[#c9d1db] hover:bg-[#1a2029]"
                                                                                        >
                                                                                            View Info
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="text-xs text-[#9da8b6]">
                                                                                        {callEvent.peerName} • {formatCallDuration(callEvent.durationSec)}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        {/* Attachments Render */}
                                                                        {msg.attachments && msg.attachments.length > 0 && (activeChatSettings?.showEmbeds ?? true) && (
                                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                                {msg.attachments.map((att, i) => (
                                                                                    att.type === 'image' || att.type === 'gif' ? (
                                                                                        <img key={i} src={att.url} alt={att.name} className="max-w-[200px] rounded-lg border border-[#333] cursor-zoom-in hover:border-[#4f52b2] transition-colors" onClick={() => openMediaPreview({ url: att.url, type: att.type, name: att.name })} />
                                                                                    ) : att.type === 'video' ? (
                                                                                        <video key={i} src={att.url} className="max-w-[260px] rounded-lg border border-[#333] cursor-zoom-in hover:border-[#4f52b2] transition-colors" controls onClick={() => openMediaPreview({ url: att.url, type: 'video', name: att.name })} />
                                                                                    ) : isCodeAttachmentName(att.name) ? (
                                                                                        <div key={i} className="min-w-[280px] max-w-[420px] rounded-lg border border-[#333] bg-[#111315] overflow-hidden">
                                                                                            <div className="flex items-center justify-between px-3 py-2 bg-[#1a1d20] border-b border-[#2b3035]">
                                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                                    <FileText className="w-4 h-4 text-emerald-300 shrink-0" />
                                                                                                    <span className="text-xs text-white truncate">{att.name}</span>
                                                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#25313a] text-[#9ad1ff] border border-[#33414c]">{getCodeLanguageFromName(att.name)}</span>
                                                                                                </div>
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <button onClick={() => void handleCopyAttachmentCode(att)} className="text-[10px] px-2 py-1 rounded bg-[#25282c] text-[#d1d5db] hover:bg-[#33373d]">Copy</button>
                                                                                                    <button onClick={() => void handleOpenAttachmentCode(att)} className="text-[10px] px-2 py-1 rounded bg-white text-black hover:bg-gray-200">Open</button>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="px-3 py-2 text-[11px] text-[#8d96a0] font-mono">
                                                                                                Code file attachment
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div key={i} className="flex items-center gap-2 bg-[#1e1e1e] border border-[#333] rounded px-3 py-2 text-sm text-[#e3e3e3]">
                                                                                            <FileText className="w-4 h-4 text-blue-400" />
                                                                                            {att.name}
                                                                                        </div>
                                                                                    )
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        {msg.attachments && msg.attachments.length > 0 && !(activeChatSettings?.showEmbeds ?? true) && (
                                                                            <div className="mt-2 text-xs text-[#8d96a0]">{msg.attachments.length} attachment(s)</div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Reactions */}
                                                                {msg.reactions && msg.reactions.length > 0 && (
                                                                    <div className="flex gap-2 mt-2">
                                                                        {msg.reactions.map((r, i) => (
                                                                            <button key={i} onClick={() => handleReaction(msg.id, r.emoji)} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${r.active ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'bg-[#1c1e21] border-[#333] text-[#8d96a0] hover:bg-[#25282c]'}`}>
                                                                                <span>{r.emoji}</span>
                                                                                <span className="font-medium">{r.count}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Hover Actions Menu */}
                                                                {!editingMessageId && (
                                                                    <div className="absolute right-0 -top-4 bg-[#1e1e1e] border border-[#333] rounded-lg shadow-xl flex items-center p-1 gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 emoji-picker-container">
                                                                        <div className="relative flex items-center gap-1 pr-1 mr-1 border-r border-[#333]">
                                                                            {QUICK_REACTION_EMOJIS.map((emoji) => (
                                                                                <button
                                                                                    key={`${msg.id}-${emoji}`}
                                                                                    onClick={() => handleReaction(msg.id, emoji)}
                                                                                    className="w-7 h-7 rounded-md hover:bg-[#333] text-sm transition-colors"
                                                                                    title={`React ${emoji}`}
                                                                                >
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}
                                                                            <button
                                                                                onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === msg.id ? null : msg.id)}
                                                                                className="w-7 h-7 rounded-md hover:bg-[#333] text-[#8d96a0] hover:text-white text-base leading-none transition-colors"
                                                                                title="Add emoji reaction"
                                                                            >
                                                                                +
                                                                            </button>
                                                                            {showEmojiPickerFor === msg.id && (
                                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50">
                                                                                    <EmojiPicker onSelect={(emoji) => handleReaction(msg.id, emoji)} />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <button onClick={() => handleMessageReply(msg)} className="p-1.5 hover:bg-[#333] rounded text-[#8d96a0] hover:text-white" title="Reply"><Reply className="w-4 h-4" /></button>
                                                                        <button onClick={() => handleMessageShare(msg.text)} className="p-1.5 hover:bg-[#333] rounded text-[#8d96a0] hover:text-white" title="Copy Text"><Copy className="w-4 h-4" /></button>
                                                                        {(activeTeamChatId?.startsWith('dm-') || activeTeamChatId?.startsWith('gc-')) && (
                                                                            <button
                                                                                onClick={() => handleToggleStarMessage(msg.id)}
                                                                                className={`p-1.5 hover:bg-[#333] rounded transition-colors ${starredIdsForActiveChat.has(String(msg.id)) ? 'text-amber-300' : 'text-[#8d96a0] hover:text-amber-300'}`}
                                                                                title={starredIdsForActiveChat.has(String(msg.id)) ? 'Unstar message' : 'Star message'}
                                                                            >
                                                                                <Star className={`w-4 h-4 ${starredIdsForActiveChat.has(String(msg.id)) ? 'fill-amber-300' : ''}`} />
                                                                            </button>
                                                                        )}

                                                                        {msg.isMe && (
                                                                            <button onClick={() => setEditingMessageId(msg.id)} className="p-1.5 hover:bg-[#333] rounded text-[#8d96a0] hover:text-white" title="Edit"><Edit2 className="w-4 h-4" /></button>
                                                                        )}

                                                                        <button onClick={() => openDeleteMessageConfirm(msg)} className="p-1.5 hover:bg-[#333] rounded text-[#8d96a0] hover:text-red-400 transition-colors" title={msg.isMe ? "Delete for everyone" : "Delete for me"}>
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>

                                                                        <div className="w-px h-3 bg-[#333]"></div>
                                                                        <div className="relative">
                                                                            <button
                                                                                onClick={() => setOpenMessageDetailsFor(openMessageDetailsFor === msg.id ? null : msg.id)}
                                                                                className="message-details-trigger p-1.5 hover:bg-[#333] rounded text-[#8d96a0] hover:text-white"
                                                                            >
                                                                                <MoreHorizontal className="w-4 h-4" />
                                                                            </button>
                                                                            {openMessageDetailsFor === msg.id && (
                                                                                <div
                                                                                    onMouseLeave={() => setOpenMessageDetailsFor(null)}
                                                                                    className="message-details-menu absolute top-full right-0 mt-2 w-64 rounded-lg border border-[#2b3035] bg-[#151719] shadow-xl p-2 z-30"
                                                                                >
                                                                                    <div className="text-[10px] uppercase tracking-wider text-[#8d96a0] px-1 pb-1">Message Details</div>
                                                                                    <div className="space-y-1 text-xs text-[#d1d5db] px-1">
                                                                                        <div><span className="text-[#8d96a0]">Sender:</span> {msg.user}</div>
                                                                                        <div><span className="text-[#8d96a0]">Time:</span> {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : msg.time}</div>
                                                                                        <div><span className="text-[#8d96a0]">Message ID:</span> {msg.id}</div>
                                                                                        <div><span className="text-[#8d96a0]">Edited:</span> {msg.isEdited ? 'Yes' : 'No'}</div>
                                                                                        <div><span className="text-[#8d96a0]">Attachments:</span> {(msg.attachments || []).length}</div>
                                                                                        <div><span className="text-[#8d96a0]">Reactions:</span> {(msg.reactions || []).reduce((sum, r) => sum + (r.count || 0), 0)}</div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </React.Fragment>
                                            )
                                        })}
                                        {/* Typing Indicator */}
                                        {typingUser && getExtraBool('showTypingIndicator', true) && (
                                            <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <img src={typingUser.avatar} alt="Bot" className="w-9 h-9 rounded-full object-contain bg-black border border-[#333] mt-1 shrink-0" />
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-bold text-white">{typingUser.name}</span>
                                                    <div className="bg-[#1e1e1e] rounded-2xl rounded-tl-sm px-4 py-3 border border-[#333] w-fit flex items-center gap-1 h-10">
                                                        <div className="w-1.5 h-1.5 bg-[#8d96a0] rounded-full typing-dot"></div>
                                                        <div className="w-1.5 h-1.5 bg-[#8d96a0] rounded-full typing-dot"></div>
                                                        <div className="w-1.5 h-1.5 bg-[#8d96a0] rounded-full typing-dot"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {typingMembersDisplay.length > 0 && getExtraBool('showTypingIndicator', true) && (
                                            <div className={`overflow-hidden transition-all duration-200 ease-out ${typingMembersVisible ? 'max-h-10 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}>
                                                <div className="flex items-center gap-3 px-2 py-1 text-xs text-[#8d96a0]">
                                                    {typingMembersDisplay[0].isAvatarImage ? (
                                                        <img src={typingMembersDisplay[0].avatar} alt={typingMembersDisplay[0].name} className="w-6 h-6 rounded-full object-cover border border-[#333]" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-[#2b3035] text-white text-[10px] font-bold flex items-center justify-center">
                                                            {typingMembersDisplay[0].avatar.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5">
                                                        <span>
                                                            {typingMembersDisplay.length === 1
                                                                ? `${typingMembersDisplay[0].name} is typing`
                                                                : `${typingMembersDisplay[0].name} and ${typingMembersDisplay.length - 1} other${typingMembersDisplay.length - 1 > 1 ? 's' : ''} are typing`}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 bg-[#8d96a0] rounded-full typing-dot"></div>
                                                            <div className="w-1.5 h-1.5 bg-[#8d96a0] rounded-full typing-dot"></div>
                                                            <div className="w-1.5 h-1.5 bg-[#8d96a0] rounded-full typing-dot"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                ) : (
                                    <div className={`flex-1 overflow-y-auto px-6 py-5 custom-scrollbar bg-[#050505] ${showTeamDetailsRail ? 'xl:pr-[390px]' : ''}`}>
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                            <h3 className="text-sm font-semibold text-white tracking-wide">Shared Files & Media</h3>
                                            <div className="flex items-center gap-2">
                                                <select value={filesFilter} onChange={(e) => setFilesFilter(e.target.value as any)} className="bg-[#151719] border border-[#2b3035] rounded-lg px-2.5 py-1.5 text-xs text-[#e3e3e3] outline-none focus:border-[#4f52b2]">
                                                    <option value="all">All Types</option>
                                                    <option value="image">Images</option>
                                                    <option value="gif">GIFs</option>
                                                    <option value="video">Videos</option>
                                                    <option value="file">Files</option>
                                                </select>
                                                <select value={filesSort} onChange={(e) => setFilesSort(e.target.value as any)} className="bg-[#151719] border border-[#2b3035] rounded-lg px-2.5 py-1.5 text-xs text-[#e3e3e3] outline-none focus:border-[#4f52b2]">
                                                    <option value="newest">Newest</option>
                                                    <option value="oldest">Oldest</option>
                                                    <option value="name">Name (A-Z)</option>
                                                </select>
                                            </div>
                                        </div>
                                        {filteredChatAssets.length === 0 ? (
                                            <div className="border border-dashed border-[#2b3035] rounded-xl py-14 text-center text-[#8d96a0] text-sm">
                                                No files match this filter.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {filteredChatAssets.map(asset => (
                                                    <div key={asset.id} className="bg-[#0e1011] border border-[#2b3035] rounded-xl overflow-hidden hover:border-[#4f52b2]/60 transition-colors">
                                                        {asset.type === 'image' || asset.type === 'gif' ? (
                                                            <img src={asset.url} alt={asset.name} className="w-full h-36 object-cover bg-[#151719] cursor-zoom-in" onClick={() => openMediaPreview({ url: asset.url, type: asset.type, name: asset.name })} />
                                                        ) : asset.type === 'video' ? (
                                                            <video src={asset.url} className="w-full h-36 object-cover bg-[#151719] cursor-zoom-in" controls onClick={() => openMediaPreview({ url: asset.url, type: 'video', name: asset.name })} />
                                                        ) : isCodeAttachmentName(asset.name) ? (
                                                            <div className="h-36 bg-[#111315] flex flex-col justify-between p-3 border-b border-[#2b3035]">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#25313a] text-[#9ad1ff] border border-[#33414c]">{getCodeLanguageFromName(asset.name)}</span>
                                                                    <FileText className="w-4 h-4 text-emerald-300" />
                                                                </div>
                                                                <div className="text-xs text-[#8d96a0] font-mono">Code attachment</div>
                                                            </div>
                                                        ) : (
                                                            <div className="h-36 bg-[#151719] flex items-center justify-center">
                                                                <FileText className="w-8 h-8 text-blue-300" />
                                                            </div>
                                                        )}
                                                        <div className="p-3">
                                                            <div className="text-xs font-medium text-white truncate">{asset.name}</div>
                                                            <div className="text-[11px] text-[#8d96a0] mt-1 flex items-center justify-between gap-2">
                                                                <span className="capitalize">{asset.type}</span>
                                                                <span className="truncate">{asset.user}</span>
                                                            </div>
                                                            <div className="text-[10px] text-[#666] mt-1">{asset.size || asset.time}</div>
                                                            <div className="mt-2 flex gap-2">
                                                                <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-[11px] px-2 py-1 rounded bg-[#1c1e21] text-[#e3e3e3] hover:bg-[#25282c] transition-colors">Open</a>
                                                                {isCodeAttachmentName(asset.name) && (
                                                                    <button
                                                                        onClick={() => void handleOpenAttachmentCode(asset as ChatAttachment)}
                                                                        className="text-[11px] px-2 py-1 rounded bg-white text-black hover:bg-gray-200 transition-colors"
                                                                    >
                                                                        Open in Editor
                                                                    </button>
                                                                )}
                                                                <a href={asset.url} download={asset.name} className="text-[11px] px-2 py-1 rounded bg-[#1c1e21] text-[#e3e3e3] hover:bg-[#25282c] transition-colors">Download</a>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Input Area */}
                                {/* ... (Unchanged) ... */}
                                {activeTeamTab === 'chat' && (
                                    <>
                                        {isActiveDirectBlocked && (
                                            <div className="mx-5 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                                {isActiveDirectBlockedByOther
                                                    ? 'You cannot send messages because this user has blocked you.'
                                                    : 'You blocked this user. Unblock them from chat settings to send messages.'}
                                            </div>
                                        )}
                                        {chatSendError && (
                                            <div className="mx-5 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                                {chatSendError}
                                            </div>
                                        )}
                                        <div className={`p-4 pt-3 pb-5 ${themedShellClass} ${showTeamDetailsRail ? 'xl:pr-[390px]' : ''}`}>
                                            {/* ... Content ... */}
                                            <div className={`border rounded-2xl shadow-xl flex flex-col relative transition-all duration-300 bg-[#0f141d]/95 backdrop-blur-xl ${themedInputClass} ${isPrivateAiMode ? 'border-indigo-500/50 shadow-indigo-500/10' : 'border-[#293243]'}`}>
                                                {/* AI Mode Banner */}
                                                {isPrivateAiMode && !replyingToMessage && (
                                                    <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-indigo-500/20 rounded-t-xl animate-in fade-in slide-in-from-bottom-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1 bg-indigo-500/20 rounded-full">
                                                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                                            </div>
                                                            <span className="text-xs font-bold text-indigo-200">Private AI Chat</span>
                                                            <span className="text-[10px] text-indigo-300/60 border-l border-indigo-500/30 pl-2 ml-1">Only visible to you</span>
                                                        </div>
                                                        <button onClick={exitAiMode} className="text-indigo-300/70 hover:text-white transition-colors flex items-center gap-1 px-2 py-0.5 rounded hover:bg-indigo-500/20">
                                                            <span className="text-[10px] font-bold">EXIT</span>
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Reply Context Banner */}
                                                {replyingToMessage && (
                                                    <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-[#333] rounded-t-xl">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <span className="material-symbols-outlined text-[#8d96a0] text-[16px]">reply</span>
                                                            <span className="text-xs text-[#8d96a0]">Replying to <span className="text-white font-bold">{replyingToMessage.user}</span></span>
                                                            <span className="text-xs text-[#666] truncate max-w-[200px]">- {getReplyPreviewText(replyingToMessage)}</span>
                                                        </div>
                                                        <button onClick={() => setReplyingToMessage(null)} className="text-[#8d96a0] hover:text-white"><X className="w-3 h-3" /></button>
                                                    </div>
                                                )}

                                                {/* Attachments Preview */}
                                                {chatAttachments.length > 0 && (
                                                    <div className="flex gap-3 px-4 pt-3 pb-1 overflow-x-auto custom-scrollbar">
                                                        {chatAttachments.map((att, i) => (
                                                            <div key={i} className="relative group/att">
                                                                {att.type === 'image' || att.type === 'gif' ? (
                                                                    <img src={att.url} alt={att.name} className="h-16 rounded border border-[#333] cursor-zoom-in hover:border-[#4f52b2] transition-colors" onClick={() => openMediaPreview({ url: att.url, type: att.type, name: att.name })} />
                                                                ) : att.type === 'video' ? (
                                                                    <video src={att.url} className="h-16 rounded border border-[#333] cursor-zoom-in hover:border-[#4f52b2] transition-colors" onClick={() => openMediaPreview({ url: att.url, type: 'video', name: att.name })} />
                                                                ) : (
                                                                    <div className="h-16 w-20 bg-[#1e1e1e] border border-[#333] rounded flex flex-col items-center justify-center text-xs text-[#8d96a0]">
                                                                        <FileText className="w-6 h-6 mb-1" />
                                                                        <span className="truncate w-full px-1 text-center">{att.name}</span>
                                                                    </div>
                                                                )}
                                                                <button
                                                                    onClick={() => setChatAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/att:opacity-100 transition-opacity"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Mention Popup */}
                                                {mentionQuery !== null && (
                                                    <div className="absolute bottom-full left-4 mb-2 w-64 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl overflow-hidden z-50 mention-popup animate-in fade-in zoom-in-95 duration-200">
                                                        <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-[#8d96a0] bg-[#151719] border-b border-[#2b3035] font-bold">
                                                            Mention
                                                        </div>
                                                        <div className="max-h-60 overflow-y-auto">
                                                            {getParticipants()
                                                                .filter(p => p.name.toLowerCase().includes(mentionQuery!.toLowerCase()))
                                                                .map((participant, idx) => (
                                                                    <button
                                                                        key={participant.id}
                                                                        onClick={() => insertMention(participant.name)}
                                                                        onMouseEnter={() => setMentionIndex(idx)}
                                                                        className={`w-full px-3 py-2.5 flex items-center gap-3 transition-colors text-left ${idx === mentionIndex ? 'bg-[#2b3035] text-white' : 'text-[#e3e3e3] hover:bg-[#25282c]'}`}
                                                                    >
                                                                        {participant.isAvatarImage ? (
                                                                            <img src={participant.avatar} alt={participant.name} className="w-6 h-6 rounded-full object-cover bg-black border border-[#333]" />
                                                                        ) : (
                                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${participant.color}`}>
                                                                                {participant.avatar}
                                                                            </div>
                                                                        )}
                                                                        <span className="text-sm font-medium">{participant.name}</span>
                                                                    </button>
                                                                ))}
                                                            {getParticipants().filter(p => p.name.toLowerCase().includes(mentionQuery!.toLowerCase())).length === 0 && (
                                                                <div className="px-3 py-4 text-center text-xs text-[#8d96a0]">
                                                                    No matches found
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* WYSIWYG Editor */}
                                                <div
                                                    ref={editorRef}
                                                    contentEditable={!isActiveDirectBlocked}
                                                    spellCheck={getExtraBool('spellCheck', true)}
                                                    onInput={handleEditorInput}
                                                    onKeyDown={handleEditorKeyDown}
                                                    onMouseUp={checkFormats}
                                                    onKeyUp={checkFormats}
                                                    className={`w-full bg-transparent text-white text-[15px] outline-none px-4 py-3 min-h-[52px] max-h-[220px] custom-scrollbar overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-[#687284] ${isActiveDirectBlocked ? 'cursor-not-allowed opacity-60' : 'cursor-text'} [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:marker:text-white/50`}
                                                    data-placeholder={`Write to ${displayChatTitle} • Press Tab to talk to AI`}
                                                />

                                                <div className="flex justify-between items-center px-2.5 pb-2.5 mt-1 relative">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="relative team-plus-menu">
                                                            <button onClick={() => setShowTeamPlusMenu(v => !v)} className={`p-1.5 rounded-lg bg-[#1a202b] text-[#8d96a0] hover:text-white hover:bg-[#232c3b] transition-colors ${showTeamPlusMenu ? 'text-white bg-[#232c3b]' : ''}`} title="Add" onMouseDown={e => e.preventDefault()}>
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                            {showTeamPlusMenu && (
                                                                <div className="absolute bottom-full left-0 mb-2 w-[360px] rounded-2xl border border-[#2b3345] bg-[linear-gradient(165deg,#0f1420,#0c1018)] p-2.5 shadow-[0_24px_48px_rgba(0,0,0,0.5)] z-50 animate-in fade-in zoom-in-95 duration-150">
                                                                    <button onClick={() => { setShowTeamPlusMenu(false); teamFileRef.current?.click(); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-[#d1d5db] bg-[#131b29] border border-[#273142] hover:bg-[#182336] transition-colors">
                                                                        Attach file
                                                                    </button>
                                                                    <div className="px-1 pt-3 pb-2 text-[10px] uppercase tracking-[0.16em] text-[#8ea2c7]">Insert Block</div>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        {BLOCK_KINDS.map((kind) => (
                                                                            <button
                                                                                key={`plus-block-${kind}`}
                                                                                onClick={() => openBlockComposer(kind)}
                                                                                className={`group text-left rounded-xl border border-[#273142] bg-[linear-gradient(155deg,#121b2a,#101723)] px-2.5 py-2.5 hover:border-[#3e4f69] hover:-translate-y-[1px] hover:shadow-[0_10px_20px_rgba(0,0,0,0.35)] transition-all`}
                                                                            >
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <div className="text-sm font-semibold text-[#dce7ff]">{BLOCK_META[kind].label}</div>
                                                                                    <span className="text-base leading-none">{BLOCK_META[kind].icon}</span>
                                                                                </div>
                                                                                <div className="text-[11px] text-[#8ea2c7] mt-1 line-clamp-2">{BLOCK_META[kind].hint}</div>
                                                                                <div className="mt-2 h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
                                                                                    <div className={`h-full rounded-full bg-gradient-to-r ${BLOCK_META[kind].glow} group-hover:w-full transition-all duration-300`} style={{ width: '42%' }} />
                                                                                </div>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <input
                                                            type="file"
                                                            ref={teamFileRef}
                                                            className="hidden"
                                                            onChange={handleTeamFileSelect}
                                                            multiple
                                                        />

                                                        <div className="w-px h-4 bg-[#2e3440] mx-1"></div>

                                                        <button
                                                            onClick={() => execFormat('bold')}
                                                            className={`p-1.5 rounded transition-colors ${activeFormats.includes('bold') ? 'bg-white text-black' : 'hover:bg-[#1c1e21] text-[#8d96a0] hover:text-white'}`}
                                                            title="Bold"
                                                            onMouseDown={e => e.preventDefault()}
                                                        >
                                                            <Bold className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => execFormat('italic')}
                                                            className={`p-1.5 rounded transition-colors ${activeFormats.includes('italic') ? 'bg-white text-black' : 'hover:bg-[#1c1e21] text-[#8d96a0] hover:text-white'}`}
                                                            title="Italic"
                                                            onMouseDown={e => e.preventDefault()}
                                                        >
                                                            <Italic className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => execFormat('underline')}
                                                            className={`p-1.5 rounded transition-colors ${activeFormats.includes('underline') ? 'bg-white text-black' : 'hover:bg-[#1c1e21] text-[#8d96a0] hover:text-white'}`}
                                                            title="Underline"
                                                            onMouseDown={e => e.preventDefault()}
                                                        >
                                                            <Underline className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => execFormat('strikeThrough')}
                                                            className={`p-1.5 rounded transition-colors ${activeFormats.includes('strikeThrough') ? 'bg-white text-black' : 'hover:bg-[#1c1e21] text-[#8d96a0] hover:text-white'}`}
                                                            title="Strikethrough"
                                                            onMouseDown={e => e.preventDefault()}
                                                        >
                                                            <Strikethrough className="w-4 h-4" />
                                                        </button>
                                                        <div className="relative link-composer">
                                                            <button
                                                                onClick={handleInsertLink}
                                                                className="p-1.5 rounded hover:bg-[#1c1e21] text-[#8d96a0] hover:text-white transition-colors"
                                                                title="Link"
                                                                onMouseDown={e => e.preventDefault()}
                                                            >
                                                                <LinkIcon className="w-4 h-4" />
                                                            </button>
                                                            {showLinkComposer && (
                                                                <form
                                                                    onSubmit={handleLinkInsertSubmit}
                                                                    className="absolute bottom-full left-0 mb-2 w-80 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-200"
                                                                >
                                                                    <div className="text-[10px] uppercase tracking-wider text-[#8d96a0] mb-2 font-bold">Insert Link</div>
                                                                    <input
                                                                        id="link-title-input"
                                                                        value={linkTitleInput}
                                                                        onChange={(e) => setLinkTitleInput(e.target.value)}
                                                                        placeholder="Title (e.g. API Docs)"
                                                                        className="w-full bg-[#151719] border border-[#2b3035] rounded px-2 py-1.5 text-xs text-white placeholder-[#8d96a0] outline-none focus:border-[#4f52b2] mb-2"
                                                                    />
                                                                    <input
                                                                        id="link-url-input"
                                                                        value={linkUrlInput}
                                                                        onChange={(e) => setLinkUrlInput(e.target.value)}
                                                                        placeholder="URL (https://...)"
                                                                        className="w-full bg-[#151719] border border-[#2b3035] rounded px-2 py-1.5 text-xs text-white placeholder-[#8d96a0] outline-none focus:border-[#4f52b2] mb-2"
                                                                    />
                                                                    {linkSelectedText && (
                                                                        <div className="text-[11px] text-[#8d96a0] mb-2 truncate">
                                                                            Linking selected text: "{linkSelectedText}"
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setShowLinkComposer(false);
                                                                                setLinkTitleInput('');
                                                                                setLinkUrlInput('');
                                                                                setLinkSelectedText('');
                                                                                linkSelectionRangeRef.current = null;
                                                                            }}
                                                                            className="px-2.5 py-1 rounded text-xs text-[#8d96a0] hover:text-white hover:bg-[#25282c]"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button type="submit" className="px-2.5 py-1 rounded text-xs bg-white text-black font-semibold hover:bg-gray-200">Insert</button>
                                                                    </div>
                                                                </form>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => execFormat('insertUnorderedList')}
                                                            className={`p-1.5 rounded transition-colors ${activeFormats.includes('insertUnorderedList') ? 'bg-white text-black' : 'hover:bg-[#1c1e21] text-[#8d96a0] hover:text-white'}`}
                                                            title="List"
                                                            onMouseDown={e => e.preventDefault()}
                                                        >
                                                            <List className="w-4 h-4" />
                                                        </button>

                                                        <div className="w-px h-4 bg-[#333] mx-1"></div>

                                                        <button onClick={() => execFormat('insertText', '@')} className="p-1.5 rounded hover:bg-[#1c1e21] text-[#8d96a0] hover:text-white transition-colors"><AtSign className="w-4 h-4" /></button>

                                                        <div className="relative input-emoji-picker">
                                                            <button
                                                                onClick={() => setShowInputEmojiPicker(!showInputEmojiPicker)}
                                                                className={`p-1.5 rounded hover:bg-[#1c1e21] text-[#8d96a0] hover:text-white transition-colors ${showInputEmojiPicker ? 'text-white bg-[#1c1e21]' : ''}`}
                                                            >
                                                                <Smile className="w-4 h-4" />
                                                            </button>

                                                            {showInputEmojiPicker && (
                                                                <div className="absolute bottom-full left-0 mb-2 z-50">
                                                                    <EmojiPicker onSelect={insertEmoji} />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="relative gif-picker-container">
                                                            <button
                                                                onClick={() => setShowGifPicker(v => !v)}
                                                                className={`p-1.5 rounded hover:bg-[#1c1e21] text-[#8d96a0] hover:text-white transition-colors ${showGifPicker ? 'text-white bg-[#1c1e21]' : ''}`}
                                                                title="Add GIF"
                                                            >
                                                                <ImageIcon className="w-4 h-4" />
                                                            </button>
                                                            {showGifPicker && (
                                                                <div className="absolute bottom-full left-0 mb-2 w-80 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                                                    <input
                                                                        value={gifQuery}
                                                                        onChange={(e) => setGifQuery(e.target.value)}
                                                                        placeholder="Search GIFs"
                                                                        className="w-full bg-[#151719] border border-[#2b3035] rounded px-2 py-1.5 text-xs text-white placeholder-[#8d96a0] outline-none focus:border-[#4f52b2]"
                                                                    />
                                                                    <div className="mt-2 max-h-52 overflow-y-auto custom-scrollbar">
                                                                        {isGifLoading ? (
                                                                            <div className="text-xs text-[#8d96a0] py-8 text-center">Loading GIFs...</div>
                                                                        ) : gifResults.length === 0 ? (
                                                                            <div className="text-xs text-[#8d96a0] py-8 text-center">No GIFs found</div>
                                                                        ) : (
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                {gifResults.map(gif => (
                                                                                    <button
                                                                                        key={gif.id}
                                                                                        onClick={() => handleGifSelect(gif)}
                                                                                        className="rounded overflow-hidden border border-[#333] hover:border-[#4f52b2] transition-colors"
                                                                                    >
                                                                                        <img src={gif.previewUrl} alt={gif.title} className="w-full h-24 object-cover" />
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <button
                                                            onClick={handleMicClick}
                                                            className={`p-1.5 rounded hover:bg-[#1c1e21] transition-colors relative flex items-center gap-1.5 ${isListening ? 'text-red-500 bg-red-500/10' : 'text-[#8d96a0] hover:text-white'}`}
                                                            title="Voice Input"
                                                        >
                                                            <Mic className="w-4 h-4" />
                                                            {isListening && (
                                                                <span className="text-[10px] font-bold uppercase tracking-wider animate-pulse">Listening...</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                    {activeTeamChatId?.startsWith('dm-') && (
                                                        <div className="flex-1 text-right pr-2">
                                                            <span className={`text-[11px] ${isLastOutgoingSeen ? 'text-[#9be7b0]' : 'text-[#6b7280]'}`}>
                                                                {canShowReadReceipts ? (isLastOutgoingSeen ? 'Seen' : 'Delivered') : 'Read receipts off'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <button onClick={handleTeamSend} disabled={isActiveDirectBlocked} className={`p-2 transition-colors ${(editorRef.current?.innerText.trim() || chatAttachments.length > 0) && !isActiveDirectBlocked ? 'text-white' : 'text-[#8d96a0] hover:text-white'} ${isActiveDirectBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                                        <Send className="w-4 h-4 ml-0.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {showScrollDownBtn && (
                                            <button
                                                onClick={scrollToBottom}
                                                className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 bg-[#1e1e1e] text-white p-2.5 rounded-full shadow-2xl border border-[#333] hover:bg-[#333] transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 hover:scale-110 flex items-center justify-center group"
                                                title="Jump to latest"
                                            >
                                                <ArrowDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                                            </button>
                                        )}
                                    </>
                                )}

                        {mediaPreview && (
                            <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setMediaPreview(null)}>
                                <div className="relative max-w-6xl w-full max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => setMediaPreview(null)}
                                                className="absolute -top-12 right-0 p-2 rounded-lg bg-[#1c1e21] border border-[#2b3035] text-[#e3e3e3] hover:text-white"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                            {mediaPreview.type === 'video' ? (
                                                <video src={mediaPreview.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-lg border border-[#333] bg-black" />
                                            ) : (
                                                <img src={mediaPreview.url} alt={mediaPreview.name} className="max-h-[85vh] max-w-full rounded-lg border border-[#333]" />
                                            )}
                                </div>
                            </div>
                        )}

                    </div>
                ) : (
                            /* Empty State for Teams */
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#050505] relative">
                                {!isSidebarOpen && (
                                    <button
                                        onClick={() => setIsSidebarOpen(true)}
                                        className="absolute top-6 left-6 p-2 rounded-lg bg-[#1c1e21] text-[#8d96a0] hover:text-white border border-[#2b3035] transition-colors shadow-lg"
                                        title="Open Sidebar"
                                    >
                                        <SidebarOpen className="w-5 h-5" />
                                    </button>
                                )}
                                <div className="w-20 h-20 rounded-2xl bg-[#1c1e21] border border-[#2b3035] flex items-center justify-center mb-6 shadow-2xl">
                                    <MessageSquare className="w-10 h-10 text-[#8d96a0]" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-3">Select a Chat</h2>
                                <p className="text-[#8d96a0] max-w-sm">Choose a team channel or direct message from the sidebar to start chatting.</p>

                                <div className="mt-8 flex gap-4">
                                    <button onClick={() => setShowNewChatModal(true)} className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors shadow-lg shadow-white/5">
                                        New Chat
                                    </button>
                                </div>
                            </div>
                        )
                    )}

                    {/* VIEW: AI CHAT  */}
                    {currentView === 'ai-chat' && (
                        <div className="flex flex-col h-full relative">
                            {chatHistory.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-3xl mx-auto w-full -mt-20">
                                    <div className="w-full text-left mb-6 flex items-center gap-4 animate-in slide-in-from-bottom-2 fade-in duration-700"><img src="https://image2url.com/r2/default/images/1770704003877-ff97628a-a31a-49b7-bb0f-5223bea264a0.png" alt="AI Logo" className="w-16 h-16 object-contain" /><span className="text-3xl font-medium text-[#e3e3e3] tracking-tight">Hi {userName}</span></div>
                                    <h1 className="text-5xl font-medium text-[#c4c7c5] w-full text-left mb-10 tracking-tight animate-in slide-in-from-bottom-4 fade-in duration-700 delay-100">Where should we start?</h1>
                                    <div className="w-full bg-[#1e1f20] rounded-[2rem] p-4 relative animate-in slide-in-from-bottom-6 fade-in duration-700 delay-200 shadow-2xl">
                                        <input type="text" ref={inputRef as React.RefObject<HTMLInputElement>} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChat()} placeholder={connectedProject ? `Ask about ${connectedProject.title}...` : "Ask Natural Assistant"} className="w-full bg-transparent text-[#e3e3e3] placeholder-[#8e918f] text-lg outline-none resize-none px-2 py-2" autoFocus />
                                        <div className="flex justify-between items-center mt-3 px-1">
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex items-center gap-2">
                                                    <button onClick={() => setShowPlusMenu(!showPlusMenu)} className={`p-2 rounded-full transition-colors ${showPlusMenu ? 'bg-[#333537] text-white' : 'hover:bg-[#333537] text-[#e3e3e3]'}`}><Plus className="w-5 h-5" /></button>
                                                    {activeToolId && (<div className="flex items-center gap-2 bg-[#2b3035] px-3 py-1.5 rounded-full text-xs text-[#e3e3e3] border border-[#333] animate-in fade-in zoom-in-95 duration-200">
                                                        {(() => {
                                                            const { icon: ToolIcon, label } = getToolDetails(activeToolId);
                                                            return (
                                                                <>
                                                                    <ToolIcon className="w-3 h-3 text-blue-400" />
                                                                    <span className="font-medium">{label}</span>
                                                                </>
                                                            );
                                                        })()}
                                                        <button onClick={() => setActiveToolId(null)} className="ml-1 p-0.5 rounded-full hover:bg-white/10 hover:text-white text-[#8d96a0] transition-colors"><X className="w-3 h-3" /></button>
                                                    </div>)}
                                                    {showPlusMenu && (<PlusMenu onClose={() => setShowPlusMenu(false)} onSelect={handleMenuSelect} />)}
                                                </div>
                                                <div className="relative" ref={projectSelectorRef}>
                                                    <button onClick={() => setShowProjectSelector(!showProjectSelector)} className={`p-2 rounded-full transition-colors hidden sm:block ${connectedProject ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-[#333537] text-[#e3e3e3]'}`} title={connectedProject ? `Connected to ${connectedProject.title}` : "Connect to Project"}><span className="material-symbols-outlined text-[20px] transition-colors">build</span></button>
                                                    {showProjectSelector && (<div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-xl overflow-hidden z-20 animate-in zoom-in-95 duration-100"><div className="p-2 border-b border-[#333] text-xs font-medium text-[#8d96a0] bg-[#1a1b1d]">Connect Project Context</div><div className="max-h-48 overflow-y-auto custom-scrollbar p-1"><button onClick={() => { setConnectedProject(null); setShowProjectSelector(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#2b2d30] text-[#8d96a0] italic`}><span className="material-symbols-outlined text-sm">close</span>No Project (General)</button>{visibleApps.map(app => (<button key={app.id} onClick={() => { setConnectedProject(app); setShowProjectSelector(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${connectedProject?.id === app.id ? 'bg-[#2b3035] text-white' : 'text-[#e3e3e3] hover:bg-[#2b2d30]'}`}><span className="material-symbols-outlined text-sm">{app.icon}</span><span className="truncate flex-1">{app.title}</span>{connectedProject?.id === app.id && <span className="material-symbols-outlined text-xs text-blue-400">check</span>}</button>))}</div></div>)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="relative" ref={modelDropdownRef}>
                                                    <button
                                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                                        className="flex items-center gap-2 text-xs text-[#c4c7c5] hover:text-white bg-[#121416] px-3 py-2 rounded-xl border border-[#2f3338] hover:border-[#4b5563] transition-colors"
                                                        title={`${selectedModelOption.label} - Best for ${selectedModelOption.bestFor}`}
                                                    >
                                                        <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                                                        <span className="font-medium truncate max-w-[180px]">{selectedModelOption.label}</span>
                                                        <ChevronDown className="w-3 h-3 text-[#8d96a0]" />
                                                    </button>
                                                    {showModelDropdown && (
                                                        <div className="absolute bottom-full right-0 mb-2 w-72 bg-[#17191c] border border-[#2f3338] rounded-xl shadow-xl overflow-hidden z-20 animate-in zoom-in-95 duration-100">
                                                            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[#8d96a0]">Choose Model</div>
                                                            <div className="p-1">
                                                                {OPENROUTER_FREE_MODELS.map(model => (
                                                                    <button
                                                                        key={model.id}
                                                                        onClick={() => {
                                                                            setSelectedModel(model.id);
                                                                            setShowModelDropdown(false);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedModel === model.id ? 'bg-[#2b3036] text-white' : 'text-[#c4c7c5] hover:bg-[#23272c]'}`}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <div className="truncate font-medium">{model.label}</div>
                                                                            <div className="truncate text-[10px] text-[#8d96a0]">Best for: {model.bestFor}</div>
                                                                        </div>
                                                                        {selectedModel === model.id && <span className="material-symbols-outlined text-sm text-blue-300">check</span>}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {isTemporaryChat && !activeThreadId && (
                                                    <span className="text-[10px] px-2 py-1 rounded-full border border-[#2f6b54] bg-[#1f3a2f] text-[#b5f5d2]">Temp</span>
                                                )}
                                                {chatInput.trim() ? (<button onClick={() => handleSendChat()} className="p-2 rounded-full bg-white text-black hover:bg-[#e3e3e3] transition-colors"><Send className="w-4 h-4 ml-0.5" /></button>) : activeToolId ? (<button onClick={() => handleSendChat()} className="p-2.5 rounded-full bg-blue-500 text-white hover:bg-blue-400 transition-colors"><Send className="w-4 h-4 ml-0.5" /></button>) : (<button onClick={handleMicClick} className={`p-2.5 rounded-full transition-colors mb-0.5 ${isListening ? 'bg-red-500/20 text-red-500' : 'hover:bg-[#333537] text-[#e3e3e3]'}`}><Mic className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} /></button>)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col relative h-full overflow-hidden">
                                    <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar scroll-smooth" ref={chatContainerRef} onScroll={handleChatScroll}>
                                        <div className="max-w-3xl mx-auto space-y-8 pb-32">
                                            {chatHistory.map((msg, i) => {
                                                const actorName = msg.role === 'user' ? (userName || 'You') : 'Natural AI';
                                                const actorAvatar = msg.role === 'user'
                                                    ? (isHttpUrl(userAvatar) ? userAvatar : ((userAvatar || userName || 'U').slice(0, 2).toUpperCase()))
                                                    : AI_LOGO_URL;
                                                const actorAvatarIsImage = msg.role === 'user' ? isHttpUrl(actorAvatar) : true;
                                                return (
                                                    <div key={i} className="flex gap-3 justify-start group mt-2">
                                                        {actorAvatarIsImage ? (
                                                            <img src={actorAvatar} alt={actorName} className="w-8 h-8 rounded-full object-cover border border-[#2b3035] mt-0.5 shrink-0" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-[#2b3035] text-white text-[10px] font-bold flex items-center justify-center mt-0.5 shrink-0">
                                                                {actorAvatar}
                                                            </div>
                                                        )}
                                                        <div className="max-w-[85%] mr-auto text-left">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-sm font-bold text-white">{actorName}</span>
                                                            </div>
                                                            <div className="text-[#e3e3e3]">
                                                                {msg.role === 'user' && msg.text.startsWith('> ') ? (
                                                                    <div>
                                                                        <div className="bg-[#1e1e1e] border-l-2 border-[#8d96a0] pl-2 py-1 mb-2 text-xs text-[#8d96a0] italic whitespace-pre-wrap">
                                                                            {msg.text.split('\n\n')[0].replace(/^> /, '').replace(/\n> /g, '\n')}
                                                                        </div>
                                                                        <span className="text-[15px] leading-relaxed whitespace-pre-wrap">
                                                                            {msg.text.split('\n\n').slice(1).join('\n\n')}
                                                                        </span>
                                                                    </div>
                                                                ) : msg.role === 'user' ? (
                                                                    <span className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</span>
                                                                ) : (
                                                                    <>
                                                                        <FormattedMessage text={msg.text} onRunCode={handleRunCode} onOpenInEditor={handleOpenCodeInEditor} />
                                                                        <ActionButtons text={msg.text} onRedo={handleRedo} />
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setReplyingTo({ text: getReplySnippetFromMessage(msg.text) })}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity self-center p-1.5 rounded-md hover:bg-[#333537] text-[#8d96a0] hover:text-white"
                                                            title="Reply to this message"
                                                        >
                                                            <Reply className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                            {isChatLoading && (<div className="flex gap-4 justify-start px-2 mt-2"><div className="flex gap-1 h-2 items-center"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div></div></div>)}
                                            <div ref={chatEndRef} />
                                        </div>
                                    </div>
                                    {quoteTooltip && (<div className="fixed z-50 bg-[#333] text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-xl cursor-pointer hover:bg-blue-600 transition-colors transform -translate-x-1/2 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200" style={{ top: quoteTooltip.y, left: quoteTooltip.x }} onClick={handleReplyToSelection} onMouseDown={(e) => e.preventDefault()}><Reply className="w-3 h-3" /><span>Reply</span></div>)}
                                    {showScrollDownBtn && (<button onClick={scrollToBottom} className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20 bg-[#1e1e1e] text-white p-2.5 rounded-full shadow-2xl border border-[#333] hover:bg-[#333] transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 hover:scale-110 flex items-center justify-center group"><ArrowDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" /></button>)}
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0e1011] via-[#0e1011] to-transparent pt-10 pointer-events-none">
                                        <div className="max-w-3xl mx-auto bg-[#1e1f20] rounded-[2rem] p-3 flex flex-col shadow-2xl relative z-10 transition-all duration-300 pointer-events-auto">
                                            {replyingTo && (<div className="flex items-center justify-between bg-[#2b2d30] rounded-t-xl rounded-b-md px-4 py-2 mb-1 mx-1 animate-in fade-in zoom-in-95 border-b border-[#333]"><div className="flex items-center gap-3 overflow-hidden"><span className="material-symbols-outlined text-[16px] text-[#8d96a0]">reply</span><div className="flex flex-col"><span className="text-[10px] font-bold text-[#8d96a0] uppercase tracking-wider">Replying to</span><span className="text-xs text-[#e3e3e3] truncate max-w-[200px] font-medium">"{replyingTo.text}"</span></div></div><button onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-white/10 text-[#8d96a0] hover:text-white transition-colors"><X className="w-3 h-3" /></button></div>)}
                                            <div className="flex items-end gap-2">
                                                <div className="relative flex items-center gap-2">
                                                    <button onClick={() => setShowPlusMenu(!showPlusMenu)} className={`p-2.5 rounded-full transition-colors mb-0.5 ${showPlusMenu ? 'bg-[#333537] text-white' : 'hover:bg-[#333537] text-[#e3e3e3]'}`}><Plus className="w-5 h-5" /></button>
                                                    {activeToolId && (<div className="flex items-center gap-2 bg-[#2b3035] px-3 py-1.5 rounded-full text-xs text-[#e3e3e3] border border-[#333] animate-in fade-in zoom-in-95 duration-200 mb-0.5">
                                                        {(() => {
                                                            const { icon: ToolIcon, label } = getToolDetails(activeToolId);
                                                            return (
                                                                <>
                                                                    <ToolIcon className="w-3 h-3 text-blue-400" />
                                                                    <span className="font-medium">{label}</span>
                                                                </>
                                                            );
                                                        })()}
                                                        <button onClick={() => setActiveToolId(null)} className="ml-1 p-0.5 rounded-full hover:bg-white/10 hover:text-white text-[#8d96a0] transition-colors"><X className="w-3 h-3" /></button>
                                                    </div>)}
                                                    {showPlusMenu && (<PlusMenu onClose={() => setShowPlusMenu(false)} onSelect={handleMenuSelect} />)}
                                                </div>
                                                <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={chatInput} onChange={(e) => { setChatInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())} placeholder={connectedProject ? `Message (Context: ${connectedProject.title})...` : "Message Natural Assistant..."} className="flex-1 bg-transparent text-[#e3e3e3] placeholder-[#8e918f] text-base outline-none resize-none py-2.5 max-h-[120px] custom-scrollbar" rows={1} autoFocus />
                                                <div className="relative mb-1" ref={projectSelectorRef}>
                                                    <button onClick={() => setShowProjectSelector(!showProjectSelector)} className={`p-2 rounded-full transition-colors hidden sm:flex items-center justify-center w-8 h-8 ${connectedProject ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-[#333537] text-[#e3e3e3]'}`} title={connectedProject ? `Connected to ${connectedProject.title}` : "Connect to Project"}><span className="material-symbols-outlined text-[18px]">build</span></button>
                                                    {showProjectSelector && (<div className="absolute bottom-full right-0 mb-2 w-64 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-xl overflow-hidden z-20 animate-in zoom-in-95 duration-100"><div className="p-2 border-b border-[#333] text-xs font-medium text-[#8d96a0] bg-[#1a1b1d]">Connect Project Context</div><div className="max-h-48 overflow-y-auto custom-scrollbar p-1"><button onClick={() => { setConnectedProject(null); setShowProjectSelector(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#2b2d30] text-[#8d96a0] italic`}><span className="material-symbols-outlined text-sm">close</span>No Project</button>{visibleApps.map(app => (<button key={app.id} onClick={() => { setConnectedProject(app); setShowProjectSelector(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${connectedProject?.id === app.id ? 'bg-[#2b3035] text-white' : 'text-[#e3e3e3] hover:bg-[#2b2d30]'}`}><span className="material-symbols-outlined text-sm">{app.icon}</span><span className="truncate flex-1">{app.title}</span>{connectedProject?.id === app.id && <span className="material-symbols-outlined text-xs text-blue-400">check</span>}</button>))}</div></div>)}
                                                </div>
                                                <div className="relative mb-1" ref={modelDropdownRef}>
                                                    <button
                                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                                        className="px-2.5 h-8 rounded-xl hover:bg-[#333537] border border-[#2f3338] text-[#e3e3e3] transition-colors flex items-center justify-center gap-1 text-[10px] font-semibold"
                                                        title={`${selectedModelOption.label} - Best for ${selectedModelOption.bestFor}`}
                                                    >
                                                        <Sparkles className="w-3 h-3 text-blue-300" />
                                                        <span className="truncate max-w-[120px]">{selectedModelOption.label}</span>
                                                    </button>
                                                    {showModelDropdown && (
                                                        <div className="absolute bottom-full right-0 mb-2 w-72 bg-[#17191c] border border-[#2f3338] rounded-xl shadow-xl overflow-hidden z-20 animate-in zoom-in-95 duration-100">
                                                            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[#8d96a0]">Choose Model</div>
                                                            <div className="p-1">
                                                                {OPENROUTER_FREE_MODELS.map(model => (
                                                                    <button
                                                                        key={model.id}
                                                                        onClick={() => {
                                                                            setSelectedModel(model.id);
                                                                            setShowModelDropdown(false);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedModel === model.id ? 'bg-[#2b3036] text-white' : 'text-[#c4c7c5] hover:bg-[#23272c]'}`}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <div className="truncate font-medium">{model.label}</div>
                                                                            <div className="truncate text-[10px] text-[#8d96a0]">Best for: {model.bestFor}</div>
                                                                        </div>
                                                                        {selectedModel === model.id && <span className="material-symbols-outlined text-sm text-blue-300">check</span>}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {isTemporaryChat && !activeThreadId && (
                                                    <span className="mb-1 text-[10px] px-2 py-1 rounded-full border border-[#2f6b54] bg-[#1f3a2f] text-[#b5f5d2]">Temp</span>
                                                )}
                                                {chatInput.trim() ? (<button onClick={() => handleSendChat()} className="p-2.5 rounded-full bg-white text-black hover:bg-[#e3e3e3] transition-colors mb-0.5"><Send className="w-4 h-4 ml-0.5" /></button>) : activeToolId ? (<button onClick={() => handleSendChat()} className="p-2.5 rounded-full bg-blue-500 text-white hover:bg-blue-400 transition-colors mb-0.5"><Send className="w-4 h-4 ml-0.5" /></button>) : (<button onClick={handleMicClick} className={`p-2.5 rounded-full transition-colors mb-0.5 ${isListening ? 'bg-red-500/20 text-red-500' : 'hover:bg-[#333537] text-[#e3e3e3]'}`}><Mic className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} /></button>)}
                                            </div>
                                        </div>
                                        <div className="text-center text-[10px] text-[#8e918f] mt-3">Natural Assistant can make mistakes. Check important info.</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: LEARN */}
                    {currentView === 'learn' && <Learn />}

                </div>
            </main>

            {/* CREATE APP MODAL (RE-DESIGNED) */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowCreateModal(false)}>
                    <div className="w-full max-w-3xl bg-[#151719] border border-[#2b3035] rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
                        {/* Header Section */}
                        <div className="p-5 border-b border-[#2b3035] flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">Create Project</h2>
                                <p className="text-[13px] text-[#8d96a0]">Initialize a new application environment</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-[#8d96a0] hover:text-white transition-colors">
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content Section */}
                        <form onSubmit={handleCreateSubmit} className="p-6 bg-[#151719] overflow-y-auto">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[11px] font-bold text-[#666] uppercase tracking-widest mb-2">Project Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-[#0e1011] border border-[#2b3035] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:border-[#4f52b2] focus:ring-1 focus:ring-[#4f52b2] outline-none transition-all"
                                        placeholder="e.g., My Awesome App"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-[#666] uppercase tracking-widest mb-2">Description</label>
                                    <textarea
                                        className="w-full bg-[#0e1011] border border-[#2b3035] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:border-[#4f52b2] focus:ring-1 focus:ring-[#4f52b2] outline-none transition-all h-32 resize-none"
                                        placeholder="Describe what you want to build..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[11px] font-bold text-[#666] uppercase tracking-widest mb-2">Visibility</label>
                                        <div className="grid grid-cols-3 gap-1 bg-[#0e1011] rounded-xl p-1 border border-[#2b3035]">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, visibility: 'public' })}
                                                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${formData.visibility === 'public' ? 'bg-[#2b3035] text-white shadow-sm' : 'text-[#8d96a0] hover:text-white'}`}
                                            >
                                                Public
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, visibility: 'team' })}
                                                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${formData.visibility === 'team' ? 'bg-[#2b3035] text-white shadow-sm' : 'text-[#8d96a0] hover:text-white'}`}
                                            >
                                                Team
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, visibility: 'private' })}
                                                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${formData.visibility === 'private' ? 'bg-[#2b3035] text-white shadow-sm' : 'text-[#8d96a0] hover:text-white'}`}
                                            >
                                                Private
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-[#666] uppercase tracking-widest mb-2">Type</label>
                                        <div className="relative">
                                            <select
                                                value={formData.type}
                                                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                                className="w-full bg-[#0e1011] border border-[#2b3035] rounded-xl px-4 py-2.5 text-white focus:border-[#4f52b2] outline-none appearance-none cursor-pointer"
                                            >
                                                <option value="app">Web App</option>
                                                <option value="website">Static Website</option>
                                                <option value="api">Backend API</option>
                                                <option value="script">Script / Tool</option>
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8d96a0] pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-6 py-2.5 text-sm font-medium text-[#8d96a0] hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!formData.name}
                                    className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ${!formData.name ? 'bg-[#2b3035] text-[#8d96a0] cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200 hover:shadow-white/10'}`}
                                >
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE TEAM MODAL (Simplified Legacy) */}
            {showCreateTeamModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1c1e21] border border-[#2b3035] w-full max-w-lg rounded-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Create New Team</h2>
                            <button onClick={() => setShowCreateTeamModal(false)} className="text-[#8d96a0] hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTeam} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-[#8d96a0] uppercase tracking-wider mb-2">Team Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-[#0e1011] border border-[#2b3035] rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                                    placeholder="e.g., Acme Corp Engineering"
                                    value={teamFormData.name}
                                    onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#8d96a0] uppercase tracking-wider mb-2">Description (Optional)</label>
                                <textarea
                                    className="w-full bg-[#0e1011] border border-[#2b3035] rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors h-24 resize-none"
                                    placeholder="What is this team for?"
                                    value={teamFormData.description}
                                    onChange={(e) => setTeamFormData({ ...teamFormData, description: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateTeamModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-[#8d96a0] hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!teamFormData.name}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${!teamFormData.name ? 'bg-[#2b3035] text-[#8d96a0] cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200'}`}
                                >
                                    Create Team
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* NEW CHAT MODAL (Sleek Overlay) */}
            {showNewChatModal && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowNewChatModal(false)}>
                    <div className="w-full max-w-3xl bg-[#151719] border border-[#2b3035] rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
                        {/* Header Section */}
                        <div className="p-5 border-b border-[#2b3035]">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d96a0] text-[15px]">To:</span>
                                <input
                                    value={directChatEmailInput}
                                    onChange={(e) => setDirectChatEmailInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (newChatMode === 'direct') void handleCreateDirectChat();
                                            else if (newChatMode === 'group') handleCreateGroupChat();
                                            else handleCreateChannelFromModal();
                                        }
                                    }}
                                    className="w-full bg-[#0e1011] border border-[#2b3035] rounded-xl py-3 pl-12 pr-4 text-white placeholder-[#555] text-[15px] focus:outline-none focus:border-[#4f52b2] focus:ring-1 focus:ring-[#4f52b2] transition-all"
                                    placeholder={newChatMode === 'direct'
                                        ? "Enter email to start direct chat"
                                        : newChatMode === 'group'
                                            ? "Optional first member email"
                                            : "Channel name (e.g. bugs)"
                                    }
                                    autoFocus
                                />
                            </div>
                            {newChatMode === 'group' && (
                                <div className="mt-3 space-y-2">
                                    <input
                                        value={groupChatNameInput}
                                        onChange={(e) => setGroupChatNameInput(e.target.value)}
                                        className="w-full bg-[#0e1011] border border-[#2b3035] rounded-lg py-2 px-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4f52b2]"
                                        placeholder="Group chat name (you can create empty)"
                                    />
                                    <div className="rounded-lg border border-[#2b3035] bg-[#0e1011] p-2">
                                        <div className="text-[11px] text-[#8d96a0] mb-2">Quick add from your direct chats</div>
                                        <div className="max-h-28 overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
                                            {visibleDirectChats.map(dm => {
                                                const selected = selectedGroupMemberUserIds.includes(dm.otherUserId);
                                                return (
                                                    <button
                                                        key={`pick-${dm.chatId}`}
                                                        onClick={() => setSelectedGroupMemberUserIds(prev => selected ? prev.filter(id => id !== dm.otherUserId) : [...prev, dm.otherUserId])}
                                                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${selected ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-[#1b1e21] border-[#2b3035] text-[#c7cdd3] hover:bg-[#25282c]'}`}
                                                    >
                                                        {dm.otherName}
                                                    </button>
                                                );
                                            })}
                                            {visibleDirectChats.length === 0 && (
                                                <div className="text-xs text-[#8d96a0]">No direct chats found.</div>
                                            )}
                                        </div>
                                    </div>
                                    <input
                                        value={groupChatMembersInput}
                                        onChange={(e) => setGroupChatMembersInput(e.target.value)}
                                        className="w-full bg-[#0e1011] border border-[#2b3035] rounded-lg py-2 px-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4f52b2]"
                                        placeholder="Optional: add by emails too (comma-separated)"
                                    />
                                </div>
                            )}
                            {newChatMode === 'channel' && (
                                <div className="mt-3">
                                    <input
                                        value={newChannelNameInput}
                                        onChange={(e) => setNewChannelNameInput(e.target.value)}
                                        className="w-full bg-[#0e1011] border border-[#2b3035] rounded-lg py-2 px-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#4f52b2]"
                                        placeholder="Channel name"
                                    />
                                </div>
                            )}
                            <div className="mt-3 flex justify-end">
                                <button
                                    onClick={() => {
                                        if (newChatMode === 'direct') void handleCreateDirectChat();
                                        else if (newChatMode === 'group') handleCreateGroupChat();
                                        else handleCreateChannelFromModal();
                                    }}
                                    disabled={
                                        isCreatingDirectChat ||
                                        (newChatMode === 'direct' && !directChatEmailInput.trim()) ||
                                        (newChatMode === 'group' && !groupChatNameInput.trim()) ||
                                        (newChatMode === 'channel' && !newChannelNameInput.trim())
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isCreatingDirectChat ||
                                        (newChatMode === 'direct' && !directChatEmailInput.trim()) ||
                                        (newChatMode === 'group' && !groupChatNameInput.trim()) ||
                                        (newChatMode === 'channel' && !newChannelNameInput.trim())
                                        ? 'bg-[#2b3035] text-[#8d96a0] cursor-not-allowed'
                                        : 'bg-white text-black hover:bg-gray-200'
                                        }`}
                                >
                                    {isCreatingDirectChat
                                        ? 'Creating...'
                                        : newChatMode === 'direct'
                                            ? 'Start Direct Chat'
                                            : newChatMode === 'group'
                                                ? 'Create Group Chat'
                                                : 'Create Channel'}
                                </button>
                                {newChatMode !== 'channel' && (
                                    <button
                                        onClick={handleSendChatRequest}
                                        disabled={!directChatEmailInput.trim()}
                                        className={`ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!directChatEmailInput.trim()
                                            ? 'bg-[#2b3035] text-[#8d96a0] cursor-not-allowed'
                                            : 'bg-[#1f2937] text-[#d1d5db] hover:bg-[#374151]'
                                            }`}
                                    >
                                        Send Request
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-8 mt-5 px-1 text-sm font-medium text-[#8d96a0]">
                                <button onClick={() => setNewChatMode('direct')} className={`${newChatMode === 'direct' ? 'text-white border-white' : 'hover:text-white border-transparent hover:border-[#2b3035]'} pb-2.5 border-b-2 transition-colors`}>Direct</button>
                                <button onClick={() => setNewChatMode('group')} className={`${newChatMode === 'group' ? 'text-white border-white' : 'hover:text-white border-transparent hover:border-[#2b3035]'} pb-2.5 border-b-2 transition-colors`}>Groups</button>
                                <button onClick={() => setNewChatMode('channel')} className={`${newChatMode === 'channel' ? 'text-white border-white' : 'hover:text-white border-transparent hover:border-[#2b3035]'} pb-2.5 border-b-2 transition-colors`}>Channels</button>
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="p-6 bg-[#151719] min-h-[420px] custom-scrollbar overflow-y-auto">

                            {/* Create Options */}
                            <div className="mb-8">
                                <h4 className="text-[11px] font-bold text-[#666] uppercase tracking-widest mb-4">Create</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <button onClick={() => setNewChatMode('channel')} className="flex flex-col p-4 bg-[#1c1e21] border border-[#2b3035] rounded-xl hover:bg-[#25282c] hover:border-[#3f4145] transition-all text-left group">
                                        <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 border border-green-500/20">
                                            <Hash className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-bold text-white mb-1 group-hover:text-green-400 transition-colors">New Channel</span>
                                        <span className="text-[11px] text-[#8d96a0] leading-tight">Chat and work with your team</span>
                                    </button>
                                    <button onClick={() => setNewChatMode('direct')} className="flex flex-col p-4 bg-[#1c1e21] border border-[#2b3035] rounded-xl hover:bg-[#25282c] hover:border-[#3f4145] transition-all text-left group">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 border border-blue-500/20">
                                            <UserPlus className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">New Direct Message</span>
                                        <span className="text-[11px] text-[#8d96a0] leading-tight">Communicate with a team member</span>
                                    </button>
                                    <button onClick={() => setNewChatMode('group')} className="flex flex-col p-4 bg-[#1c1e21] border border-[#2b3035] rounded-xl hover:bg-[#25282c] hover:border-[#3f4145] transition-all text-left group">
                                        <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 border border-orange-500/20">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">New Group Message</span>
                                        <span className="text-[11px] text-[#8d96a0] leading-tight">A DM, but with more team members</span>
                                    </button>
                                </div>
                            </div>

                            {/* Chat Requests */}
                            <div className="mb-8">
                                <div className="flex justify-between items-end mb-3 px-1">
                                    <h4 className="text-[11px] font-bold text-[#666] uppercase tracking-widest">Chat Requests</h4>
                                </div>
                                <div className="space-y-2">
                                    {pendingChatRequests.map(req => (
                                        <div key={req.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#2b3035] bg-[#111315] px-3 py-2">
                                            <div>
                                                <div className="text-sm text-white font-medium">{req.groupName || req.email}</div>
                                                <div className="text-[11px] text-[#8d96a0]">{req.type === 'group' ? 'Group chat request' : 'Direct chat request'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => void handleAcceptChatRequest(req.id)} className="px-2.5 py-1 rounded text-xs bg-white text-black hover:bg-gray-200">Accept</button>
                                                <button onClick={() => handleDeclineChatRequest(req.id)} className="px-2.5 py-1 rounded text-xs bg-[#2b3035] text-[#c7cdd3] hover:bg-[#33363b]">Decline</button>
                                            </div>
                                        </div>
                                    ))}
                                    {pendingChatRequests.length === 0 && (
                                        <div className="text-xs text-[#8d96a0] px-1 py-2">No pending chat requests.</div>
                                    )}
                                </div>
                            </div>

                            {/* Blocked Users */}
                            <div className="mb-8">
                                <div className="flex justify-between items-end mb-3 px-1">
                                    <h4 className="text-[11px] font-bold text-[#666] uppercase tracking-widest">Blocked Users</h4>
                                </div>
                                <div className="space-y-2">
                                    {directChats.filter(dm => blockedUserIds.includes(dm.otherUserId)).map(dm => (
                                        <div key={`blocked-${dm.chatId}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#2b3035] bg-[#111315] px-3 py-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {isHttpUrl(dm.otherAvatar) ? (
                                                    <img src={dm.otherAvatar} alt={dm.otherName} className="w-8 h-8 rounded-full object-cover border border-[#2b3035]" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-300 text-[11px] font-bold flex items-center justify-center">{dm.otherAvatar.slice(0, 2).toUpperCase()}</div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-sm text-white truncate">{dm.otherName}</div>
                                                    <div className="text-[11px] text-red-300">Blocked</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => void (async () => {
                                                        await unblockUser(dm.otherUserId);
                                                        const blocked = await listBlockedUsers();
                                                        setBlockedUserIds(blocked);
                                                        selectDM(dm.chatId);
                                                    })()}
                                                    className="px-2.5 py-1 rounded text-xs bg-white text-black hover:bg-gray-200"
                                                >
                                                    Unblock
                                                </button>
                                                <button
                                                    onClick={() => { selectDM(dm.chatId); setShowNewChatModal(false); }}
                                                    className="px-2.5 py-1 rounded text-xs bg-[#2b3035] text-[#c7cdd3] hover:bg-[#33363b]"
                                                >
                                                    Open
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {directChats.filter(dm => blockedUserIds.includes(dm.otherUserId)).length === 0 && (
                                        <div className="text-xs text-[#8d96a0] px-1 py-2">No blocked users.</div>
                                    )}
                                </div>
                            </div>

                            {/* Archived Direct Chats */}
                            <div className="mb-8">
                                <div className="flex justify-between items-end mb-3 px-1">
                                    <h4 className="text-[11px] font-bold text-[#666] uppercase tracking-widest">Archived Chats</h4>
                                </div>
                                <div className="space-y-2">
                                    {directChats.filter(dm => archivedDirectChatIds.includes(dm.chatId)).map(dm => (
                                        <div key={`archived-${dm.chatId}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#2b3035] bg-[#111315] px-3 py-2">
                                            <div className="min-w-0">
                                                <div className="text-sm text-white truncate">{dm.otherName}</div>
                                                <div className="text-[11px] text-[#8d96a0]">Archived</div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => void (async () => {
                                                        await setChatArchived('direct', dm.chatId, false);
                                                        const archived = await listArchivedChatIds('direct');
                                                        setArchivedDirectChatIds(archived);
                                                    })()}
                                                    className="px-2.5 py-1 rounded text-xs bg-white text-black hover:bg-gray-200"
                                                >
                                                    Unarchive
                                                </button>
                                                <button
                                                    onClick={() => void (async () => {
                                                        await setChatArchived('direct', dm.chatId, false);
                                                        const archived = await listArchivedChatIds('direct');
                                                        setArchivedDirectChatIds(archived);
                                                        selectDM(dm.chatId);
                                                        setShowNewChatModal(false);
                                                    })()}
                                                    className="px-2.5 py-1 rounded text-xs bg-[#2b3035] text-[#c7cdd3] hover:bg-[#33363b]"
                                                >
                                                    Open
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {directChats.filter(dm => archivedDirectChatIds.includes(dm.chatId)).length === 0 && (
                                        <div className="text-xs text-[#8d96a0] px-1 py-2">No archived chats.</div>
                                    )}
                                </div>
                            </div>

                            {/* Direct Messages List */}
                            <div className="mb-8">
                                <div className="flex justify-between items-end mb-4 px-1">
                                    <h4 className="text-[11px] font-bold text-[#666] uppercase tracking-widest">Direct Messages</h4>
                                    <button onClick={() => setNewChatMode('direct')} className="text-[11px] font-bold text-[#4f52b2] hover:text-[#6a6dd9] transition-colors">View all</button>
                                </div>
                                <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                                    {visibleDirectChats.map(dm => {
                                        const isBlocked = blockedUserIds.includes(dm.otherUserId);
                                        const dmLabel = (directChatSettingsMap[dm.chatId]?.nickname || '').trim() || dm.otherName;
                                        return (
                                            <button key={dm.chatId} onClick={() => { selectDM(dm.chatId); setShowNewChatModal(false); }} className="flex flex-col items-center gap-2 group min-w-[72px]">
                                                {isHttpUrl(dm.otherAvatar) ? (
                                                    <img src={dm.otherAvatar} alt={dm.otherName} className="w-14 h-14 rounded-full object-cover border border-[#2b3035] transition-transform duration-300 group-hover:scale-105 shadow-lg" />
                                                ) : (
                                                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold text-white transition-transform duration-300 group-hover:scale-105 shadow-lg bg-blue-600">
                                                        {dm.otherAvatar.slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="text-xs text-[#8d96a0] group-hover:text-white transition-colors font-medium truncate w-full text-center">{dmLabel.split(' ')[0]}</span>
                                                {isBlocked && <span className="text-[10px] text-red-300 -mt-1">Blocked</span>}
                                            </button>
                                        )
                                    })}
                                    {visibleDirectChats.length === 0 && (
                                        <div className="text-xs text-[#8d96a0] py-4">No direct chats yet. Start one by email above.</div>
                                    )}
                                    <button onClick={handleSendChatRequest} className="flex flex-col items-center gap-2 group min-w-[72px]">
                                        <div className="w-14 h-14 rounded-full bg-[#1c1e21] border-2 border-[#2b3035] border-dashed flex items-center justify-center text-[#8d96a0] group-hover:text-white group-hover:border-white/30 transition-all duration-300 group-hover:bg-[#25282c]">
                                            <Plus className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs text-[#8d96a0] group-hover:text-white transition-colors font-medium">Invite</span>
                                    </button>
                                </div>
                            </div>

                            {/* Channels List */}
                            <div>
                                <div className="flex justify-between items-end mb-3 px-1">
                                    <h4 className="text-[11px] font-bold text-[#666] uppercase tracking-widest">Channels</h4>
                                    <button onClick={() => setNewChatMode('channel')} className="text-[11px] font-bold text-[#4f52b2] hover:text-[#6a6dd9] transition-colors">Create</button>
                                </div>
                                <div className="space-y-1">
                                    {teams.flatMap(team => ['General', 'Design', 'Engineering', 'Random'].map(channel => ({ team, channel }))).map(({ team, channel }) => (
                                        <button key={`${team.id}-${channel}`} onClick={() => { selectChannel(team.id, channel); setShowNewChatModal(false); }} className="w-full flex items-center gap-4 p-3 hover:bg-[#1c1e21] rounded-xl transition-colors group text-left">
                                            <div className="w-10 h-10 rounded-lg bg-[#2b3035] flex items-center justify-center text-[#8d96a0] group-hover:text-white group-hover:bg-[#333] transition-colors">
                                                <Hash className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-[#e3e3e3] group-hover:text-white">{channel}</span>
                                                <span className="text-[11px] text-[#666] group-hover:text-[#8d96a0]">{team.name}</span>
                                            </div>
                                        </button>
                                    ))}
                                    {teams.length === 0 && (
                                        <div className="text-xs text-[#8d96a0] px-1 py-2">Create a team first to add channels.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAdvancedChatSettings && activeChat && (
                <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAdvancedChatSettings(false)}>
                    <div className="w-full max-w-4xl rounded-2xl border border-[#2b3035] bg-[#111315] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2b3035] bg-[#151719]">
                            <div>
                                <h3 className="text-lg font-bold text-white">Chat Settings</h3>
                                <p className="text-xs text-[#8d96a0] mt-0.5">{displayChatTitle}</p>
                            </div>
                            <button onClick={() => setShowAdvancedChatSettings(false)} className="p-2 rounded-lg text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-[210px_1fr] min-h-[460px]">
                            <div className="border-r border-[#2b3035] bg-[#0f1113] p-3 space-y-1">
                                <button onClick={() => setChatSettingsTab('overview')} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${chatSettingsTab === 'overview' ? 'bg-[#1c1e21] text-white' : 'text-[#9aa3ad] hover:bg-[#1a1d20] hover:text-white'}`}>Overview</button>
                                <button onClick={() => setChatSettingsTab('notifications')} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${chatSettingsTab === 'notifications' ? 'bg-[#1c1e21] text-white' : 'text-[#9aa3ad] hover:bg-[#1a1d20] hover:text-white'}`}>Notifications</button>
                                <button onClick={() => setChatSettingsTab('privacy')} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${chatSettingsTab === 'privacy' ? 'bg-[#1c1e21] text-white' : 'text-[#9aa3ad] hover:bg-[#1a1d20] hover:text-white'}`}>Privacy</button>
                                <button onClick={() => setChatSettingsTab('advanced')} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${chatSettingsTab === 'advanced' ? 'bg-[#1c1e21] text-white' : 'text-[#9aa3ad] hover:bg-[#1a1d20] hover:text-white'}`}>Advanced</button>
                            </div>
                            <div className="p-5 overflow-y-auto custom-scrollbar space-y-5">
                                {chatSettingsTab === 'overview' && (
                                    <>
                                        <div className="rounded-xl border border-[#2b3035] bg-[#151719] p-4">
                                            <div className="text-sm font-semibold text-white mb-3">Profile</div>
                                            <label className="text-xs text-[#8d96a0]">Nickname in this chat</label>
                                            <div className="mt-2 flex gap-2">
                                                <input
                                                    value={settingsNicknameInput}
                                                    onChange={(e) => setSettingsNicknameInput(e.target.value)}
                                                    placeholder="Set nickname"
                                                    className="flex-1 bg-[#0f1113] border border-[#2b3035] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                                />
                                                <button
                                                    onClick={() => void patchActiveChatSettings({ nickname: settingsNicknameInput.trim() })}
                                                    className="px-3 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-gray-200"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                            {activeChat?.kind === 'group' && (
                                                <div className="mt-4">
                                                    <label className="text-xs text-[#8d96a0]">Group avatar</label>
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <input
                                                            value={groupAvatarInput}
                                                            onChange={(e) => setGroupAvatarInput(e.target.value)}
                                                            placeholder="Image URL"
                                                            className="flex-1 bg-[#0f1113] border border-[#2b3035] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                                        />
                                                        <button onClick={() => void saveActiveGroupAvatarUrl()} className="px-3 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-gray-200">Save</button>
                                                        <button onClick={() => groupAvatarFileRef.current?.click()} className="px-3 py-2 rounded-lg bg-[#2b3035] text-[#d1d5db] text-xs font-semibold hover:bg-[#33363b]">Upload</button>
                                                        <input ref={groupAvatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleGroupAvatarFilePick} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="rounded-xl border border-[#2b3035] bg-[#151719] p-4">
                                            <div className="text-sm font-semibold text-white mb-3">Layout</div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                {(['default', 'midnight', 'forest', 'sunset'] as const).map(theme => (
                                                    <button
                                                        key={theme}
                                                        onClick={() => void patchActiveChatSettings({ theme })}
                                                        className={`px-3 py-2 rounded-lg border transition-colors ${activeChatSettings?.theme === theme ? 'border-white text-white bg-[#1c1e21]' : 'border-[#2b3035] text-[#9aa3ad] hover:text-white hover:bg-[#1c1e21]'}`}
                                                    >
                                                        {theme}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-[#2b3035] bg-[#151719] p-4 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-white">Pin this chat</div>
                                                <div className="text-xs text-[#8d96a0]">Keep it at the top of your list</div>
                                            </div>
                                            <button
                                                onClick={() => void patchActiveChatSettings({ pinned: !(activeChatSettings?.pinned ?? false) })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${(activeChatSettings?.pinned ?? false) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}
                                            >
                                                {(activeChatSettings?.pinned ?? false) ? 'Pinned' : 'Pin'}
                                            </button>
                                        </div>
                                        <div className="rounded-xl border border-[#2b3035] bg-[#151719] p-4 space-y-3">
                                            <div className="text-sm font-semibold text-white">Display</div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-[#d1d5db]">Show timestamps</span>
                                                <button onClick={() => void patchActiveExtra('showTimestamps', !getExtraBool('showTimestamps', true))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('showTimestamps', true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('showTimestamps', true) ? 'On' : 'Off'}</button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-[#d1d5db]">24-hour clock</span>
                                                <button onClick={() => void patchActiveExtra('use24HourTime', !getExtraBool('use24HourTime', false))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('use24HourTime', false) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('use24HourTime', false) ? 'On' : 'Off'}</button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-[#d1d5db]">Show avatars</span>
                                                <button onClick={() => void patchActiveExtra('showAvatars', !getExtraBool('showAvatars', true))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('showAvatars', true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('showAvatars', true) ? 'On' : 'Off'}</button>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {chatSettingsTab === 'notifications' && (
                                    <>
                                        <div className="rounded-xl border border-[#2b3035] bg-[#151719] p-4 space-y-3">
                                            <div className="text-sm font-semibold text-white">Notifications</div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-[#d1d5db]">Message notifications</span>
                                                <button onClick={() => void patchActiveChatSettings({ notificationsEnabled: !(activeChatSettings?.notificationsEnabled ?? true) })} className={`px-3 py-1.5 rounded text-xs ${(activeChatSettings?.notificationsEnabled ?? true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{(activeChatSettings?.notificationsEnabled ?? true) ? 'On' : 'Off'}</button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-[#d1d5db]">Sound effects</span>
                                                <button onClick={() => void patchActiveChatSettings({ soundsEnabled: !(activeChatSettings?.soundsEnabled ?? true) })} className={`px-3 py-1.5 rounded text-xs ${(activeChatSettings?.soundsEnabled ?? true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{(activeChatSettings?.soundsEnabled ?? true) ? 'On' : 'Off'}</button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-[#d1d5db]">@mention alerts</span>
                                                <button onClick={() => void patchActiveChatSettings({ mentionNotifications: !(activeChatSettings?.mentionNotifications ?? true) })} className={`px-3 py-1.5 rounded text-xs ${(activeChatSettings?.mentionNotifications ?? true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{(activeChatSettings?.mentionNotifications ?? true) ? 'On' : 'Off'}</button>
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-[#2b3035] bg-[#151719] p-4">
                                            <div className="text-sm font-semibold text-white mb-3">Mute duration</div>
                                            <div className="flex flex-wrap gap-2">
                                                <button onClick={() => void patchActiveChatSettings({ mutedUntil: null })} className="px-3 py-1.5 rounded-lg text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">Unmute</button>
                                                <button onClick={() => void patchActiveChatSettings({ mutedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() })} className="px-3 py-1.5 rounded-lg text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">1 hour</button>
                                                <button onClick={() => void patchActiveChatSettings({ mutedUntil: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() })} className="px-3 py-1.5 rounded-lg text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">8 hours</button>
                                                <button onClick={() => void patchActiveChatSettings({ mutedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })} className="px-3 py-1.5 rounded-lg text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">24 hours</button>
                                                <button onClick={() => void patchActiveChatSettings({ mutedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })} className="px-3 py-1.5 rounded-lg text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">7 days</button>
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-[#2b3035] bg-[#151719] p-4">
                                            <div className="text-sm font-semibold text-white mb-2">Keyword Alerts</div>
                                            <input
                                                value={getExtraString('keywordAlerts', '')}
                                                onChange={(e) => void patchActiveExtra('keywordAlerts', e.target.value)}
                                                placeholder="release, urgent, deploy"
                                                className="w-full bg-[#0f1113] border border-[#2b3035] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                            />
                                            <div className="text-[11px] text-[#8d96a0] mt-2">Play a sound if incoming messages include these keywords.</div>
                                        </div>
                                    </>
                                )}
                                {chatSettingsTab === 'privacy' && (
                                    <div className="rounded-xl border border-[#2b3035] bg-[#151719] p-4 space-y-3">
                                        <div className="text-sm font-semibold text-white">Privacy Controls</div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Read receipts</span>
                                            <button onClick={() => void patchActiveChatSettings({ readReceipts: !(activeChatSettings?.readReceipts ?? true) })} className={`px-3 py-1.5 rounded text-xs ${(activeChatSettings?.readReceipts ?? true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{(activeChatSettings?.readReceipts ?? true) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Show embeds/media previews</span>
                                            <button onClick={() => void patchActiveChatSettings({ showEmbeds: !(activeChatSettings?.showEmbeds ?? true) })} className={`px-3 py-1.5 rounded text-xs ${(activeChatSettings?.showEmbeds ?? true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{(activeChatSettings?.showEmbeds ?? true) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Highlight mentions</span>
                                            <button onClick={() => void patchActiveExtra('highlightMentions', !getExtraBool('highlightMentions', true))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('highlightMentions', true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('highlightMentions', true) ? 'On' : 'Off'}</button>
                                        </div>
                                        {activeDirectChat && (
                                            <div className="pt-2 border-t border-[#2b3035] flex items-center justify-between">
                                                <span className="text-sm text-[#d1d5db]">{isActiveDirectBlocked ? 'User is blocked' : 'Block this user'}</span>
                                                <button onClick={toggleBlockActiveUser} className={`px-3 py-1.5 rounded text-xs ${isActiveDirectBlocked ? 'bg-[#2b3035] text-[#d1d5db]' : 'bg-red-500/20 text-red-300'}`}>{isActiveDirectBlocked ? 'Unblock' : 'Block'}</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {chatSettingsTab === 'advanced' && (
                                    <div className="rounded-xl border border-[#2b3035] bg-[#151719] p-4 space-y-3">
                                        <div className="text-sm font-semibold text-white">Advanced</div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Compact mode</span>
                                            <button onClick={() => void patchActiveChatSettings({ compactMode: !(activeChatSettings?.compactMode ?? false) })} className={`px-3 py-1.5 rounded text-xs ${(activeChatSettings?.compactMode ?? false) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{(activeChatSettings?.compactMode ?? false) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Enter to send</span>
                                            <button onClick={() => void patchActiveChatSettings({ enterToSend: !(activeChatSettings?.enterToSend ?? true) })} className={`px-3 py-1.5 rounded text-xs ${(activeChatSettings?.enterToSend ?? true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{(activeChatSettings?.enterToSend ?? true) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Render markdown</span>
                                            <button onClick={() => void patchActiveExtra('renderMarkdown', !getExtraBool('renderMarkdown', true))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('renderMarkdown', true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('renderMarkdown', true) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Message animations</span>
                                            <button onClick={() => void patchActiveExtra('messageAnimations', !getExtraBool('messageAnimations', true))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('messageAnimations', true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('messageAnimations', true) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Typing indicator</span>
                                            <button onClick={() => void patchActiveExtra('showTypingIndicator', !getExtraBool('showTypingIndicator', true))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('showTypingIndicator', true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('showTypingIndicator', true) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Auto-scroll on new messages</span>
                                            <button onClick={() => void patchActiveExtra('autoScrollIncoming', !getExtraBool('autoScrollIncoming', true))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('autoScrollIncoming', true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('autoScrollIncoming', true) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Spell check</span>
                                            <button onClick={() => void patchActiveExtra('spellCheck', !getExtraBool('spellCheck', true))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('spellCheck', true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('spellCheck', true) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[#d1d5db]">Confirm before delete</span>
                                            <button onClick={() => void patchActiveExtra('confirmDelete', !getExtraBool('confirmDelete', true))} className={`px-3 py-1.5 rounded text-xs ${getExtraBool('confirmDelete', true) ? 'bg-white text-black' : 'bg-[#2b3035] text-[#d1d5db]'}`}>{getExtraBool('confirmDelete', true) ? 'On' : 'Off'}</button>
                                        </div>
                                        <div className="pt-2 border-t border-[#2b3035] flex flex-wrap gap-2">
                                            <button onClick={handleClearChatForMe} className="px-3 py-1.5 rounded text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">Clear chat (for me)</button>
                                            <button onClick={() => void handleArchiveActiveChat(true)} className="px-3 py-1.5 rounded text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">Archive chat</button>
                                            <button onClick={() => void handleArchiveActiveChat(false)} className="px-3 py-1.5 rounded text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">Unarchive chat</button>
                                            <button onClick={() => exportActiveChat('json')} className="px-3 py-1.5 rounded text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">Export JSON</button>
                                            <button onClick={() => exportActiveChat('txt')} className="px-3 py-1.5 rounded text-xs bg-[#2b3035] text-[#d1d5db] hover:bg-[#33363b]">Export TXT</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {chatContextMenu && (
                <div
                    className="fixed z-[135] chat-context-menu min-w-[230px] rounded-2xl border border-[#2b3035] bg-[#101214]/96 backdrop-blur-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150"
                    style={{ left: chatContextMenu.x, top: chatContextMenu.y }}
                >
                    <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-[#8d96a0] font-semibold">
                        {chatContextMenu.kind === 'direct' ? 'Direct Chat' : 'Group Chat'}
                    </div>
                    <button
                        onClick={() => {
                            if (chatContextMenu.kind === 'direct') selectDM(chatContextMenu.chatId);
                            else selectGroupChat(chatContextMenu.chatId);
                            setChatContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm text-[#e3e3e3] hover:bg-[#1c1e21] transition-colors"
                    >
                        Open Chat
                    </button>
                    <button
                        onClick={() => {
                            if (chatContextMenu.kind === 'direct') setActiveTeamChatId(`dm-${chatContextMenu.chatId}`);
                            if (chatContextMenu.kind === 'group') setActiveTeamChatId(`gc-${chatContextMenu.chatId}`);
                            setTimeout(() => openChatSettingsPanel(), 0);
                            setChatContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm text-[#e3e3e3] hover:bg-[#1c1e21] transition-colors"
                    >
                        Open Settings
                    </button>
                    <button onClick={() => void handleContextTogglePin()} className="w-full text-left px-3 py-2 rounded-xl text-sm text-[#e3e3e3] hover:bg-[#1c1e21] transition-colors">
                        {chatContextMenu.kind === 'direct' && directChatSettingsMap[chatContextMenu.chatId]?.pinned ? 'Unpin Chat' : 'Pin Chat'}
                    </button>
                    <button onClick={() => void handleContextMuteHour()} className="w-full text-left px-3 py-2 rounded-xl text-sm text-[#e3e3e3] hover:bg-[#1c1e21] transition-colors">
                        Mute 1 Hour
                    </button>
                    <button onClick={() => void handleContextArchiveToggle()} className="w-full text-left px-3 py-2 rounded-xl text-sm text-[#e3e3e3] hover:bg-[#1c1e21] transition-colors">
                        {chatContextMenu.kind === 'direct' && archivedDirectChatIds.includes(chatContextMenu.chatId) ? 'Unarchive Chat' : 'Archive Chat'}
                    </button>
                    {chatContextMenu.kind === 'group' && (
                        <button onClick={openAddMembersFromContext} className="w-full text-left px-3 py-2 rounded-xl text-sm text-[#e3e3e3] hover:bg-[#1c1e21] transition-colors">
                            Add Members
                        </button>
                    )}
                    {chatContextMenu.kind === 'direct' && chatContextMenu.otherUserId && (
                        <div className="mt-1 pt-1 border-t border-[#2b3035]">
                            <button onClick={() => void handleContextBlockToggle()} className="w-full text-left px-3 py-2 rounded-xl text-sm text-red-300 hover:bg-[#1c1e21] transition-colors">
                                {blockedUserIds.includes(chatContextMenu.otherUserId) ? 'Unblock User' : 'Block User'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showAddMembersModal && (
                <div className="fixed inset-0 z-[136] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddMembersModal(false)}>
                    <div className="w-full max-w-lg rounded-2xl border border-[#2b3035] bg-[#151719] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-[#2b3035]">
                            <h3 className="text-white font-semibold">Add Members to Group Chat</h3>
                            <p className="text-xs text-[#8d96a0] mt-0.5">Pick members from your direct chats.</p>
                        </div>
                        <div className="p-4 max-h-[320px] overflow-y-auto custom-scrollbar space-y-2">
                            {visibleDirectChats.map(dm => {
                                const selected = addMembersSelection.includes(dm.otherUserId);
                                return (
                                    <button
                                        key={`add-member-${dm.chatId}`}
                                        onClick={() => setAddMembersSelection(prev => selected ? prev.filter(id => id !== dm.otherUserId) : [...prev, dm.otherUserId])}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${selected ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-[#101214] border-[#2b3035] text-[#e3e3e3] hover:bg-[#1c1e21]'}`}
                                    >
                                        <span className="truncate">{dm.otherName}</span>
                                        {selected && <Check className="w-4 h-4" />}
                                    </button>
                                );
                            })}
                            {visibleDirectChats.length === 0 && (
                                <div className="text-xs text-[#8d96a0]">No direct chats available.</div>
                            )}
                        </div>
                        <div className="px-4 py-3 border-t border-[#2b3035] flex justify-end gap-2">
                            <button onClick={() => setShowAddMembersModal(false)} className="px-3 py-1.5 rounded-lg text-sm text-[#c5c9ce] hover:bg-[#1c1e21]">Cancel</button>
                            <button
                                onClick={() => void handleConfirmAddMembers()}
                                className={`px-3 py-1.5 rounded-lg text-sm ${addMembersSelection.length === 0 ? 'bg-[#2b3035] text-[#8d96a0]' : 'bg-white text-black hover:bg-gray-200'}`}
                                disabled={addMembersSelection.length === 0}
                            >
                                Add Members
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {blockComposer && (
                <div className="fixed inset-0 z-[137] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBlockComposer(null)}>
                    <div className="w-full max-w-2xl rounded-2xl border border-[#2b3345] bg-[linear-gradient(165deg,#0f1420_0%,#0b0f18_70%)] shadow-[0_30px_60px_rgba(0,0,0,0.55)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-[#2b3345] flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-semibold text-base">Create {BLOCK_META[blockComposer.kind].label} Block</h3>
                                <p className="text-xs text-[#8d96a0] mt-1">Build an interactive card for this conversation.</p>
                            </div>
                            <button onClick={() => setBlockComposer(null)} className="p-1.5 rounded-lg text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {BLOCK_KINDS.map((kind) => (
                                    <button
                                        key={`composer-kind-${kind}`}
                                        onClick={() => setBlockComposer(prev => prev ? { ...prev, kind } : prev)}
                                        className={`text-left px-2.5 py-2 rounded-xl border transition-all ${blockComposer.kind === kind ? 'border-blue-400/50 bg-blue-500/15 shadow-[0_0_0_1px_rgba(96,165,250,0.25)]' : 'border-[#2b3443] bg-[#121927] hover:bg-[#192234]'}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[13px] font-semibold text-white truncate">{BLOCK_META[kind].label}</span>
                                            <span className="text-sm">{BLOCK_META[kind].icon}</span>
                                        </div>
                                        <div className="text-[10px] text-[#8ea2c7] mt-1 line-clamp-1">{BLOCK_META[kind].hint}</div>
                                    </button>
                                ))}
                            </div>

                            <div className={`rounded-xl border border-[#2f3d56] bg-gradient-to-r ${BLOCK_META[blockComposer.kind].glow} px-3 py-2`}>
                                <div className="text-[11px] uppercase tracking-[0.15em] text-white/75">Template Preview</div>
                                <div className="text-sm text-white font-medium mt-1">{BLOCK_META[blockComposer.kind].label}</div>
                                <div className="text-xs text-white/80 mt-0.5">{BLOCK_META[blockComposer.kind].hint}</div>
                            </div>

                            <div>
                                <label className="text-xs text-[#8d96a0]">Title</label>
                                <input
                                    value={blockComposer.title}
                                    onChange={(e) => setBlockComposer(prev => prev ? { ...prev, title: e.target.value } : prev)}
                                    className="mt-1 w-full bg-[#151b24] border border-[#2b3443] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                />
                            </div>

                            {(blockComposer.kind === 'poll' || blockComposer.kind === 'decision') && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs text-[#8d96a0]">Options</label>
                                        <button
                                            type="button"
                                            onClick={() => setBlockComposer(prev => prev ? { ...prev, optionsList: [...prev.optionsList, `Option ${prev.optionsList.length + 1}`] } : prev)}
                                            className="px-2 py-1 text-[11px] rounded-md bg-[#172132] border border-[#2f3d56] text-[#c7d2e6] hover:bg-[#1f2d45]"
                                        >
                                            Add option
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {blockComposer.optionsList.map((option, idx) => (
                                            <div key={`block-opt-${idx}`} className="flex items-center gap-2">
                                                <span className="text-[11px] text-[#8ea2c7] w-5 text-right">{idx + 1}.</span>
                                                <input
                                                    value={option}
                                                    onChange={(e) => setBlockComposer(prev => prev ? {
                                                        ...prev,
                                                        optionsList: prev.optionsList.map((entry, entryIdx) => entryIdx === idx ? e.target.value : entry)
                                                    } : prev)}
                                                    className="flex-1 bg-[#151b24] border border-[#2b3443] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                                    placeholder={`Option ${idx + 1}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setBlockComposer(prev => prev ? {
                                                        ...prev,
                                                        optionsList: prev.optionsList.length > 1 ? prev.optionsList.filter((_, entryIdx) => entryIdx !== idx) : prev.optionsList
                                                    } : prev)}
                                                    className="p-2 rounded-lg border border-[#2b3443] text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]"
                                                    title="Remove option"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {blockComposer.kind === 'timer' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[#8d96a0]">Minutes</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={blockComposer.durationMin}
                                            onChange={(e) => setBlockComposer(prev => prev ? { ...prev, durationMin: Math.max(0, Number(e.target.value || 0)) } : prev)}
                                            className="mt-1 w-full bg-[#151b24] border border-[#2b3443] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[#8d96a0]">Seconds</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={59}
                                            value={blockComposer.durationSec}
                                            onChange={(e) => setBlockComposer(prev => prev ? { ...prev, durationSec: Math.max(0, Math.min(59, Number(e.target.value || 0))) } : prev)}
                                            className="mt-1 w-full bg-[#151b24] border border-[#2b3443] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                        />
                                    </div>
                                    <div className="col-span-2 text-[11px] text-[#8ea2c7]">
                                        Total duration: {(Math.max(0, Number(blockComposer.durationMin || 0)) * 60) + Math.max(0, Math.min(59, Number(blockComposer.durationSec || 0)))}s
                                    </div>
                                </div>
                            )}

                            {blockComposer.kind === 'checklist' && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs text-[#8d96a0]">Checklist Items</label>
                                        <button
                                            type="button"
                                            onClick={() => setBlockComposer(prev => prev ? { ...prev, checklistItems: [...prev.checklistItems, `Task ${prev.checklistItems.length + 1}`] } : prev)}
                                            className="px-2 py-1 text-[11px] rounded-md bg-[#172132] border border-[#2f3d56] text-[#c7d2e6] hover:bg-[#1f2d45]"
                                        >
                                            Add task
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {blockComposer.checklistItems.map((item, idx) => (
                                            <div key={`block-check-${idx}`} className="flex items-center gap-2">
                                                <span className="text-[#8ea2c7]">•</span>
                                                <input
                                                    value={item}
                                                    onChange={(e) => setBlockComposer(prev => prev ? {
                                                        ...prev,
                                                        checklistItems: prev.checklistItems.map((entry, entryIdx) => entryIdx === idx ? e.target.value : entry)
                                                    } : prev)}
                                                    className="flex-1 bg-[#151b24] border border-[#2b3443] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                                    placeholder={`Task ${idx + 1}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setBlockComposer(prev => prev ? {
                                                        ...prev,
                                                        checklistItems: prev.checklistItems.length > 1 ? prev.checklistItems.filter((_, entryIdx) => entryIdx !== idx) : prev.checklistItems
                                                    } : prev)}
                                                    className="p-2 rounded-lg border border-[#2b3443] text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]"
                                                    title="Remove task"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {blockComposer.kind === 'progress' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[#8d96a0]">Current</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={blockComposer.progressCurrent}
                                            onChange={(e) => setBlockComposer(prev => prev ? { ...prev, progressCurrent: Number(e.target.value || 0) } : prev)}
                                            className="mt-1 w-full bg-[#151b24] border border-[#2b3443] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[#8d96a0]">Goal</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={blockComposer.progressMax}
                                            onChange={(e) => setBlockComposer(prev => prev ? { ...prev, progressMax: Number(e.target.value || 1) } : prev)}
                                            className="mt-1 w-full bg-[#151b24] border border-[#2b3443] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                        />
                                    </div>
                                </div>
                            )}

                            {blockComposer.kind === 'note' && (
                                <div>
                                    <label className="text-xs text-[#8d96a0]">Note Content</label>
                                    <textarea
                                        value={blockComposer.body}
                                        onChange={(e) => setBlockComposer(prev => prev ? { ...prev, body: e.target.value } : prev)}
                                        rows={4}
                                        className="mt-1 w-full bg-[#151b24] border border-[#2b3443] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2] resize-none"
                                    />
                                </div>
                            )}

                            {blockComposer.kind === 'link' && (
                                <div>
                                    <label className="text-xs text-[#8d96a0]">URL</label>
                                    <input
                                        value={blockComposer.url}
                                        onChange={(e) => setBlockComposer(prev => prev ? { ...prev, url: e.target.value } : prev)}
                                        className="mt-1 w-full bg-[#151b24] border border-[#2b3443] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f52b2]"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-[#2b3345] flex justify-end gap-2">
                            <button onClick={() => setBlockComposer(null)} className="px-3 py-1.5 rounded-lg text-sm text-[#9ca3af] hover:text-white hover:bg-[#1c1e21]">Cancel</button>
                            <button onClick={() => void submitBlockComposer()} className="px-3.5 py-1.5 rounded-lg text-sm bg-white text-black font-semibold hover:bg-gray-200 transition-colors">Create Block</button>
                        </div>
                    </div>
                </div>
            )}

            {pendingDeleteMessage && (
                <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPendingDeleteMessage(null)}>
                    <div className="w-full max-w-md rounded-2xl border border-[#2b3035] bg-[#151719] shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white">
                            {pendingDeleteMessage.msg.isMe ? 'Delete message for everyone?' : 'Delete message for you?'}
                        </h3>
                        <p className="text-sm text-[#8d96a0] mt-2">
                            {pendingDeleteMessage.msg.isMe
                                ? 'This will remove the message from the chat for all participants.'
                                : 'This message will only be removed from your view.'}
                        </p>
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setPendingDeleteMessage(null)} className="px-3 py-1.5 rounded-lg text-sm text-[#c5c9ce] hover:bg-[#1c1e21]">Cancel</button>
                            <button onClick={() => void handleConfirmDeleteMessage()} className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-400">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {incomingCall && callPhase === 'incoming' && (
                <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="w-full max-w-md rounded-2xl border border-[#2b3035] bg-[#101214] p-5 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            {incomingCall.fromAvatarIsImage ? (
                                <img src={incomingCall.fromAvatar} alt={incomingCall.fromName} className="w-11 h-11 rounded-full object-cover border border-[#2b3035]" />
                            ) : (
                                <div className="w-11 h-11 rounded-full bg-[#2b3035] text-white text-sm font-bold flex items-center justify-center border border-[#3a3f45]">
                                    {incomingCall.fromAvatar.slice(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <div className="text-white text-sm font-semibold">{incomingCall.fromName}</div>
                                <div className="text-[#8d96a0] text-xs">{incomingCall.mode === 'video' ? 'Incoming video call' : 'Incoming voice call'}</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => void declineIncomingCall()} className="px-3 py-2 rounded-lg bg-[#3a1115] text-red-300 border border-[#5a2028] hover:bg-[#4a171d] text-sm flex items-center gap-2">
                                <PhoneOff className="w-4 h-4" />
                                Decline
                            </button>
                            <button onClick={() => void acceptIncomingCall()} className="px-3 py-2 rounded-lg bg-[#102a1a] text-emerald-300 border border-[#1d4b2d] hover:bg-[#163623] text-sm flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                Accept
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {callPhase !== 'idle' && !incomingCall && (
                <div className={`fixed inset-0 z-[125] ${isCallFullscreen ? 'bg-black' : 'bg-[#090b10]'} flex flex-col`}>
                    <div className="h-10 shrink-0 border-b border-[#242933] bg-[#090c12]/95 px-5 flex items-center justify-center relative">
                        <div className="flex items-center gap-2 min-w-0">
                            {callPeerAvatarIsImage ? (
                                <img src={callPeerAvatar} alt={callPeerName} className="w-5 h-5 rounded-full object-cover border border-[#2b3035]" />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-[#2b3035] text-white text-[9px] font-bold flex items-center justify-center border border-[#3a3f45]">
                                    {callPeerAvatar.slice(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div className="text-[13px] text-white font-medium truncate">{callPeerName || 'Call'}</div>
                            <div className="text-[11px] text-[#9da8b6]">
                                {callConnectionLabel} {callStartedAt ? `• ${formatCallDuration(callDurationSec)}` : ''}
                            </div>
                        </div>
                        <button
                            onClick={() => setIsCallFullscreen(v => !v)}
                            className="absolute right-3 p-1.5 rounded-md bg-[#11161d] border border-[#2b3035] text-[#b6c0ce] hover:text-white"
                            title={isCallFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isCallFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>

                    <div className="flex-1 p-3 md:p-4 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-3">
                        <div ref={callStageRef} className={`relative rounded-2xl border ${remoteSpeakingActive ? 'border-blue-400/60 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]' : 'border-[#343b4a]'} bg-[#2a2169] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-all duration-300`}>
                            <div className="absolute inset-[8%_7%] rounded-[28px] border border-[#3b327b] bg-[#1c1647] pointer-events-none" />
                            {remoteMainShouldUseTrack ? (
                                <>
                                    <video ref={remoteCallVideoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${remoteSpeakingActive ? 'brightness-[1.02]' : ''}`} />
                                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,_#1a2333,_#07090d_62%)]">
                                    {callPeerAvatarIsImage ? (
                                        <img
                                            src={callPeerAvatar}
                                            alt={callPeerName}
                                            className="w-28 h-28 rounded-full object-cover border border-[#2b3035] transition-all duration-200"
                                            style={{ boxShadow: remoteSpeakingLevel > 0.03 ? `0 0 0 ${4 + (remoteSpeakingLevel * 16)}px rgba(59,130,246,${0.12 + remoteSpeakingLevel * 0.35})` : undefined }}
                                        />
                                    ) : (
                                        <div
                                            className="w-28 h-28 rounded-full bg-[#2b3035] text-white text-3xl font-bold flex items-center justify-center border border-[#3a3f45] transition-all duration-200"
                                            style={{ boxShadow: remoteSpeakingLevel > 0.03 ? `0 0 0 ${4 + (remoteSpeakingLevel * 16)}px rgba(59,130,246,${0.12 + remoteSpeakingLevel * 0.35})` : undefined }}
                                        >
                                            {callPeerAvatar.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            )}
                            {(remotePipTrack || remoteMediaState.isScreenSharing) && (
                                <div
                                    className={`absolute z-30 w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border cursor-grab active:cursor-grabbing transition-all duration-300 ${remoteSpeakingActive ? 'border-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.25)]' : 'border-[#2b3035]'} bg-black`}
                                    style={{ left: `${remotePipPosition.x}%`, top: `${remotePipPosition.y}%`, transform: 'translate(-50%, -50%)' }}
                                    onPointerDown={handleRemotePipPointerDown}
                                    onPointerMove={handleRemotePipPointerMove}
                                    onPointerUp={handleRemotePipPointerUp}
                                    onPointerCancel={handleRemotePipPointerUp}
                                    title={remoteHasSplitView ? 'Drag or click to swap views' : 'Drag'}
                                >
                                    {remotePipShouldUseTrack ? (
                                        <video ref={remoteCallPipVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                    ) : (
                                        callPeerAvatarIsImage ? (
                                            <img src={callPeerAvatar} alt={callPeerName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-[#2b3035] text-white text-xl font-bold flex items-center justify-center">
                                                {callPeerAvatar.slice(0, 2).toUpperCase()}
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                            <canvas
                                ref={drawCanvasRef}
                                className={`absolute inset-0 z-10 ${isDrawMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
                                style={{ touchAction: 'none', width: '100%', height: '100%' }}
                                onPointerDown={handleDrawPointerDown}
                                onPointerMove={handleDrawPointerMove}
                                onPointerUp={(event) => { void finishDrawStroke(event); }}
                                onPointerLeave={(event) => { void finishDrawStroke(event); }}
                                onPointerCancel={(event) => { void finishDrawStroke(event); }}
                            />
                            <div className={`absolute right-3 bottom-3 w-36 h-24 rounded-xl overflow-hidden border bg-black pointer-events-none transition-all duration-300 ${localSpeakingActive ? 'border-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.2)]' : 'border-[#364056]'}`}>
                                {hasLocalVideo && !isCameraOff ? (
                                    <video ref={localCallVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[#0f131a] flex items-center justify-center">
                                        {isHttpUrl(userAvatar) ? (
                                            <img
                                                src={userAvatar}
                                                alt={userName || 'You'}
                                                className="w-12 h-12 rounded-full object-cover border border-[#3a3f45]"
                                                style={{ boxShadow: localSpeakingLevel > 0.03 ? `0 0 0 ${3 + (localSpeakingLevel * 10)}px rgba(59,130,246,${0.1 + localSpeakingLevel * 0.32})` : undefined }}
                                            />
                                        ) : (
                                            <div
                                                className="w-12 h-12 rounded-full bg-[#2b3035] text-white text-sm font-bold flex items-center justify-center border border-[#3a3f45]"
                                                style={{ boxShadow: localSpeakingLevel > 0.03 ? `0 0 0 ${3 + (localSpeakingLevel * 10)}px rgba(59,130,246,${0.1 + localSpeakingLevel * 0.32})` : undefined }}
                                            >
                                                {(userAvatar || userName || 'Y').slice(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {textDraft && (
                                <div className="absolute z-30" style={{ left: `${textDraft.x * 100}%`, top: `${textDraft.y * 100}%`, transform: 'translate(0, -50%)' }}>
                                    <input
                                        ref={textDraftInputRef}
                                        value={textDraft.text}
                                        onChange={(e) => setTextDraft(prev => prev ? { ...prev, text: e.target.value } : prev)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                void commitTextDraft();
                                            }
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setTextDraft(null);
                                            }
                                        }}
                                        onBlur={() => { void commitTextDraft(); }}
                                        placeholder="Type text..."
                                        className="w-40 bg-black/80 border border-white/20 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-400"
                                    />
                                </div>
                            )}
                            {remoteCursorPoint && (
                                <div
                                    className="absolute pointer-events-none z-20"
                                    style={{ left: `${remoteCursorPoint.x * 100}%`, top: `${remoteCursorPoint.y * 100}%`, transform: 'translate(-50%, -50%)' }}
                                >
                                    <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_0_4px_rgba(34,211,238,0.25)]" />
                                </div>
                            )}
                            {isTranscribing && (
                                <div className="absolute left-3 top-3 z-20 w-[360px] max-w-[calc(100%-24px)] rounded-lg border border-[#3a3f64] bg-[#111633]/82 backdrop-blur-md p-2 pointer-events-none">
                                    <div className="text-[10px] uppercase tracking-[0.16em] text-[#8d96a0] mb-1">Live Transcript</div>
                                    <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                        {transcriptItems.slice(-6).map(item => (
                                            <div key={item.id} className="text-xs">
                                                <span className="text-blue-200 font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">{item.senderName}</span>
                                                <span className="text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">: {item.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {showCallInfoPanel && (
                                <div className="absolute right-3 top-3 z-20 rounded-lg border border-[#2b3035] bg-[#0a0e14]/92 backdrop-blur p-3 space-y-1 text-[11px] text-[#c2c8d0] pointer-events-none">
                                    <div>With: {callPeerName || 'User'}</div>
                                    <div>Duration: {formatCallDuration(callDurationSec)}</div>
                                    <div>Screenshots: {callScreenshots.length}</div>
                                    <div>Recordings: {callRecordings.length}</div>
                                </div>
                            )}
                            <div className={`absolute inset-0 pointer-events-none bg-white transition-opacity duration-200 ${isCaptureFlash ? 'opacity-35' : 'opacity-0'}`} />
                            {callUiToast && (
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 rounded-full border border-[#2b3035] bg-[#0f141a]/95 px-3 py-1 text-xs text-white shadow-lg pointer-events-none">
                                    {callUiToast}
                                </div>
                            )}
                        </div>

                        <div className={`rounded-2xl border border-[#242933] bg-[#07090d] p-3 flex flex-col gap-3 min-h-0 ${showCallChatPanel ? '' : 'hidden xl:flex'}`}>
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-white">Call Thread</div>
                                <button onClick={() => setShowCallChatPanel(false)} className="text-[#8d96a0] hover:text-white xl:hidden">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div ref={callChatScrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-lg border border-[#242933] bg-[#05070b] p-3 space-y-2">
                                {callChatMessages.length === 0 ? (
                                    <div className="h-full min-h-[220px] flex items-center justify-center text-center">
                                        <div>
                                            <div className="text-sm text-[#d1d5db] font-medium">Every call has a thread</div>
                                            <div className="text-xs text-[#7f8a99] mt-1">Post messages here for easy access after the call</div>
                                        </div>
                                    </div>
                                ) : callChatMessages.map(msg => (
                                    <div key={msg.id} className="text-xs">
                                        <span className={`${msg.senderId === currentUserId ? 'text-blue-300' : 'text-emerald-300'} font-semibold`}>{msg.senderName}</span>
                                        <span className="text-[#d1d5db]">: {msg.text}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    value={callChatInput}
                                    onChange={(e) => setCallChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void sendCallChatMessage();
                                        }
                                    }}
                                    placeholder="Message during call"
                                    className="flex-1 bg-[#0f131a] border border-[#2b3035] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#3b82f6]"
                                />
                                <button onClick={() => void sendCallChatMessage()} className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-semibold hover:bg-[#2563eb]">Send</button>
                            </div>
                        </div>
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-30 rounded-2xl border border-[#2b3035] bg-[#0d1118]/92 px-3 py-2 shadow-2xl flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full border border-[#2b3035] bg-[#11161d]/80 px-2 py-1">
                            <button title={isMicMuted ? 'Unmute' : 'Mute'} onClick={toggleCallMic} className={`w-9 h-9 rounded-full border text-xs flex items-center justify-center ${isMicMuted ? 'bg-[#33171b] border-[#5b242c] text-red-300' : 'bg-[#121922] border-[#2b3035] text-[#dbe4ef] hover:border-[#3f4b5d]'}`}>
                                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                            <button title={isCameraOff ? 'Turn camera on' : 'Turn camera off'} onClick={toggleCallCamera} className={`w-9 h-9 rounded-full border text-xs flex items-center justify-center ${isCameraOff ? 'bg-[#33171b] border-[#5b242c] text-red-300' : 'bg-[#121922] border-[#2b3035] text-[#dbe4ef] hover:border-[#3f4b5d]'}`}>
                                {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                            </button>
                            <button onClick={() => void toggleScreenShare()} className={`px-2.5 py-1.5 rounded-full border text-xs flex items-center gap-1.5 ${isScreenSharing ? 'bg-[#1f2f4b] border-[#34558a] text-[#a9c6ff]' : 'bg-[#121922] border-[#2b3035] text-[#dbe4ef] hover:border-[#3f4b5d]'}`}>
                                {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <MonitorUp className="w-4 h-4" />}
                                {isScreenSharing ? 'Stop Share' : 'Share'}
                            </button>
                        </div>

                        <div className="relative flex items-center gap-2 rounded-full border border-[#2b3035] bg-[#11161d]/80 px-2 py-1">
                            <button
                                onClick={() => {
                                    setIsDrawToolsOpen(prev => {
                                        const next = !prev;
                                        setIsDrawMode(next);
                                        if (!next) setIsTextMode(false);
                                        return next;
                                    });
                                }}
                                className={`px-2.5 py-1.5 rounded-full border text-xs flex items-center gap-1.5 ${isDrawMode ? 'bg-[#1e3a8a] border-[#2a4fae] text-[#bfdbfe]' : 'bg-[#121922] border-[#2b3035] text-[#dbe4ef] hover:border-[#3f4b5d]'}`}
                            >
                                <PenTool className="w-4 h-4" />
                                Draw
                            </button>
                            {isDrawToolsOpen && (
                                <div className="absolute bottom-[54px] left-1/2 -translate-x-1/2 rounded-xl border border-[#2b3035] bg-[#0f141a]/98 backdrop-blur-md p-2 shadow-2xl flex items-center gap-2">
                                    <button
                                        onClick={() => setIsTextMode(v => !v)}
                                        className={`px-2 py-1 rounded-lg text-xs border ${isTextMode ? 'bg-[#1f2f4b] border-[#34558a] text-[#a9c6ff]' : 'bg-[#121922] border-[#2b3035] text-[#dbe4ef]'}`}
                                    >
                                        Text
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {DRAW_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setDrawColor(color)}
                                                className={`w-5 h-5 rounded-full border ${drawColor === color ? 'border-white' : 'border-white/25'}`}
                                                style={{ backgroundColor: color }}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                    <button onClick={() => void clearCallDrawings()} className="px-2 py-1 rounded-lg text-xs border border-[#2b3035] text-[#dbe4ef]">
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 rounded-full border border-[#2b3035] bg-[#11161d]/80 px-2 py-1">
                            <button onClick={() => void captureCallScreenshot()} className="px-2.5 py-1.5 rounded-full border text-xs flex items-center gap-1.5 bg-[#121922] border-[#2b3035] text-[#dbe4ef] hover:border-[#3f4b5d]">
                                <ImageIcon className="w-4 h-4" />
                                Shot
                            </button>
                            <button onClick={() => void toggleCallRecording()} className={`px-2.5 py-1.5 rounded-full border text-xs flex items-center gap-1.5 ${isRecordingCall ? 'bg-[#3b1218] border-[#6b2530] text-red-300' : 'bg-[#121922] border-[#2b3035] text-[#dbe4ef] hover:border-[#3f4b5d]'}`}>
                                <Video className="w-4 h-4" />
                                {isRecordingCall ? 'Stop' : 'Record'}
                            </button>
                            <button onClick={() => void toggleLiveTranscription()} className={`px-2.5 py-1.5 rounded-full border text-xs flex items-center gap-1.5 ${isTranscribing ? 'bg-[#1f2f4b] border-[#34558a] text-[#a9c6ff]' : 'bg-[#121922] border-[#2b3035] text-[#dbe4ef] hover:border-[#3f4b5d]'}`}>
                                <FileText className="w-4 h-4" />
                                CC
                            </button>
                            <button onClick={() => setShowCallInfoPanel(v => !v)} className={`px-2.5 py-1.5 rounded-full border text-xs flex items-center gap-1.5 ${showCallInfoPanel ? 'bg-[#1d4ed8] border-[#2563eb] text-white' : 'bg-[#121922] border-[#2b3035] text-[#dbe4ef] hover:border-[#3f4b5d]'}`}>
                                <Info className="w-4 h-4" />
                                Info
                            </button>
                            <button onClick={() => setShowCallChatPanel(v => !v)} className={`px-2.5 py-1.5 rounded-full border text-xs flex items-center gap-1.5 ${showCallChatPanel ? 'bg-[#1d4ed8] border-[#2563eb] text-white' : 'bg-[#121922] border-[#2b3035] text-[#dbe4ef] hover:border-[#3f4b5d]'}`}>
                                <MessageSquare className="w-4 h-4" />
                                Chat
                            </button>
                            <button onClick={() => void handleEndCall()} className="px-3 py-1.5 rounded-full bg-[#4b1920] border border-[#6b2530] text-red-200 text-xs font-semibold hover:bg-[#5a1d27] flex items-center gap-1.5">
                                <PhoneOff className="w-4 h-4" />
                                Leave
                            </button>
                        </div>
                    </div>
                    <audio ref={remoteCallAudioRef} autoPlay />
                </div>
            )}

            {callInfoModal && (
                <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCallInfoModal(null)}>
                    <div className="w-full max-w-3xl max-h-[86vh] rounded-2xl border border-[#2b3035] bg-[#0e1116] shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="h-12 px-4 border-b border-[#2b3035] flex items-center justify-between">
                            <div className="text-sm font-semibold text-white">Call Info</div>
                            <button onClick={() => setCallInfoModal(null)} className="p-1.5 rounded-lg hover:bg-[#1a1f28] text-[#9da8b6] hover:text-white">
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-[#b8c0cb]">
                                <div className="rounded-lg border border-[#2b3035] bg-[#10151d] p-2">With: {callInfoModal.summary.peerName}</div>
                                <div className="rounded-lg border border-[#2b3035] bg-[#10151d] p-2">Duration: {formatCallDuration(callInfoModal.summary.durationSec)}</div>
                                <div className="rounded-lg border border-[#2b3035] bg-[#10151d] p-2">Started: {new Date(callInfoModal.summary.startedAt).toLocaleString()}</div>
                                <div className="rounded-lg border border-[#2b3035] bg-[#10151d] p-2">Ended: {new Date(callInfoModal.summary.endedAt).toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-[#8d96a0] mb-2">Call Chat Log</div>
                                <div className="rounded-lg border border-[#2b3035] bg-[#0a0e14] p-3 space-y-1 max-h-44 overflow-y-auto custom-scrollbar">
                                    {(callInfoModal.summary.callMessages || []).length === 0 ? (
                                        <div className="text-xs text-[#7f8a99]">No call chat messages.</div>
                                    ) : (callInfoModal.summary.callMessages || []).map((item, idx) => (
                                        <div key={`calllog-${idx}`} className="text-xs">
                                            <span className="text-blue-300 font-semibold">{item.senderName}</span>
                                            <span className="text-[#d1d5db]">: {item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-[#8d96a0] mb-2">Media</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {(callInfoModal.attachments || []).map((att, idx) => (
                                        <div key={`callmedia-${idx}`} className="rounded-lg border border-[#2b3035] bg-[#0a0e14] p-2">
                                            {(att.type === 'image' || att.type === 'gif') && (
                                                <img src={att.url} alt={att.name} className="w-full h-40 object-cover rounded-md border border-[#2b3035]" />
                                            )}
                                            {att.type === 'video' && (
                                                <video src={att.url} controls className="w-full h-40 object-cover rounded-md border border-[#2b3035]" />
                                            )}
                                            {att.type === 'file' && (
                                                <div className="text-xs text-[#c7cfdb]">{att.name}</div>
                                            )}
                                            <div className="mt-1 text-[11px] text-[#9da8b6] truncate">{att.name}</div>
                                        </div>
                                    ))}
                                    {(callInfoModal.attachments || []).length === 0 && (
                                        <div className="text-xs text-[#7f8a99]">No screenshots or recordings saved.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CODE PREVIEW MODAL */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="relative w-full max-w-5xl h-[80vh] bg-[#050505] rounded-xl overflow-hidden border border-[#2b3035] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="h-12 bg-[#1c1e21] border-b border-[#2b3035] flex items-center justify-between px-4">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-white flex items-center gap-2">
                                    <Play className="w-4 h-4 text-green-400 fill-current" />
                                    Preview
                                </span>
                                <div className="flex items-center gap-1 rounded-lg border border-[#2b3035] bg-[#101214] p-1">
                                    <button
                                        onClick={() => setPreviewTab('live')}
                                        className={`px-2.5 py-1 rounded text-xs transition-colors ${previewTab === 'live' ? 'bg-white text-black' : 'text-[#9ca3af] hover:text-white hover:bg-[#1c1e21]'}`}
                                    >
                                        Live
                                    </button>
                                    <button
                                        onClick={() => setPreviewTab('code')}
                                        className={`px-2.5 py-1 rounded text-xs transition-colors ${previewTab === 'code' ? 'bg-white text-black' : 'text-[#9ca3af] hover:text-white hover:bg-[#1c1e21]'}`}
                                    >
                                        Code
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="p-1.5 rounded-lg hover:bg-[#2b3035] text-[#8d96a0] hover:text-white transition-colors"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 relative">
                            {previewTab === 'live' ? (
                                <Preview
                                    htmlContent={previewHtml}
                                    isLoading={false}
                                    isSelectionMode={false}
                                    viewMode="desktop"
                                    onElementSelect={() => { }}
                                />
                            ) : (
                                <div className="h-full w-full bg-[#0b0e14] overflow-auto custom-scrollbar p-4">
                                    <pre className="text-xs leading-relaxed text-[#d1d5db] whitespace-pre-wrap break-words font-mono">
                                        {previewHtml}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
