import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type ItinerarySpot } from '../types';
import { MapPin } from 'lucide-react'; // 選用：讓標誌好看一點
import { renderToStaticMarkup } from 'react-dom/server';

// 修正圖標
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// 負責飛往選中點
// MapComponent.tsx

const FlyToSpot = ({ spot }: { spot: ItinerarySpot | null }) => {
  const map = useMap();
  // 💡 用 Ref 記錄「正在飛行中」或「已飛過」的景點名稱
  const processingSpot = React.useRef<string | null>(null);

  useEffect(() => {
    // 1. 取得數值並嚴格檢查
    const rawLat = spot?.Latitude;
    const rawLng = spot?.Longitude;
    const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
    const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));

    // 2. 💡 檢查：如果座標壞掉，或是跟上次飛的是同一個，就直接結束
    if (!spot || isNaN(lat) || isNaN(lng) || processingSpot.current === spot.SpotName) {
      return;
    }

    // 3. 準備目標座標
    const zoom = 15;
    const offsetLat = lat - 0.0055; // 緯度：數字越大，地圖中心越往上，景點就顯得越「靠下」
    const offsetLng = lng - 0.001; // 經度：數字越小（減更多），地圖中心越往左，景點就顯得越「靠右」

    // 4. 💡 終極防線：確保計算出來的偏移量也是數字
    if (!isNaN(offsetLat) && !isNaN(offsetLng)) {
      try {
        processingSpot.current = spot.SpotName; // 鎖定
        
        map.invalidateSize(); // 再次強制校準大小

        // 💡 改用 panTo + setZoom 的組合，有時候 flyTo 內部計算會因為動畫中途觸發而 NaN
        // 這樣寫最穩，不會報錯
        map.setView([offsetLat, offsetLng], zoom, {
          animate: true,
          duration: 0.8
        });

      } catch (e) {
        console.error("地圖移動失敗", e);
      }
    }
    
    // 只有當景點真的換人時，才允許下一次飛行
  }, [spot?.SpotName]); 

  return null;
};

