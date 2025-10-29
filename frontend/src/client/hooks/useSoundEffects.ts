import { useState, useRef, useCallback, useEffect } from 'react';

interface SoundEffects {
  badDoor: HTMLAudioElement;
  greatDoor: HTMLAudioElement;
  okay: HTMLAudioElement;
}

export const useSoundEffects = () => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const soundsRef = useRef<SoundEffects | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasShownMissingFilesWarning, setHasShownMissingFilesWarning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize sound effects
  const initializeSounds = useCallback(() => {
    if (soundsRef.current || isInitialized) return;
    
    setIsInitialized(true);
    console.log('🔊 Initializing sound effects...');

    try {
      const sounds = {
        badDoor: new Audio('/sounds/bad_door.mp3'),
        greatDoor: new Audio('/sounds/great_door.mp3'),
        okay: new Audio('/sounds/okay.mp3'),
      };

      // Set volume and handle load events for each sound
      let loadedCount = 0;
      let errorCount = 0;
      const totalSounds = Object.keys(sounds).length;

      Object.entries(sounds).forEach(([key, audio]) => {
        audio.volume = 0.7; // Increased volume for better audibility
        audio.preload = 'auto';

        // Handle successful load
        const onCanPlay = () => {
          console.log(`✅ Sound effect ${key} loaded successfully`);
          loadedCount++;
          if (loadedCount + errorCount === totalSounds) {
            if (loadedCount > 0) {
              setIsLoaded(true);
              console.log(`🎵 ${loadedCount}/${totalSounds} sound effects loaded successfully`);
            } else {
              setIsLoaded(false);
              console.log('❌ No sound effects could be loaded');
            }
          }
        };

        // Handle load errors
        const onError = (e: Event) => {
          console.error(`❌ Sound effect ${key} failed to load:`, e);
          errorCount++;
          if (loadedCount + errorCount === totalSounds) {
            if (loadedCount > 0) {
              setIsLoaded(true);
              console.log(`🎵 ${loadedCount}/${totalSounds} sound effects loaded successfully`);
            } else {
              setIsLoaded(false);
              if (!hasShownMissingFilesWarning) {
                console.log('ℹ️ Sound effects disabled - MP3 files not found in /public/sounds/');
                console.log('📁 Add bad_door.mp3, great_door.mp3, and okay.mp3 to enable sound effects');
                setHasShownMissingFilesWarning(true);
              }
            }
          }
        };

        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('error', onError);
        
        // Force load attempt
        audio.load();
      });

      soundsRef.current = sounds;
    } catch (error) {
      console.error('Failed to initialize sound effects:', error);
      setIsLoaded(false);
      setIsInitialized(false);
    }
  }, [hasShownMissingFilesWarning, isInitialized]);

  // Initialize sounds on mount
  useEffect(() => {
    initializeSounds();
  }, [initializeSounds]);

  // Play sound effect based on score
  const playScoreSound = useCallback(
    (score: number) => {
      console.log(`🎵 Attempting to play sound for score: ${score}`);
      console.log(`🔊 Sound enabled: ${isSoundEnabled}, Loaded: ${isLoaded}, Sounds ref: ${!!soundsRef.current}`);
      
      if (!isSoundEnabled) {
        console.log('🔇 Sound effects are disabled');
        return;
      }
      
      if (!isLoaded) {
        console.log('⏳ Sound effects not loaded yet');
        return;
      }
      
      if (!soundsRef.current) {
        console.log('❌ Sound effects not initialized');
        return;
      }

      try {
        let soundToPlay: HTMLAudioElement;
        let soundName: string;

        if (score <= 30) {
          soundToPlay = soundsRef.current.badDoor;
          soundName = 'bad_door';
        } else if (score >= 70) {
          soundToPlay = soundsRef.current.greatDoor;
          soundName = 'great_door';
        } else {
          soundToPlay = soundsRef.current.okay;
          soundName = 'okay';
        }

        console.log(`🎵 Playing sound: ${soundName} for score ${score}`);
        console.log(`🔊 Sound ready state: ${soundToPlay.readyState}`);

        // Reset the audio to beginning
        soundToPlay.currentTime = 0;
        
        // Attempt to play
        const playPromise = soundToPlay.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`✅ Successfully played ${soundName} sound effect`);
            })
            .catch((error) => {
              console.error(`❌ Could not play ${soundName} sound effect:`, error);
              // Try to enable audio context if it's suspended
              if (error.name === 'NotAllowedError') {
                console.log('🔊 Audio context may be suspended. User interaction required.');
              }
            });
        }
      } catch (error) {
        console.error('❌ Error playing sound effect:', error);
      }
    },
    [isSoundEnabled, isLoaded]
  );

  // Toggle sound effects on/off
  const toggleSoundEffects = useCallback(() => {
    const newState = !isSoundEnabled;
    setIsSoundEnabled(newState);
    console.log(`🔊 Sound effects ${newState ? 'enabled' : 'disabled'}`);
  }, [isSoundEnabled]);

  // Test sound function for debugging
  const testSound = useCallback(() => {
    console.log('🧪 Testing sound effects...');
    if (soundsRef.current) {
      // Test each sound
      Object.entries(soundsRef.current).forEach(([key, audio]) => {
        console.log(`Testing ${key}:`, audio.readyState);
        audio.currentTime = 0;
        audio.play().catch(console.error);
      });
    }
  }, []);

  return {
    isSoundEnabled,
    isLoaded,
    playScoreSound,
    toggleSoundEffects,
    testSound, // For debugging
  };
};
