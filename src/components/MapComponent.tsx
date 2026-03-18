import React, { useEffect } from 'react';
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
const FlyToSpot = ({ spot }: { spot: ItinerarySpot | null }) => {
  const map = useMap();
  useEffect(() => {
    if (spot && spot.Latitude && spot.Longitude) {
      const zoom = 15;
      // 1. 先將經緯度轉換成地圖上的像素點座標
      const targetPoint = map.project([spot.Latitude, spot.Longitude], zoom);
      
      // 2. 進行像素偏移
      // x 為正值會將地圖中心向右移（景點就會看起來往左偏）
      // y 為正值會將地圖中心向下移（景點就會看起來往上偏）
      const offsetPoint = targetPoint.add([-200, -300]); // 偏移量
      
      // 3. 將偏移後的像素點轉回經緯度並飛行
      const targetLatLng = map.unproject(offsetPoint, zoom);
      map.flyTo(targetLatLng, zoom);
    }
  }, [spot, map]);
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
        top: isSelected ? '8px' : '7px', 
        width: isSelected ? '10px' : '8px',
        height: isSelected ? '10px' : '8px',
        backgroundColor: 'white', // 這裡的白色就是你看到的「洞」
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
  
  return (
    <div style={{ height: '100%', width: '100%', minHeight: '500px' }}>
      <MapContainer 
        center={[22.997, 120.213]}  //初始中心點
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* 直接用傳進來的 currentSpot */}
        <FlyToSpot spot={currentSpot} />

        {items.map((section) => (
            <React.Fragment key={section.itinerary.id}>
                {section.days.flatMap((day: any) => 
                day.data.items
                    .filter((item: any) => item.DataType === "Spot")
                    .map((spot: ItinerarySpot) => {
                    
                    // 1. 定義唯一的 Key 並判斷是否被選中
                    // 修正點：確保 ID 轉換為字串，並使用與 App.tsx 相同的 "-" 連接
                    const uniqueKey = `${String(section.itinerary.id)}-${spot.SpotName}`;
                    const isSelected = selectedSpotId === uniqueKey;

                    // 2. 顏色邏輯：選中顏色
                    const markerColor = isSelected ? '#f08547' : '#63b1f1';

                    return (
                        <Marker 
                        key={uniqueKey} 
                        position={[spot.Latitude, spot.Longitude]}
                        icon={createCustomIcon(markerColor, isSelected)} // 3. 傳入顏色與選中狀態
                        zIndexOffset={isSelected ? 1000 : 0} // 讓選中的永遠在最上面
                        eventHandlers={{
                            click: (e) => {
                                // 關鍵：阻止地圖觸發點擊事件，防止畫面亂跑
                                L.DomEvent.stopPropagation(e);
                                // 確保將原生事件傳回 App.tsx 以觸發懸浮窗
                                onSelectSpot(e.originalEvent, section.itinerary.id, spot);
                            }
                        }}
                        >
                        <Popup>
                            <div className="font-bold">{spot.SpotName}</div>
                            <div className="text-xs text-slate-500">{spot.Address}</div>
                        </Popup>
                        </Marker>
                    );
                    })
                )}
            </React.Fragment>
            ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;