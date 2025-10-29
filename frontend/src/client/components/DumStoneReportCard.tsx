import React from 'react';

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
   <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-gray-900 flex items-center justify-center p-4 overflow-hidden">
      <button
        onClick={onClose}
        className="fixed top-4 right-4 bg-black/70 hover:bg-black/90 text-white w-12 h-12 rounded-full flex items-center justify-center transition-colors z-50 border-2 border-white/20 backdrop-blur-sm"
        title="Close DumStone"
      >
        <span className="text-xl">✕</span>
      </button>

      {/* Copy Button - Top Right (next to exit) */}
      <button
        onClick={onCopyRoast}
        className="fixed top-4 right-20 bg-black/70 hover:bg-black/90 text-white w-12 h-12 rounded-full flex items-center justify-center transition-colors z-50 border-2 border-white/20 backdrop-blur-sm"
        title="Copy Roast"
      >
        <span className="text-xl">📋</span>
      </button>

      {/* Tombstone Container - Fits Screen */}
      <div className="relative w-full max-w-lg h-full max-h-[90vh] flex items-center justify-center">
        {/* Tombstone Shape */}
        <div className="relative bg-gradient-to-b from-gray-300 via-gray-400 to-gray-600 rounded-t-full w-full max-w-md h-[100vh] max-h-[600px] border-4 border-gray-500 tombstone-shadow animate-tombstone-glow">
          {/* Tombstone Top Decoration */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3 w-4 h-4 bg-gray-400 rounded-full border-2 border-gray-500"></div>

          {/* Engraved Content */}
          <div className="absolute inset-6 flex flex-col items-center text-center font-serif">
            {/* RIP Header */}
            <div className="text-engraved-deep text-gray-900 text-2xl font-bold mb-4">
              ⚰️ R.I.P. ⚰️
            </div>

            {/* Decorative Line */}
            <div className="w-32 h-0.5 bg-gray-700 mb-4 shadow-inner"></div>

            {/* Name/Title */}
            <div className="text-engraved text-gray-900 text-lg font-bold mb-3 leading-tight">
              {report.title}
            </div>

            {/* Personality Subtitle */}
            <div className="text-engraved text-gray-800 text-sm italic mb-4 leading-relaxed">
              "{report.personality}"
            </div>

            {/* Decorative Line */}
            <div className="w-24 h-0.5 bg-gray-700 mb-4 shadow-inner"></div>

            {/* Main Epitaph */}
            <div className="text-engraved text-gray-900 text-sm leading-relaxed mb-4">
              <div className="font-semibold mb-2">Here lies one who:</div>
              <div className="italic px-2">"{report.roast}"</div>
            </div>

            {/* Grade */}
            <div className="text-engraved text-gray-800 text-base font-bold mb-4">
              Final Grade: {report.overallGrade}
            </div>

            {/* Decorative Line */}
            <div className="w-20 h-0.5 bg-gray-700 mb-4 shadow-inner"></div>

            {/* Last Words */}
            <div className="text-engraved text-gray-900 text-xs italic leading-relaxed mb-4">
              <div className="font-semibold mb-1">Last Words:</div>
              <div>"{report.funnyQuote}"</div>
            </div>

            {/* Decorative Line */}
            <div className="w-16 h-0.5 bg-gray-700 mb-4 shadow-inner"></div>

            {/* Dates (Parody) */}
            <div className="text-engraved text-gray-800 text-xs leading-relaxed mb-4">
              <div>Born: Optimistic</div>
              <div>Died: Disappointed</div>
            </div>

            {/* Bottom Decoration */}
            <div className="text-2xl animate-float mt-auto">💀</div>
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

        {/* Massive Pumpkins Flanking the Tombstone */}
        <img src="/pumpkin.svg" alt="" className="absolute w-80 h-80 opacity-40 animate-float" style={{ top: '45%', left: '-70%' }} />
        <img src="/pumpkin.svg" alt="" className="absolute w-80 h-80 opacity-40 animate-float" style={{ top: '45%', left: '105%' }} />
      </div>
    </div>
  );
};
