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
    <div className="relative max-w-2xl w-full">
      {/* Tombstone Background Image */}
      <div className="relative shadow-2xl">
        <img
          src="/tombstone.png"
          alt="Tombstone"
          className="w-full h-auto object-contain"
          onError={(e) => {
            console.log('Tombstone image failed to load');
            e.currentTarget.style.display = 'none';
          }}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10"
        >
          ✕
        </button>

        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col items-center pt-64 px-6">
          {/* Header */}
          <div className="text-center mb-3">
            <div className="text-3xl mb-2">{report.emoji}</div>
            <h1 className="text-xl font-bold text-white mb-2 drop-shadow-lg">YOUR DUMSTONE</h1>
            <div className="bg-black/60 rounded-lg p-2 inline-block backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-white">{report.title}</h2>
              <p className="text-gray-200 italic text-sm">"{report.personality}"</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-3 max-w-sm mx-auto">

            {/* Overall Assessment */}
            <div className="bg-black/70 rounded-lg p-3 backdrop-blur-sm border border-white/20">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-base font-bold text-white">📋 Assessment</h3>
                <div className="bg-white/20 px-2 py-1 rounded-full">
                  <span className="text-white font-bold text-sm">{report.overallGrade}</span>
                </div>
              </div>
              <div className="bg-black/40 border-l-3 border-white/40 p-2 rounded">
                <p className="text-gray-200 leading-normal italic text-sm">"{report.roast}"</p>
              </div>
            </div>

            {/* Notable Quote */}
            <div className="bg-black/70 rounded-lg p-3 backdrop-blur-sm border border-white/20">
              <h3 className="text-base font-bold text-white mb-2 text-center">💭 Notable Quote</h3>
              <div className="bg-black/40 rounded-lg p-2 border-l-3 border-white/40">
                <p className="text-gray-200 italic text-center text-sm">"{report.funnyQuote}"</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-center pt-3">
              <button
                onClick={onCopyRoast}
                className="bg-black/80 hover:bg-black/90 text-white px-3 py-2 rounded-lg font-semibold transition-colors text-xs backdrop-blur-sm border border-white/20"
              >
                📋 Copy
              </button>
              <button
                onClick={onClose}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg font-semibold transition-colors text-xs backdrop-blur-sm border border-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};