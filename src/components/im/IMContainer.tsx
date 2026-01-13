'use client';

import React, { useEffect } from 'react';
import { DMProvider, useDM } from '@/contexts/DMContext';
import { IMProvider, useIM } from '@/contexts/IMContext';
import { VoiceVideoCallProvider } from '@/contexts/VoiceVideoCallContext';
import { IMBuddyList } from './IMBuddyList';
import { IMChatWindow } from './IMChatWindow';
import { IMToggle } from './IMToggle';
import { IncomingCallModal } from './IncomingCallModal';
import { ActiveCallUI } from './ActiveCallUI';

const IMContainerInner: React.FC = () => {
  const { isBuddyListOpen, closeBuddyList, chatWindows } = useIM();
  const { setOpenConversationIds, markConversationAsRead } = useDM();

  // Sync open (non-minimized) chat window IDs with DMContext
  // This allows DMContext to suppress notification badges for conversations
  // that the user is actively viewing in IM windows
  useEffect(() => {
    const openIds = chatWindows
      .filter((w) => !w.isMinimized && w.conversationId)
      .map((w) => w.conversationId as string);
    setOpenConversationIds(openIds);

    // Also mark these conversations as read since user is viewing them
    openIds.forEach((id) => {
      markConversationAsRead(id);
    });
  }, [chatWindows, setOpenConversationIds, markConversationAsRead]);

  return (
    <>
      {/* Toggle button - fixed position bottom right (hidden on mobile - use Messages tab instead) */}
      <div className="hidden md:block fixed bottom-4 right-4 z-40">
        <IMToggle />
      </div>

      {/* Buddy list popup */}
      {isBuddyListOpen && <IMBuddyList onClose={closeBuddyList} />}

      {/* Chat windows */}
      {chatWindows.map((window) => (
        <IMChatWindow
          key={window.id}
          windowId={window.id}
          recipientId={window.recipientId}
          recipientUsername={window.recipientUsername}
          recipientIconUrl={window.recipientIconUrl}
          conversationId={window.conversationId}
          isMinimized={window.isMinimized}
          position={window.position}
          zIndex={window.zIndex}
          isGroup={window.isGroup}
          groupName={window.groupName}
          participantUsernames={window.participantUsernames}
        />
      ))}
    </>
  );
};

// Wrapper that includes call modals with access to IMContext
const IMContainerInnerWithCallModals: React.FC = () => {
  const { openChatWindow } = useIM();

  return (
    <>
      <IMContainerInner />
      {/* Global call UI components - IncomingCallModal can open chat window on desktop */}
      <IncomingCallModal onOpenChatWindow={openChatWindow} />
      <ActiveCallUI />
    </>
  );
};

export const IMContainer: React.FC = () => {
  return (
    <DMProvider>
      <VoiceVideoCallProvider>
        <IMProvider>
          <IMContainerInnerWithCallModals />
        </IMProvider>
      </VoiceVideoCallProvider>
    </DMProvider>
  );
};

export default IMContainer;
