export function createSplashScreen() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DumDoors - Choose Your Fate</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #1d4ed8 50%, #2563eb 75%, #3b82f6 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }

        /* Dynamic Background with World Map */
        .world-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url('/worldmap.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.15;
          z-index: 0;
          animation: worldPulse 8s ease-in-out infinite;
        }

        @keyframes worldPulse {
          0%, 100% { 
            opacity: 0.15; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.25; 
            transform: scale(1.02);
          }
        }

        /* Floating Marquee Notice */
        .floating-notice {
          position: absolute;
          top: 20px;
          left: 0;
          width: 100%;
          height: 40px;
          background: linear-gradient(90deg, rgba(255, 69, 0, 0.9), rgba(255, 140, 0, 0.9));
          color: white;
          display: flex;
          align-items: center;
          font-weight: bold;
          font-size: 0.9rem;
          z-index: 25;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }

        .marquee-text {
          white-space: nowrap;
          animation: marquee 20s linear infinite;
          padding-left: 100%;
        }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }

        /* Animated Background Elements */
        .bg-particles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          animation: float 6s ease-in-out infinite;
        }

        .particle:nth-child(1) { top: 20%; left: 10%; animation-delay: 0s; }
        .particle:nth-child(2) { top: 60%; left: 20%; animation-delay: 1s; }
        .particle:nth-child(3) { top: 40%; left: 80%; animation-delay: 2s; }
        .particle:nth-child(4) { top: 80%; left: 70%; animation-delay: 3s; }
        .particle:nth-child(5) { top: 30%; left: 50%; animation-delay: 4s; }
        .particle:nth-child(6) { top: 70%; left: 30%; animation-delay: 5s; }

        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.8; }
        }

        /* Main Container */
        .splash-container {
          position: relative;
          z-index: 10;
          text-align: center;
          max-width: 500px;
          width: 90%;
          padding: 2rem;
        }

        /* Logo/Title Section */
        .logo-section {
          margin-bottom: 2rem;
          animation: fadeInUp 1s ease-out;
        }

        .game-logo {
          width: 160px;
          height: 160px;
          margin: 0 auto 1rem;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(20px);
          border: 4px solid rgba(255, 255, 255, 0.4);
          box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.4),
            0 0 30px rgba(59, 130, 246, 0.3),
            inset 0 2px 0 rgba(255, 255, 255, 0.3),
            inset 0 -2px 0 rgba(0, 0, 0, 0.2);
          animation: logoGlow 3s ease-in-out infinite;
          position: relative;
          overflow: hidden;
        }

        .logo-door-image {
          width: 80px;
          height: 80px;
          object-fit: contain;
          filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
          animation: doorFloat 4s ease-in-out infinite;
        }

        @keyframes doorFloat {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
            filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
          }
          50% { 
            transform: translateY(-5px) rotate(2deg); 
            filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
          }
        }

        .game-logo::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          animation: logoShine 4s ease-in-out infinite;
        }

        @keyframes logoGlow {
          0%, 100% { 
            box-shadow: 
              0 8px 32px rgba(0, 0, 0, 0.3), 
              0 0 20px rgba(59, 130, 246, 0.4),
              inset 0 2px 0 rgba(255, 255, 255, 0.2),
              inset 0 -2px 0 rgba(0, 0, 0, 0.2);
            transform: scale(1);
          }
          50% { 
            box-shadow: 
              0 8px 32px rgba(0, 0, 0, 0.3), 
              0 0 40px rgba(59, 130, 246, 0.7),
              0 0 60px rgba(147, 51, 234, 0.3),
              inset 0 2px 0 rgba(255, 255, 255, 0.3),
              inset 0 -2px 0 rgba(0, 0, 0, 0.2);
            transform: scale(1.05);
          }
        }

        @keyframes logoShine {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          50% { transform: translateX(100%) translateY(100%) rotate(45deg); }
          100% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
        }

        .game-title {
          font-size: 3.5rem;
          font-weight: 900;
          background: linear-gradient(135deg, #ffffff 0%, #e0e7ff 50%, #c7d2fe 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
          margin-bottom: 0.5rem;
          letter-spacing: 3px;
          animation: titleGlow 3s ease-in-out infinite;
        }

        @keyframes titleGlow {
          0%, 100% { 
            filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
          }
          50% { 
            filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.6));
          }
        }

        .game-subtitle {
          font-size: 1.3rem;
          color: rgba(255, 255, 255, 0.95);
          font-weight: 600;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
          margin-bottom: 1rem;
          letter-spacing: 1px;
        }

        .game-tagline {
          font-size: 1.1rem;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 2px;
          animation: taglinePulse 2s ease-in-out infinite;
          text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
        }

        @keyframes taglinePulse {
          0%, 100% { 
            opacity: 0.9; 
            transform: scale(1);
            filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.3));
          }
          50% { 
            opacity: 1; 
            transform: scale(1.05);
            filter: drop-shadow(0 0 15px rgba(251, 191, 36, 0.6));
          }
        }

        /* Game Description */
        .game-description {
          margin: 1.5rem 0;
          animation: fadeInUp 1s ease-out 0.2s both;
        }

        .game-description p {
          color: rgba(255, 255, 255, 0.9);
          font-size: 1rem;
          line-height: 1.6;
          text-align: center;
          max-width: 400px;
          margin: 0 auto;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
          font-weight: 500;
        }

        /* Feature Highlights */
        .features {
          margin: 2rem 0;
          animation: fadeInUp 1s ease-out 0.4s both;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.2rem;
          margin-bottom: 2rem;
        }

        .feature-item {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%);
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255, 255, 255, 0.25);
          border-radius: 20px;
          padding: 1.5rem;
          text-align: center;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          position: relative;
          overflow: hidden;
        }

        .feature-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          transition: left 0.6s;
        }

        .feature-item:hover {
          transform: translateY(-6px) scale(1.05);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.12) 100%);
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.25);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .feature-item:hover::before {
          left: 100%;
        }

        .feature-icon {
          font-size: 2.2rem;
          margin-bottom: 0.8rem;
          display: block;
          animation: featureFloat 3s ease-in-out infinite;
        }

        .feature-item:nth-child(1) .feature-icon { animation-delay: 0s; }
        .feature-item:nth-child(2) .feature-icon { animation-delay: 0.5s; }
        .feature-item:nth-child(3) .feature-icon { animation-delay: 1s; }
        .feature-item:nth-child(4) .feature-icon { animation-delay: 1.5s; }

        @keyframes featureFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }

        .feature-text {
          color: white;
          font-size: 0.85rem;
          font-weight: 700;
          line-height: 1.3;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
        }

        /* Play Button */
        .play-button-container {
          animation: fadeInUp 1s ease-out 0.7s both;
          position: relative;
        }

        .play-button {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 30%, #b45309 70%, #92400e 100%);
          color: white;
          border: none;
          padding: 1.6rem 4rem;
          font-size: 1.5rem;
          font-weight: 900;
          border-radius: 70px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          text-transform: uppercase;
          letter-spacing: 3px;
          box-shadow: 
            0 12px 35px rgba(245, 158, 11, 0.6),
            0 6px 20px rgba(0, 0, 0, 0.4),
            inset 0 3px 0 rgba(255, 255, 255, 0.3),
            inset 0 -3px 0 rgba(0, 0, 0, 0.3);
          position: relative;
          overflow: hidden;
          border: 3px solid rgba(255, 255, 255, 0.3);
          animation: buttonPulse 2s ease-in-out infinite;
        }

        @keyframes buttonPulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 
              0 12px 35px rgba(245, 158, 11, 0.6),
              0 6px 20px rgba(0, 0, 0, 0.4),
              inset 0 3px 0 rgba(255, 255, 255, 0.3),
              inset 0 -3px 0 rgba(0, 0, 0, 0.3);
          }
          50% { 
            transform: scale(1.02);
            box-shadow: 
              0 15px 40px rgba(245, 158, 11, 0.8),
              0 8px 25px rgba(0, 0, 0, 0.5),
              inset 0 3px 0 rgba(255, 255, 255, 0.4),
              inset 0 -3px 0 rgba(0, 0, 0, 0.3);
          }
        }

        .play-button:hover {
          transform: translateY(-6px) scale(1.1);
          box-shadow: 
            0 20px 50px rgba(245, 158, 11, 0.9),
            0 10px 30px rgba(0, 0, 0, 0.5),
            inset 0 3px 0 rgba(255, 255, 255, 0.4),
            inset 0 -3px 0 rgba(0, 0, 0, 0.3);
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 30%, #d97706 70%, #b45309 100%);
          animation: none;
        }

        .play-button:active {
          transform: translateY(-1px) scale(1.02);
        }

        .play-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transition: left 0.5s;
        }

        .play-button:hover::before {
          left: 100%;
        }

        .play-icon {
          margin-right: 0.5rem;
          font-size: 1.5rem;
        }

        /* Stats Preview */
        .stats-preview {
          margin-top: 2rem;
          animation: fadeInUp 1s ease-out 1s both;
        }

        .stats-grid {
          display: flex;
          justify-content: space-around;
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          border-radius: 15px;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-item {
          text-align: center;
          color: white;
        }

        .stat-number {
          font-size: 1.5rem;
          font-weight: 900;
          color: #fbbf24;
          display: block;
        }

        .stat-label {
          font-size: 0.8rem;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Animations */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }

        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          .splash-container {
            padding: 1rem;
          }

          .game-logo {
            width: 130px;
            height: 130px;
          }

          .logo-door-image {
            width: 65px;
            height: 65px;
          }

          .floating-notice {
            height: 35px;
            font-size: 0.8rem;
          }

          .pumpkin {
            width: 40px;
            height: 40px;
          }

          .tombstone-corner {
            width: 35px;
            height: 42px;
            bottom: 15px;
            right: 15px;
          }

          .game-title {
            font-size: 2.8rem;
            letter-spacing: 2px;
          }

          .game-subtitle {
            font-size: 1.1rem;
          }

          .game-tagline {
            font-size: 1rem;
          }

          .game-description p {
            font-size: 0.9rem;
            max-width: 320px;
          }

          .feature-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .feature-item {
            padding: 1rem;
          }

          .feature-icon {
            font-size: 2rem;
          }

          .feature-text {
            font-size: 0.8rem;
          }

          .play-button {
            padding: 1.2rem 2.8rem;
            font-size: 1.2rem;
            letter-spacing: 1px;
          }

          .stats-grid {
            padding: 1rem;
          }

          .reddit-context {
            top: 45px;
            right: 0.5rem;
            padding: 0.4rem 0.8rem;
            font-size: 0.7rem;
          }

          .stats-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 0.5rem;
            padding: 0.8rem;
          }

          .stat-item {
            padding: 0.3rem;
          }

          .stat-number {
            font-size: 1.2rem;
          }

          .stat-label {
            font-size: 0.7rem;
          }
        }

        @media (max-width: 480px) {
          .game-title {
            font-size: 2.2rem;
          }

          .game-subtitle {
            font-size: 1rem;
          }

          .play-button {
            padding: 1.2rem 2.5rem;
            font-size: 1.2rem;
            letter-spacing: 2px;
          }

          .feature-grid {
            grid-template-columns: 1fr 1fr;
            gap: 0.8rem;
          }

          .feature-item {
            padding: 1rem;
          }

          .floating-notice {
            height: 30px;
            font-size: 0.75rem;
          }

          .marquee-text {
            font-size: 0.75rem;
          }

          .game-logo {
            width: 110px;
            height: 110px;
          }

          .logo-door-image {
            width: 55px;
            height: 55px;
          }
        }

        /* Decorative Elements */
        .floating-pumpkins {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 2;
        }

        .pumpkin {
          position: absolute;
          width: 60px;
          height: 60px;
          opacity: 0.3;
          animation: pumpkinFloat 8s ease-in-out infinite;
        }

        .pumpkin:nth-child(1) { top: 15%; left: 10%; animation-delay: 0s; }
        .pumpkin:nth-child(2) { top: 70%; left: 85%; animation-delay: 2s; }
        .pumpkin:nth-child(3) { top: 25%; left: 80%; animation-delay: 4s; }

        @keyframes pumpkinFloat {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
            opacity: 0.2;
          }
          50% { 
            transform: translateY(-15px) rotate(5deg); 
            opacity: 0.4;
          }
        }

        .tombstone-corner {
          position: absolute;
          bottom: 20px;
          right: 20px;
          width: 50px;
          height: 60px;
          opacity: 0.4;
          z-index: 2;
          animation: tombstoneGlow 6s ease-in-out infinite;
        }

        @keyframes tombstoneGlow {
          0%, 100% { 
            opacity: 0.3; 
            filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.3));
          }
          50% { 
            opacity: 0.6; 
            filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.6));
          }
        }

        /* Reddit-specific styling */
        .reddit-context {
          position: absolute;
          top: 70px;
          right: 1rem;
          background: linear-gradient(135deg, rgba(255, 69, 0, 0.95), rgba(255, 140, 0, 0.95));
          color: white;
          padding: 0.6rem 1.2rem;
          border-radius: 25px;
          font-size: 0.85rem;
          font-weight: 700;
          z-index: 30;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
          animation: contextPulse 3s ease-in-out infinite;
        }

        @keyframes contextPulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
          }
          50% { 
            transform: scale(1.05);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
          }
        }
      </style>
    </head>
    <body>
      <!-- Dynamic World Map Background -->
      <div class="world-background"></div>

      <!-- Floating Marquee Notice -->
      <div class="floating-notice">
        <div class="marquee-text">
          🎮 NEW: AI-Powered Adventure Game • Face Impossible Scenarios • Discover Your True Personality • Get Roasted by DumStones • Climb the Leaderboards • Every Choice Matters! 🚪
        </div>
      </div>

      <!-- Animated Background -->
      <div class="bg-particles">
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
      </div>

      <!-- Floating Decorative Elements -->
      <div class="floating-pumpkins">
        <img src="/pumpkin.svg" alt="" class="pumpkin" />
        <img src="/pumpkin.svg" alt="" class="pumpkin" />
        <img src="/pumpkin.svg" alt="" class="pumpkin" />
      </div>

      <!-- Tombstone Corner Decoration -->
      <img src="/tombstone.png" alt="" class="tombstone-corner" />

      <!-- Reddit Context Badge -->
      <div class="reddit-context">
        🔴 Reddit Exclusive Game
      </div>

      <!-- Main Splash Content -->
      <div class="splash-container">
        <!-- Logo/Title Section -->
        <div class="logo-section">
          <div class="game-logo">
            <img src="/door.png" alt="DumDoors" class="logo-door-image" />
          </div>
          <h1 class="game-title">DumDoors</h1>
          <p class="game-subtitle">AI-Powered Decision Adventure</p>
          <p class="game-tagline">✨ Choose Your Fate ✨</p>
        </div>

        <!-- Game Description -->
        <div class="game-description">
          <p>Face impossible scenarios, make tough decisions, and discover what your choices reveal about you. Get hilariously roasted by AI, explore dynamic adventure maps, and see how your decisions shape your destiny!</p>
        </div>

        <!-- Feature Highlights -->
        <div class="features">
          <div class="feature-grid">
            <div class="feature-item">
              <span class="feature-icon">🤖</span>
              <div class="feature-text">AI-Powered<br>Analysis</div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🗺️</span>
              <div class="feature-text">Dynamic<br>Adventure Map</div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🪦</span>
              <div class="feature-text">Personality<br>DumStones</div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🏆</span>
              <div class="feature-text">Global<br>Leaderboards</div>
            </div>
          </div>
        </div>

        <!-- Play Button -->
        <div class="play-button-container">
          <button class="play-button" onclick="launchGame()">
            <span class="play-icon">🚪</span>
            Enter the DumDoors
          </button>
        </div>

        <!-- Stats Preview -->
        <div class="stats-preview">
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-number">500+</span>
              <span class="stat-label">Scenarios</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">🤖</span>
              <span class="stat-label">AI Powered</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">🪦</span>
              <span class="stat-label">DumStones</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">🔥</span>
              <span class="stat-label">Epic Fun</span>
            </div>
          </div>
        </div>
      </div>

      <script>
        function launchGame() {
          // Add click animation and feedback
          const button = document.querySelector('.play-button');
          button.style.transform = 'translateY(-1px) scale(1.02)';
          button.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 30%, #d97706 70%, #b45309 100%)';
          
          // Add loading state
          const originalText = button.innerHTML;
          button.innerHTML = '<span class="play-icon">🌀</span>Opening Doors...';
          button.disabled = true;
          
          // Create launch effect
          createLaunchEffect();
          
          // Launch the full game
          setTimeout(() => {
            if (window.parent && window.parent.postMessage) {
              // Signal to Devvit to launch the full app
              window.parent.postMessage({ type: 'LAUNCH_APP' }, '*');
            } else {
              // Fallback for direct access - open in new tab/window
              window.open('/', '_blank') || (window.location.href = '/');
            }
          }, 800);
        }

        function createLaunchEffect() {
          // Create expanding circle effect
          const effect = document.createElement('div');
          effect.style.position = 'fixed';
          effect.style.top = '50%';
          effect.style.left = '50%';
          effect.style.width = '20px';
          effect.style.height = '20px';
          effect.style.background = 'radial-gradient(circle, rgba(251, 191, 36, 0.8) 0%, transparent 70%)';
          effect.style.borderRadius = '50%';
          effect.style.transform = 'translate(-50%, -50%)';
          effect.style.pointerEvents = 'none';
          effect.style.zIndex = '9999';
          effect.style.animation = 'launchExpand 0.8s ease-out forwards';
          
          document.body.appendChild(effect);
          
          setTimeout(() => {
            effect.remove();
          }, 800);
        }

        // Add some interactive sparkle effects
        document.addEventListener('mousemove', (e) => {
          if (Math.random() > 0.95) {
            createSparkle(e.clientX, e.clientY);
          }
        });

        function createSparkle(x, y) {
          const sparkle = document.createElement('div');
          sparkle.style.position = 'fixed';
          sparkle.style.left = x + 'px';
          sparkle.style.top = y + 'px';
          sparkle.style.width = '4px';
          sparkle.style.height = '4px';
          sparkle.style.background = 'rgba(255, 215, 0, 0.8)';
          sparkle.style.borderRadius = '50%';
          sparkle.style.pointerEvents = 'none';
          sparkle.style.zIndex = '1000';
          sparkle.style.animation = 'sparkleAnimation 1s ease-out forwards';
          
          document.body.appendChild(sparkle);
          
          setTimeout(() => {
            sparkle.remove();
          }, 1000);
        }

        // Add sparkle and launch animations
        const style = document.createElement('style');
        style.textContent = \`
          @keyframes sparkleAnimation {
            0% {
              transform: scale(0) rotate(0deg);
              opacity: 1;
            }
            50% {
              transform: scale(1) rotate(180deg);
              opacity: 1;
            }
            100% {
              transform: scale(0) rotate(360deg);
              opacity: 0;
            }
          }
          
          @keyframes launchExpand {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.8;
            }
            100% {
              transform: translate(-50%, -50%) scale(50);
              opacity: 0;
            }
          }
        \`;
        document.head.appendChild(style);

        // Preload game assets for faster launch
        const preloadImages = [
          '/logo.png',
          '/menu.jpg',
          '/door.png',
          '/worldmap.jpg',
          '/tombstone.png',
          '/pumpkin.svg',
          '/snoo.png'
        ];

        preloadImages.forEach(src => {
          const img = new Image();
          img.src = src;
          img.onload = () => console.log(`✅ Preloaded: ${src}`);
          img.onerror = () => console.log(`❌ Failed to preload: ${src}`);
        });

        // Add some interactive door opening sounds (if available)
        document.addEventListener('click', () => {
          // Try to play a subtle click sound if available
          try {
            const audio = new Audio('/sounds/okay.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {}); // Ignore errors
          } catch (e) {
            // Ignore audio errors
          }
        }, { once: true });

        // Add dynamic background effects
        setInterval(() => {
          if (Math.random() > 0.7) {
            createMagicalSparkle();
          }
        }, 2000);

        function createMagicalSparkle() {
          const sparkle = document.createElement('div');
          sparkle.style.position = 'fixed';
          sparkle.style.left = Math.random() * window.innerWidth + 'px';
          sparkle.style.top = Math.random() * window.innerHeight + 'px';
          sparkle.style.width = '6px';
          sparkle.style.height = '6px';
          sparkle.style.background = 'radial-gradient(circle, rgba(255, 215, 0, 0.9) 0%, transparent 70%)';
          sparkle.style.borderRadius = '50%';
          sparkle.style.pointerEvents = 'none';
          sparkle.style.zIndex = '1000';
          sparkle.style.animation = 'sparkleAnimation 2s ease-out forwards';
          
          document.body.appendChild(sparkle);
          
          setTimeout(() => {
            sparkle.remove();
          }, 2000);
        }
      </script>
    </body>
    </html>
  `;
}