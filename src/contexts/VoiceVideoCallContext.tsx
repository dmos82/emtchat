'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useDM } from './DMContext';

// Types
export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallDirection = 'incoming' | 'outgoing';

export interface CallParticipant {
  id: string;
  username: string;
}

export interface ActiveCall {
  callId: string;
  callType: CallType;
  direction: CallDirection;
  status: CallStatus;
  peer: CallParticipant;
  startedAt: Date;
  connectedAt?: Date;
}

interface VoiceVideoCallContextType {
  // Call state
  activeCall: ActiveCall | null;
  incomingCall: {
    callId: string;
    callType: CallType;
    callerId: string;
    callerUsername: string;
  } | null;

  // Media streams
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream: MediaStream | null;

  // Media controls
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;

  // Call actions
  initiateCall: (targetUserId: string, targetUsername: string, callType: CallType) => void;
  acceptCall: (callId: string) => void;
  rejectCall: (callId: string, reason?: string) => void;
  endCall: () => void;

  // Error state
  callError: string | null;
  clearCallError: () => void;
}

const VoiceVideoCallContext = createContext<VoiceVideoCallContextType | undefined>(undefined);

// ICE servers for NAT traversal
// STUN: Discovers public IP (works for most NATs)
// TURN: Relays traffic when direct connection fails (symmetric NATs, firewalls)
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google STUN servers (free, no auth required)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // OpenRelay TURN servers (free public TURN)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

interface VoiceVideoCallProviderProps {
  children: ReactNode;
}

// Generate unique provider ID for debugging
let providerIdCounter = 0;

