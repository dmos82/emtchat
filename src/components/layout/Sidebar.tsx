'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  User as UserIcon,
  Trash2,
  ShieldCheck,
  LogOut,
  Pencil,
  MessageSquareWarning,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import UserStatus from './UserStatus';
import { ChatSummary } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import FeedbackModal from '@/components/common/FeedbackModal';
import ProfileDialog from '@/components/profile/ProfileDialog';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface SidebarProps {
  user: ReturnType<typeof import('@/hooks/useAuth').useAuth>['user'];
  activeView: 'chat' | 'docs';
  setActiveView: (view: 'chat' | 'docs') => void;
  chats: ChatSummary[];
  selectedChatId: string | null;
  isLoadingChats: boolean;
  handleNewChat: () => void;
  handleSelectChat: (chatId: string) => void;
  handleConfirmDelete: (chatId: string) => void;
  onDeleteAllChats: () => void;
  isAlertAllOpen: boolean;
  setIsAlertAllOpen: (isOpen: boolean) => void;
  handleLogout: () => void;
  onUpdateChatName: (chatId: string, newName: string) => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeView,
  setActiveView,
  chats,
  selectedChatId,
  isLoadingChats,
  handleNewChat,
  handleSelectChat,
  handleConfirmDelete,
  onDeleteAllChats,
  isAlertAllOpen,
  setIsAlertAllOpen,
  handleLogout,
  onUpdateChatName,
}) => {
  const router = useRouter();

  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState<string>('');
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [userIconUrl, setUserIconUrl] = useState<string | null>(null);
  const [filterTerm, setFilterTerm] = useState('');

  // Dev user: toggle between avatar and logo in sidebar header
  const [showAvatarAsLogo, setShowAvatarAsLogo] = useState(false);

  // Theme detection for logo switching
  const [isDarkMode, setIsDarkMode] = useState(true);

  const { toast } = useToast();
  const {} = useAuth();

  // Check if current user is dev
  const isDevUser = user?.username === 'dev';

  // Backend search state
  const [searchResults, setSearchResults] = useState<Array<{
    _id: string;
    chatName: string;
    matchType: 'title' | 'message' | 'note';
    snippet?: string;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Backend search function with debouncing
  const performBackendSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetchWithAuth(`/api/chats/search?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('[Sidebar] Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Trigger backend search with debounce when filter term changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!filterTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Show searching state immediately
    setIsSearching(true);

    debounceRef.current = setTimeout(() => {
      performBackendSearch(filterTerm);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filterTerm, performBackendSearch]);

  // Load avatar display preference from localStorage
  useEffect(() => {
    if (isDevUser) {
      const savedPref = localStorage.getItem('emtchat-show-avatar-as-logo');
      if (savedPref === 'true') {
        setShowAvatarAsLogo(true);
      }
    }
  }, [isDevUser]);

  // Theme detection for logo switching
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }

    // Listen for theme changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        setIsDarkMode(e.newValue === 'dark');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Also listen for class changes on document
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      observer.disconnect();
    };
  }, []);


  // Fetch user settings to get icon URL
  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        const response = await fetchWithAuth('/api/users/me/settings');
        if (response.ok) {
          const data = await response.json();
          if (data.settings?.iconUrl) {
            setUserIconUrl(data.settings.iconUrl);
          }
        }
      } catch (error) {
        console.error('[Sidebar] Error fetching user settings:', error);
      }
    };

    if (user) {
      fetchUserSettings();
    }
  }, [user]);

  // Filter chats - use backend search results when available, fallback to all chats
  const filteredChats = useMemo(() => {
    if (!filterTerm.trim()) return chats;

    // If we have backend search results, use those (ordered by relevance from backend)
    if (searchResults.length > 0) {
      // Map search results to full chat objects from the chats array
      // This preserves the search order but ensures we have full chat data
      const chatMap = new Map(chats.map(c => [c._id, c]));
      return searchResults
        .map(result => {
          const chat = chatMap.get(result._id);
          if (chat) {
            // Attach match metadata to the chat object for display
            return {
              ...chat,
              _matchType: result.matchType,
              _snippet: result.snippet,
            };
          }
          return null;
        })
        .filter(Boolean) as (ChatSummary & { _matchType?: string; _snippet?: string })[];
    }

    // While searching or no results, show nothing (the loading/empty state will handle it)
    return [];
  }, [chats, filterTerm, searchResults]);

  const onLogoutClick = () => {
    console.log('[Sidebar] Logout button clicked. Calling handleLogout prop...');
    handleLogout();
    router.push('/auth');
  };

  const handleStartEdit = (chat: ChatSummary) => {
    setEditingChatId(chat._id);
    setEditedName(chat.chatName);
  };

  const handleCancelEdit = () => {
    setEditingChatId(null);
    setEditedName('');
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditedName(event.target.value);
  };

  const handleSaveEdit = async () => {
    if (!editingChatId || !editedName.trim()) {
      handleCancelEdit();
      return;
    }
    try {
      console.log(`[Sidebar] Saving new name "${editedName.trim()}" for chat ${editingChatId}`);
      await onUpdateChatName(editingChatId, editedName.trim());
    } catch (error) {
      console.error('[Sidebar] Error saving chat name:', error);
    } finally {
      handleCancelEdit();
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <nav className="w-[280px] h-full bg-background p-3 flex flex-col flex-shrink-0 rounded-lg">
      {/* Logo / Avatar Header */}
      <div className="mb-4 flex w-full justify-center">
        {isDevUser && showAvatarAsLogo && userIconUrl ? (
          <img
            src={userIconUrl}
            alt="User Avatar"
            className="w-[150px] h-[150px] object-cover rounded-lg"
          />
        ) : (
          <a
            href="https://emtchat.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="EMTChat Homepage"
          >
            <Image
              src={isDarkMode ? '/emtchat-logo-dark.png' : '/emtchat-logo.png'}
              alt="EMTChat Logo"
              width={180}
              height={180}
              priority
              unoptimized
              className="object-contain"
            />
          </a>
        )}
      </div>

      <Button
        onClick={handleNewChat}
        variant="secondary"
        data-help-id="sidebar-new-chat"
        className="w-full mb-1 transition-all duration-200 ease-in-out hover:bg-secondary/90 hover:scale-[1.02] active:scale-[0.98]"
      >
        New Chat
      </Button>

      {/* Document Manager Link - Always show for logged-in users */}
      <Link href="/documents" passHref legacyBehavior>
        <Button
          variant="secondary"
          data-help-id="sidebar-documents"
          className="w-full mb-1 transition-all duration-200 ease-in-out hover:bg-secondary/90 hover:scale-[1.02] active:scale-[0.98]"
        >
          {/* <Icon className="mr-2 h-4 w-4" /> // Optional Icon */}
          Document Manager
        </Button>
      </Link>

      {!isLoadingChats && user?.role === 'admin' && (
        <>
          <Link href="/admin" passHref>
            <Button
              variant="secondary"
              data-help-id="sidebar-admin"
              className="w-full justify-start mb-1 transition-all duration-200 ease-in-out hover:bg-secondary/90 hover:scale-[1.02] active:scale-[0.98]"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Admin Dashboard
            </Button>
          </Link>
          {/* Divider between Admin and Feedback */}
          <div className="my-2 border-t border-border" />
        </>
      )}

      {/* Feedback Button - Separated from Admin Dashboard */}
      <Button
        variant="secondary"
        data-help-id="sidebar-feedback"
        className="w-full justify-start mb-1 transition-all duration-200 ease-in-out hover:bg-secondary/90 hover:scale-[1.02] active:scale-[0.98]"
        onClick={() => setIsFeedbackModalOpen(true)}
      >
        <MessageSquareWarning className="mr-2 h-4 w-4" />
        Submit Feedback
      </Button>

      {/* Chats Section Header - styled like New Chat button */}
      <div className="w-full mb-2 bg-secondary text-secondary-foreground rounded-md px-4 py-2 text-sm font-medium flex items-center justify-between">
        <span>Chats</span>
        {filterTerm.trim() && (
          <span className="text-xs text-muted-foreground">
            {filteredChats.length}/{chats.length}
          </span>
        )}
      </div>

      {/* Chat Filter Input */}
      <div className="relative mb-2">
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        <Input
          type="text"
          placeholder="Search chats..."
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          className="h-8 text-sm bg-background"
        />
      </div>

      <ScrollArea className="flex-1 pr-1 mt-1">
        <div className="space-y-1">
          {isLoadingChats ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`chat-skeleton-${index}`}
                className="flex items-center p-2 rounded-md mb-1 bg-background/50"
              >
                <Skeleton className="h-7 w-full rounded-md" />
              </div>
            ))
          ) : isSearching ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          ) : filteredChats.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2 text-center">
              {filterTerm.trim() ? 'No chats match your search.' : 'No chats yet.'}
            </p>
          ) : (
            filteredChats.map(chat => (
              <div
                key={chat._id}
                className={cn(
                  'flex items-center group p-2 rounded-md mb-1 shadow-sm transition-colors duration-150 ease-in-out relative',
                  selectedChatId === chat._id
                    ? 'bg-primary hover:bg-primary/90'
                    : 'bg-background hover:bg-accent'
                )}
              >
                {/* --- Icon Group (Absolute Position Left, Visible on Hover) --- */}
                {/* Icons container: Initially hidden, appears on hover */}
                <div
                  className={cn(
                    'absolute left-1 top-1/2 -translate-y-1/2 flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10',
                    // Hide if editing this specific chat
                    editingChatId === chat._id && 'opacity-0 pointer-events-none'
                  )}
                >
                  {/* Edit Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-6 w-6 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-transparent',
                      selectedChatId === chat._id
                        ? 'text-primary-foreground/70 hover:text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={e => {
                      e.stopPropagation();
                      handleStartEdit(chat);
                    }}
                    title={`Edit name for: ${chat.chatName}`}
                  >
                    <Pencil size={13} />
                  </Button>
                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-6 w-6 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-transparent',
                      selectedChatId === chat._id
                        ? 'text-primary-foreground/70 hover:text-destructive-foreground'
                        : 'text-muted-foreground hover:text-destructive'
                    )}
                    onClick={e => {
                      e.stopPropagation();
                      handleConfirmDelete(chat._id);
                    }}
                    title={`Delete chat: ${chat.chatName}`}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
                {/* --- End Icon Group --- */}

                {editingChatId === chat._id ? (
                  // --- EDITING VIEW ---
                  <Input
                    type="text"
                    value={editedName}
                    onChange={handleNameChange}
                    onKeyDown={handleInputKeyDown}
                    onBlur={handleSaveEdit}
                    autoFocus
                    className="h-7 flex-1 text-sm px-2 bg-background focus-visible:ring-primary focus-visible:ring-1"
                  />
                ) : (
                  // --- DISPLAY VIEW ---
                  <Button
                    variant="ghost"
                    className={cn(
                      // Use padding for text, adjust padding left on hover
                      'w-full justify-start text-left h-auto py-0 px-2 overflow-hidden focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-transparent transition-all duration-200 ease-in-out',
                      'group-hover:pl-10', // Add left padding on hover to make space for icons
                      selectedChatId === chat._id ? 'font-semibold' : 'font-normal'
                    )}
                    onClick={() => handleSelectChat(chat._id)}
                  >
                    <div className="flex flex-col w-full min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-sm block truncate whitespace-nowrap flex-1',
                            selectedChatId === chat._id ? 'text-primary-foreground' : 'text-foreground'
                          )}
                          title={chat.chatName}
                        >
                          {chat.chatName}
                        </span>
                        {/* Match type badge for non-title matches */}
                        {filterTerm.trim() && (chat as any)._matchType && (chat as any)._matchType !== 'title' && (
                          <span className={cn(
                            'text-[9px] px-1 py-0.5 rounded flex-shrink-0',
                            (chat as any)._matchType === 'message'
                              ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          )}>
                            {(chat as any)._matchType === 'message' ? 'msg' : 'note'}
                          </span>
                        )}
                      </div>
                      {/* Snippet preview for non-title matches */}
                      {filterTerm.trim() && (chat as any)._snippet && (chat as any)._matchType !== 'title' && (
                        <span className={cn(
                          'text-[10px] truncate mt-0.5',
                          selectedChatId === chat._id
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        )}>
                          {(chat as any)._snippet}
                        </span>
                      )}
                    </div>
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="mt-auto pt-3 pb-[env(safe-area-inset-bottom)] border-t border-border space-y-1">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive transition-all duration-200 ease-in-out active:scale-[0.98]"
                onClick={onDeleteAllChats}
                disabled={isLoadingChats || chats.length === 0}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete All Chats
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              <p>Permanently delete all your chat history.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>


        <Button variant="outline" onClick={onLogoutClick} data-help-id="sidebar-logout" className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>

        <UserStatus user={user} onClick={() => setIsProfileDialogOpen(true)} iconUrl={userIconUrl} />
      </div>

      {/* Add FeedbackModal component at the end of the component */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onOpenChange={setIsFeedbackModalOpen}
        currentChatId={selectedChatId}
      />

      {/* Profile Dialog */}
      <ProfileDialog
        isOpen={isProfileDialogOpen}
        onOpenChange={setIsProfileDialogOpen}
        user={user}
        onLogout={handleLogout}
        onIconUpdate={setUserIconUrl}
        onAvatarToggleChange={setShowAvatarAsLogo}
      />
    </nav>
  );
};

export default Sidebar;
