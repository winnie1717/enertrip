
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ItineraryVisualizer from './components/ItineraryVisualizer';
import MetricCards from './components/MetricCards';
import TechnicalDocs from './components/TechnicalDocs';
import { ALL_ITINERARIES, COLORS } from './constants';
import { type ItinerarySpot, type Metrics, type ItineraryItem } from './types';
import { Calendar, Filter, ChevronDown, Search, Settings, ChevronLeft, ChevronRight, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


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
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Filter States
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // 新增兩個狀態追蹤滑鼠位置與顯示開關 > 懸浮視窗用
  const [anchorEl, setAnchorEl] = useState<{ x: number, y: number } | null>(null);
  const [showFloating, setShowFloating] = useState(false);

  // Extract all unique types and date range for defaults
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    ALL_ITINERARIES.forEach(it => {
      it.result.forEach(item => {
        if (item.DataType === "Spot") {
          item.SpotType.forEach(t => types.add(t));
        }
      });
    });
    return Array.from(types).sort();
  }, []);

  const dateRange = useMemo(() => {
    let min = "";
    let max = "";
    ALL_ITINERARIES.forEach(it => {
      it.result.forEach(item => {
        if (item.DataType === "Spot") {
          if (!min || item.Date < min) min = item.Date;
          if (!max || item.Date > max) max = item.Date;
        }
      });
    });
    return { min, max };
  }, []);

  useEffect(() => {
    if (!startDate && dateRange.min) setStartDate(dateRange.min);
    if (!endDate && dateRange.max) setEndDate(dateRange.max);
  }, [dateRange]);

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

  //點擊景點
  // const handleSelectSpot = useCallback((itineraryId: number, spot: ItinerarySpot) => {
  //   setSelectedSpotId(`${itineraryId}-${spot.SpotName}`);
  // }, []);
  const handleSelectSpot = useCallback((e: React.MouseEvent | null, itineraryId: number, spot: ItinerarySpot) => {
    setSelectedSpotId(`${itineraryId}-${spot.SpotName}`);
    
    // 如果有傳入事件，就記錄座標並開啟懸浮窗
    if (e) {
      setAnchorEl({ x: e.clientX, y: e.clientY });
      setShowFloating(true);
    }
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
    return ALL_ITINERARIES
      .filter(it => {
        // Date filter: check if any spot in itinerary is within range
        const hasDateMatch = it.result.some(item => 
          item.DataType === "Spot" && 
          (!startDate || item.Date >= startDate) && 
          (!endDate || item.Date <= endDate)
        );
        
        // Type filter: check if any spot in itinerary matches selected types
        const hasTypeMatch = selectedTypes.length === 0 || it.result.some(item => 
          item.DataType === "Spot" && item.SpotType.some(t => selectedTypes.includes(t))
        );

        return hasDateMatch && hasTypeMatch;
      })
      .map(it => {
        const days = getDaysGrouped(it);
        return {
          itinerary: it,
          days: days.map(([dayNum, dayData]) => ({
            originalDay: Number(dayNum),
            data: dayData
          }))
        };
      });
  }, [startDate, endDate, selectedTypes]);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden font-sans">
      <header className="bg-white px-8 py-4 flex items-center justify-between z-20 border-b border-slate-100">
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center text-white font-black text-xl">
              EnT
            </div> */}
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-800 leading-tight">EnerTrip 
                {/* <span className="text-indigo-600">視覺化</span> */}
              </h1>
              {/* <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Trip Engine</p> */}
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="flex-1 flex items-center gap-3 pl-10">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
            <Calendar size={14} className="text-slate-400" />
            <div className="flex items-center gap-1">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              />
              <span className="text-slate-300 text-[10px]">至</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
              className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors"
            >
              <Filter size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-700 min-w-[80px] text-left">
                {selectedTypes.length === 0 ? "全部類型" : `已選 ${selectedTypes.length} 項`}
              </span>
              <ChevronDown size={12} className={`text-slate-400 transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isTypeDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsTypeDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl z-40 p-2 max-h-64 overflow-y-auto custom-scrollbar"
                  >
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setSelectedTypes([])}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors ${selectedTypes.length === 0 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        全部
                      </button>
                      <div className="h-px bg-slate-50 my-1" />
                      {allTypes.map(type => (
                        <button
                          key={type}
                          onClick={() => {
                            setSelectedTypes(prev => 
                              prev.includes(type) 
                                ? prev.filter(t => t !== type) 
                                : [...prev, type]
                            );
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors ${selectedTypes.includes(type) ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          {type}
                          {selectedTypes.includes(type) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* <div className="flex items-center gap-6 shrink-0">
          <nav className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('visualizer')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'visualizer' ? 'bg-white text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              行程總覽
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'docs' ? 'bg-white text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              技術文件
            </button>
          </nav>
          
          <div className="text-right hidden lg:block">
            <p className="text-xs font-bold text-slate-700">篩選出 {processedSections.length} 個行程</p>
            <p className="text-[10px] text-slate-400">府城漫步專案</p>
          </div>
        </div> */}
        
      </header>

      {/* 右邊展開區塊 */}
      <div className="flex-1 overflow-hidden">
        <main className="h-full overflow-y-auto p-3">
          {activeTab === 'visualizer' ? (
            <div className="flex flex-col lg:flex-row gap-8 min-h-full relative">

              {/* Toggle Button (Bump) */}
              <motion.button
                initial={false}
                animate={{ x: 0 }}
                whileHover={{ x: -4 }}
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-slate-200 border-r-0 py-4 px-2 rounded-l-2xl flex flex-col items-center group transition-colors hover:bg-slate-50"
              >
                <div className={`p-2 rounded-lg ${isPanelOpen ? 'text-slate-300' : 'text-slate-500 transition-colors'} group-hover:text-slate-500 transition-colors`}>
                  <ChevronLeft size={16} />
                </div> 
              </motion.button>

              {/* Left: Scrollable Itineraries List */}
              <motion.div 
                layout
                // className={`flex-1 flex flex-col gap-4 pb-20 overflow-hidden transition-all duration-500 ${isPanelOpen ? 'lg:pr-4' : ''}`}// 動態空出右邊面板的寬度
                className={`flex-1 flex flex-col gap-4 pb-5 overflow-y-auto transition-all duration-500 ${isPanelOpen ? 'lg:mr-[400px]' : 'mr-0'}`} // 假設面板寬度是 400px
              >
                {processedSections.map((itSection) => (
                  <div key={itSection.itinerary.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-4 px-2">
                      <h2 className="text-sm font-black text-slate-400 tracking-tight uppercase">行程 {itSection.itinerary.id}</h2>
                      <div className="h-px flex-1 bg-slate-50" />
                    </div>
                    
                    <div className="flex flex-col gap-0">
                      {itSection.days.map((day) => (
                        <div key={`${itSection.itinerary.id}-${day.originalDay}`} className="flex flex-col mb-1 bg-white rounded-2xl border border-slate-50 p-1">
                          <div className="overflow-x-auto custom-scrollbar">
                            <ItineraryVisualizer 
                              items={day.data.items} 
                              selectedSpotId={selectedSpotId}
                              itineraryId={itSection.itinerary.id}
                              dayNumber={day.originalDay}
                              date={day.data.date}
                              // onSelectSpot={(spot) => handleSelectSpot(itSection.itinerary.id, spot)}
                              // 關鍵修改：要把 e 傳給 handleSelectSpot
                              onSelectSpot={(e, spot) => handleSelectSpot(e, itSection.itinerary.id, spot)}
                              metricsMap={metricsMap}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* Right: Adjustment Panel (Collapsible) */}
              <AnimatePresence>
                {/* 右邊展開的區塊 */}
                {isPanelOpen && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0, x: 20 }}
                    animate={{ width: 'auto', opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    // className="hidden lg:flex flex-col gap-6 sticky top-0 h-fit pb-12 z-30"
                    // 關鍵修改：fixed, top-0, right-0, h-screen
                    className="fixed top-0 right-0 h-screen w-96 bg-white z-50 overflow-y-auto rounded-[1rem] border border-slate-200" // 固定在右邊
                  >
                    <div className="w-[320px] xl:w-[400px] pt-2">
                      {currentSpot ? (
                        <>
                          <div className="bg-white p-6">
                            <div className="mb-8">
                              <div className="flex justify-between items-start mb-1">
                                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                  正在調整
                                </div>
                                <button 
                                  onClick={() => setIsPanelOpen(false)}
                                  className="text-slate-300 hover:text-slate-500 transition-colors"
                                >
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                              <h2 className="text-2xl font-black text-slate-800 mb-1 leading-tight">{currentSpot.SpotName}</h2>
                              <div className="flex flex-col gap-1 text-slate-400 text-xs mt-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-500">時間</span>
                                  <span>{currentSpot.StartTime} - {currentSpot.EndTime}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-bold text-slate-500 shrink-0">地址</span>
                                  <span className="break-words">{currentSpot.Address}</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* <div className="mt-4">
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
                            </div> */}
                          </div>

                          {/* {metricsMap[selectedSpotId] && <MetricCards metrics={metricsMap[selectedSpotId]} />} */}

                          {/* <div className="bg-indigo-600 text-white p-6 rounded-[2rem]">
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
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 懸浮調整窗 */}
              <AnimatePresence>
                {showFloating && currentSpot && anchorEl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    // 計算位置：出現在滑鼠右方，並往上偏移一點以防擋住點擊點
                    style={{
                      position: 'fixed',
                      left: anchorEl.x + 20,
                      top: anchorEl.y - 120,
                      zIndex: 100,
                    }}
                    className="w-72 bg-white/95 backdrop-blur-sm p-6 rounded-[2rem] shadow-2xl border border-slate-100"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-[10px] font-black text-indigo-500 uppercase">景點調整</div>
                        <h3 className="text-lg font-black text-slate-800">{currentSpot.SpotName}</h3>
                      </div>
                      <button 
                        onClick={() => setShowFloating(false)}
                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="space-y-1">
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
                  </motion.div>
                )}
              </AnimatePresence>
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
