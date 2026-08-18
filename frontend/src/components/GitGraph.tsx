import React, { useEffect, useRef, useState } from 'react';
import './GitGraph.css';

interface CommitNode {
  id: string;
  hash: string;
  message: string;
  branches: string[];
  parents: string[];
  x: number;
  y: number;
}

interface GitGraphProps {
  logOutput: string;
  onNodeClick?: (hash: string) => void;
}

export function GitGraph({ logOutput, onNodeClick }: GitGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<CommitNode[]>([]);
  const [branches, setBranches] = useState<{ name: string; color: string; head: string }[]>([]);
  
  const colors = [
    '#6c63ff', '#4CAF50', '#FF9800', '#f44336', '#2196F3', 
    '#9C27B0', '#00BCD4', '#FF5722', '#8BC34A', '#E91E63'
  ];

  useEffect(() => {
    if (logOutput) {
      parseGitLog(logOutput);
    }
  }, [logOutput]);

  const parseGitLog = (output: string) => {
    const lines = output.split('\n');
    const parsedNodes: CommitNode[] = [];
    const branchMap: { [key: string]: string } = {};
    const branchColors: { [key: string]: string } = {};
    let colorIndex = 0;

    lines.forEach(line => {
      // Parse commit line: * hash message
      const commitMatch = line.match(/^\*\s+([a-f0-9]{7,})\s+(.*)/);
      if (commitMatch) {
        const [, hash, message] = commitMatch;
        const branches: string[] = [];
        
        // Check for branch labels
        const branchMatch = message.match(/\(([^)]+)\)/);
        if (branchMatch) {
          const labels = branchMatch[1].split(', ');
          labels.forEach(label => {
            if (label !== 'HEAD' && label !== 'main' && !label.includes('origin/')) {
              branches.push(label);
              if (!branchColors[label]) {
                branchColors[label] = colors[colorIndex % colors.length];
                colorIndex++;
              }
            }
            if (label === 'HEAD') {
              // HEAD is at current branch
            }
          });
        }

        parsedNodes.push({
          id: hash,
          hash: hash.substring(0, 7),
          message: message.replace(/\([^)]*\)/, '').trim(),
          branches,
          parents: [],
          x: 0,
          y: 0
        });
      }
    });

    // Calculate positions
    const sorted = parsedNodes.reverse();
    sorted.forEach((node, index) => {
      node.y = (index + 1) * 40;
      node.x = 100;
    });

    setNodes(sorted);
    
    // Build branch list
    const branchList = Object.keys(branchColors).map(name => ({
      name,
      color: branchColors[name],
      head: sorted.find(n => n.branches.includes(name))?.hash || ''
    }));
    setBranches(branchList);

    drawGraph(sorted, branchList);
  };

  const drawGraph = (nodes: CommitNode[], branchList: { name: string; color: string; head: string }[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width || 800;
    const height = Math.max(400, nodes.length * 45 + 60);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw connections
    nodes.forEach((node, i) => {
      if (i < nodes.length - 1) {
        const next = nodes[i + 1];
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = '#3a3a5c';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw branch lines
    branchList.forEach(branch => {
      const branchNodes = nodes.filter(n => n.branches.includes(branch.name));
      if (branchNodes.length > 1) {
        ctx.beginPath();
        ctx.moveTo(branchNodes[0].x + 20, branchNodes[0].y);
        branchNodes.forEach((n, i) => {
          if (i > 0) {
            ctx.lineTo(n.x + 20, n.y);
          }
        });
        ctx.strokeStyle = branch.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach((node) => {
      // Circle
      const gradient = ctx.createRadialGradient(
        node.x, node.y - 5, 5,
        node.x, node.y, 20
      );
      gradient.addColorStop(0, '#6c63ff');
      gradient.addColorStop(1, '#4a42b5');
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hash label
      ctx.fillStyle = '#999';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(node.hash, node.x - 20, node.y + 4);

      // Commit message
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      const msg = node.message.length > 40 ? node.message.substring(0, 40) + '...' : node.message;
      ctx.fillText(msg, node.x + 20, node.y + 4);

      // Branch labels
      if (node.branches.length > 0) {
        const branchText = node.branches.join(', ');
        ctx.fillStyle = '#FFD700';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`🌿 ${branchText}`, node.x + 20, node.y - 12);
      }
    });

    // Legend
    const legendX = width - 160;
    const legendY = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(legendX - 10, legendY - 10, 160, branchList.length * 22 + 20);
    
    branchList.forEach((branch, i) => {
      const y = legendY + i * 22 + 16;
      ctx.fillStyle = branch.color;
      ctx.fillRect(legendX, y - 4, 12, 4);
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(branch.name, legendX + 18, y + 2);
    });

    // HEAD indicator
    const headNode = nodes.find(n => n.message.includes('HEAD'));
    if (headNode) {
      ctx.fillStyle = '#FFD700';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HEAD →', headNode.x, headNode.y - 20);
    }
  };

  return (
    <div className="git-graph-container">
      <canvas ref={canvasRef} className="git-graph-canvas" />
      <div className="git-graph-legend">
        <span>✅ {nodes.length} commits</span>
        <span>🌿 {branches.length} branches</span>
      </div>
    </div>
  );
}