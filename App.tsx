
import React, { useState, useEffect, useRef } from 'react';
import { Home } from './components/Home';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { Auth } from './components/Auth';
import { Docs } from './components/Docs';
import { Dashboard } from './components/Dashboard';
import { ControlCenter } from './components/ControlCenter';
import { NaturalWorkspace } from './components/workspace/NaturalWorkspace';
import { FileIcon } from './components/FileIcons';
import { compileEnglishToApp, modifyEnglishCode, generateEnglishLogic, explainCode, CompilerMode } from './services/geminiService';
import { DEFAULT_IFRAME_CONTENT, WELCOME_CONTENT, OPENROUTER_FREE_MODELS, DEFAULT_OPENROUTER_MODEL } from './constants';
import {
  autoConvertEnglishBatches,
  compileEnglishLinesToCode,
  createTemplateForFileName,
  detectLanguageFromFilename
} from './services/localEnglishCompiler';
import {
  adminAdjustAiLimit,
  adminBanUser,
  changePassword,
  completeOAuthFromUrl,
  createTeam,
  deleteAccount,
  getAdminMetrics,
  getAllUsers,
  getCurrentUser,
  incrementUsage,
  inviteToTeam,
  leaveTeam,
  login,
  logout,
  requestPasswordReset,
  restoreSupabaseSession,
  resetPassword,
  setSubscription,
  signUp,
  signInWithOAuth,
  uploadProfileAvatar,
  updateProfile,
  verifyEmail,
  listTeamsForUser,
  type SubscriptionTier,
  type TeamRole,
  type UserRecord
} from './services/platformService';

// --- File System Types & Helpers ---
type FileType = 'file' | 'folder';

interface FileNode {
  id: string;
  name: string;
  type: FileType;
  content?: string;
  isOpen?: boolean; // Only for folders
  children?: FileNode[];
  // Translation state
  isTranslated?: boolean;
  originalContent?: string;
  originalName?: string;
}

type ProjectVisibility = 'public' | 'private' | 'team';
type ProjectType = 'app' | 'website' | 'api' | 'script';
type ProjectStatus = 'active' | 'archived';

interface FileVersion {
  content: string;
  savedAt: number;
}

interface ProjectRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  visibility: ProjectVisibility;
  type: ProjectType;
  status: ProjectStatus;
  files: FileNode[];
  activeFileId: string;
  chatHistory: { role: 'user' | 'model'; text: string }[];
  versions: Record<string, FileVersion[]>;
  createdAt: number;
  updatedAt: number;
}

const PROJECTS_STORAGE_KEY = 'natural.projects.v1';

const generateId = () => Math.random().toString(36).substr(2, 9);

const findFileById = (nodes: FileNode[], id: string): FileNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findFileById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

// Check if a node exists in the tree recursively
const nodeExists = (nodes: FileNode[], id: string): boolean => {
    for (const node of nodes) {
        if (node.id === id) return true;
        if (node.children && nodeExists(node.children, id)) return true;
    }
    return false;
};

const updateNodeInTree = (nodes: FileNode[], id: string, updater: (node: FileNode) => FileNode): FileNode[] => {
  return nodes.map(node => {
    if (node.id === id) return updater(node);
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, id, updater) };
    }
    return node;
  });
};

const addNodeToTree = (nodes: FileNode[], parentId: string | null, newNode: FileNode): FileNode[] => {
  if (!parentId) return [...nodes, newNode]; // Add to root
  return nodes.map(node => {
    if (node.id === parentId) {
      return { ...node, children: [...(node.children || []), newNode], isOpen: true };
    }
    if (node.children) {
      return { ...node, children: addNodeToTree(node.children, parentId, newNode) };
    }
    return node;
  });
};

const deleteNodeFromTree = (nodes: FileNode[], id: string): FileNode[] => {
    // Remove the node if it matches the ID
    const filtered = nodes.filter(node => node.id !== id);
    
    // Recursively process children
    return filtered.map(node => ({
        ...node,
        children: node.children ? deleteNodeFromTree(node.children, id) : undefined
    }));
};

const findFirstFile = (nodes: FileNode[]): FileNode | null => {
  for (const node of nodes) {
    if (node.type === 'file') return node;
    if (node.children) {
      const nested = findFirstFile(node.children);
      if (nested) return nested;
    }
  }
  return null;
};

const createDefaultWelcomeFile = (): FileNode => ({
  id: 'welcome',
  name: 'index.html',
  type: 'file',
  content: WELCOME_CONTENT,
  children: []
});

const createEmptyProject = (): ProjectRecord => {
  const welcome = createDefaultWelcomeFile();
  const now = Date.now();
  return {
    id: generateId(),
    ownerId: 'system',
    name: 'Welcome Project',
    description: 'Starter project',
    visibility: 'private',
    type: 'website',
    status: 'active',
    files: [welcome],
    activeFileId: welcome.id,
    chatHistory: [],
    versions: {},
    createdAt: now,
    updatedAt: now
  };
};

