
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ItineraryVisualizer from './components/ItineraryVisualizer';
import MetricCards from './components/MetricCards';
import TechnicalDocs from './components/TechnicalDocs';
import { COLORS } from './constants';
import { type ItinerarySpot, type Metrics, type ItineraryItem } from './types';
import { Calendar, Filter, ChevronDown, Search, Settings, ChevronLeft, ChevronRight, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MapComponent from './components/MapComponent';
// src/App.tsx
import { ALL_ITINERARIES as initialItineraries } from './constants'; // 當作預設資料


//疲勞調整
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
    <div className="mb-0 select-none">
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-[12px] font-medium text-slate-600 tracking-tight">{label}</label>
      </div>
      <div 
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="relative h-3 w-full bg-[#E9EDF2] rounded-full cursor-pointer flex items-center"
      >
        <div 
          className="absolute h-full rounded-full transition-all duration-70"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
        <div 
          className="absolute w-6 h-6 bg-white rounded-full z-10 flex items-center justify-center transition-all duration-75"
          style={{ 
            left: `calc(${percentage}% - 12px)`, 
            border: `2px solid ${color}` 
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


  // 後端連ai
  // 新增狀態追蹤輸入內容與載入狀態
  const [inputLocation, setInputLocation] = useState("台南");
  const [inputDays, setInputDays] = useState("1");
  const [inputPreference, setInputPreference] = useState("古蹟與美食");
  const [isLoading, setIsLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>("");

  //建立呼叫後端 API 的函式
  const handleGenerateItinerary = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: inputLocation,
          startDate: startDate || new Date().toISOString().split('T')[0],
          days: inputDays,
          preference: inputPreference
        })
      });

      const newData = await response.json();
      
      // 將新拿到的資料格式化後塞入你的視覺化引擎
      // 注意：這裡你可以選擇更新全局變數或設一個新的 state 給 processedSections
      console.log("AI 生成行程成功:", newData);
      alert("行程已生成！請查看下方列表。");
      
      // 重新載入頁面或更新 State 以顯示新行程 (需配合你目前的資料驅動邏輯)
    } catch (error) {
      console.error("生成失敗:", error);
    } finally {
      setIsLoading(false);
    }
  };

  //連AI API
  const [itineraries, setItineraries] = useState(initialItineraries);
  const fetchItineraries = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/all-itineraries'); // 你需要在 server.js 補一個這條 API
      const data = await response.json();
      setItineraries(data);
    } catch (e) {
      console.error("無法載入資料庫", e);
    }
  };

  useEffect(() => {
    fetchItineraries(); // 網頁開啟就去拿最新的
  }, []);

  // Filter States
  
  // const today = new Date().toISOString().split('T')[0];
  // const [startDate, setStartDate] = useState<string>(today);
  // const [startDate, setStartDate] = useState<string>("");
  // const [endDate, setEndDate] = useState<string>("");
  // const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  // const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // 新增兩個狀態追蹤滑鼠位置與顯示開關 > 懸浮視窗用
  const [anchorEl, setAnchorEl] = useState<{ x: number, y: number } | null>(null);
  const [showFloating, setShowFloating] = useState(false);

  // Extract all unique types and date range for defaults
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    itineraries.forEach(it => {
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
    itineraries.forEach(it => {
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
    const initializeMetrics = async () => {
      try {
        // 🔴 新增：先從 Server 拿取 user_preference.json 的紀錄
        const res = await fetch('http://localhost:3000/api/attraction-preferences');
        const savedPrefs = await res.json();

        const initial: Record<string, Metrics> = {};
        itineraries.forEach(itinerary => {
          itinerary.result.forEach(item => {
            if (item.DataType === "Spot") {
              const spot = item as ItinerarySpot;
              const name = spot.SpotName;
              const uniqueKey = `${itinerary.id}-${name}`;
              
              // 🔴 修改：檢查是否有存檔紀錄，優先使用紀錄值
              // 🔴 檢查是否有存過紀錄，有就用紀錄，沒有就用預設
              const saved = savedPrefs[spot.SpotName];
              initial[uniqueKey] = {
                // 如果有存檔紀錄就用紀錄，否則統一預設為 5
                preference: saved?.preference || 5, 
                physical: saved?.phyFatigue || 5, 
                mental: saved?.menFatigue || 5
                // preference: saved?.preference || Math.round(spot.Rating * 2),
                // physical: saved?.phyFatigue || spot.WalkingLoad, // 這裡要對應 json 裡的 phyFatigue
                // mental: saved?.menFatigue || Math.round((spot.InfoLoad + spot.CrowdLevel) / 2)
              };
            }
          });
        });
        setMetricsMap(initial);

        // 預設選擇第一個景點
        const firstIt = itineraries[0];
        const firstSpot = firstIt.result.find(item => item.DataType === "Spot") as ItinerarySpot;
        if (firstSpot) setSelectedSpotId(`${firstIt.id}-${firstSpot.SpotName}`);
      } catch (err) {
        console.error("載入偏好紀錄失敗:", err);
      }
    };

    initializeMetrics();
  }, [itineraries]); // 確保行程更新時重新對齊

  const currentSpot = useMemo(() => {
    if (!selectedSpotId) return null;
    const [itId, spotName] = selectedSpotId.split('-');
    const it = itineraries.find(i => i.id === Number(itId));
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

  const handleUpdateMetrics = useCallback(async (newMetrics: Partial<Metrics>) => {
    if (!selectedSpotId) return;
    
    // 🔴 新增：從 ID 拆分出景點名稱 (例如 "1-赤崁樓" -> "赤崁樓")
    const spotName = selectedSpotId.split('-')[1];

    // 1. 本地 UI 立即更新
    // 2. 本地 UI 連動更新：一邊改，全部改
    setMetricsMap(prev => {
      const nextMap = { ...prev };
      
      // 💡 關鍵：掃描地圖中所有的 Key (例如 1-赤崁樓, 2-赤崁樓...)
      Object.keys(nextMap).forEach(key => {
        // 如果這個 Key 的名稱部分與當前景點相同
        if (key.split('-')[1] === spotName) {
          nextMap[key] = { ...nextMap[key], ...newMetrics };
        }
      });
      
      return nextMap;
    });

    // 2. 🔴 新增：同步存入後端的 user_preference.json
    try {
      await fetch('http://localhost:3000/api/update-attraction-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spotName: spotName,
          physical: newMetrics.physical,
          mental: newMetrics.mental,
          preference: newMetrics.preference
        })
      });
    } catch (e) {
      console.error("同步至伺服器失敗");
    }
  }, [selectedSpotId]);

  const getDaysGrouped = (itinerary: typeof itineraries[0]) => {
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

  //篩選
  const processedSections = useMemo(() => {
    // 如果沒有資料，直接回傳空陣列
    if (!itineraries || itineraries.length === 0) return [];
    
    // return itineraries
      // 不篩選
      // .filter(it => {
      //   // Date filter: check if any spot in itinerary is within range
      //   const hasDateMatch = it.result.some(item => 
      //     item.DataType === "Spot" && 
      //     (!startDate || item.Date >= startDate) && 
      //     (!endDate || item.Date <= endDate)
      //   );
        
      //   // Type filter: check if any spot in itinerary matches selected types
      //   const hasTypeMatch = selectedTypes.length === 0 || it.result.some(item => 
      //     item.DataType === "Spot" && item.SpotType.some(t => selectedTypes.includes(t))
      //   );

      //   return hasDateMatch && hasTypeMatch;
      // })
    return [...itineraries]
      .reverse()
      .map(it => {
        // 取得該行程的所有原始資料
        // const results = it.result || [];
        // const filteredResults = results;

        // 使用原本的輔助函式進行分組
        const days = getDaysGrouped(it);

        return {
          itinerary: it,
          days: days.map(([dayNum, dayData]) => ({
            originalDay: Number(dayNum),
            data: dayData
          }))
        };
      });
  }, [itineraries]);

  return (
    <div className="w-full h-screen flex flex-col bg-white overflow-hidden font-sans">
      <header className="w-full bg-[#EFEBE6] px-8 py-4 flex items-center z-20 shrink-0">
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center text-white font-black text-xl">
              EnT
            </div> */}
            <div className="hidden sm:block">
              <h1 className="text-lg font-extrabold text-[#5D4037] leading-tight">EnerTrip 
                {/* <span className="text-stone-600">視覺化</span> */}
              </h1>
              {/* <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Trip Engine</p> */}
            </div>
          </div>
        </div>



      {/* 新增的 AI 輸入區塊 */}
        <div className="flex-1 flex items-center gap-3 max-w-5xl pl-10">
          <label className="block text-xs font-bold text-stone-500 mb-0 ml-1 uppercase tracking-wider">
            目的地
          </label>
          <input 
            type="text" 
            placeholder="地點 (如: 台南)" 
            className="bg-white px-3 py-2 rounded-xl border border-slate-100 text-xs w-24 hover:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 transition-colors"
            value={inputLocation}
            onChange={(e) => setInputLocation(e.target.value)}
          />
          <label className="block text-xs font-bold text-stone-500 mb-0 ml-1 uppercase tracking-wider">
            天數
          </label>
          <input 
            type="number" 
            placeholder="天數" 
            className="bg-white px-3 py-2 rounded-xl border border-slate-100 text-xs w-16 hover:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 transition-colors"
            value={inputDays}
            onChange={(e) => setInputDays(e.target.value)}
          />
          <label className="block text-xs font-bold text-stone-500 mb-0 ml-1 uppercase tracking-wider">
            出發日期
          </label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-100 hover:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 cursor-pointer"
          />
          <label className="block text-xs font-bold text-stone-500 mb-0 ml-1 uppercase tracking-wider">
            偏好需求
          </label>
          <input 
            type="text" 
            placeholder="偏好 (例如: 適合長輩、古蹟美食...)" 
            className="flex-1 bg-white px-3 py-2 rounded-xl border border-slate-100 text-xs hover:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 transition-colors"
            value={inputPreference}
            onChange={(e) => setInputPreference(e.target.value)}
          />
          <button 
            onClick={handleGenerateItinerary}
            disabled={isLoading}
            className="bg-stone-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-700 disabled:bg-slate-600"
          >
            {isLoading ? "生成中..." : "行程規劃"}
          </button>
        </div>
                
      </header>

      {/* 主要畫面 */}
      <div className="flex-1 overflow-hidden bg-[#FFFCF9]">
        <main className="h-full overflow-y-auto p-3">
          {activeTab === 'visualizer' ? (
            <div className="flex flex-col lg:flex-row gap-8 min-h-full relative">

              {/* Toggle Button (Bump) Container - 增加一個外層來穩定交互 */}
              <div className="fixed top-1/2 -translate-y-1/2 z-50 flex items-center transition-all duration-500"
                  /* 打開時顯示按鈕跑到左邊 */
                  style={{ right: isPanelOpen ? '400px' : '0px' }}>
                  
                <motion.button
                  initial={false}
                  animate={{ scale: 1 }}
                  whileHover={{ x: -2 }} // 輕微縮小震動幅度，避免滑鼠滑出
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  className="bg-white border border-stone-300 border-r-0 py-2 px-1 rounded-l-2xl flex flex-col items-center group transition-colors hover:bg-stone-100 focus:outline-none"
                >
                  <div className={`p-2 rounded-lg ${isPanelOpen ? 'text-[#8D6E63]' : 'text-stone-400'} transition-colors`}>
                    {/* 根據狀態切換圖示：打開時顯示 ChevronRight，關閉時顯示 ChevronLeft */}
                    {isPanelOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                  </div> 
                </motion.button>
              </div>

              {/* Left: Scrollable Itineraries List */}
              <motion.div 
                layout
                // className={`flex-1 flex flex-col gap-4 pb-20 overflow-hidden transition-all duration-500 ${isPanelOpen ? 'lg:pr-4' : ''}`}// 動態空出右邊面板的寬度
                // className={`flex-1 flex flex-col gap-4 pb-5 overflow-y-auto transition-all duration-500 ${isPanelOpen ? 'lg:mr-[400px]' : 'mr-0'}`} // 假設面板寬度是 400px
                // 修正：使用 pr (padding-right) 或是讓 flex-1 自動處理寬度
                className={`flex-1 flex flex-col gap-4 pb-5 overflow-y-auto transition-all duration-500 ${
                  isPanelOpen ? 'lg:pr-[400px]' : 'pr-0'
                }`}
              >
                {processedSections.map((itSection) => (
                  <div key={itSection.itinerary.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-4 px-2">
                      <h2 className="text-sm font-black text-[#8B7E74] tracking-tight uppercase">行程 {itSection.itinerary.id}</h2>
                      <div className="h-px flex-1 bg-slate-50" />
                    </div>
                    
                    <div className="flex flex-col gap-0">
                      {itSection.days.map((day, dayIdx) => (
                        // 使用行程 ID + 日期 + 索引，確保絕對唯一
                        <div key={`${itSection.itinerary.id}-${day.originalDay}-${dayIdx}`} className="flex flex-col mb-1 bg-white rounded-2xl border border-slate-300 p-1">
                          <div className="overflow-x-auto custom-scrollbar">
                            <ItineraryVisualizer 
                              items={day.data.items} 
                              selectedSpotId={selectedSpotId}
                              itineraryId={itSection.itinerary.id}
                              dayNumber={day.originalDay}
                              date={day.data.date}
                              // onSelectSpot={(spot) => handleSelectSpot(itSection.itinerary.id, spot)}
                              // 要把 e 傳給 handleSelectSpot
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
              {/* Right: Map Panel */}
              <AnimatePresence>
                {isPanelOpen && (
                  <motion.div 
                    initial={{ x: 400, opacity: 0 }} // 從右邊滑入
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    // 關鍵：確保 h-full 能作用，父層必須有明確高度
                    // className="hidden lg:flex flex-col sticky top-0 h-[calc(100vh-140px)] z-30"
                    // 修正：使用 fixed 定位在最右邊，寬度固定 400px 
                    className="hidden lg:flex flex-col fixed top-[72px] right-0 w-[400px] h-[calc(100vh-72px)] z-30 bg-white border-l border-slate-100"
    
                  >
                    <div className="w-full h-full p-2">
                      {/* 上半部：地圖 (h-1/2) */}
                      <div className="bg-white h-1/2 w-full border border-slate-100 overflow-hidden relative">
                        {/* 放入剛寫好的地圖 */}
                        <MapComponent
                          items={processedSections} 
                          selectedSpotId={selectedSpotId}
                          currentSpot={currentSpot} // 直接把 App.tsx 算好的丟進去
                          onSelectSpot={handleSelectSpot}
                        />
                        
                      </div>
                      {/* 下半部：景點資料展示區 (新增) */}
                      <div className="flex-1 rounded-xl p-3 pt-1 overflow-y-auto custom-scrollbar">
                        {currentSpot ? (
                          <div className="flex flex-col gap-4">
                            <div>
                              <span className="text-xs font-black text-[#F2C8A2] uppercase tracking-widest">目前景點</span>
                              <h3 className="text-2xl font-bold text-slate-800">{currentSpot.SpotName}</h3>
                              <p className="text-xs text-slate-500 mt-1">{currentSpot.Address}</p>

                              <div className="grid grid-cols-2 gap-3 mt-3">
                                <div className="bg-white p-2 pl-3 rounded-lg border border-slate-200 ">
                                  <p className="text-xs text-slate-400 font-bold uppercase">停留時間</p>
                                  <p className="text-sm font-bold text-slate-700">{currentSpot.StartTime} - {currentSpot.EndTime}</p>
                                </div>
                                <div className="bg-white p-2 pl-3 rounded-lg border border-slate-200 ">
                                  <p className="text-xs text-slate-400 font-bold uppercase">連絡電話</p>
                                  <p className="text-sm font-bold text-slate-700">{currentSpot.Phone}</p>
                                </div>
                              </div>

                              {/* <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">景點介紹</p> */}
                              <p className="text-sm leading-relaxed text-slate-500 mt-3">
                                {currentSpot.Description || "暫無詳細介紹資料。"}
                              </p>
                              {/* 你可以根據 JSON 欄位自由增加，例如 SpotType */}
                              <div className="flex flex-wrap gap-2 mt-3">
                                {/* 💡 修正點：先檢查 SpotType 是否存在，且是否為陣列 */}
                                {Array.isArray(currentSpot.SpotType) ? (
                                  currentSpot.SpotType.map(type => (
                                    <span key={type} className="px-2 py-1 bg-stone-500 text-white text-xs font-bold rounded-md">
                                      #{type}
                                    </span>
                                  ))
                                ) : (
                                  // 如果不是陣列（例如是字串），就直接顯示該文字，或者顯示預設標籤
                                  currentSpot.SpotType && (
                                    <span className="px-2 py-1 bg-stone-500 text-white text-xs font-bold rounded-md">
                                      #{currentSpot.SpotType}
                                    </span>
                                  )
                                )}
                              </div>
                              
                            </div>
                            
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <Search size={40} strokeWidth={1} />
                            <p className="text-xs font-bold mt-2">點擊地圖景點查看資訊</p>
                          </div>
                        )}
                      </div>
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
                      zIndex: 100,
                      // --- 水平位置判斷 ---
                      // 如果點擊位置在螢幕右半邊，視窗改往左邊彈 (減去視窗寬度約 300px)
                      left: anchorEl.x > window.innerWidth / 2 
                        ? anchorEl.x - 300 
                        : anchorEl.x + 20,
                        
                      // --- 垂直位置判斷 ---
                      // 如果點擊位置在螢幕下半邊，視窗往上彈，否則往下彈
                      top: anchorEl.y > window.innerHeight / 2 
                        ? anchorEl.y - 200  // 往上彈
                        : anchorEl.y - 20,   // 往下彈
                    }}
                    className="w-60 bg-white/95 backdrop-blur-sm p-4 rounded-[1rem] border border-slate-300"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-[10px] font-black text-[#F2C8A2] uppercase">
                            景點調整
                        </div>
                        <div className="text-[16px] font-black text-slate-800">{currentSpot.SpotName}</div>
                      </div>
                      <button 
                        onClick={() => setShowFloating(false)}
                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    <div className="space-y-2">
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
