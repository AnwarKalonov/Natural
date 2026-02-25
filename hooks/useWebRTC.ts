
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/platformService';

interface WebRTCState {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    status: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
    error: string | null;
    isMuted: boolean;
    isVideoOff: boolean;
}

export const useWebRTC = (chatId: string, currentUserId: string) => {
    const [state, setState] = useState<WebRTCState>({
        localStream: null,
        remoteStream: null,
        status: 'idle',
        error: null,
        isMuted: false,
        isVideoOff: false
    });

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);

    // Initialize peer connection
    const createPeerConnection = useCallback(() => {
        if (peerConnection.current) return peerConnection.current;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate && channelRef.current) {
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'ice-candidate',
                    payload: { candidate: event.candidate, from: currentUserId }
                });
            }
        };

        pc.ontrack = (event) => {
            console.log('Received remote track', event.streams[0]);
            setState(prev => ({ ...prev, remoteStream: event.streams[0], status: 'connected' }));
        };

        peerConnection.current = pc;
        return pc;
    }, [chatId, currentUserId]);

    const startCall = async (isVideo: boolean = true) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
            setState(prev => ({ ...prev, localStream: stream, status: 'calling', isVideoOff: !isVideo }));

            const pc = createPeerConnection();
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Send offer via Supabase Realtime
            if (channelRef.current) {
                await channelRef.current.send({
                    type: 'broadcast',
                    event: 'call-offer',
                    payload: { offer, from: currentUserId, isVideo }
                });
            }
        } catch (err: any) {
            console.error('Error starting call:', err);
            setState(prev => ({ ...prev, error: err.message, status: 'ended' }));
        }
    };

    const answerCall = async (offer: RTCSessionDescriptionInit) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); // Default to video on answer
            setState(prev => ({ ...prev, localStream: stream, status: 'connected' }));

            const pc = createPeerConnection();
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (channelRef.current) {
                await channelRef.current.send({
                    type: 'broadcast',
                    event: 'call-answer',
                    payload: { answer, from: currentUserId }
                });
            }
        } catch (err: any) {
            console.error('Error answering call:', err);
            setState(prev => ({ ...prev, error: err.message, status: 'ended' }));
        }
    };

    const endCall = () => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
        }
        setState(prev => ({ ...prev, localStream: null, remoteStream: null, status: 'ended' }));

        // Notify peer
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'call-end',
                payload: { from: currentUserId }
            });
        }

        setTimeout(() => {
            setState(prev => ({ ...prev, status: 'idle' }));
        }, 2000);
    };

    const toggleMute = () => {
        if (state.localStream) {
            state.localStream.getAudioTracks().forEach(track => track.enabled = !state.isMuted);
            setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
        }
    };

    const toggleVideo = () => {
        if (state.localStream) {
            state.localStream.getVideoTracks().forEach(track => track.enabled = !state.isVideoOff);
            setState(prev => ({ ...prev, isVideoOff: !prev.isVideoOff }));
        }
    };

    // Setup signaling channel
    useEffect(() => {
        if (!chatId) return;

        const channel = supabase.channel(`chat:${chatId}`);

        channel
            .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
                if (payload.from !== currentUserId) {
                    console.log('Incoming call offer', payload);
                    // Automatically answer? No, UI should prompt. 
                    // But for this hook, we expose the offer handling.
                    // We'll update status to 'ringing' and store the offer for the UI to trigger answerCall
                    setState(prev => ({ ...prev, status: 'ringing' }));
                    // Store offer temporarily?
                    // Ideally we pass it up or handle it. 
                    // Let's attach it to a ref or state.
                    (window as any).pendingOffer = payload.offer;
                }
            })
            .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
                if (payload.from !== currentUserId && peerConnection.current) {
                    console.log('Received answer');
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
                }
            })
            .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                if (payload.from !== currentUserId && peerConnection.current) {
                    try {
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } catch (e) {
                        console.error('Error adding received ice candidate', e);
                    }
                }
            })
            .on('broadcast', { event: 'call-end' }, ({ payload }) => {
                if (payload.from !== currentUserId) {
                    endCall(); // Remote ended
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    channelRef.current = channel;
                }
            });

        return () => {
            supabase.removeChannel(channel);
            if (peerConnection.current) {
                peerConnection.current.close();
            }
            if (state.localStream) {
                state.localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [chatId, currentUserId]);

    return {
        ...state,
        startCall,
        answerCall: () => {
            const offer = (window as any).pendingOffer;
            if (offer) answerCall(offer);
        },
        endCall,
        toggleMute,
        toggleVideo
    };
};
