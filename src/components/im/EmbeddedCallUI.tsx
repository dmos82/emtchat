'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Monitor,
  MonitorOff,
  X,
} from 'lucide-react';
import { useVoiceVideoCall } from '@/contexts/VoiceVideoCallContext';

interface EmbeddedCallUIProps {
  recipientId: string;
  recipientUsername: string;
  onExpandFullscreen?: () => void;
}

/**
 * Embedded video call UI that displays within a chat window.
 * Shows video feeds and minimal controls while allowing chat to continue below.
 */
export const EmbeddedCallUI: React.FC<EmbeddedCallUIProps> = ({
  recipientId,
  recipientUsername,
  onExpandFullscreen,
}) => {
  const {
    activeCall,
    localStream,
    remoteStream,
    screenStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    endCall,
  } = useVoiceVideoCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  // Track if streams have been attached (to force re-render when ref becomes available)
  const [localStreamAttached, setLocalStreamAttached] = useState(false);
  const [remoteStreamAttached, setRemoteStreamAttached] = useState(false);

  // Only render if there's an active call with this recipient
  // Use string comparison to handle potential type mismatches (ObjectId vs string)
  const isCallWithThisRecipient = activeCall &&
    activeCall.peer.id?.toString() === recipientId?.toString();

  // Debug logging - check if IDs match
  if (activeCall) {
    const idsMatch = activeCall.peer?.id === recipientId;
    const idsLooseMatch = activeCall.peer?.id?.toString() === recipientId?.toString();
    console.log('[EmbeddedCallUI] Render check:', {
      recipientId,
      recipientIdType: typeof recipientId,
      hasActiveCall: true,
      activeCallPeerId: activeCall.peer?.id,
      activeCallPeerIdType: typeof activeCall.peer?.id,
      activeCallStatus: activeCall.status,
      idsMatch,
      idsLooseMatch,
      isCallWithThisRecipient,
    });
  }

  // Call duration timer
  useEffect(() => {
    if (!isCallWithThisRecipient) {
      setCallDuration(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isCallWithThisRecipient]);

  // Attach local stream to video element - using ref callback pattern
  const attachLocalStream = React.useCallback((el: HTMLVideoElement | null) => {
    (localVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (el && localStream) {
      if (el.srcObject !== localStream) {
        console.log('[EmbeddedCallUI] Attaching local stream to video element');
        el.srcObject = localStream;
        el.play().catch(err => console.log('[EmbeddedCallUI] Local video play error:', err));
        setLocalStreamAttached(true);
      }
    }
  }, [localStream]);

  // Attach remote stream to video element - using ref callback pattern
  const attachRemoteStream = React.useCallback((el: HTMLVideoElement | null) => {
    (remoteVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (el) {
      const streamToAttach = screenStream || remoteStream;
      if (streamToAttach && el.srcObject !== streamToAttach) {
        console.log('[EmbeddedCallUI] Attaching remote stream to video element:', {
          isScreenStream: !!screenStream,
          streamId: streamToAttach.id,
          tracks: streamToAttach.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
        });
        el.srcObject = streamToAttach;
        el.play().catch(err => console.log('[EmbeddedCallUI] Remote video play error:', err));
        setRemoteStreamAttached(true);
      }
    }
  }, [remoteStream, screenStream]);

  // Also try attaching when streams change (handles case where ref exists but stream arrives later)
  useEffect(() => {
    if (localVideoRef.current && localStream && localVideoRef.current.srcObject !== localStream) {
      console.log('[EmbeddedCallUI] useEffect: Attaching local stream');
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => console.log('[EmbeddedCallUI] Local video play error:', err));
    }
  }, [localStream]);

  useEffect(() => {
    const streamToAttach = screenStream || remoteStream;
    if (remoteVideoRef.current && streamToAttach && remoteVideoRef.current.srcObject !== streamToAttach) {
      console.log('[EmbeddedCallUI] useEffect: Attaching remote stream');
      remoteVideoRef.current.srcObject = streamToAttach;
      remoteVideoRef.current.play().catch(err => console.log('[EmbeddedCallUI] Remote video play error:', err));
    }
  }, [remoteStream, screenStream]);

  // Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenMode) {
        setIsFullscreenMode(false);
      }
    };

    if (isFullscreenMode) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreenMode]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreenMode(prev => !prev);
  }, []);

  if (!isCallWithThisRecipient) {
    return null;
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isVideoCall = activeCall?.callType === 'video';

  return (
    <div className={`bg-[#1a1a1a] ${isFullscreenMode ? 'fixed inset-0 z-50 flex flex-col' : 'border-b border-[#404040]'}`}>
      {/* Video container */}
      <div className={`relative bg-black ${isFullscreenMode ? 'flex-1' : 'aspect-video max-h-[70vh]'}`}>
        {/* Remote video (main) - always render to ensure ref is available */}
        {isVideoCall && (
          <video
            ref={attachRemoteStream}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${!remoteStream ? 'hidden' : ''}`}
          />
        )}

        {/* Avatar placeholder when no remote stream */}
        {(!isVideoCall || !remoteStream) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">
                {recipientUsername.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) - always render when video call */}
        {isVideoCall && (
          <div className={`absolute bottom-4 right-4 rounded-lg overflow-hidden border border-[#404040] shadow-lg ${
            isFullscreenMode ? 'w-48 h-36' : 'w-20 h-14'
          } ${(!localStream || isVideoOff) ? 'hidden' : ''}`}>
            <video
              ref={attachLocalStream}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        )}

        {/* Call status overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium text-white bg-black/60 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {formatDuration(callDuration)}
          </span>
          {isScreenSharing && (
            <span className="px-2 py-1 text-xs font-medium text-white bg-blue-600/80 rounded-full">
              Screen sharing
            </span>
          )}
        </div>

        {/* Fullscreen toggle button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
          title={isFullscreenMode ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        >
          {isFullscreenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Controls bar */}
      <div className={`flex items-center justify-center gap-2 ${isFullscreenMode ? 'py-4 px-6 gap-4' : 'py-2 px-3'}`}>
        {/* Audio toggle */}
        <button
          onClick={toggleAudio}
          className={`${isFullscreenMode ? 'p-3' : 'p-2'} rounded-full transition-colors ${
            isAudioMuted
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-[#2a2a2a] text-slate-300 hover:bg-[#333]'
          }`}
          title={isAudioMuted ? 'Unmute' : 'Mute'}
        >
          {isAudioMuted ? <MicOff className={isFullscreenMode ? 'w-6 h-6' : 'w-4 h-4'} /> : <Mic className={isFullscreenMode ? 'w-6 h-6' : 'w-4 h-4'} />}
        </button>

        {/* Video toggle */}
        {isVideoCall && (
          <button
            onClick={toggleVideo}
            className={`${isFullscreenMode ? 'p-3' : 'p-2'} rounded-full transition-colors ${
              isVideoOff
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-[#2a2a2a] text-slate-300 hover:bg-[#333]'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff className={isFullscreenMode ? 'w-6 h-6' : 'w-4 h-4'} /> : <Video className={isFullscreenMode ? 'w-6 h-6' : 'w-4 h-4'} />}
          </button>
        )}

        {/* Screen share toggle */}
        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          className={`${isFullscreenMode ? 'p-3' : 'p-2'} rounded-full transition-colors ${
            isScreenSharing
              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              : 'bg-[#2a2a2a] text-slate-300 hover:bg-[#333]'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? <MonitorOff className={isFullscreenMode ? 'w-6 h-6' : 'w-4 h-4'} /> : <Monitor className={isFullscreenMode ? 'w-6 h-6' : 'w-4 h-4'} />}
        </button>

        {/* End call */}
        <button
          onClick={endCall}
          className={`${isFullscreenMode ? 'p-3' : 'p-2'} rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors`}
          title="End call"
        >
          <PhoneOff className={isFullscreenMode ? 'w-6 h-6' : 'w-4 h-4'} />
        </button>
      </div>
    </div>
  );
};

export default EmbeddedCallUI;
