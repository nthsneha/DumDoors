import { useState, useEffect, useRef } from 'react';

export const useBackgroundMusic = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Create audio element with a sample music URL (you can replace with your own)
        audioRef.current = new Audio('/music.mp3');
        audioRef.current.loop = true;
        audioRef.current.volume = 0.3; // Set to 30% volume

        // Handle audio events
        const audio = audioRef.current;

        const handleCanPlay = () => {
            console.log('Background music loaded');
        };

        const handleError = () => {
            console.log('Background music failed to load - using silence');
        };

        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            audio.pause();
        };
    }, []);

    const toggleMusic = async () => {
        if (!audioRef.current) return;

        try {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                await audioRef.current.play();
                setIsPlaying(true);
            }
        } catch (error) {
            console.log('Could not play background music:', error);
        }
    };

    const toggleMute = () => {
        if (!audioRef.current) return;

        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    return {
        isPlaying,
        isMuted,
        toggleMusic,
        toggleMute
    };
};