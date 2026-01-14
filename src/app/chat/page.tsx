'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Sidebar from '@/components/layout/Sidebar';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelRightClose, Moon, Sun, Send, HelpCircle, ChevronRight, MoreVertical, Copy, Download, FileType, FileText, Save, Check, ImagePlus, X as XIcon, Paperclip, Sparkles, Palette, Shuffle, Heart, Search, Square, Loader2, AlertCircle, File as FileIcon } from 'lucide-react';
import { UnifiedSearchToggle } from '@/components/ui/UnifiedSearchToggle';
import { useSearchMode } from '@/contexts/SearchModeContext';
import { useHelp } from '@/contexts/HelpContext';
import { useTheme } from 'next-themes';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { usePersona } from '@/contexts/PersonaContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { DocumentViewer } from '@/components/common/DocumentViewer';
import { getApiBaseUrl } from '@/lib/config';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { ChatSummary } from '@/types'; // Ensure ChatSummary is imported
import debounce from 'lodash.debounce'; // <-- ADD: Import debounce
import ChatInterface from '@/components/ChatInterface';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FileTreeView from '@/components/layout/FileTreeView';
import ChatNotesPanel from '@/components/layout/ChatNotesPanel';
import FileTreeManager from '@/components/admin/FileTreeManager';
import { MobileNav } from '@/components/layout/MobileNav';
import ChatSearchModal from '@/components/search/ChatSearchModal';
import { CanvasPanel, CanvasType } from '@/components/canvas';
import { MobileTabBar } from '@/components/mobile/MobileTabBar';
import { MobileTabPanel } from '@/components/mobile/MobileTabPanel';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import { useMobileTab } from '@/hooks/useMobileTab';
import { MobileIMContainer, IncomingCallModal, ActiveCallUI } from '@/components/im';
import { DMProvider } from '@/contexts/DMContext';
import { IMProvider } from '@/contexts/IMContext';
import { VoiceVideoCallProvider } from '@/contexts/VoiceVideoCallContext';
import { FeedbackButtons } from '@/components/chat/FeedbackButtons';
import { FeedbackModal } from '@/components/chat/FeedbackModal';
import AdvancedSearchSuggestion from '@/components/chat/AdvancedSearchSuggestion';
import { ChatDocumentViewer } from '@/components/chat/ChatDocumentViewer';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
// Agent Helper removed - see feature/agent-helper-archived branch

// Define SourceDocument type
interface SourceDocument {
  documentId?: string;
  fileName?: string;
  type?: 'user' | 'system'; // Ensure type is defined here
  score?: number; // Score might still be present in older data
  keywordMatch?: boolean;
}

// Define attached document display info
interface AttachedDocumentDisplay {
  fileName: string;
  fileSize?: number;
  fileType: string; // e.g., 'pdf', 'docx', 'xlsx', 'csv', 'txt', 'md'
  truncated?: boolean;
  blobUrl?: string; // Temporary URL to download/view the original file
  textContent?: string; // Extracted text content for viewer
}

// Define Message interface
interface Message {
  _id: string; // Use _id to match MongoDB convention
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // Base64 image data URLs for multimodal messages
  documents?: AttachedDocumentDisplay[]; // Attached documents for display in chat
  sources?: SourceDocument[]; // Ensure this uses SourceDocument with type
  metadata?: {
    tokenUsage: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost: number;
    modelUsed?: string;
  };
  modelUsed?: string; // Which AI model generated the response
}

// --- ADDED: Define Chat interface for frontend state ---
interface SavedCanvas {
  _id: string;
  type: 'code' | 'document' | 'diagram' | 'html' | 'chart';
  title: string;
  content: string;
  language?: string;
  createdAt: string;
}

interface AutoSavedCanvas {
  type: 'code' | 'document' | 'diagram' | 'html' | 'chart';
  title: string;
  content: string;
  language?: string;
  updatedAt: string;
}

interface Chat {
  _id: string;
  userId: string; // Or Types.ObjectId if needed on frontend
  chatName: string;
  createdAt: string; // Use string for simplicity, format as needed
  updatedAt: string;
  messages: Message[];
  notes?: string | null; // Added optional notes field
  autoSavedCanvas?: AutoSavedCanvas; // Auto-saved canvas (single, overwrites)
  canvases?: SavedCanvas[]; // User-saved canvas artifacts (array, preserved)
}
// --- END ADDITION ---

// Define UserDocument type for this page (might differ from backend model slightly)
interface UserDocumentDisplay {
  _id: string;
  originalFileName: string;
  // Add other fields if needed for display, like status or date
}

// Progressive assistant status messages
const PROGRESS_MESSAGES = [
  'Working on it...',
  'Still thinking...',
  'Almost there...',
  'Generating response...',
];
const PROGRESS_INTERVAL_MS = 10000; // 10s

