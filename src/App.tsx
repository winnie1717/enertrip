
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ItineraryVisualizer from './components/ItineraryVisualizer';
import MetricCards from './components/MetricCards';
import TechnicalDocs from './components/TechnicalDocs';
import { ALL_ITINERARIES, COLORS } from './constants';
import { type ItinerarySpot, type Metrics, type ItineraryItem } from './types';

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
        <div 
          className="absolute h-full rounded-full transition-all duration-75"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
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
  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics>>({});
  const [selectedSpotId, setSelectedSpotId] = useState<string>("");

  useEffect(() => {
    const initial: Record<string, Metrics> = {};
    ALL_ITINERARIES.forEach(itinerary => {
      itinerary.result.forEach(item => {
        if (item.DataType === "Spot") {
          const spot = item as ItinerarySpot;
          const uniqueKey = `${itinerary.id}-${spot.SpotName}`;
          initial[uniqueKey] = {
            preference: Math.round(spot.Rating * 2),
            physical: Math.round(spot.WalkingLoad),
            mental: Math.round((spot.InfoLoad + spot.CrowdLevel) / 2)
          };
        }
      });
    });
    setMetricsMap(initial);
    
    // 預設選擇第一個行程的第一個景點
    const firstIt = ALL_ITINERARIES[0];
    const firstSpot = firstIt.result.find(item => item.DataType === "Spot") as ItinerarySpot;
    if (firstSpot) setSelectedSpotId(`${firstIt.id}-${firstSpot.SpotName}`);
  }, []);

  const currentSpot = useMemo(() => {
    if (!selectedSpotId) return null;
    const [itId, spotName] = selectedSpotId.split('-');
    const it = ALL_ITINERARIES.find(i => i.id === Number(itId));
    return it?.result.find(item => item.DataType === "Spot" && (item as ItinerarySpot).SpotName === spotName) as ItinerarySpot;
  }, [selectedSpotId]);

  const handleSelectSpot = useCallback((itineraryId: number, spot: ItinerarySpot) => {
    setSelectedSpotId(`${itineraryId}-${spot.SpotName}`);
  }, []);

  const handleUpdateMetrics = useCallback((newMetrics: Partial<Metrics>) => {
    if (!selectedSpotId) return;
    setMetricsMap(prev => ({
      ...prev,
      [selectedSpotId]: { ...prev[selectedSpotId], ...newMetrics }
    }));
  }, [selectedSpotId]);

  const getDaysGrouped = (itinerary: typeof ALL_ITINERARIES[0]) => {
    const groups: Record<number, { items: ItineraryItem[], date: string }> = {};
    itinerary.result.forEach(item => {
      if (!groups[item.Day]) {
        groups[item.Day] = { items: [], date: "" };
      }
      groups[item.Day].items.push(item);
      if (item.DataType === "Spot" && !groups[item.Day].date) {
        groups[item.Day].date = item.Date;
      }
    });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  };

  const processedSections = useMemo(() => {
    return ALL_ITINERARIES.map(it => {
      const days = getDaysGrouped(it);
      return {
        itinerary: it,
        days: days.map(([dayNum, dayData]) => ({
          originalDay: Number(dayNum),
          data: dayData
        }))
      };
    });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden font-sans">

      <div className="flex-1 overflow-hidden">
        {/* 1. 修改 main：改成 overflow-hidden (外層不准捲) */}
        <main className="h-full overflow-hidden p-6">
        {/* <main className="h-full overflow-auto p-6"> */}
          {activeTab === 'visualizer' ? (
            // 2. 修改容器：改成 h-full (鎖死高度，讓內部決定捲動)
            <div className="flex flex-col lg:flex-row gap-8 h-full">
            {/* <div className="flex flex-col lg:flex-row gap-8 min-h-full"> */}
              {/* Left: Scrollable Itineraries List (3/4 Width) */}
              {/* 3. 修改列表：這裡保留 overflow-y-auto，並加上 h-full */}
              {/* 建議加個 pr-4 (padding-right) 讓捲軸不要壓到字 */}
              <div className="lg:w-3/4 flex flex-col gap-12 pb-20 overflow-y-auto custom-scrollbar h-full pr-4">
              {/* <div className="lg:w-3/4 flex flex-col gap-12 pb-20 overflow-y-auto custom-scrollbar"> */}
                {processedSections.map((itSection) => (
                  <div key={itSection.itinerary.id} className="flex flex-col gap-0">
                    <div className="flex items-center gap-4 px-1">
                      <h2 className="text-xl font-black tracking-tight uppercase">行程 {itSection.itinerary.id}</h2>
                      {/* <div className="h-px flex-1 bg-slate-50" /> */}
                    </div>
                    
                    <div className="flex flex-col gap-0">
                      {itSection.days.map((day) => (
                        <div key={`${itSection.itinerary.id}-${day.originalDay}`} className="flex flex-col mb-4 bg-white rounded-3xl p-2">
                          <div className="overflow-x-auto custom-scrollbar">
                            <ItineraryVisualizer 
                              items={day.data.items} 
                              selectedSpotId={selectedSpotId}
                              itineraryId={itSection.itinerary.id}
                              dayNumber={day.originalDay}
                              date={day.data.date}
                              onSelectSpot={(spot) => handleSelectSpot(itSection.itinerary.id, spot)}
                              metricsMap={metricsMap}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: Adjustment Panel (1/4 Width) */}
              <div className="lg:w-1/4 flex flex-col gap-6 sticky top-0 h-fit pb-12">
                {currentSpot ? (
                  <>
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50">
                      <div className="mb-8">
                        {/* <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">
                          正在調整
                        </div> */}
                        <h2 className="text-2xl font-black text-slate-800 mb-1 leading-tight">{currentSpot.SpotName}</h2>
                        <div className="flex flex-col gap-1 text-slate-400 text-xs mt-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500">時間</span>
                            <span>{currentSpot.StartTime} - {currentSpot.EndTime}</span>
                          </div>
                          {/* <div className="flex items-start gap-2">
                            <span className="font-bold text-slate-500 shrink-0">地址</span>
                            <span className="break-words">{currentSpot.Address}</span>
                          </div> */}
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        {metricsMap[selectedSpotId] && (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>

                    {/* {metricsMap[selectedSpotId] && <MetricCards metrics={metricsMap[selectedSpotId]} />}

                    <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-md">
                      <h3 className="font-bold mb-2 flex items-center gap-2">
                        <span>💡</span> 行程提醒
                      </h3>
                      <p className="text-xs opacity-90 leading-relaxed">
                        目前選中的景點是「{currentSpot.SpotName}」。建議根據此疲勞度評估是否需要調整後續景點的停留時間。
                      </p>
                    </div> */}
                  </>
                ) : (
                  <div className="bg-slate-50 p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                    <p className="text-slate-400 font-bold text-sm">點擊左側景點以進行調整</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <TechnicalDocs />
          )}
        </main>
      </div>

      {/* <footer className="bg-white px-8 py-2 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-50">
        <div>視覺化核心: D3.js + React SVG Engine</div>
        <div>佈局模式: 3:1 Responsive Canvas</div>
      </footer> */}
    </div>
  );
};

export default App;
