'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileText, MessageSquare, StickyNote, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface SearchResult {
  _id: string;
  chatName: string;
  matchType: 'title' | 'message' | 'note';
  snippet: string;
  updatedAt: string;
}

interface ChatSearchModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectChat: (chatId: string) => void;
}

const matchTypeConfig = {
  title: {
    icon: FileText,
    label: 'Title',
    color: 'text-blue-500',
  },
  message: {
    icon: MessageSquare,
    label: 'Message',
    color: 'text-green-500',
  },
  note: {
    icon: StickyNote,
    label: 'Note',
    color: 'text-amber-500',
  },
} as const;

export const ChatSearchModal: React.FC<ChatSearchModalProps> = ({
  isOpen,
  onOpenChange,
  onSelectChat,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state when modal closes
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetchWithAuth(`/api/chats/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      } else {
        console.error('[ChatSearchModal] Search failed:', response.status);
        setResults([]);
      }
    } catch (error) {
      console.error('[ChatSearchModal] Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle query changes with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]._id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  }, [results, selectedIndex, onOpenChange]);

  // Scroll selected result into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, results.length]);

  const handleSelectResult = (chatId: string) => {
    onSelectChat(chatId);
    onOpenChange(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="sr-only">Search Chats</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search chats by title, messages, or notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-4"
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Close</span>
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[400px]">
          <div ref={resultsRef} className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {hasSearched ? (
                  <p>No results found for &quot;{query}&quot;</p>
                ) : (
                  <p>Type to search your chats...</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((result, index) => {
                  const config = matchTypeConfig[result.matchType];
                  const Icon = config.icon;

                  return (
                    <button
                      key={result._id}
                      data-index={index}
                      onClick={() => handleSelectResult(result._id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg transition-colors',
                        'hover:bg-accent focus:outline-none',
                        selectedIndex === index && 'bg-accent'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('mt-0.5 flex-shrink-0', config.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-medium text-sm truncate">
                              {result.chatName}
                            </h4>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatDate(result.updatedAt)}
                            </span>
                          </div>
                          {result.matchType !== 'title' && result.snippet && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {result.snippet}
                            </p>
                          )}
                          <span className={cn('text-[10px] mt-1 inline-block', config.color)}>
                            {config.label} match
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ChatSearchModal;