export default function Home() {
  const { user, isLoading: loading, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { activePersona } = usePersona();
  const { settings, refreshSettings } = useUserSettings();
  const { toast } = useToast(); // Initialize toast
  const { searchMode } = useSearchMode(); // Use the new unified search mode
  const { isHelpModeEnabled, toggleHelpMode } = useHelp(); // Help Mode toggle

  // Mobile layout hooks
  const { isMobile } = useMobileLayout();
  const { activeTab, switchTab } = useMobileTab();

  // State for UI elements
  const [chats, setChats] = React.useState<ChatSummary[]>([]); // <-- SPECIFY TYPE HERE
  const [selectedChatIdFromSidebar, setSelectedChatIdFromSidebar] = React.useState<string | null>(
    null
  ); // Chat selected in sidebar
  const [isLoadingChats, setIsLoadingChats] = React.useState(false); // Loading indicator for sidebar chats
  const [activeView, setActiveView] = React.useState<'chat' | 'docs'>('chat'); // Sidebar view toggle
  const [isAlertAllOpen, setIsAlertAllOpen] = React.useState(false); // Delete all chats confirmation

  // State for main chat interface
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  // Ref to track latest messages synchronously for building history (avoids async state race condition)
  const messagesRef = useRef<Message[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  // Advanced Search: retrieval mode ('quick' default, 'advanced' for deeper search)
  const [retrievalMode, setRetrievalMode] = useState<'quick' | 'advanced'>('quick');
  // Advanced Search: suggestion from backend to use advanced mode
  const [advancedSearchSuggestion, setAdvancedSearchSuggestion] = useState<{
    suggest: boolean;
    reason?: 'broad_query' | 'few_sources' | 'topic_mismatch';
  } | null>(null);
  const [expandedModelIds, setExpandedModelIds] = useState<Set<number>>(new Set());
  const [expandedSourceIds, setExpandedSourceIds] = useState<Set<number>>(new Set()); // Track which messages have expanded sources
  // Chat document viewer state - for viewing inline attached documents
  const [viewingDocument, setViewingDocument] = useState<AttachedDocumentDisplay | null>(null);
  // Feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackModalData, setFeedbackModalData] = useState<{
    messageId: string;
    messageContent: string;
    userQuery: string;
    ragSources: string[];
  } | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const chatContainerRef = useRef<null | HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  // Ref for synchronous access to auto-scroll state (avoids stale closures in RAF/observers)
  const shouldAutoScrollRef = useRef(true);
  // Track if scroll event is from programmatic scroll (prevents false user-scroll detection)
  const isProgrammaticScrollRef = useRef(false);
  // Ref for textarea to manage focus
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Refs for batched streaming updates (reduces jitter from constant re-renders)
  const streamingContentRef = useRef<string>('');
  const streamingRafRef = useRef<number | null>(null);
  const streamingCompleteRef = useRef<boolean>(false);
  // Refs for batched canvas streaming updates (reduces stutter during code/document streaming)
  const canvasContentRef = useRef<string>('');
  const canvasRafRef = useRef<number | null>(null);

  // State for chat persistence
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true); // Track initial history load

  // --- ADDED: State to hold full data of the selected chat ---
  const [selectedChatData, setSelectedChatData] = useState<Chat | null>(null);
  // --- END ADDITION ---

  // State for document viewer
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    filename: string;
    type: 'user' | 'system';
  } | null>(null);

  // Use the unified search mode (no local state needed)
  const isUserDocsSelected = searchMode === 'user-docs';

  // --- ADDED: State for notes saving loading indicator ---
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  // --- END ADDITION ---

  // --- ADDED: State for new chat notes (before chat is created) ---
  const [newChatNotes, setNewChatNotes] = useState<string>('');
  // --- END ADDITION ---

  // --- ADDED: State to track selected tab in right sidebar ---
  const [selectedTab, setSelectedTab] = useState<string>('notes');
  // --- END ADDITION ---

  // --- ADDED: State for resizable right panel ---
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    // Load saved width from localStorage or use default
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rightPanelWidth');
      return saved ? parseInt(saved, 10) : 400;
    }
    return 400;
  });
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const MIN_PANEL_WIDTH = 280;
  const MIN_CHAT_PANEL_WIDTH = 400; // Minimum width for chat area to prevent header overlap
  // Max width leaves room for left sidebar AND minimum chat panel width
  const getMaxPanelWidth = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Account for left sidebar (~280px), resize handle (12px), and minimum chat width
      const leftSidebar = 280;
      const resizeHandle = 12;
      const availableForRightPanel = window.innerWidth - leftSidebar - resizeHandle - MIN_CHAT_PANEL_WIDTH;
      return Math.max(MIN_PANEL_WIDTH, Math.floor(availableForRightPanel));
    }
    return 600;
  }, []);
  // --- END ADDITION ---

  // --- ADDED: State for chat search modal ---
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  // --- END ADDITION ---

  // --- ADDED: State for assistant progress message ---
  const [assistantProgressMsg, setAssistantProgressMsg] = useState<Message | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  // --- END ADDITION ---

  // --- ADDED: State for message export feature ---
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  // --- END ADDITION ---

  // --- ADDED: Canvas state for AI Canvas feature ---
  const [canvasContent, setCanvasContent] = useState<string>('');
  const [canvasType, setCanvasType] = useState<CanvasType>(null);
  const [canvasLanguage, setCanvasLanguage] = useState<string>('');
  const [canvasTitle, setCanvasTitle] = useState<string>('');
  const [isCanvasStreaming, setIsCanvasStreaming] = useState(false);
  const [useCanvasMode, setUseCanvasMode] = useState(true); // Toggle for canvas-enabled streaming

  // AbortController for stopping stream generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- ADDED: File attachment state for drag-and-drop (images + documents) ---
  interface AttachedFile {
    id: string;
    file: File;
    type: 'image' | 'document';
    preview?: string; // base64 data URL for image preview
    base64?: string;  // base64 data for sending images to API
    documentId?: string; // For documents (legacy - after upload to document manager)
    textContent?: string; // NEW: Inline text content for documents (like base64 for images)
    status: 'pending' | 'uploading' | 'processing' | 'ready' | 'error';
    error?: string;
    serverStatus?: string; // The actual status from the server (e.g., 'processing', 'completed')
    truncated?: boolean; // NEW: Whether text was truncated due to size limit
  }
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  // Keep attachedImages as a computed value for backward compatibility
  const attachedImages = attachedFiles.filter(f => f.type === 'image' && f.status === 'ready');
  const attachedDocuments = attachedFiles.filter(f => f.type === 'document' && f.status === 'ready');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILES = 10;
  const MAX_IMAGE_SIZE_MB = 10;
  const MAX_DOCUMENT_SIZE_MB = 25;

  // Allowed file types (matching backend multerConfig)
  const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.txt', '.md', '.markdown', '.csv', '.docx', '.doc', '.xlsx', '.xls'];
  const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
  const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
  const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  const ALL_ALLOWED_EXTENSIONS = [...ALLOWED_DOCUMENT_EXTENSIONS, ...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_AUDIO_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS];

  // Refs to track canvas data during streaming for auto-save
  const canvasDataRef = useRef<{
    type: CanvasType;
    content: string;
    title: string;
    language: string;
    wasGenerated: boolean;
  }>({ type: null, content: '', title: '', language: '', wasGenerated: false });
  // --- END ADDITION ---

  // Load user settings on component mount
  useEffect(() => {
    if (user && !loading) {
      console.log('[ChatPage] User authenticated, loading user settings');
      refreshSettings().catch(err => {
        console.error('[ChatPage] Failed to load user settings:', err);
      });
    }
  }, [user, loading, refreshSettings]);

  // Keep messagesRef in sync with messages state for building history
  // This ensures we always have the latest messages when building request body
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-focus textarea after sending completes
  useEffect(() => {
    if (!isSending && textareaRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSending]);

  // Debug log active persona state
  useEffect(() => {
    console.log('[ChatPage] Active persona state:', activePersona);
  }, [activePersona]);

  // --- Effects ---

  // Load Latest Chat Effect
  useEffect(() => {
    const loadLatestChat = async () => {
      if (!user) {
        console.log('[ChatPage Load] No user object available, cannot load history.');
        setIsLoadingHistory(false);
        return;
      }

      setIsLoadingHistory(true);
      console.log('[ChatPage Load] Attempting to load latest chat...');

      try {
        const response = await fetchWithAuth('/api/chats/latest', {
          method: 'GET',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.chat) {
            console.log(
              `[ChatPage Load] Loaded latest chat: ${data.chat._id}, Messages: ${data.chat.messages?.length || 0}`
            );
            const loadedMessages = (data.chat.messages || []).map((msg: any, index: number) => ({
              _id: msg._id,
              role: msg.role,
              content: msg.content,
              sources: msg.sources,
              metadata: msg.metadata,
              modelUsed: msg.metadata?.modelUsed || msg.modelUsed, // Support both locations
            }));
            setMessages(loadedMessages);
            setCurrentChatId(data.chat._id);
            setSelectedChatData(data.chat); // <-- ADDED: Store full chat data
            setSelectedChatIdFromSidebar(data.chat._id); // <-- ADDED: Sync sidebar selection

            // Load canvas data if available (auto-saved)
            const autoCanvas = data.chat.autoSavedCanvas;
            if (autoCanvas && autoCanvas.content) {
              console.log('[ChatPage Load] Loading auto-saved canvas:', autoCanvas.title);
              setCanvasType(autoCanvas.type);
              setCanvasTitle(autoCanvas.title || 'Untitled');
              setCanvasContent(autoCanvas.content);
              setCanvasLanguage(autoCanvas.language || '');
              setIsCanvasStreaming(false);
            }
          } else {
            console.log('[ChatPage Load] No previous chat session found.');
            setMessages([]);
            setCurrentChatId(null);
            setSelectedChatData(null); // Clear chat data if none found
          }
        } else if (response.status === 401) {
          console.warn('[ChatPage Load] Received 401 Unauthorized. Logging out.');
          await logout();
        } else {
          console.error('[ChatPage Load] API Error:', response.status, response.statusText);
          setMessages([]);
          setCurrentChatId(null);
          setSelectedChatData(null); // Clear chat data on error
        }
      } catch (error) {
        console.error('[ChatPage Load] Fetch Error:', error);
        setMessages([]);
        setCurrentChatId(null);
        setSelectedChatData(null); // Clear chat data on error
      } finally {
        setIsLoadingHistory(false);
      }
    };

    if (!loading && user) {
      loadLatestChat();
    } else if (!loading && !user) {
      // Handle case where auth is resolved but there's no user
      setIsLoadingHistory(false);
      setMessages([]);
      setCurrentChatId(null);
      setSelectedChatData(null); // Clear chat data if no user
    }
  }, [user, loading, logout]);

  // --- ADDED: Function to fetch chat list ---
  const fetchChatList = useCallback(async () => {
    if (!user) {
      console.log('[fetchChatList] No user available');
      setIsLoadingChats(false);
      setChats([]);
      return;
    }

    setIsLoadingChats(true);
    console.log('[fetchChatList] Fetching chat list...');

    try {
      const response = await fetchWithAuth('/api/chats', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.chats) {
          console.log(`[fetchChatList] Loaded chats: ${data.chats.length}`);
          setChats(data.chats);
        } else {
          console.log('[fetchChatList] No chats found.');
          setChats([]);
        }
      } else if (response.status === 401) {
        console.warn('[fetchChatList] Received 401 Unauthorized. Logging out.');
        await logout();
      } else {
        console.error('[fetchChatList] API Error:', response.status, response.statusText);
        setChats([]);
      }
    } catch (error) {
      console.error('[fetchChatList] Fetch Error:', error);
      setChats([]);
    } finally {
      setIsLoadingChats(false);
    }
  }, [user, logout]);

  // --- START ADDITION: Fetch Chat List Effect ---
  useEffect(() => {
    console.log('[ChatPage List Effect Hook RUNS]', { user: !!user, loading });

    if (!loading && user) {
      console.log('[ChatPage List Effect] Condition MET, calling fetchChatList...');
      fetchChatList();
    } else {
      console.log('[ChatPage List Effect] Condition NOT MET.', { loading, user: !!user });
      setIsLoadingChats(false);
      setChats([]);
    }
  }, [user, loading, fetchChatList, currentChatId]);
  // --- END ADDITION: Fetch Chat List Effect ---

  // Check if user is near bottom of chat (within 150px)
  const isNearBottom = () => {
    const container = chatContainerRef.current;
    if (!container) return true;
    const threshold = 150;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Handle scroll events - disable auto-scroll if user scrolls up
  // CRITICAL: Only process user-initiated scrolls, ignore programmatic scrolls
  const handleChatScroll = () => {
    // Skip if this scroll was triggered by our code
    if (isProgrammaticScrollRef.current) {
      return;
    }
    const nearBottom = isNearBottom();
    setShouldAutoScroll(nearBottom);
    shouldAutoScrollRef.current = nearBottom;
  };

  // Helper to scroll to bottom programmatically without triggering user-scroll detection
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    isProgrammaticScrollRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior });
    // Reset flag after a short delay (scroll events are async)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    });
  }, []);

  // Smart auto-scroll Effect - only scroll if user is near bottom AND not streaming
  // During streaming, the RAF callback handles scrolling to avoid conflicts
  useEffect(() => {
    if (shouldAutoScroll && !isSending) {
      scrollToBottom('smooth');
    }
  }, [messages, shouldAutoScroll, isSending, scrollToBottom]);

  // Re-enable auto-scroll when user sends a new message
  useEffect(() => {
    if (isSending) {
      setShouldAutoScroll(true);
      shouldAutoScrollRef.current = true;
    }
  }, [isSending]);

  // Note: Search mode persistence is now handled by SearchModeContext

  // --- Handlers ---

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setSelectedChatData(null);
    setSelectedChatIdFromSidebar(null);
    setInputValue('');
    setNewChatNotes(''); // Clear new chat notes
    setAttachedFiles([]); // Clear attached files
    // Clear canvas state when starting new chat
    setCanvasContent('');
    setCanvasType(null);
    setCanvasTitle('');
    setCanvasLanguage('');
    setIsCanvasStreaming(false);
    canvasDataRef.current = { type: null, content: '', title: '', language: '', wasGenerated: false };
    console.log('[ChatPage] New Chat started');
  };

  // --- START MODIFICATION: Replace handleSelectChat with implementation + logging ---
  const handleSelectChat = useCallback(
    async (id: string) => {
      console.log(`[handleSelectChat] Clicked. Attempting to load chat ID: ${id}`);

      if (!user || !id || id === currentChatId) {
        console.log(`[handleSelectChat] Skipping load. Reason:`, {
          hasUser: !!user,
          idExists: !!id,
          isAlreadyCurrent: id === currentChatId,
        });
        return;
      }

      setIsLoadingHistory(true); // Indicate loading
      setMessages([]); // Clear previous messages immediately

      console.log(`[handleSelectChat] Fetching URL: /api/chats/${id}`);

      try {
        const response = await fetchWithAuth(`/api/chats/${id}`, {
          method: 'GET',
        });

        console.log(`[handleSelectChat] API Response Status for chat ${id}: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log(
            `[handleSelectChat] API Response Data for chat ${id}:`,
            JSON.stringify(data, null, 2)
          );

          if (data.success && data.chat) {
            const messagesFromServer = data.chat.messages || [];
            const loadedMessages = messagesFromServer.map((msg: any, index: number) => ({
              _id: msg._id,
              role: msg.role,
              content: msg.content,
              images: msg.images, // Include images for multimodal messages
              sources: msg.sources,
              metadata: msg.metadata,
              modelUsed: msg.metadata?.modelUsed || msg.modelUsed, // Support both locations
            }));
            console.log(
              `[handleSelectChat] Setting messages (count: ${loadedMessages.length}) and currentChatId to ${data.chat._id}`
            );
            setMessages(loadedMessages);
            setCurrentChatId(data.chat._id); // Set the selected chat as current
            setInputValue(''); // Clear input when loading a chat
            setSelectedChatData(data.chat); // <-- ADDED: Store full chat data
            setSelectedChatIdFromSidebar(data.chat._id); // Update sidebar selection state

            // Load canvas data if available (auto-saved or from canvases array)
            const autoCanvas = data.chat.autoSavedCanvas;
            if (autoCanvas && autoCanvas.content) {
              console.log('[handleSelectChat] Loading auto-saved canvas:', autoCanvas.title);
              setCanvasType(autoCanvas.type);
              setCanvasTitle(autoCanvas.title || 'Untitled');
              setCanvasContent(autoCanvas.content);
              setCanvasLanguage(autoCanvas.language || '');
              setIsCanvasStreaming(false);
              canvasDataRef.current = {
                type: autoCanvas.type,
                content: autoCanvas.content,
                title: autoCanvas.title || 'Untitled',
                language: autoCanvas.language || '',
                wasGenerated: false,
              };
            } else {
              // Clear canvas if no auto-saved canvas
              setCanvasType(null);
              setCanvasTitle('');
              setCanvasContent('');
              setCanvasLanguage('');
              setIsCanvasStreaming(false);
              canvasDataRef.current = { type: null, content: '', title: '', language: '', wasGenerated: false };
            }
          } else {
            console.error(`[handleSelectChat] Failed to load chat ${id} or invalid data:`, data);
            handleNewChat(); // Reset to new chat state on failure
          }
        } else {
          const errorText = await response.text(); // Read error text
          console.error(
            `[handleSelectChat] API Error Status: ${response.status}, Text: ${errorText}`
          );
          if (response.status === 401) {
            console.warn('[handleSelectChat] Received 401 Unauthorized. Logging out.');
            await logout();
          } else if (response.status === 404) {
            console.warn(`[handleSelectChat] Chat ${id} not found (404). Starting new chat.`);
          } else {
            console.error(`[handleSelectChat] Unhandled API Error Status: ${response.status}`);
          }
          handleNewChat(); // Reset to new chat state on error
        }
      } catch (error) {
        console.error(`[handleSelectChat] Fetch Exception loading chat ${id}:`, error);
        handleNewChat(); // Reset to new chat state on error
      } finally {
        console.log(
          `[handleSelectChat] Finished loading attempt for chat ${id}. Setting isLoadingHistory to false.`
        );
        setIsLoadingHistory(false); // Reset loading state
      }
    },
    [
      user,
      currentChatId,
      logout,
      setIsLoadingHistory,
      setMessages,
      setCurrentChatId,
      setInputValue,
      setSelectedChatIdFromSidebar,
      handleNewChat,
    ]
  );
  // --- END MODIFICATION: Replace handleSelectChat ---

  // --- START MODIFICATION: Implement handleConfirmDelete ---
  const handleConfirmDelete = useCallback(
    async (id: string) => {
      if (!user || !id) {
        console.error('[handleConfirmDelete] Missing user or chat ID.');
        return;
      }

      // Use window.confirm for simplicity
      if (!window.confirm(`Are you sure you want to delete this chat? This cannot be undone.`)) {
        console.log('[handleConfirmDelete] User cancelled delete for chat:', id);
        return;
      }

      console.log(`[handleConfirmDelete] Attempting to delete chat: ${id}`);
      let apiSucceeded = false; // Flag to track API success

      try {
        console.log(`[handleConfirmDelete] Sending DELETE request to: /api/chats/${id}`);
        const response = await fetchWithAuth(`/api/chats/${id}`, {
          method: 'DELETE',
        });

        console.log(`[handleConfirmDelete] API Response Status: ${response.status}`); // Log Status

        if (response.ok) {
          apiSucceeded = true; // Mark as success
          console.log(`[handleConfirmDelete] Successfully deleted chat on backend: ${id}`);
          // Update frontend state
          setChats(prevChats => {
            console.log(
              '[handleConfirmDelete] Updating chats state. Previous length:',
              prevChats.length
            );
            const newChats = prevChats.filter(chat => chat._id !== id);
            console.log('[handleConfirmDelete] New chats state length:', newChats.length);
            return newChats;
          });

          // If the deleted chat was the currently active one, reset view
          if (currentChatId === id) {
            console.log(
              '[handleConfirmDelete] Deleted the active chat, resetting to new chat view.'
            );
            handleNewChat();
          } else {
            setSelectedChatIdFromSidebar(null);
          }
          toast({ title: 'Success', description: 'Chat deleted successfully.' }); // Added success toast
        } else {
          const errorText = await response.text();
          console.error(
            `[handleConfirmDelete] API Error deleting chat ${id}: ${response.status}`,
            errorText
          );
          toast({
            title: 'Error',
            description: `Failed to delete chat (${response.status})`,
            variant: 'destructive',
          }); // Added error toast
          if (response.status === 401) {
            await logout();
          }
        }
      } catch (error) {
        console.error(`[handleConfirmDelete] Fetch error deleting chat ${id}:`, error);
        toast({
          title: 'Error',
          description: 'Network error during deletion.',
          variant: 'destructive',
        }); // Added fetch error toast
      } finally {
        console.log(
          `[handleConfirmDelete] Finished delete attempt for ${id}. API Success: ${apiSucceeded}`
        );
        // Optional: Add loading state management here if needed
      }
    },
    [user, setChats, currentChatId, handleNewChat, logout, setSelectedChatIdFromSidebar, toast]
  ); // Added toast
  // --- END MODIFICATION: Implement handleConfirmDelete ---

  // --- START MODIFICATION: Implement handleDeleteAllChats ---
  const handleDeleteAllChats = useCallback(async () => {
    if (!user) {
      console.error('No authenticated user available to delete chats.');
      // Optionally show an error to the user
      return;
    }

    // Confirmation Dialog
    if (
      !window.confirm(
        'Are you sure you want to delete ALL your chat history? This cannot be undone.'
      )
    ) {
      console.log('User cancelled delete all chats.');
      return;
    }

    console.log('[handleDeleteAllChats] Attempting to delete all chats...');
    setIsLoadingChats(true); // Indicate loading state (optional but good UX)

    try {
      const response = await fetchWithAuth('/api/chats', {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[handleDeleteAllChats] Successfully deleted all chats.', data);
        // Reset frontend state to reflect deletion
        setMessages([]);
        setCurrentChatId(null);
        setChats([]); // Clear the sidebar list state as well
        // Optionally show success notification
      } else {
        const errorText = await response.text();
        console.error(
          `[handleDeleteAllChats] API Error: ${response.status} ${response.statusText}`,
          errorText
        );
        // Optionally show error notification
      }
    } catch (error) {
      console.error('[handleDeleteAllChats] Fetch Error:', error);
      // Optionally show error notification
    } finally {
      setIsLoadingChats(false); // Reset loading state
    }
    // Add relevant dependencies
  }, [user, setMessages, setCurrentChatId, setChats, setIsLoadingChats]); // Added setIsLoadingChats
  // --- END MODIFICATION: Implement handleDeleteAllChats ---

  // Update function signature and state setting
  const handleDocumentSelect = (documentId: string, filename: string, type: 'user' | 'system') => {
    console.log(
      '[ChatPage] Selected document for viewing (from chat source):',
      documentId,
      filename,
      type
    ); // Log type
    setSelectedDocument({ id: documentId, filename: filename, type: type }); // Store type
  };

  // Create a separate handler for clicks from the SystemKbList which only provides id and filename
  const handleSystemKbSelect = (documentId: string, filename: string) => {
    console.log(
      '[ChatPage] Selected document for viewing (from System KB list):',
      documentId,
      filename
    );
    // Removed debug logs for System KB document selection

    // Assume documents selected from this list are always 'system' type
    setSelectedDocument({ id: documentId, filename: filename, type: 'system' });

    // Removed setTimeout debug log for state update
  };

  const handleCloseViewer = () => {
    console.log('[ChatPage] Closing PDF viewer');
    setSelectedDocument(null);
  };

  // --- ADDED: Export handlers for message three-dot menu ---
  const handleCopyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    }
  };

  const handleDownloadMessage = async (text: string, format: 'pdf' | 'docx' | 'txt', title?: string) => {
    try {
      const response = await fetchWithAuth('/api/export/download', {
        method: 'POST',
        body: JSON.stringify({
          content: text,
          title: title || 'EMTChat Response',
          format,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `export.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      toast({ title: 'Error', description: 'Failed to download file', variant: 'destructive' });
    }
  };

  const handleSaveToDocuments = async (text: string, format: 'pdf' | 'docx' | 'txt', messageId: string, title?: string) => {
    try {
      setSavingMessageId(messageId);
      const response = await fetchWithAuth('/api/export/save-to-documents', {
        method: 'POST',
        body: JSON.stringify({
          content: text,
          title: title || 'EMTChat Response',
          format,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Save failed');
      }

      toast({ title: 'Success', description: 'Saved to My Documents' });
      setTimeout(() => setSavingMessageId(null), 2000);
    } catch (err) {
      console.error('Save to documents failed:', err);
      toast({ title: 'Error', description: 'Failed to save to documents', variant: 'destructive' });
      setSavingMessageId(null);
    }
  };
  // --- END ADDITION ---

  // --- ADDED: Image attachment handlers for drag-and-drop ---
  // Helper to determine file type from extension
  const getFileType = useCallback((file: File): 'image' | 'document' | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (file.type.startsWith('image/') || ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (ALLOWED_DOCUMENT_EXTENSIONS.includes(ext) || ALLOWED_AUDIO_EXTENSIONS.includes(ext) || ALLOWED_VIDEO_EXTENSIONS.includes(ext)) return 'document';
    // Check MIME type as fallback
    if (file.type.startsWith('audio/') || file.type.startsWith('video/') ||
        file.type === 'application/pdf' || file.type.includes('word') || file.type.includes('excel') ||
        file.type === 'text/plain' || file.type === 'text/markdown' || file.type === 'text/csv') {
      return 'document';
    }
    return null;
  }, []);

  // Process a file (image or document)
  const processFile = useCallback(async (file: File): Promise<AttachedFile | null> => {
    const fileType = getFileType(file);

    if (!fileType) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      toast({
        title: 'Unsupported file type',
        description: `".${ext}" files are not supported. Try PDF, Word, Excel, images, or media files.`,
        variant: 'destructive'
      });
      return null;
    }

    // Validate file size
    const maxSize = fileType === 'image' ? MAX_IMAGE_SIZE_MB : MAX_DOCUMENT_SIZE_MB;
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `${fileType === 'image' ? 'Images' : 'Documents'} must be under ${maxSize}MB`,
        variant: 'destructive'
      });
      return null;
    }

    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (fileType === 'image') {
      // Process image - read as base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          resolve({
            id: fileId,
            file,
            type: 'image',
            preview: base64,
            base64: base64,
            status: 'ready',
          });
        };
        reader.onerror = () => {
          toast({ title: 'Error', description: 'Failed to read image file', variant: 'destructive' });
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    } else {
      // Process document - return pending, will upload asynchronously
      return {
        id: fileId,
        file,
        type: 'document',
        status: 'pending',
      };
    }
  }, [getFileType, toast]);

  // Poll for document processing status
  const pollDocumentStatus = useCallback(async (documentId: string, fileId: string) => {
    const maxAttempts = 60; // 2 minutes max (2s intervals)
    let attempts = 0;

    const checkStatus = async () => {
      try {
        // Use the /status endpoint for lightweight status checks
        const response = await fetchWithAuth(`/api/documents/${documentId}/status`);
        if (!response.ok) {
          console.error(`[Document Polling] Failed to check status: ${response.status}`);
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 2000);
          }
          return;
        }

        const result = await response.json();
        const serverStatus = result.status;

        if (serverStatus === 'completed') {
          // Document is ready
          setAttachedFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, status: 'ready' as const, serverStatus } : f
          ));
          console.log(`[Document Polling] ${documentId} is now ready`);
          return; // Stop polling
        } else if (serverStatus === 'failed') {
          // Document processing failed
          setAttachedFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, status: 'error' as const, serverStatus, error: 'Document processing failed' } : f
          ));
          console.log(`[Document Polling] ${documentId} failed processing`);
          return; // Stop polling
        }

        // Still processing - continue polling
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000); // Poll every 2 seconds
        } else {
          // Timeout - mark as ready anyway (user can try to use it)
          setAttachedFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, status: 'ready' as const, serverStatus } : f
          ));
          console.log(`[Document Polling] ${documentId} timeout - marking as ready`);
        }
      } catch (error) {
        console.error(`[Document Polling] Error checking status for ${documentId}:`, error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000);
        }
      }
    };

    // Start polling after a short delay (give server time to start processing)
    setTimeout(checkStatus, 1000);
  }, []);

  // Simple formats that can be extracted client-side (no server needed)
  const SIMPLE_TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv'];

  // Extract text from a document - client-side for simple formats, server for complex
  // This is the new approach: like images (base64), documents send text inline
  const extractDocumentText = useCallback(async (attachedFile: AttachedFile): Promise<AttachedFile> => {
    if (attachedFile.type !== 'document' || attachedFile.status !== 'pending') {
      return attachedFile;
    }

    const ext = attachedFile.file.name.toLowerCase().substring(attachedFile.file.name.lastIndexOf('.'));
    const isSimpleText = SIMPLE_TEXT_EXTENSIONS.includes(ext);

    // Update status to processing (extracting)
    setAttachedFiles(prev => prev.map(f =>
      f.id === attachedFile.id ? { ...f, status: 'processing' as const } : f
    ));

    try {
      let textContent: string;
      let truncated = false;

      if (isSimpleText) {
        // CLIENT-SIDE extraction for simple text formats (instant!)
        console.log(`[Document Extract] Client-side extraction for ${attachedFile.file.name}`);
        textContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string || '');
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(attachedFile.file);
        });

        // Truncate if too long (100k char limit)
        if (textContent.length > 100000) {
          textContent = textContent.substring(0, 100000);
          truncated = true;
          console.log(`[Document Extract] Text truncated for ${attachedFile.file.name}`);
        }
      } else {
        // SERVER-SIDE extraction for complex formats (PDF, DOCX, XLSX)
        console.log(`[Document Extract] Server extraction for ${attachedFile.file.name}`);
        const formData = new FormData();
        formData.append('file', attachedFile.file);

        const response = await fetchWithAuth('/api/chat/extract-text', {
          method: 'POST',
          body: formData,
          headers: {}, // Let browser set content-type for FormData
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Extraction failed' }));
          throw new Error(errorData.error || 'Failed to extract text');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Extraction failed');
        }

        textContent = result.textContent;
        truncated = result.truncated || false;

        if (truncated) {
          console.log(`[Document Extract] Server truncated text for ${attachedFile.file.name}`);
        }
      }

      if (!textContent || textContent.trim().length === 0) {
        throw new Error('No text content could be extracted from the document');
      }

      console.log(`[Document Extract] Success: ${attachedFile.file.name} (${textContent.length} chars, truncated: ${truncated})`);

      return {
        ...attachedFile,
        textContent,
        truncated,
        status: 'ready' as const,
      };
    } catch (error) {
      console.error(`Error extracting ${attachedFile.file.name}:`, error);
      return {
        ...attachedFile,
        status: 'error',
        error: error instanceof Error ? error.message : 'Extraction failed',
      };
    }
  }, []);

  // Legacy: Upload document to backend (kept for backward compatibility, but not used for chat)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const uploadDocument = useCallback(async (attachedFile: AttachedFile): Promise<AttachedFile> => {
    // This is now only used as fallback - extractDocumentText is preferred
    console.warn('[Document Upload] Using legacy upload - consider using extractDocumentText instead');
    return attachedFile;
  }, []);

  // Process and extract text from files
  const processAndUploadFiles = useCallback(async (files: File[]) => {
    const remainingSlots = MAX_FILES - attachedFiles.length;
    if (remainingSlots <= 0) {
      toast({ title: 'Limit reached', description: `Maximum ${MAX_FILES} files allowed`, variant: 'destructive' });
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const processed = await Promise.all(filesToProcess.map(processFile));
    const validFiles = processed.filter((f): f is AttachedFile => f !== null);

    if (validFiles.length === 0) return;

    // Add all files to state immediately (images ready, documents pending)
    setAttachedFiles(prev => [...prev, ...validFiles]);

    // Extract text from documents (NEW: inline text extraction like images use base64)
    const documentsToExtract = validFiles.filter(f => f.type === 'document' && f.status === 'pending');
    for (const doc of documentsToExtract) {
      const extracted = await extractDocumentText(doc);
      setAttachedFiles(prev => prev.map(f => f.id === doc.id ? extracted : f));

      if (extracted.status === 'error') {
        toast({
          title: 'Extraction failed',
          description: `${doc.file.name}: ${extracted.error}`,
          variant: 'destructive'
        });
      } else if (extracted.truncated) {
        toast({
          title: 'Document truncated',
          description: `${doc.file.name} was truncated to fit context limits`,
          variant: 'default'
        });
      }
    }
  }, [attachedFiles.length, processFile, extractDocumentText, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Check for KB document from System KB / My Docs panel
    const kbDocData = e.dataTransfer.getData('application/x-emtchat-document');
    if (kbDocData) {
      try {
        const doc = JSON.parse(kbDocData);
        if (doc.type === 'kb-document' && doc.documentId) {

          // Use correct endpoint based on sourceType (system KB vs user docs)
          const endpoint = doc.sourceType === 'user'
            ? `/api/documents/text-content/${doc.documentId}`
            : `/api/system-kb/text-content/${doc.documentId}`;

          // Fetch document text content from backend
          const response = await fetchWithAuth(endpoint);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            toast({
              title: 'Failed to load document',
              description: errorData.message || 'Could not retrieve document content',
              variant: 'destructive'
            });
            return;
          }

          const data = await response.json();

          // Get file extension from filename
          const ext = doc.fileName.toLowerCase().substring(doc.fileName.lastIndexOf('.') + 1);

          // Add to attachedFiles with the text content
          const kbFile: AttachedFile = {
            id: `kb-${doc.documentId}-${Date.now()}`,
            file: new File([], doc.fileName, { type: doc.mimeType || 'application/octet-stream' }),
            type: 'document',
            preview: undefined,
            status: 'ready',
            error: undefined,
            documentId: doc.documentId,
            textContent: data.textContent,
            truncated: false,
          };

          setAttachedFiles(prev => [...prev, kbFile]);
          const sourceName = doc.sourceType === 'user' ? 'My Docs' : 'System KB';
          toast({
            title: 'Document attached',
            description: `${doc.fileName} added from ${sourceName}`,
          });
          return;
        }
      } catch (err) {
        console.error('[ChatPage] Failed to handle KB document drop:', err);
      }
    }

    // Fall back to file upload for local files
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      toast({ title: 'No files', description: 'Please drop files to attach', variant: 'destructive' });
      return;
    }

    await processAndUploadFiles(files);
  }, [processAndUploadFiles, toast, fetchWithAuth]);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await processAndUploadFiles(Array.from(files));

    // Reset input so same file can be selected again
    e.target.value = '';
  }, [processAndUploadFiles]);

  const handleRemoveFile = useCallback((id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    // For paste, we only handle images (documents can't be pasted from clipboard)
    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));

    if (imageItems.length === 0) return;

    e.preventDefault(); // Prevent default paste behavior for images

    const files: File[] = [];
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }

    if (files.length > 0) {
      await processAndUploadFiles(files);
    }
  }, [processAndUploadFiles]);
  // --- END ADDITION ---

  // --- ADDED: Function to create chat from notes ---
  const createChatFromNotes = useCallback(
    async (notes: string) => {
      console.log('[createChatFromNotes] Creating new chat with initial notes...');
      setIsSavingNotes(true);

      try {
        const response = await fetchWithAuth('/api/chats', {
          method: 'POST',
          body: JSON.stringify({
            isNotesInitiated: true,
            initialChatName: 'New Chat with Notes',
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || `Failed to create chat (HTTP ${response.status})`);
        }

        console.log(`[createChatFromNotes] Chat created successfully: ${result.chatId}`);

        // Set the newly created chat as current
        const newChat: Chat = {
          _id: result.chatId,
          userId: user!._id,
          chatName: result.chatName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
          notes: '',
        };

        setCurrentChatId(result.chatId);
        setSelectedChatData(newChat);
        setSelectedChatIdFromSidebar(result.chatId);

        // Refresh chat list to include new chat
        fetchChatList();

        // Now save the notes to the newly created chat
        return result.chatId;
      } catch (error: any) {
        console.error('[createChatFromNotes] Error creating chat:', error);
        toast({
          variant: 'destructive',
          title: 'Error Creating Chat',
          description: error.message,
        });
        return null;
      } finally {
        setIsSavingNotes(false);
      }
    },
    [user, fetchChatList, toast]
  );

  // --- ADDED: Handler to save notes via API ---
  const handleSaveNotes = useCallback(
    async (chatId: string | null, notes: string) => {
      // Handle new chat notes (when chatId is null)
      if (!chatId) {
        console.log('[handleSaveNotes] No chatId, storing notes locally for new chat...');
        setNewChatNotes(notes);

        // If notes are not empty, create a chat automatically
        if (notes.trim()) {
          const newChatId = await createChatFromNotes(notes);
          if (newChatId) {
            // Continue with saving notes to the newly created chat
            return handleSaveNotes(newChatId, notes);
          }
        }
        return;
      }

      console.log(`[handleSaveNotes] Saving notes for chat ${chatId}...`);
      setIsSavingNotes(true);

      try {
        const response = await fetchWithAuth(`/api/chats/${chatId}/notes`, {
          method: 'PATCH',
          body: JSON.stringify({ notes }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || `Failed to save notes (HTTP ${response.status})`);
        }

        console.log(`[handleSaveNotes] Notes saved successfully for chat ${chatId}.`);

        // Update selectedChatData state locally
        setSelectedChatData(prev => (prev ? { ...prev, notes } : null));
      } catch (error: any) {
        console.error(`[handleSaveNotes] Error saving notes for chat ${chatId}:`, error);
        toast({ variant: 'destructive', title: 'Error Saving Notes', description: error.message });
      } finally {
        setIsSavingNotes(false);
      }
    },
    [createChatFromNotes, toast]
  );

  // --- ADD: Debounced Save Notes Function ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSaveNotes = useCallback(
    debounce((chatId: string | null, notes: string) => {
      handleSaveNotes(chatId, notes);
    }, 1500), // 1500ms delay
    [handleSaveNotes] // Dependency array includes the memoized save function
  );
  // --- END ADD ---

  // --- ADDED: Canvas streaming function using SSE ---
  const handleSendMessageWithCanvas = useCallback(
    async (input: string) => {
      // Allow sending with files that are ready OR processing
      // Processing documents will get a "still processing" message from backend
      const sendableFiles = attachedFiles.filter(f => f.status === 'ready' || f.status === 'processing');
      const readyFiles = sendableFiles; // Keep variable name for minimal changes below
      const hasContent = input.trim() || readyFiles.length > 0;
      if (!hasContent || isSending || !user) return;

      setIsSending(true);

      // Clear Advanced Search suggestion when sending new message
      setAdvancedSearchSuggestion(null);

      // DON'T clear canvas here - only clear when a NEW canvas is generated (in canvas:start)
      // This allows canvas to persist across non-canvas queries
      setIsCanvasStreaming(false);

      // Capture current files and clear them
      const imagesToSend = readyFiles.filter(f => f.type === 'image' && f.base64).map(f => f.base64!);
      // NEW: Extract inline text content from documents (like images use base64)
      const documentTextsToSend = readyFiles
        .filter(f => f.type === 'document' && f.textContent)
        .map(f => ({ fileName: f.file.name, content: f.textContent! }));
      // LEGACY: Keep documentIds as fallback for any documents that don't have inline text
      const documentIdsToSend = readyFiles
        .filter(f => f.type === 'document' && f.documentId && !f.textContent)
        .map(f => f.documentId!);
      // Capture document metadata for display in chat (before clearing attachedFiles)
      const documentsForDisplay: AttachedDocumentDisplay[] = readyFiles
        .filter(f => f.type === 'document')
        .map(f => {
          const ext = f.file.name.toLowerCase().substring(f.file.name.lastIndexOf('.') + 1);
          // Create a blob URL only if file has actual content (KB docs have empty files)
          const blobUrl = f.file.size > 0 ? URL.createObjectURL(f.file) : undefined;
          return {
            fileName: f.file.name,
            fileSize: f.file.size,
            fileType: ext,
            truncated: f.truncated,
            blobUrl, // Temporary URL - valid for this session
            textContent: f.textContent, // Store extracted text for viewer
          };
        });
      setAttachedFiles([]);

      // Generate message content - use placeholder text if only files
      const hasDocuments = documentTextsToSend.length > 0 || documentIdsToSend.length > 0;
      const hasOnlyImages = imagesToSend.length > 0 && !hasDocuments;
      const hasOnlyDocs = hasDocuments && imagesToSend.length === 0;
      const hasBoth = imagesToSend.length > 0 && hasDocuments;
      let messageText = input.trim();
      if (!messageText) {
        if (hasOnlyImages) messageText = '[Image attached]';
        else if (hasOnlyDocs) messageText = '[Document attached]';
        else if (hasBoth) messageText = '[Files attached]';
      }

      const tempUserMessageId = `user-${Date.now()}`;
      const userMessage: Message = {
        _id: tempUserMessageId,
        role: 'user',
        content: messageText,
        images: imagesToSend.length > 0 ? imagesToSend : undefined,
        documents: documentsForDisplay.length > 0 ? documentsForDisplay : undefined,
      };
      // Update ref synchronously BEFORE async state update
      messagesRef.current = [...messagesRef.current, userMessage];
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setInputValue('');

      console.log('[ChatPage Canvas] Starting canvas-enabled SSE stream', {
        imageCount: imagesToSend.length,
        documentTextsCount: documentTextsToSend.length,
        documentIdsCount: documentIdsToSend.length,
      });

      // Query text - for files only, ask the AI to describe/analyze
      let queryText = input.trim();
      if (!queryText) {
        if (hasOnlyImages) queryText = 'What do you see in this image? Please describe it.';
        else if (hasOnlyDocs) queryText = 'Please analyze the attached document and summarize its key points.';
        else if (hasBoth) queryText = 'Please analyze these files and describe what you see.';
      }

      const requestBody = {
        query: queryText,
        images: imagesToSend.length > 0 ? imagesToSend : undefined,
        // NEW: Send inline document text (preferred - like images send base64)
        documentTexts: documentTextsToSend.length > 0 ? documentTextsToSend : undefined,
        // LEGACY: Fallback to document IDs for any docs without inline text
        documentIds: documentIdsToSend.length > 0 ? documentIdsToSend : undefined,
        // Use messagesRef.current to get latest messages (includes canvas tags) synchronously
        // This avoids race condition where async state update hasn't completed yet
        // NOTE: Do NOT send 'sources' in history - sources are for display only.
        // Sending sources causes enhanceQueryWithHistory to find previous documents
        // instead of focusing on newly attached inline documents.
        history: messagesRef.current.map(m => ({ role: m.role, content: m.content, images: m.images })),
        searchMode: searchMode,
        retrievalMode: retrievalMode,  // Advanced Search: 'quick' (default) or 'advanced'
        activePersonaId: activePersona?._id || null,
        chatId: currentChatId || null,
      };

      try {
        // Get auth token for SSE request (stored as 'accessToken' by fetchWithAuth)
        const token = localStorage.getItem('accessToken');
        if (!token) {
          throw new Error('No authentication token');
        }

        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();

        const apiUrl = getApiBaseUrl();
        const response = await fetch(`${apiUrl}/api/chats/stream-with-canvas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let chatContent = '';
        let currentCanvasContent = '';
        let fullResponse = ''; // Track complete response including canvas for history
        let assistantMessageId = `assistant-${Date.now()}`;
        let receivedChatId: string | null = null;
        let modelUsed: string | undefined;

        // Reset streaming state for new message
        streamingCompleteRef.current = false;
        streamingContentRef.current = '';
        if (streamingRafRef.current) {
          cancelAnimationFrame(streamingRafRef.current);
          streamingRafRef.current = null;
        }

        // Show thinking indicator using the progress message system
        const thinkingPlaceholderId = `progress-${Date.now()}`;
        let progressIndex = 0;
        const thinkingPlaceholder: Message = {
          _id: thinkingPlaceholderId,
          role: 'assistant' as const,
          content: PROGRESS_MESSAGES[progressIndex],
        };
        setAssistantProgressMsg(thinkingPlaceholder);

        // Cycle through progress messages while waiting for first chunk
        const streamProgressTimer = setInterval(() => {
          progressIndex = (progressIndex + 1) % PROGRESS_MESSAGES.length;
          setAssistantProgressMsg(prev =>
            prev ? { ...prev, content: PROGRESS_MESSAGES[progressIndex] } : prev
          );
        }, PROGRESS_INTERVAL_MS);

        // Track if we've received the first real chunk
        let hasReceivedFirstChunk = false;

        // SSE parsing state - standard SSE format has separate event: and data: lines
        let sseBuffer = '';

        // Helper to process a complete SSE event
        const processSSEEvent = (eventType: string, dataStr: string) => {
          console.log('[ChatPage Canvas] SSE Event:', eventType, dataStr.substring(0, 100));

          // Parse the data - it might be JSON or plain text
          let eventData: unknown = dataStr;
          try {
            eventData = JSON.parse(dataStr);
          } catch {
            // Plain text data, use as-is
          }

          switch (eventType) {
            case 'chat:chunk':
              // For chat:chunk, data is plain text
              chatContent += dataStr;
              fullResponse += dataStr; // Track full response for history
              streamingContentRef.current = chatContent;

              // On first chunk: clear thinking indicator and add real message
              if (!hasReceivedFirstChunk) {
                hasReceivedFirstChunk = true;
                // Clear thinking indicator
                clearInterval(streamProgressTimer);
                setAssistantProgressMsg(null);
                // Add the real assistant message to state
                const realAssistantMessage: Message = {
                  _id: assistantMessageId,
                  role: 'assistant' as const,
                  content: chatContent,
                };
                messagesRef.current = [...messagesRef.current, realAssistantMessage];
                setMessages(prev => [...prev, realAssistantMessage]);
              }

              // Use requestAnimationFrame for smooth 60fps updates synced to browser paint
              // Only schedule one update per frame, no matter how many chunks arrive
              if (!streamingRafRef.current) {
                streamingRafRef.current = requestAnimationFrame(() => {
                  streamingRafRef.current = null;
                  // Don't update if streaming already completed (stream:end handles final update)
                  if (streamingCompleteRef.current) return;

                  // OPTIMIZATION: Use direct DOM update during streaming to avoid React re-renders
                  // This bypasses React's diffing algorithm which was causing jitter
                  const streamingElement = document.querySelector(`[data-message-id="${assistantMessageId}"]`);
                  if (streamingElement) {
                    // Direct DOM update - much faster than React state update
                    streamingElement.textContent = streamingContentRef.current;
                  }

                  // Trigger auto-scroll during streaming (only if user hasn't scrolled up)
                  // CRITICAL: Use ref (not state) to get current value - state is stale in RAF callback
                  if (shouldAutoScrollRef.current) {
                    // Use instant scroll during streaming to prevent lag buildup
                    isProgrammaticScrollRef.current = true;
                    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
                    // Reset flag - instant scrolls complete synchronously
                    isProgrammaticScrollRef.current = false;
                  }
                });
              }
              break;

            case 'canvas:start':
              console.log('[ChatPage Canvas] Canvas started:', eventData);
              // Clear old canvas content when a NEW canvas is generated
              setCanvasContent('');
              setIsCanvasStreaming(true);
              // Reset canvas RAF refs for new canvas stream
              canvasContentRef.current = '';
              if (canvasRafRef.current) {
                cancelAnimationFrame(canvasRafRef.current);
                canvasRafRef.current = null;
              }
              const startData = eventData as { type?: string; title?: string; language?: string };
              setCanvasType((startData?.type as CanvasType) || 'code');
              setCanvasTitle(startData?.title || 'Untitled');
              setCanvasLanguage(startData?.language || '');
              currentCanvasContent = '';
              canvasDataRef.current = {
                type: (startData?.type as CanvasType) || 'code',
                content: '',
                title: startData?.title || 'Untitled',
                language: startData?.language || '',
                wasGenerated: true,
              };
              // Add canvas opening tag to fullResponse for history
              const canvasAttrs = [];
              if (startData?.type) canvasAttrs.push(`type="${startData.type}"`);
              if (startData?.title) canvasAttrs.push(`title="${startData.title}"`);
              if (startData?.language) canvasAttrs.push(`language="${startData.language}"`);
              fullResponse += `\n<canvas ${canvasAttrs.join(' ')}>\n`;
              // Auto-switch to canvas tab
              setSelectedTab('canvas');
              break;

            case 'canvas:chunk':
              // For canvas:chunk, data is plain text content
              currentCanvasContent += dataStr;
              fullResponse += dataStr; // Track full response for history
              canvasContentRef.current = currentCanvasContent;
              canvasDataRef.current.content = currentCanvasContent;

              // Use requestAnimationFrame for smooth 60fps updates synced to browser paint
              // Only schedule one update per frame, no matter how many chunks arrive
              if (!canvasRafRef.current) {
                canvasRafRef.current = requestAnimationFrame(() => {
                  canvasRafRef.current = null;
                  setCanvasContent(canvasContentRef.current);
                });
              }
              break;

            case 'canvas:end':
              console.log('[ChatPage Canvas] Canvas ended');
              fullResponse += '\n</canvas>\n'; // Close canvas tag for history
              // Flush any pending RAF and set final canvas content
              if (canvasRafRef.current) {
                cancelAnimationFrame(canvasRafRef.current);
                canvasRafRef.current = null;
              }
              setCanvasContent(canvasContentRef.current);
              setIsCanvasStreaming(false);
              break;

            case 'stream:end':
              console.log('[ChatPage Canvas] Stream ended:', eventData);
              const endData = eventData as {
                chatId?: string;
                modelUsed?: string;
                sources?: SourceDocument[];
                metadata?: {
                  retrievalMode?: 'quick' | 'advanced';
                  sourceCount?: number;
                  suggestAdvancedSearch?: boolean;
                  suggestReason?: 'broad_query' | 'few_sources' | 'topic_mismatch';
                };
              };
              if (endData?.chatId) {
                receivedChatId = endData.chatId;
              }
              if (endData?.modelUsed) {
                modelUsed = endData.modelUsed;
              }
              // Advanced Search: Update suggestion state from backend metadata
              if (endData?.metadata?.suggestAdvancedSearch && retrievalMode === 'quick') {
                setAdvancedSearchSuggestion({
                  suggest: true,
                  reason: endData.metadata.suggestReason,
                });
              } else {
                setAdvancedSearchSuggestion(null);
              }
              // Mark streaming as complete and cancel any pending rAF update
              streamingCompleteRef.current = true;
              if (streamingRafRef.current) {
                cancelAnimationFrame(streamingRafRef.current);
                streamingRafRef.current = null;
              }

              // CRITICAL: Update messagesRef SYNCHRONOUSLY before async state update
              // This ensures follow-up queries get the full history with canvas tags
              // even if sent before React state update completes
              messagesRef.current = messagesRef.current.map(m =>
                m._id === assistantMessageId
                  ? {
                      ...m,
                      content: fullResponse, // Use full response including canvas
                      sources: endData?.sources || m.sources
                    }
                  : m
              );
              // Final state update with complete content (syncs React with DOM)
              setMessages(prev => prev.map(m =>
                m._id === assistantMessageId
                  ? {
                      ...m,
                      content: fullResponse, // Use full response including canvas
                      sources: endData?.sources || m.sources
                    }
                  : m
              ));
              break;

            case 'data':
              // Handle backend SSE format: data: {"type":"text|done", "content":"...", "sources":[]}
              // This is the default event type when no 'event:' line is sent
              const jsonData = eventData as { type?: string; content?: string; sources?: SourceDocument[] };

              if (jsonData?.type === 'text' && jsonData?.content) {
                // Treat like chat:chunk
                chatContent += jsonData.content;
                fullResponse += jsonData.content;
                streamingContentRef.current = chatContent;

                if (!hasReceivedFirstChunk) {
                  hasReceivedFirstChunk = true;
                  clearInterval(streamProgressTimer);
                  setAssistantProgressMsg(null);
                  const realAssistantMessage: Message = {
                    _id: assistantMessageId,
                    role: 'assistant' as const,
                    content: chatContent,
                  };
                  messagesRef.current = [...messagesRef.current, realAssistantMessage];
                  setMessages(prev => [...prev, realAssistantMessage]);
                }

                // Update DOM directly for smooth streaming
                if (!streamingRafRef.current) {
                  streamingRafRef.current = requestAnimationFrame(() => {
                    streamingRafRef.current = null;
                    if (streamingCompleteRef.current) return;
                    const streamingElement = document.querySelector(`[data-message-id="${assistantMessageId}"]`);
                    if (streamingElement) {
                      streamingElement.textContent = streamingContentRef.current;
                    }
                    if (shouldAutoScrollRef.current) {
                      isProgrammaticScrollRef.current = true;
                      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
                      isProgrammaticScrollRef.current = false;
                    }
                  });
                }
              } else if (jsonData?.type === 'done') {
                // Treat like stream:end - finalize the message
                console.log('[ChatPage Canvas] Stream done via data event');
                streamingCompleteRef.current = true;
                clearInterval(streamProgressTimer);
                setAssistantProgressMsg(null);

                // If no chunks were received, add the message now (shouldn't happen but safety)
                if (!hasReceivedFirstChunk && chatContent) {
                  const realAssistantMessage: Message = {
                    _id: assistantMessageId,
                    role: 'assistant' as const,
                    content: chatContent,
                    sources: jsonData.sources || [],
                  };
                  messagesRef.current = [...messagesRef.current, realAssistantMessage];
                  setMessages(prev => [...prev, realAssistantMessage]);
                } else {
                  // Update message with sources
                  setMessages(prev => prev.map(m =>
                    m._id === assistantMessageId
                      ? { ...m, content: chatContent, sources: jsonData.sources || [] }
                      : m
                  ));
                }
              }
              break;

            case 'error':
              console.error('[ChatPage Canvas] Stream error event:', eventData);
              break;
          }
        };

        // Process SSE stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          sseBuffer += chunk;

          // Process complete SSE messages (separated by double newlines)
          const messages = sseBuffer.split('\n\n');
          // Keep the last potentially incomplete message in the buffer
          sseBuffer = messages.pop() || '';

          for (const message of messages) {
            if (!message.trim()) continue;

            const lines = message.split('\n');
            let eventType = '';
            const dataLines: string[] = [];

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.substring(7).trim();
              } else if (line.startsWith('data: ')) {
                dataLines.push(line.substring(6));
              }
            }

            // If we have data, process the event
            if (dataLines.length > 0) {
              const dataStr = dataLines.join('\n');
              // Use the event type if specified, otherwise try to detect from data
              const finalEventType = eventType || 'data';
              processSSEEvent(finalEventType, dataStr);
            }
          }
        }

        // Process any remaining data in buffer
        if (sseBuffer.trim()) {
          const lines = sseBuffer.split('\n');
          let eventType = '';
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
              dataLines.push(line.substring(6));
            }
          }

          if (dataLines.length > 0) {
            processSSEEvent(eventType || 'data', dataLines.join('\n'));
          }
        }

        // Update final message with model info
        if (modelUsed) {
          setMessages(prev => prev.map(m =>
            m._id === assistantMessageId
              ? { ...m, modelUsed }
              : m
          ));
        }

        // Update chatId if new chat was created
        if (receivedChatId && !currentChatId) {
          console.log('[ChatPage Canvas] Received new chatId:', receivedChatId);
          setCurrentChatId(receivedChatId);
        }

        // Auto-save canvas if one was generated
        if (canvasDataRef.current.wasGenerated && receivedChatId) {
          try {
            await fetchWithAuth(`/api/chats/${receivedChatId}/canvas/auto`, {
              method: 'PUT',
              body: JSON.stringify({
                type: canvasDataRef.current.type,
                title: canvasDataRef.current.title,
                content: canvasDataRef.current.content,
                language: canvasDataRef.current.language,
              }),
            });
            console.log('[ChatPage Canvas] Auto-saved canvas');
          } catch (e) {
            console.warn('[ChatPage Canvas] Failed to auto-save canvas:', e);
          }
        }

        fetchChatList();

      } catch (error) {
        // Handle abort (user stopped generation) gracefully
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[ChatPage Canvas] Stream stopped by user');
          setAssistantProgressMsg(null);
          // Keep partial response if any, just mark as stopped
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.role === 'assistant' && lastMsg.content) {
              // Add indicator that response was stopped
              return prev.map((msg, idx) =>
                idx === prev.length - 1
                  ? { ...msg, content: msg.content + '\n\n*[Generation stopped]*' }
                  : msg
              );
            }
            return prev;
          });
          setIsCanvasStreaming(false);
        } else {
          console.error('[ChatPage Canvas] Stream error:', error);
          // Clear thinking indicator on error
          setAssistantProgressMsg(null);
          const errorMessage: Message = {
            _id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${error instanceof Error ? error.message : 'Failed to stream response'}`,
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsCanvasStreaming(false);
        }
      } finally {
        setIsSending(false);
        // Reset retrievalMode to 'quick' for next message (Advanced Search is one-shot)
        setRetrievalMode('quick');
        // Ensure thinking indicator is cleared
        setAssistantProgressMsg(null);
        // Clear abort controller
        abortControllerRef.current = null;
      }
    },
    [user, isSending, messages, currentChatId, searchMode, retrievalMode, activePersona, fetchChatList, attachedImages]
  );
  // --- END ADDITION ---

  // --- ADDED: Stop generation function ---
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('[ChatPage] Stopping generation...');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);
  // --- END ADDITION ---

  // --- ADDED: Retry with Advanced Search ---
  const handleRetryWithAdvancedSearch = useCallback(() => {
    // Find the last user message to resend
    const lastUserMessage = [...messagesRef.current].reverse().find(m => m.role === 'user');
    if (!lastUserMessage || isSending) return;

    console.log('[ChatPage] Retrying with Advanced Search:', lastUserMessage.content?.substring(0, 50));

    // Set advanced mode BEFORE resending
    setRetrievalMode('advanced');
    // Clear the suggestion since we're addressing it
    setAdvancedSearchSuggestion(null);

    // Remove the last assistant message (we'll get a new one with advanced search)
    const messagesWithoutLastAssistant = messagesRef.current.filter((m, i, arr) => {
      // Keep all user messages and assistant messages except the last one
      if (m.role === 'user') return true;
      // Check if this is the last assistant message
      const assistantMessages = arr.filter(msg => msg.role === 'assistant');
      return m !== assistantMessages[assistantMessages.length - 1];
    });
    messagesRef.current = messagesWithoutLastAssistant;
    setMessages(messagesWithoutLastAssistant);

    // Resend the query with advanced mode
    // Use setTimeout to ensure state update is processed
    setTimeout(() => {
      handleSendMessageWithCanvas(lastUserMessage.content || '');
    }, 50);
  }, [isSending, handleSendMessageWithCanvas]);
  // --- END ADDITION ---

  const handleSendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isSending || !user) return;

      // Use canvas streaming if canvas mode is enabled
      if (useCanvasMode) {
        return handleSendMessageWithCanvas(input);
      }

      setIsSending(true);

      // Log user settings before sending
      console.log('[ChatPage] Sending message with user settings:', {
        isPersonaEnabled: settings?.isPersonaEnabled,
        hasCustomPrompt: !!settings?.customPrompt,
      });

      // ----- Progressive status placeholder -----
      const placeholderId = `progress-${Date.now()}`;
      let progressIndex = 0;
      const placeholder: Message = {
        _id: placeholderId,
        role: 'assistant',
        content: PROGRESS_MESSAGES[progressIndex],
      } as Message;
      setAssistantProgressMsg(placeholder);

      // cycle messages every interval
      progressTimerRef.current = setInterval(() => {
        progressIndex = (progressIndex + 1) % PROGRESS_MESSAGES.length;
        setAssistantProgressMsg(prev =>
          prev ? { ...prev, content: PROGRESS_MESSAGES[progressIndex] } : prev
        );
      }, PROGRESS_INTERVAL_MS);

      const tempUserMessageId = `user-${Date.now()}`; // Temporary ID for optimistic update
      const userMessage: Message = {
        _id: tempUserMessageId,
        role: 'user',
        content: input.trim(),
      };
      // Update ref synchronously BEFORE async state update
      messagesRef.current = [...messagesRef.current, userMessage];
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setInputValue('');

      console.log(
        '[ChatPage Send] Sending message. User:',
        user?.username,
        'ChatID:',
        currentChatId
      );

      // --- SIMPLIFIED: Use unified search mode directly (no mapping needed) ---
      console.log(`[Chat] Current search mode state: ${searchMode}`);
      console.log(`[Chat] Sending query with searchMode: ${searchMode}`);

      const requestBody: Record<string, any> = {
        query: input.trim(),
        // Use messagesRef.current to get latest messages (includes canvas tags) synchronously
        history: messagesRef.current.map(m => ({ role: m.role, content: m.content, sources: m.sources })),
        searchMode: searchMode, // Send as searchMode, not knowledgeBaseTarget
        // The backend will map this to knowledgeBaseTarget internally
        activePersonaId: activePersona?._id || null,
        chatId: currentChatId || null, // Include chatId for chat persistence
      };


      console.log(
        '[ChatPage] Final requestBody BEFORE sending to API:',
        JSON.stringify(requestBody, null, 2)
      );
      // --- END MODIFICATION ---

      // --- START: Log request payload before fetch ---
      console.log(
        '[ChatPage Send] Sending request to /api/chats. Body:',
        JSON.stringify(requestBody, null, 2)
      );
      // --- END: Log request payload before fetch ---

      try {
        const response = await fetchWithAuth('/api/chats', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        let assistantMessage: Message; // Define here to ensure assignment

        if (response.ok) {
          const data = await response.json();
          // --- START DEBUG LOGS ---
          console.log('<<< RAW POST /api/chats Response Data: >>>', JSON.stringify(data, null, 2)); // Log formatted JSON
          // --- END DEBUG LOGS ---

          // Backend returns { success: boolean, answer: string, sources: Array, chatId: string }

          // Debug logging for sources
          console.log('[DEBUG Sources] Sources from API:', JSON.stringify(data.sources, null, 2));

          // Construct assistant message from response data
          assistantMessage = {
            _id: `assistant-${Date.now()}`, // Generate temporary ID for UI
            role: 'assistant',
            content: data.answer || 'Error: Could not parse response content.',
            sources: data.sources || [],
            modelUsed: data.modelUsed, // Include which model generated the response
          };

          // Update chatId if returned by backend (for persistence)
          if (data.chatId && !currentChatId) {
            console.log('[ChatPage] Received new chatId from backend:', data.chatId);
            setCurrentChatId(data.chatId);
          }

          // Refresh chat list to show new/updated chat in sidebar
          fetchChatList();
        } else {
          // Handle non-OK responses (including 401)
          let errorContent = `Error: ${response.status} ${response.statusText || 'Failed to fetch response'}.`;
          try {
            const errorData = await response.text(); // Get error body
            errorContent += ` ${errorData}`;
          } catch (e) {
            /* Ignore if error body cannot be read */
          }

          console.error('[ChatPage Send] API Error:', errorContent);

          if (response.status === 401) {
            console.warn('[ChatPage Send] Received 401 Unauthorized. Logging out.');
            await logout(); // Force logout on 401
            errorContent = 'Error: Your session may have expired. Please log in again.';
          }

          assistantMessage = {
            _id: `error-${Date.now()}`, // Unique ID for error message
            role: 'assistant',
            content: errorContent,
          };
        }
        // Clear progress indicator on success
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        setAssistantProgressMsg(null);

        // Update messages state with the assistant's response (or error message)
        setMessages(prevMessages => [...prevMessages, assistantMessage]);
      } catch (error) {
        // Handle network/fetch errors
        console.error('[ChatPage Send] Fetch Error:', error);
        // Clear progress on fetch error
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        setAssistantProgressMsg(null);
        const fetchErrorAssistantMessage: Message = {
          _id: `fetch-error-${Date.now()}`,
          role: 'assistant',
          content: `Network Error: ${error instanceof Error ? error.message : 'Failed to fetch response'}`,
        };
        // Update messages state with the fetch error message
        setMessages(prevMessages => [...prevMessages, fetchErrorAssistantMessage]);
      } finally {
        // Ensure progress timer cleared
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        setAssistantProgressMsg(null);
        setIsSending(false); // Ensure loading state is always reset
      }

      // Ensure ALL dependencies used within the callback are listed here
    },
    [
      user,
      isSending,
      logout,
      messages,
      currentChatId,
      setCurrentChatId,
      setMessages,
      setIsSending,
      setInputValue,
      searchMode,
      settings,
      activePersona,
      newChatNotes,
      handleSaveNotes,
      fetchChatList,
      useCanvasMode,
      handleSendMessageWithCanvas,
    ]
  ); // Added missing dependencies

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
      e.preventDefault();
      handleSendMessage(inputValue); // Pass current inputValue
    }
  };

  // --- START ADDITION: Theme Toggle Logic ---
  // Use resolvedTheme for accurate theme detection
  const actualTheme = resolvedTheme || theme;
  const isDarkMode = actualTheme === 'dark';
  const isFunMode = actualTheme === 'fun';

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  // Handle theme selection for dev user with fun mode
  const handleThemeSelect = (selectedTheme: string) => {
    setTheme(selectedTheme);
  };

  // Check if user has access to fun mode (only dev user)
  const hasFunModeAccess = user?.username === 'dev';

  // --- Fun Mode Randomization ---
  interface FunModeColors {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    accent: string;
    border: string;
    card: string;
  }

  // Fun mode colors state - loaded from localStorage after mount
  const [funModeColors, setFunModeColors] = useState<FunModeColors | null>(null);
  const [savedFunThemes, setSavedFunThemes] = useState<FunModeColors[]>([]);
  const [funColorsLoaded, setFunColorsLoaded] = useState(false); // Track if we've loaded from storage

  // Generate random vibrant HSL color
  const randomHue = () => Math.floor(Math.random() * 360);
  const randomSaturation = (min = 60, max = 100) => Math.floor(Math.random() * (max - min) + min);
  const randomLightness = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);

  // Generate a random fun color scheme
  const generateRandomFunColors = useCallback((): FunModeColors => {
    const baseHue = randomHue();
    const complementHue = (baseHue + 180) % 360;
    const analogHue1 = (baseHue + 30) % 360;
    const analogHue2 = (baseHue + 330) % 360;
    const triadHue = (baseHue + 120) % 360;

    return {
      background: `${baseHue} 50% 8%`,
      foreground: `${complementHue} 100% 90%`,
      primary: `${analogHue1} 100% 60%`,
      secondary: `${complementHue} 100% 40%`,
      accent: `${triadHue} 100% 50%`,
      border: `${analogHue2} 100% 50%`,
      card: `${baseHue} 40% 12%`,
    };
  }, []);

  // Shuffle fun mode colors
  const shuffleFunColors = useCallback(() => {
    const newColors = generateRandomFunColors();
    setFunModeColors(newColors);
    // Persist to localStorage
    localStorage.setItem('emtchat-current-fun-theme', JSON.stringify(newColors));
    // Apply colors to CSS
    applyFunModeColors(newColors);
  }, [generateRandomFunColors]);

  // Apply fun mode colors by injecting a style tag
  const applyFunModeColors = useCallback((colors: FunModeColors) => {
    // Remove existing dynamic style if present
    const existingStyle = document.getElementById('fun-mode-dynamic-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create new style element with dynamic colors
    const style = document.createElement('style');
    style.id = 'fun-mode-dynamic-styles';
    style.textContent = `
      .fun {
        --background: ${colors.background} !important;
        --foreground: ${colors.foreground} !important;
        --muted: ${colors.card} !important;
        --muted-foreground: ${colors.foreground} !important;
        --popover: ${colors.card} !important;
        --popover-foreground: ${colors.foreground} !important;
        --card: ${colors.card} !important;
        --card-foreground: ${colors.foreground} !important;
        --border: ${colors.border} !important;
        --input: ${colors.card} !important;
        --primary: ${colors.primary} !important;
        --primary-foreground: ${colors.background} !important;
        --secondary: ${colors.secondary} !important;
        --secondary-foreground: ${colors.background} !important;
        --accent: ${colors.accent} !important;
        --accent-foreground: ${colors.background} !important;
        --ring: ${colors.primary} !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Save current fun theme to favorites
  const saveFunTheme = useCallback(() => {
    if (!funModeColors) return;
    const newSaved = [...savedFunThemes, funModeColors];
    setSavedFunThemes(newSaved);
    localStorage.setItem('emtchat-fun-themes', JSON.stringify(newSaved));
    toast({
      title: 'Theme Saved! 💾',
      description: 'Your fun theme has been saved to favorites.',
    });
  }, [funModeColors, savedFunThemes, toast]);

  // Load a saved fun theme
  const loadSavedFunTheme = useCallback((colors: FunModeColors) => {
    setFunModeColors(colors);
    // Persist to localStorage
    localStorage.setItem('emtchat-current-fun-theme', JSON.stringify(colors));
    applyFunModeColors(colors);
  }, [applyFunModeColors]);

  // Delete a saved theme
  const deleteSavedTheme = useCallback((index: number) => {
    const newSaved = savedFunThemes.filter((_, i) => i !== index);
    setSavedFunThemes(newSaved);
    localStorage.setItem('emtchat-fun-themes', JSON.stringify(newSaved));
  }, [savedFunThemes]);

  // Load saved themes AND current fun colors from localStorage on mount
  useEffect(() => {
    console.log('[Theme] Mount effect running - loading from localStorage');

    // Load saved themes collection
    const savedThemes = localStorage.getItem('emtchat-fun-themes');
    console.log('[Theme] Raw savedThemes from localStorage:', savedThemes ? 'EXISTS' : 'NULL');
    if (savedThemes) {
      try {
        setSavedFunThemes(JSON.parse(savedThemes));
      } catch (e) {
        console.error('Failed to parse saved fun themes:', e);
      }
    }

    // Load current fun theme colors
    const currentColors = localStorage.getItem('emtchat-current-fun-theme');
    console.log('[Theme] Raw currentColors from localStorage:', currentColors ? currentColors.substring(0, 50) + '...' : 'NULL');
    if (currentColors) {
      try {
        const parsed = JSON.parse(currentColors);
        console.log('[Theme] Parsed colors successfully, setting state');
        setFunModeColors(parsed);
      } catch (e) {
        console.error('Failed to parse current fun theme:', e);
      }
    } else {
      console.log('[Theme] No saved colors found in localStorage');
    }

    // Mark as loaded so we don't regenerate colors
    console.log('[Theme] Setting funColorsLoaded = true');
    setFunColorsLoaded(true);
  }, []);

  // Clear fun mode dynamic styles by removing the injected style tag
  // Also ensure the 'fun' class is removed from HTML element (next-themes bug workaround)
  const clearFunModeColors = useCallback(() => {
    const existingStyle = document.getElementById('fun-mode-dynamic-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    // Workaround: next-themes sometimes leaves the 'fun' class when switching themes
    // This ensures clean theme switching by removing the fun class manually
    if (document.documentElement.classList.contains('fun')) {
      document.documentElement.classList.remove('fun');
      console.log('[Theme] Removed lingering fun class from HTML');
    }
  }, []);

  // Apply fun mode colors when theme changes to fun, clear when leaving
  // Use resolvedTheme for accurate detection (handles 'system' theme)
  const currentTheme = resolvedTheme || theme;

  useEffect(() => {
    // Don't do anything until we've loaded from localStorage
    if (!funColorsLoaded) return;

    if (currentTheme === 'fun') {
      // Only apply custom colors if user has shuffled before (colors exist in state)
      // Otherwise, use the static CSS colors from globals.css
      if (funModeColors) {
        console.log('[Theme] Applying saved custom fun colors');
        applyFunModeColors(funModeColors);
      } else {
        console.log('[Theme] Using default static fun colors from CSS');
        // Don't generate - just use the static CSS
      }
    } else {
      // Clear fun mode CSS when switching away
      clearFunModeColors();
    }
  }, [currentTheme, funModeColors, funColorsLoaded, applyFunModeColors, clearFunModeColors]);
  // --- END Fun Mode Randomization ---
  // --- END ADDITION: Theme Toggle Logic ---

  // --- START ADDITION: Right Panel Resize Handlers ---
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingPanel(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = rightPanelWidth;
  }, [rightPanelWidth]);

  useEffect(() => {
    const handleResizeMouseMove = (e: MouseEvent) => {
      if (!isResizingPanel) return;
      // Calculate new width (dragging left increases width, right decreases)
      const delta = resizeStartX.current - e.clientX;
      const maxWidth = getMaxPanelWidth();
      const newWidth = Math.min(Math.max(resizeStartWidth.current + delta, MIN_PANEL_WIDTH), maxWidth);
      setRightPanelWidth(newWidth);
    };

    const handleResizeMouseUp = () => {
      if (isResizingPanel) {
        setIsResizingPanel(false);
        // Save to localStorage
        localStorage.setItem('rightPanelWidth', String(rightPanelWidth));
      }
    };

    if (isResizingPanel) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleResizeMouseUp);
      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMouseMove);
      document.removeEventListener('mouseup', handleResizeMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingPanel, rightPanelWidth, getMaxPanelWidth]);

  const handleResetPanelWidth = useCallback(() => {
    setRightPanelWidth(400);
    localStorage.setItem('rightPanelWidth', '400');
  }, []);

  // Clamp panel width when window resizes
  useEffect(() => {
    const handleWindowResize = () => {
      const maxWidth = getMaxPanelWidth();
      if (rightPanelWidth > maxWidth) {
        setRightPanelWidth(maxWidth);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    // Also clamp on mount in case saved width is too large for current window
    handleWindowResize();

    return () => window.removeEventListener('resize', handleWindowResize);
  }, [rightPanelWidth, getMaxPanelWidth]);
  // --- END ADDITION: Right Panel Resize Handlers ---

  useEffect(() => {
    console.log(
      '[Toggle State] isUserDocsSelected changed to:',
      isUserDocsSelected ? 'user' : 'system'
    );
  }, [isUserDocsSelected]);

  // --- ADDED: Auto-switch tab to match selected knowledge base ---
  useEffect(() => {
    if (searchMode === 'user-docs') {
      setSelectedTab('my-docs');
    } else if (searchMode === 'system-kb') {
      setSelectedTab('system-kb');
    }
    // Note: We don't automatically switch to 'notes' to allow manual tab selection
  }, [searchMode]);
  // --- END ADDITION ---

  // --- ADDED: Cmd+K keyboard shortcut for chat search ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  // --- END ADDITION ---

  // --- ADDED: Handler to update chat name via API ---
  const handleUpdateChatName = async (chatId: string, newName: string) => {
    if (!chatId || !newName.trim()) {
      console.error('[handleUpdateChatName] Invalid input:', { chatId, newName });
      toast({ title: 'Error', description: 'Invalid chat ID or name.', variant: 'destructive' });
      return; // Prevent API call with invalid data
    }

    console.log(`[handleUpdateChatName] Updating chat ${chatId} name to "${newName}"...`);

    // Optimistic UI Update (Should work now with correct type)
    const originalChats = [...chats];
    setChats(prevChats =>
      prevChats.map(chat => (chat._id === chatId ? { ...chat, chatName: newName } : chat))
    );

    try {
      const response = await fetchWithAuth(`/api/chats/${chatId}/name`, {
        method: 'PUT',
        body: JSON.stringify({ chatName: newName }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('[handleUpdateChatName] Name updated successfully.');
        toast({ title: 'Success', description: 'Chat name updated.' });
        // State already updated optimistically
        // If backend returns updated chat object, you could update state here instead
        // e.g., setChats(prev => prev.map(c => c._id === chatId ? { ...c, ...result.chat } : c));
      } else {
        console.error(`[handleUpdateChatName] Failed to update name: ${response.status}`, result);
        // Rollback optimistic update on failure
        setChats(originalChats);
        throw new Error(result.message || `Failed to update name (Status: ${response.status})`);
      }
    } catch (error: any) {
      console.error('[handleUpdateChatName] Error updating name:', error);
      // Rollback optimistic update on error
      setChats(originalChats);
      toast({ title: 'Error Updating Name', description: error.message, variant: 'destructive' });
      // Re-throw or handle as needed
    }
    // No finally block needed for loading state as it's handled in Sidebar
  };
  // --- END ADDITION ---

  // --- Render Logic ---

  // Combine normal messages with progress placeholder for rendering
  const displayMessages = assistantProgressMsg ? [...messages, assistantProgressMsg] : messages;

  // Wrap the main content with ProtectedRoute
  return (
    <ProtectedRoute>
      <WelcomeModal />
      <div className="flex fixed inset-0 md:relative md:h-screen bg-background text-foreground p-2 md:p-4 overflow-hidden emtchat-bg">
        {/* 1. Left Sidebar - Hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar
            user={user}
            activeView={activeView}
            setActiveView={setActiveView}
            chats={chats}
            selectedChatId={selectedChatIdFromSidebar}
            isLoadingChats={isLoadingChats}
            handleNewChat={handleNewChat}
            handleSelectChat={handleSelectChat}
            handleConfirmDelete={handleConfirmDelete}
            onDeleteAllChats={() => setIsAlertAllOpen(true)}
            isAlertAllOpen={isAlertAllOpen}
            setIsAlertAllOpen={setIsAlertAllOpen}
            handleLogout={logout}
            onUpdateChatName={handleUpdateChatName}
          />
        </div>

        {/* 2. Center Main Content Area - Messenger-style layout on mobile */}
        <div
          className="flex flex-1 flex-col h-full transition-all duration-300 ease-in-out bg-background min-w-0 md:min-w-[400px] pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0"
        >
          {/* Header - sticky on mobile */}
          <header className="p-2 md:p-4 bg-background flex items-center justify-between flex-shrink-0 sticky top-0 z-20 overflow-hidden">
            <div className="flex items-center gap-1 md:gap-3">
              {/* Mobile Navigation - Hamburger Menu */}
              <MobileNav
                user={user}
                activeView={activeView}
                setActiveView={setActiveView}
                chats={chats}
                selectedChatId={selectedChatIdFromSidebar}
                isLoadingChats={isLoadingChats}
                handleNewChat={handleNewChat}
                handleSelectChat={handleSelectChat}
                handleConfirmDelete={handleConfirmDelete}
                onDeleteAllChats={() => setIsAlertAllOpen(true)}
                isAlertAllOpen={isAlertAllOpen}
                setIsAlertAllOpen={setIsAlertAllOpen}
                handleLogout={logout}
                onUpdateChatName={handleUpdateChatName}
              />
              <h2 className="text-sm md:text-lg font-semibold whitespace-nowrap mr-4 md:mr-8">
                <span className="text-orange-500">EMT</span>Chat
              </h2>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {/* Unified Search Toggle */}
              <UnifiedSearchToggle />
              {/* Help Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleHelpMode}
                data-help-id="header-help-mode"
                title={isHelpModeEnabled ? 'Disable Help Mode' : 'Enable Help Mode'}
                className={`transition-all duration-200 h-7 w-7 md:h-10 md:w-10 ${
                  isHelpModeEnabled
                    ? 'bg-yellow-500 text-yellow-900 hover:bg-yellow-600 shadow-md'
                    : 'hover:bg-muted'
                }`}
              >
                <HelpCircle className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              {/* Theme Toggle - Dropdown for dev user, Switch for others */}
              {hasFunModeAccess ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "relative h-7 w-7 md:h-10 md:w-10",
                        isFunMode && "text-pink-500 hover:text-pink-400"
                      )}
                      data-help-id="header-theme"
                    >
                      {actualTheme === 'light' && <Sun className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />}
                      {actualTheme === 'dark' && <Moon className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />}
                      {actualTheme === 'fun' && <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-pink-500 animate-pulse" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => handleThemeSelect('light')}
                      className={cn(actualTheme === 'light' && 'bg-accent')}
                    >
                      <Sun className="mr-2 h-4 w-4 text-yellow-500" />
                      Light
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleThemeSelect('dark')}
                      className={cn(actualTheme === 'dark' && 'bg-accent')}
                    >
                      <Moon className="mr-2 h-4 w-4 text-blue-400" />
                      Dark
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleThemeSelect('fun')}
                      className={cn(
                        actualTheme === 'fun' && 'bg-accent',
                        'text-pink-500 hover:text-pink-400'
                      )}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Fun Mode ✨
                    </DropdownMenuItem>
                    {/* Fun mode controls - only show when in fun mode */}
                    {isFunMode && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            shuffleFunColors();
                          }}
                          className="text-cyan-500 hover:text-cyan-400"
                        >
                          <Shuffle className="mr-2 h-4 w-4" />
                          Shuffle Colors 🎲
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            saveFunTheme();
                          }}
                          className="text-green-500 hover:text-green-400"
                        >
                          <Heart className="mr-2 h-4 w-4" />
                          Save Theme 💾
                        </DropdownMenuItem>
                      </>
                    )}
                    {/* Saved themes section */}
                    {savedFunThemes.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Saved Themes ({savedFunThemes.length})
                        </div>
                        {savedFunThemes.map((savedTheme, index) => (
                          <DropdownMenuItem
                            key={index}
                            onClick={() => {
                              handleThemeSelect('fun');
                              loadSavedFunTheme(savedTheme);
                            }}
                            className="flex items-center justify-between group"
                          >
                            <div className="flex items-center">
                              <div
                                className="w-4 h-4 rounded-full mr-2 border border-white/20"
                                style={{
                                  background: `linear-gradient(135deg,
                                    hsl(${savedTheme.primary}) 0%,
                                    hsl(${savedTheme.secondary}) 50%,
                                    hsl(${savedTheme.accent}) 100%)`
                                }}
                              />
                              Theme {index + 1}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSavedTheme(index);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-1"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center space-x-1 md:space-x-2" data-help-id="header-theme">
                  <Sun className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />
                  <Switch
                    id="theme-switch"
                    checked={actualTheme === 'dark'}
                    onCheckedChange={handleThemeChange}
                    className="scale-75 md:scale-100 dark:data-[state=unchecked]:bg-slate-700 dark:data-[state=checked]:bg-yellow-500 dark:[&_[data-radix-switch-thumb]]:bg-slate-100"
                  />
                  <Moon className="h-4 w-4 md:h-5 md:w-5 text-gray-500" />
                </div>
              )}
              {/* Right Sidebar Toggle - hidden on mobile */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                title={isRightSidebarOpen ? 'Hide Panel' : 'Show Panel'}
                className="hidden md:flex h-7 w-7 md:h-10 md:w-10"
              >
                {isRightSidebarOpen ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>
          </header>

          {/* Message List - min-h-0 prevents flex child overflow on mobile */}
          <main
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 rounded-lg mx-4 mb-4 bg-muted dark:bg-zinc-800"
          >
            {isLoadingHistory ? (
              <div className="flex justify-center items-center h-full text-muted-foreground">
                Loading history...
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex justify-center items-center h-full text-muted-foreground">
                Start a new conversation.
              </div>
            ) : (
              displayMessages.map((msg, msgIndex) => (
                <div
                  key={msg._id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`relative max-w-[75%] rounded-lg px-4 py-2 shadow-sm border ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground'}`}
                  >
                    {/* Three-dot menu for assistant messages */}
                    {msg.role === 'assistant' && !msg._id.startsWith('progress-') && (
                      <div className="absolute top-2 right-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                              aria-label="Message options"
                            >
                              <MoreVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleCopyToClipboard(msg.content, msg._id)}
                              className="cursor-pointer"
                            >
                              {copiedMessageId === msg._id ? (
                                <>
                                  <Check className="w-4 h-4 mr-2 text-green-600" />
                                  <span className="text-green-600">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy to clipboard
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDownloadMessage(msg.content, 'pdf')}
                              className="cursor-pointer"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download as PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDownloadMessage(msg.content, 'docx')}
                              className="cursor-pointer"
                            >
                              <FileType className="w-4 h-4 mr-2" />
                              Download as Word
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDownloadMessage(msg.content, 'txt')}
                              className="cursor-pointer"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Download as Text
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleSaveToDocuments(msg.content, 'pdf', msg._id)}
                              className="cursor-pointer"
                              disabled={savingMessageId === msg._id}
                            >
                              {savingMessageId === msg._id ? (
                                <>
                                  <Check className="w-4 h-4 mr-2 text-green-600" />
                                  <span className="text-green-600">Saved!</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  Save to My Documents
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                    {/* User-attached images */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {msg.images.map((imgSrc, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={imgSrc}
                            alt={`Attached image ${imgIdx + 1}`}
                            className="max-h-48 max-w-full rounded-lg border border-border/50 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(imgSrc, '_blank')}
                            title="Click to open full size"
                          />
                        ))}
                      </div>
                    )}
                    {/* User-attached documents */}
                    {msg.documents && msg.documents.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {msg.documents.map((doc, docIdx) => {
                          // Get icon based on file type
                          const getDocIcon = (fileType: string) => {
                            switch (fileType.toLowerCase()) {
                              case 'pdf':
                                return <FileText className="w-6 h-6 text-red-500" />;
                              case 'docx':
                              case 'doc':
                                return <FileText className="w-6 h-6 text-blue-500" />;
                              case 'xlsx':
                              case 'xls':
                                return <FileType className="w-6 h-6 text-green-600" />;
                              case 'csv':
                                return <FileType className="w-6 h-6 text-green-500" />;
                              case 'txt':
                              case 'md':
                              case 'markdown':
                                return <FileIcon className="w-6 h-6 text-gray-500" />;
                              default:
                                return <FileIcon className="w-6 h-6 text-muted-foreground" />;
                            }
                          };
                          // Format file size
                          const formatSize = (bytes?: number) => {
                            if (!bytes) return '';
                            if (bytes < 1024) return `${bytes} B`;
                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                          };
                          return (
                            <button
                              key={docIdx}
                              onClick={() => setViewingDocument(doc)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer text-left"
                              title={`Click to view ${doc.fileName}`}
                            >
                              {getDocIcon(doc.fileType)}
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium truncate max-w-[200px]">
                                  {doc.fileName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {doc.fileType.toUpperCase()}
                                  {doc.fileSize && ` • ${formatSize(doc.fileSize)}`}
                                  {doc.truncated && <span className="text-amber-500 ml-1">(truncated)</span>}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p
                      data-message-id={msg._id}
                      className={`text-sm whitespace-pre-wrap ${msg._id.startsWith('progress-') ? 'thinking-glow' : ''} ${msg.role === 'assistant' && !msg._id.startsWith('progress-') ? 'pr-8' : ''}`}
                    >{/* Strip canvas blocks from displayed content - they render in Canvas panel */}
                      {msg.content.replace(/<canvas[^>]*>[\s\S]*?<\/canvas>/gi, '').trim()}</p>
                    {/* Sources - Collapsible */}
                    {msg.role === 'assistant' &&
                      msg.sources &&
                      msg.sources.length > 0 && (
                        <div className="mt-2 border-t pt-2 border-muted">
                          <button
                            onClick={() => {
                              setExpandedSourceIds(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(msgIndex)) {
                                  newSet.delete(msgIndex);
                                } else {
                                  newSet.add(msgIndex);
                                }
                                return newSet;
                              });
                            }}
                            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronRight
                              className={`h-3 w-3 transition-transform duration-200 ${
                                expandedSourceIds.has(msgIndex) ? 'rotate-90' : ''
                              }`}
                            />
                            Sources ({msg.sources.length})
                          </button>
                          {expandedSourceIds.has(msgIndex) && (
                            <ul className="list-none pl-4 mt-1 space-y-1">
                              {msg.sources.map((source, index) => (
                                <li key={source.documentId || `source-${index}`}>
                                  {source.documentId && source.fileName && source.type ? (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="h-auto p-0 text-xs text-muted-foreground hover:text-primary font-normal text-left whitespace-normal"
                                      onClick={() =>
                                        handleDocumentSelect(
                                          source.documentId!,
                                          source.fileName!,
                                          source.type!
                                        )
                                      }
                                      title={`View ${source.fileName}`}
                                    >
                                      {source.fileName}
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {source.fileName || source.documentId || 'Unknown Source'}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    {/* Message footer: Feedback buttons + Model badge */}
                    {msg.role === 'assistant' && !msg._id.startsWith('progress-') && (
                      <div className="flex items-center justify-between mt-2 group">
                        {/* Feedback buttons - left side */}
                        <FeedbackButtons
                          messageId={msg._id}
                          messageContent={msg.content}
                          userQuery={(() => {
                            // Find the previous user message for context
                            const prevUserMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
                            return prevUserMsg?.content || '';
                          })()}
                          searchMode={searchMode}
                          ragSources={msg.sources?.map(s => s.fileName || 'Unknown') || []}
                          conversationId={currentChatId || undefined}
                          onDislikeClick={() => {
                            const prevUserMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
                            setFeedbackModalData({
                              messageId: msg._id,
                              messageContent: msg.content,
                              userQuery: prevUserMsg?.content || '',
                              ragSources: msg.sources?.map(s => s.fileName || 'Unknown') || [],
                            });
                            setFeedbackModalOpen(true);
                          }}
                        />
                        {/* Model badge - right side */}
                        {msg.modelUsed && (
                          <button
                            onClick={() => {
                              setExpandedModelIds(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(msgIndex)) {
                                  newSet.delete(msgIndex);
                                } else {
                                  newSet.add(msgIndex);
                                }
                                return newSet;
                              });
                            }}
                            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                            title={expandedModelIds.has(msgIndex) ? 'Hide model' : 'Show model'}
                          >
                            <ChevronRight
                              className={`h-3 w-3 transition-transform duration-200 ${
                                expandedModelIds.has(msgIndex) ? 'rotate-90' : ''
                              }`}
                            />
                            {expandedModelIds.has(msgIndex) && (
                              <span className="ml-1">{msg.modelUsed}</span>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Advanced Search suggestion - shown when backend suggests using advanced mode */}
            {advancedSearchSuggestion?.suggest && !isSending && (
              <AdvancedSearchSuggestion
                suggestion={advancedSearchSuggestion}
                onTryAdvancedSearch={handleRetryWithAdvancedSearch}
                onDismiss={() => setAdvancedSearchSuggestion(null)}
                isLoading={isSending}
              />
            )}

            <div ref={messagesEndRef} /> {/* Scroll target */}
          </main>

          {/* Input Area - Sticky at bottom with safe area padding for iOS */}
          <footer className="p-4 pb-safe flex-shrink-0 w-full sticky bottom-0 bg-background">
            <div
              className={cn(
                "flex flex-col gap-2 p-3 rounded-lg bg-gradient-to-r from-blue-100/50 to-purple-100/50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 transition-all duration-200",
                isDragOver
                  ? "border-primary border-dashed bg-primary/10"
                  : "border-blue-200 dark:border-blue-800"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drag overlay indicator */}
              {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/5 rounded-lg pointer-events-none z-10">
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <Paperclip className="h-8 w-8" />
                    <span className="text-sm font-medium">Drop files here</span>
                  </div>
                </div>
              )}

              {/* File previews (images and documents) */}
              {attachedFiles.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {attachedFiles.map((file) => (
                    <div key={file.id} className="relative group">
                      {file.type === 'image' && file.preview ? (
                        <img
                          src={file.preview}
                          alt={file.file.name}
                          className="h-16 w-16 object-cover rounded-lg border border-border shadow-sm"
                        />
                      ) : (
                        <div className={`h-16 w-16 rounded-lg border border-border shadow-sm flex flex-col items-center justify-center ${
                          file.status === 'uploading' ? 'bg-primary/10' :
                          file.status === 'processing' ? 'bg-amber-500/10' :
                          file.status === 'error' ? 'bg-destructive/10' :
                          file.status === 'ready' ? 'bg-green-500/10' :
                          'bg-muted'
                        }`}>
                          {file.status === 'uploading' ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : file.status === 'processing' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                              <span className="text-[8px] text-amber-600">Processing</span>
                            </div>
                          ) : file.status === 'error' ? (
                            <AlertCircle className="h-5 w-5 text-destructive" />
                          ) : file.status === 'ready' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <Check className="h-4 w-4 text-green-500" />
                              <span className="text-[8px] text-green-600">Ready</span>
                            </div>
                          ) : (
                            <FileIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="Remove file"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                      <span className={`absolute bottom-0.5 left-0.5 right-0.5 text-[10px] text-white rounded px-1 truncate ${
                        file.status === 'error' ? 'bg-destructive/80' : 'bg-black/60'
                      }`}>
                        {file.file.name.length > 10 ? file.file.name.slice(0, 10) + '...' : file.file.name}
                      </span>
                    </div>
                  ))}
                  {attachedFiles.length < MAX_FILES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-colors"
                      title="Add more files"
                    >
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {/* Input row */}
              <div className="flex gap-2 items-end">
                {/* Hidden file input - accepts all supported file types */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALL_ALLOWED_EXTENSIONS.join(',')}
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {/* Attach file button */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || attachedFiles.length >= MAX_FILES}
                  title={attachedFiles.length >= MAX_FILES ? `Maximum ${MAX_FILES} files` : "Attach files (PDF, images, docs, or drag & drop)"}
                  className="flex-shrink-0"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <Textarea
                  ref={textareaRef}
                  placeholder={attachedFiles.length > 0
                    ? "Describe what you want to do with these files..."
                    : "Type your message here... (drag & drop files, Shift+Enter for newline)"
                  }
                  className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent p-2"
                  rows={1}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  disabled={isSending}
                />
                {isSending ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onClick={handleStopGeneration}
                    title="Stop generating"
                  >
                    <Square className="h-4 w-4" />
                    <span className="sr-only">Stop generating</span>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={(!inputValue.trim() && attachedFiles.filter(f => f.status === 'ready').length === 0)}
                    onClick={() => handleSendMessage(inputValue)}
                  >
                    <Send className="h-4 w-4" />
                    <span className="sr-only">Send message</span>
                  </Button>
                )}
              </div>

              {/* Hint text */}
              {attachedFiles.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Tip: Drag & drop files, paste images, or click <Paperclip className="h-3 w-3 inline" /> to attach
                </p>
              )}
            </div>
          </footer>
        </div>

        {/* 3. Right Sidebar with Resize Handle - Hidden on mobile via CSS */}
        {isRightSidebarOpen && (
          <div className="hidden md:contents">
            {/* Resize Handle - with larger hit area for easier grabbing */}
            <div
              className={cn(
                "w-3 h-full flex-shrink-0 group relative cursor-col-resize z-10",
                "flex items-center justify-center"
              )}
              onMouseDown={handleResizeMouseDown}
              onDoubleClick={handleResetPanelWidth}
              title="Drag to resize • Double-click to reset"
            >
              {/* Visible resize bar */}
              <div
                className={cn(
                  "w-1 h-full bg-border group-hover:bg-primary/50 transition-all duration-150",
                  isResizingPanel && "w-1.5 bg-primary/50"
                )}
              />
              {/* Visual indicator dots - shown in center */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              </div>
            </div>
            {/* Right Panel */}
            <div
              className="border-l border-border flex flex-col h-full flex-shrink-0"
              style={{
                width: `${rightPanelWidth}px`,
                maxWidth: 'calc(100vw - 350px)', // Never exceed viewport minus left sidebar
              }}
            >
              {selectedDocument ? (
              // If a document is selected, show the document viewer
              <DocumentViewer
                documentId={selectedDocument.id}
                filename={selectedDocument.filename}
                type={selectedDocument.type}
                onClose={handleCloseViewer}
              />
            ) : (
              // Show tabs when no document is selected
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex flex-col h-full bg-card right-panel-tabs">
                <TabsList className="grid w-full grid-cols-4 p-1 m-2">
                  <TabsTrigger value="notes" className="text-xs" data-help-id="panel-notes-tab">Notes</TabsTrigger>
                  <TabsTrigger value="canvas" className="text-xs relative" data-help-id="panel-canvas-tab">
                    Canvas
                    {canvasType && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="system-kb" className="text-xs" data-help-id="panel-system-kb-tab">System KB</TabsTrigger>
                  <TabsTrigger value="my-docs" className="text-xs" data-help-id="panel-my-docs-tab">My Docs</TabsTrigger>
                </TabsList>
                
                <TabsContent value="notes" className="flex-1 m-0 overflow-hidden">
                  <ChatNotesPanel
                    chatId={currentChatId}
                    initialNotes={currentChatId ? selectedChatData?.notes : newChatNotes}
                    onSaveNotes={handleSaveNotes}
                    isLoading={isSavingNotes}
                  />
                </TabsContent>

                <TabsContent
                  value="canvas"
                  className={cn(
                    "flex-1 m-0 overflow-auto bg-card canvas-no-flash",
                    selectedTab !== 'canvas' && "hidden"
                  )}
                  forceMount
                >
                  <CanvasPanel
                    type={canvasType}
                    content={canvasContent}
                    language={canvasLanguage}
                    title={canvasTitle}
                    isStreaming={isCanvasStreaming}
                    onClose={() => {
                      setCanvasType(null);
                      setCanvasContent('');
                      setCanvasTitle('');
                      setCanvasLanguage('');
                    }}
                    chatId={currentChatId}
                  />
                </TabsContent>

                <TabsContent value="system-kb" className="flex-1 m-0 overflow-hidden">
                  <FileTreeView onDocumentSelect={handleSystemKbSelect} isActive={selectedTab === 'system-kb'} />
                </TabsContent>

                <TabsContent value="my-docs" className="flex-1 m-0 overflow-hidden">
                  <FileTreeManager mode="user" isActive={selectedTab === 'my-docs'} />
                </TabsContent>
              </Tabs>
            )}
            </div>
          </div>
        )}

        {/* 4. Mobile Tab Panels - Full-screen views for each tab */}
        {/* IMPORTANT: Only render on mobile to prevent duplicate VoiceVideoCallProvider/IncomingCallModal */}
        {/* On desktop, IMContainer provides these contexts. Having both causes dual ringtones! */}
        {isMobile && (
        <DMProvider>
          <VoiceVideoCallProvider>
            {/* Notes Panel - Full screen on mobile */}
            <MobileTabPanel id="notes" activeTab={activeTab}>
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-border">
                  <h2 className="text-lg font-semibold">Notes</h2>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ChatNotesPanel
                    chatId={currentChatId}
                    initialNotes={currentChatId ? selectedChatData?.notes : newChatNotes}
                    onSaveNotes={handleSaveNotes}
                    isLoading={isSavingNotes}
                  />
                </div>
              </div>
            </MobileTabPanel>

            {/* Canvas Panel - Full screen on mobile */}
            <MobileTabPanel id="canvas" activeTab={activeTab}>
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-border">
                  <h2 className="text-lg font-semibold">Canvas</h2>
                </div>
                <div className="flex-1 overflow-auto">
                  <CanvasPanel
                    type={canvasType}
                    content={canvasContent}
                    language={canvasLanguage}
                    title={canvasTitle}
                    isStreaming={isCanvasStreaming}
                    onClose={() => {
                      setCanvasType(null);
                      setCanvasContent('');
                      setCanvasTitle('');
                      setCanvasLanguage('');
                    }}
                    chatId={currentChatId}
                  />
                </div>
              </div>
            </MobileTabPanel>

            {/* Files Panel - Full screen on mobile */}
            <MobileTabPanel id="files" activeTab={activeTab}>
              <Tabs defaultValue="my-docs" className="h-full flex flex-col">
                {/* Fixed header with tabs - won't scroll */}
                <div className="flex-shrink-0 bg-background">
                  <div className="px-4 pt-4 pb-2">
                    <h2 className="text-lg font-semibold">Files</h2>
                  </div>
                  <TabsList className="grid w-full grid-cols-2 mx-4 mb-3 h-12 p-1 bg-muted rounded-lg" style={{ width: 'calc(100% - 2rem)' }}>
                    <TabsTrigger value="my-docs" className="text-sm rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground">My Docs</TabsTrigger>
                    <TabsTrigger value="system-kb" className="text-sm rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground">System KB</TabsTrigger>
                  </TabsList>
                </div>
                {/* Content area */}
                <TabsContent value="my-docs" className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden">
                  <FileTreeManager mode="user" isActive={activeTab === 'files'} />
                </TabsContent>
                <TabsContent value="system-kb" className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden">
                  <FileTreeView onDocumentSelect={handleSystemKbSelect} isActive={activeTab === 'files'} />
                </TabsContent>
              </Tabs>
            </MobileTabPanel>

            {/* Messages Panel - Full screen IM/Buddy Chat on mobile */}
            <MobileTabPanel id="messages" activeTab={activeTab}>
              <div className="h-full flex flex-col bg-background">
                <IMProvider>
                  <MobileIMContainer />
                </IMProvider>
              </div>
            </MobileTabPanel>

            {/* Mobile Call UI Components - Rendered outside tab panels so calls persist across tabs */}
            <IncomingCallModal />
            <ActiveCallUI />
          </VoiceVideoCallProvider>
        </DMProvider>
        )}

        {/* 5. Mobile Bottom Tab Bar - CSS handles visibility via md:hidden */}
        <MobileTabBar activeTab={activeTab} onTabChange={switchTab} />

        {/* Feedback Modal for detailed dislike feedback */}
        {feedbackModalData && (
          <FeedbackModal
            isOpen={feedbackModalOpen}
            onClose={() => {
              setFeedbackModalOpen(false);
              setFeedbackModalData(null);
            }}
            messageId={feedbackModalData.messageId}
            messageContent={feedbackModalData.messageContent}
            userQuery={feedbackModalData.userQuery}
            searchMode={searchMode}
            ragSources={feedbackModalData.ragSources}
            conversationId={currentChatId || undefined}
          />
        )}

        {/* Chat Document Viewer - for viewing inline attached documents */}
        {viewingDocument && (
          <ChatDocumentViewer
            fileName={viewingDocument.fileName}
            fileType={viewingDocument.fileType}
            blobUrl={viewingDocument.blobUrl}
            textContent={viewingDocument.textContent}
            onClose={() => setViewingDocument(null)}
          />
        )}

        {/* --- START ADDITION: Delete All Chats Confirmation Dialog --- */}
        <AlertDialog open={isAlertAllOpen} onOpenChange={setIsAlertAllOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete All Chat History?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete all of your chat
                sessions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAllChats}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete All Chats
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* --- END ADDITION --- */}

        {/* --- START ADDITION: Chat Search Modal (Cmd+K) --- */}
        <ChatSearchModal
          isOpen={isSearchModalOpen}
          onOpenChange={setIsSearchModalOpen}
          onSelectChat={handleSelectChat}
        />
        {/* --- END ADDITION --- */}
      </div>
    </ProtectedRoute>
  );
}