//有沒有選中的icon
const createCustomIcon = (color: string, isSelected: boolean) => {
  const iconHtml = renderToStaticMarkup(
    <div style={{ 
      color: color,
      transform: isSelected ? 'scale(1.3)' : 'scale(1)', 
      filter: isSelected ? 'drop-shadow(0 0 6px rgb(0, 0, 0))' : 'none',
      transition: 'all 0.3s ease-in-out',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative' // 必須設定為 relative，小白點才能絕對定位在中心
    }}>
      {/* 1. 地點標誌：將外框設為 0 (或很細)，fill 設為 1 (完全不透明) */}
      <MapPin 
        size={isSelected ? 36 : 28} 
        fill={color} 
        fillOpacity={1} 
        strokeWidth={0} 
      />
      
      {/* 2. 強制製造出「洞」的效果：在正中心蓋一個白色圓點 */}
      <div style={{
        position: 'absolute',
        // 根據標誌頭部的圓心位置進行微調
        top: isSelected ? '10px' : '7px', 
        width: isSelected ? '10px' : '8px',
        height: isSelected ? '10px' : '8px',
        backgroundColor: 'white', // 白色的洞
        borderRadius: '50%',
        zIndex: 1000
      }} />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-marker-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

// 主組件
const MapComponent: React.FC<{
  items: any[];
  selectedSpotId: string | null;
  currentSpot: ItinerarySpot | null; // 接收 App.tsx 傳來的現成資料
  onSelectSpot: (e: any, id: number, spot: any) => void;
}> = ({ items, selectedSpotId, currentSpot, onSelectSpot }) => {

  // 💡 關鍵：這就是你要的「只用景點名稱畫圖」
  // 我們先掃描所有行程，把重複的景點拿掉，只留下唯一的景點清單來畫圖
  const uniqueSpots = useMemo(() => {
    const spotMap = new Map<string, { spot: ItinerarySpot, itineraryId: number }>();
    
    items.forEach(section => {
      section.days.forEach((day: any) => {
        day.data.items.forEach((item: any) => {
          if (item.DataType === "Spot") {
            const s = item as ItinerarySpot;
            
            // 💡 根據你的要求：檢查座標是否有效
            const lat = Number(s.Latitude);
            const lng = Number(s.Longitude);
            
            // 如果座標有效，且這個名稱還沒被畫過，就記錄下來
            if (!isNaN(lat) && !isNaN(lng) && !spotMap.has(s.SpotName)) {
              spotMap.set(s.SpotName, { spot: s, itineraryId: section.itinerary.id });
            }
          }
        });
      });
    });
    return Array.from(spotMap.values());
  }, [items]);
  
  return (
    <div style={{ height: '100%', width: '100%', minHeight: '500px' }}>
      <MapContainer 
        center={[22.997, 120.213]}  //初始中心點
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        {/* <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /> */}

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        />
        
        {/* 直接用傳進來的 currentSpot */}
        <FlyToSpot spot={currentSpot} />

        {/* 💡 修改這裡：不再用嵌套迴圈畫圖，而是用去重後的 uniqueSpots 畫 */}
        {uniqueSpots.map(({ spot, itineraryId }) => {
          
          // 1. 名稱唯一化：Key 只用名稱，解決「大酒店重複」報錯
          const markerKey = spot.SpotName; 
          
          // 2. 選中判定：只要名稱對了就變色 (實現全域同步)
          // 這裡從 selectedSpotId 拆出名稱來比對
          const isSelected = selectedSpotId?.split('-')[1] === spot.SpotName;
          const markerColor = isSelected ? '#5D4037' : '#a0796b';

          return (
            <Marker 
              key={markerKey} 
              position={[spot.Latitude, spot.Longitude]}
              icon={createCustomIcon(markerColor, isSelected)} 
              zIndexOffset={isSelected ? 1000 : 0} 
              eventHandlers={{
                click: (e) => {
                  // 保留你原本的事件阻斷與回傳邏輯
                  L.DomEvent.stopPropagation(e);
                  // onSelectSpot(e.originalEvent, itineraryId, spot);
                  // 這樣 handleSelectSpot 就不會設定 anchorEl，偏好疲勞調整窗就不會跳出來
                  onSelectSpot(null, itineraryId, spot);
                }
              }}
            >
              <Popup>
                <div className="w-48 p-1 flex flex-col gap-2"> 
    
                  {/* 圖片容器：這裡使用 React 的 state 或直接操作 DOM 來控制顯示 */}
                  <div 
                    // 預設可以先不設定 display，由內層 img 的偵測結果決定
                    className="w-full overflow-hidden rounded-lg bg-stone-100 cursor-pointer group relative"
                    onClick={() => window.open(new URL(`../assets/img/${spot.SpotName}.png`, import.meta.url).href, '_blank')}
                  >
                    <img 
                      /* 使用 Vite 的動態資源讀取方式 */
                      src={new URL(`../assets/img/${spot.SpotName}.png`, import.meta.url).href}
                      alt={spot.SpotName}
                      className="w-full h-28 object-cover block"
                      
                      // 如果圖片檔案不存在 (44 NotFound)，會觸發此函式
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        // 找到圖片的外層容器 (div) 並將其完全隱藏
                        if (target.parentElement) {
                          target.parentElement.style.display = 'none';
                        }
                      }}

                      // 選擇性：如果圖片加載成功，確保它是顯示的 (預防萬一)
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.parentElement) {
                          target.parentElement.style.display = 'block';
                        }
                      }}
                    />
                  </div>
                  
                  {/* 文字資訊：這部分無論有沒有圖都會顯示 */}
                  <div>
                    <div className="font-bold text-stone-800 text-sm">{spot.SpotName}</div>
                    <div className="text-[10px] text-stone-500 leading-tight mt-0.5">
                      {spot.Address}
                    </div>
                  </div>
                </div>
                {/* <div className="font-bold">{spot.SpotName}</div>
                <div className="text-xs text-slate-500">{spot.Address}</div> */}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapComponent;