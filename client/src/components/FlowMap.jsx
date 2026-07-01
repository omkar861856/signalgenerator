import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, ZoomIn, ZoomOut, Maximize2, Play, Pause, RefreshCw, 
  Search, ShieldAlert, CheckCircle2, ChevronRight, Activity, TrendingUp
} from 'lucide-react';

export default function FlowMap({ 
  liveQuotes = {}, 
  wsStatus = 'disconnected', 
  subscribedTokens = [], 
  watchlistedStocks = [],
  resolvedSymbols = {},
  onSubscribeFull,
  onUnsubscribe,
  hasAccessToken = false,
  onConnectStream
}) {
  // Config / State
  const [selectedToken, setSelectedToken] = useState(null);
  const [dataSource, setDataSource] = useState('live'); // 'simulator' | 'live'
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoCenter, setAutoCenter] = useState(true);
  const [verticalZoom, setVerticalZoom] = useState(1.0); // 0.5 to 3.0 scale
  const [timeWindow, setTimeWindow] = useState(30); // visible history in seconds (15s, 30s, 60s, 120s, 300s)
  const [brightness, setBrightness] = useState(1.5); // contrast scaling multiplier
  const [showVWAP, setShowVWAP] = useState(true);
  const [showCVD, setShowCVD] = useState(true);
  
  // Search / Resolution
  const [searchInput, setSearchInput] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Canvas & Animation refs
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const containerRef = useRef(null);
  
  // Data Buffers
  const historyRef = useRef([]); // sliding window of ticks
  const maxHistorySize = 1000;
  
  // Running indicators
  const lastCvdRef = useRef(0);
  const cumulativeVolumeRef = useRef(0);
  const cumulativeValueRef = useRef(0); // for VWAP: sum(price * qty)
  const cumulativeQtyRef = useRef(0);   // for VWAP: sum(qty)

  // Simulator state variables (ref-based for high-speed animation loop)
  const simPriceRef = useRef(1500.0);
  const simVWAPRef = useRef(1500.0);
  const simCvdRef = useRef(0);
  const simBidsRef = useRef([]);
  const simAsksRef = useRef([]);
  const simTradesRef = useRef([]);

  // Resolve initial token from props
  useEffect(() => {
    // Try to find a valid token from watchlisted stocks or subscribed tokens
    if (subscribedTokens.length > 0 && !selectedToken) {
      setSelectedToken(subscribedTokens[0]);
    } else if (watchlistedStocks.length > 0 && !selectedToken) {
      // If we have watchlisted stocks, let's see if we can resolve one of them
      const firstSymbol = watchlistedStocks[0];
      // Search in resolved symbols
      const foundToken = Object.keys(resolvedSymbols).find(k => resolvedSymbols[k] === firstSymbol);
      if (foundToken) {
        setSelectedToken(Number(foundToken));
      }
    }
  }, [subscribedTokens, watchlistedStocks, resolvedSymbols, selectedToken]);

  // Request L2 Full Depth subscription when switching to a live token or when WebSocket reconnects
  useEffect(() => {
    if (dataSource === 'live' && selectedToken && onSubscribeFull && wsStatus === 'connected') {
      onSubscribeFull(Number(selectedToken));
    }
  }, [selectedToken, dataSource, onSubscribeFull, wsStatus]);

  // Handle source changes
  const handleSourceChange = (source) => {
    setDataSource(source);
    // Reset data buffers
    historyRef.current = [];
    lastCvdRef.current = 0;
    cumulativeVolumeRef.current = 0;
    cumulativeValueRef.current = 0;
    cumulativeQtyRef.current = 0;
    
    if (source === 'simulator') {
      // Seed simulator
      simPriceRef.current = 1500.0;
      simVWAPRef.current = 1500.0;
      simCvdRef.current = 0;
      generateSimulatedDepth(1500.0);
    } else if (source === 'live' && selectedToken && onSubscribeFull) {
      onSubscribeFull(Number(selectedToken));
    }
  };

  // Seed simulator on mount
  useEffect(() => {
    if (dataSource === 'simulator') {
      simPriceRef.current = 1500.0;
      simVWAPRef.current = 1500.0;
      simCvdRef.current = 0;
      generateSimulatedDepth(1500.0);
    }
  }, []);

  // Helper to generate organic simulated depth around a mid price
  const generateSimulatedDepth = (mid) => {
    const tick = 0.05;
    const bids = [];
    const asks = [];
    
    // Create 10 levels of depth (5 bids, 5 asks)
    for (let i = 1; i <= 5; i++) {
      const bidPrice = Number((mid - i * tick * (1 + Math.random() * 0.5)).toFixed(2));
      // Base quantity + high liquidity walls sometimes
      const isWall = Math.random() < 0.08;
      const bidQty = Math.floor((isWall ? 2500 : 150) + Math.random() * 400);
      bids.push({ price: bidPrice, quantity: bidQty, orders: Math.floor(bidQty / 15) + 1 });

      const askPrice = Number((mid + i * tick * (1 + Math.random() * 0.5)).toFixed(2));
      const isAskWall = Math.random() < 0.08;
      const askQty = Math.floor((isAskWall ? 2500 : 150) + Math.random() * 400);
      asks.push({ price: askPrice, quantity: askQty, orders: Math.floor(askQty / 15) + 1 });
    }

    // Sort bids desc, asks asc
    simBidsRef.current = bids.sort((a, b) => b.price - a.price);
    simAsksRef.current = asks.sort((a, b) => a.price - b.price);
  };

  // Handle symbol search
  const handleSearchSymbol = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearchLoading(true);
    setSearchError('');
    try {
      const symbol = searchInput.trim().toUpperCase();
      const res = await fetch(`/api/resolve-symbol?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Symbol '${symbol}' not found.`);
      }
      const data = await res.json();
      const token = Number(data.instrument_token);
      const displayName = data.exchange ? `${data.exchange}:${data.tradingsymbol}` : data.tradingsymbol;
      
      // Select it
      setSelectedToken(token);
      
      // Subscribe via callback
      if (onSubscribeFull) {
        onSubscribeFull(token);
      }

      setSearchInput('');
      setSearchError('');
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Live Quote Feeder: listens to liveQuotes updates and pushes into the history buffer
  useEffect(() => {
    if (dataSource !== 'live' || !selectedToken || !isPlaying) return;

    const quote = liveQuotes[selectedToken];
    if (!quote) return;

    const now = Date.now();
    const ltp = quote.ltp || quote.last_price || 0;
    if (ltp === 0) return;

    // Check if depth exists, otherwise fallback/mock depth for visualization
    let bids = [];
    let asks = [];
    if (quote.depth && quote.depth.buy && quote.depth.buy.length > 0) {
      bids = quote.depth.buy.map(d => ({ price: d.price, quantity: d.quantity, orders: d.orders || 1 }));
      asks = quote.depth.sell.map(d => ({ price: d.price, quantity: d.quantity, orders: d.orders || 1 }));
    } else {
      // Fallback 5-level depth based on tick sizes if real depth is missing
      const tick = 0.05;
      for (let i = 1; i <= 5; i++) {
        bids.push({ price: ltp - i * tick, quantity: Math.floor(100 + Math.random() * 200), orders: 2 });
        asks.push({ price: ltp + i * tick, quantity: Math.floor(100 + Math.random() * 200), orders: 2 });
      }
    }

    // Process trades (change in volume represents a trade execution)
    const newTrades = [];
    const currentVolume = quote.volume || 0;
    if (cumulativeVolumeRef.current > 0 && currentVolume > cumulativeVolumeRef.current) {
      const tradeQty = currentVolume - cumulativeVolumeRef.current;
      // Determine side: if ltp >= best ask, it's an aggressive buy, else sell
      const bestAsk = asks[0]?.price || ltp;
      const side = ltp >= bestAsk ? 'buy' : 'sell';
      newTrades.push({
        price: ltp,
        quantity: tradeQty,
        side,
        timestamp: now
      });

      // Update CVD & VWAP
      const delta = side === 'buy' ? tradeQty : -tradeQty;
      lastCvdRef.current += delta;
      cumulativeValueRef.current += ltp * tradeQty;
      cumulativeQtyRef.current += tradeQty;
    }
    cumulativeVolumeRef.current = currentVolume;

    const vwap = cumulativeQtyRef.current > 0 
      ? Number((cumulativeValueRef.current / cumulativeQtyRef.current).toFixed(2)) 
      : ltp;

    // Build snapshot record
    const snapshot = {
      timestamp: now,
      ltp,
      bids,
      asks,
      trades: newTrades,
      cvd: lastCvdRef.current,
      vwap
    };

    // Push and slide
    const history = historyRef.current;
    history.push(snapshot);
    if (history.length > maxHistorySize) {
      history.shift();
    }
  }, [liveQuotes, selectedToken, dataSource, isPlaying]);

  // Main Canvas Render and Simulator loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let localFrameId;
    let lastSimTickTime = Date.now();

    const render = () => {
      // 1. Handle Simulator Tick Feed (if source = simulator)
      if (dataSource === 'simulator' && isPlaying) {
        const now = Date.now();
        // Tick every 150ms on average
        if (now - lastSimTickTime > 150) {
          lastSimTickTime = now;
          
          // Random walk price
          const priceChange = (Math.random() - 0.5) * 0.4 + (Math.sin(now / 15000) * 0.05);
          const oldPrice = simPriceRef.current;
          simPriceRef.current = Number((oldPrice + priceChange).toFixed(2));
          
          // Generate new depth around price
          generateSimulatedDepth(simPriceRef.current);

          // Random trade execution
          const tradeOccurred = Math.random() < 0.4;
          const newTrades = [];
          if (tradeOccurred) {
            const isBuy = Math.random() > 0.48; // slight buyer bias
            const tradeQty = Math.floor(10 + Math.pow(Math.random() * 25, 2));
            const tradePrice = isBuy 
              ? (simAsksRef.current[0]?.price || simPriceRef.current) 
              : (simBidsRef.current[0]?.price || simPriceRef.current);
            
            newTrades.push({
              price: tradePrice,
              quantity: tradeQty,
              side: isBuy ? 'buy' : 'sell',
              timestamp: now
            });

            // Update CVD & VWAP
            const delta = isBuy ? tradeQty : -tradeQty;
            simCvdRef.current += delta;
            cumulativeValueRef.current += tradePrice * tradeQty;
            cumulativeQtyRef.current += tradeQty;
          }

          simVWAPRef.current = cumulativeQtyRef.current > 0
            ? Number((cumulativeValueRef.current / cumulativeQtyRef.current).toFixed(2))
            : simPriceRef.current;

          // Push snapshot
          const snapshot = {
            timestamp: now,
            ltp: simPriceRef.current,
            bids: JSON.parse(JSON.stringify(simBidsRef.current)),
            asks: JSON.parse(JSON.stringify(simAsksRef.current)),
            trades: newTrades,
            cvd: simCvdRef.current,
            vwap: simVWAPRef.current
          };

          const history = historyRef.current;
          history.push(snapshot);
          if (history.length > maxHistorySize) {
            history.shift();
          }
        }
      }

      // 2. Perform Drawing
      drawCanvas(ctx, canvas);

      localFrameId = requestAnimationFrame(render);
    };

    // Trigger loop
    render();

    return () => {
      cancelAnimationFrame(localFrameId);
    };
  }, [dataSource, isPlaying, timeWindow, verticalZoom, brightness, autoCenter, showVWAP, showCVD]);

  // Main Drawing Function
  const drawCanvas = (ctx, canvas) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Set drawing buffer dimensions based on device pixel ratio for razor-sharp rendering
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Dark Background
    ctx.fillStyle = '#0f1422';
    ctx.fillRect(0, 0, width, height);

    const history = historyRef.current;
    if (history.length === 0) {
      // Draw Loading State
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for order flow feed...', width / 2, height / 2);
      return;
    }

    // Layout configuration
    const domLadderWidth = 110;
    const paddingRight = 10;
    const heatmapWidth = width - domLadderWidth - paddingRight;
    
    // Separate CVD pane if enabled
    const cvdHeight = showCVD ? 100 : 0;
    const cvdGap = showCVD ? 15 : 0;
    const heatmapHeight = height - cvdHeight - cvdGap;

    // Get latest state
    const latestState = history[history.length - 1];
    const ltp = latestState.ltp;
    const bestBid = latestState.bids[0]?.price || ltp;
    const bestAsk = latestState.asks[0]?.price || ltp;
    const midPrice = (bestBid + bestAsk) / 2;

    // Define Price View Boundaries (Vertical Scale)
    const halfRangePercent = 0.015 / verticalZoom;
    let priceMin = midPrice * (1 - halfRangePercent);
    let priceMax = midPrice * (1 + halfRangePercent);
    const priceRange = priceMax - priceMin;

    // Map price to Y coordinate inside heatmap area
    const priceToY = (price) => {
      const pct = (price - priceMin) / priceRange;
      return heatmapHeight - pct * heatmapHeight;
    };

    // Map time to X coordinate in heatmap area
    const now = Date.now();
    const startTime = now - timeWindow * 1000;
    const timeRange = timeWindow * 1000;
    
    const timeToX = (timestamp) => {
      const elapsed = timestamp - startTime;
      return (elapsed / timeRange) * heatmapWidth;
    };

    // ─── DRAW GRID LINES ──────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;

    // Horizontal Price grid lines
    const priceStep = priceRange / 8;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.font = '9px Courier New, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 8; i++) {
      const priceVal = priceMin + i * priceStep;
      const y = priceToY(priceVal);
      if (y >= 0 && y <= heatmapHeight) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(heatmapWidth, y);
        ctx.stroke();
        
        ctx.fillText(priceVal.toFixed(2), heatmapWidth - 5, y - 3);
      }
    }

    // Vertical Time grid lines
    ctx.textAlign = 'center';
    const timeStep = timeRange / 5;
    for (let i = 1; i <= 5; i++) {
      const timeVal = startTime + i * timeStep;
      const x = timeToX(timeVal);
      if (x >= 0 && x <= heatmapWidth) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, heatmapHeight);
        ctx.stroke();
        
        const date = new Date(timeVal);
        const timeStr = date.toTimeString().split(' ')[0];
        ctx.fillText(timeStr, x, heatmapHeight - 5);
      }
    }

    // ─── DRAW LIQUIDITY HEATMAP ────────────────────────────────────────────────
    ctx.lineWidth = 1.5;
    
    for (let i = 0; i < history.length; i++) {
      const state = history[i];
      const nextState = history[i + 1] || { timestamp: now };
      
      const xStart = Math.max(0, timeToX(state.timestamp));
      const xEnd = Math.min(heatmapWidth, timeToX(nextState.timestamp));
      const colWidth = xEnd - xStart;
      
      if (colWidth <= 0.1 || xStart > heatmapWidth || xEnd < 0) continue;

      // Draw Bid levels
      state.bids.forEach(bid => {
        const y = priceToY(bid.price);
        if (y >= 0 && y <= heatmapHeight) {
          const intensity = Math.min(1.0, (bid.quantity / 800) * brightness);
          ctx.fillStyle = `rgba(16, 185, 129, ${intensity * 0.4})`;
          ctx.fillRect(xStart, y - 2, colWidth + 0.5, 4);
        }
      });

      // Draw Ask levels
      state.asks.forEach(ask => {
        const y = priceToY(ask.price);
        if (y >= 0 && y <= heatmapHeight) {
          const intensity = Math.min(1.0, (ask.quantity / 800) * brightness);
          ctx.fillStyle = `rgba(239, 68, 68, ${intensity * 0.4})`;
          ctx.fillRect(xStart, y - 2, colWidth + 0.5, 4);
        }
      });
    }

    // ─── DRAW BBO BOUNDARY LINES ───────────────────────────────────────────────
    ctx.lineWidth = 2;
    
    // Draw Best Ask Line (Red)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.beginPath();
    let firstAsk = true;
    for (let i = 0; i < history.length; i++) {
      const state = history[i];
      const x = timeToX(state.timestamp);
      const y = priceToY(state.asks[0]?.price || state.ltp);
      if (x >= 0 && x <= heatmapWidth && y >= 0 && y <= heatmapHeight) {
        if (firstAsk) {
          ctx.moveTo(x, y);
          firstAsk = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();

    // Draw Best Bid Line (Green)
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
    ctx.beginPath();
    let firstBid = true;
    for (let i = 0; i < history.length; i++) {
      const state = history[i];
      const x = timeToX(state.timestamp);
      const y = priceToY(state.bids[0]?.price || state.ltp);
      if (x >= 0 && x <= heatmapWidth && y >= 0 && y <= heatmapHeight) {
        if (firstBid) {
          ctx.moveTo(x, y);
          firstBid = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();

    // ─── DRAW VWAP LINE ────────────────────────────────────────────────────────
    if (showVWAP) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      let firstVwap = true;
      for (let i = 0; i < history.length; i++) {
        const state = history[i];
        if (!state.vwap) continue;
        const x = timeToX(state.timestamp);
        const y = priceToY(state.vwap);
        if (x >= 0 && x <= heatmapWidth && y >= 0 && y <= heatmapHeight) {
          if (firstVwap) {
            ctx.moveTo(x, y);
            firstVwap = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ─── DRAW TRADE BUBBLES ───────────────────────────────────────────────────
    for (let i = 0; i < history.length; i++) {
      const state = history[i];
      if (!state.trades || state.trades.length === 0) continue;

      state.trades.forEach(trade => {
        const x = timeToX(trade.timestamp);
        const y = priceToY(trade.price);
        
        if (x >= 0 && x <= heatmapWidth && y >= 0 && y <= heatmapHeight) {
          const radius = Math.max(3.5, Math.min(25, Math.sqrt(trade.quantity) * 1.2));
          
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          
          if (trade.side === 'buy') {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.38)';
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
          } else {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.38)';
            ctx.strokeStyle = 'rgba(248, 113, 113, 0.95)';
          }
          
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    // ─── DRAW CURRENT BBO PRICE LABELS ─────────────────────────────────────────
    const tagX = heatmapWidth + 4;
    
    // Draw Ask Tag
    const askY = priceToY(bestAsk);
    if (askY >= 12 && askY <= heatmapHeight - 12) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.roundRect(tagX, askY - 9, 52, 17, 4);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(bestAsk.toFixed(2), tagX + 5, askY + 3);
    }

    // Draw Bid Tag
    const bidY = priceToY(bestBid);
    if (bidY >= 12 && bidY <= heatmapHeight - 12) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.roundRect(tagX, bidY - 9, 52, 17, 4);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(bestBid.toFixed(2), tagX + 5, bidY + 3);
    }

    // ─── DRAW DOM LADDER SIDEBAR ──────────────────────────────────
    const domStart = width - domLadderWidth + 8;
    const domMaxBarWidth = domLadderWidth - 20;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - domLadderWidth, 0);
    ctx.lineTo(width - domLadderWidth, heatmapHeight);
    ctx.stroke();
    
    // Draw Ask bars
    latestState.asks.forEach(ask => {
      const y = priceToY(ask.price);
      if (y >= 0 && y <= heatmapHeight) {
        const barPct = Math.min(1.0, ask.quantity / 1200);
        const barWidth = barPct * domMaxBarWidth;
        
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(domStart, y - 6, barWidth, 11);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.fillRect(domStart, y - 6, 2, 11);

        ctx.fillStyle = '#f87171';
        ctx.font = '8px Courier New, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${ask.quantity} (${ask.orders || 1})`, domStart + 5, y + 2);
      }
    });

    // Draw Bid bars
    latestState.bids.forEach(bid => {
      const y = priceToY(bid.price);
      if (y >= 0 && y <= heatmapHeight) {
        const barPct = Math.min(1.0, bid.quantity / 1200);
        const barWidth = barPct * domMaxBarWidth;
        
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.fillRect(domStart, y - 6, barWidth, 11);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.fillRect(domStart, y - 6, 2, 11);

        ctx.fillStyle = '#34d399';
        ctx.font = '8px Courier New, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${bid.quantity} (${bid.orders || 1})`, domStart + 5, y + 2);
      }
    });

    // ─── DRAW CVD PANEL ──────────────────────────────────────────────
    if (showCVD) {
      const cvdYStart = heatmapHeight + cvdGap;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, cvdYStart, heatmapWidth, cvdHeight);
      
      let cvdMin = 0;
      let cvdMax = 0;
      history.forEach(h => {
        if (h.cvd < cvdMin) cvdMin = h.cvd;
        if (h.cvd > cvdMax) cvdMax = h.cvd;
      });
      
      cvdMin = cvdMin - 50;
      cvdMax = cvdMax + 50;
      const cvdRange = cvdMax - cvdMin;
      
      const valToCvdY = (val) => {
        const pct = (val - cvdMin) / cvdRange;
        return cvdYStart + cvdHeight - pct * cvdHeight;
      };

      const zeroY = valToCvdY(0);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(heatmapWidth, zeroY);
      ctx.stroke();

      ctx.beginPath();
      let firstCvd = true;
      for (let i = 0; i < history.length; i++) {
        const state = history[i];
        const x = timeToX(state.timestamp);
        const y = valToCvdY(state.cvd || 0);
        
        if (x >= 0 && x <= heatmapWidth) {
          if (firstCvd) {
            ctx.moveTo(x, y);
            firstCvd = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      
      const currentCvd = latestState.cvd || 0;
      ctx.strokeStyle = currentCvd >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.lineTo(timeToX(latestState.timestamp), zeroY);
      ctx.lineTo(timeToX(history[0].timestamp), zeroY);
      ctx.fillStyle = currentCvd >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`CVD (Cumulative Volume Delta): ${currentCvd >= 0 ? '+' : ''}${currentCvd}`, 10, cvdYStart + 15);
    }
  };

  // Build selectable stocks dropdown list
  const activeStocks = Object.keys(resolvedSymbols).map(token => ({
    token: Number(token),
    name: resolvedSymbols[token]
  }));

  // Add defaults if empty
  if (activeStocks.length === 0) {
    activeStocks.push({ token: 256265, name: 'NSE:INFY' });
    activeStocks.push({ token: 260007, name: 'NSE:NIFTY BANK' });
  }

  // Get active token name
  const activeTokenName = resolvedSymbols[selectedToken] || 
    (selectedToken === 256265 ? 'NSE:INFY' : selectedToken === 260007 ? 'NSE:NIFTY BANK' : `Token ${selectedToken || '—'}`);

  return (
    <div className="flex flex-col gap-6 w-full text-slate-200">
      
      {/* Header Toolbar Card */}
      <div className="glass-panel p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-indigo-500/10 bg-indigo-950/5">
        
        {/* Left Section: Active Stock and State */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/15 flex-shrink-0">
            <Flame className="h-5.5 w-5.5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-display font-bold text-white">FlowMap Dashboard</h2>
              <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
                Order Flow L2
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Active Stock: <span className="font-semibold text-indigo-300 font-mono">{activeTokenName}</span>
            </p>
          </div>

          {/* Quick Stock Switcher Dropdown */}
          <div className="ml-0 lg:ml-2">
            <select
              value={selectedToken || ''}
              onChange={(e) => {
                const token = Number(e.target.value);
                setSelectedToken(token);
                historyRef.current = [];
                cumulativeVolumeRef.current = 0;
                cumulativeValueRef.current = 0;
                cumulativeQtyRef.current = 0;
              }}
              className="bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-white/20 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer font-mono"
            >
              {activeStocks.map(s => (
                <option key={s.token} value={s.token}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Middle Section: Search Stock */}
        <form onSubmit={handleSearchSymbol} className="flex items-center gap-2 max-w-sm w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search NSE Stock (e.g. SBIN, TCS)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-slate-950 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={searchLoading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/15 flex items-center gap-1 cursor-pointer"
          >
            {searchLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Load'}
          </button>
        </form>

        {/* Right Section: Sources and State Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Data Source Selector */}
          <div className="bg-slate-950/60 border border-white/10 p-0.5 rounded-xl flex">
            <button
              onClick={() => handleSourceChange('simulator')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                dataSource === 'simulator' 
                  ? 'bg-indigo-600 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Synthetic Sim
            </button>
            <button
              onClick={() => handleSourceChange('live')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                dataSource === 'live' 
                  ? 'bg-indigo-600 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
              Kite Live
            </button>
          </div>

          {/* Connection badge */}
          {dataSource === 'live' && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              wsStatus === 'connected' 
                ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/35 text-rose-400'
            }`}>
              {wsStatus === 'connected' ? 'Live Stream Active' : 'Live Stream Inactive'}
            </div>
          )}
        </div>
      </div>

      {searchError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4.5 w-4.5" />
          {searchError}
        </div>
      )}

      {/* Main Heatmap Visualization Card */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* Left Column: Canvas heat chart */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div 
            ref={containerRef}
            className="glass-panel p-4 bg-slate-950/40 relative border-white/5 flex flex-col w-full h-[600px] overflow-hidden"
          >
            {dataSource === 'live' && wsStatus !== 'connected' && (
              <div className="absolute inset-0 bg-[#0f1422]/90 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 text-center">
                <div className="max-w-md flex flex-col items-center gap-5">
                  <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5">
                    <ShieldAlert className="h-8 w-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-white mb-2">
                      {hasAccessToken ? 'Kite Live Stream Disconnected' : 'Zerodha Account Connection Required'}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {hasAccessToken 
                        ? 'Your Zerodha session is active, but the frontend live market data stream is currently disconnected. Reconnect the stream to start plotting the live L2 depth heatmap.'
                        : 'The live Bookmap-style order flow heatmap requires an active Zerodha Kite WebSocket connection to receive L2 market depth and trade executions in real-time.'}
                    </p>
                  </div>
                  
                  <div className="w-full text-left text-xs bg-slate-900/50 border border-white/5 p-4 rounded-xl flex flex-col gap-2.5 text-slate-300">
                    {hasAccessToken ? (
                      <>
                        <div className="flex gap-2 items-start">
                          <span className="h-5 w-5 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 flex-shrink-0">1</span>
                          <span>Click the <strong>Reconnect Live Stream</strong> button below to establish connection.</span>
                        </div>
                        <div className="flex gap-2 items-start">
                          <span className="h-5 w-5 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 flex-shrink-0">2</span>
                          <span>The stream will subscribe to the selected instrument in high-fidelity Full L2 Depth mode.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex gap-2 items-start">
                          <span className="h-5 w-5 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 flex-shrink-0">1</span>
                          <span>Click the <strong>Connect Zerodha</strong> button below to authorize your session.</span>
                        </div>
                        <div className="flex gap-2 items-start">
                          <span className="h-5 w-5 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 flex-shrink-0">2</span>
                          <span>Once connected, select a watchlisted stock or search for any NSE symbol.</span>
                        </div>
                        <div className="flex gap-2 items-start">
                          <span className="h-5 w-5 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 flex-shrink-0">3</span>
                          <span>The canvas will automatically start streaming live L2 depth and trade bubbles.</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3 w-full mt-2">
                    {hasAccessToken ? (
                      <button
                        onClick={() => onConnectStream && onConnectStream()}
                        className="flex-1 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 cursor-pointer text-center"
                      >
                        Reconnect Live Stream
                      </button>
                    ) : (
                      <button
                        onClick={() => window.location.href = '/api/login'}
                        className="flex-1 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 cursor-pointer text-center"
                      >
                        Connect Zerodha Account
                      </button>
                    )}
                    <button
                      onClick={() => handleSourceChange('simulator')}
                      className="px-5 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
                    >
                      Use Demo Simulator
                    </button>
                  </div>
                </div>
              </div>
            )}

            <canvas 
              ref={canvasRef}
              className="w-full flex-1 rounded-xl cursor-crosshair block"
              style={{ minHeight: '300px' }}
            />
            
            {/* Legend indicators */}
            <div className="absolute top-6 left-6 flex items-center gap-4 bg-slate-950/80 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-white/5 text-[10px] font-semibold text-slate-400 font-mono shadow-md">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded bg-gradient-to-r from-indigo-950 to-emerald-500"></span>
                <span>Bids (Liquidity)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded bg-gradient-to-r from-indigo-950 to-red-500"></span>
                <span>Asks (Liquidity)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500/40 border border-emerald-400"></span>
                <span>Buy Order</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/40 border border-red-400"></span>
                <span>Sell Order</span>
              </div>
              {showVWAP && (
                <div className="flex items-center gap-1.5">
                  <span className="h-0 border-t-2 border-dashed border-amber-500 w-6"></span>
                  <span>VWAP</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Settings and Stats Card */}
        <div className="flex flex-col gap-6">
          
          {/* Controls Panel */}
          <div className="glass-panel p-5">
            <h3 className="font-display font-bold text-sm text-white mb-4 border-b border-white/5 pb-2.5 flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-indigo-400" />
              Heatmap Controls
            </h3>
            
            <div className="flex flex-col gap-5">
              
              {/* Play/Pause Button */}
              <div className="flex justify-between items-center bg-slate-950/40 border border-white/5 p-3 rounded-xl">
                <span className="text-xs font-semibold text-slate-300">Visual Engine</span>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all shadow cursor-pointer ${
                    isPlaying 
                      ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      Pause Feed
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Resume Feed
                    </>
                  )}
                </button>
              </div>

              {/* Time Window Zoom */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">Timeline Width (Time Zoom)</span>
                  <span className="font-bold text-indigo-400 font-mono">{timeWindow}s</span>
                </div>
                <div className="grid grid-cols-5 gap-1 bg-slate-950/40 border border-white/5 p-0.5 rounded-xl">
                  {[15, 30, 60, 120, 300].map(val => (
                    <button
                      key={val}
                      onClick={() => setTimeWindow(val)}
                      className={`py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        timeWindow === val 
                          ? 'bg-indigo-600 text-white shadow' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {val === 300 ? '5m' : val === 120 ? '2m' : val === 60 ? '1m' : `${val}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range Zoom */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">Price Height (Price Zoom)</span>
                  <span className="font-bold text-indigo-400 font-mono">x{verticalZoom.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVerticalZoom(prev => Math.max(0.5, prev - 0.2))}
                    className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={verticalZoom}
                    onChange={(e) => setVerticalZoom(Number(e.target.value))}
                    className="flex-1 accent-indigo-500 h-1 rounded-lg cursor-pointer bg-slate-950"
                  />
                  <button
                    onClick={() => setVerticalZoom(prev => Math.min(3.0, prev + 0.2))}
                    className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Heatmap Contrast */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">Liquidity Contrast</span>
                  <span className="font-bold text-indigo-400 font-mono">{Math.round(brightness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4.0"
                  step="0.1"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="accent-indigo-500 h-1 rounded-lg cursor-pointer bg-slate-950"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2.5 pt-2 border-t border-white/5">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-300 cursor-pointer">
                  <span>Show VWAP Line</span>
                  <input
                    type="checkbox"
                    checked={showVWAP}
                    onChange={(e) => setShowVWAP(e.target.checked)}
                    className="h-4 w-4 rounded border-white/10 accent-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs font-semibold text-slate-300 cursor-pointer">
                  <span>Show CVD Indicator</span>
                  <input
                    type="checkbox"
                    checked={showCVD}
                    onChange={(e) => setShowCVD(e.target.checked)}
                    className="h-4 w-4 rounded border-white/10 accent-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs font-semibold text-slate-300 cursor-pointer">
                  <span>Auto-Center Spread</span>
                  <input
                    type="checkbox"
                    checked={autoCenter}
                    onChange={(e) => setAutoCenter(e.target.checked)}
                    className="h-4 w-4 rounded border-white/10 accent-indigo-500 cursor-pointer"
                  />
                </label>
              </div>

            </div>
          </div>

          {/* Market Pulse Analytics */}
          <div className="glass-panel p-5">
            <h3 className="font-display font-bold text-sm text-white mb-3.5 border-b border-white/5 pb-2.5 flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-indigo-400" />
              Order Flow Pulse
            </h3>
            
            <div className="flex flex-col gap-3.5">
              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Last Traded Price</span>
                <span className="font-bold text-white font-mono">
                  ₹{(selectedToken && liveQuotes[selectedToken]?.ltp) ? liveQuotes[selectedToken].ltp.toFixed(2) : (dataSource === 'simulator' ? simPriceRef.current.toFixed(2) : '0.00')}
                </span>
              </div>

              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Spread (Ask - Bid)</span>
                <span className="font-bold text-emerald-400 font-mono">
                  ₹{(historyRef.current[historyRef.current.length - 1]?.asks[0]?.price - historyRef.current[historyRef.current.length - 1]?.bids[0]?.price || 0.05).toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Buying pressure delta</span>
                <span className={`font-bold font-mono ${lastCvdRef.current >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {lastCvdRef.current >= 0 ? '+' : ''}{lastCvdRef.current || simCvdRef.current}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
