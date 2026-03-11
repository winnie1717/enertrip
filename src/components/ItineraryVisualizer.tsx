
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { type ItineraryItem, type ItinerarySpot, type ItineraryTransport, type Metrics } from '../types';
import { COLORS } from '../constants';
interface ItineraryVisualizerProps {
  items: ItineraryItem[];
  selectedSpotId: string | null;
  itineraryId: number;
  dayNumber: number;
  date: string;
  onSelectSpot: (spot: ItinerarySpot) => void;
  metricsMap: Record<string, Metrics>;
}

const ItineraryVisualizer: React.FC<ItineraryVisualizerProps> = ({ 
  items, 
  selectedSpotId, 
  itineraryId, 
  dayNumber, 
  date, 
  onSelectSpot, 
  metricsMap 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // 調整邊距與比例
    const margin = { top: 60, right: 80, bottom: 20, left: 120 };
    const itemSpacing = 85;      
    const timelineY = 180;      
    const spotBaseAltitude = 54; 
    const fatigueScale = 10;     

    //24h時間軸
    const fixedTimelineLength = 1000; 
    
    const contentWidth = Math.max(fixedTimelineLength, (items.length - 1) * itemSpacing);
    const totalWidth = contentWidth + margin.left + margin.right;
    const totalHeight = 240;     

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    svg.attr('width', totalWidth).attr('height', totalHeight);

    const defs = svg.append('defs');
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Day Label (左上方標註)
    g.append('text')
      .attr('x', -100)
      .attr('y', -45)
      .attr('class', 'font-black fill-indigo-600')
      .attr('font-size', '13px')
      .attr('letter-spacing', '0.05em')
      .text(`DAY ${dayNumber} — ${date}`);

    const getHours = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h + m / 60;
    };

    const parseNum = (str: string) => parseFloat(str.split(' ')[0]) || 0;

    const getSpotCenterY = (spotName: string) => {
      const uniqueKey = `${itineraryId}-${spotName}`;
      const m = metricsMap[uniqueKey];
      if (!m) return timelineY - spotBaseAltitude;
      const maxFatigue = Math.max(m.physical, m.mental);
      return timelineY - spotBaseAltitude - (maxFatigue * fatigueScale);
    };

    // 預先計算所有節點的座標，用於繪製背景連接線
    const points: [number, number][] = items.map((item, idx) => {
      const x = idx * itemSpacing;
      if (item.DataType === "Spot") {
        return [x, getSpotCenterY(item.SpotName)];
      } else {
        const prevSpot = items[idx - 1] as ItinerarySpot;
        const nextSpot = items[idx + 1] as ItinerarySpot;
        if (prevSpot && nextSpot) {
          const yA = getSpotCenterY(prevSpot.SpotName);
          const yB = getSpotCenterY(nextSpot.SpotName);
          return [x, (yA + yB) / 2];
        }
        return [x, timelineY - spotBaseAltitude];
      }
    });

    // 建立各個圖層，順序決定了遮蓋關係（先建立的在最底下）
    const layerPath = g.append('g').attr('name', 'itinerary-path'); 
    const layerTransports = g.append('g').attr('name', 'transports'); 
    const layerHighlight = g.append('g').attr('name', 'highlight');  
    const layerPoles = g.append('g').attr('name', 'poles');          
    const layerSpots = g.append('g').attr('name', 'spots');          

    // 繪製背景連接線
    const lineGenerator = d3.line().curve(d3.curveMonotoneX);
    layerPath.append('path')
      .attr('d', lineGenerator(points))
      .attr('fill', 'none')
      .attr('stroke', '#E2E8F0')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '4,4') // 使用虛線增加層次感，也可改為實線
      .attr('opacity', 0.6);

    const timelineScale = d3.scaleLinear().domain([0, 24]).range([0, fixedTimelineLength]);
    const timelineGroup = g.append('g').attr('transform', `translate(0, ${timelineY})`);
    
    timelineGroup.append('line')
      .attr('x1', 0).attr('x2', fixedTimelineLength)
      .attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#e2e8f0').attr('stroke-width', 1.5).attr('stroke-linecap', 'round');

    [0, 6, 12, 18, 24].forEach(h => {
      timelineGroup.append('text')
        .attr('x', timelineScale(h))
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .attr('class', 'text-[8px] font-black fill-slate-300')
        .text(`${h}:00`);
    });

    items.forEach((item, idx) => {
      const x = points[idx][0];
      const centerY = points[idx][1];
      
      if (item.DataType === "Spot") {
        const spot = item;
        const uniqueKey = `${itineraryId}-${spot.SpotName}`;
        const metrics = metricsMap[uniqueKey] || { preference: 5, physical: 5, mental: 5 };

        if (selectedSpotId === uniqueKey) {
          layerHighlight.append('circle')
            .attr('cx', x)
            .attr('cy', centerY)
            .attr('r', 65) 
            .attr('fill', '#D9C1BF')
            .attr('stroke', '#A69296')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.25);
        }

        const poleG = layerPoles.append('g').attr('transform', `translate(${x}, ${timelineY})`);
        const physH = metrics.physical * fatigueScale;
        poleG.append('rect')
          .attr('x', -5).attr('y', -physH).attr('width', 4).attr('height', physH)
          .attr('fill', COLORS.physical).attr('rx', 1.5).attr('opacity', 0.9);
        const mentH = metrics.mental * fatigueScale;
        poleG.append('rect')
          .attr('x', 1).attr('y', -mentH).attr('width', 4).attr('height', mentH)
          .attr('fill', COLORS.mental).attr('rx', 1.5).attr('opacity', 0.9);

        const spotG = layerSpots.append('g')
          .attr('transform', `translate(${x}, ${centerY})`)
          .style('cursor', 'pointer')
          .on('click', () => onSelectSpot(spot));

        const innerR = 25, midR = 33, outerR = 41; 
        const arc = d3.arc<any>().innerRadius(innerR).outerRadius(outerR);
        spotG.append('circle').attr('r', innerR).attr('fill', 'white').attr('stroke', COLORS.outline).attr('stroke-width', 0.8);
        
        const maxCostRef = 500;
        const fillH = (Math.min(1, spot.Cost / maxCostRef)) * (innerR * 2);
        const clipId = `cost-clip-${idx}-${spot.Day}-${itineraryId}`;
        defs.append('clipPath').attr('id', clipId).append('rect').attr('x', -innerR).attr('y', innerR - fillH).attr('width', innerR * 2).attr('height', fillH);
        spotG.append('circle').attr('r', innerR).attr('fill', COLORS.costFill).attr('clip-path', `url(#${clipId})`);

        // 上半圓 (偏好)
        spotG.append('path').attr('d', arc({ startAngle: -Math.PI/2, endAngle: Math.PI/2 })).attr('fill', '#fafafa');
        spotG.append('path').attr('d', arc({ startAngle: -Math.PI/2, endAngle: -Math.PI/2 + (Math.PI * (metrics.preference / 10)) })).attr('fill', COLORS.preference);
        spotG.append('path').attr('d', arc({ startAngle: -Math.PI/2, endAngle: Math.PI/2 })).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 0.3);
        
        // 下半圓 (生理與心理負荷)
        const phArc = d3.arc<any>().innerRadius(innerR).outerRadius(midR);
        spotG.append('path').attr('d', phArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5 })).attr('fill', '#fafafa');
        spotG.append('path').attr('d', phArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 1.5 - (Math.PI * (metrics.physical / 10)) })).attr('fill', COLORS.physical);
        spotG.append('path').attr('d', phArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5 })).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 0.3);
        
        const meArc = d3.arc<any>().innerRadius(midR).outerRadius(outerR);
        spotG.append('path').attr('d', meArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5 })).attr('fill', '#fafafa');
        spotG.append('path').attr('d', meArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 1.5 - (Math.PI * (metrics.mental / 10)) })).attr('fill', COLORS.mental);
        spotG.append('path').attr('d', meArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5 })).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 0.3);

        // 星星精確填色 (水平漸層)
        const rating = spot.Rating || 0;
        const starG = spotG.append('g').attr('transform', 'translate(0, -2)');
        // 假設原本星星的基礎位置是 spotX
        for (let i = 0; i < 5; i++) {
          const diff = rating - i;
          // 確保填色百分比在 0-100 之間
          const fillPerc = Math.max(0, Math.min(100, diff * 100));
          // 唯一的 ID 加上 spot.id 或 idx 防止多個景點時發生衝突
          const starId = `star-grad-${idx}-${spot.Day}-${itineraryId}-${i}`;
          
          // --- 修改排列邏輯 ---
          let starX, starY;
          const starSize = 12; // 星星大小
          const gap = 0;       // 星星間距
          
          if (i < 2) {
            // 上面兩顆：i 為 0, 1
            // 置中算法：(i - 0.5) * (大小 + 間距)
            starX = (i - 0.5) * (starSize + gap);
            starY = -10; // 第一排的高度（往上移）
          } else {
            // 下面三顆：i 為 2, 3, 4
            // 置中算法：(i - 3) * (大小 + 間距)
            starX = (i - 3) * (starSize + gap);
            starY = 0;   // 第二排的高度（原本高度）
          }

          //  建立星星的群組並設定位移
          const starGroup = starG.append('g')
            // 將計算好的 starX, starY 套用到 transform
            .attr('transform', `translate(${starX}, ${starY})`);
          
          // 在既有的 defs 裡新增漸層定義
          const grad = defs.append('linearGradient')
            .attr('id', starId)
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '100%').attr('y2', '0%');
          
          // 金色填充部分
          grad.append('stop').attr('offset', `${fillPerc}%`).attr('stop-color', '#ffae00');
          // 灰色剩餘部分 (使用相同 offset 創造出俐落的切割線)
          grad.append('stop').attr('offset', `${fillPerc}%`).attr('stop-color', '#E5E7EB');

          // 畫出星星路徑，並套用這個漸層
          starGroup.append('path')
            // 這串 D 是標準星星形狀，中心點大約在 (6, 6)
            .attr('d', "M6 0L7.4 4.3H12L8.3 7L9.7 11.3L6 8.6L2.3 11.3L3.7 7L0 4.3H4.6L6 0Z")//星星svg
            .attr('fill', `url(#${starId})`)
            // 重點：translate(-6, -6) 是為了讓星星的中心對準 starGroup 的 (0,0)
            .attr('transform', `scale(0.8) translate(-6, -6)`);
          
        }
        spotG.append('text').attr('y', 15).attr('text-anchor', 'middle').attr('class', 'font-black fill-slate-400').attr('font-size', '10px').text(`$${spot.Cost}`);
        spotG.append('text').attr('y', 51.5).attr('text-anchor', 'middle').attr('class', 'sketch-font font-bold text-[10px] fill-slate-800').text(spot.SpotName);

        const drawSat = (satId: string, angle: number, icon: string, percentage: number, color: string) => {
          const rad = (angle - 90) * (Math.PI / 180), dist = 52; 
          const sx = Math.cos(rad) * dist, sy = Math.sin(rad) * dist, r = 9; 
          const satG = spotG.append('g').attr('transform', `translate(${sx}, ${sy})`);
          const sClipId = `sat-clip-${idx}-${satId}-${spot.Day}-${itineraryId}`;
          const sfH = (percentage / 100) * (r * 2);
          defs.append('clipPath').attr('id', sClipId).append('rect').attr('x', -r).attr('y', r - sfH).attr('width', r * 2).attr('height', sfH);
          satG.append('circle').attr('r', r).attr('fill', 'white').attr('stroke', COLORS.outline).attr('stroke-width', 0.6);
          satG.append('circle').attr('r', r).attr('fill', color).attr('opacity', 0.4).attr('clip-path', `url(#${sClipId})`);
          satG.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', '7px').text(icon);
        };
        drawSat("walk", -60, "👣", (spot.WalkingLoad/10)*100, COLORS.physical);
        drawSat("space", -30, spot.IndoorOutdoor === "室內" ? "🏠" : "🌳", 50, COLORS.physical);
        drawSat("weather", 0, "☀️", 80, COLORS.physical);
        drawSat("crowd", 30, "👥", (spot.CrowdLevel/10)*100, COLORS.mental);
        drawSat("info", 60, "ℹ️", (spot.InfoLoad/10)*100, COLORS.mental);

        const startX = timelineScale(getHours(spot.StartTime));
        const endX = timelineScale(getHours(spot.EndTime));
        timelineGroup.append('line')
          .attr('x1', startX).attr('x2', endX).attr('y1', 0).attr('y2', 0)
          .attr('stroke', COLORS.timelineSpot).attr('stroke-width', 3).attr('stroke-linecap', 'butt');

      } else {
        const transport = item as ItineraryTransport;
        const transG = layerTransports.append('g').attr('transform', `translate(${x}, ${centerY})`);
        const innerR = 10, outerR = 14;

        transG.append('circle').attr('r', innerR).attr('fill', 'white').attr('stroke', '#e2e8f0').attr('stroke-width', 0.8);
        transG.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', '7px').text(transport.TransportType === "步行" ? "👣" : "🚗");

        const distVal = parseNum(transport.Distance);
        const maxDistRef = 5, distPerc = Math.min(1, distVal / maxDistRef);
        const distArc = d3.arc<any>().innerRadius(innerR).outerRadius(outerR);
        transG.append('path').attr('d', distArc({ startAngle: 1.5 * Math.PI, endAngle: 2.5 * Math.PI })).attr('fill', '#f8fafc');
        transG.append('path').attr('d', distArc({ startAngle: 1.5 * Math.PI, endAngle: 1.5 * Math.PI + (distPerc * Math.PI) })).attr('fill', '#4ade80').attr('opacity', 0.8);

        const durVal = parseNum(transport.Duration);
        const maxDurRef = 30, durPerc = Math.min(1, durVal / maxDurRef);
        const durArc = d3.arc<any>().innerRadius(innerR).outerRadius(outerR);
        transG.append('path').attr('d', durArc({ startAngle: 1.5 * Math.PI, endAngle: 0.5 * Math.PI })).attr('fill', '#f8fafc');
        transG.append('path').attr('d', durArc({ startAngle: 1.5 * Math.PI, endAngle: 1.5 * Math.PI - (durPerc * Math.PI) }))
          .attr('fill', '#3b82f6').attr('opacity', 0.5);

        const speedVal = parseNum(transport.Speed);
        const maxSpeedRef = 60;
        const speedPerc = Math.min(1, speedVal / maxSpeedRef);
        const speedAngleDeg = -45 + (speedPerc * 90);
        const triG = transG.append('g').attr('transform', `rotate(${speedAngleDeg}) translate(0, -${outerR + 2})`);
        triG.append('path').attr('d', 'M -1.5,-3 L 1.5,-3 L 0,0 Z').attr('fill', '#f97316');

        const prevSpot = items[idx-1] as ItinerarySpot;
        const nextSpot = items[idx+1] as ItinerarySpot;
        if (prevSpot && nextSpot) {
          const midTime = (getHours(prevSpot.EndTime) + getHours(nextSpot.StartTime)) / 2;
          timelineGroup.append('circle').attr('cx', timelineScale(midTime)).attr('r', 1.5).attr('fill', COLORS.timelineDot).attr('stroke', 'white').attr('stroke-width', 1);
        }
      }
    });

  }, [items, selectedSpotId, metricsMap, itineraryId, dayNumber, date]);

  return (
    <div className="w-full bg-white overflow-x-auto custom-scrollbar">
      <svg
        ref={svgRef}
        className="block"
      />
    </div>
  );
};

export default ItineraryVisualizer;
