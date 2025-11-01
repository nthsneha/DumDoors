import React, { useState } from 'react';

// Fallback Pumpkin Component with Error Handling - Mobile Responsive
const PumpkinDecoration: React.FC<{ style: React.CSSProperties }> = ({ style }) => {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    // Fallback to emoji pumpkin with better styling
    return (
      <div 
        className="absolute w-16 h-16 md:w-60 md:h-60 lg:w-80 lg:h-80 opacity-30 md:opacity-40 animate-float flex items-center justify-center"
        style={style}
      >
        <span className="text-2xl md:text-6xl lg:text-9xl drop-shadow-lg" style={{ filter: 'sepia(1) hue-rotate(15deg) saturate(2)' }}>🎃</span>
      </div>
    );
  }

  return (
    <img 
      src="/pumpkin.svg" 
      alt="" 
      className="absolute w-16 h-16 md:w-60 md:h-60 lg:w-80 lg:h-80 opacity-30 md:opacity-40 animate-float" 
      style={style}
      onError={() => {
        console.log('🎃 Pumpkin SVG failed to load, using emoji fallback');
        setImageError(true);
      }}
      onLoad={() => {
        console.log('🎃 Pumpkin SVG loaded successfully');
      }}
    />
  );
};

interface DumStoneReport {
  title: string;
  personality: string;
  roast: string;
  strengths: string[];
  weaknesses: string[];
  funnyQuote: string;
  overallGrade: string;
  emoji: string;
}

interface DumStoneReportCardProps {
  report: DumStoneReport;
  onClose: () => void;
  onCopyRoast: () => void;
}

export const DumStoneReportCard: React.FC<DumStoneReportCardProps> = ({
  report,
  onClose,
  onCopyRoast,
}) => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-gray-900 flex items-center justify-center p-2 md:p-4 overflow-hidden">
      {/* Mobile-responsive button container */}
      <div className="fixed top-2 right-2 md:top-4 md:right-4 flex gap-1 md:gap-2 z-50">
        <button
          onClick={onCopyRoast}
          className="bg-black/70 hover:bg-black/90 text-white w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors border-2 border-white/20 backdrop-blur-sm"
          title="Copy Roast"
        >
          <span className="text-base md:text-xl">📋</span>
        </button>
        
        <button
          onClick={onClose}
          className="bg-black/70 hover:bg-black/90 text-white w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors border-2 border-white/20 backdrop-blur-sm"
          title="Close DumStone"
        >
          <span className="text-base md:text-xl">✕</span>
        </button>
      </div>

      {/* Tombstone Container - Mobile Responsive */}
      <div className="relative w-full max-w-sm md:max-w-lg h-full max-h-[95vh] md:max-h-[90vh] flex items-center justify-center px-4 md:px-0">
        {/* Tombstone Shape - Mobile Responsive */}
        <div className="relative bg-gradient-to-b from-gray-300 via-gray-400 to-gray-600 rounded-t-full w-full max-w-xs md:max-w-md h-[85vh] md:h-[100vh] max-h-[500px] md:max-h-[600px] border-2 md:border-4 border-gray-500 tombstone-shadow animate-tombstone-glow">
          {/* Tombstone Top Decoration */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3 w-4 h-4 bg-gray-400 rounded-full border-2 border-gray-500"></div>

          {/* Engraved Content - Mobile Responsive */}
          <div className="absolute inset-3 md:inset-6 flex flex-col items-center text-center font-serif overflow-y-auto">
            {/* RIP Header */}
            <div className="text-engraved-deep text-gray-900 text-lg md:text-2xl font-bold mb-2 md:mb-4">
              ⚰️ R.I.P. ⚰️
            </div>

            {/* Decorative Line */}
            <div className="w-24 md:w-32 h-0.5 bg-gray-700 mb-2 md:mb-4 shadow-inner"></div>

            {/* Name/Title */}
            <div className="text-engraved text-gray-900 text-sm md:text-lg font-bold mb-2 md:mb-3 leading-tight px-1">
              {report.title}
            </div>

            {/* Personality Subtitle */}
            <div className="text-engraved text-gray-800 text-xs md:text-sm italic mb-2 md:mb-4 leading-relaxed px-2">
              "{report.personality}"
            </div>

            {/* Decorative Line */}
            <div className="w-16 md:w-24 h-0.5 bg-gray-700 mb-2 md:mb-4 shadow-inner"></div>

            {/* Main Epitaph */}
            <div className="text-engraved text-gray-900 text-xs md:text-sm leading-relaxed mb-2 md:mb-4 px-1">
              <div className="font-semibold mb-1 md:mb-2">Here lies one who:</div>
              <div className="italic px-1 md:px-2">"{report.roast}"</div>
            </div>

            {/* Grade */}
            <div className="text-engraved text-gray-800 text-sm md:text-base font-bold mb-2 md:mb-4">
              Final Grade: {report.overallGrade}
            </div>

            {/* Decorative Line */}
            <div className="w-12 md:w-20 h-0.5 bg-gray-700 mb-2 md:mb-4 shadow-inner"></div>

            {/* Last Words */}
            <div className="text-engraved text-gray-900 text-xs leading-relaxed mb-2 md:mb-4 px-1">
              <div className="font-semibold mb-1">Last Words:</div>
              <div>"{report.funnyQuote}"</div>
            </div>

            {/* Decorative Line */}
            <div className="w-10 md:w-16 h-0.5 bg-gray-700 mb-2 md:mb-4 shadow-inner"></div>

            {/* Bottom Decoration */}
            <div className="text-xl md:text-2xl animate-float mt-auto">💀</div>
          </div>
        </div>

        {/* Tombstone Base */}
        {/*<div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-2 bg-gradient-to-b from-gray-500 to-gray-700 h-6 w-3/4 max-w-xs rounded-b-lg border-x-4 border-b-4 border-gray-500 shadow-lg"></div>*/}

        {/* Ground/Grass Effect */}
        {/*<div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-4 w-full h-3 bg-gradient-to-r from-green-800 via-green-700 to-green-800 rounded-full opacity-60"></div>*/}
        {/* Small Decorations */}
        {/*<div
          className="absolute bottom-2 left-1/4 text-sm animate-float"
          style={{ animationDelay: '1s' }}
        >
          🌱
        </div>
        <div
          className="absolute bottom-2 right-1/4 text-sm animate-float"
          style={{ animationDelay: '2s' }}
        >
          🌿
        </div>
        */}

        {/* Pumpkins - Mobile responsive positioning */}
        <div className="block">
          {/* Left Pumpkin - Mobile: closer to tombstone, Desktop: further out */}
          <div className="lg:hidden">
            <PumpkinDecoration style={{ top: '20%', left: '-25%', transform: 'scale(0.6)' }} />
          </div>
          <div className="hidden lg:block">
            <PumpkinDecoration style={{ top: '45%', left: '-70%' }} />
          </div>
          
          {/* Right Pumpkin - Mobile: closer to tombstone, Desktop: further out */}
          <div className="lg:hidden">
            <PumpkinDecoration style={{ top: '70%', right: '-25%', transform: 'scale(0.6)' }} />
          </div>
          <div className="hidden lg:block">
            <PumpkinDecoration style={{ top: '45%', left: '105%' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
