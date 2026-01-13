'use client';

import React, { useState, useCallback } from 'react';
import { useDM, Conversation } from '@/contexts/DMContext';
import { MobileConversationList } from './MobileConversationList';
import { MobileChatView } from './MobileChatView';

interface ActiveChat {
  conversationId: string;
  recipientId: string;
  recipientUsername: string;
  recipientIconUrl?: string | null;
  isGroup?: boolean;
  groupName?: string;
  participantUsernames?: string[];
}

/**
 * Mobile-specific IM container with Messenger-style UX:
 * 1. Full-screen conversation list (when no chat is open)
 * 2. Full-screen chat view (when a conversation is selected)
 * Note: Call overlays (IncomingCallModal, ActiveCallUI) are rendered by page.tsx
 *       outside tab panels so calls persist across tab switches
 */
export const MobileIMContainer: React.FC = () => {
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const { createConversation } = useDM();

  // Handle selecting a conversation from the list
  const handleSelectConversation = useCallback(async (
    conversationId: string,
    recipientId: string,
    recipientUsername: string,
    iconUrl?: string | null,
    isGroup?: boolean,
    groupName?: string,
    participantUsernames?: string[]
  ) => {
    // If no conversationId, we need to create or find the conversation
    let finalConversationId = conversationId;

    if (!finalConversationId && recipientId) {
      // Create or get existing conversation
      try {
        const conv: Conversation = await createConversation(recipientId, recipientUsername);
        finalConversationId = conv._id;
      } catch (error) {
        console.error('[MobileIMContainer] Error creating conversation:', error);
        return;
      }
    }

    if (!finalConversationId) {
      console.error('[MobileIMContainer] No conversation ID available');
      return;
    }

    setActiveChat({
      conversationId: finalConversationId,
      recipientId,
      recipientUsername,
      recipientIconUrl: iconUrl,
      isGroup,
      groupName,
      participantUsernames,
    });
  }, [createConversation]);

  // Handle going back to conversation list
  const handleBack = useCallback(() => {
    setActiveChat(null);
  }, []);

  return (
    <div className="h-full relative bg-[#212121]">
      {/* Main content - either conversation list or chat view */}
      {activeChat ? (
        <MobileChatView
          conversationId={activeChat.conversationId}
          recipientId={activeChat.recipientId}
          recipientUsername={activeChat.recipientUsername}
          recipientIconUrl={activeChat.recipientIconUrl}
          isGroup={activeChat.isGroup}
          groupName={activeChat.groupName}
          participantUsernames={activeChat.participantUsernames}
          onBack={handleBack}
        />
      ) : (
        <MobileConversationList onSelectConversation={handleSelectConversation} />
      )}
    </div>
  );
};

export default MobileIMContainer;
