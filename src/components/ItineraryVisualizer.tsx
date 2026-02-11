
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

    // Configurable parameters
    const margin = { top: 80, right: 100, bottom: 40, left: 120 };
    const itemSpacing = 85;      
    const timelineY = 250;      
    const spotBaseAltitude = 60; 
    const fatigueScale = 12;     

    // Strictly fixed timeline length for consistent visual reference across all charts
    const fixedTimelineLength = 1000; 
    
    // Dynamic SVG width depends on content length, which can exceed the timeline length
    const contentWidth = Math.max(fixedTimelineLength, (items.length - 1) * itemSpacing);
    const totalWidth = contentWidth + margin.left + margin.right;
    const totalHeight = 350;     

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    svg.attr('width', totalWidth).attr('height', totalHeight);

    const defs = svg.append('defs');
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Day Label inside the chart area (top-left)
    g.append('text')
      .attr('x', -100)
      .attr('y', -45)
      .attr('class', 'font-bold fill-sky-500')
      .attr('font-size', '14px')
      .attr('letter-spacing', '0.05em')
      .text(`DAY ${dayNumber}`);

    g.append('text')
      .attr('x', -100)
      .attr('y', -25)
      .attr('class', 'font-black fill-gray-500')
      .attr('font-size', '14px')
      .attr('letter-spacing', '0.05em')
      .text(`${date}`);

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


    // --- 分層渲染準備 (由下而上) ---
    const layerPath = g.append('g').attr('name', 'itinerary-path'); 
    const layerTransports = g.append('g').attr('name', 'transports'); 
    const layerHighlight = g.append('g').attr('name', 'highlight');  
    const layerPoles = g.append('g').attr('name', 'poles');          
    const layerSpots = g.append('g').attr('name', 'spots');    

    // 背景 24H 時間軸 Time scale based on the fixed reference length
    const timelineScale = d3.scaleLinear().domain([0, 24]).range([0, fixedTimelineLength]);
    const timelineGroup = g.append('g').attr('transform', `translate(0, ${timelineY})`);
    
    // The grey reference timeline (fixed length)
    timelineGroup.append('line')
      .attr('x1', 0).attr('x2', fixedTimelineLength)
      .attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#d8dfe7').attr('stroke-width', 2).attr('stroke-linecap', 'round');

    // Hour markings on the timeline
    [0, 6, 12, 18, 24].forEach(h => {
      timelineGroup.append('text')
        .attr('x', timelineScale(h))
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .attr('class', 'text-[8px] font-black fill-slate-600')
        .text(`${h}:00`);
    });

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

    // 繪製背景連接線
    const lineGenerator = d3.line().curve(d3.curveMonotoneX);
    layerPath.append('path')
      .attr('d', lineGenerator(points))
      .attr('fill', 'none')
      .attr('stroke', '#f0e2ee')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4') // 使用虛線增加層次感，也可改為實線
      .attr('opacity', 0.8);
      

    // 2. 渲染邏輯
    items.forEach((item, idx) => {
      const x = idx * itemSpacing; // Layout spacing remains proportional to item count
      
      if (item.DataType === "Spot") {
        const spot = item;
        const uniqueKey = `${itineraryId}-${spot.SpotName}`;
        const metrics = metricsMap[uniqueKey] || { preference: 5, physical: 5, mental: 5 };
        const centerY = getSpotCenterY(spot.SpotName);

        // --- 1. Highlight 層 (選中時顯示圓形背景) ---
        if (selectedSpotId === uniqueKey) {
          layerHighlight.append('circle')
            .attr('cx', x)
            .attr('cy', centerY)
            .attr('r', 85) 
            .attr('fill', '#d8b5b1')
            .attr('stroke', '#a78b90')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.3);
        }

        // --- 2. 支柱層 ---
        const poleG = layerPoles.append('g').attr('transform', `translate(${x}, ${timelineY})`);
        // const maxFatigue = Math.max(metrics.physical, metrics.mental);
        // const trackHeight = maxFatigue * fatigueScale + 10;
        // poleG.append('rect')
        //   .attr('x', -6).attr('y', -trackHeight).attr('width', 12).attr('height', trackHeight)
        //   .attr('fill', '#f8fafc').attr('rx', 2);
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

        //上半圓
        spotG.append('path').attr('d', arc({ startAngle: -Math.PI/2, endAngle: Math.PI/2})).attr('fill', '#fafafa');
        spotG.append('path').attr('d', arc({ startAngle: -Math.PI/2, endAngle: -Math.PI/2 + (Math.PI * (metrics.preference / 10)) })).attr('fill', COLORS.preference);
        spotG.append('path').attr('d', arc({ startAngle: -Math.PI/2, endAngle: Math.PI/2 })).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 0.5);
        //下半圓
        spotG.append('path').attr('d', arc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5})).attr('fill', '#fafafa');
        const phArc = d3.arc<any>().innerRadius(innerR).outerRadius(midR);
        spotG.append('path').attr('d', phArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 1.5 - (Math.PI * (metrics.physical / 10)) })).attr('fill', COLORS.physical);
        spotG.append('path').attr('d', phArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5})).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 0.5);
        const meArc = d3.arc<any>().innerRadius(midR).outerRadius(outerR);
        spotG.append('path').attr('d', meArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 1.5 - (Math.PI * (metrics.mental / 10)) })).attr('fill', COLORS.mental);
        spotG.append('path').attr('d', meArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5})).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 0.5);

        // 星星精確填色 (水平漸層)
        const rating = spot.Rating || 0;
        const starG = spotG.append('g').attr('transform', 'translate(0, -2)');
        for (let i = 0; i < 5; i++) {
            const diff = rating - i;
            // 確保填色百分比在 0-100 之間
            const fillPerc = Math.max(0, Math.min(1, diff)) * 100;
            // 唯一的 ID，建議加上 spot.id 或 idx 防止多個景點時發生衝突
            const gradientId = `star-grad-${idx}-${spot.Day}-${i}`;
            
            // 1. 在既有的 defs 裡新增漸層定義
            const grad = defs.append('linearGradient')
                .attr('id', gradientId)
                .attr('x1', '0%').attr('y1', '0%')
                .attr('x2', '100%').attr('y2', '0%');
            
            // 金色填充部分
            grad.append('stop').attr('offset', `${fillPerc}%`).attr('stop-color', '#FFB800');
            // 灰色剩餘部分 (使用相同 offset 創造出俐落的切割線)
            grad.append('stop').attr('offset', `${fillPerc}%`).attr('stop-color', '#E5E7EB');

            // 2. 畫出星星文字，並套用這個漸層
            starG.append('text')
                .attr('x', (i - 2) * 8) // 控制星星之間的水平間距
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
                .attr('fill', `url(#${gradientId})`) // 關鍵：引用上面的漸層 ID
                .style('font-family', 'sans-serif')
                .text('★');
        }


        spotG.append('text').attr('y', 10).attr('text-anchor', 'middle').attr('class', 'font-black fill-slate-400').attr('font-size', '6px').text(`$${spot.Cost}`);
        spotG.append('text').attr('y', 55).attr('text-anchor', 'middle').attr('class', 'sketch-font font-bold text-[11px] fill-slate-600').text(spot.SpotName);

        const drawSat = (satId: string, angle: number, icon: string, percentage: number, color: string) => {
          const rad = (angle - 90) * (Math.PI / 180), dist = 55; 
          const sx = Math.cos(rad) * dist, sy = Math.sin(rad) * dist, r = 10; 
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
        // Note: these segments only appear if they fall within the 24h timeline
        timelineGroup.append('line')
          .attr('x1', startX).attr('x2', endX).attr('y1', 0).attr('y2', 0)
          .attr('stroke', COLORS.timelineSpot).attr('stroke-width', 4).attr('stroke-linecap', 'butt');

      } else {
        // --- 4. 交通方式層 (位於最底層) ---
        const transport = item as ItineraryTransport;
        const prevSpot = items[idx-1] as ItinerarySpot;
        const nextSpot = items[idx+1] as ItinerarySpot;
        if (!prevSpot || !nextSpot) return;
        
        const yA = getSpotCenterY(prevSpot.SpotName);
        const yB = getSpotCenterY(nextSpot.SpotName);
        const transportCenterY = (yA + yB) / 2;

        const transG = layerTransports.append('g').attr('transform', `translate(${x}, ${transportCenterY})`);
        const innerR = 12, outerR = 16;

        transG.append('circle').attr('r', innerR).attr('fill', 'white').attr('stroke', '#e2e8f0').attr('stroke-width', 0.8);
        transG.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', '8px').text(transport.TransportType === "步行" ? "👣" : "🚗");

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

        const midTime = (getHours(prevSpot.EndTime) + getHours(nextSpot.StartTime)) / 2;
        timelineGroup.append('circle').attr('cx', timelineScale(midTime)).attr('r', 2).attr('fill', COLORS.timelineDot).attr('stroke', 'white').attr('stroke-width', 1);
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
