//一天行程

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { type ItineraryItem, type ItinerarySpot, type ItineraryTransport, type Metrics } from '../types';
import { COLORS } from '../constants';

interface ItineraryVisualizerProps {
  items: ItineraryItem[];
  selectedSpotId: string | null;
  onSelectSpot: (spot: ItinerarySpot) => void;
  metricsMap: Record<string, Metrics>;
}

const ItineraryVisualizer: React.FC<ItineraryVisualizerProps> = ({ items, selectedSpotId, onSelectSpot, metricsMap }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // 增加 margin.left 從 100 到 160，確保半徑 145 的 Highlight 圓形不會超出左側邊界
    const margin = { top: 160, right: 100, bottom: 80, left: 160 };
    const itemSpacing = 150; 
    const timelineFullWidth = 1000;
    const timelineY = 650;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    const getHours = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h + m / 60;
    };

    const parseNum = (str: string) => parseFloat(str.split(' ')[0]) || 0;

    const fatigueScale = 28; 
    const spotBaseAltitude = 135; 

    const getSpotCenterY = (spotName: string) => {
      const m = metricsMap[spotName];
      if (!m) return timelineY - spotBaseAltitude;
      const maxFatigue = Math.max(m.physical, m.mental);
      return timelineY - spotBaseAltitude - (maxFatigue * fatigueScale);
    };

    // --- 背景 24H 時間軸 ---
    const timelineScale = d3.scaleLinear().domain([0, 24]).range([0, timelineFullWidth]);
    const timelineGroup = g.append('g').attr('transform', `translate(0, ${timelineY})`);
    
    timelineGroup.append('line')
      .attr('x1', 0).attr('x2', timelineFullWidth)
      .attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#cbd5e1').attr('stroke-width', 2).attr('stroke-linecap', 'round');

    [0, 6, 12, 18, 24].forEach(h => {
      timelineGroup.append('text')
        .attr('x', timelineScale(h))
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .attr('class', 'text-[10px] font-black fill-slate-400')
        .text(`${h}:00`);
    });

    // --- 分層渲染準備 (由下而上) ---
    const layerTransports = g.append('g').attr('name', 'transports'); // 交通方式在最底
    const layerHighlight = g.append('g').attr('name', 'highlight');  // Highlight 在交通之上
    const layerPoles = g.append('g').attr('name', 'poles');          // 支柱
    const layerSpots = g.append('g').attr('name', 'spots');          // 景點內容在最上層

    // 2. 渲染邏輯
    items.forEach((item, idx) => {
      const x = idx * itemSpacing;
      
      if (item.DataType === "Spot") {
        const spot = item;
        const metrics = metricsMap[spot.SpotName];
        const centerY = getSpotCenterY(spot.SpotName);

        // --- 1. Highlight 層 (選中時顯示圓形背景) ---
        if (selectedSpotId === spot.SpotName) {
          layerHighlight.append('circle')
            .attr('cx', x)
            .attr('cy', centerY)
            .attr('r', 145) // 半徑 145 
            .attr('fill', '#D9C1BF')
            .attr('stroke', '#A69296')
            .attr('stroke-width', 1)
            .attr('opacity', 0.2);
        }

        // --- 2. 支柱層 ---
        const poleG = layerPoles.append('g').attr('transform', `translate(${x}, ${timelineY})`);
        // const maxFatigue = Math.max(metrics.physical, metrics.mental);
        // const trackHeight = maxFatigue * fatigueScale + 15;
        // poleG.append('rect')
        //   .attr('x', -10).attr('y', -trackHeight).attr('width', 20).attr('height', trackHeight)
        //   .attr('fill', '#f1f5f9').attr('rx', 4).attr('opacity', 0);
        const physH = metrics.physical * fatigueScale;
        poleG.append('rect')
          .attr('x', -9).attr('y', -physH).attr('width', 8).attr('height', physH)
          .attr('fill', COLORS.physical).attr('rx', 3).attr('opacity', 0.9);
        const mentH = metrics.mental * fatigueScale;
        poleG.append('rect')
          .attr('x', 1).attr('y', -mentH).attr('width', 8).attr('height', mentH)
          .attr('fill', COLORS.mental).attr('rx', 3).attr('opacity', 0.9);

        // --- 3. 景點內容層 ---
        const spotG = layerSpots.append('g')
          .attr('transform', `translate(${x}, ${centerY})`)
          .style('cursor', 'pointer')
          .on('click', () => onSelectSpot(spot));

        const innerR = 50, midR = 65, outerR = 80;
        const arc = d3.arc<any>().innerRadius(innerR).outerRadius(outerR);
        spotG.append('circle').attr('r', innerR).attr('fill', 'white').attr('stroke', COLORS.outline).attr('stroke-width', 1.5);
        
        const maxCostRef = 500;
        const fillH = (Math.min(1, spot.Cost / maxCostRef)) * (innerR * 2);
        const clipId = `cost-clip-v8-${idx}`;
        defs.append('clipPath').attr('id', clipId).append('rect').attr('x', -innerR).attr('y', innerR - fillH).attr('width', innerR * 2).attr('height', fillH);
        spotG.append('circle').attr('r', innerR).attr('fill', COLORS.costFill).attr('clip-path', `url(#${clipId})`);

        spotG.append('path').attr('d', arc({ startAngle: -Math.PI/2, endAngle: Math.PI/2 })).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 0.5);
        spotG.append('path').attr('d', arc({ startAngle: -Math.PI/2, endAngle: -Math.PI/2 + (Math.PI * (metrics.preference / 10)) })).attr('fill', COLORS.preference);
        const phArc = d3.arc<any>().innerRadius(innerR).outerRadius(midR);
        spotG.append('path').attr('d', phArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 1.5 - (Math.PI * (metrics.physical / 10)) })).attr('fill', COLORS.physical);
        const meArc = d3.arc<any>().innerRadius(midR).outerRadius(outerR);
        spotG.append('path').attr('d', meArc({ startAngle: Math.PI * 1.5, endAngle: Math.PI * 1.5 - (Math.PI * (metrics.mental / 10)) })).attr('fill', COLORS.mental);

        const starG = spotG.append('g').attr('transform', 'translate(0, -6)');
        for (let i = 0; i < 5; i++) {
          starG.append('text').attr('x', (i - 2) * 14).attr('text-anchor', 'middle').attr('font-size', '15px').attr('fill', i < Math.floor(spot.Rating) ? COLORS.star : '#e2e8f0').text('★');
        }
        spotG.append('text').attr('y', 20).attr('text-anchor', 'middle').attr('class', 'font-black fill-slate-400').attr('font-size', '10px').text(`$${spot.Cost}`);
        spotG.append('text').attr('y', 110).attr('text-anchor', 'middle').attr('class', 'sketch-font font-bold text-lg fill-slate-800').text(spot.SpotName);

        const drawSat = (satId: string, angle: number, icon: string, percentage: number, color: string) => {
          const rad = (angle - 90) * (Math.PI / 180), dist = 110;
          const sx = Math.cos(rad) * dist, sy = Math.sin(rad) * dist, r = 18;
          const satG = spotG.append('g').attr('transform', `translate(${sx}, ${sy})`);
          const sClipId = `sat-clip-v8-${idx}-${satId}`;
          const sfH = (percentage / 100) * (r * 2);
          defs.append('clipPath').attr('id', sClipId).append('rect').attr('x', -r).attr('y', r - sfH).attr('width', r * 2).attr('height', sfH);
          satG.append('circle').attr('r', r).attr('fill', 'white').attr('stroke', COLORS.outline).attr('stroke-width', 1);
          satG.append('circle').attr('r', r).attr('fill', color).attr('opacity', 0.4).attr('clip-path', `url(#${sClipId})`);
          satG.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', '12px').text(icon);
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
          .attr('stroke', COLORS.timelineSpot).attr('stroke-width', 10).attr('stroke-linecap', 'butt');

      } else {
        // --- 4. 交通方式層 (位於最底層) ---
        const transport = item as ItineraryTransport;
        const prevSpot = items[idx-1] as ItinerarySpot;
        const nextSpot = items[idx+1] as ItinerarySpot;
        const yA = getSpotCenterY(prevSpot.SpotName);
        const yB = getSpotCenterY(nextSpot.SpotName);
        const transportCenterY = (yA + yB) / 2;

        const transG = layerTransports.append('g').attr('transform', `translate(${x}, ${transportCenterY})`);
        const innerR = 26, outerR = 34;

        transG.append('circle').attr('r', innerR).attr('fill', 'white').attr('stroke', '#cbd5e1').attr('stroke-width', 1.5);
        transG.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', '16px').text(transport.TransportType === "步行" ? "👣" : "🚗");

        const distVal = parseNum(transport.Distance);
        const maxDistRef = 5, distPerc = Math.min(1, distVal / maxDistRef);
        const distArc = d3.arc<any>().innerRadius(innerR).outerRadius(outerR);
        transG.append('path').attr('d', distArc({ startAngle: 1.5 * Math.PI, endAngle: 2.5 * Math.PI })).attr('fill', '#f1f5f9');
        transG.append('path').attr('d', distArc({ startAngle: 1.5 * Math.PI, endAngle: 1.5 * Math.PI + (distPerc * Math.PI) })).attr('fill', '#4ade80').attr('opacity', 0.8);

        const durVal = parseNum(transport.Duration);
        const maxDurRef = 30, durPerc = Math.min(1, durVal / maxDurRef);
        const durArc = d3.arc<any>().innerRadius(innerR).outerRadius(outerR);
        transG.append('path').attr('d', durArc({ startAngle: 1.5 * Math.PI, endAngle: 0.5 * Math.PI })).attr('fill', '#f1f5f9');
        transG.append('path').attr('d', durArc({ startAngle: 1.5 * Math.PI, endAngle: 1.5 * Math.PI - (durPerc * Math.PI) }))
          .attr('fill', '#3b82f6').attr('opacity', 0.5);

        const speedVal = parseNum(transport.Speed);
        const maxSpeedRef = 60;
        const speedPerc = Math.min(1, speedVal / maxSpeedRef);
        const speedAngleDeg = -45 + (speedPerc * 90);
        const triG = transG.append('g').attr('transform', `rotate(${speedAngleDeg}) translate(0, -${outerR + 2})`);
        triG.append('path').attr('d', 'M -5,-10 L 5,-10 L 0,0 Z').attr('fill', '#f97316');

        if (prevSpot && nextSpot) {
          const midTime = (getHours(prevSpot.EndTime) + getHours(nextSpot.StartTime)) / 2;
          timelineGroup.append('circle').attr('cx', timelineScale(midTime)).attr('r', 5).attr('fill', COLORS.timelineDot).attr('stroke', 'white').attr('stroke-width', 2);
        }
      }
    });

  }, [items, selectedSpotId, metricsMap]);

  return (
    <div className="w-full bg-white rounded-[2.5rem] border-none overflow-x-auto custom-scrollbar">
      <svg
        ref={svgRef}
        width={1300}
        height={850}
        className="mx-auto"
      />
    </div>
  );
};

export default ItineraryVisualizer;
