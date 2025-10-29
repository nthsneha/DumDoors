import { useState, useEffect, useRef } from 'react';

export const useBackgroundMusic = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element with a sample music URL (you can replace with your own)
    audioRef.current = new Audio('/music/theme_song.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3; // Set to 30% volume

    // Handle audio events
    const audio = audioRef.current;

    const handleCanPlay = async () => {
      console.log('Background music loaded');
      setIsLoaded(true);

      // Auto-play music when loaded
      try {
        await audio.play();
        console.log('Background music started automatically');
      } catch (error) {
        console.log('Auto-play blocked by browser, music will start on user interaction:', error);
      }
    };

    const handleError = () => {
      console.log('Background music failed to load - using silence');
      setIsLoaded(false);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, []);

  // Auto-start music on first user interaction if not already playing
  useEffect(() => {
    const startMusicOnInteraction = async () => {
      if (!audioRef.current || !isLoaded) return;

      try {
        if (audioRef.current.paused) {
          await audioRef.current.play();
          console.log('Background music started on user interaction');
        }
      } catch (error) {
        console.log('Could not start background music:', error);
      }
    };

    // Add event listeners for user interaction
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach((event) => {
      document.addEventListener(event, startMusicOnInteraction, { once: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, startMusicOnInteraction);
      });
    };
  }, [isLoaded]);

  const toggleMute = () => {
    if (!audioRef.current) return;

    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return {
    isMuted,
    isLoaded,
    toggleMute,
  };
};