const App: React.FC = () => {
  // --- View State ---
  const [view, setView] = useState<'home' | 'editor' | 'auth' | 'docs' | 'dashboard' | 'control'>('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(() => getCurrentUser());
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);

  const initialProject = createEmptyProject();
  const [projects, setProjects] = useState<ProjectRecord[]>([initialProject]);
  const [currentProjectId, setCurrentProjectId] = useState<string>(initialProject.id);

  // --- File System State ---
  const [files, setFiles] = useState<FileNode[]>(initialProject.files);
  const [activeFileId, setActiveFileId] = useState<string>(initialProject.activeFileId);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  
  // --- Editor State ---
  const [code, setCode] = useState(WELCOME_CONTENT);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  
  // --- Compiler & UI State ---
  const [compiledHtml, setCompiledHtml] = useState(DEFAULT_IFRAME_CONTENT);
  const [compilerMode, setCompilerMode] = useState<CompilerMode>('ai');
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('desktop');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ tagName: string, text: string } | null>(null);
  const [isModifying, setIsModifying] = useState(false);
  const [ghostwriterInput, setGhostwriterInput] = useState("");
  
  // --- Chat State ---
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', text: string}[]>(initialProject.chatHistory);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Persistence/Version State ---
  const [fileVersions, setFileVersions] = useState<Record<string, FileVersion[]>>(initialProject.versions);
  
  // --- File Creation UI State ---
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isCreating, setIsCreating] = useState<{ type: FileType, parentId: string | null } | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const addMenuRef = useRef<HTMLDivElement>(null);
  
  // --- Mode Menu State ---
  const [showModeMenu, setShowModeMenu] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const [isFlashMode, setIsFlashMode] = useState(false);
  const [selectedEditorModel, setSelectedEditorModel] = useState<string>(DEFAULT_OPENROUTER_MODEL);
  const [showEditorModelMenu, setShowEditorModelMenu] = useState(false);
  const editorModelMenuRef = useRef<HTMLDivElement>(null);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [lastLocalConvertInfo, setLastLocalConvertInfo] = useState<{ lines: number; batches: number } | null>(null);
  const [autoNaturalEnabled, setAutoNaturalEnabled] = useState(true);
  const [naturalBatchSize, setNaturalBatchSize] = useState(5);
  const [wordWrapEnabled, setWordWrapEnabled] = useState(false);
  const [lastAutoConvertedSource, setLastAutoConvertedSource] = useState<string | null>(null);
  const [conversionHint, setConversionHint] = useState<string | null>(null);
  const [showNaturalDock, setShowNaturalDock] = useState(true);
  const [naturalDraft, setNaturalDraft] = useState('');
  const [conversionHistory, setConversionHistory] = useState<Array<{ id: string; label: string; timestamp: number }>>([]);

  // --- File Translation State ---
  const [translatingFileId, setTranslatingFileId] = useState<string | null>(null);

  const lastRequestTime = useRef<number>(0);
  const lastCompiledCode = useRef<string | null>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApplyingLocalConversion = useRef(false);
  const conversionHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveCompileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistProjects = (nextProjects: ProjectRecord[]) => {
    setProjects(nextProjects);
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects));
  };

  const syncCurrentProject = (
    projectId: string,
    next: Partial<Pick<ProjectRecord, 'files' | 'activeFileId' | 'chatHistory' | 'versions' | 'updatedAt'>>
  ) => {
    const now = Date.now();
    setProjects(prev => {
      const nextProjects = prev.map(project => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          files: next.files ?? project.files,
          activeFileId: next.activeFileId ?? project.activeFileId,
          chatHistory: next.chatHistory ?? project.chatHistory,
          versions: next.versions ?? project.versions,
          updatedAt: next.updatedAt ?? now
        };
      });
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects));
      return nextProjects;
    });
  };

  const loadProjectIntoEditor = (project: ProjectRecord) => {
    setCurrentProjectId(project.id);
    setFiles(project.files);
    setActiveFileId(project.activeFileId);
    const activeNode = findFileById(project.files, project.activeFileId);
    setCode(activeNode?.content || '');
    setChatHistory(project.chatHistory);
    setFileVersions(project.versions || {});
  };

  // Close menus when clicking outside
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProjectRecord[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const sanitized = parsed.map(project => ({
        ...project,
        ownerId: project.ownerId || 'system',
        versions: project.versions || {},
        chatHistory: project.chatHistory || [],
        files: project.files && project.files.length > 0 ? project.files : [createDefaultWelcomeFile()],
        activeFileId: project.activeFileId || (project.files?.[0]?.id ?? 'welcome'),
        status: project.status || 'active'
      }));
      setProjects(sanitized);
      loadProjectIntoEditor(sanitized[0]);
    } catch (e) {
      console.error('Failed to load saved projects:', e);
    }
  }, []);

  // Keep active project in sync with editor state
  useEffect(() => {
    if (!currentProjectId) return;
    syncCurrentProject(currentProjectId, {
      files,
      activeFileId,
      chatHistory,
      versions: fileVersions,
      updatedAt: Date.now()
    });
  }, [currentProjectId, files, activeFileId, chatHistory, fileVersions]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setShowModeMenu(false);
      }
      if (editorModelMenuRef.current && !editorModelMenuRef.current.contains(event.target as Node)) {
        setShowEditorModelMenu(false);
      }
      if (!(event.target as HTMLElement).closest('.history-menu')) {
        setShowHistoryMenu(false);
      }
      if (!(event.target as HTMLElement).closest('.file-context-menu')) {
        setContextMenu(null);
      }
      if (renamingNodeId && !event.target) {
          setRenamingNodeId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [renamingNodeId]);

  useEffect(() => {
    return () => {
      if (conversionHintTimeoutRef.current) {
        clearTimeout(conversionHintTimeoutRef.current);
      }
      if (liveCompileTimeoutRef.current) {
        clearTimeout(liveCompileTimeoutRef.current);
      }
    };
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
      if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [chatHistory, isModifying]);

  useEffect(() => {
      let isMounted = true;
      const restoreSession = async () => {
        const hasOAuthCallback =
          window.location.hash.includes('access_token=') ||
          window.location.search.includes('access_token=') ||
          window.location.search.includes('code=');
        if (hasOAuthCallback && isMounted) {
          setView('dashboard');
        }
        try {
          const oauthUser = await completeOAuthFromUrl();
          if (oauthUser && isMounted) {
            setCurrentUser(oauthUser);
            setView('dashboard');
            return;
          }
          const restored = await restoreSupabaseSession();
          if (restored && isMounted) {
            setCurrentUser(restored);
            setView('dashboard');
          }
        } catch (e) {
          console.error('Failed to restore Supabase session:', e);
        } finally {
          if (isMounted) {
            setIsAuthInitializing(false);
          }
        }
      };
      void restoreSession();
      return () => {
        isMounted = false;
      };
  }, []);

  useEffect(() => {
      if (isAuthInitializing) return;
      if (!currentUser && (view === 'dashboard' || view === 'editor' || view === 'control')) {
          setAuthMode('login');
          setView('auth');
      }
  }, [currentUser, view, isAuthInitializing]);

  useEffect(() => {
      if (isAuthInitializing) return;
      if (currentUser && (view === 'home' || view === 'auth')) {
          setView('dashboard');
      }
  }, [currentUser, view, isAuthInitializing]);

  const handleStart = (initialCode?: string, prompt?: string) => {
      if (initialCode) {
          setCode(initialCode);
          setFiles(prev => updateNodeInTree(prev, activeFileId, n => ({ ...n, content: initialCode })));
          setView('editor');
      }
      if (prompt) {
          setGhostwriterInput(prompt);
          setChatHistory([{ role: 'user', text: prompt }]);
          // We can optionally trigger the submit here if we moved logic to a reusable function
      }
      if (!initialCode && !prompt) {
          setView('auth'); 
      }
  };

  const handleLogin = () => {
      setAuthMode('login');
      setView('auth');
  };

  const handleSignup = () => {
      setAuthMode('signup');
      setView('auth');
  };

  const refreshCurrentUser = () => {
      setCurrentUser(getCurrentUser());
  };

  const handleAuthComplete = (user: UserRecord) => {
      setCurrentUser(user);
      setView('dashboard');
  };

  const handleLogout = () => {
      void logout();
      setCurrentUser(null);
      setView('home');
  };

  // Updated to handle complex project details
  const handleDashboardCreate = (details: { name: string, description: string, visibility: ProjectVisibility, type: ProjectType, initialContent?: string }) => {
      const prompt = details.description || details.name;
      
      const newContent = details.initialContent || (prompt 
        ? `// Project: ${details.name}\n// Type: ${details.type}\n// Visibility: ${details.visibility}\n\n// Goal: ${prompt}\n\nCreate a container.\nAdd a title "${details.name}".\n`
        : WELCOME_CONTENT);
      
      const newFileId = generateId();
      // Generate a filename based on project type
      const ext = details.type === 'website' ? 'html' : 'en';
      const safeName = details.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'app';
      
      const newFile: FileNode = {
          id: newFileId,
          name: `${safeName}.${ext}`,
          type: 'file',
          content: newContent,
          children: []
      };
      const now = Date.now();
      const project: ProjectRecord = {
        id: generateId(),
        ownerId: currentUser?.id || 'system',
        name: details.name || 'Untitled App',
        description: details.description,
        visibility: details.visibility,
        type: details.type,
        status: 'active',
        files: [newFile],
        activeFileId: newFileId,
        chatHistory: details.description
          ? [{ role: 'user', text: details.description }, { role: 'model', text: "I've initialized your project based on this description." }]
          : [],
        versions: {},
        createdAt: now,
        updatedAt: now
      };
      persistProjects([project, ...projects]);
      loadProjectIntoEditor(project);
      if (currentUser) {
        incrementUsage(currentUser.id, {
          projectsCreated: 1,
          storageBytes: JSON.stringify(project.files).length
        });
        refreshCurrentUser();
      }
      
      setView('editor');
  };

  const handleDashboardOpen = (projectId: string) => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      loadProjectIntoEditor(project);
      setView('editor');
  };

  const handleDashboardRename = (projectId: string, name: string) => {
      const nextProjects = projects.map(project => project.id === projectId ? { ...project, name, updatedAt: Date.now() } : project);
      persistProjects(nextProjects);
  };

  const handleDashboardDelete = (projectId: string) => {
      const nextProjects = projects.filter(project => project.id !== projectId);
      if (nextProjects.length === 0) {
        const fresh = createEmptyProject();
        persistProjects([fresh]);
        loadProjectIntoEditor(fresh);
      } else {
        persistProjects(nextProjects);
        if (projectId === currentProjectId) {
          loadProjectIntoEditor(nextProjects[0]);
        }
      }
  };

  const handleDashboardDuplicate = (projectId: string) => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      const now = Date.now();
      const clone: ProjectRecord = {
        ...project,
        id: generateId(),
        name: `${project.name} (Copy)`,
        createdAt: now,
        updatedAt: now
      };
      persistProjects([clone, ...projects]);
  };

  const handleDashboardArchive = (projectId: string) => {
      const nextProjects = projects.map(project => {
        if (project.id !== projectId) return project;
        const status: ProjectStatus = project.status === 'archived' ? 'active' : 'archived';
        return { ...project, status, updatedAt: Date.now() };
      });
      persistProjects(nextProjects);
  };

  const handleOpenCodeInEditor = ({ code, language }: { code: string; language: string }) => {
      const normalized = (language || 'text').toLowerCase();
      let fileName = 'generated.txt';
      let projectType: ProjectType = 'script';

      if (normalized === 'html') {
        fileName = 'index.html';
        projectType = 'website';
      } else if (normalized === 'css') {
        fileName = 'styles.css';
        projectType = 'website';
      } else if (normalized === 'javascript' || normalized === 'js') {
        fileName = 'script.js';
        projectType = 'script';
      } else if (normalized === 'typescript' || normalized === 'ts') {
        fileName = 'script.ts';
        projectType = 'script';
      } else if (normalized === 'jsx' || normalized === 'react') {
        fileName = 'component.jsx';
        projectType = 'app';
      } else if (normalized === 'tsx') {
        fileName = 'component.tsx';
        projectType = 'app';
      } else if (normalized === 'json') {
        fileName = 'data.json';
      } else if (normalized === 'python' || normalized === 'py') {
        fileName = 'script.py';
      } else if (normalized === 'sql') {
        fileName = 'query.sql';
      }

      const newFileId = generateId();
      const now = Date.now();
      const importedFile: FileNode = {
        id: newFileId,
        name: fileName,
        type: 'file',
        content: code,
        children: []
      };

      const project: ProjectRecord = {
        id: generateId(),
        ownerId: currentUser?.id || 'system',
        name: `Imported ${normalized.toUpperCase()} Snippet`,
        description: 'Imported from AI chat',
        visibility: 'private',
        type: projectType,
        status: 'active',
        files: [importedFile],
        activeFileId: newFileId,
        chatHistory: [
          { role: 'user', text: `Open ${normalized} code in editor` },
          { role: 'model', text: 'Imported from AI chat and ready to edit.' }
        ],
        versions: {},
        createdAt: now,
        updatedAt: now
      };

      persistProjects([project, ...projects]);
      loadProjectIntoEditor(project);
      setView('editor');
  };

  const handleFileUpload = async (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          const content = e.target?.result as string;
      if (content) {
              const newFileId = generateId();
              const newFile: FileNode = {
                  id: newFileId,
                  name: file.name,
                  type: 'file',
                  content: content,
                  children: []
              };
              setFiles(prev => [...prev, newFile]);
              setActiveFileId(newFileId);
              setCode(content);
              setView('editor');
              if (currentUser) {
                incrementUsage(currentUser.id, { storageBytes: content.length });
                refreshCurrentUser();
              }
          }
      };
      reader.readAsText(file);
  };

  const pushConversionHint = (text: string) => {
    setConversionHint(text);
    if (conversionHintTimeoutRef.current) {
      clearTimeout(conversionHintTimeoutRef.current);
    }
    conversionHintTimeoutRef.current = setTimeout(() => {
      setConversionHint(null);
    }, 2600);
  };

  const pushConversionHistory = (label: string) => {
    setConversionHistory(prev => {
      const next = [...prev, { id: generateId(), label, timestamp: Date.now() }];
      return next.slice(-8);
    });
  };

  const applyCodeToActiveFile = (nextValue: string) => {
    setCode(nextValue);
    setFiles(prev => updateNodeInTree(prev, activeFileId, (node) => ({ ...node, content: nextValue })));
  };

  const handleConvertEnglishNow = (triggerPreview = true) => {
    const activeNode = findFileById(files, activeFileId);
    if (!activeNode || activeNode.type !== 'file') return;

    const converted = autoConvertEnglishBatches(code, activeNode.name, {
      batchSize: naturalBatchSize,
      convertPartial: true
    });
    if (converted.convertedLines === 0 || converted.content === code) {
      pushConversionHint('No new English lines to convert.');
      return;
    }

    setLastAutoConvertedSource(code);
    setLastLocalConvertInfo({ lines: converted.convertedLines, batches: converted.batchCount });
    pushConversionHint(`Converted ${converted.convertedLines} English lines.`);
    pushConversionHistory(`Manual convert: ${converted.convertedLines} lines`);
    applyCodeToActiveFile(converted.content);
    if (triggerPreview) {
      triggerCompile(converted.content, true);
    }
  };

  const handleUndoLastConversion = () => {
    if (!lastAutoConvertedSource) {
      pushConversionHint('Nothing to undo.');
      return;
    }
    applyCodeToActiveFile(lastAutoConvertedSource);
    setLastAutoConvertedSource(null);
    pushConversionHint('Reverted the last auto-conversion.');
  };

  const handleEditorChange = (newVal: string) => {
    const activeNode = findFileById(files, activeFileId);
    let nextValue = newVal;

    if (autoNaturalEnabled && !isApplyingLocalConversion.current && activeNode?.type === 'file') {
      const converted = autoConvertEnglishBatches(newVal, activeNode.name, {
        batchSize: naturalBatchSize
      });
      if (converted.convertedLines > 0 && converted.content !== newVal) {
        isApplyingLocalConversion.current = true;
        setLastAutoConvertedSource(newVal);
        nextValue = converted.content;
        setLastLocalConvertInfo({ lines: converted.convertedLines, batches: converted.batchCount });
        pushConversionHint(`Auto-converted ${converted.convertedLines} lines.`);
        pushConversionHistory(`Auto convert: ${converted.convertedLines} lines`);
        requestAnimationFrame(() => {
          isApplyingLocalConversion.current = false;
        });
      }
    }

    applyCodeToActiveFile(nextValue);
  };

  const appendConvertedNaturalDraft = (lines: string[], sourceLabel: string, triggerPreview = false) => {
    const activeNode = findFileById(files, activeFileId);
    if (!activeNode || activeNode.type !== 'file' || lines.length === 0) return;
    const language = detectLanguageFromFilename(activeNode.name);
    const chunks: string[] = [];

    for (let i = 0; i < lines.length; i += naturalBatchSize) {
      const batch = lines.slice(i, i + naturalBatchSize);
      chunks.push(compileEnglishLinesToCode(batch, language));
    }

    const snippet = chunks.join('\n\n').trim();
    if (!snippet) return;
    setLastAutoConvertedSource(code);
    const nextCode = code.trim() ? `${code}\n\n${snippet}` : snippet;
    applyCodeToActiveFile(nextCode);
    setLastLocalConvertInfo({
      lines: lines.length,
      batches: Math.max(1, Math.ceil(lines.length / Math.max(1, naturalBatchSize)))
    });
    pushConversionHint(`${sourceLabel}: converted ${lines.length} lines.`);
    pushConversionHistory(`${sourceLabel}: ${lines.length} lines`);
    if (triggerPreview) {
      triggerCompile(nextCode, true);
    }
  };

  const handleNaturalDraftChange = (nextDraft: string) => {
    setNaturalDraft(nextDraft);
    const draftLines = nextDraft
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    const convertibleCount = Math.floor(draftLines.length / Math.max(1, naturalBatchSize)) * Math.max(1, naturalBatchSize);
    if (!autoNaturalEnabled || convertibleCount === 0 || !nextDraft.endsWith('\n')) return;

    const convertibleLines = draftLines.slice(0, convertibleCount);
    const remaining = draftLines.slice(convertibleCount);
    appendConvertedNaturalDraft(convertibleLines, 'Natural pad auto', true);
    setNaturalDraft(remaining.join('\n'));
  };

  const handleConvertNaturalDraftNow = () => {
    const draftLines = naturalDraft
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    if (draftLines.length === 0) {
      pushConversionHint('Natural pad is empty.');
      return;
    }
    appendConvertedNaturalDraft(draftLines, 'Natural pad', true);
    setNaturalDraft('');
  };

  const handleCursorChange = (line: number, col: number) => {
      setCursorPos({ line, col });
  };

  const triggerCompile = async (sourceCode: string, force: boolean = false) => {
    if (!sourceCode.trim()) return;
    if (!force && sourceCode === lastCompiledCode.current) return;

    if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
        debounceTimeout.current = null;
    }

    const timestamp = Date.now();
    lastRequestTime.current = timestamp;
    
    setIsCompiling(true);
    setError(null);

    try {
      const activeFile = findFileById(files, activeFileId);
      const isHtmlFile = activeFile?.name.endsWith('.html');
      const shouldCompileToSource = isHtmlFile && !sourceCode.trim().startsWith('<') && !sourceCode.trim().startsWith('<!');

      let html = '';
      if (shouldCompileToSource) {
          html = await compileEnglishToApp(sourceCode, compilerMode, selectedEditorModel);
          if (lastRequestTime.current === timestamp) {
             handleEditorChange(html);
             setCompiledHtml(html);
             lastCompiledCode.current = html;
          }
      } else {
          if (isHtmlFile) {
             html = sourceCode; 
             setCompiledHtml(html);
          } else {
             html = await compileEnglishToApp(sourceCode, compilerMode, selectedEditorModel);
             setCompiledHtml(html);
          }
          lastCompiledCode.current = sourceCode;
      }
      
      if (lastRequestTime.current === timestamp) {
          setIsCompiling(false);
      }

    } catch (err: any) {
      if (lastRequestTime.current === timestamp) {
        console.error(err);
        setIsCompiling(false);
        setError("Compilation failed. Please try again.");
      }
    }
  };

  useEffect(() => {
      if (code && !isCompiling && view === 'editor') {
          triggerCompile(code, true);
      }
  }, [compilerMode, view, selectedEditorModel]);

  useEffect(() => {
    if (view === 'editor') {
        triggerCompile(code);
    }
  }, [view]); 

  useEffect(() => {
    if (view !== 'editor' || !code.trim()) return;
    if (liveCompileTimeoutRef.current) {
      clearTimeout(liveCompileTimeoutRef.current);
    }
    liveCompileTimeoutRef.current = setTimeout(() => {
      triggerCompile(code);
    }, 700);

    return () => {
      if (liveCompileTimeoutRef.current) {
        clearTimeout(liveCompileTimeoutRef.current);
      }
    };
  }, [code, view, activeFileId, compilerMode, selectedEditorModel]);

  const handleManualRun = () => {
    triggerCompile(code, true);
  };
  
  const handleElementSelect = (element: { tagName: string, text: string }) => {
    setSelectedElement(element);
    setIsSelectionMode(false);
  };

  const handleGhostwriterSubmit = async (e: React.FormEvent | React.KeyboardEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    const rawPrompt = overridePrompt || ghostwriterInput;
    const promptText = isFlashMode ? `[FLASH MODE] ${rawPrompt}` : rawPrompt;
    if (!promptText.trim()) return;
    if (currentUser && currentUser.usage.aiRequests >= currentUser.usage.aiLimit) {
        setError(`AI limit reached for ${currentUser.subscription.toUpperCase()} tier.`);
        return;
    }
    
    // Add user message
    setChatHistory(prev => [...prev, { role: 'user', text: promptText }]);
    setGhostwriterInput("");
    setIsModifying(true);
    setError(null);

    try {
        let newCode = code;
        let responseMsg = "Done.";

        if (selectedElement) {
            newCode = await modifyEnglishCode(code, selectedElement, promptText, selectedEditorModel);
            handleEditorChange(newCode); 
            setSelectedElement(null);
            responseMsg = `I've updated the ${selectedElement.tagName} as requested.`;
        } else {
            const addedLogic = await generateEnglishLogic(promptText, code, selectedEditorModel);
            newCode = code.trim() 
                ? `${code}\n\n// ${promptText}\n${addedLogic}` 
                : `// ${promptText}\n${addedLogic}`;
            handleEditorChange(newCode); 
            responseMsg = "I've added that to your code.";
        }
        triggerCompile(newCode, true);
        setChatHistory(prev => [...prev, { role: 'model', text: responseMsg }]);
        if (currentUser) {
            incrementUsage(currentUser.id, {
                aiRequests: 1,
                tokensUsed: Math.ceil((promptText.length + newCode.length) / 4)
            });
            refreshCurrentUser();
        }
    } catch(err: any) {
        console.error(err);
        setError("Ghostwriter failed. Please try again.");
        setChatHistory(prev => [...prev, { role: 'model', text: "Sorry, I ran into an error processing that." }]);
    } finally {
        setIsModifying(false);
    }
  };

  // --- File System Handlers ---

  // Toggle between English and Code with Name Swap and Delay
  const handleFileSwap = async (e: React.MouseEvent, node: FileNode) => {
    e.stopPropagation();
    
    // If currently translating this specific file, ignore
    if (translatingFileId === node.id) return;

    // Start the "Flip Out" animation (0 -> 90deg)
    setTranslatingFileId(node.id);

    // Wait for the half-flip to complete (300ms)
    await new Promise(r => setTimeout(r, 300));

    // Perform the logic/data swap while "hidden" at 90deg
    if (node.isTranslated) {
        // Swap BACK to original code
        setFiles(prev => updateNodeInTree(prev, node.id, n => ({ 
            ...n, 
            content: n.originalContent || n.content, // Restore original
            name: n.originalName || n.name, // Restore name
            isTranslated: false,
            originalContent: undefined,
            originalName: undefined
        })));
        
        if (activeFileId === node.id) {
            setCode(node.originalContent || node.content || "");
        }
    } else {
        // Swap TO English
        const currentContent = node.content || "";
        
        const englishVersion = await explainCode(currentContent, selectedEditorModel);
        // Swap Extension
        const newName = node.name.replace(/\.[^/.]+$/, "") + ".en";
        
        setFiles(prev => updateNodeInTree(prev, node.id, n => ({ 
            ...n, 
            content: englishVersion, 
            name: newName,
            isTranslated: true,
            originalContent: currentContent, // Save original
            originalName: node.name
        })));

        if (activeFileId === node.id) {
            setCode(englishVersion);
        }
    }
    
    // Allow the component to re-render with new data while still effectively "invisible" at 90deg
    // Then trigger the "Flip In" animation (90 -> 0deg) by clearing the translating ID
    // We add a tiny delay to ensure the DOM has updated with new text before flipping back
    setTimeout(() => {
        setTranslatingFileId(null);
    }, 50);
  };

  const handleFileClick = (e: React.MouseEvent, node: FileNode) => {
    if (node.type === 'folder') {
      setFiles(prev => updateNodeInTree(prev, node.id, n => ({ ...n, isOpen: !n.isOpen })));
    } else {
      if (activeFileId === node.id) {
          handleFileSwap(e, node);
      } else {
          setActiveFileId(node.id);
          setCode(node.content || "");
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.pageX, y: e.pageY, nodeId });
  };

  const handleDeleteNode = () => {
    if (!contextMenu) return;
    const newFiles = deleteNodeFromTree(files, contextMenu.nodeId);
    setFiles(newFiles);
    if (!nodeExists(newFiles, activeFileId)) {
        const nextFile = findFirstFile(newFiles);
        setActiveFileId(nextFile?.id || '');
        setCode(nextFile?.content || '');
    }
    setContextMenu(null);
  };

  const startRenaming = () => {
    if (!contextMenu) return;
    const node = findFileById(files, contextMenu.nodeId);
    if (node) {
        setRenameValue(node.name);
        setRenamingNodeId(node.id);
    }
    setContextMenu(null);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!renamingNodeId || !renameValue.trim()) {
          setRenamingNodeId(null);
          return;
      }
      setFiles(prev => updateNodeInTree(prev, renamingNodeId, n => ({ ...n, name: renameValue })));
      setRenamingNodeId(null);
  };

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim() || !isCreating) return;
    const trimmedName = newFileName.trim();
    const initialTemplate = isCreating.type === 'file' ? createTemplateForFileName(trimmedName) : undefined;

    const newNode: FileNode = {
      id: generateId(),
      name: trimmedName,
      type: isCreating.type,
      content: isCreating.type === 'file' ? initialTemplate : undefined,
      children: isCreating.type === 'folder' ? [] : undefined,
      isOpen: true
    };

    setFiles(prev => addNodeToTree(prev, isCreating.parentId, newNode));
    
    if (isCreating.type === 'file') {
      setActiveFileId(newNode.id);
      setCode(initialTemplate || "");
    }

    setIsCreating(null);
    setNewFileName("");
  };

  const startCreating = (type: FileType) => {
    setIsCreating({ type, parentId: null });
    setShowAddMenu(false);
    setTimeout(() => document.getElementById('new-file-input')?.focus(), 100);
  };

  const handleManualSave = () => {
    if (!activeFileId) return;
    const currentNode = findFileById(files, activeFileId);
    const snapshot: FileVersion = {
      content: code,
      savedAt: Date.now()
    };
    setFileVersions(prev => {
      const existing = prev[activeFileId] || [];
      const deduped =
        existing.length > 0 && existing[existing.length - 1].content === code
          ? existing
          : [...existing, snapshot].slice(-30);
      return {
        ...prev,
        [activeFileId]: deduped
      };
    });
    if (currentNode) {
      setFiles(prev => updateNodeInTree(prev, activeFileId, n => ({ ...n, content: code })));
    }
  };

  const handleRestoreLastVersion = () => {
    if (!activeFileId) return;
    const versions = fileVersions[activeFileId] || [];
    if (versions.length === 0) return;
    const latest = versions[versions.length - 1];
    setCode(latest.content);
    setFiles(prev => updateNodeInTree(prev, activeFileId, n => ({ ...n, content: latest.content })));
  };

  const handleDownloadProject = () => {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;
    const payload = {
      id: project.id,
      ownerId: project.ownerId,
      name: project.name,
      description: project.description,
      visibility: project.visibility,
      type: project.type,
      status: project.status,
      exportedAt: new Date().toISOString(),
      files: project.files,
      chatHistory: project.chatHistory
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (project.name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = `${safeName}.natural-project.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenPreviewInNewTab = () => {
    const previewWin = window.open('', '_blank');
    if (!previewWin) return;
    previewWin.document.open();
    previewWin.document.write(compiledHtml || DEFAULT_IFRAME_CONTENT);
    previewWin.document.close();
  };

  const handleAttachContext = () => {
    const fileName = activeFileNode?.name || 'active file';
    const contextSnippet = `[Context: ${fileName}]`;
    setGhostwriterInput(prev => (prev ? `${prev}\n${contextSnippet}` : contextSnippet));
  };

  const handleRestoreVersion = (savedAt: number) => {
    if (!activeFileId) return;
    const versions = fileVersions[activeFileId] || [];
    const target = versions.find(v => v.savedAt === savedAt);
    if (!target) return;
    setCode(target.content);
    setFiles(prev => updateNodeInTree(prev, activeFileId, n => ({ ...n, content: target.content })));
    setShowHistoryMenu(false);
  };

  const FileTreeItem: React.FC<{ node: FileNode, depth: number }> = ({ node, depth }) => {
    const isActive = node.id === activeFileId;
    const isRenaming = renamingNodeId === node.id;
    const isTranslating = translatingFileId === node.id;
    const paddingLeft = `${depth * 12 + 12}px`;

    return (
      <div className="select-none relative perspective-1000">
        <div 
          className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-colors text-[13px] group
            ${isActive ? 'bg-white/10 text-white' : 'text-subtext hover:text-white hover:bg-white/5'}
          `}
          style={{ paddingLeft }}
          onClick={(e) => handleFileClick(e, node)}
          onContextMenu={(e) => handleContextMenu(e, node.id)}
        >
          {/* Animated Container for Icon and Name with 3D Flip */}
          <div className={`flex items-center gap-1.5 flex-1 min-w-0 transition-transform duration-300 ease-in-out preserve-3d origin-center ${isTranslating ? 'rotate-y-90 opacity-0' : 'rotate-y-0 opacity-100'}`}>
              
              {/* Clickable Icon to Trigger Swap */}
              <button 
                  onClick={(e) => {
                      if(node.type === 'file') {
                          handleFileSwap(e, node);
                      }
                  }}
                  className="shrink-0 flex items-center justify-center w-5 h-5 relative hover:scale-110 transition-transform"
                  title="Click to Translate/Swap"
              >
                 <FileIcon name={node.name} type={node.type} isOpen={node.isOpen} />
                 {node.isTranslated && (
                     <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border border-[#0e1011] shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse"></div>
                 )}
              </button>

              {isRenaming ? (
                 <form onSubmit={handleRenameSubmit} onClick={e => e.stopPropagation()} className="flex-1 min-h-0">
                     <input 
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        className="w-full bg-[#3c3c3c] border border-[#007fd4] text-white px-1 py-0.5 outline-none rounded-sm"
                     />
                 </form>
              ) : (
                 <span className={`truncate flex-1 transition-colors ${node.isTranslated ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 font-medium' : ''}`}>
                    {node.name}
                 </span>
              )}
          </div>

          {/* Swap Button (Visible on Hover) - Alternative Trigger */}
          {node.type === 'file' && !isTranslating && (
              <button 
                onClick={(e) => handleFileSwap(e, node)}
                className={`w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-subtext hover:text-white transition-all transform scale-0 group-hover:scale-100`}
                title={node.isTranslated ? "Restore Code" : "Translate to English"}
              >
                  <span className="material-symbols-outlined text-[16px] hover:text-purple-400 transition-colors">
                      {node.isTranslated ? 'code' : 'translate'}
                  </span>
              </button>
          )}
        </div>
        {node.isOpen && node.children && (
          <div>
            {node.children.map(child => (
              <FileTreeItem key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const activeFileNode = findFileById(files, activeFileId);
  const activeProject = projects.find(project => project.id === currentProjectId);
  const selectedEditorModelOption =
    OPENROUTER_FREE_MODELS.find(model => model.id === selectedEditorModel) || OPENROUTER_FREE_MODELS[0];

  const getModeLabel = (mode: CompilerMode) => {
      switch(mode) {
          case 'ai': return 'AI Cloud';
          case 'local': return 'Local';
          case 'hybrid': return 'Hybrid';
      }
  };

  const getModeIcon = (mode: CompilerMode) => {
      switch(mode) {
          case 'ai': return 'cloud_done';
          case 'local': return 'bolt';
          case 'hybrid': return 'auto_fix';
      }
  };

  const getActiveLanguage = () => {
    const fileName = activeFileNode?.name || '';
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
    if (!ext) return 'TEXT';
    if (ext === 'ts' || ext === 'tsx') return 'TypeScript';
    if (ext === 'js' || ext === 'jsx') return 'JavaScript';
    if (ext === 'html') return 'HTML';
    if (ext === 'css') return 'CSS';
    if (ext === 'json') return 'JSON';
    if (ext === 'md') return 'Markdown';
    if (ext === 'en') return 'Natural';
    return ext.toUpperCase();
  };

  const getEditorLanguage = () => {
    const fileName = activeFileNode?.name || '';
    const localLanguage = detectLanguageFromFilename(fileName);
    if (localLanguage === 'plaintext') return 'plaintext';
    if (localLanguage === 'javascript') return 'javascript';
    if (localLanguage === 'typescript') return 'typescript';
    if (localLanguage === 'python') return 'python';
    if (localLanguage === 'markdown') return 'markdown';
    return localLanguage;
  };

  const getNaturalPresets = () => {
    const language = detectLanguageFromFilename(activeFileNode?.name || '');
    if (language === 'html') {
      return [
        'Add a title "Dashboard"',
        'Create a button "Run Build" id run-build',
        'Create an input placeholder "Search projects"',
        'Create a list with items Home, Projects, Team'
      ];
    }
    if (language === 'css') {
      return [
        'Set body background to #0a0d12',
        'Set .card radius to 16px',
        'Set .card shadow to 0 12px 30px rgba(0,0,0,0.35)',
        'Set button text color to white'
      ];
    }
    if (language === 'javascript' || language === 'typescript') {
      return [
        'Create function calculate total',
        'Set variable count to 0',
        'When #run-build clicked log "Build started"',
        'Fetch from https://api.github.com/repos/facebook/react'
      ];
    }
    if (language === 'python') {
      return [
        'Create function main',
        'Set variable retries to 3',
        'Print "Process started"',
        'Set variable status to ready'
      ];
    }
    if (language === 'sql') {
      return [
        'Create table tasks columns title text, status text, priority int',
        'Insert into tasks values build editor, active, 1',
        'Select from tasks',
        'Delete from tasks'
      ];
    }
    if (language === 'json') {
      return [
        'Set name to natural-editor',
        'Set version to 2',
        'Set mode to production',
        'Set feature_flags to true'
      ];
    }
    return [
      'Create a reusable component',
      'Add validation for empty fields',
      'Log each user action',
      'Create a clean layout with spacing'
    ];
  };

  const handleInsertNaturalPreset = (preset: string) => {
    const next = naturalDraft.trim() ? `${naturalDraft}\n${preset}\n` : `${preset}\n`;
    handleNaturalDraftChange(next);
  };

  // --- Render ---
  if (isAuthInitializing) {
      return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-white/70">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Signing you in...
          </div>
        </div>
      );
  }

  if (view === 'home') {
      return (
        <Home 
            onStart={handleStart} 
            onLogin={handleLogin}
            onSignup={handleSignup}
            onOpenDocs={() => setView('docs')}
        />
      );
  }

  if (view === 'auth') {
      return (
          <Auth 
            initialView={authMode} 
            onComplete={handleAuthComplete}
            onBack={() => setView('home')}
            onLogin={login}
            onSignup={signUp}
            onRequestPasswordReset={requestPasswordReset}
            onResetPassword={resetPassword}
            onOAuthLogin={signInWithOAuth}
          />
      );
  }

  if (view === 'dashboard') {
      return (
          <Dashboard 
            onNavigate={setView}
            onCreateProject={handleDashboardCreate}
            onOpenProject={handleDashboardOpen}
            onRenameProject={handleDashboardRename}
            onDeleteProject={handleDashboardDelete}
            onDuplicateProject={handleDashboardDuplicate}
            onArchiveProject={handleDashboardArchive}
            onFileUpload={handleFileUpload}
            onOpenCodeInEditor={handleOpenCodeInEditor}
            projects={projects}
            userName={currentUser?.name || 'User'}
            userAvatar={currentUser?.avatar || ''}
            currentUserId={currentUser?.id || null}
            currentUserEmail={currentUser?.email || null}
            userPlan={currentUser?.subscription || 'free'}
            userUsage={currentUser ? { aiRequests: currentUser.usage.aiRequests, aiLimit: currentUser.usage.aiLimit } : undefined}
            onLogout={handleLogout}
          />
      );
  }

  if (view === 'control' && currentUser) {
      const users = getAllUsers();
      const teams = listTeamsForUser(currentUser.id);
      const metrics = getAdminMetrics();
      return (
          <ControlCenter
            currentUser={currentUser}
            users={users}
            teams={teams}
            metrics={metrics}
            onBack={() => setView('dashboard')}
            onLogout={handleLogout}
            onVerifyEmail={() => {
              void Promise.resolve(verifyEmail(currentUser.id)).catch((err) => alert(err?.message || 'Failed to verify email.'));
              refreshCurrentUser();
            }}
            onSaveProfile={(input) => {
              void Promise.resolve(updateProfile(currentUser.id, input))
                .then(() => refreshCurrentUser())
                .catch((err) => alert(err?.message || 'Failed to update profile.'));
            }}
            onUploadAvatar={(file) => {
              return Promise.resolve(uploadProfileAvatar(file))
                .then(() => refreshCurrentUser())
                .catch((err) => alert(err?.message || 'Failed to upload profile photo.'));
            }}
            onChangePassword={(oldPassword, newPassword) => {
              void Promise.resolve(changePassword(currentUser.id, oldPassword, newPassword))
                .then(() => refreshCurrentUser())
                .catch((err) => alert(err?.message || 'Failed to change password.'));
            }}
            onDeleteAccount={() => {
              void Promise.resolve(deleteAccount(currentUser.id))
                .then(() => handleLogout())
                .catch((err) => alert(err?.message || 'Failed to delete account.'));
            }}
            onSetSubscription={(tier: SubscriptionTier) => {
              setSubscription(currentUser.id, tier);
              refreshCurrentUser();
            }}
            onCreateTeam={(name, description) => {
              createTeam(currentUser.id, { name, description });
              refreshCurrentUser();
            }}
            onInviteToTeam={(teamId, email, role: TeamRole) => {
              inviteToTeam(teamId, email, role);
              refreshCurrentUser();
            }}
            onLeaveTeam={(teamId) => {
              leaveTeam(teamId, currentUser.id);
              refreshCurrentUser();
            }}
            onBanUser={(userId, banned) => {
              adminBanUser(userId, banned);
              refreshCurrentUser();
            }}
            onAdjustAiLimit={(userId, limit) => {
              adminAdjustAiLimit(userId, limit);
              refreshCurrentUser();
            }}
          />
      );
  }

  if (view === 'docs') {
      return (
          <Docs onClose={() => setView('home')} />
      );
  }

  if (view === 'editor') {
      const project = projects.find(p => p.id === currentProjectId);
      return (
        <NaturalWorkspace
          projectName={project?.name || 'Natural Project'}
          userName={currentUser?.name || 'You'}
          onBack={() => setView('dashboard')}
        />
      );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden text-sm selection:bg-accent/30 bg-[#0e1011] text-text-primary font-sans animate-in fade-in duration-500">
      
      {/* HEADER */}
      <header className="h-16 border-b border-[#2b3035] bg-[#0e1011] flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
             <button onClick={() => setView('dashboard')} className="hover:opacity-80 transition-opacity">
                <img 
                    src="https://image2url.com/r2/default/images/1770671775593-5b527895-259d-46ef-9a60-d72b5b2dce9c.png" 
                    alt="Natural Editor" 
                    className="w-14 h-14 object-contain mix-blend-screen"
                />
            </button>
            <div className="flex items-center gap-2 text-[#8d96a0] text-xs">
              <span className="hover:text-white cursor-pointer transition-colors font-medium">{activeProject?.name || 'Project'}</span>
              <span className="material-symbols-outlined text-[16px] text-green-500">play_arrow</span>
            </div>
            <button onClick={() => setView('control')} className="bg-[#3b82f6] hover:bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors">
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                Upgrade
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#1c1e21] border border-[#2b3035] rounded-full px-3 py-1 gap-2">
             <span className="material-symbols-outlined text-[#8d96a0] text-[16px]">search</span>
          </div>
          <button
            onClick={handleManualSave}
            className="bg-[#1c1e21] border border-[#2b3035] hover:border-[#3b82f6] text-[#e6edf3] text-xs font-medium px-3 py-1.5 rounded transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleRestoreLastVersion}
            className="bg-[#1c1e21] border border-[#2b3035] hover:border-[#22c55e] text-[#e6edf3] text-xs font-medium px-3 py-1.5 rounded transition-colors"
          >
            Restore
          </button>
          <button onClick={() => setView('control')} className="text-[#8d96a0] hover:text-white transition-colors" title="Manage team and account">
             <span className="material-symbols-outlined text-[20px]">person_add</span>
          </button>
          <button
            onClick={() => setView('control')}
            className="bg-[#1c1e21] border border-[#2b3035] hover:border-[#a3a3a3] text-[#e6edf3] text-xs font-medium px-3 py-1.5 rounded transition-colors"
          >
            Account
          </button>
          <button onClick={handleDownloadProject} className="bg-white hover:bg-gray-200 text-black text-xs font-bold px-4 py-1.5 rounded transition-colors flex items-center gap-2">
             <span className="material-symbols-outlined text-[16px]">upload</span> Publish
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANE (Chat / AI Agent) */}
        <aside className="w-[30%] lg:w-[400px] border-r border-[#2b3035] bg-[#0e1011] flex flex-col shrink-0 relative">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0e1011] relative">
                {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <div className="w-16 h-16 bg-[#1c1e21] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-black/50 border border-[#2b3035]">
                            <span className="material-symbols-outlined text-[#8d96a0] text-3xl">chat_bubble</span>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">New chat with Agent</h2>
                        <p className="text-sm text-[#8d96a0] mb-8 max-w-[260px] leading-relaxed">
                            Agent can make changes, review its work, and debug itself automatically.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                            <button onClick={(e) => handleGhostwriterSubmit(e, "Check my app for bugs")} className="p-4 bg-[#1c1e21] border border-[#2b3035] rounded-xl text-left hover:bg-[#25282c] transition-colors group h-24 flex flex-col justify-between">
                                <span className="text-[13px] text-[#8d96a0] group-hover:text-white font-medium leading-tight">Check my app for bugs</span>
                            </button>
                            <button onClick={(e) => handleGhostwriterSubmit(e, "Add payment processing")} className="p-4 bg-[#1c1e21] border border-[#2b3035] rounded-xl text-left hover:bg-[#25282c] transition-colors group h-24 flex flex-col justify-between">
                                <span className="text-[13px] text-white font-medium leading-tight">Add payment processing</span>
                            </button>
                            <button onClick={(e) => handleGhostwriterSubmit(e, "Connect with an AI Assistant")} className="p-4 bg-[#1c1e21] border border-[#2b3035] rounded-xl text-left hover:bg-[#25282c] transition-colors group h-24 flex flex-col justify-between">
                                <span className="text-[13px] text-[#8d96a0] group-hover:text-white font-medium leading-tight">Connect with an AI Assistant</span>
                            </button>
                            <button onClick={(e) => handleGhostwriterSubmit(e, "Add SMS message sending")} className="p-4 bg-[#1c1e21] border border-[#2b3035] rounded-xl text-left hover:bg-[#25282c] transition-colors group h-24 flex flex-col justify-between">
                                <span className="text-[13px] text-[#8d96a0] group-hover:text-white font-medium leading-tight">Add SMS message sending</span>
                            </button>
                            <button onClick={(e) => handleGhostwriterSubmit(e, "Add a database")} className="p-4 bg-[#1c1e21] border border-[#2b3035] rounded-xl text-left hover:bg-[#25282c] transition-colors group h-24 flex flex-col justify-between">
                                <span className="text-[13px] text-[#8d96a0] group-hover:text-white font-medium leading-tight">Add a database</span>
                            </button>
                            <button onClick={(e) => handleGhostwriterSubmit(e, "Add authenticated user login")} className="p-4 bg-[#1c1e21] border border-[#2b3035] rounded-xl text-left hover:bg-[#25282c] transition-colors group h-24 flex flex-col justify-between">
                                <span className="text-[13px] text-[#8d96a0] group-hover:text-white font-medium leading-tight">Add authenticated user login</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 pt-4">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                    msg.role === 'user' 
                                        ? 'bg-[#3b82f6] text-white rounded-br-none' 
                                        : 'bg-[#1c1e21] text-[#e6edf3] rounded-bl-none border border-[#2b3035]'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isModifying && (
                            <div className="flex justify-start">
                                <div className="bg-[#1c1e21] border border-[#2b3035] rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                )}
            </div>

            {/* Prompt Input */}
            <div className="p-4 border-t border-[#2b3035] bg-[#0e1011]">
                <div className="bg-[#151719] border border-[#2b3035] rounded-xl flex flex-col p-3 shadow-lg focus-within:border-[#3b82f6]/50 transition-colors">
                    <textarea 
                        value={ghostwriterInput}
                        onChange={(e) => setGhostwriterInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleGhostwriterSubmit(e)}
                        placeholder="Make lightweight changes, quickly..." 
                        className="bg-transparent text-sm text-[#e6edf3] placeholder-[#666] outline-none w-full resize-none h-14 custom-scrollbar mb-2"
                    />
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={handleManualRun} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c1e21] border border-[#2b3035] rounded-lg text-xs font-medium text-[#8d96a0] hover:text-white hover:bg-[#25282c] transition-colors">
                            <span className="material-symbols-outlined text-[14px]">deployed_code</span>
                            Build
                        </button>
                        
                        <div className="flex items-center gap-2">
                            <div className="relative" ref={editorModelMenuRef}>
                                <button
                                  onClick={() => setShowEditorModelMenu(v => !v)}
                                  className="text-[#8d96a0] hover:text-white transition-colors px-2 py-1 rounded border border-[#2b3035] hover:border-[#3b82f6] text-[11px] font-medium flex items-center gap-1"
                                  title={selectedEditorModel}
                                >
                                  {selectedEditorModelOption?.shortLabel || 'Model'}
                                  <span className="material-symbols-outlined text-[14px]">expand_more</span>
                                </button>
                                {showEditorModelMenu && (
                                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-[#151719] border border-[#2b3035] rounded-lg shadow-xl p-1 z-40">
                                    {OPENROUTER_FREE_MODELS.map(model => (
                                      <button
                                        key={model.id}
                                        onClick={() => {
                                          setSelectedEditorModel(model.id);
                                          setShowEditorModelMenu(false);
                                        }}
                                        className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center justify-between ${
                                          selectedEditorModel === model.id
                                            ? 'bg-[#1c1e21] text-white'
                                            : 'text-[#8d96a0] hover:text-white hover:bg-[#1c1e21]'
                                        }`}
                                      >
                                        <span className="truncate">{model.label}</span>
                                        {selectedEditorModel === model.id && (
                                          <span className="material-symbols-outlined text-[14px]">check</span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                            </div>
                            <button onClick={handleAttachContext} className="text-[#8d96a0] hover:text-white transition-colors p-1.5 rounded hover:bg-white/5" title="Attach active file context">
                                <span className="material-symbols-outlined text-[18px]">attach_file</span>
                            </button>
                            <button onClick={() => setIsFlashMode(v => !v)} className={`transition-colors p-1.5 rounded hover:bg-white/5 ${isFlashMode ? 'text-yellow-300' : 'text-[#8d96a0] hover:text-white'}`} title="Flash mode: faster concise edits">
                                <span className="material-symbols-outlined text-[18px]">bolt</span>
                            </button>
                            <button 
                                onClick={(e) => handleGhostwriterSubmit(e as any)}
                                disabled={!ghostwriterInput.trim() || isModifying}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${ghostwriterInput.trim() ? 'bg-[#3b82f6] hover:bg-blue-500 text-white' : 'bg-[#2b3035] text-[#8d96a0]'}`}
                            >
                                {isModifying ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        {/* EDITOR AREA */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0e1011] relative">
          {/* Editor Header / Tabs */}
          <div className="flex items-center justify-between h-10 bg-[#0e1011] border-b border-[#2b3035]">
            <div className="flex items-center min-w-0">
              <div className="flex h-full items-center px-4 gap-2 bg-[#0e1011] text-[#e6edf3] text-xs font-medium cursor-pointer relative group border-r border-[#2b3035] min-w-0">
              <span className="shrink-0 flex items-center text-orange-500">
                 {activeFileNode ? <FileIcon name={activeFileNode.name} type={activeFileNode.type} /> : <span className="material-symbols-outlined text-[16px]">description</span>}
              </span>
              <span className="truncate max-w-[150px]">{activeFileNode?.name || 'Untitled'}</span>
              {/* Active Indicator */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-orange-500"></div>
              </div>

              <button onClick={() => setShowAddMenu(true)} className="h-full flex items-center px-3 text-[#8d96a0] hover:text-white hover:bg-[#1c1e21] transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5 pr-2">
              <button
                onClick={() => setAutoNaturalEnabled(v => !v)}
                className={`px-2.5 py-1 rounded-md border text-[10px] font-semibold tracking-wide transition-colors ${
                  autoNaturalEnabled
                    ? 'border-[#2f5d3f] bg-[#173022] text-[#8ef0b5]'
                    : 'border-[#2b3035] bg-[#14171a] text-[#8d96a0] hover:text-white'
                }`}
                title="Auto convert every N English lines"
              >
                Natural {autoNaturalEnabled ? 'ON' : 'OFF'}
              </button>
              <select
                value={naturalBatchSize}
                onChange={(e) => setNaturalBatchSize(Number(e.target.value))}
                className="h-7 px-2 rounded-md border border-[#2b3035] bg-[#14171a] text-[#c8d0d8] text-[10px] outline-none"
                title="English lines per batch"
              >
                <option value={3}>3 lines</option>
                <option value={5}>5 lines</option>
                <option value={8}>8 lines</option>
              </select>
              <button
                onClick={() => handleConvertEnglishNow(true)}
                className="px-2.5 py-1 rounded-md border border-[#2b3035] bg-[#14171a] text-[#c8d0d8] text-[10px] font-semibold hover:text-white hover:border-[#3b82f6] transition-colors"
                title="Convert current English lines now (Cmd/Ctrl+L)"
              >
                Convert Now
              </button>
              <button
                onClick={handleUndoLastConversion}
                className="px-2.5 py-1 rounded-md border border-[#2b3035] bg-[#14171a] text-[#c8d0d8] text-[10px] font-semibold hover:text-white hover:border-[#f59e0b] transition-colors"
                title="Undo last auto/manual conversion"
              >
                Undo Convert
              </button>
              <button
                onClick={() => setWordWrapEnabled(v => !v)}
                className={`px-2.5 py-1 rounded-md border text-[10px] font-semibold transition-colors ${
                  wordWrapEnabled
                    ? 'border-[#1f4d70] bg-[#122636] text-[#85d4ff]'
                    : 'border-[#2b3035] bg-[#14171a] text-[#8d96a0] hover:text-white'
                }`}
                title="Toggle word wrap"
              >
                Wrap {wordWrapEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setShowNaturalDock(v => !v)}
                className={`px-2.5 py-1 rounded-md border text-[10px] font-semibold transition-colors ${
                  showNaturalDock
                    ? 'border-[#3f3570] bg-[#1d1735] text-[#c2b7ff]'
                    : 'border-[#2b3035] bg-[#14171a] text-[#8d96a0] hover:text-white'
                }`}
                title="Show/hide Natural language pad"
              >
                Pad {showNaturalDock ? 'ON' : 'OFF'}
              </button>
            </div>
            {showAddMenu && (
              <div ref={addMenuRef} className="absolute top-10 left-[190px] z-30 w-44 bg-[#151719] border border-[#2b3035] rounded-lg shadow-xl p-1">
                <button onClick={() => startCreating('file')} className="w-full text-left px-3 py-2 text-xs text-[#e6edf3] hover:bg-[#1c1e21] rounded">New File</button>
                <button onClick={() => startCreating('folder')} className="w-full text-left px-3 py-2 text-xs text-[#e6edf3] hover:bg-[#1c1e21] rounded">New Folder</button>
              </div>
            )}
          </div>
          {conversionHint && (
            <div className="h-6 px-3 border-b border-[#202427] bg-[#0d1012] text-[11px] text-[#8ef0b5] flex items-center">
              {conversionHint}
            </div>
          )}
          {showNaturalDock && (
            <div className="border-b border-[#23292e] bg-[#0f1316] px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[11px] text-[#9da7b1]">
                  <span className="material-symbols-outlined text-[14px] text-[#b4a7ff]">auto_awesome</span>
                  Natural Language Pad
                  <span className="text-[#617181]">Auto converts each {naturalBatchSize} lines</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNaturalDraft('')}
                    className="px-2 py-1 rounded border border-[#2b3035] text-[10px] text-[#9da7b1] hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleConvertNaturalDraftNow}
                    className="px-2.5 py-1 rounded border border-[#2b3035] bg-[#141a20] text-[10px] text-[#d1d7dd] hover:text-white hover:border-[#3b82f6] transition-colors"
                  >
                    Convert Draft
                  </button>
                </div>
              </div>
              <textarea
                value={naturalDraft}
                onChange={(e) => handleNaturalDraftChange(e.target.value)}
                placeholder="Describe what you want in plain English. Press Enter after each line."
                className="w-full h-20 rounded border border-[#273038] bg-[#0b0e10] px-2 py-1.5 text-[12px] text-[#d7dee6] placeholder-[#5f6b75] outline-none focus:border-[#4f88ff] resize-none custom-scrollbar"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {getNaturalPresets().map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleInsertNaturalPreset(preset)}
                    className="px-2 py-1 rounded border border-[#2b3035] bg-[#141a20] text-[10px] text-[#c5d0da] hover:text-white hover:border-[#3b82f6] transition-colors"
                    title="Insert preset instruction"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#758393]">
                <span>
                  {naturalDraft
                    .split('\n')
                    .map(line => line.trim())
                    .filter(Boolean).length}{' '}
                  lines queued
                </span>
                <span>Tip: Cmd/Ctrl+L converts current editor English lines instantly.</span>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden relative flex min-h-0">
            <aside className="w-56 border-r border-[#2b3035] bg-[#0d0f10] overflow-y-auto custom-scrollbar">
              <div className="px-3 py-2 border-b border-[#2b3035] flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-[#8d96a0] font-semibold">Explorer</span>
                <button onClick={() => setShowAddMenu(true)} className="text-[#8d96a0] hover:text-white">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
              </div>
              {isCreating && (
                <form onSubmit={handleCreateNode} className="p-2 border-b border-[#2b3035]">
                  <input
                    id="new-file-input"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onBlur={() => {
                      if (!newFileName.trim()) setIsCreating(null);
                    }}
                    placeholder={isCreating.type === 'file' ? 'filename.ext' : 'folder-name'}
                    className="w-full bg-[#151719] border border-[#2b3035] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#3b82f6]"
                    autoFocus
                  />
                </form>
              )}
              <div className="py-1">
                {files.map(node => (
                  <FileTreeItem key={node.id} node={node} depth={0} />
                ))}
              </div>
              <div className="mt-2 border-t border-[#23292e] px-2 py-2">
                <div className="text-[10px] uppercase tracking-wider text-[#8d96a0] mb-1">Conversion Activity</div>
                {conversionHistory.length === 0 ? (
                  <div className="text-[10px] text-[#60707d]">No conversions yet.</div>
                ) : (
                  <div className="space-y-1">
                    {[...conversionHistory].reverse().map(item => (
                      <div key={item.id} className="rounded border border-[#23292e] bg-[#111518] px-2 py-1">
                        <div className="text-[10px] text-[#d0d7de]">{item.label}</div>
                        <div className="text-[9px] text-[#72808d]">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
            <div className="flex-1 relative min-w-0">
              <Editor 
                  value={code} 
                  onChange={handleEditorChange} 
                  onCursorChange={handleCursorChange}
                  language={getEditorLanguage()}
                  wordWrapEnabled={wordWrapEnabled}
                  onSaveShortcut={handleManualSave}
                  onRunShortcut={handleManualRun}
                  onConvertShortcut={() => handleConvertEnglishNow(true)}
                  onFormatShortcut={() => pushConversionHint('Formatted document.')}
              />
            </div>
          </div>

          {/* Status Bar */}
          <div className="h-7 border-t border-[#2b3035] bg-[#0e1011] flex items-center justify-between px-3 shrink-0 text-[10px] text-[#8d96a0] font-mono select-none">
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1 hover:text-white cursor-pointer">
                   <span className="w-2 h-2 rounded-full bg-purple-500"></span> AI Ready
               </div>
               <div className="flex items-center gap-1 hover:text-white cursor-pointer">
                   <span className="material-symbols-outlined text-[12px]">code</span> {getActiveLanguage()}
               </div>
            </div>
            
            <div className="flex items-center gap-4">
               <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
               <span>Spaces: 2</span>
               <span className="text-[#60a5fa]">
                 EN→Code: {autoNaturalEnabled ? `Auto ${naturalBatchSize}` : `Manual ${naturalBatchSize}`}
               </span>
               {lastLocalConvertInfo && (
                <span className="text-[#34d399]">
                  Converted {lastLocalConvertInfo.lines} lines ({lastLocalConvertInfo.batches} batch)
                </span>
               )}
               <span className="text-[#8d96a0] hidden 2xl:inline">⌘/Ctrl+S Save</span>
               <span className="text-[#8d96a0] hidden 2xl:inline">⌘/Ctrl+Enter Run</span>
               <span className="text-[#8d96a0] hidden 2xl:inline">⌘/Ctrl+L Convert</span>
               <button onClick={() => setShowHistoryMenu(v => !v)} className="history-menu hover:text-white cursor-pointer flex items-center gap-1 relative">
                   <span className="material-symbols-outlined text-[12px]">history</span> History
                   ({fileVersions[activeFileId]?.length || 0})
                   {showHistoryMenu && (
                      <div className="history-menu absolute bottom-7 right-0 w-72 max-h-64 overflow-y-auto custom-scrollbar bg-[#151719] border border-[#2b3035] rounded-lg p-1 z-30 shadow-xl">
                        {(fileVersions[activeFileId] || []).length === 0 && (
                          <div className="px-2 py-3 text-xs text-[#8d96a0]">No saved versions yet.</div>
                        )}
                        {(fileVersions[activeFileId] || []).slice().reverse().map(version => (
                          <button
                            key={version.savedAt}
                            onClick={() => handleRestoreVersion(version.savedAt)}
                            className="w-full text-left px-2 py-2 rounded hover:bg-[#1c1e21] text-xs text-[#e6edf3]"
                          >
                            {new Date(version.savedAt).toLocaleString()}
                          </button>
                        ))}
                      </div>
                   )}
               </button>
            </div>
          </div>
          {contextMenu && (
            <div
              className="file-context-menu fixed z-40 bg-[#151719] border border-[#2b3035] rounded-lg shadow-xl p-1"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              <button onClick={startRenaming} className="w-full text-left px-3 py-2 text-xs text-[#e6edf3] hover:bg-[#1c1e21] rounded">Rename</button>
              <button onClick={handleDeleteNode} className="w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-[#1c1e21] rounded">Delete</button>
            </div>
          )}
        </main>

        {/* PREVIEW PANE (Right Sidebar) */}
        <aside id="preview-pane" className="w-[350px] bg-[#0e1011] border-l border-[#2b3035] flex flex-col shrink-0 relative z-10 hidden xl:flex">
          <div className="h-10 px-3 bg-[#0e1011] border-b border-[#2b3035] flex items-center justify-between">
            <span className="text-xs font-bold text-[#8d96a0] uppercase tracking-wider">Preview</span>
            <div className="flex gap-1 items-center">
               <button onClick={handleManualRun} className="p-1 rounded hover:bg-white/10 transition-colors text-[#8d96a0] hover:text-white">
                 <span className="material-symbols-outlined text-[16px]">refresh</span>
               </button>
               <button onClick={handleOpenPreviewInNewTab} className="p-1 rounded hover:bg-white/10 transition-colors text-[#8d96a0] hover:text-white" title="Open preview in new tab">
                 <span className="material-symbols-outlined text-[16px]">open_in_new</span>
               </button>
            </div>
          </div>
          
          <div className="flex-1 bg-[#050505] flex items-center justify-center relative overflow-hidden">
             <Preview 
                htmlContent={compiledHtml} 
                isLoading={isCompiling} 
                isSelectionMode={isSelectionMode}
                viewMode={viewMode}
                onElementSelect={handleElementSelect}
             />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default App;
