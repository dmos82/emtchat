'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  User,
  Maximize2,
  Minimize2,
  GripHorizontal,
  Monitor,
  MonitorOff,
} from 'lucide-react';
import { useVoiceVideoCall } from '@/contexts/VoiceVideoCallContext';

export const ActiveCallUI: React.FC = () => {
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
    callError,
    clearCallError,
  } = useVoiceVideoCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drag state (desktop only)
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // On mobile, always fullscreen
  const effectiveFullscreen = isMobile || isFullscreen;

  // Auto-hide controls on mobile after 5 seconds of inactivity
  useEffect(() => {
    if (!isMobile || !effectiveFullscreen) {
      setShowControls(true);
      return;
    }

    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    };

    resetControlsTimeout();

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isMobile, effectiveFullscreen, isAudioMuted, isVideoOff, isScreenSharing]);

  const handleTapToShowControls = () => {
    if (isMobile && !showControls) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }
  };

  // Initialize position to bottom-right corner (desktop)
  useEffect(() => {
    if (typeof window !== 'undefined' && !effectiveFullscreen && !isMobile) {
      setPosition({
        x: window.innerWidth - 400 - 16,
        y: window.innerHeight - 500 - 80,
      });
    }
  }, [effectiveFullscreen, isMobile]);

  // Handle drag start (desktop only)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (effectiveFullscreen || isMobile) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [effectiveFullscreen, isMobile, position]
  );

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      let newX = dragStartRef.current.posX + deltaX;
      let newY = dragStartRef.current.posY + deltaY;

      const maxX = window.innerWidth - 400;
      const maxY = window.innerHeight - 500;
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Attach local stream to video element
  useEffect(() => {
    const attachStream = () => {
      const videoEl = localVideoRef.current;
      if (videoEl && localStream) {
        if (videoEl.srcObject !== localStream) {
          console.log('[ActiveCallUI] Attaching local stream to video element');
          videoEl.srcObject = localStream;
        }
        if (videoEl.paused) {
          videoEl.play().catch((err) => {
            console.log('[ActiveCallUI] Local video autoplay blocked:', err);
          });
        }
        return true;
      }
      return false;
    };

    if (!attachStream()) {
      const retryTimeout = setTimeout(attachStream, 100);
      return () => clearTimeout(retryTimeout);
    }
  }, [localStream, activeCall]);

  // Ref callback for local video
  const handleLocalVideoRef = useCallback((el: HTMLVideoElement | null) => {
    (localVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (el && localStream && el.srcObject !== localStream) {
      console.log('[ActiveCallUI] Attaching local stream via ref callback');
      el.srcObject = localStream;
      el.play().catch((err) => {
        console.log('[ActiveCallUI] Local video play failed:', err);
      });
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    const streamToAttach = screenStream || remoteStream;
    if (videoEl && streamToAttach && videoEl.srcObject !== streamToAttach) {
      console.log('[ActiveCallUI] Attaching remote stream to video element');
      videoEl.srcObject = streamToAttach;
      videoEl.play().catch((err) => {
        console.log('[ActiveCallUI] Remote video play failed:', err);
      });
    }
  }, [remoteStream, screenStream]);

  // Ref callback for remote video (handles race condition where element mounts after stream arrives)
  const handleRemoteVideoRef = useCallback((el: HTMLVideoElement | null) => {
    (remoteVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    const streamToAttach = screenStream || remoteStream;
    if (el && streamToAttach && el.srcObject !== streamToAttach) {
      console.log('[ActiveCallUI] Attaching remote stream via ref callback');
      el.srcObject = streamToAttach;
      el.play().catch((err) => {
        console.log('[ActiveCallUI] Remote video play failed:', err);
      });
    }
  }, [remoteStream, screenStream]);

  // Call duration timer
  useEffect(() => {
    if (activeCall?.status === 'connected' && activeCall.connectedAt) {
      const interval = setInterval(() => {
        const start = new Date(activeCall.connectedAt!).getTime();
        const now = Date.now();
        setCallDuration(Math.floor((now - start) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCallDuration(0);
    }
  }, [activeCall?.status, activeCall?.connectedAt]);

  // Format duration as mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status text
  const getStatusText = (): string => {
    if (!activeCall) return '';
    switch (activeCall.status) {
      case 'ringing':
        return activeCall.direction === 'outgoing' ? 'Ringing...' : 'Incoming call...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return formatDuration(callDuration);
      case 'ended':
        return 'Call ended';
      default:
        return '';
    }
  };

  if (!activeCall) return null;

  // On desktop, the call is embedded in the chat window via EmbeddedCallUI
  // Only show this floating/fullscreen UI on mobile
  if (!isMobile) return null;

  const isVideoCall = activeCall.callType === 'video';

  // Determine positioning style
  const positionStyle = effectiveFullscreen
    ? {}
    : {
        left: `${position.x}px`,
        top: `${position.y}px`,
      };

  return (
    <div
      ref={containerRef}
      style={positionStyle}
      onClick={handleTapToShowControls}
      className={`fixed ${
        effectiveFullscreen
          ? 'inset-0'
          : 'w-96 h-[500px] rounded-2xl'
      } bg-[#212121] z-[55] shadow-2xl ${!effectiveFullscreen ? 'border border-[#404040]' : ''} overflow-hidden flex flex-col ${
        isDragging ? 'cursor-grabbing' : ''
      }`}
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between p-4 ${
          effectiveFullscreen && isMobile
            ? `transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'} absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent safe-area-inset-top`
            : 'bg-[#1e1e1e]/80'
        } ${!effectiveFullscreen ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-center gap-3">
          {!effectiveFullscreen && !isMobile && (
            <GripHorizontal className="w-4 h-4 text-slate-500 mr-1" />
          )}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
            <User className="w-5 h-5 text-slate-800" />
          </div>
          <div>
            <h3 className="text-white font-medium">{activeCall.peer.username}</h3>
            <p className="text-sm text-slate-400">{getStatusText()}</p>
          </div>
        </div>
        {!isMobile && (
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-[#2a2a2a] rounded-lg transition"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-slate-400" />
            ) : (
              <Maximize2 className="w-5 h-5 text-slate-400" />
            )}
          </button>
        )}
      </div>

      {/* Video/Audio area */}
      <div className="flex-1 relative bg-[#1a1a1a] min-h-0">
        {isVideoCall ? (
          <>
            {/* Remote video (main) */}
            <video
              ref={handleRemoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full ${effectiveFullscreen ? 'object-contain' : 'object-cover'}`}
            />

            {/* Local video (picture-in-picture) */}
            <div className={`absolute ${isMobile ? 'top-16 right-4 w-24 h-32' : 'bottom-4 right-4 w-32 h-24'} rounded-lg overflow-hidden bg-[#212121] border border-[#404040] shadow-lg z-10`}>
              <video
                ref={handleLocalVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff && !isScreenSharing ? 'hidden' : ''}`}
              />
              {isVideoOff && !isScreenSharing && (
                <div className="w-full h-full flex items-center justify-center bg-[#2a2a2a]">
                  <VideoOff className="w-8 h-8 text-slate-500" />
                </div>
              )}
              {isScreenSharing && (
                <div className="absolute bottom-1 left-1 right-1 bg-blue-500/90 text-white text-xs px-2 py-0.5 rounded text-center">
                  <Monitor className="w-3 h-3 inline mr-1" />
                  Sharing
                </div>
              )}
            </div>

            {/* No video from remote yet */}
            {!remoteStream && activeCall.status !== 'connected' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center mb-4 animate-pulse">
                    <User className="w-14 h-14 text-slate-800" />
                  </div>
                  <p className="text-slate-400 text-lg">{getStatusText()}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Audio call - show avatar */
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center mb-4">
                <User className="w-16 h-16 text-slate-800" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                {activeCall.peer.username}
              </h2>
              <p className="text-slate-400">{getStatusText()}</p>
              {/* Hidden audio element for remote stream */}
              <audio ref={remoteVideoRef as React.RefObject<HTMLAudioElement>} autoPlay />
            </div>
          </div>
        )}

        {/* Error display */}
        {callError && (
          <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg flex items-center justify-between z-20">
            <span>{callError}</span>
            <button onClick={clearCallError} className="text-white/80 hover:text-white">
              &times;
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`p-4 ${
        effectiveFullscreen && isMobile
          ? `transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'} absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/60 to-transparent pb-8 safe-area-inset-bottom`
          : 'bg-[#1e1e1e]/80'
      }`}>
        <div className="flex justify-center gap-4">
          {/* Mute button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={toggleAudio}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isAudioMuted
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-[#2a2a2a] hover:bg-[#333]'
              }`}
              title={isAudioMuted ? 'Unmute' : 'Mute'}
            >
              {isAudioMuted ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>
            {isMobile && <span className="text-xs text-slate-400">{isAudioMuted ? 'Unmute' : 'Mute'}</span>}
          </div>

          {/* Video toggle (only for video calls) */}
          {isVideoCall && (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={toggleVideo}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                  isVideoOff
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#2a2a2a] hover:bg-[#333]'
                }`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? (
                  <VideoOff className="w-6 h-6 text-white" />
                ) : (
                  <Video className="w-6 h-6 text-white" />
                )}
              </button>
              {isMobile && <span className="text-xs text-slate-400">{isVideoOff ? 'Camera' : 'Camera'}</span>}
            </div>
          )}

          {/* Screen share toggle (desktop only, when connected) */}
          {isVideoCall && activeCall?.status === 'connected' && !isMobile && (
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isScreenSharing
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-[#2a2a2a] hover:bg-[#333]'
              }`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {isScreenSharing ? (
                <MonitorOff className="w-6 h-6 text-white" />
              ) : (
                <Monitor className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          {/* End call button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-red-500/30"
              title="End call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
            {isMobile && <span className="text-xs text-slate-400">End</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveCallUI;
