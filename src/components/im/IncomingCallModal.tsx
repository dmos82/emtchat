'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff, Video, User } from 'lucide-react';
import { useVoiceVideoCall } from '@/contexts/VoiceVideoCallContext';
import { useIM } from '@/contexts/IMContext';
import { UserPresence } from '@/contexts/DMContext';

interface IncomingCallModalProps {
  /** Optional callback to open a chat window (for desktop use) */
  onOpenChatWindow?: (user: UserPresence) => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ onOpenChatWindow }) => {
  const { incomingCall, acceptCall, rejectCall } = useVoiceVideoCall();
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile for auto-open chat behavior
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle accepting the call - also opens chat window on desktop
  const handleAcceptCall = useCallback(() => {
    if (!incomingCall) return;

    console.log('[IncomingCallModal] Accepting call from:', incomingCall.callerUsername, 'isMobile:', isMobile);

    // On desktop, open the chat window with this caller so the video shows
    if (!isMobile && onOpenChatWindow) {
      const callerAsUser: UserPresence = {
        _id: incomingCall.callerId,
        username: incomingCall.callerUsername,
        status: 'online' as const,
      };
      console.log('[IncomingCallModal] Opening chat window for caller on desktop');
      onOpenChatWindow(callerAsUser);
    }

    // Accept the call
    acceptCall(incomingCall.callId);
  }, [incomingCall, isMobile, onOpenChatWindow, acceptCall]);

  // Play ringtone when incoming call
  useEffect(() => {
    console.log('[IncomingCallModal] Ringtone effect triggered - incomingCall:', incomingCall ? {
      callId: incomingCall.callId,
      callerId: incomingCall.callerId,
      callerUsername: incomingCall.callerUsername,
      callType: incomingCall.callType,
    } : null);

    if (incomingCall) {
      console.log('[IncomingCallModal] Starting ringtone for call:', incomingCall.callId);

      // Create ringtone audio (using a simple tone for now)
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      let interval: NodeJS.Timeout | null = null;
      let isCleanedUp = false;

      const playRingtone = () => {
        if (isCleanedUp || audioContext.state === 'closed') return;

        try {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          // Classic phone ringtone pattern: two-tone ring
          oscillator.frequency.value = 440; // A4 note
          oscillator.type = 'sine';
          gainNode.gain.value = 0.3;

          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.3);
          console.log('[IncomingCallModal] Ringtone tone played');
        } catch (err) {
          console.error('[IncomingCallModal] Error playing ringtone:', err);
        }
      };

      const startRingtone = async () => {
        // CRITICAL: Handle browser autoplay policy
        // On mobile browsers, AudioContext starts in 'suspended' state
        // and won't play until resumed after a user gesture OR explicit resume() call
        console.log('[IncomingCallModal] AudioContext state:', audioContext.state);

        if (audioContext.state === 'suspended') {
          console.log('[IncomingCallModal] AudioContext suspended, attempting to resume...');
          try {
            await audioContext.resume();
            console.log('[IncomingCallModal] AudioContext resumed successfully, state:', audioContext.state);
          } catch (err) {
            console.error('[IncomingCallModal] Failed to resume AudioContext:', err);
            // Even if resume fails, try to play - might work on some browsers
          }
        }

        if (isCleanedUp) return;

        // Play immediately and then repeat
        playRingtone();
        interval = setInterval(playRingtone, 1500);
      };

      // Start the ringtone (handles async resume)
      startRingtone();

      return () => {
        console.log('[IncomingCallModal] Stopping ringtone - cleanup called');
        isCleanedUp = true;
        if (interval) {
          clearInterval(interval);
        }
        // Close audio context to release resources
        if (audioContext.state !== 'closed') {
          audioContext.close().catch(err => {
            console.log('[IncomingCallModal] Error closing AudioContext:', err);
          });
        }
      };
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 bg-[#212121] flex flex-col items-center justify-between z-[60] safe-area-inset-top safe-area-inset-bottom">
      {/* Top spacer for mobile status bar */}
      <div className="flex-shrink-0 h-16" />

      {/* Caller info - centered */}
      <div className="flex flex-col items-center flex-1 justify-center px-6">
        {/* Animated avatar */}
        <div className="relative mb-6">
          {/* Pulse rings */}
          <div className="absolute inset-0 rounded-full bg-yellow-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-[-8px] rounded-full bg-yellow-500/10 animate-pulse" />

          {/* Avatar */}
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <User className="w-14 h-14 text-slate-800" />
          </div>
        </div>

        {/* Caller name */}
        <h2 className="text-3xl font-semibold text-white mb-3">
          {incomingCall.callerUsername}
        </h2>

        {/* Call type indicator */}
        <div className="flex items-center gap-2 text-slate-400">
          {incomingCall.callType === 'video' ? (
            <>
              <Video className="w-5 h-5" />
              <span className="text-lg">Incoming video call</span>
            </>
          ) : (
            <>
              <Phone className="w-5 h-5" />
              <span className="text-lg">Incoming voice call</span>
            </>
          )}
        </div>

        {/* Ringing animation */}
        <div className="mt-8 flex gap-1">
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      {/* Action buttons - fixed at bottom */}
      <div className="flex-shrink-0 pb-12 pt-8">
        <div className="flex justify-center gap-16">
          {/* Decline button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => rejectCall(incomingCall.callId)}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-red-500/30"
              title="Decline"
            >
              <PhoneOff className="w-8 h-8 text-white" />
            </button>
            <span className="text-sm text-slate-400">Decline</span>
          </div>

          {/* Accept button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAcceptCall}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 active:bg-green-700 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-green-500/30"
              title="Accept"
            >
              {incomingCall.callType === 'video' ? (
                <Video className="w-8 h-8 text-white" />
              ) : (
                <Phone className="w-8 h-8 text-white" />
              )}
            </button>
            <span className="text-sm text-slate-400">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
