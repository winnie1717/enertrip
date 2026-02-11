
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { type ItinerarySpot, type Metrics } from '../types';
import { COLORS } from '../constants';

interface VisualizerProps {
  spot: ItinerarySpot;
  metrics: Metrics;
  onUpdateMetrics: (newMetrics: Partial<Metrics>) => void;
}

const Visualizer: React.FC<VisualizerProps> = ({ spot, metrics, onUpdateMetrics }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const metricsRef = useRef<Metrics>(metrics);

  // Sync ref with state so drag handler can access latest state without re-running useEffect fully
  useEffect(() => {
    metricsRef.current = metrics;
    updateDynamicElements();
  }, [metrics]);

  const updateDynamicElements = () => {
    if (!svgRef.current) return;
    const innerR = 70, midR = 85, outerR = 100;
    const svg = d3.select(svgRef.current);
    const curr = metricsRef.current;

    // Update Arcs
    const pArc = d3.arc<any>().innerRadius(innerR).outerRadius(outerR);
    svg.select('.pref-arc').attr('d', pArc({
        startAngle: -Math.PI / 2,
        endAngle: -Math.PI / 2 + (Math.PI * (curr.preference / 10))
    }));

    const phArc = d3.arc<any>().innerRadius(innerR).outerRadius(midR);
    svg.select('.phys-arc').attr('d', phArc({
        startAngle: Math.PI * 1.5,
        endAngle: Math.PI * 1.5 - (Math.PI * (curr.physical / 10))
    }));

    const meArc = d3.arc<any>().innerRadius(midR).outerRadius(outerR);
    svg.select('.ment-arc').attr('d', meArc({
        startAngle: Math.PI * 1.5,
        endAngle: Math.PI * 1.5 - (Math.PI * (curr.mental / 10))
    }));

    // Update Handles and Fills
    const barW = 200;
    ['preference', 'physical', 'mental'].forEach((key) => {
      const val = curr[key as keyof Metrics];
      // Map 1-10 to 0-barW
      const x = ((val - 1) / 9) * barW; 
      svg.select(`.handle-${key}`).attr('cx', x);
      svg.select(`.fill-${key}`).attr('width', x);
    });
  };

  useEffect(() => {
    if (!svgRef.current) return;

    // Increase width to 900 to ensure the control panel isn't clipped
    const width = 900, height = 450, margin = 40;
    const centerX = 260, centerY = 180;
    const innerR = 70, midR = 85, outerR = 100;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');

    // Rating Stars
    const rating = spot.Rating || 0;
    for (let i = 0; i < 5; i++) {
      const diff = rating - i;
      const fillPerc = Math.max(0, Math.min(1, diff)) * 100;
      defs.append('linearGradient')
        .attr('id', `star-grad-${i}`)
        .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '0%')
        .selectAll('stop')
        .data([{o: fillPerc, c: COLORS.star}, {o: fillPerc, c: COLORS.outline}])
        .enter().append('stop').attr('offset', d => `${d.o}%`).attr('stop-color', d => d.c);
    }

    // Cost Fill
    const maxCostRef = 500; 
    const costPerc = Math.min(100, (spot.Cost / maxCostRef) * 100);
    const fillH = (costPerc / 100) * (innerR * 2);
    defs.append('clipPath').attr('id', 'cost-fill-clip')
      .append('rect').attr('x', -innerR).attr('y', innerR - fillH).attr('width', innerR * 2).attr('height', fillH);

    const g = svg.append('g').attr('transform', `translate(${margin}, ${margin})`);
    const mainG = g.append('g').attr('transform', `translate(${centerX}, ${centerY})`);

    // Center UI
    mainG.append('circle').attr('r', innerR).attr('fill', '#ffffff').attr('stroke', COLORS.outline).attr('stroke-width', 1.5);
    mainG.append('circle').attr('r', innerR).attr('fill', COLORS.costFill).attr('clip-path', 'url(#cost-fill-clip)');
    
    // Outlines
    const arcOutline = d3.arc<any>().cornerRadius(0);
    mainG.append('path').attr('d', arcOutline({ innerRadius: innerR, outerRadius: outerR, startAngle: -Math.PI / 2, endAngle: Math.PI / 2 })).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 1);
    mainG.append('path').attr('d', arcOutline({ innerRadius: innerR, outerRadius: midR, startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5 })).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 1);
    mainG.append('path').attr('d', arcOutline({ innerRadius: midR, outerRadius: outerR, startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5 })).attr('fill', 'none').attr('stroke', COLORS.outline).attr('stroke-width', 1);

    // Dynamic Paths (Classes for targeting)
    mainG.append('path').attr('class', 'pref-arc').attr('fill', COLORS.preference);
    mainG.append('path').attr('class', 'phys-arc').attr('fill', COLORS.physical);
    mainG.append('path').attr('class', 'ment-arc').attr('fill', COLORS.mental);

    const starG = mainG.append('g').attr('transform', 'translate(0, -10)');
    for (let i = 0; i < 5; i++) {
        starG.append('text').attr('x', (i - 2) * 20).attr('text-anchor', 'middle').attr('font-size', '24px').attr('fill', `url(#star-grad-${i})`).text('★');
    }
    mainG.append('text').attr('y', 35).attr('text-anchor', 'middle').attr('class', 'font-bold text-slate-600 font-sans').attr('font-size', '16px').text(`NT$ ${spot.Cost}`);

    // Satellite Icons
    const drawSat = (id: string, angle: number, icon: string, percentage: number, color: string) => {
        const rad = (angle - 90) * (Math.PI / 180), dist = 160;
        const x = centerX + Math.cos(rad) * dist, y = centerY + Math.sin(rad) * dist, r = 28;
        const node = g.append('g').attr('transform', `translate(${x}, ${y})`);
        const fillHeight = (percentage / 100) * (r * 2);
        defs.append('clipPath').attr('id', `clip-${id}`).append('rect').attr('x', -r).attr('y', r - fillHeight).attr('width', r * 2).attr('height', fillHeight);
        node.append('circle').attr('r', r).attr('fill', 'white').attr('stroke', COLORS.outline).attr('stroke-width', 1.5);
        node.append('circle').attr('r', r).attr('fill', color).attr('opacity', 0.6).attr('clip-path', `url(#clip-${id})`);
        node.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', '24px').text(icon);
    };

    drawSat("walk", -60, "👣", (spot.WalkingLoad/5)*100, COLORS.physical);
    drawSat("space", -30, spot.IndoorOutdoor === "室內" ? "🏠" : "🌳", 50, COLORS.physical);
    drawSat("weather", 0, "☀️", 80, COLORS.physical);
    drawSat("crowd", 30, "👥", (spot.CrowdLevel/5)*100, COLORS.mental);
    drawSat("info", 60, "ℹ️", (spot.InfoLoad/5)*100, COLORS.mental);

    g.append('text').attr('x', centerX).attr('y', centerY + 170).attr('text-anchor', 'middle').attr('class', 'sketch-font text-3xl font-bold fill-slate-800').text(spot.SpotName);

    // Interactive Bars
    const barX = 560, barY = 80, barW = 200;
    const ctrlArea = g.append('g').attr('transform', `translate(${barX}, ${barY})`);
    // Panel Background
    ctrlArea.append('rect').attr('x', -20).attr('y', -30).attr('width', barW + 60).attr('height', 220).attr('rx', 16).attr('fill', '#ffffff').attr('stroke', '#e2e8f0').attr('stroke-width', 1);

    const drawSlider = (y: number, label: string, key: keyof Metrics, color: string) => {
        const barG = ctrlArea.append('g').attr('transform', `translate(10, ${y})`);
        barG.append('text').attr('y', -10).attr('class', 'text-xs font-bold fill-slate-400').text(label);
        
        const container = barG.append('rect').attr('width', barW).attr('height', 8).attr('rx', 4).attr('fill', '#f1f5f9').style('cursor', 'pointer');
        barG.append('rect').attr('class', `fill-${key}`).attr('height', 8).attr('rx', 4).attr('fill', color).attr('pointer-events', 'none');
        const handle = barG.append('circle').attr('class', `handle-${key}`).attr('r', 10).attr('cy', 4).attr('fill', 'white').attr('stroke', color).attr('stroke-width', 3).style('cursor', 'ew-resize');

        const dragHandler = d3.drag<any, any>().on('drag', (event) => {
            const newX = Math.max(0, Math.min(barW, event.x));
            // Map 0-barW to 1-10 integer
            const newVal = Math.round(1 + (newX / barW) * 9);
            onUpdateMetrics({ [key]: newVal });
        });

        container.call(dragHandler);
        handle.call(dragHandler);
    };

    drawSlider(20, "推薦偏好 (1-10)", "preference", COLORS.preference);
    drawSlider(80, "生理負荷 (1-10)", "physical", COLORS.physical);
    drawSlider(140, "心理負荷 (1-10)", "mental", COLORS.mental);

    updateDynamicElements();
  }, [spot, onUpdateMetrics]); // Only rebuild if spot changes

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
      <svg ref={svgRef} viewBox="0 0 900 450" className="w-full h-auto" style={{ minHeight: '450px' }} />
    </div>
  );
};

export default Visualizer;
