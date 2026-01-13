'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDM, Message, PresenceStatus, Attachment, Conversation } from '@/contexts/DMContext';
import { useVoiceVideoCall } from '@/contexts/VoiceVideoCallContext';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { getApiBaseUrl } from '@/lib/config';
import { LinkifiedText } from '@/utils/linkify';

interface MobileChatViewProps {
  conversationId: string;
  recipientId: string;
  recipientUsername: string;
  recipientIconUrl?: string | null;
  isGroup?: boolean;
  groupName?: string;
  participantUsernames?: string[];
  onBack: () => void;
}

const StatusBadge: React.FC<{ status: PresenceStatus }> = ({ status }) => {
  const colors: Record<PresenceStatus, string> = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${colors[status]} ring-2 ring-[#1e1e1e]`}
    />
  );
};

export const MobileChatView: React.FC<MobileChatViewProps> = ({
  conversationId,
  recipientId,
  recipientUsername,
  recipientIconUrl,
  isGroup = false,
  groupName,
  participantUsernames = [],
  onBack,
}) => {
  const {
    messages: allMessages,
    sendMessage,
    selectConversation,
    typingUsers,
    sendTyping,
    markConversationAsRead,
    conversations,
    onlineUsers,
    uploadAttachment,
    usersInCall,
    isConnected,
  } = useDM();

  const { user } = useAuth();
  const { initiateCall, activeCall } = useVoiceVideoCall();

  const [inputValue, setInputValue] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get conversation object
  const conversation = conversations.find((c: Conversation) =>
    isGroup ? c._id === conversationId : c.otherParticipant?._id === recipientId
  );

  // Get recipient's presence status
  const onlineUser = onlineUsers.find((u) => u._id === recipientId);
  const recipientStatus: PresenceStatus =
    conversation?.otherParticipant?.status ||
    onlineUser?.status ||
    'offline';

  // Check if recipient is in a call
  const isRecipientInCall = usersInCall.has(recipientId);
  const isInActiveCall = activeCall !== null;

  // Typing indicator - check if recipient is typing (for 1-on-1 chats)
  const otherTyping = typingUsers.filter(
    (t) => t.userId === recipientId && t.username !== user?.username
  );

  // Load messages when conversation selected
  useEffect(() => {
    if (conversationId && conversation) {
      selectConversation(conversation);
      markConversationAsRead(conversationId);
      loadMessages();
    }
  }, [conversationId]);

  // Sync messages from context
  useEffect(() => {
    if (!conversationId) return;

    const conversationMessages = allMessages.filter(
      (m: Message & { conversationId?: string }) => (m as any).conversationId === conversationId
    );

    setLocalMessages((prev) => {
      if (conversationMessages.length === 0) return prev;

      const newMessages = conversationMessages.filter(
        (contextMsg) => !prev.some((localMsg) => localMsg._id === contextMsg._id)
      );

      if (newMessages.length > 0) {
        const merged = [...prev];
        newMessages.forEach((msg) => {
          if (!merged.some((m) => m._id === msg._id)) {
            merged.push(msg);
          }
        });
        return merged.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      return prev;
    });
  }, [allMessages, conversationId]);

  const loadMessages = async () => {
    if (!conversationId) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    setIsLoading(true);
    try {
      const API_URL = getApiBaseUrl();
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLocalMessages(data.messages || []);
      }
    } catch (error) {
      console.error('[MobileChatView] Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [localMessages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    if (conversationId) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTyping();
      typingTimeoutRef.current = setTimeout(() => {
        // Typing stopped - context handles this automatically
      }, 2000);
    }
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && pendingAttachments.length === 0) || !conversationId) return;

    setIsSending(true);
    try {
      await sendMessage(inputValue.trim(), pendingAttachments);
      setInputValue('');
      setPendingAttachments([]);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    } catch (error) {
      console.error('[MobileChatView] Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVideoCall = () => {
    if (!recipientId || isInActiveCall || recipientStatus === 'offline') return;
    initiateCall(recipientId, recipientUsername, 'video');
  };

  const handleAudioCall = () => {
    if (!recipientId || isInActiveCall || recipientStatus === 'offline') return;
    initiateCall(recipientId, recipientUsername, 'audio');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    setIsUploading(true);
    try {
      const attachment = await uploadAttachment(file, conversationId);
      if (attachment) {
        setPendingAttachments((prev) => [...prev, attachment]);
      }
    } catch (error) {
      console.error('[MobileChatView] Error uploading file:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatMessageTime = (date: Date | string) => {
    const d = new Date(date);
    if (isToday(d)) {
      return format(d, 'h:mm a');
    } else if (isYesterday(d)) {
      return `Yesterday ${format(d, 'h:mm a')}`;
    }
    return format(d, 'MMM d, h:mm a');
  };

  const formatDateHeader = (date: Date | string) => {
    const d = new Date(date);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, MMMM d, yyyy');
  };

  // Group messages by date
  const groupedMessages = localMessages.reduce<Record<string, Message[]>>((groups, message) => {
    const date = new Date(message.createdAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  const displayName = isGroup ? groupName : recipientUsername;
  const canCall = !isGroup && recipientStatus !== 'offline' && !isInActiveCall && isConnected;

  return (
    <div className="h-full flex flex-col bg-[#212121]">
      {/* Header */}
      <div className="flex-shrink-0 bg-[#1e1e1e] border-b border-[#404040] px-3 py-2 safe-area-inset-top">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-[#2a2a2a] active:bg-[#333] transition-colors"
          >
            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {isGroup ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
              </div>
            ) : recipientIconUrl ? (
              <img
                src={recipientIconUrl}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-slate-800 font-semibold">
                {displayName?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            {!isGroup && <StatusBadge status={recipientStatus} />}
          </div>

          {/* Name and status */}
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white truncate">{displayName}</h1>
            <p className="text-xs text-slate-400 truncate">
              {isGroup ? (
                `${participantUsernames.length} members`
              ) : isRecipientInCall ? (
                <span className="text-green-500">In a call</span>
              ) : recipientStatus === 'online' ? (
                'Active now'
              ) : recipientStatus === 'away' ? (
                'Away'
              ) : recipientStatus === 'busy' ? (
                'Busy'
              ) : (
                'Offline'
              )}
            </p>
          </div>

          {/* Call buttons */}
          {!isGroup && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleAudioCall}
                disabled={!canCall}
                className={`p-2.5 rounded-full transition-colors ${
                  canCall
                    ? 'text-slate-300 hover:bg-[#2a2a2a] active:bg-[#333]'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
                title={!canCall ? (!isConnected ? 'Connecting...' : recipientStatus === 'offline' ? 'User offline' : 'Already in call') : 'Voice call'}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </button>
              <button
                onClick={handleVideoCall}
                disabled={!canCall}
                className={`p-2.5 rounded-full transition-colors ${
                  canCall
                    ? 'text-slate-300 hover:bg-[#2a2a2a] active:bg-[#333]'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
                title={!canCall ? (!isConnected ? 'Connecting...' : recipientStatus === 'offline' ? 'User offline' : 'Already in call') : 'Video call'}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <svg className="animate-spin h-8 w-8 text-yellow-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-[#2a2a2a] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm">No messages yet</p>
            <p className="text-slate-500 text-xs mt-1">Say hello to {displayName}!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 text-xs text-slate-500 bg-[#2a2a2a] rounded-full">
                    {formatDateHeader(dateKey)}
                  </span>
                </div>

                {/* Messages for this date */}
                <div className="space-y-1">
                  {dateMessages.map((message: Message, index: number) => {
                    const isOwnMessage = message.senderId === user?._id;
                    const showAvatar = !isOwnMessage && (
                      index === 0 ||
                      dateMessages[index - 1].senderId !== message.senderId
                    );
                    const showSenderName = isGroup && !isOwnMessage && showAvatar;

                    return (
                      <div
                        key={message._id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-2' : ''}`}
                      >
                        {/* Avatar for received messages */}
                        {!isOwnMessage && (
                          <div className="w-8 flex-shrink-0">
                            {showAvatar && (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-semibold">
                                {message.senderUsername.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}

                        <div className={`max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                          {showSenderName && (
                            <p className="text-xs text-slate-500 mb-0.5 ml-1">{message.senderUsername}</p>
                          )}

                          {/* Message bubble */}
                          <div
                            className={`px-3 py-2 rounded-2xl ${
                              isOwnMessage
                                ? 'bg-yellow-500 text-slate-800 rounded-br-md'
                                : 'bg-[#2a2a2a] text-slate-200 rounded-bl-md'
                            }`}
                          >
                            {/* Attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mb-1 space-y-1">
                                {message.attachments.map((attachment: Attachment, i: number) => (
                                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${
                                    isOwnMessage ? 'bg-yellow-600/30' : 'bg-[#333]'
                                  }`}>
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span className="text-xs truncate flex-1">{attachment.filename}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Message content */}
                            {message.content && (
                              <p className="text-sm whitespace-pre-wrap break-words">
                                <LinkifiedText text={message.content} />
                              </p>
                            )}

                            {/* Timestamp */}
                            <p className={`text-[10px] mt-1 ${
                              isOwnMessage ? 'text-slate-700' : 'text-slate-500'
                            }`}>
                              {formatMessageTime(message.createdAt)}
                              {message.editedAt && ' · Edited'}
                            </p>
                          </div>

                          {/* Reactions */}
                          {message.reactions && message.reactions.length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                              {message.reactions.map((reaction, i: number) => (
                                <span key={i} className="text-xs bg-[#333] px-1.5 py-0.5 rounded-full">
                                  {reaction.emoji} {reaction.users.length}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {otherTyping.length > 0 && (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs">
                  {otherTyping.map((t: { username: string }) => t.username).join(', ')} typing...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="flex-shrink-0 px-3 py-2 bg-[#1e1e1e] border-t border-[#404040]">
          <div className="flex flex-wrap gap-2">
            {pendingAttachments.map((att, index) => (
              <div key={index} className="flex items-center gap-2 bg-[#2a2a2a] px-2 py-1 rounded-lg text-sm">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-slate-300 truncate max-w-[100px]">{att.filename}</span>
                <button
                  onClick={() => removePendingAttachment(index)}
                  className="text-slate-500 hover:text-red-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 bg-[#1e1e1e] border-t border-[#404040] px-3 py-2 safe-area-inset-bottom">
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2.5 rounded-full text-slate-400 hover:bg-[#2a2a2a] active:bg-[#333] transition-colors"
          >
            {isUploading ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />

          {/* Text input */}
          <div className="flex-1 bg-[#2a2a2a] rounded-2xl px-4 py-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full bg-transparent text-white placeholder-slate-500 resize-none focus:outline-none text-sm max-h-24"
              style={{ height: 'auto', minHeight: '20px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
              }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={(!inputValue.trim() && pendingAttachments.length === 0) || isSending}
            className={`p-2.5 rounded-full transition-colors ${
              inputValue.trim() || pendingAttachments.length > 0
                ? 'bg-yellow-500 text-slate-800 hover:bg-yellow-400'
                : 'text-slate-600'
            }`}
          >
            {isSending ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileChatView;
