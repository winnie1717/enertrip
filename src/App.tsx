
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ItineraryVisualizer from './components/ItineraryVisualizer';
import MetricCards from './components/MetricCards';
import TechnicalDocs from './components/TechnicalDocs';
import { ITINERARY_DATA, COLORS } from './constants';
// import { ItinerarySpot, Metrics } from './types';
import { type Metrics, type ItinerarySpot } from './types';

// Custom Slider Component to match the screenshot design
const CustomMetricSlider: React.FC<{
  label: string;
  value: number;
  color: string;
  onChange: (val: number) => void;
}> = ({ label, value, color, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateValue = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newVal = Math.round(1 + percentage * 9);
    onChange(newVal);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    calculateValue(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) calculateValue(e.clientX);
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const percentage = ((value - 1) / 9) * 100;

  return (
    <div className="mb-8 select-none">
      <div className="flex justify-between items-center mb-3">
        <label className="text-lg font-medium text-slate-500 tracking-tight">{label}</label>
      </div>
      <div 
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="relative h-6 w-full bg-[#E9EDF2] rounded-full cursor-pointer flex items-center"
      >
        {/* Progress Bar */}
        <div 
          className="absolute h-full rounded-full transition-all duration-75"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
        {/* Thumb */}
        <div 
          className="absolute w-8 h-8 bg-white rounded-full z-10 flex items-center justify-center transition-all duration-75"
          style={{ 
            left: `calc(${percentage}% - 16px)`, 
            border: `4px solid ${color}` 
          }}
        />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'visualizer' | 'docs'>('visualizer');
  
  const firstSpot = useMemo(() => {
    return ITINERARY_DATA.result.find(item => item.DataType === "Spot") as ItinerarySpot;
  }, []);

  const [selectedSpotId, setSelectedSpotId] = useState<string>(firstSpot.SpotName);

  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics>>(() => {
    const initial: Record<string, Metrics> = {};
    ITINERARY_DATA.result.forEach(item => {
      if (item.DataType === "Spot") {
        const spot = item as ItinerarySpot;
        initial[spot.SpotName] = {
          preference: Math.round(spot.Rating * 2),
          physical: Math.round(spot.WalkingLoad),
          mental: Math.round((spot.InfoLoad + spot.CrowdLevel) / 2)
        };
      }
    });
    return initial;
  });

  const currentSpot = useMemo(() => {
    return ITINERARY_DATA.result.find(item => item.DataType === "Spot" && (item as ItinerarySpot).SpotName === selectedSpotId) as ItinerarySpot;
  }, [selectedSpotId]);

  const handleSelectSpot = useCallback((spot: ItinerarySpot) => {
    setSelectedSpotId(spot.SpotName);
  }, []);

  const handleUpdateMetrics = useCallback((newMetrics: Partial<Metrics>) => {
    setMetricsMap(prev => ({
      ...prev,
      [selectedSpotId]: { ...prev[selectedSpotId], ...newMetrics }
    }));
  }, [selectedSpotId]);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/*<header className="bg-white border-b px-8 py-4 flex items-center justify-between shadow-sm z-20">
         <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl">
            T
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">府城之旅 <span className="text-indigo-600">行程視覺化</span></h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Trip Analytics Engine</p>
          </div>
        </div>

        <nav className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'visualizer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            行程畫布
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'docs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            技術文件
          </button>
        </nav> 

        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-slate-700">2026-01-08 一日遊</p>
            <p className="text-[10px] text-slate-400">當前進度: {currentSpot.StartTime} 📍</p>
          </div>
        </div>
      </header>*/}

      <div className="flex-1 overflow-hidden flex">
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'visualizer' ? (
            <div className="flex flex-col lg:flex-row gap-8 h-full">
              {/* Left: Diagram */}
              <div className="flex-1 min-w-0">
                <ItineraryVisualizer 
                  items={ITINERARY_DATA.result} 
                  selectedSpotId={selectedSpotId}
                  onSelectSpot={handleSelectSpot}
                  metricsMap={metricsMap}
                />
              </div>

              {/* Right: Adjustment Panel */}
              <div className="w-full lg:w-[400px] flex flex-col gap-6">
                <div className="p-8 rounded-[2.5rem]">
                  <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-800 mb-1">{currentSpot.SpotName}</h2>
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <span>{currentSpot.StartTime} - {currentSpot.EndTime}</span>
                      {/* <span>•</span>
                      <span className="truncate max-w-[200px]">{currentSpot.Address}</span> */}
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <CustomMetricSlider 
                      label="偏好"
                      value={metricsMap[selectedSpotId].preference}
                      color={COLORS.preference}
                      onChange={(val) => handleUpdateMetrics({ preference: val })}
                    />
                    <CustomMetricSlider 
                      label="生理疲勞"
                      value={metricsMap[selectedSpotId].physical}
                      color={COLORS.physical}
                      onChange={(val) => handleUpdateMetrics({ physical: val })}
                    />
                    <CustomMetricSlider 
                      label="心理疲勞"
                      value={metricsMap[selectedSpotId].mental}
                      color={COLORS.mental}
                      onChange={(val) => handleUpdateMetrics({ mental: val })}
                    />
                  </div>
                </div>

                {/* <MetricCards metrics={metricsMap[selectedSpotId]} /> */}

                {/* <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl">
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    <span>💡</span> 行程提醒
                  </h3>
                  <p className="text-xs opacity-90 leading-relaxed">
                    目前選中的景點是「{currentSpot.SpotName}」。建議根據此疲勞度評估是否需要調整後續景點的停留時間。
                  </p>
                </div> */}
              </div>
            </div>
          ) : (
            <TechnicalDocs />
          )}
        </main>
      </div>

      {/* <footer className="bg-white border-t px-8 py-2 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        <div>視覺化核心: D3.js + React SVG Engine</div>
        <div>資料同步時間: {ITINERARY_DATA.timestamp}</div>
      </footer> */}
    </div>
  );
};

export default App;
