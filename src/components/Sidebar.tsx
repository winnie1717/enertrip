
import React from 'react';
import { type ItinerarySpot } from '../types';
import { ITINERARY_DATA } from '../constants';

interface SidebarProps {
  currentSpot: ItinerarySpot;
  onSelectSpot: (spot: ItinerarySpot) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentSpot, onSelectSpot }) => {
  return (
    <aside className="w-80 border-r bg-white flex flex-col h-full shadow-sm z-10">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-indigo-600">📍</span> 行程清單
        </h2>
        <p className="text-xs text-slate-400 mt-1">選擇景點以查看詳細視覺化分析</p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {/* Filter items to ensure only spots are rendered and narrow the type to ItinerarySpot to fix property access errors */}
        {ITINERARY_DATA.result
          .filter((item): item is ItinerarySpot => item.DataType === "Spot")
          .map((spot, idx) => (
          <div
            key={spot.SpotName}
            onClick={() => onSelectSpot(spot)}
            className={`p-4 cursor-pointer transition-all border-2 rounded-xl flex items-center gap-4 ${
              currentSpot.SpotName === spot.SpotName
                ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-200'
                : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${
              currentSpot.SpotName === spot.SpotName ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1">
              <h4 className={`font-bold transition-colors ${
                currentSpot.SpotName === spot.SpotName ? 'text-indigo-700' : 'text-slate-700'
              }`}>
                {spot.SpotName}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">{spot.SpotType[0]}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                  ★ {spot.Rating}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
