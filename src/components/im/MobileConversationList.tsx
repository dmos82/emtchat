'use client';

import React, { useEffect } from 'react';
import { useDM, Conversation, PresenceStatus } from '@/contexts/DMContext';
import { useIM } from '@/contexts/IMContext';
import { formatDistanceToNow } from 'date-fns';

interface MobileConversationListProps {
  onSelectConversation: (conversationId: string, recipientId: string, recipientUsername: string, iconUrl?: string | null, isGroup?: boolean, groupName?: string, participantUsernames?: string[]) => void;
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
      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${colors[status]} ring-2 ring-[#212121]`}
    />
  );
};

export const MobileConversationList: React.FC<MobileConversationListProps> = ({
  onSelectConversation,
}) => {
  const { conversations, onlineUsers, refreshConversations, refreshOnlineUsers, isLoadingConversations, usersInCall } = useDM();

  // Refresh data on mount
  useEffect(() => {
    refreshConversations();
    refreshOnlineUsers();
  }, [refreshConversations, refreshOnlineUsers]);

  // Sort conversations by most recent message
  const sortedConversations = [...conversations].sort((a, b) => {
    const aTime = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt).getTime() : new Date(a.updatedAt).getTime();
    const bTime = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt).getTime() : new Date(b.updatedAt).getTime();
    return bTime - aTime;
  });

  // Get online users who don't have conversations yet
  const usersWithoutConversations = onlineUsers.filter(
    (user) => !conversations.some((conv) => !conv.isGroup && conv.otherParticipant._id === user._id)
  );

  const handleConversationClick = (conv: Conversation) => {
    if (conv.isGroup) {
      onSelectConversation(
        conv._id,
        '', // No single recipient for groups
        '',
        null,
        true,
        conv.groupName,
        conv.participantUsernames
      );
    } else {
      onSelectConversation(
        conv._id,
        conv.otherParticipant._id,
        conv.otherParticipant.username,
        conv.otherParticipant.iconUrl
      );
    }
  };

  const handleUserClick = (user: typeof onlineUsers[0]) => {
    // Start a new conversation with this user
    onSelectConversation(
      '', // No conversation ID yet
      user._id,
      user.username,
      user.iconUrl
    );
  };

  const formatTimestamp = (date: Date | string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: false });
    } catch {
      return '';
    }
  };

  const ConversationItem: React.FC<{ conv: Conversation }> = ({ conv }) => {
    const isGroup = conv.isGroup;
    const displayName = isGroup ? conv.groupName : conv.otherParticipant.username;
    const status = isGroup ? 'online' : conv.otherParticipant.status;
    const iconUrl = isGroup ? null : conv.otherParticipant.iconUrl;
    const isInCall = !isGroup && usersInCall.has(conv.otherParticipant._id);
    const hasUnread = conv.unreadCount > 0;

    return (
      <button
        onClick={() => handleConversationClick(conv)}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
          hasUnread
            ? 'bg-yellow-900/20 border-l-2 border-yellow-500'
            : 'hover:bg-[#2a2a2a] active:bg-[#333]'
        }`}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {isGroup ? (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            </div>
          ) : iconUrl ? (
            <img
              src={iconUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-slate-800 font-semibold text-lg">
              {displayName?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
          {!isGroup && <StatusBadge status={status} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`truncate ${hasUnread ? 'font-bold text-white' : 'font-medium text-slate-200'}`}>
                {displayName}
              </span>
              {isInCall && (
                <svg className="w-4 h-4 text-green-500 animate-pulse flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              )}
            </div>
            {conv.lastMessage?.sentAt && (
              <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                {formatTimestamp(conv.lastMessage.sentAt)}
              </span>
            )}
          </div>

          {/* Last message preview */}
          {conv.lastMessage && (
            <p className={`text-sm truncate ${hasUnread ? 'text-slate-300 font-medium' : 'text-slate-500'}`}>
              {isGroup && conv.lastMessage.senderUsername && (
                <span className="font-medium">{conv.lastMessage.senderUsername}: </span>
              )}
              {conv.lastMessage.content}
            </p>
          )}
        </div>

        {/* Unread badge */}
        {conv.unreadCount > 0 && (
          <span className="min-w-[24px] h-6 px-2 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center flex-shrink-0">
            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
          </span>
        )}
      </button>
    );
  };

  const OnlineUserItem: React.FC<{ user: typeof onlineUsers[0] }> = ({ user }) => {
    const isInCall = usersInCall.has(user._id);

    return (
      <button
        onClick={() => handleUserClick(user)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a2a2a] active:bg-[#333] transition-colors text-left"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {user.iconUrl ? (
            <img
              src={user.iconUrl}
              alt={user.username}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-slate-800 font-semibold text-lg">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <StatusBadge status={user.status} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-200 truncate">{user.username}</span>
            {isInCall && (
              <svg className="w-4 h-4 text-green-500 animate-pulse flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            )}
          </div>
          {user.customStatus && (
            <p className="text-sm text-slate-500 truncate">{user.customStatus}</p>
          )}
        </div>

        {/* Chat icon */}
        <svg
          className="w-5 h-5 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#212121]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1e1e1e] border-b border-[#404040] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h1 className="text-lg font-semibold text-white">Messages</h1>
          </div>
          <button
            onClick={() => {
              refreshConversations();
              refreshOnlineUsers();
            }}
            className="p-2 rounded-lg hover:bg-[#2a2a2a] transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConversations ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-yellow-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : sortedConversations.length === 0 && usersWithoutConversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-slate-400 text-sm">No conversations yet</p>
            <p className="text-slate-500 text-xs mt-1">Start a chat with someone!</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {/* Existing conversations */}
            {sortedConversations.map((conv) => (
              <ConversationItem key={conv._id} conv={conv} />
            ))}

            {/* Online users without conversations */}
            {usersWithoutConversations.length > 0 && (
              <>
                <div className="px-4 py-2 bg-[#1a1a1a]">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Start a new chat
                  </span>
                </div>
                {usersWithoutConversations.map((user) => (
                  <OnlineUserItem key={user._id} user={user} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileConversationList;