export const VoiceVideoCallProvider: React.FC<VoiceVideoCallProviderProps> = ({ children }) => {
  const { socket, isConnected } = useDM();

  // Unique ID for this provider instance (helps debug multiple providers)
  const [providerId] = useState(() => `provider-${++providerIdCounter}`);

  // Debug: Log socket state with more details
  console.log(`[VoiceVideoCall:${providerId}] Provider render - socket:`, !!socket, 'isConnected:', isConnected, 'socketId:', socket?.id || 'none');

  // Call state
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callType: CallType;
    callerId: string;
    callerUsername: string;
  } | null>(null);

  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Media controls
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Error state
  const [callError, setCallError] = useState<string | null>(null);

  // Refs for WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const activeCallRef = useRef<ActiveCall | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    activeCallRef.current = activeCall;
    console.log(`[VoiceVideoCall:${providerId}] activeCall state changed:`, activeCall ? {
      callId: activeCall.callId,
      peerId: activeCall.peer.id,
      peerUsername: activeCall.peer.username,
      status: activeCall.status,
      direction: activeCall.direction,
    } : null);
  }, [activeCall, providerId]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Track if cleanup is in progress to prevent race conditions
  const isCleaningUpRef = useRef(false);
  const lastCleanupTimeRef = useRef<number>(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[VoiceVideoCall] cleanup() called');
    isCleaningUpRef.current = true;
    lastCleanupTimeRef.current = Date.now();

    // Clear disconnect timeout if pending
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }

    // Stop local media tracks (using ref to avoid stale closure)
    const currentStream = localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Stop screen share stream
    const currentScreenStream = screenStreamRef.current;
    if (currentScreenStream) {
      currentScreenStream.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }

    // Close peer connection - be more aggressive about cleanup
    if (peerConnectionRef.current) {
      // Remove all event handlers before closing
      const pc = peerConnectionRef.current;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onicegatheringstatechange = null;
      pc.close();
      peerConnectionRef.current = null;
    }

    // Clear remote stream
    setRemoteStream(null);

    // Reset states
    setActiveCall(null);
    setIncomingCall(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    pendingIceCandidatesRef.current = [];
    originalVideoTrackRef.current = null;

    // Mark cleanup as complete after a short delay to allow state to settle
    setTimeout(() => {
      isCleaningUpRef.current = false;
      console.log('[VoiceVideoCall] cleanup() complete');
    }, 100);
  }, []); // No dependencies - uses refs

  // Force cleanup for starting new calls - ensures previous call is fully cleaned up
  const forceCleanupForNewCall = useCallback(() => {
    console.log('[VoiceVideoCall] forceCleanupForNewCall() - ensuring clean state');

    // Clear any pending disconnect timeout
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }

    // Clear pending ICE candidates from previous call
    pendingIceCandidatesRef.current = [];

    // Force close any existing peer connection
    if (peerConnectionRef.current) {
      console.log('[VoiceVideoCall] Forcing close of existing peer connection');
      const pc = peerConnectionRef.current;
      // Remove all event handlers to prevent callbacks during close
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onicegatheringstatechange = null;
      try {
        pc.close();
      } catch (e) {
        console.log('[VoiceVideoCall] Error closing peer connection:', e);
      }
      peerConnectionRef.current = null;
    }

    // Stop any existing local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Stop any existing screen share
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }

    // Clear remote stream
    setRemoteStream(null);

    // Reset media states
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    originalVideoTrackRef.current = null;

    isCleaningUpRef.current = false;
    console.log('[VoiceVideoCall] forceCleanupForNewCall() complete');
  }, []);

  // Get user media
  const getUserMedia = useCallback(async (callType: CallType): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video',
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (err) {
      console.error('[VoiceVideoCall] Failed to get user media:', err);
      setCallError('Failed to access camera/microphone. Please check permissions.');
      return null;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      const currentCall = activeCallRef.current;
      if (event.candidate && currentCall && socket) {
        console.log('[VoiceVideoCall] Sending ICE candidate');
        socket.emit('call:ice_candidate', {
          callId: currentCall.callId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('[VoiceVideoCall] Received remote track:', {
        trackKind: event.track.kind,
        trackEnabled: event.track.enabled,
        trackReadyState: event.track.readyState,
        streamCount: event.streams?.length || 0,
        streamId: event.streams?.[0]?.id,
      });
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('[VoiceVideoCall] Setting remoteStream with tracks:',
          stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
        );
        setRemoteStream(stream);
      } else {
        console.warn('[VoiceVideoCall] ontrack fired but no streams available');
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[VoiceVideoCall] Connection state:', pc.connectionState);

      // Clear any pending disconnect timeout when we get a state change
      if (disconnectTimeoutRef.current && pc.connectionState !== 'disconnected') {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }

      if (pc.connectionState === 'failed') {
        // Connection failed - end call immediately
        console.log('[VoiceVideoCall] Connection failed - ending call');
        setCallError('Connection failed');
        cleanup();
      } else if (pc.connectionState === 'disconnected') {
        // Disconnected can be temporary - wait 15 seconds before ending
        // This handles temporary network hiccups without dropping the call
        console.log('[VoiceVideoCall] Connection disconnected - waiting for recovery...');
        disconnectTimeoutRef.current = setTimeout(() => {
          // Check if still disconnected after timeout
          if (peerConnectionRef.current?.connectionState === 'disconnected' ||
              peerConnectionRef.current?.connectionState === 'failed') {
            console.log('[VoiceVideoCall] Connection did not recover - ending call');
            setCallError('Connection lost');
            cleanup();
          }
        }, 15000); // 15 second grace period for recovery
      } else if (pc.connectionState === 'connected') {
        console.log('[VoiceVideoCall] Connection established successfully');
      }
    };

    // Handle ICE connection state changes (more granular than connectionState)
    pc.oniceconnectionstatechange = () => {
      console.log('[VoiceVideoCall] ICE connection state:', pc.iceConnectionState, '| Gathering state:', pc.iceGatheringState);

      if (pc.iceConnectionState === 'failed') {
        console.error('[VoiceVideoCall] ICE connection failed - likely NAT/firewall issue');
        // Try to restart ICE
        console.log('[VoiceVideoCall] Attempting ICE restart...');
        pc.restartIce();
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn('[VoiceVideoCall] ICE disconnected - may recover automatically');
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('[VoiceVideoCall] ICE connection established');
      }
    };

    // Log ICE gathering state for debugging
    pc.onicegatheringstatechange = () => {
      console.log('[VoiceVideoCall] ICE gathering state:', pc.iceGatheringState);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, cleanup]);

  // Process pending ICE candidates
  const processPendingIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    for (const candidate of pendingIceCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[VoiceVideoCall] Added pending ICE candidate');
      } catch (err) {
        console.error('[VoiceVideoCall] Failed to add ICE candidate:', err);
      }
    }
    pendingIceCandidatesRef.current = [];
  }, []);

  // Initiate a call
  const initiateCall = useCallback(
    async (targetUserId: string, targetUsername: string, callType: CallType) => {
      console.log('[VoiceVideoCall] initiateCall called with:', {
        targetUserId,
        targetUsername,
        callType,
        hasSocket: !!socket,
        isConnected,
        hasActiveCall: !!activeCall,
        hasIncomingCall: !!incomingCall,
      });

      if (!socket || !isConnected) {
        console.error('[VoiceVideoCall] Cannot initiate call - socket:', !!socket, 'isConnected:', isConnected);
        setCallError('Not connected to server');
        return;
      }

      if (activeCall || incomingCall) {
        console.error('[VoiceVideoCall] Cannot initiate call - already in a call');
        setCallError('Already in a call');
        return;
      }

      // Force cleanup any stale state from previous calls
      forceCleanupForNewCall();

      console.log(`[VoiceVideoCall] Initiating ${callType} call to ${targetUsername}`);

      // Get local media first
      console.log('[VoiceVideoCall] Requesting user media...');
      const stream = await getUserMedia(callType);
      if (!stream) {
        console.error('[VoiceVideoCall] Failed to get user media');
        return;
      }
      console.log('[VoiceVideoCall] Got user media stream:', stream.id);

      // Set both state AND ref immediately (ref needed before socket event arrives)
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Emit call initiate
      console.log('[VoiceVideoCall] Emitting call:initiate to backend...');
      socket.emit('call:initiate', {
        targetUserId,
        callType,
      });
      console.log('[VoiceVideoCall] call:initiate emitted');
    },
    [socket, isConnected, activeCall, incomingCall, getUserMedia, forceCleanupForNewCall]
  );

  // Accept an incoming call
  const acceptCall = useCallback(
    async (callId: string) => {
      if (!socket || !isConnected || !incomingCall) {
        setCallError('Cannot accept call');
        return;
      }

      console.log('[VoiceVideoCall] Accepting call:', callId, '- current incomingCall:', incomingCall);

      // Force cleanup any stale state from previous calls (e.g., if accepting a second call quickly)
      // But preserve the incomingCall state since we need it
      const savedIncomingCall = incomingCall;
      forceCleanupForNewCall();

      // Get local media
      const stream = await getUserMedia(savedIncomingCall.callType);
      if (!stream) return;

      // Set both state AND ref immediately (ref needed before socket event arrives)
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Update state
      console.log('[VoiceVideoCall] Setting activeCall and clearing incomingCall - ringtone should STOP now');
      setActiveCall({
        callId: savedIncomingCall.callId,
        callType: savedIncomingCall.callType,
        direction: 'incoming',
        status: 'connecting',
        peer: {
          id: savedIncomingCall.callerId,
          username: savedIncomingCall.callerUsername,
        },
        startedAt: new Date(),
      });
      setIncomingCall(null);
      console.log('[VoiceVideoCall] incomingCall set to null - emitting call:accept');

      // Emit accept
      socket.emit('call:accept', { callId });
    },
    [socket, isConnected, incomingCall, getUserMedia, forceCleanupForNewCall]
  );

  // Reject an incoming call
  const rejectCall = useCallback(
    (callId: string, reason?: string) => {
      if (!socket) return;

      console.log('[VoiceVideoCall] Rejecting call:', callId);
      socket.emit('call:reject', { callId, reason });
      setIncomingCall(null);
    },
    [socket]
  );

  // End the current call
  const endCall = useCallback(() => {
    if (!socket || !activeCall) return;

    console.log('[VoiceVideoCall] Ending call:', activeCall.callId);
    socket.emit('call:end', { callId: activeCall.callId });
    cleanup();
  }, [socket, activeCall, cleanup]);

  // Toggle audio mute
  const toggleAudio = useCallback(() => {
    if (!localStream || !socket || !activeCall) return;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);

      // Notify peer
      socket.emit('call:toggle_media', {
        callId: activeCall.callId,
        mediaType: 'audio',
        enabled: audioTrack.enabled,
      });
    }
  }, [localStream, socket, activeCall]);

  // Toggle video off
  const toggleVideo = useCallback(() => {
    if (!localStream || !socket || !activeCall) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);

      // Notify peer
      socket.emit('call:toggle_media', {
        callId: activeCall.callId,
        mediaType: 'video',
        enabled: videoTrack.enabled,
      });
    }
  }, [localStream, socket, activeCall]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current || !activeCall || !socket) {
      console.log('[VoiceVideoCall] Cannot start screen share - no peer connection or active call');
      return;
    }

    try {
      console.log('[VoiceVideoCall] Requesting screen share...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // Screen audio typically not supported well cross-browser
      } as DisplayMediaStreamOptions);

      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) {
        console.error('[VoiceVideoCall] No video track in screen stream');
        return;
      }

      // Store the original video track so we can restore it later
      const pc = peerConnectionRef.current;
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && sender.track) {
        originalVideoTrackRef.current = sender.track;
        // Replace the video track with the screen track
        await sender.replaceTrack(screenTrack);
        console.log('[VoiceVideoCall] Replaced video track with screen track');
      }

      // Handle when user stops sharing via browser UI
      screenTrack.onended = () => {
        console.log('[VoiceVideoCall] Screen share ended by user');
        stopScreenShare();
      };

      // Store the screen stream
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Notify peer
      socket.emit('call:toggle_media', {
        callId: activeCall.callId,
        mediaType: 'screen',
        enabled: true,
      });

      console.log('[VoiceVideoCall] Screen sharing started');
    } catch (err) {
      console.error('[VoiceVideoCall] Failed to start screen share:', err);
      // User likely cancelled - don't show error unless it's a real error
      if ((err as Error).name !== 'NotAllowedError') {
        setCallError('Failed to share screen. Please try again.');
      }
    }
  }, [activeCall, socket]);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (!peerConnectionRef.current || !screenStreamRef.current) {
      return;
    }

    console.log('[VoiceVideoCall] Stopping screen share...');

    // Stop the screen share tracks
    screenStreamRef.current.getTracks().forEach(track => track.stop());

    // Restore the original video track
    const pc = peerConnectionRef.current;
    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
    if (sender && originalVideoTrackRef.current) {
      sender.replaceTrack(originalVideoTrackRef.current)
        .then(() => {
          console.log('[VoiceVideoCall] Restored original video track');
        })
        .catch(err => {
          console.error('[VoiceVideoCall] Failed to restore video track:', err);
        });
    }

    // Clear state
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
    originalVideoTrackRef.current = null;

    // Notify peer
    if (socket && activeCall) {
      socket.emit('call:toggle_media', {
        callId: activeCall.callId,
        mediaType: 'screen',
        enabled: false,
      });
    }

    console.log('[VoiceVideoCall] Screen sharing stopped');
  }, [socket, activeCall]);

  // Clear call error
  const clearCallError = useCallback(() => {
    setCallError(null);
  }, []);

  // Socket event handlers
  useEffect(() => {
    console.log(`[VoiceVideoCall:${providerId}] Socket event handlers useEffect - socket:`, !!socket, 'socketId:', socket?.id, 'connected:', socket?.connected);
    if (!socket) {
      console.log(`[VoiceVideoCall:${providerId}] No socket, skipping event handler registration`);
      return;
    }
    console.log(`[VoiceVideoCall:${providerId}] Registering socket event handlers for socket:`, socket.id);

    // Call initiated successfully (for caller)
    const handleCallInitiated = (data: {
      callId: string;
      targetUserId: string;
      targetUsername: string;
      callType: CallType;
    }) => {
      console.log(`[VoiceVideoCall:${providerId}] Call initiated - setting activeCall:`, {
        callId: data.callId,
        targetUserId: data.targetUserId,
        targetUsername: data.targetUsername,
        callType: data.callType,
      });
      const newActiveCall = {
        callId: data.callId,
        callType: data.callType,
        direction: 'outgoing' as CallDirection,
        status: 'ringing' as CallStatus,
        peer: {
          id: data.targetUserId,
          username: data.targetUsername,
        },
        startedAt: new Date(),
      };
      console.log(`[VoiceVideoCall:${providerId}] New activeCall object:`, JSON.stringify(newActiveCall));
      setActiveCall(newActiveCall);
    };

    // Incoming call (for receiver)
    const handleIncomingCall = (data: {
      callId: string;
      callerId: string;
      callerUsername: string;
      callType: CallType;
    }) => {
      console.log(`[VoiceVideoCall:${providerId}] Incoming call received:`, data);
      // Use ref to get current activeCall (avoids stale closure)
      const currentActiveCall = activeCallRef.current;
      if (currentActiveCall) {
        // Already in a call, auto-reject
        console.log(`[VoiceVideoCall:${providerId}] Rejecting incoming call - already in a call`);
        socket.emit('call:reject', { callId: data.callId, reason: 'busy' });
        return;
      }
      console.log(`[VoiceVideoCall:${providerId}] Setting incomingCall state - this will trigger ringtone`);
      setIncomingCall(data);
    };

    // Call accepted - time to start WebRTC (for caller only)
    const handleCallAccepted = async (data: { callId: string; acceptedAt?: string }) => {
      console.log(`[VoiceVideoCall:${providerId}] Call accepted:`, data);

      // IMPORTANT: Update status FIRST, before any early returns
      // This ensures the UI transitions from "Ringing..." to "Connecting..." immediately
      setActiveCall((prev) => {
        console.log(`[VoiceVideoCall:${providerId}] handleCallAccepted setActiveCall - prev:`, prev);
        if (!prev) {
          console.log(`[VoiceVideoCall:${providerId}] No previous activeCall, returning null`);
          return null;
        }

        // If this is the receiver (incoming call), they already have activeCall set
        // Just update the connectedAt timestamp but don't process further
        if (prev.direction === 'incoming') {
          console.log(`[VoiceVideoCall:${providerId}] Receiver got call:accepted, waiting for offer`);
          return prev;
        }

        // For caller: update status to connecting (stops "Ringing..." display)
        console.log(`[VoiceVideoCall:${providerId}] Caller updating status from '${prev.status}' to 'connecting'`);
        return {
          ...prev,
          status: 'connecting',
          connectedAt: data.acceptedAt ? new Date(data.acceptedAt) : new Date(),
        };
      });

      // Use ref to get the current stream (avoids stale closure)
      const currentLocalStream = localStreamRef.current;
      if (!currentLocalStream) {
        console.error('[VoiceVideoCall] No local stream when call accepted');
        return;
      }

      // Use the ref to get the current activeCall value (avoids stale closure)
      const currentActiveCall = activeCallRef.current;
      if (!currentActiveCall || currentActiveCall.direction !== 'outgoing') {
        console.log('[VoiceVideoCall] Not the caller, skipping offer creation');
        return;
      }

      // Clear any stale ICE candidates from previous calls
      pendingIceCandidatesRef.current = [];

      // Close any existing peer connection before creating new one
      if (peerConnectionRef.current) {
        console.log('[VoiceVideoCall] Closing stale peer connection before creating new one');
        const oldPc = peerConnectionRef.current;
        oldPc.onicecandidate = null;
        oldPc.ontrack = null;
        oldPc.onconnectionstatechange = null;
        oldPc.oniceconnectionstatechange = null;
        oldPc.onicegatheringstatechange = null;
        oldPc.close();
        peerConnectionRef.current = null;
      }

      // Create peer connection and add tracks
      const pc = createPeerConnection();
      currentLocalStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentLocalStream);
      });

      // Create and send offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('call:offer', {
          callId: data.callId,
          sdp: offer,
        });
        console.log('[VoiceVideoCall] Offer sent');
      } catch (err) {
        console.error('[VoiceVideoCall] Failed to create offer:', err);
        setCallError('Failed to establish connection');
        cleanup();
      }
    };

    // Received offer (for receiver)
    const handleOffer = async (data: { callId: string; sdp: RTCSessionDescriptionInit }) => {
      console.log('[VoiceVideoCall] Received offer');

      // Use ref to get the current stream (avoids stale closure)
      const currentLocalStream = localStreamRef.current;
      if (!currentLocalStream) {
        console.error('[VoiceVideoCall] No local stream when receiving offer');
        return;
      }

      // Clear any stale ICE candidates from previous calls
      pendingIceCandidatesRef.current = [];

      // Close any existing peer connection before creating new one
      if (peerConnectionRef.current) {
        console.log('[VoiceVideoCall] Closing stale peer connection before creating new one');
        const oldPc = peerConnectionRef.current;
        oldPc.onicecandidate = null;
        oldPc.ontrack = null;
        oldPc.onconnectionstatechange = null;
        oldPc.oniceconnectionstatechange = null;
        oldPc.onicegatheringstatechange = null;
        oldPc.close();
        peerConnectionRef.current = null;
      }

      // Create peer connection and add tracks
      const pc = createPeerConnection();
      currentLocalStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentLocalStream);
      });

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

        // Process any pending ICE candidates
        await processPendingIceCandidates();

        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('call:answer', {
          callId: data.callId,
          sdp: answer,
        });

        setActiveCall((prev) => (prev ? { ...prev, status: 'connected', connectedAt: new Date() } : null));
      } catch (err) {
        console.error('[VoiceVideoCall] Failed to handle offer:', err);
        setCallError('Failed to establish connection');
        cleanup();
      }
    };

    // Received answer (for caller)
    const handleAnswer = async (data: { callId: string; sdp: RTCSessionDescriptionInit }) => {
      console.log('[VoiceVideoCall] Received answer');

      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('[VoiceVideoCall] No peer connection when receiving answer');
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

        // Process any pending ICE candidates
        await processPendingIceCandidates();

        setActiveCall((prev) => (prev ? { ...prev, status: 'connected', connectedAt: new Date() } : null));
      } catch (err) {
        console.error('[VoiceVideoCall] Failed to handle answer:', err);
        setCallError('Failed to establish connection');
        cleanup();
      }
    };

    // Received ICE candidate
    const handleIceCandidate = async (data: {
      callId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      console.log('[VoiceVideoCall] Received ICE candidate');

      const pc = peerConnectionRef.current;
      if (!pc) {
        // Store for later if peer connection not ready
        pendingIceCandidatesRef.current.push(data.candidate);
        return;
      }

      if (!pc.remoteDescription) {
        // Store for later if remote description not set
        pendingIceCandidatesRef.current.push(data.candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('[VoiceVideoCall] Failed to add ICE candidate:', err);
      }
    };

    // Call rejected
    const handleCallRejected = (data: { callId: string; reason?: string }) => {
      console.log('[VoiceVideoCall] Call rejected:', data);
      const currentCall = activeCallRef.current;
      const peerName = currentCall?.peer?.username || 'User';

      // Map reasons to user-friendly messages
      let errorMessage: string;
      switch (data.reason) {
        case 'busy':
          errorMessage = `${peerName} is on another call`;
          break;
        case 'offline':
          errorMessage = `${peerName} is offline`;
          break;
        case 'Call declined':
        case 'declined':
          errorMessage = `${peerName} declined the call`;
          break;
        default:
          errorMessage = `${peerName} declined the call`;
      }

      setCallError(errorMessage);
      cleanup();
    };

    // Call ended
    const handleCallEnded = (data: { callId: string; duration?: number }) => {
      console.log('[VoiceVideoCall] Call ended:', data);
      cleanup();
    };

    // Call timeout
    const handleCallTimeout = (data: { callId: string }) => {
      console.log('[VoiceVideoCall] Call timeout:', data);
      const currentCall = activeCallRef.current;
      const peerName = currentCall?.peer?.username || 'User';
      setCallError(`${peerName} didn't answer`);
      cleanup();
    };

    // Call error
    const handleCallError = (data: { error: string }) => {
      console.error('[VoiceVideoCall] Call error:', data);
      setCallError(data.error);
      cleanup();
    };

    // Peer media toggle
    const handleMediaToggled = (data: {
      callId: string;
      mediaType: 'audio' | 'video';
      enabled: boolean;
      userId: string;
    }) => {
      console.log('[VoiceVideoCall] Peer toggled media:', data);
      // Could update UI to show peer muted/video off state
    };

    // Register listeners
    socket.on('call:initiated', handleCallInitiated);
    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice_candidate', handleIceCandidate);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:timeout', handleCallTimeout);
    socket.on('call:error', handleCallError);
    socket.on('call:media_toggled', handleMediaToggled);

    return () => {
      socket.off('call:initiated', handleCallInitiated);
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice_candidate', handleIceCandidate);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:timeout', handleCallTimeout);
      socket.off('call:error', handleCallError);
      socket.off('call:media_toggled', handleMediaToggled);
    };
  // Note: localStream removed from deps - using localStreamRef.current in handlers
  // to avoid race condition where handlers are unregistered when stream is set
  }, [socket, createPeerConnection, processPendingIceCandidates, cleanup, providerId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Handle browser navigation (back button, page close, etc.)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // End the call on server before page unloads
      const currentCall = activeCallRef.current;
      if (currentCall && socket) {
        console.log('[VoiceVideoCall] Page unloading, ending call');
        socket.emit('call:end', { callId: currentCall.callId });
      }
      cleanup();
    };

    // Note: We intentionally do NOT end calls on visibilitychange (tab switch)
    // Users should be able to switch tabs while on a call. The call only ends when:
    // 1. User clicks "End Call" button
    // 2. User closes/navigates away from the page (beforeunload)
    // 3. WebRTC connection fails/disconnects
    // 4. Other party ends the call

    const handlePopState = () => {
      // Handle browser back/forward navigation (actual page change within the app)
      const currentCall = activeCallRef.current;
      if (currentCall && socket) {
        console.log('[VoiceVideoCall] Browser navigation detected, ending call');
        socket.emit('call:end', { callId: currentCall.callId });
        cleanup();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [socket, cleanup]);

  // Clear any stale call state when socket reconnects
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log('[VoiceVideoCall] Socket connected/reconnected, clearing any stale call state');
      // Clear local call state on reconnection since backend may have different state
      const currentCall = activeCallRef.current;
      if (currentCall) {
        console.log('[VoiceVideoCall] Had active call during reconnect, cleaning up');
        cleanup();
      }
    };

    socket.on('connect', handleConnect);

    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, cleanup]);

  const value: VoiceVideoCallContextType = {
    activeCall,
    incomingCall,
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
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    callError,
    clearCallError,
  };

  return (
    <VoiceVideoCallContext.Provider value={value}>{children}</VoiceVideoCallContext.Provider>
  );
};

// Hook to use the context
export const useVoiceVideoCall = () => {
  const context = useContext(VoiceVideoCallContext);
  if (context === undefined) {
    throw new Error('useVoiceVideoCall must be used within a VoiceVideoCallProvider');
  }
  return context;
};
