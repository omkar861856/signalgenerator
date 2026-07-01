import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Shield, Zap, Settings, Play, Check, X, 
  Copy, Trash2, LogOut, RefreshCw, AlertTriangle, Lock, Plus, Search, 
  FileText, LayoutDashboard, CopyCheck, Brain, CircleDot, ChevronUp, ChevronDown,
  Eye, EyeOff, Activity, Flame, Info, Sparkles, Wand2, Briefcase, IndianRupee, PieChart, Cpu, Server, Database, Globe, Square, Code, LineChart, History, MessageSquare, Menu, RefreshCcw, Sliders
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BacktestPlatform from './components/BacktestPlatform';

// Formatting helper
const formatCurrency = (val) => {
  if (typeof val !== 'number' || isNaN(val)) return '0.00';
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function App() {
  // Navigation & Views
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'scanners' | 'admin' | 'strategies'

  // Scanner Alert Subscriptions State
  const [subscribedAlerts, setSubscribedAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('signals_subscribed_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [alertHistory, setAlertHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('signals_alert_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);


  // Configuration & Token State
  const [appConfig, setAppConfig] = useState({ hasKiteKey: false, hasAccessToken: false });
  const [accessToken, setAccessToken] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [marketTime, setMarketTime] = useState('');

  // App State (from MongoDB /api/state)
  const [selectedMarginPercentage, setSelectedMarginPercentage] = useState(100);
  const [watchlistedStocks, setWatchlistedStocks] = useState([]);
  const [intradayTriggers, setIntradayTriggers] = useState([]);
  const [openOrdersDecisions, setOpenOrdersDecisions] = useState([]);
  const [intradayActionsLogs, setIntradayActionsLogs] = useState([]);

  // Strategy & Prompt State
  const [activeStrategy, setActiveStrategy] = useState('momentum_surfing_morning');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [profitTargetExit, setProfitTargetExit] = useState(0);
  const [lossTargetExit, setLossTargetExit] = useState(0);
  const [pnlExitMode, setPnlExitMode] = useState('current');
  const [pnlExitAutoEnabled, setPnlExitAutoEnabled] = useState(true);
  const [reallocationAutoEnabled, setReallocationAutoEnabled] = useState(false);
  const [lastReallocationTime, setLastReallocationTime] = useState(null);
  const [showMorningIpModal, setShowMorningIpModal] = useState(false);

  // Draft/form states for MIS P&L Exit Controls to prevent poller overwriting
  const [profitTargetExitDraft, setProfitTargetExitDraft] = useState('');
  const [lossTargetExitDraft, setLossTargetExitDraft] = useState('');
  const [pnlExitModeDraft, setPnlExitModeDraft] = useState('current');
  const [pnlExitAutoEnabledDraft, setPnlExitAutoEnabledDraft] = useState(true);
  
  // Custom quick preset pills state, loaded from localStorage or using defaults
  const [pnlPresets, setPnlPresets] = useState(() => {
    try {
      const saved = localStorage.getItem('pnl_exit_presets');
      return saved ? JSON.parse(saved) : [
        { p: 100, l: -20 },
        { p: 100, l: -10 },
        { p: 30, l: -5 },
        { p: 100, l: -30 }
      ];
    } catch {
      return [
        { p: 100, l: -20 },
        { p: 100, l: -10 },
        { p: 30, l: -5 },
        { p: 100, l: -30 }
      ];
    }
  });
  const [newPresetProfit, setNewPresetProfit] = useState('');
  const [newPresetLoss, setNewPresetLoss] = useState('');
  const [chatMode, setChatMode] = useState(() => {
    return localStorage.getItem('portfolio_chat_mode') || 'BUY';
  });

  const isPnlFormDirty = 
    profitTargetExitDraft !== (profitTargetExit === 0 ? '' : String(profitTargetExit)) ||
    lossTargetExitDraft !== (lossTargetExit === 0 ? '' : String(lossTargetExit)) ||
    pnlExitModeDraft !== pnlExitMode ||
    pnlExitAutoEnabledDraft !== pnlExitAutoEnabled;

  // WebSocket Live Quotes Streaming State
  const wsRef = useRef(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [liveQuotes, setLiveQuotes] = useState({});
  const [subscribedTokens, setSubscribedTokens] = useState([256265, 260007]); // NIFTY 50 and NIFTY BANK by default
  const [wsLogs, setWsLogs] = useState([]);
  const [customTokenInput, setCustomTokenInput] = useState('');
  const [expandedDepthTokens, setExpandedDepthTokens] = useState([]);
  const [resolvedSymbols, setResolvedSymbols] = useState({});

  // Real-Time Scanner States
  const [selectedScanner, setSelectedScanner] = useState('Top Gainers and Increasing');
  const [selectedScannerIndex, setSelectedScannerIndex] = useState('Nifty 500');
  const [selectedScannerTimeframe, setSelectedScannerTimeframe] = useState('All');
  const [scannerResults, setScannerResults] = useState([]);
  const [scannerSortField, setScannerSortField] = useState(null); // 'change' | 'volume' | 'ltp'
  const [scannerSortDirection, setScannerSortDirection] = useState('desc'); // 'asc' | 'desc'
  
  // AI Custom & Dynamic Scanner States
  const [scannersList, setScannersList] = useState([
    { name: 'Top Gainers and Increasing', tf: 'day', description: 'The scanner identifies stocks where the current closing price is at least 1% higher than the previous close, and the current price is higher than the close price on a 1-minute candle at all times.' },
    { name: 'Top Gainers', tf: 'day', description: 'The scanner identifies stocks where the current closing price is at least 1% higher than the previous close, indicating positive price momentum and potential bullish sentiment.' },
    { name: 'Top Losers', tf: 'day', description: 'The scanner identifies stocks where the current closing price is at least 1% lower than the previous close, indicating negative price momentum and potential bearish sentiment.' },
    { name: 'Opening Range Breakout', tf: '5min', description: 'Identifies stocks where the current price has broken above the highest high of the last 20 periods, indicating strong bullish breakout momentum.' },
    { name: 'Opening Range Breakdown', tf: '5min', description: 'Identifies stocks where the current price has broken below the lowest low of the last 20 periods, indicating strong bearish breakdown momentum.' },
    { name: 'Higher High For 2 Days', tf: 'day', description: 'Identifies stocks making a higher high for two consecutive periods, showing a strong short-term bullish trend.' },
    { name: 'Lower Low For 2 Days', tf: 'day', description: 'Identifies stocks making a lower low for two consecutive periods, showing a strong short-term bearish trend.' },
    { name: 'Short Term Bullish', tf: '5min', description: 'Identifies stocks where the 20-period EMA is above the 50-period EMA and the price is above the 20 EMA, indicating a strong short-term uptrend.' },
    { name: 'Short Term Bear', tf: '5min', description: 'Identifies stocks where the 20-period EMA is below the 50-period EMA and the price is below the 20 EMA, indicating a strong short-term downtrend.' },
    { name: 'Momentum Surge', tf: '5min', description: 'Identifies stocks where the 14-period RSI is above 60, indicating a strong bullish momentum expansion.' },
    { name: 'Momentum Fade', tf: '5min', description: 'Identifies stocks where the 14-period RSI is below 40, indicating a strong bearish momentum contraction.' },
    { name: 'Bullish Engulfing', tf: 'hour', description: 'Identifies stocks showing a classic Bullish Engulfing candlestick pattern over the last two periods.' },
    { name: 'Bearish Engulfing', tf: 'hour', description: 'Identifies stocks showing a classic Bearish Engulfing candlestick pattern over the last two periods.' },
    { name: 'Volume Breakout', tf: '15min', description: 'Identifies stocks where the current volume is at least 2x higher than the average volume of the last 20 periods, indicating massive institutional participation.' }
  ]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState(null);

  // Historical Sync States
  // Custom Alert Modal State
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', title: 'Notification' });
  const showAlert = (message, title = 'Notification') => setAlertConfig({ isOpen: true, message, title });

  const [syncStatus, setSyncStatus] = useState(null);
  const [syncPolling, setSyncPolling] = useState(false);

  const [scannerSearchQuery, setScannerSearchQuery] = useState('');
  const [scannerLoading, setScannerLoading] = useState(false);
  const [backendWsStatus, setBackendWsStatus] = useState('disconnected');
  const [subscribedCount, setSubscribedCount] = useState(0);
  const [backendWsLogs, setBackendWsLogs] = useState([]);
  const [networkIps, setNetworkIps] = useState([]);
  const [scannerSearchFilter, setScannerSearchFilter] = useState('');

  // Polled Live Data (Zerodha margins, holdings, positions, etc.)
  const [margins, setMargins] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [gttTriggers, setGttTriggers] = useState([]);
  const [apiStats, setApiStats] = useState({ totalCalls: 0, callsPerSecond: 0 });
  const [memories, setMemories] = useState([]);
  const [totalCharges, setTotalCharges] = useState(0);
  const [intradayStatusText, setIntradayStatusText] = useState('idle');

  // Chat Interface State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'assistant', text: 'Welcome! I am your AI Portfolio Strategist, ready to execute trades and analyze stocks.' }
  ]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Trend Analyzer State
  const [trendInput, setTrendInput] = useState('');
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendLoadingText, setTrendLoadingText] = useState('');
  const [trendError, setTrendError] = useState('');
  const [analyzedStocks, setAnalyzedStocks] = useState([]);
  const [sortDirection, setSortDirection] = useState('none'); // 'none' | 'asc' | 'desc'
  const [selectedStock, setSelectedStock] = useState(null);

  // RSI Scanner State
  const [rsiInput, setRsiInput] = useState('');
  const [rsiCondition, setRsiCondition] = useState('all');
  const [rsiThreshold, setRsiThreshold] = useState(50);
  const [rsiLoading, setRsiLoading] = useState(false);
  const [rsiError, setRsiError] = useState('');
  const [scannedRsiStocks, setScannedRsiStocks] = useState([]);
  const [rsiFilterSummary, setRsiFilterSummary] = useState('');

  // Advanced Screener State
  const [screenerInput, setScreenerInput] = useState('');
  const [screenerPreset, setScreenerPreset] = useState('preferred');
  const [screenerMinStages, setScreenerMinStages] = useState(0);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState('');
  const [screenerCandidates, setScreenerCandidates] = useState([]);
  const [customStages, setCustomStages] = useState({
    stage1: true, stage2: true, stage3: true,
    stage4: true, stage5: true, stage6: true
  });

  // Strategy Builder Modal State
  const [builderName, setBuilderName] = useState('');
  const [builderIndicators, setBuilderIndicators] = useState('');
  const [builderSL, setBuilderSL] = useState(2.0);
  const [builderTarget, setBuilderTarget] = useState(4.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Ticker state for Net PnL
  const prevNetPnLRef = useRef(0);
  const [netPnLDiff, setNetPnLDiff] = useState(0);
  const [builderEntry, setBuilderEntry] = useState('');
  const [builderExit, setBuilderExit] = useState('');
  const [builderLoadingText, setBuilderLoadingText] = useState('');
  const [builderStatus, setBuilderStatus] = useState('');

  // Backtest Simulator State
  const [backtestSymbol, setBacktestSymbol] = useState('NSE:RELIANCE');
  const [backtestInterval, setBacktestInterval] = useState('day');
  const [backtestFromDate, setBacktestFromDate] = useState('2024-01-01');
  const [backtestToDate, setBacktestToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [backtestCapital, setBacktestCapital] = useState(100000);
  const [backtestLeverage, setBacktestLeverage] = useState(5);
  const [backtestMarginPct, setBacktestMarginPct] = useState(100);
  const [backtestAllowShorting, setBacktestAllowShorting] = useState(true);
  const [backtestIndicatorsJson, setBacktestIndicatorsJson] = useState(
    JSON.stringify({
      ema_fast: { type: 'EMA', period: 9 },
      ema_slow: { type: 'EMA', period: 21 },
      rsi: { type: 'RSI', period: 14 }
    }, null, 4)
  );
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState('');
  const [backtestResults, setBacktestResults] = useState(null);

  // Backtest & Analysis View States
  const [chartSymbol, setChartSymbol] = useState('NSE:RELIANCE');
  const [chartInterval, setChartInterval] = useState('day');
  const [chartFromDate, setChartFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [chartToDate, setChartToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [candlesData, setCandlesData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState('');
  const [availableStocks, setAvailableStocks] = useState([]);

  const fetchAvailableStocks = useCallback(async () => {
    try {
      const res = await fetch('/api/backtest/collections');
      const data = await res.json();
      if (res.ok && data.stocks) {
        setAvailableStocks(data.stocks);
        if (data.stocks.length > 0) {
          const hasReliance = data.stocks.some(s => s.symbol === 'NSE:RELIANCE');
          if (!hasReliance) {
            setChartSymbol(data.stocks[0].symbol);
            if (data.stocks[0].intervals && data.stocks[0].intervals.length > 0) {
              setChartInterval(data.stocks[0].intervals[0]);
            }
          }
        }
      }
    } catch (e) {
      console.error('[Fetch Available Stocks Error]:', e);
    }
  }, []);

  const fetchCandles = useCallback(async () => {
    if (!chartSymbol) {
      setChartError('Symbol is required');
      return;
    }
    setChartLoading(true);
    setChartError('');
    try {
      const queryParams = new URLSearchParams({
        symbol: chartSymbol,
        interval: chartInterval,
        fromDate: chartFromDate,
        toDate: chartToDate
      }).toString();
      
      const res = await fetch(`/api/candles?${queryParams}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch candlestick data');
      }
      setCandlesData(data.candles || []);
    } catch (err) {
      console.error('[Fetch Candles Error]:', err);
      setChartError(err.message || 'An error occurred while loading chart data');
    } finally {
      setChartLoading(false);
    }
  }, [chartSymbol, chartInterval, chartFromDate, chartToDate]);

  useEffect(() => {
    if (appConfig.hasAccessToken) {
      fetchAvailableStocks();
    }
  }, [appConfig.hasAccessToken, fetchAvailableStocks]);

  useEffect(() => {
    if (view === 'charts' && candlesData.length === 0 && !chartLoading && chartSymbol) {
      fetchCandles();
    }
  }, [view, candlesData.length, fetchCandles, chartLoading, chartSymbol]);

  // Time elapsed indicator tracking
  const [lastIntradayCheckedTime, setLastIntradayCheckedTime] = useState(Date.now());
  const isPipelineRunning = useRef(false);

  // IP addresses state
  const [ipv4, setIpv4] = useState('Fetching...');
  const [ipv6, setIpv6] = useState('Fetching...');
  const [copiedIpv4, setCopiedIpv4] = useState(false);
  const [copiedIpv6, setCopiedIpv6] = useState(false);

  const fetchIps = async () => {
    setIpv4('Fetching...');
    setIpv6('Fetching...');
    try {
      const res = await fetch('https://api4.ipify.org?format=json');
      const data = await res.json();
      setIpv4(data.ip || 'Not Found');
    } catch (err) {
      setIpv4('Unavailable');
    }
    try {
      const res = await fetch('https://api6.ipify.org?format=json');
      const data = await res.json();
      setIpv6(data.ip || 'Not Found');
    } catch (err) {
      setIpv6('Unavailable');
    }
  };

  const handleCopyIp = (ip, type) => {
    if (ip === 'Fetching...' || ip === 'Unavailable' || ip === 'Not Found') return;
    navigator.clipboard.writeText(ip).then(() => {
      if (type === 'v4') {
        setCopiedIpv4(true);
        setTimeout(() => setCopiedIpv4(false), 2000);
      } else {
        setCopiedIpv6(true);
        setTimeout(() => setCopiedIpv6(false), 2000);
      }
    });
  };

  useEffect(() => {
    fetchIps();

    const today = new Date().toDateString();
    const lastShown = localStorage.getItem('ipModalLastShown');
    if (lastShown !== today) {
      setShowMorningIpModal(true);
    }
  }, []);

  const closeIpModal = () => {
    localStorage.setItem('ipModalLastShown', new Date().toDateString());
    setShowMorningIpModal(false);
  };

  // Market time clock update (IST timezone)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setMarketTime(now.toLocaleTimeString('en-US', options));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Persistence for Alert Subscriptions
  useEffect(() => {
    localStorage.setItem('signals_subscribed_alerts', JSON.stringify(subscribedAlerts));
  }, [subscribedAlerts]);

  useEffect(() => {
    localStorage.setItem('signals_alert_history', JSON.stringify(alertHistory));
  }, [alertHistory]);

  // Synthesized audio double-chime beep using HTML5 Web Audio API
  const playAlertSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.4);
      osc2.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Web Audio API play failed:', e);
    }
  };

  // Background Scanner Alerts Poller
  const prevScannerMatchesRef = useRef({});

  useEffect(() => {
    if (!appConfig.hasAccessToken || subscribedAlerts.length === 0) return;

    let isMounted = true;
    const checkAlerts = async () => {
      for (const scannerName of subscribedAlerts) {
        if (!isMounted) break;
        try {
          const res = await fetch(`/api/scanners/results?scanner=${encodeURIComponent(scannerName)}&index=Nifty%20500`);
          if (!res.ok) continue;
          const data = await res.json();
          if (!data.success || !data.results) continue;
          
          const currentSymbols = data.results.map(r => r.symbol);
          const prevSymbols = prevScannerMatchesRef.current[scannerName];
          
          if (prevSymbols !== undefined) {
            const newlyMatched = data.results.filter(r => !prevSymbols.includes(r.symbol));
            if (newlyMatched.length > 0) {
              newlyMatched.forEach(stock => {
                const alertObj = {
                  id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                  scannerName,
                  symbol: stock.symbol,
                  ltp: stock.ltp,
                  change: stock.change,
                  timestamp: new Date().toLocaleTimeString()
                };
                
                setAlertHistory(prev => [alertObj, ...prev].slice(0, 100));
                setToastNotification(alertObj);
                playAlertSound();
              });
            }
          }
          
          prevScannerMatchesRef.current[scannerName] = currentSymbols;
        } catch (e) {
          console.error(`Error checking alerts for ${scannerName}:`, e);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [subscribedAlerts, appConfig.hasAccessToken]);

  // Initialize configurations and states
  useEffect(() => {
    fetchConfig();
    fetchAppState();
  }, []);

  // Set up background poll interval (every 10s) and fast pipelining poll interval (every 1s)
  useEffect(() => {
    let dashboardTimer = null;
    let fastTimer = null;

    if (appConfig.hasAccessToken) {
      updateDashboardDataRef.current();
      dashboardTimer = setInterval(() => {
        updateDashboardDataRef.current();
      }, 10000);

      runIntradayPipelineRef.current();
      fastTimer = setInterval(() => {
        runIntradayPipelineRef.current();
      }, 300);
    }

    return () => {
      if (dashboardTimer) clearInterval(dashboardTimer);
      if (fastTimer) clearInterval(fastTimer);
    };
  }, [appConfig.hasAccessToken]);

  // Scroll chatbot message area to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Core API fetches
  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setAppConfig(data);
      if (data.hasAccessToken) {
        fetchToken();
      }
    } catch (err) {
      console.error('Error fetching configurations:', err);
    }
  };

  const fetchToken = async () => {
    try {
      const resp = await fetch('/api/token');
      const data = await resp.json();
      if (data.access_token) {
        setAccessToken(data.access_token);
      }
    } catch (err) {
      console.error('Error fetching token:', err);
    }
  };

  const fetchAppState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data) {
        if (data.selectedMarginPercentage !== undefined) setSelectedMarginPercentage(data.selectedMarginPercentage);
        if (data.watchlistedStocks !== undefined) setWatchlistedStocks(data.watchlistedStocks);
        if (data.intradayTriggers !== undefined) setIntradayTriggers(data.intradayTriggers);
        if (data.openOrdersDecisions !== undefined) setOpenOrdersDecisions(data.openOrdersDecisions);
        if (data.intradayActionsLogs !== undefined) setIntradayActionsLogs(data.intradayActionsLogs);
        
        setActiveStrategy(data.activeStrategy || 'momentum_surfing_morning');
        setCustomSystemPrompt(data.customSystemPrompt || '');
        if (data.profitTargetExit !== undefined) {
          setProfitTargetExit(data.profitTargetExit);
          if (!isPnlFormDirty) setProfitTargetExitDraft(data.profitTargetExit === 0 ? '' : String(data.profitTargetExit));
        }
        if (data.lossTargetExit !== undefined) {
          setLossTargetExit(data.lossTargetExit);
          if (!isPnlFormDirty) setLossTargetExitDraft(data.lossTargetExit === 0 ? '' : String(data.lossTargetExit));
        }
        if (data.pnlExitMode !== undefined) {
          setPnlExitMode(data.pnlExitMode);
          if (!isPnlFormDirty) setPnlExitModeDraft(data.pnlExitMode);
        }
        if (data.pnlExitAutoEnabled !== undefined) {
          setPnlExitAutoEnabled(data.pnlExitAutoEnabled);
          if (!isPnlFormDirty) setPnlExitAutoEnabledDraft(data.pnlExitAutoEnabled);
        }
        if (data.reallocationAutoEnabled !== undefined) {
          setReallocationAutoEnabled(data.reallocationAutoEnabled);
        }
        if (data.subscribedTokens !== undefined && Array.isArray(data.subscribedTokens)) {
          setSubscribedTokens(data.subscribedTokens);
        }
      }
    } catch (err) {
      console.error('Error fetching state from server:', err);
    }
  };

  // Poll backend WebSocket status and logs every second when on admin/scanners view
  useEffect(() => {
    if (!appConfig.hasAccessToken) return;
    let timer = null;

    const pollBackendStream = async () => {
      try {
        const [statusRes, logsRes] = await Promise.all([
          fetch('/api/ws-stream/status').then(r => r.json()),
          fetch('/api/ws-stream/logs').then(r => r.json())
        ]);
        if (statusRes && statusRes.status) {
          setBackendWsStatus(statusRes.status);
          setSubscribedCount(statusRes.subscribedCount || 0);
        }
        if (logsRes && logsRes.logs) {
          setBackendWsLogs(logsRes.logs);
        }
      } catch (err) {
        console.error('Error polling backend stream status:', err);
      }
    };

    if (view === 'admin' || view === 'scanners') {
      pollBackendStream();
      timer = setInterval(pollBackendStream, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [view, appConfig.hasAccessToken]);

  // Fetch Network IPs when on Admin view
  useEffect(() => {
    if (view === 'admin' && appConfig.hasAccessToken) {
      fetch('/api/system/network-ips')
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setNetworkIps(data.ips);
          }
        })
        .catch(err => console.error('Error fetching network IPs:', err));
    }
  }, [view, appConfig.hasAccessToken]);

  const runScanner = useCallback(async (scannerName = selectedScanner, indexName = selectedScannerIndex) => {
    setScannerLoading(true);
    try {
      const res = await fetch(`/api/scanners/results?scanner=${encodeURIComponent(scannerName)}&index=${encodeURIComponent(indexName)}`);
      const data = await res.json();
      if (data && data.results) {
        setScannerResults(data.results);
      }
    } catch (err) {
      console.error('Error running scanner:', err);
    } finally {
      setScannerLoading(false);
    }
  }, [selectedScanner, selectedScannerIndex]);

  // Poll scanner results every 1 second when view is 'scanners'
  useEffect(() => {
    if (!appConfig.hasAccessToken || view !== 'scanners') return;
    let timer = null;

    const pollScannerResults = () => {
      runScanner(selectedScanner, selectedScannerIndex);
    };

    pollScannerResults();
    timer = setInterval(pollScannerResults, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [view, selectedScanner, selectedScannerIndex, appConfig.hasAccessToken, runScanner]);

  const fetchScannersList = useCallback(async () => {
    try {
      const res = await fetch('/api/scanners');
      if (res.ok) {
        const data = await res.json();
        if (data && data.scanners) {
          setScannersList(data.scanners);
        }
      }
    } catch (err) {
      console.error('Error fetching scanners list:', err);
    }
  }, []);

  const handleCreateScannerFromPrompt = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError('');
    setAiSuccess(null);
    try {
      const res = await fetch('/api/scanners/create-from-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiSuccess(data.scanner);
        setAiPrompt('');
        fetchScannersList();
        setSelectedScanner(data.scanner.name);
      } else {
        setAiError(data.error || 'Failed to create scanner');
      }
    } catch (err) {
      setAiError(err.message || 'An error occurred');
    } finally {
      setAiGenerating(false);
    }
  };

  // Historical Sync Helpers
  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/historical-sync/status');
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data.status);
        if (data.status.status === 'running') {
          setSyncPolling(true);
        } else {
          setSyncPolling(false);
        }
      }
    } catch (e) {
      console.error('Error fetching sync status:', e);
    }
  }, []);

  const handleStartHistoricalSync = async () => {
    try {
      const res = await fetch('/api/admin/historical-sync/start', { method: 'POST' });
      if (res.ok) {
        setSyncPolling(true);
        fetchSyncStatus();
      } else {
        let errMsg = 'Unknown error';
        const text = await res.text();
        try {
          const err = JSON.parse(text);
          errMsg = err.error || errMsg;
        } catch (jsonErr) {
          errMsg = text || `${res.status} ${res.statusText}`;
        }
        showAlert('Failed to start sync: ' + errMsg);
      }
    } catch (e) {
      showAlert('Error starting sync: ' + e.message);
    }
  };

  useEffect(() => {
    let timer = null;
    if (syncPolling) {
      fetchSyncStatus();
      timer = setInterval(fetchSyncStatus, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [syncPolling, fetchSyncStatus]);

  useEffect(() => {
    if (view === 'admin') {
      fetchSyncStatus();
    }
  }, [view, fetchSyncStatus]);


  // Poll top 7 Nifty 500 gainers for the dashboard every 5 minutes
  useEffect(() => {
    if (!appConfig.hasAccessToken || view !== 'dashboard') return;
    let timer = null;


    return () => {
      if (timer) clearInterval(timer);
    };
  }, [view, appConfig.hasAccessToken]);

  // Trigger backend WebSocket connection automatically on load
  useEffect(() => {
    if (appConfig.hasAccessToken) {
      console.log('[App] Triggering backend WebSocket connection...');
      fetch('/api/ws-stream/connect', { method: 'POST' })
        .then(r => r.json())
        .then(d => console.log('[Backend Stream Auto-Connect]', d.message || d))
        .catch(err => console.error('[Backend Stream Auto-Connect] Failed:', err));
    }
  }, [appConfig.hasAccessToken]);

  useEffect(() => {
    fetchScannersList();
  }, [fetchScannersList]);

  const saveAppStateField = async (update) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save state');
      }
    } catch (err) {
      console.error('Error saving state field:', err);
      throw err;
    }
  };

  const toggleReallocationLogic = async () => {
    const newVal = !reallocationAutoEnabled;
    setReallocationAutoEnabled(newVal);
    try {
      await saveAppStateField({ reallocationAutoEnabled: newVal });
    } catch (err) {
      console.error('Failed to update reallocation state', err);
    }
  };

  const updateDashboardData = async () => {
    try {
      // Parallel fetches for standard dashboard info
      const [marginsRes, gttRes, holdingsRes, positionsRes, memoriesRes] = await Promise.all([
        fetch('/api/margins').then(r => r.json()),
        fetch('/api/gtt/triggers').then(r => r.json()),
        fetch('/api/holdings').then(r => r.json()),
        fetch('/api/positions').then(r => r.json()),
        fetch('/api/memory').then(r => r.json())
      ]);

      setMargins(marginsRes);
      if (marginsRes?.lastReallocationTime) {
        setLastReallocationTime(marginsRes.lastReallocationTime);
      }
      setGttTriggers(gttRes || []);
      setHoldings(holdingsRes || []);
      setPositions(positionsRes.net || []);
      setMemories(memoriesRes.memories || []);

      console.log('[Dashboard Data] margins:', marginsRes);
      console.log('[Dashboard Data] positions & charges:', positionsRes);
    } catch (err) {
      console.error('Dashboard polling error:', err);
    }
  };

  // 1-second pipeline check
  const runIntradayPipeline = async () => {
    if (isPipelineRunning.current) return;
    isPipelineRunning.current = true;

    try {
      // Standard pipeline sync
      const [positionsRes, gttRes, marginsRes] = await Promise.all([
        fetch('/api/positions').then(r => r.json()),
        fetch('/api/gtt/triggers').then(r => r.json()),
        fetch('/api/margins').then(r => r.json())
      ]);

      // Time-based exit check (at/after 3:24 PM)
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const isAutoExitTime = (hours === 15 && minutes >= 24) || (hours >= 16);

      const netPositions = positionsRes.net || [];
      const hasActiveMis = netPositions.some(p => p.product === 'MIS' && Math.abs(p.quantity) > 0);

      if (isAutoExitTime && hasActiveMis) {
        await executeAutoExit();
      }

      // Update API calls statistics
      if (positionsRes.apiStats) {
        setApiStats(positionsRes.apiStats);
      }

      // Extract and set liveQuotes from backend in-memory cache, preserving high-fidelity browser WS quotes if connected
      if (positionsRes.liveQuotes) {
        setLiveQuotes(prev => {
          const next = { ...prev };
          Object.keys(positionsRes.liveQuotes).forEach(tok => {
            const numTok = Number(tok);
            if (wsStatus !== 'connected' || !next[numTok] || next[numTok].mode !== 'full') {
              next[numTok] = positionsRes.liveQuotes[tok];
            }
          });
          return next;
        });
      }

      // Synchronize database state limits
      if (positionsRes.profitTargetExit !== undefined) {
        setProfitTargetExit(positionsRes.profitTargetExit);
        if (!isPnlFormDirty) setProfitTargetExitDraft(positionsRes.profitTargetExit === 0 ? '' : String(positionsRes.profitTargetExit));
      }
      if (positionsRes.lossTargetExit !== undefined) {
        setLossTargetExit(positionsRes.lossTargetExit);
        if (!isPnlFormDirty) setLossTargetExitDraft(positionsRes.lossTargetExit === 0 ? '' : String(positionsRes.lossTargetExit));
      }
      if (positionsRes.pnlExitMode !== undefined) {
        setPnlExitMode(positionsRes.pnlExitMode);
        if (!isPnlFormDirty) setPnlExitModeDraft(positionsRes.pnlExitMode);
      }
      if (positionsRes.pnlExitAutoEnabled !== undefined) {
        setPnlExitAutoEnabled(positionsRes.pnlExitAutoEnabled);
        if (!isPnlFormDirty) setPnlExitAutoEnabledDraft(positionsRes.pnlExitAutoEnabled);
      }
      if (positionsRes.totalCharges !== undefined) setTotalCharges(positionsRes.totalCharges);

      setPositions(positionsRes.net || []);
      setGttTriggers(gttRes || []);
      setMargins(marginsRes);

      // Track active check time
      setLastIntradayCheckedTime(Date.now());
      if (intradayTriggers.length > 0) {
        const elapsed = Math.round((Date.now() - lastIntradayCheckedTime) / 1000);
        setIntradayStatusText(`checked ${elapsed}s ago`);
      } else {
        setIntradayStatusText('idle');
      }
    } catch (err) {
      console.error('Intraday pipeline processing error:', err);
    } finally {
      isPipelineRunning.current = false;
    }
  };

  // Latest function references for pollers to prevent stale closures
  const updateDashboardDataRef = useRef(updateDashboardData);
  const runIntradayPipelineRef = useRef(runIntradayPipeline);

  useEffect(() => {
    updateDashboardDataRef.current = updateDashboardData;
    runIntradayPipelineRef.current = runIntradayPipeline;
  });

  const executeAutoExit = async () => {
    console.log('[Auto-Exit] Triggering automatic squareoff...');
    try {
      const [positionsData, ordersData, gttData] = await Promise.all([
        fetch('/api/positions').then(r => r.json()),
        fetch('/api/orders').then(r => r.json()),
        fetch('/api/gtt/triggers').then(r => r.json())
      ]);

      const netPositions = positionsData.net || [];
      const activeMisPositions = netPositions.filter(p => p.product === 'MIS' && p.quantity !== 0);
      const misSymbols = new Set(activeMisPositions.map(p => p.tradingsymbol));

      // Cancel MIS open orders
      const openStatuses = ['OPEN', 'AMEND REQ RECEIVED', 'PUT ORDER REQ RECEIVED', 'VALIDATION PENDING'];
      const openOrders = (ordersData || []).filter(o => openStatuses.includes(o.status) && o.product === 'MIS');
      
      for (const o of openOrders) {
        await fetch(`/api/orders/${o.order_id}?variety=${o.variety}`, { method: 'DELETE' });
        appendActionLog(`[Auto-Exit] Cancelled open MIS order ${o.order_id} (${o.tradingsymbol})`);
      }

      // Delete MIS GTT triggers
      const activeGtts = gttData || [];
      const correspondingGtts = activeGtts.filter(g => 
        misSymbols.has(g.condition?.tradingsymbol) || g.orders?.some(o => o.product === 'MIS')
      );

      for (const g of correspondingGtts) {
        await fetch(`/api/gtt/triggers/${g.id}`, { method: 'DELETE' });
        appendActionLog(`[Auto-Exit] Deleted corresponding GTT trigger ${g.id} (${g.condition?.tradingsymbol})`);
      }

      // Sell/Square off MIS positions
      for (const p of activeMisPositions) {
        const qty = p.quantity;
        const action = qty > 0 ? 'SELL' : 'BUY';
        const absQty = Math.abs(qty);
        const ltp = p.last_price || p.average_price || 0;
        const limitPrice = action === 'BUY' ? parseFloat((ltp * 1.01).toFixed(2)) : parseFloat((ltp * 0.99).toFixed(2));

        const orderParams = {
          exchange: p.exchange,
          tradingsymbol: p.tradingsymbol,
          transaction_type: action,
          quantity: absQty,
          product: 'MIS',
          order_type: 'LIMIT',
          price: limitPrice
        };

        await fetch('/api/local-tool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'place_order', arguments: orderParams })
        });
        appendActionLog(`[Auto-Exit] Squared off ${absQty} shares of ${p.tradingsymbol} (Action: ${action})`);
      }

    } catch (err) {
      console.error('Auto exit handler failed:', err);
    }
  };

  const appendActionLog = async (logText) => {
    const timestampStr = new Date().toLocaleTimeString();
    const cleanLog = `[${timestampStr}] ${logText}`;
    setIntradayActionsLogs(prev => {
      const next = [cleanLog, ...prev].slice(0, 100);
      saveAppStateField({ intradayActionsLogs: next });
      return next;
    });
  };

  // P&L Auto Cutoff Calculations
  let currentMisPnL = 0;
  let activeMisCount = 0;
  if (positions && Array.isArray(positions)) {
    const activeMis = positions.filter(p => p.product === 'MIS');
    activeMis.forEach(p => {
      const isOpen = Math.abs(p.quantity) > 0;
      if (isOpen) {
        activeMisCount++;
      }
      if (pnlExitModeDraft === 'current') {
        if (isOpen) {
          currentMisPnL += (p.pnl || 0);
        }
      } else {
        currentMisPnL += (p.pnl || 0);
      }
    });
  }
  
  // currentMisPnL is now Gross (without charges deducted)

  // Portfolio calculations
  let portfolioCurrent = 0;
  let portfolioInvested = 0;
  let portfolioPnL = 0;
  if (holdings && Array.isArray(holdings)) {
    holdings.forEach(h => {
      portfolioInvested += (h.quantity * h.average_price);
      portfolioCurrent += (h.quantity * (h.last_price || h.average_price));
      portfolioPnL += h.pnl !== undefined ? h.pnl : ((h.last_price - h.average_price) * h.quantity);
    });
  }

  let positionsPnL = 0;
  if (positions && Array.isArray(positions)) {
    positions.forEach(p => {
      positionsPnL += (p.pnl || 0);
    });
  }

  const availableCash = margins?.equity?.net || 0;
  const portfolioAssetVal = availableCash + portfolioCurrent + positionsPnL;
  const currentNetPnL = positionsPnL + portfolioPnL - totalCharges;

  useEffect(() => {
    if (prevNetPnLRef.current !== currentNetPnL) {
      setNetPnLDiff(currentNetPnL - prevNetPnLRef.current);
      prevNetPnLRef.current = currentNetPnL;
    }
  }, [currentNetPnL]);
  const portfolioPnLPercent = portfolioInvested > 0 ? (portfolioPnL / portfolioInvested) * 100 : 0;

  // Zerodha Login & Logout
  const handleLogin = () => {
    window.location.href = '/api/login';
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      window.location.reload();
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  // Chat Execution
  const handleRefreshScannerSilent = async (scannerName) => {
    try {
      const res = await fetch(`/api/scanners/results?scanner=${encodeURIComponent(scannerName)}&index=Nifty%20500`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.results || data.results.length === 0) {
        showAlert(`No results available for scanner: ${scannerName}`);
        return;
      }
      const topSyms = data.results.slice(0, 3).map(r => r.symbol).join(', ');
      showAlert(`Refreshed ${scannerName}.\nFound ${data.results.length} stocks. Top: ${topSyms}`);
    } catch (err) {
      showAlert(`Error refreshing ${scannerName}: ${err.message}`);
    }
  };

  const handleProvideScannerToAgent = async (scannerName) => {
    if (isChatLoading) return;
    setIsChatLoading(true);

    try {
      const res = await fetch(`/api/scanners/results?scanner=${encodeURIComponent(scannerName)}&index=Nifty%20500`);
      const data = await res.json();
      
      if (!res.ok || !data.success || !data.results || data.results.length === 0) {
        showAlert(`No results available for scanner: ${scannerName}`);
        setIsChatLoading(false);
        return;
      }
      
      const top7 = data.results.slice(0, 7);
      const stockList = top7.map((g, i) => `${i + 1}. NSE:${g.symbol} (LTP: ₹${g.ltp.toFixed(2)}, Change: ${g.change > 0 ? '+' : ''}${g.change.toFixed(2)}%, Vol: ${g.volume ? g.volume.toLocaleString() : '0'})`).join('\n');
      
      const isSellMode = chatMode === 'SELL';
      const orderTypeLabel = isSellMode ? 'SELL' : 'BUY';
      const orderDesc = isSellMode 
        ? 'execute SELL (short) entry trades for all of them.' 
        : 'execute BUY entry trades for all of them.';
      const protocolDesc = isSellMode
        ? `Call the 'place_order' tool IMMEDIATELY for each of the 7 stocks to place SELL orders (product: "MIS", order_type: "LIMIT", price: LTP * 0.99 to ensure immediate pseudo-market execution).`
        : `Call the 'place_order' tool IMMEDIATELY for each of the 7 stocks to place BUY orders (product: "MIS", order_type: "LIMIT", price: LTP * 1.01 to ensure immediate pseudo-market execution).`;

      const promptText = `CRITICAL ACTION REQUIRED: Construct a balanced portfolio of the following top 7 stocks from the "${scannerName}" scanner, and IMMEDIATELY take positions by ${orderDesc}

STOCKS LIST:
${stockList}

EXECUTION PROTOCOL:
1. Check my available cash margin using the 'get_margins' tool to calculate the total buying power under our active strategy (using ${selectedMarginPercentage}% margin utilization with 5x leverage).
2. Create a balanced portfolio by allocating the total buying power equally among these 7 stocks.
3. Calculate the purchase quantity for each stock: Quantity = (Allocated buying power per stock) / LTP (rounded down to the nearest whole number).
4. ${protocolDesc}
5. After placing all 7 orders, call 'get_positions' in the next tool round to check and verify the actual positions obtained.
6. Present the final executed portfolio details.

CRITICAL DIRECTIVE: Do NOT ask for any confirmation, approval, or "should I proceed" questions. Execute these trades IMMEDIATELY and report the outcomes. No asking, no confirmation — just execution.`;

      setChatMessages(prev => [...prev, { 
        id: Date.now(), 
        sender: 'user', 
        text: `Feed top 7 stocks from "${scannerName}" to AI agent for immediate balanced portfolio execution (${chatMode} Mode).` 
      }]);

      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ message: promptText, mode: chatMode })
      });

      const chatData = await chatRes.json();
      if (!chatRes.ok) throw new Error(chatData.error || 'Failed to communicate with AI Agent.');

      setChatMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        sender: 'ai', 
        text: chatData.reply 
      }]);
    } catch (err) {
      console.error(`Error processing scanner ${scannerName}:`, err);
      showAlert(`Error: ${err.message}`);
    } finally {
      setIsChatLoading(false);
    }
  };

  const toggleScannerSort = (field) => {
    if (scannerSortField === field) {
      setScannerSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setScannerSortField(field);
      setScannerSortDirection('desc');
    }
  };

  const getSortedScannerResults = () => {
    if (!scannerSortField) return scannerResults;
    return [...scannerResults].sort((a, b) => {
      let valA = a[scannerSortField];
      let valB = b[scannerSortField];
      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;
      return scannerSortDirection === 'asc' ? valA - valB : valB - valA;
    });
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const query = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: query }]);
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          message: query,
          history: chatHistory,
          marginPercentage: selectedMarginPercentage,
          mode: chatMode
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Server request failed');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'assistant', text: data.response }]);
      setChatHistory(prev => {
        const next = [...prev, { role: 'user', content: query }, { role: 'assistant', content: data.response }];
        return next.slice(-20);
      });

      // Quick dashboard refresh trigger
      setTimeout(updateDashboardData, 3500);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { id: Date.now() + 2, sender: 'system', text: `Error: ${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Exit All Positions

  const handleExitAll = async () => {
    if (!window.confirm('Are you sure you want to EXIT ALL active positions immediately?')) return;
    try {
      const res = await fetch('/api/exit-all-positions', { method: 'POST' });
      if (res.ok) {
        showAlert('All positions squared off successfully!');
        updateDashboardData();
      } else {
        const err = await res.json();
        showAlert(`Failed to exit all positions: ${err.error}`);
      }
    } catch (e) {
      showAlert(`Error during exit all: ${e.message}`);
    }
  };

  const handleExitNegativePositions = async () => {
    if (!window.confirm('Are you sure you want to EXIT ALL NEGATIVE PNL MIS positions immediately?')) return;
    try {
      const res = await fetch('/api/exit-negative-positions', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showAlert(`Successfully squared off ${data.count} negative PnL positions!`);
        updateDashboardData();
      } else {
        const err = await res.json();
        showAlert(`Failed to exit negative positions: ${err.error}`);
      }
    } catch (e) {
      showAlert(`Error during targeted exit: ${e.message}`);
    }
  };

  // Save PnL Limits
  const handleSavePnLLimits = async () => {
    try {
      const profitVal = parseFloat(profitTargetExitDraft) || 0;
      const lossVal = parseFloat(lossTargetExitDraft) || 0;

      await saveAppStateField({
        profitTargetExit: profitVal,
        lossTargetExit: lossVal,
        pnlExitMode: pnlExitModeDraft,
        pnlExitAutoEnabled: pnlExitAutoEnabledDraft
      });

      setProfitTargetExit(profitVal);
      setLossTargetExit(lossVal);
      setLossTargetExitDraft(lossVal === 0 ? '' : String(lossVal));
      setPnlExitMode(pnlExitModeDraft);
      setPnlExitAutoEnabled(pnlExitAutoEnabledDraft);
    } catch (e) {
      showAlert('Failed to save limits: ' + e.message);
    }
  };

  // Handle immediate change of exit mode (draft-only, updates display instantly)
  const handleExitModeChange = (val) => {
    setPnlExitModeDraft(val);
  };

  // Handle immediate change of auto exit enabled switch (draft-only)
  const handleExitAutoEnabledChange = (val) => {
    setPnlExitAutoEnabledDraft(val);
  };

  // WebSocket Streaming Helpers
  const addWsLog = (text) => {
    const timestamp = new Date().toLocaleTimeString();
    setWsLogs(prev => [`[${timestamp}] ${text}`, ...prev].slice(0, 50));
  };

  const getSymbolForToken = (token) => {
    const INDEX_NAMES = {
      256265: 'NIFTY 50',
      260007: 'NIFTY BANK',
      265: 'SENSEX'
    };
    if (INDEX_NAMES[token]) return INDEX_NAMES[token];
    if (resolvedSymbols[token]) return resolvedSymbols[token];
    
    const pos = positions.find(p => p.instrument_token === token);
    if (pos) return pos.tradingsymbol;
    
    return `Token ${token}`;
  };

  const connectWebSocket = async () => {
    if (wsRef.current) return;
    setWsStatus('connecting');
    addWsLog('Connecting to Kite WebSocket...');
    try {
      const res = await fetch('/api/credentials');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch Kite credentials. Ensure you are connected.');
      }
      const creds = await res.json();
      if (!creds.api_key || !creds.access_token) {
        throw new Error('Missing API Key or Access Token. Connect your Zerodha account first.');
      }
      
      const wsUrl = `wss://ws.kite.trade?api_key=${creds.api_key}&access_token=${creds.access_token}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      
      ws.onopen = () => {
        setWsStatus('connected');
        addWsLog('Kite WebSocket connected!');
        if (subscribedTokens.length > 0) {
          ws.send(JSON.stringify({ a: "subscribe", v: subscribedTokens }));
          ws.send(JSON.stringify({ a: "mode", v: ["quote", subscribedTokens] }));
          addWsLog(`Subscribed to initial tokens: ${subscribedTokens.join(', ')} in quote mode`);
        }
      };
      
      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          try {
            const packets = parseKiteBinaryMessage(event.data);
            if (packets && packets.length > 0) {
              setLiveQuotes(prev => {
                const next = { ...prev };
                packets.forEach(p => {
                  const prevLtp = prev[p.token]?.ltp;
                  p.direction = prevLtp === undefined ? 'flat' : (p.ltp > prevLtp ? 'up' : (p.ltp < prevLtp ? 'down' : prev[p.token].direction || 'flat'));
                  next[p.token] = { ...prev[p.token], ...p, lastTickTime: Date.now() };
                });
                return next;
              });
            }
          } catch (e) {
            console.error('Error parsing binary quotes:', e);
          }
        } else {
          try {
            const textData = JSON.parse(event.data);
            addWsLog(`Update: ${JSON.stringify(textData)}`);
          } catch (e) {
            addWsLog(`Text Message: ${event.data}`);
          }
        }
      };
      
      ws.onclose = (event) => {
        setWsStatus('disconnected');
        wsRef.current = null;
        addWsLog(`WebSocket closed (Code: ${event.code})`);
      };
      
      ws.onerror = (err) => {
        setWsStatus('disconnected');
        wsRef.current = null;
        addWsLog(`WebSocket error: ${err.message || 'Unknown error'}`);
      };
      
    } catch (e) {
      setWsStatus('disconnected');
      wsRef.current = null;
      addWsLog(`Connection failed: ${e.message}`);
      showAlert(e.message);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      addWsLog('Closing WebSocket...');
      wsRef.current.close();
      wsRef.current = null;
      setWsStatus('disconnected');
    }
  };

  // Auto-connect frontend Kite WebSocket when access token is available, and disconnect when it is not
  useEffect(() => {
    if (appConfig.hasAccessToken) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }
    return () => {
      disconnectWebSocket();
    };
  }, [appConfig.hasAccessToken]);

  const handleSubscribeToken = async (symbolStr) => {
    if (!symbolStr || !symbolStr.trim()) return showAlert('Please enter a valid ticker symbol.');
    const symbol = symbolStr.trim().toUpperCase();
    
    // Check if it is a numeric token (in case they still enter a number)
    const possibleToken = parseInt(symbol);
    if (!isNaN(possibleToken)) {
      if (subscribedTokens.includes(possibleToken)) return showAlert('Already subscribed to this token.');
      const nextTokens = [...subscribedTokens, possibleToken];
      setSubscribedTokens(nextTokens);
      saveAppStateField({ subscribedTokens: nextTokens }).catch(() => {});
      setCustomTokenInput('');
      if (wsStatus === 'connected' && wsRef.current) {
        wsRef.current.send(JSON.stringify({ a: "subscribe", v: [possibleToken] }));
        wsRef.current.send(JSON.stringify({ a: "mode", v: ["quote", [possibleToken]] }));
        addWsLog(`Subscribed to token: ${possibleToken} in quote mode`);
      }
      return;
    }
    
    try {
      addWsLog(`Resolving symbol: ${symbol}...`);
      const res = await fetch(`/api/resolve-symbol?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to resolve symbol: ${symbol}`);
      }
      const data = await res.json();
      const resolvedToken = data.instrument_token;
      
      if (subscribedTokens.includes(resolvedToken)) {
        return showAlert(`Already subscribed to ${symbol} (Token ${resolvedToken}).`);
      }
      
      const displayName = data.exchange ? `${data.exchange}:${data.tradingsymbol}` : data.tradingsymbol;
      setResolvedSymbols(prev => ({ ...prev, [resolvedToken]: displayName }));
      const nextTokens = [...subscribedTokens, resolvedToken];
      setSubscribedTokens(nextTokens);
      saveAppStateField({ subscribedTokens: nextTokens }).catch(() => {});
      setCustomTokenInput('');
      
      if (wsStatus === 'connected' && wsRef.current) {
        wsRef.current.send(JSON.stringify({ a: "subscribe", v: [resolvedToken] }));
        wsRef.current.send(JSON.stringify({ a: "mode", v: ["quote", [resolvedToken]] }));
        addWsLog(`Subscribed to ${displayName} (Token: ${resolvedToken}) in quote mode`);
      } else {
        addWsLog(`Added subscription for ${displayName} (Token: ${resolvedToken}). Connect stream to start receiving ticks.`);
      }
    } catch (e) {
      addWsLog(`Resolution error: ${e.message}`);
      showAlert(e.message);
    }
  };

  const handleUnsubscribeToken = (token) => {
    const nextTokens = subscribedTokens.filter(t => t !== token);
    setSubscribedTokens(nextTokens);
    saveAppStateField({ subscribedTokens: nextTokens }).catch(() => {});
    if (wsStatus === 'connected' && wsRef.current) {
      wsRef.current.send(JSON.stringify({ a: "unsubscribe", v: [token] }));
      addWsLog(`Unsubscribed from token: ${token}`);
    }
  };

  const handleSetStreamMode = (token, mode) => {
    if (wsStatus === 'connected' && wsRef.current) {
      wsRef.current.send(JSON.stringify({ a: "mode", v: [mode, [token]] }));
      addWsLog(`Set token ${token} mode to ${mode}`);
    }
  };

  const handleSubscribeFull = (token) => {
    const numericToken = Number(token);
    if (isNaN(numericToken)) return;
    
    if (!subscribedTokens.includes(numericToken)) {
      const nextTokens = [...subscribedTokens, numericToken];
      setSubscribedTokens(nextTokens);
      saveAppStateField({ subscribedTokens: nextTokens }).catch(() => {});
      
      if (wsStatus === 'connected' && wsRef.current) {
        wsRef.current.send(JSON.stringify({ a: "subscribe", v: [numericToken] }));
        addWsLog(`Subscribed to token: ${numericToken} for FlowMap`);
      }
    }
    
    if (wsStatus === 'connected' && wsRef.current) {
      setTimeout(() => {
        wsRef.current.send(JSON.stringify({ a: "mode", v: ["full", [numericToken]] }));
        addWsLog(`Set token ${numericToken} mode to full depth for FlowMap`);
      }, 200);
    }
  };

  // Auto-subscribe to open positions when connected
  useEffect(() => {
    if (wsStatus === 'connected' && wsRef.current && positions && positions.length > 0) {
      const positionTokens = positions
        .filter(p => p.instrument_token && p.quantity !== 0)
        .map(p => p.instrument_token);
        
      if (positionTokens.length > 0) {
        const newTokens = positionTokens.filter(t => !subscribedTokens.includes(t));
        if (newTokens.length > 0) {
          setSubscribedTokens(prev => {
            const next = Array.from(new Set([...prev, ...newTokens]));
            wsRef.current.send(JSON.stringify({ a: "subscribe", v: newTokens }));
            wsRef.current.send(JSON.stringify({ a: "mode", v: ["quote", newTokens] }));
            addWsLog(`Auto-subscribed to position tokens: ${newTokens.join(', ')} in quote mode`);
            return next;
          });
        }
      }
    }
  }, [positions, wsStatus]);

  // Clean up WebSocket on component unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Reset/Clear Memories
  const handleResetMemories = async () => {
    if (!window.confirm('Are you sure you want to clear all stored preferences/memories?')) return;
    try {
      const res = await fetch('/api/memory/reset', { method: 'POST' });
      if (res.ok) {
        setMemories([]);
        showAlert('Memories cleared successfully!');
      }
    } catch (e) {
      console.error('Error clearing memories:', e);
    }
  };

  // Delete GTT Order
  const handleDeleteGtt = async (gttId) => {
    if (!window.confirm('Cancel GTT trigger?')) return;
    try {
      const res = await fetch(`/api/gtt/triggers/${gttId}`, { method: 'DELETE' });
      if (res.ok) {
        setGttTriggers(prev => prev.filter(g => g.id !== gttId));
      }
    } catch (e) {
      console.error('Error deleting GTT:', e);
    }
  };

  // Delete Open Order
  const handleDeleteOrder = async (orderId, variety) => {
    if (!window.confirm('Cancel this open order?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}?variety=${variety}`, { method: 'DELETE' });
      if (res.ok) {
        setOrders(prev => prev.filter(o => o.order_id !== orderId));
      }
    } catch (e) {
      console.error('Error cancelling order:', e);
    }
  };

  // Dev Print to Console
  const handleDevPrint = () => {
    console.log('[Dev] Current React State Margins:', margins);
    console.log('[Dev] Current React State Positions:', positions);
    console.log('[Dev] Current React State Total Charges:', totalCharges);

    const devBasketPayload = [
      {
        "exchange": "NSE",
        "tradingsymbol": "SBIN",
        "transaction_type": "BUY",
        "variety": "regular",
        "product": "MIS",
        "order_type": "MARKET",
        "quantity": 10,
        "price": 0,
        "trigger_price": 0
      },
      {
        "exchange": "NSE",
        "tradingsymbol": "RELIANCE",
        "transaction_type": "SELL",
        "variety": "regular",
        "product": "MIS",
        "order_type": "MARKET",
        "quantity": 5,
        "price": 0,
        "trigger_price": 0
      }
    ];

    const devChargesPayload = [
      {
        "order_id": "111111111",
        "exchange": "NSE",
        "tradingsymbol": "SBIN",
        "transaction_type": "BUY",
        "variety": "regular",
        "product": "CNC",
        "order_type": "MARKET",
        "quantity": 1,
        "average_price": 560
      },
      {
        "order_id": "2222222222",
        "exchange": "NSE",
        "tradingsymbol": "RELIANCE",
        "transaction_type": "SELL",
        "variety": "regular",
        "product": "MIS",
        "order_type": "LIMIT",
        "quantity": 1,
        "average_price": 2450
      },
      {
        "order_id": "3333333333",
        "exchange": "NSE",
        "tradingsymbol": "INFY",
        "transaction_type": "BUY",
        "variety": "regular",
        "product": "CNC",
        "order_type": "LIMIT",
        "quantity": 10,
        "average_price": 1420
      }
    ];

    console.log('[Dev] Hitting Basket Margins API with MIS payload:', devBasketPayload);
    fetch('/api/margins/basket?consider_positions=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(devBasketPayload)
    })
      .then(r => r.json())
      .then(data => {
        console.log('[Dev] Basket Margins API Response:', data);
        if (data.data) {
          console.log('[Dev] Basket Margins Charges Block:', data.data.charges);
          console.log('[Dev] Basket Margins Total Charges:', data.data.charges?.total);
        }
      })
      .catch(e => console.error('[Dev] Basket Margins fetch failed:', e));

    console.log('[Dev] Hitting Virtual Contract Note Charges API with payload:', devChargesPayload);
    fetch('/api/charges/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(devChargesPayload)
    })
      .then(r => r.json())
      .then(data => {
        console.log('[Dev] Virtual Contract Note API Response:', data);
        if (data.data) {
          console.log('[Dev] Virtual Contract Note RAW data:', data.data);
        }
      })
      .catch(e => console.error('[Dev] Virtual Contract Note fetch failed:', e));
  };

  // Copy Access Token
  const handleCopyToken = () => {
    if (!accessToken || accessToken === '—') return;
    navigator.clipboard.writeText(accessToken).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  };

  // Dynamic Symbol Parser helper
  const parseInputSymbols = async (text) => {
    const parseResponse = await fetch('/api/parse-symbols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!parseResponse.ok) {
      const parseErr = await parseResponse.json().catch(() => ({}));
      throw new Error(parseErr.error || `Parsing symbols failed (HTTP ${parseResponse.status})`);
    }
    return (await parseResponse.json()).symbols || [];
  };

  // EMA Trend Analyzer Logic
  const handleTrendSubmit = async (e) => {
    e.preventDefault();
    if (!trendInput.trim() || trendLoading) return;

    setTrendLoading(true);
    setTrendError('');
    setTrendLoadingText('Parsing stock symbols via AI strategist...');
    setAnalyzedStocks([]);
    setSelectedStock(null);

    try {
      const symbols = await parseInputSymbols(trendInput);
      if (symbols.length === 0) {
        throw new Error('No valid stock symbols extracted. Try again.');
      }

      setTrendLoadingText(`Analyzing trend metrics for ${symbols.length} stocks...`);
      
      const analyzePromises = symbols.map(async (symbol) => {
        const response = await fetch(`/api/ema-difference?symbol=${encodeURIComponent(symbol)}`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch indicator data for ${symbol}`);
        }
        return response.json();
      });

      const results = await Promise.allSettled(analyzePromises);
      const successResults = [];
      const failed = [];

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          successResults.push(r.value);
        } else {
          failed.push({ symbol: symbols[idx], error: r.reason?.message || 'Failed' });
        }
      });

      if (successResults.length === 0) {
        const errDetail = failed.map(f => `${f.symbol}: ${f.error}`).join(', ');
        throw new Error(`Failed to analyze stocks. Details: ${errDetail}`);
      }

      setAnalyzedStocks(successResults);
      if (successResults.length > 0) {
        setSelectedStock(successResults[0]);
      }
    } catch (err) {
      setTrendError(err.message);
    } finally {
      setTrendLoading(false);
    }
  };

  // Sorting for EMA Table
  const toggleTrendSort = () => {
    if (analyzedStocks.length <= 1) return;
    const direction = sortDirection === 'none' || sortDirection === 'desc' ? 'asc' : 'desc';
    setSortDirection(direction);

    const sorted = [...analyzedStocks].sort((a, b) => {
      const valA = a.difference !== null ? a.difference : -Infinity;
      const valB = b.difference !== null ? b.difference : -Infinity;
      return direction === 'asc' ? valA - valB : valB - valA;
    });
    setAnalyzedStocks(sorted);
  };

  // RSI Scanner Logic
  const handleRsiSubmit = async (e) => {
    e.preventDefault();
    if (!rsiInput.trim() || rsiLoading) return;

    setRsiLoading(true);
    setRsiError('');
    setScannedRsiStocks([]);

    try {
      const symbols = await parseInputSymbols(rsiInput);
      if (symbols.length === 0) {
        throw new Error('No valid stock symbols extracted.');
      }

      const scanPromises = symbols.map(async (symbol) => {
        const response = await fetch(`/api/rsi?symbol=${encodeURIComponent(symbol)}`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch RSI for ${symbol}`);
        }
        return response.json();
      });

      const results = await Promise.allSettled(scanPromises);
      const list = [];
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          list.push(r.value);
        }
      });

      // Apply Filter Conditions
      const filtered = list.filter(stock => {
        if (rsiCondition === 'all') return true;
        const rsiVal = stock.rsi;
        if (rsiVal === null) return false;
        if (rsiCondition === 'greater') return rsiVal > rsiThreshold;
        if (rsiCondition === 'less') return rsiVal < rsiThreshold;
        return true;
      });

      setScannedRsiStocks(filtered);
      setRsiFilterSummary(`Found ${filtered.length} matching stocks out of ${list.length} scanned.`);
    } catch (err) {
      setRsiError(err.message);
    } finally {
      setRsiLoading(false);
    }
  };

  // Advanced Screener Logic
  const handleScreenerSubmit = async (e) => {
    e.preventDefault();
    if (!screenerInput.trim() || screenerLoading) return;

    setScreenerLoading(true);
    setScreenerError('');
    setScreenerCandidates([]);

    try {
      const symbols = await parseInputSymbols(screenerInput);
      if (symbols.length === 0) {
        throw new Error('No valid stock symbols found.');
      }

      const screenPromises = symbols.map(async (symbol) => {
        const response = await fetch(`/api/screener-analysis?symbol=${encodeURIComponent(symbol)}`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to screen ${symbol}`);
        }
        return response.json();
      });

      const results = await Promise.allSettled(screenPromises);
      const list = [];
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          list.push(r.value);
        }
      });

      // Filter by min stages and presets
      const filtered = list.filter(cand => {
        let countMet = 0;
        Object.keys(cand.checklist || {}).forEach(k => {
          if (cand.checklist[k].passed) countMet++;
        });

        if (countMet < screenerMinStages) return false;

        if (screenerPreset === 'preferred' && !cand.presets?.preferredScreener) return false;
        if (screenerPreset === 'high-conviction' && !cand.presets?.highConviction) return false;

        // Custom filter stages check
        if (screenerPreset === 'custom') {
          if (customStages.stage1 && !cand.checklist.stage1.passed) return false;
          if (customStages.stage2 && !cand.checklist.stage2.passed) return false;
          if (customStages.stage3 && !cand.checklist.stage3.passed) return false;
          if (customStages.stage4 && !cand.checklist.stage4.passed) return false;
          if (customStages.stage5 && !cand.checklist.stage5.passed) return false;
          if (customStages.stage6 && !cand.checklist.stage6.passed) return false;
        }

        return true;
      });

      setScreenerCandidates(filtered);
    } catch (err) {
      setScreenerError(err.message);
    } finally {
      setScreenerLoading(false);
    }
  };

  // AI Custom Strategy prompt generator
  const handleGenerateStrategy = async () => {
    if (!builderName.trim()) {
      showAlert('Please provide a strategy name.');
      return;
    }

    setBuilderStatus('🤖 AI is building your custom strategy prompt...');
    setBuilderLoadingText('Active');

    try {
      const payload = {
        name: builderName.trim(),
        indicators: builderIndicators.trim(),
        slPercent: parseFloat(builderSL),
        targetPercent: parseFloat(builderTarget),
        entryRules: builderEntry.trim(),
        exitRules: builderExit.trim()
      };

      const res = await fetch('/api/build-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server status ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        setCustomSystemPrompt(data.customSystemPrompt);
        setActiveStrategy('custom');
        setBuilderStatus('✨ Custom Strategy built and activated!');
        
        // Save strategy update
        await saveAppStateField({
          activeStrategy: 'custom',
          customSystemPrompt: data.customSystemPrompt
        });

        setTimeout(() => {
          setIsStrategyModalOpen(false);
          setBuilderStatus('');
          setBuilderLoadingText('');
        }, 1500);
      } else {
        throw new Error('AI prompt generation failed.');
      }
    } catch (err) {
      console.error(err);
      setBuilderStatus('Error: ' + err.message);
    } finally {
      setBuilderLoadingText('');
    }
  };

  const handleSaveStrategySettings = async () => {
    setBuilderStatus('Applying changes...');
    try {
      const payload = { activeStrategy };
      if (activeStrategy === 'custom') {
        payload.customSystemPrompt = customSystemPrompt;
      }
      await saveAppStateField(payload);
      setBuilderStatus('Strategy successfully applied!');
      setTimeout(() => {
        setIsStrategyModalOpen(false);
        setBuilderStatus('');
      }, 1200);
    } catch (err) {
      setBuilderStatus('Failed to save strategy: ' + err.message);
    }
  };

  // Backtest Strategy execution
  const handleRunBacktest = async (e) => {
    e.preventDefault();
    if (!backtestSymbol.trim() || !backtestFromDate || !backtestToDate) {
      showAlert('Please fill out all backtest parameters.');
      return;
    }

    setBacktestLoading(true);
    setBacktestError('');
    setBacktestResults(null);

    let indicatorsConfig = {};
    try {
      indicatorsConfig = JSON.parse(backtestIndicatorsJson);
    } catch (err) {
      showAlert('Invalid Indicators JSON format.');
      setBacktestLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: backtestSymbol.trim(),
          interval: backtestInterval,
          fromDateStr: backtestFromDate,
          toDateStr: backtestToDate,
          capital: parseFloat(backtestCapital),
          leverage: parseFloat(backtestLeverage),
          marginPercentage: parseFloat(backtestMarginPct),
          allowShorting: backtestAllowShorting,
          indicators: indicatorsConfig
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Backtest simulation failed');
      }

      const data = await response.json();
      setBacktestResults(data);
    } catch (err) {
      setBacktestError(err.message);
    } finally {
      setBacktestLoading(false);
    }
  };

  // Render markdown replacements inside bot messages
  const formatBotMessage = (text) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Bold, italic, and code blocks
    let formatted = escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded font-mono text-xs text-indigo-300">$1</code>')
      .replace(/\n/g, '<br>');

    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="flex flex-col min-h-screen relative font-sans text-slate-100 bg-[#0b0f19]">
      
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.1),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />

      {/* HEADER SECTION */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0f1524]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-display font-bold text-white text-lg">▲</span>
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight text-white">
            KITE<span className="font-light text-purple-400">✦CHATBOT</span>
          </h1>
        </div>

        {/* Tab switcher */}
        <Tabs value={view} onValueChange={setView} className="w-auto">
          <TabsList className="bg-white/5 border border-white/5 p-1 rounded-xl h-auto gap-1">
            <TabsTrigger 
              value="dashboard"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-indigo-600/80 data-[state=active]:text-white text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="scanners"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-indigo-600/80 data-[state=active]:text-white text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <Activity className="h-4 w-4" />
              Scanners
            </TabsTrigger>
            <TabsTrigger 
              value="charts"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-indigo-600/80 data-[state=active]:text-white text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <Sliders className="h-4 w-4" />
              Backtest Platform
            </TabsTrigger>
            <TabsTrigger 
              value="strategies"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-indigo-600/80 data-[state=active]:text-white text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <Settings className="h-4 w-4" />
              Strategies
            </TabsTrigger>
            <TabsTrigger 
              value="admin"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-indigo-600/80 data-[state=active]:text-white text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              Admin
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Right Badges / Actions */}
        <div className="flex items-center gap-3">
          {/* Notification Alerts Icon */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAlertsPanel(prev => !prev)}
              className={`relative px-3 py-1.5 rounded-lg border border-white/5 bg-[#0f1524]/60 hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center h-auto gap-1.5 ${
                subscribedAlerts.length > 0 ? 'border-indigo-500/20 text-indigo-400' : ''
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Alerts Log</span>
              {alertHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white animate-pulse">
                  {alertHistory.length}
                </span>
              )}
            </Button>
            
            {/* Alerts History Dropdown Panel */}
            {showAlertsPanel && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-950/95 border border-white/10 rounded-2xl p-4 shadow-2xl z-50 backdrop-blur-md flex flex-col gap-3">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 font-display">Scanner Alerts Log</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setAlertHistory([])}
                      className="text-[10px] text-rose-400 hover:underline font-semibold cursor-pointer"
                    >
                      Clear Log
                    </button>
                    <button 
                      onClick={() => setShowAlertsPanel(false)}
                      className="text-[10px] text-slate-400 hover:text-white font-semibold cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
                
                {/* Active Subscriptions */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Active Subscriptions ({subscribedAlerts.length})</span>
                  {subscribedAlerts.length === 0 ? (
                    <span className="text-[10px] text-slate-500 italic">No scanners subscribed. Enable alerts in the Scanners tab.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {subscribedAlerts.map(sub => (
                        <span key={sub} className="text-[9px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                          {sub}
                          <X 
                            className="h-2.5 w-2.5 cursor-pointer hover:text-white" 
                            onClick={() => setSubscribedAlerts(prev => prev.filter(s => s !== sub))}
                          />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Alerts History Feed */}
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Triggered Alerts ({alertHistory.length})</span>
                  {alertHistory.length === 0 ? (
                    <div className="py-6 text-center text-slate-600 text-xs italic font-medium">No alerts triggered yet.</div>
                  ) : (
                    alertHistory.map((alert) => (
                      <div key={alert.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-semibold text-slate-400 truncate max-w-[140px]" title={alert.scannerName}>{alert.scannerName}</span>
                          <span className="text-slate-500 font-mono">{alert.timestamp}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white">{alert.symbol}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-300">₹{formatCurrency(alert.ltp)}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              alert.change >= 0 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {alert.change >= 0 ? '+' : ''}{alert.change}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Market clock */}
          {marketTime && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300">
              ⏰ {marketTime}
            </div>
          )}

          {/* Connection Status badges */}
          <div className="flex items-center gap-2">
            {appConfig.hasAccessToken ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                Kite Connected
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400">
                Kite Disconnected
              </div>
            )}

            {appConfig.hasAccessToken ? (
              <Button 
                variant="outline"
                size="icon-sm"
                onClick={handleLogout}
                title="Disconnect Account"
                className="rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer p-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer h-auto border-0"
              >
                Connect Zerodha
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* CORE LAYOUT BODY */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-6">

        {/* Lock Overlay Banner for Logged Out Layout */}
        {!appConfig.hasAccessToken && (
          <div className="glass-panel-heavy p-6 flex flex-col md:flex-row items-center justify-between border-rose-500/20 bg-rose-950/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-white">Authentication Required</h3>
                <p className="text-sm text-slate-400">
                  {appConfig.hasKiteKey 
                    ? "Click 'Connect Zerodha' to authorize the chatbot to sync positions, calculate margins, and execute strategy decisions."
                    : "Zerodha API credentials are missing in the .env configuration. The application is running in locked simulation mode."
                  }
                </p>
              </div>
            </div>
            {appConfig.hasKiteKey && (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                Connect Zerodha account
              </button>
            )}
          </div>
        )}



        
      {/* Custom Alert Modal */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f0f13] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-4 text-indigo-400">
              <Info className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{alertConfig.title}</h3>
            <p className="text-sm text-slate-300 mb-6">{alertConfig.message}</p>
            <button 
              onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
        {/* VIEW 1: DASHBOARD VIEW                                                    */}
        {/* ========================================================================= */}
        {view === 'dashboard' && (
          <div className="flex flex-col gap-6">
            
            {/* Top Stat Bar */}
            {appConfig.hasAccessToken && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Available Cash Card */}
                <Card className="glass-panel border-0 ring-0 p-4 flex flex-col justify-between h-auto gap-1">
                  <div className="flex items-center justify-between text-slate-400 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Allocated Cash (5x Leverage)</span>
                      {reallocationAutoEnabled && lastReallocationTime && (
                        (() => {
                          const elapsed = Date.now() - lastReallocationTime;
                          const left = Math.max(0, 15 * 60 * 1000 - elapsed);
                          const m = Math.floor(left / 60000);
                          const s = Math.floor((left % 60000) / 1000);
                          return (
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-semibold animate-pulse">
                              Realloc: {m}m {s}s
                            </span>
                          );
                        })()
                      )}
                    </div>
                    <Zap className="h-4 w-4 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-white mt-1">
                    ₹{formatCurrency((margins?.equity?.net || 0) * (selectedMarginPercentage / 100) * 5)}
                  </h3>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-[9px] text-slate-400 font-mono">
                      Based on {(margins?.equity?.net || 0) > 0 ? `₹${formatCurrency(margins?.equity?.net)}` : '₹0.00'} × {selectedMarginPercentage}% allocation
                    </p>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="checkbox"
                        id="reallocation-logic-toggle"
                        checked={reallocationAutoEnabled}
                        onChange={toggleReallocationLogic}
                        className="h-3 w-3 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="reallocation-logic-toggle" className="text-[9px] font-medium text-slate-300 cursor-pointer select-none">
                        Smart Reallocation
                        {(() => {
                          if (reallocationAutoEnabled && lastReallocationTime) {
                            const elapsed = Date.now() - lastReallocationTime;
                            const left = Math.max(0, 15 * 60 * 1000 - elapsed);
                            const m = Math.floor(left / 60000);
                            const s = Math.floor((left % 60000) / 1000);
                            return <span className="text-amber-400 font-mono ml-1">({m}m {s}s)</span>;
                          }
                          return null;
                        })()}
                      </label>
                      <div className="relative group z-50">
                        <Info className="h-3 w-3 text-slate-400 hover:text-slate-200 cursor-pointer" />
                        <div className="absolute bottom-full mb-2 -translate-x-1/2 left-1/2 hidden group-hover:block w-64 p-3 bg-slate-950/95 border border-white/10 rounded-xl text-[10px] text-slate-300 leading-normal shadow-2xl backdrop-blur-md text-left z-[9999]">
                          <div className="font-semibold text-white mb-1 text-[11px]">Smart Reallocation Logic:</div>
                          <ul className="list-disc pl-3 flex flex-col gap-1 text-[10px]">
                            <li><span className="text-indigo-400 font-medium">Trigger:</span> Runs every 15 mins.</li>
                            <li><span className="text-indigo-400 font-medium">Condition:</span> Open MIS position is in profit by ≥ 0.5%.</li>
                            <li><span className="text-indigo-400 font-medium">Action:</span> Takes 20% of free available margin and pyramids (adds to) the winning positions.</li>
                          </ul>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Net P&L Card */}
                <Card className="glass-panel border-0 ring-0 p-4 flex flex-col justify-between h-auto gap-1">
                  <div className="flex items-center justify-between text-slate-400 font-medium">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Net Realtime P&L</span>
                    <TrendingUp className={`h-4 w-4 ${(positionsPnL + portfolioPnL - totalCharges) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                  </div>
                  <h3 className={`text-lg font-display font-bold mt-1 ${
                    (positionsPnL + portfolioPnL - totalCharges) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {(positionsPnL + portfolioPnL - totalCharges) >= 0 ? '+' : ''}₹{formatCurrency(positionsPnL + portfolioPnL - totalCharges)}
                  </h3>
                  <div className="flex justify-between items-center text-[9px] text-slate-400">
                    <div className="flex flex-col gap-0.5">
                      <span>Gross: ₹{formatCurrency(positionsPnL + portfolioPnL)}</span>
                      <span>Charges: ₹{formatCurrency(totalCharges)}</span>
                    </div>
                    {netPnLDiff !== 0 && (
                      <div className={`flex items-center gap-1 font-bold tracking-wider rounded px-1.5 py-0.5 ${netPnLDiff > 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                        {netPnLDiff > 0 ? '▲' : '▼'} ₹{formatCurrency(Math.abs(netPnLDiff))}
                      </div>
                    )}
                  </div>
                </Card>

                {/* API Request Metrics Card */}
                <Card className="glass-panel border-0 ring-0 p-4 flex flex-col gap-2.5 h-auto">
                  <div className="flex items-center justify-between text-slate-400 border-b border-white/5 pb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">API Health Meter</span>
                    <span className="text-[9px] font-mono text-slate-500">Total: {apiStats.totalCalls} calls</span>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const categories = apiStats.callsPerSecond?.categories || {
                        quote: { currentRate: 0, limit: 1, label: 'Quote (1 r/s)' },
                        historical: { currentRate: 0, limit: 3, label: 'Historical (3 r/s)' },
                        order: { currentRate: 0, limit: 10, label: 'Order Placement (10 r/s)' },
                        other: { currentRate: 0, limit: 10, label: 'Other Endpoints (10 r/s)' }
                      };
                      
                      return Object.entries(categories).map(([key, cat]) => {
                        const rate = cat.currentRate || 0;
                        const limit = cat.limit || 1;
                        const pct = Math.min(100, (rate / limit) * 100);
                        let barColor = 'bg-indigo-500 shadow-indigo-500/10';
                        if (pct >= 90) barColor = 'bg-rose-500 shadow-rose-500/20';
                        else if (pct >= 50) barColor = 'bg-amber-500 shadow-amber-500/20';
                        else barColor = 'bg-emerald-500 shadow-emerald-500/20';
                        
                        return (
                          <div key={key} className="flex flex-col gap-0.5">
                            <div className="flex justify-between text-[9px] font-medium">
                              <span className="text-slate-400">{cat.label || key}</span>
                              <span className={`font-mono font-semibold ${rate >= limit ? 'text-rose-400' : 'text-slate-300'}`}>
                                {rate}/{limit} r/s
                              </span>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${barColor} transition-all duration-300 rounded-full`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </Card>

              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            
            {/* COLUMN 1: PORTFOLIO STRATEGIST CHAT (1/3rd) */}
            <div className="flex flex-col gap-6">
              
              {/* Chatbot glass panel */}
              <div className="glass-panel flex flex-col h-[520px] overflow-hidden">
                {/* Chat header */}
                <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-indigo-400 animate-pulse" />
                    <div>
                      <h3 className="font-display font-semibold text-sm">Portfolio Strategist Chat</h3>
                      <p className="text-[10px] text-slate-400">Powered by OpenAI GPT & local technical analysis tools</p>
                    </div>
                  </div>

                  {/* Mode and Margin selector toggle */}
                  <div className="flex items-center gap-4">
                    {/* Mode selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mode:</span>
                      <div className="flex bg-black/40 border border-white/5 p-0.5 rounded-lg">
                        {['BUY', 'SELL', 'BOTH'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setChatMode(m);
                              localStorage.setItem('portfolio_chat_mode', m);
                            }}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                              chatMode === m 
                                ? m === 'BUY'
                                  ? 'bg-emerald-600/80 text-white shadow'
                                  : m === 'SELL'
                                  ? 'bg-rose-600/80 text-white shadow'
                                  : 'bg-indigo-600/80 text-white shadow'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {appConfig.hasAccessToken && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Margin:</span>
                        <select 
                          value={selectedMarginPercentage}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSelectedMarginPercentage(val);
                            saveAppStateField({ selectedMarginPercentage: val });
                          }}
                          className="bg-black/35 border border-white/5 rounded-lg px-1.5 py-0.5 text-[10px] text-indigo-300 outline-none font-semibold cursor-pointer"
                        >
                          <option value={100}>100%</option>
                          <option value={75}>75%</option>
                          <option value={50}>50%</option>
                          <option value={25}>25%</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Messages view */}
                <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-gradient-to-b from-transparent to-black/20">
                  {chatMessages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] rounded-2xl px-4 py-3 text-sm transition-all ${
                        msg.sender === 'user'
                          ? 'self-end bg-indigo-600/80 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
                          : msg.sender === 'system'
                          ? 'self-start bg-rose-500/10 border border-rose-500/20 text-rose-300 font-semibold'
                          : 'self-start bg-white/5 border border-white/5 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 block ${
                        msg.sender === 'user' ? 'text-indigo-200 text-right' : msg.sender === 'system' ? 'text-rose-400' : 'text-purple-400'
                      }`}>
                        {msg.sender === 'user' ? 'You' : msg.sender === 'system' ? '⚠️ System' : '✦ AI Assistant'}
                      </span>
                      <div className="leading-relaxed whitespace-pre-line">
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex flex-col max-w-[85%] self-start bg-white/5 border border-white/5 text-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-sm animate-pulse">
                      <span className="text-[10px] font-bold uppercase tracking-wider mb-1 block text-purple-400">
                        ✦ AI Assistant
                      </span>
                      <div className="flex gap-1 py-1">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input form */}
                <div className="p-4 border-t border-white/5 bg-black/30">
                  <form onSubmit={handleChatSubmit} className="flex gap-2.5">
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask the chatbot..."
                      disabled={!appConfig.hasAccessToken}
                      className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 text-white placeholder-slate-500 disabled:opacity-50"
                    />
                    <button 
                      type="submit"
                      disabled={!appConfig.hasAccessToken || isChatLoading || !chatInput.trim()}
                      className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isChatLoading ? 'Thinking...' : 'Send'}
                    </button>
                  </form>
                </div>

              </div>

            </div>

            {/* COLUMN 2: TOP 7 SCANNERS SECTION (1/3rd) */}
            <div className="flex flex-col gap-6">
              
              {/* ALL SCANNERS LIST COMPACT CARDS */}
              {appConfig.hasAccessToken && (
                <div className="flex flex-col gap-3 h-[calc(100vh-280px)] overflow-y-auto pr-2 custom-scrollbar">
                  {scannersList.map((scannerObj, idx) => (
                    <Card key={idx} className="glass-panel border-0 ring-0 p-3 !overflow-visible">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 max-w-[65%]">
                          <TrendingUp className="h-4 w-4 text-indigo-400 shrink-0" />
                          <CardTitle className="font-display font-semibold text-xs text-white truncate" title={scannerObj.name}>
                            {scannerObj.name}
                          </CardTitle>
                          {/* Scanner Tooltip */}
                          <div className="relative group z-[100] shrink-0">
                            <Info className="h-3.5 w-3.5 text-slate-400 hover:text-slate-200 cursor-pointer" />
                            <div className="absolute bottom-full mb-2 -translate-x-1/2 left-1/2 hidden group-hover:block w-60 p-3 bg-slate-950/95 border border-white/10 rounded-xl text-[10px] text-slate-300 leading-relaxed shadow-2xl backdrop-blur-md text-center pointer-events-none whitespace-normal">
                              {scannerObj.description}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950"></div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 items-center">
                          <button
                            title="Refresh (Silent Fetch)"
                            className="px-2 py-1 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 active:bg-indigo-500/35 transition-all text-[10px] font-semibold flex items-center gap-1.5 cursor-pointer"
                            onClick={() => handleRefreshScannerSilent(scannerObj.name)}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                          <button
                            title="Provide Top 7 to AI Agent"
                            onClick={() => handleProvideScannerToAgent(scannerObj.name)}
                            disabled={isChatLoading}
                            className="px-2 py-1 rounded border border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-all text-[10px] font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Brain className="h-3 w-3" />
                            AI
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

            </div>

            {/* COLUMN 3: MIS P&L EXIT CONTROLS (1/3rd) */}
            <div className="flex flex-col gap-6">
              
              {/* MIS exit cutoff switch controls */}
              <Card className="glass-panel border-0 ring-0 p-5 !overflow-visible">
                <CardHeader className="flex flex-row items-center justify-between mb-2 p-0 space-y-0">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <CardTitle className="font-display font-semibold text-sm text-white">MIS P&L Exit Controls</CardTitle>
                      {/* Tooltip for calculations */}
                      <div className="relative group hover:z-[9999]">
                        <Info className="h-3.5 w-3.5 text-slate-400 hover:text-slate-200 cursor-pointer animate-pulse" />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-64 p-3 bg-slate-950/95 border border-white/10 rounded-xl text-[11px] text-slate-300 leading-normal shadow-2xl z-[9999] backdrop-blur-md">
                          <div className="font-semibold text-white mb-1">PnL Calculations:</div>
                          <p className="mb-1.5"><span className="text-indigo-400 font-medium">Current P&L</span>: Unrealized P&L of all active open positions based on real-time LTP versus entry price.</p>
                          <p><span className="text-indigo-400 font-medium">Total P&L</span>: Combined unrealized P&L of open positions + realized P&L of all closed positions from today.</p>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950"></div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">MIS positions auto square off at 3:24 PM.</p>
                  </div>
                  {isPnlFormDirty && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse">
                      Unsaved
                    </span>
                  )}
                </CardHeader>

                <CardContent className="flex flex-col gap-4 text-xs p-0 mt-4">
                  
                  {/* Action buttons (EXIT ALL) at the top */}
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="destructive"
                      onClick={handleExitAll}
                      className="w-full py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/35 font-semibold text-xs transition-all cursor-pointer h-auto"
                    >
                      EXIT ALL OPEN POSITIONS
                    </Button>
                    <Button 
                      onClick={handleExitNegativePositions}
                      className="w-full py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/35 font-semibold text-xs transition-all cursor-pointer h-auto"
                    >
                      EXIT NEGATIVE PNL STOCKS ONLY
                    </Button>
                  </div>

                  {/* Exit mode selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Evaluation Mode</label>
                    <Select value={pnlExitModeDraft} onValueChange={handleExitModeChange}>
                      <SelectTrigger className="w-full bg-black/30 border-white/5 rounded-xl px-3 py-2 h-auto text-white cursor-pointer justify-between">
                        <SelectValue placeholder="Select Evaluation Mode" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="current" className="hover:bg-indigo-600 focus:bg-indigo-600 text-slate-200 cursor-pointer">Current P&L (Open Positions Only)</SelectItem>
                        <SelectItem value="total" className="hover:bg-indigo-600 focus:bg-indigo-600 text-slate-200 cursor-pointer">Total P&L (Open + Closed Today)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cutoff enabled toggle */}
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id="pnl-exit-auto-enabled"
                      checked={pnlExitAutoEnabledDraft}
                      onChange={(e) => handleExitAutoEnabledChange(e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="pnl-exit-auto-enabled" className="font-medium text-slate-300 cursor-pointer select-none">
                      Auto-Exit Cutoff Switch
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="font-medium text-slate-400">
                      {pnlExitModeDraft === 'current' ? 'Current MIS P&L:' : 'Total MIS P&L:'}
                    </span>
                    <span className={`font-bold ${currentMisPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {currentMisPnL >= 0 ? '+' : ''}₹{formatCurrency(currentMisPnL)}
                    </span>
                  </div>

                  {/* Quick Preset Pills */}
                  <div className="flex flex-wrap gap-2 pb-1">
                    {pnlPresets.map((preset, idx) => (
                      <div key={`${preset.p}-${preset.l}-${idx}`} className="relative group flex items-center">
                        <button
                          onClick={() => {
                            setProfitTargetExitDraft(String(preset.p));
                            setLossTargetExitDraft(String(preset.l));
                          }}
                          className="px-2.5 py-1 text-[10px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-slate-300 transition-colors cursor-pointer"
                        >
                          {preset.p}/{preset.l}
                        </button>
                        <button
                          onClick={() => {
                            const updated = pnlPresets.filter((_, i) => i !== idx);
                            setPnlPresets(updated);
                            localStorage.setItem('pnl_exit_presets', JSON.stringify(updated));
                          }}
                          className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 text-[9px] bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-colors cursor-pointer border border-black/50 font-bold"
                          title="Delete Preset"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Custom Preset Option */}
                  <div className="flex items-center gap-2 mt-1 pb-2">
                    <div className="flex items-center gap-1 bg-black/20 border border-white/5 rounded-lg p-1">
                      <input 
                        type="number"
                        placeholder="Profit"
                        value={newPresetProfit}
                        onChange={(e) => setNewPresetProfit(e.target.value)}
                        className="bg-transparent text-[10px] w-14 text-white focus:outline-none placeholder-slate-500 px-1 py-0.5"
                      />
                      <span className="text-slate-600 text-[10px] select-none">/</span>
                      <input 
                        type="number"
                        placeholder="Loss"
                        value={newPresetLoss}
                        onChange={(e) => setNewPresetLoss(e.target.value)}
                        className="bg-transparent text-[10px] w-14 text-white focus:outline-none placeholder-slate-500 px-1 py-0.5"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const p = parseFloat(newPresetProfit);
                        const l = parseFloat(newPresetLoss);
                        if (!isNaN(p) && !isNaN(l)) {
                          const updated = [...pnlPresets, { p, l }];
                          setPnlPresets(updated);
                          localStorage.setItem('pnl_exit_presets', JSON.stringify(updated));
                          setNewPresetProfit('');
                          setNewPresetLoss('');
                        }
                      }}
                      className="px-2 py-1 text-[10px] font-semibold bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer border border-white/5"
                    >
                      + Add Pill
                    </button>
                  </div>

                  {/* Target thresholds */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Profit Limit (₹)</label>
                      <input 
                        type="number"
                        placeholder="e.g. 10000"
                        value={profitTargetExitDraft}
                        onChange={(e) => setProfitTargetExitDraft(e.target.value)}
                        
                        className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Loss Limit (₹)</label>
                      <input 
                        type="number"
                        placeholder="e.g. -2000"
                        value={lossTargetExitDraft}
                        onChange={(e) => setLossTargetExitDraft(e.target.value)}
                        
                        className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  {/* Save immediately action buttons */}
                  <div className="flex gap-2 mt-2">
                    <Button 
                      onClick={() => handleSavePnLLimits()}
                      disabled={!isPnlFormDirty}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold h-auto transition-all cursor-pointer ${
                        isPnlFormDirty 
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20' 
                          : 'bg-white/5 text-white/40 cursor-not-allowed'
                      }`}
                    >
                      SET LIMITS
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setProfitTargetExitDraft(profitTargetExit === 0 ? '' : String(profitTargetExit));
                        setLossTargetExitDraft(lossTargetExit === 0 ? '' : String(lossTargetExit));
                        setPnlExitModeDraft(pnlExitMode);
                        setPnlExitAutoEnabledDraft(pnlExitAutoEnabled);
                      }}
                      disabled={!isPnlFormDirty}
                      className="px-3 py-2.5 h-auto rounded-xl border-white/10 hover:bg-white/10 text-slate-300 transition-all cursor-pointer"
                      title="Revert changes"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  

                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: STRATEGIES VIEW                                                    */}
      {/* ========================================================================= */}
      {view === 'strategies' && (
        <div className="w-full min-h-[400px]"></div>
      )}
      {view === 'strategies' && false && (
          <div className="flex flex-col gap-6 w-full text-slate-200 animate-in fade-in duration-300">
            {/* Header / Intro Card */}
            <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-display font-bold text-white">Strategy Orchestrator & Simulator</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure active algorithmic trading strategies, design new system prompts using AI, and run historical performance backtests.
                </p>
              </div>
            </div>

            {/* 2-Column Responsive Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Configuration & Builder (xl:span-5) */}
              <div className="xl:col-span-5 flex flex-col gap-6">
                
                {/* Active Strategy Settings */}
                <Card className="glass-panel border-0 ring-0 p-5 flex flex-col gap-4">
                  <CardHeader className="p-0 border-b border-white/5 pb-3 flex flex-row items-center gap-2">
                    <Settings className="h-5 w-5 text-indigo-400" />
                    <CardTitle className="font-display font-semibold text-sm text-white">Active Strategy Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col gap-4 mt-4">
                    <div className="flex flex-col gap-1.5 text-xs">
                      <label className="text-slate-400 font-semibold">Select Strategy</label>
                      <select 
                        value={activeStrategy}
                        onChange={(e) => {
                          const val = e.target.value;
                          setActiveStrategy(val);
                        }}
                        className="bg-black/35 border border-white/5 rounded-xl px-3 py-2.5 text-white outline-none cursor-pointer"
                      >
                        <option value="momentum_surfing_morning">momentum surfing morning stragey (Flat 2% SL / 4% Target GTT)</option>
                        <option value="portfolio_gtt">Portfolio Sizing Strategy (Dynamic Portfolio SL & Target GTT)</option>
                        <option value="standard_rr">Standard 1:2 Risk-Reward (Flat 2% SL / 4% Target GTT)</option>
                        <option value="custom">Custom System Prompt (Fully Editable Prompt Template)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <label className="text-slate-400 font-semibold">Prompt Template Content</label>
                        <span className="text-[10px] text-slate-500 font-mono">{"${marginPercentage}"} supported</span>
                      </div>
                      <textarea 
                        value={customSystemPrompt}
                        onChange={(e) => setCustomSystemPrompt(e.target.value)}
                        disabled={activeStrategy !== 'custom'}
                        placeholder="Enter custom strategist system instructions..."
                        className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-200 font-mono resize-none focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 min-h-[160px]"
                      />
                    </div>
                    
                    <Button 
                      onClick={handleSaveStrategySettings}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/10 h-auto border-0"
                    >
                      Save & Apply Strategy
                    </Button>
                  </CardContent>
                </Card>

                {/* AI Strategy Builder */}
                <Card className="glass-panel border-0 ring-0 p-5 flex flex-col gap-4">
                  <CardHeader className="p-0 border-b border-white/5 pb-3 flex flex-row items-center gap-2">
                    <Brain className="h-5 w-5 text-indigo-400" />
                    <CardTitle className="font-display font-semibold text-sm text-white">AI Strategy Builder</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col gap-4 mt-4">
                    <div className="flex flex-col gap-1.5 text-xs">
                      <label className="text-slate-400 font-semibold">Strategy Name</label>
                      <input 
                        type="text" 
                        value={builderName}
                        onChange={(e) => setBuilderName(e.target.value)}
                        placeholder="e.g. Trend Surfer Morning"
                        className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs">
                      <label className="text-slate-400 font-semibold">Technical Indicators</label>
                      <input 
                        type="text" 
                        value={builderIndicators}
                        onChange={(e) => setBuilderIndicators(e.target.value)}
                        placeholder="e.g. EMA 9, EMA 21, RSI"
                        className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-slate-400 font-semibold">Stop Loss (%)</label>
                        <input 
                          type="number" 
                          step="0.05"
                          value={builderSL}
                          onChange={(e) => setBuilderSL(parseFloat(e.target.value) || 0)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-slate-400 font-semibold">Target Profit (%)</label>
                        <input 
                          type="number" 
                          step="0.05"
                          value={builderTarget}
                          onChange={(e) => setBuilderTarget(parseFloat(e.target.value) || 0)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs">
                      <label className="text-slate-400 font-semibold">Entry Rules</label>
                      <textarea 
                        rows={2}
                        value={builderEntry}
                        onChange={(e) => setBuilderEntry(e.target.value)}
                        placeholder="e.g. Buy when price is above EMA 21 and RSI crosses above 50..."
                        className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50 resize-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs">
                      <label className="text-slate-400 font-semibold">Exit Rules</label>
                      <textarea 
                        rows={2}
                        value={builderExit}
                        onChange={(e) => setBuilderExit(e.target.value)}
                        placeholder="e.g. Exit when price falls below EMA 21 or RSI crosses below 40..."
                        className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50 resize-none"
                      />
                    </div>

                    <button 
                      onClick={handleGenerateStrategy}
                      disabled={builderLoadingText !== ''}
                      className="py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/20"
                    >
                      {builderLoadingText ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Build & Activate Custom Strategy
                    </button>
                    
                    {builderStatus && (
                      <span className={`text-[11px] font-semibold text-center block mt-1 ${
                        builderStatus.includes('Error') || builderStatus.includes('Failed') ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {builderStatus}
                      </span>
                    )}
                  </CardContent>
                </Card>
                
              </div>

              {/* Right Column: Backtest Simulator (xl:span-7) */}
              <div className="xl:col-span-7 flex flex-col gap-6">
                
                <Card className="glass-panel border-0 ring-0 p-5 flex flex-col gap-4">
                  <CardHeader className="p-0 border-b border-white/5 pb-3 flex flex-row items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-400" />
                    <CardTitle className="font-display font-semibold text-sm text-white">Backtesting & Performance Simulator</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col gap-5 mt-4">
                    
                    {/* Simulator Inputs Grid */}
                    <form onSubmit={(e) => { e.preventDefault(); handleRunBacktest(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">Symbol</label>
                        <input 
                          type="text" 
                          value={backtestSymbol}
                          onChange={(e) => setBacktestSymbol(e.target.value)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">Interval</label>
                        <select 
                          value={backtestInterval}
                          onChange={(e) => setBacktestInterval(e.target.value)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
                        >
                          <option value="day">Daily</option>
                          <option value="60minute">60 Minute</option>
                          <option value="30minute">30 Minute</option>
                          <option value="15minute">15 Minute</option>
                          <option value="5minute">5 Minute</option>
                          <option value="minute">1 Minute</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">From Date</label>
                        <input 
                          type="date" 
                          value={backtestFromDate}
                          onChange={(e) => setBacktestFromDate(e.target.value)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-center"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">To Date</label>
                        <input 
                          type="date" 
                          value={backtestToDate}
                          onChange={(e) => setBacktestToDate(e.target.value)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-center"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">Capital (₹)</label>
                        <input 
                          type="number" 
                          value={backtestCapital}
                          onChange={(e) => setBacktestCapital(parseFloat(e.target.value) || 0)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">Leverage Power</label>
                        <input 
                          type="number" 
                          value={backtestLeverage}
                          onChange={(e) => setBacktestLeverage(parseFloat(e.target.value) || 0)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-center"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">Target Margin %</label>
                        <input 
                          type="number" 
                          value={backtestMarginPct}
                          onChange={(e) => setBacktestMarginPct(parseFloat(e.target.value) || 0)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-center"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 cursor-pointer select-none mt-5">
                        <input 
                          type="checkbox"
                          id="allow-shorting"
                          checked={backtestAllowShorting}
                          onChange={(e) => setBacktestAllowShorting(e.target.checked)}
                          className="h-4 w-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="allow-shorting" className="text-slate-300 font-semibold text-xs cursor-pointer">Allow Short Positions</label>
                      </div>

                      <div className="flex flex-col gap-1.5 text-xs md:col-span-2">
                        <label className="text-slate-400 font-semibold">Indicators Config (JSON)</label>
                        <textarea 
                          rows={4}
                          value={backtestIndicatorsJson}
                          onChange={(e) => setBacktestIndicatorsJson(e.target.value)}
                          className="bg-black/35 border border-white/5 rounded-xl p-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500/50 resize-y"
                        />
                      </div>

                      <div className="md:col-span-2 mt-2">
                        <button 
                          type="submit"
                          disabled={backtestLoading}
                          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10 h-auto border-0"
                        >
                          {backtestLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          Execute Backtest
                        </button>
                      </div>
                    </form>

                    {/* Performance Output Panel */}
                    <div className="border-t border-white/5 pt-5 flex flex-col gap-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                        Performance Outputs
                      </h4>

                      {backtestLoading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                          <div className="h-9 w-9 border-4 border-indigo-500/25 border-t-indigo-500 rounded-full animate-spin" />
                          <span className="text-xs font-semibold">Running historical technical backtests...</span>
                        </div>
                      )}

                      {backtestError && (
                        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                          <AlertTriangle className="h-4 w-4 text-rose-400" />
                          <span>{backtestError}</span>
                        </div>
                      )}

                      {!backtestLoading && !backtestResults && !backtestError && (
                        <div className="border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500 py-12">
                          <TrendingUp className="h-10 w-10 text-slate-600 mb-2" />
                          <p className="text-xs font-medium">Configure parameters above and click Execute to run the simulation.</p>
                        </div>
                      )}

                      {!backtestLoading && backtestResults && (
                        <div className="flex flex-col gap-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-display">
                            <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                              <span className="text-slate-500 uppercase font-bold text-[8px] block">Final Portfolio Value</span>
                              <span className="text-sm font-bold text-white block mt-0.5">₹{formatCurrency(backtestResults.summary?.finalEquity)}</span>
                              <span className={`text-[9px] font-semibold ${
                                backtestResults.summary?.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {backtestResults.summary?.totalReturnPct >= 0 ? '+' : ''}
                                {backtestResults.summary?.totalReturnPct?.toFixed(2)}% Return
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                              <span className="text-slate-500 uppercase font-bold text-[8px] block">Annualized CAGR</span>
                              <span className="text-sm font-bold text-white block mt-0.5">{backtestResults.summary?.cagr?.toFixed(2)}%</span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">Strategy Benchmark</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                              <span className="text-slate-500 uppercase font-bold text-[8px] block">Max Drawdown</span>
                              <span className="text-sm font-bold text-rose-400 block mt-0.5">{backtestResults.summary?.maxDrawdownPct?.toFixed(2)}%</span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">Peak-to-Trough risk</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                              <span className="text-slate-500 uppercase font-bold text-[8px] block">Sharpe Ratio</span>
                              <span className="text-sm font-bold text-indigo-300 block mt-0.5">{backtestResults.summary?.sharpeRatio?.toFixed(2)}</span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">Risk-adjusted return</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-semibold text-slate-300 bg-white/[0.01] border border-white/5 p-3.5 rounded-xl">
                            <div className="flex justify-between">
                              <span>Total Execution Days:</span>
                              <span className="text-white">{backtestResults.summary?.totalDays} days</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Win Rate:</span>
                              <span className="text-white">{backtestResults.summary?.winRatePct?.toFixed(1)}% ({backtestResults.summary?.winningTrades} of {backtestResults.summary?.totalTrades} trades)</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Executed Position Signals</h5>
                            <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01] max-h-[180px]">
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                  <tr className="text-slate-400 border-b border-white/5 bg-white/[0.02]">
                                    <th className="px-3 py-1.5 font-bold uppercase tracking-wider">Date</th>
                                    <th className="px-3 py-1.5 font-bold uppercase tracking-wider">Type</th>
                                    <th className="px-3 py-1.5 font-bold uppercase tracking-wider">Entry</th>
                                    <th className="px-3 py-1.5 font-bold uppercase tracking-wider">Exit</th>
                                    <th className="px-3 py-1.5 font-bold uppercase tracking-wider">Qty</th>
                                    <th className="px-3 py-1.5 font-bold uppercase tracking-wider">P&L (₹)</th>
                                    <th className="px-3 py-1.5 font-bold uppercase tracking-wider">Reason</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-slate-200">
                                  {(backtestResults.trades || []).length === 0 ? (
                                    <tr>
                                      <td colSpan={7} className="py-4 text-center text-slate-500 font-medium">No backtest trades executed.</td>
                                    </tr>
                                  ) : (
                                    backtestResults.trades.map((trade, idx) => (
                                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="px-3 py-1.5 text-slate-400 font-mono">{trade.date}</td>
                                        <td className="px-3 py-1.5">
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            trade.type === 'LONG' 
                                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                          }`}>
                                            {trade.type}
                                          </span>
                                        </td>
                                        <td className="px-3 py-1.5">₹{formatCurrency(trade.entryPrice)}</td>
                                        <td className="px-3 py-1.5">₹{formatCurrency(trade.exitPrice)}</td>
                                        <td className="px-3 py-1.5 font-mono">{trade.quantity}</td>
                                        <td className={`px-3 py-1.5 font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {trade.pnl >= 0 ? '+' : ''}₹{formatCurrency(trade.pnl)}
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <span className="text-[9px] uppercase font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                                            {trade.exitReason}
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: ADMIN VIEW                                                       */}
        {/* ========================================================================= */}
        {view === 'admin' && (
          <div className="flex flex-col gap-6">
            {/* IP Addresses Row */}
            <div className="glass-panel p-3.5 flex flex-wrap items-center justify-between border-slate-800 bg-[#0f1524]/40 backdrop-blur-md rounded-xl gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Network IPs:
                </div>
                
                {/* IPv4 */}
                <div 
                  onClick={() => handleCopyIp(ipv4, 'v4')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 text-xs font-mono text-slate-300 cursor-pointer transition-all hover:border-indigo-500/30 group"
                  title="Click to copy IPv4"
                >
                  <span className="text-indigo-400 font-semibold text-[10px] uppercase tracking-wider bg-indigo-500/10 px-1.5 py-0.5 rounded">IPv4</span>
                  <span>{ipv4}</span>
                  {copiedIpv4 ? (
                    <CopyCheck className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                  )}
                </div>

                {/* IPv6 */}
                <div 
                  onClick={() => handleCopyIp(ipv6, 'v6')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 text-xs font-mono text-slate-300 cursor-pointer transition-all hover:border-purple-500/30 group"
                  title="Click to copy IPv6"
                >
                  <span className="text-purple-400 font-semibold text-[10px] uppercase tracking-wider bg-purple-500/10 px-1.5 py-0.5 rounded">IPv6</span>
                  <span className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{ipv6}</span>
                  {copiedIpv6 ? (
                    <CopyCheck className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchIps}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/5 bg-white/5 text-slate-300 hover:bg-white/10 transition-all cursor-pointer h-auto"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh IPs
              </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
            {/* LEFT COLUMN: Live WebSocket Quotes Stream at the top, Order Decisions Sheet below it */}
            <div className="xl:col-span-3 flex flex-col gap-6">
              
              {/* Live WebSocket Quotes Stream (At the top) */}
              <div className="glass-panel p-5">
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-400" />
                    <div>
                      <h3 className="font-display font-semibold text-sm">Live WebSocket Quotes Stream</h3>
                      <p className="text-[10px] text-slate-400">Real-time binary streaming quotes from Zerodha Kite Connect WebSocket API (Backend Managed)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">
                      {subscribedCount} Tickers Subscribed
                    </span>
                    {backendWsStatus === 'disconnected' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                        Disconnected
                      </span>
                    )}
                    {backendWsStatus === 'connecting' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse">
                        Connecting...
                      </span>
                    )}
                    {backendWsStatus === 'connected' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        Connected
                      </span>
                    )}

                    {backendWsStatus === 'disconnected' ? (
                      <button 
                        onClick={async () => {
                          try {
                            await fetch('/api/ws-stream/connect', { method: 'POST' });
                            setBackendWsStatus('connecting');
                          } catch (e) {
                            showAlert('Failed to connect stream: ' + e.message);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all text-xs font-semibold cursor-pointer"
                      >
                        Connect Stream
                      </button>
                    ) : (
                      <button 
                        onClick={async () => {
                          try {
                            await fetch('/api/ws-stream/disconnect', { method: 'POST' });
                            setBackendWsStatus('disconnected');
                          } catch (e) {
                            showAlert('Failed to disconnect stream: ' + e.message);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all text-xs font-semibold cursor-pointer"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>

              </div>




            </div>

            {/* RIGHT COLUMN: Sidebar cards */}
            <div className="flex flex-col gap-6">
              {/* Access Token Card */}
              {appConfig.hasAccessToken && accessToken && (
                <div className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                    <span className="text-sm font-semibold text-white">🔑 Access Token</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 bg-black/30 p-2 rounded-lg border border-white/5">
                      <code className="text-[11px] font-mono text-indigo-200 overflow-hidden text-ellipsis whitespace-nowrap block max-w-[140px] md:max-w-xs">
                        {showToken ? accessToken : '••••••••••••••••••••••••••••••••'}
                      </code>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowToken(!showToken)}
                          className="p-1 text-indigo-300/60 hover:text-indigo-200 hover:bg-white/5 rounded transition-all cursor-pointer"
                          title={showToken ? "Hide Access Token" : "Show Access Token"}
                        >
                          {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button 
                          onClick={handleCopyToken}
                          className="p-1 text-indigo-300/60 hover:text-indigo-200 hover:bg-white/5 rounded transition-all cursor-pointer"
                          title="Copy Access Token"
                        >
                          {tokenCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Open Positions */}
              <div className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                  <LayoutDashboard className="h-5 w-5 text-indigo-400" />
                  <h3 className="font-display font-semibold text-sm">Open Positions</h3>
                </div>
                <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2.5">
                  {positions.filter(pos => pos.quantity !== 0).length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No active positions.</p>
                  ) : (
                    positions.filter(pos => pos.quantity !== 0).map((pos, idx) => (
                      <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-indigo-300">{pos.tradingsymbol}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-400">{pos.product}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">LTP: ₹{formatCurrency(pos.last_price)} | Qty: {pos.quantity}</span>
                        </div>
                        <span className={`text-xs font-bold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pos.pnl >= 0 ? '+' : ''}₹{formatCurrency(pos.pnl)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Active GTT Triggers widget */}
              <div className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                  <Activity className="h-5 w-5 text-indigo-400" />
                  <h3 className="font-display font-semibold text-sm">Active GTT Triggers</h3>
                </div>
                <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2.5">
                  {gttTriggers.filter(g => g.status === 'active').length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No active GTT triggers.</p>
                  ) : (
                    gttTriggers.filter(g => g.status === 'active').map((g) => (
                      <div key={g.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-indigo-300">
                              {g.condition?.tradingsymbol}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                              {g.orders?.[0]?.product || 'CNC'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Trigger: {g.condition?.trigger_values?.map(v => `₹${formatCurrency(v)}`).join(' / ')}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleDeleteGtt(g.id)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all cursor-pointer flex-shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Client Memories / Preferences widget */}
              <div className="glass-panel p-5">
                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-indigo-400" />
                    <h3 className="font-display font-semibold text-sm">Strategist Memory</h3>
                  </div>
                  <button 
                    onClick={handleResetMemories}
                    title="Clear memories"
                    className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-[180px] overflow-y-auto flex flex-col gap-2">
                  {memories.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No stored preferences yet. Talk to the assistant to save.</p>
                  ) : (
                    memories.map((mem) => (
                      <div key={mem.id} className="text-xs text-slate-300 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 leading-relaxed">
                        {mem.memory}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}



        {/* ========================================================================= */}
        {/* VIEW 2.5: LIVE SCANNERS VIEW                                             */}
        {/* ========================================================================= */}
        {view === 'scanners' && (
          <div className="flex flex-col gap-6 w-full text-slate-200">
            {/* Header / Intro Card */}
            <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-display font-bold text-white">Discover Live Scanners</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Explore commonly used live scanners across instruments, segments, and timeframes. View scanners running live in the market in real-time.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => {
                    const el = document.getElementById('ai-scanner-builder');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 text-xs font-semibold transition-all cursor-pointer h-auto"
                >
                  Create Scanner
                </Button>
              </div>
            </div>

            {/* AI Scanner Generator Card */}
            <Card id="ai-scanner-builder" className="glass-panel border-0 ring-0 p-5">
              <CardHeader className="p-0 mb-4 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-indigo-400 animate-pulse" />
                  <CardTitle className="font-display font-semibold text-sm text-white">AI Scanner Builder</CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  Describe what you want to scan for in plain English (e.g., "RSI above 70 on high volume" or "EMA 20 crossover EMA 50"), and our AI will code and register a live scanner for you instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <form onSubmit={handleCreateScannerFromPrompt} className="flex flex-col md:flex-row gap-3">
                  <input 
                    type="text"
                    placeholder="Describe your scanner (e.g., 'stocks where current price is above EMA 50 and daily change is over 2%')"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    disabled={aiGenerating}
                    className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500/50 text-white placeholder-slate-500 disabled:opacity-50"
                  />
                  <Button 
                    type="submit"
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    {aiGenerating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Build Scanner</span>
                      </>
                    )}
                  </Button>
                </form>

                {aiError && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium">
                    {aiError}
                  </div>
                )}

                {aiSuccess && (
                  <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium flex flex-col gap-1">
                    <span className="font-bold">✨ Scanner Built Successfully: {aiSuccess.name}</span>
                    <span className="text-slate-300">{aiSuccess.description}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Main content grid */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
              
              {/* Left Column: List of Scanners */}
              <div className="xl:col-span-1 flex flex-col gap-4">
                <div className="glass-panel p-4 flex flex-col gap-3.5">
                  
                  {/* Search and Filters */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Search for Scanners"
                        value={scannerSearchFilter}
                        onChange={(e) => setScannerSearchFilter(e.target.value)}
                        className="flex-1 bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/30"
                      />
                      <Select value={selectedScannerIndex} onValueChange={setSelectedScannerIndex}>
                        <SelectTrigger className="w-[120px] bg-black/30 border-white/5 rounded-xl px-3 py-2 h-auto text-xs text-white justify-between cursor-pointer">
                          <SelectValue placeholder="Select Index" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                          <SelectItem value="Nifty 50">Nifty 50</SelectItem>
                          <SelectItem value="Bank Nifty">Bank Nifty</SelectItem>
                          <SelectItem value="Sensex">Sensex</SelectItem>
                          <SelectItem value="Bankex">Bankex</SelectItem>
                          <SelectItem value="Nifty 100">Nifty 100</SelectItem>
                          <SelectItem value="Nifty 200">Nifty 200</SelectItem>
                          <SelectItem value="Nifty 500">Nifty 500</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Timeframe Filter Bar */}
                    <div className="flex border-b border-white/5 pb-1 mt-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider gap-3">
                      {['All', '1min', '5min', '15min', '1hour', '1day', 'custom'].map(tf => (
                        <button
                          key={tf}
                          onClick={() => setSelectedScannerTimeframe(tf)}
                          className={`pb-1 border-b-2 transition-all cursor-pointer ${
                            selectedScannerTimeframe === tf 
                              ? 'border-indigo-500 text-white' 
                              : 'border-transparent text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scanner List Cards */}
                  <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                    {(() => {
                      const filtered = scannersList.filter(m => {
                        const matchesSearch = m.name.toLowerCase().includes(scannerSearchFilter.toLowerCase());
                        const matchesTf = selectedScannerTimeframe === 'All' || m.tf.toLowerCase() === selectedScannerTimeframe.toLowerCase();
                        return matchesSearch && matchesTf;
                      });

                      if (filtered.length === 0) {
                        return <p className="text-center text-xs text-slate-500 py-6">No matching scanners found.</p>;
                      }

                      return filtered.map(item => (
                        <div
                          key={item.name}
                          onClick={() => setSelectedScanner(item.name)}
                          className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            selectedScanner === item.name
                              ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                              : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] text-slate-300'
                          }`}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-xs">{item.name}</span>
                            <span className="text-[8px] font-bold self-start px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono">
                              {item.tf}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedScanner(item.name);
                              runScanner(item.name, selectedScannerIndex);
                            }}
                            title="Scan Now"
                            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer ml-2"
                          >
                            <RefreshCw className={`w-3 h-3 ${scannerLoading && selectedScanner === item.name ? 'animate-spin' : ''}`} />
                            <span>Scan</span>
                          </button>
                        </div>
                      ));
                    })()}
                  </div>

                </div>
              </div>

              {/* Right Column: Scanner Results Table */}
              <div className="xl:col-span-3 flex flex-col gap-4">
                <div className="glass-panel p-5">
                  
                  {/* Results Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-base text-white">{selectedScanner}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                          Index: {selectedScannerIndex}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {(() => {
                          const descriptions = {
                            'Top Gainers and Increasing': 'The scanner identifies stocks where the current closing price is at least 1% higher than the previous close, and the current price is higher than the close price on a 1-minute candle at all times.',
                            'Top Gainers': 'The scanner identifies stocks where the current closing price is at least 1% higher than the previous close, indicating positive price momentum and potential bullish sentiment.',
                            'Top Losers': 'The scanner identifies stocks where the current closing price is at least 1% lower than the previous close, indicating negative price momentum and potential bearish sentiment.',
                            'Opening Range Breakout': 'Identifies stocks where the current price has broken above the highest high of the last 20 periods, indicating strong bullish breakout momentum.',
                            'Opening Range Breakdown': 'Identifies stocks where the current price has broken below the lowest low of the last 20 periods, indicating strong bearish breakdown momentum.',
                            'Higher High For 2 Days': 'Identifies stocks making a higher high for two consecutive periods, showing a strong short-term bullish trend.',
                            'Lower Low For 2 Days': 'Identifies stocks making a lower low for two consecutive periods, showing a strong short-term bearish trend.',
                            'Short Term Bullish': 'Identifies stocks where the 20-period EMA is above the 50-period EMA and the price is above the 20 EMA, indicating a strong short-term uptrend.',
                            'Short Term Bear': 'Identifies stocks where the 20-period EMA is below the 50-period EMA and the price is below the 20 EMA, indicating a strong short-term downtrend.',
                            'Momentum Surge': 'Identifies stocks where the 14-period RSI is above 60, indicating a strong bullish momentum expansion.',
                            'Momentum Fade': 'Identifies stocks where the 14-period RSI is below 40, indicating a strong bearish momentum contraction.',
                            'Bullish Engulfing': 'Identifies stocks showing a classic Bullish Engulfing candlestick pattern over the last two periods.',
                            'Bearish Engulfing': 'Identifies stocks showing a classic Bearish Engulfing candlestick pattern over the last two periods.',
                            'Volume Breakout': 'Identifies stocks where the current volume is at least 2x higher than the average volume of the last 20 periods, indicating massive institutional participation.'
                          };
                          const activeObj = scannersList.find(s => s.name === selectedScanner);
                          return activeObj?.description || descriptions[selectedScanner] || 'Identifies stocks matching customized indicators.';
                        })()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => runScanner(selectedScanner, selectedScannerIndex)}
                        disabled={scannerLoading}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white border border-indigo-500/30 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3 h-3 ${scannerLoading ? 'animate-spin' : ''}`} />
                        Rescan
                      </button>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-400">Basic</span>
                      <div className="relative group hover:z-[9999]">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-indigo-400 border border-indigo-500/20 bg-indigo-500/10 cursor-pointer block">View Conditions</span>
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-72 p-3 bg-slate-950/95 border border-white/10 rounded-xl text-[11px] text-slate-300 leading-normal shadow-2xl z-[9999] backdrop-blur-md text-center">
                          <div className="font-semibold text-white mb-1">{selectedScanner} Conditions</div>
                          <p>{(() => {
                            const descriptions = {
                              'Top Gainers': 'Identifies stocks with the highest positive percentage change compared to the previous close.',
                              'Top Losers': 'Identifies stocks with the most negative percentage change compared to the previous close.',
                              'Volume Shockers': 'Identifies stocks where today\'s traded volume is unusually high compared to recent averages.',
                              'Most Active': 'Identifies stocks with the highest total traded volume today.',
                              '52-Week High Breakout': 'Identifies stocks currently trading at or above their 52-week high price.',
                              '52-Week Low Breakdown': 'Identifies stocks currently trading at or below their 52-week low price.',
                              'Intraday Recovery': 'Identifies stocks that opened lower but have recovered strongly during the day.',
                              'Intraday Selloff': 'Identifies stocks that opened higher but have faced significant selling pressure during the day.',
                              'Golden Crossover': 'Identifies stocks where the short-term moving average (e.g., 50 SMA) has crossed above the long-term moving average (e.g., 200 SMA).',
                              'Death Crossover': 'Identifies stocks where the short-term moving average has crossed below the long-term moving average.',
                              'RSI Oversold': 'Identifies stocks with an RSI (Relative Strength Index) value below 30, suggesting they may be oversold and due for a bounce.',
                              'RSI Overbought': 'Identifies stocks with an RSI value above 70, suggesting they may be overbought and due for a pullback.',
                              'MACD Bullish Crossover': 'Identifies stocks where the MACD line has crossed above the Signal line, indicating bullish momentum.',
                              'MACD Bearish Crossover': 'Identifies stocks where the MACD line has crossed below the Signal line, indicating bearish momentum.',
                              'Bollinger Band Squeeze': 'Identifies stocks where the Bollinger Bands are exceptionally narrow, indicating low volatility and a potential impending breakout.',
                              'NR7 (Narrow Range 7)': 'Identifies stocks whose daily trading range is the narrowest of the last 7 days, often preceding a strong directional move.',
                              'Inside Bar Pattern': 'Identifies stocks whose current daily range (High to Low) is entirely within the previous day\'s range, indicating consolidation.',
                              'Short Term Bull': 'Identifies stocks where the 20-period EMA is above the 50-period EMA and the price is above the 20 EMA, indicating a strong short-term uptrend.',
                              'Short Term Bear': 'Identifies stocks where the 20-period EMA is below the 50-period EMA and the price is below the 20 EMA, indicating a strong short-term downtrend.',
                              'Momentum Surge': 'Identifies stocks where the 14-period RSI is above 60, indicating a strong bullish momentum expansion.',
                              'Momentum Fade': 'Identifies stocks where the 14-period RSI is below 40, indicating a strong bearish momentum contraction.',
                              'Bullish Engulfing': 'Identifies stocks showing a classic Bullish Engulfing candlestick pattern over the last two periods.',
                              'Bearish Engulfing': 'Identifies stocks showing a classic Bearish Engulfing candlestick pattern over the last two periods.',
                              'Volume Breakout': 'Identifies stocks where the current volume is at least 2x higher than the average volume of the last 20 periods, indicating massive institutional participation.'
                            };
                            return descriptions[selectedScanner] || 'Identifies stocks matching customized indicators.';
                          })()}</p>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Results Count & Last Scan Time */}
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mb-3 font-medium">
                    <span>
                      Scanner Results ({scannerResults.length})
                    </span>
                    <span className="font-mono">
                      Last Scan: {new Date().toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Results Table */}
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-slate-400 border-b border-white/5">
                          <th className="py-2.5 font-bold uppercase tracking-wider">Symbol</th>
                          <th 
                            onClick={() => toggleScannerSort('ltp')}
                            className="py-2.5 font-bold uppercase tracking-wider text-right cursor-pointer hover:text-indigo-400 select-none transition-colors"
                          >
                            LTP{scannerSortField === 'ltp' ? (scannerSortDirection === 'asc' ? ' ▴' : ' ▾') : ''}
                          </th>
                          <th 
                            onClick={() => toggleScannerSort('change')}
                            className="py-2.5 font-bold uppercase tracking-wider text-right cursor-pointer hover:text-indigo-400 select-none transition-colors"
                          >
                            Change %{scannerSortField === 'change' ? (scannerSortDirection === 'asc' ? ' ▴' : ' ▾') : ''}
                          </th>
                          <th 
                            onClick={() => toggleScannerSort('volume')}
                            className="py-2.5 font-bold uppercase tracking-wider text-right cursor-pointer hover:text-indigo-400 select-none transition-colors"
                          >
                            Volume{scannerSortField === 'volume' ? (scannerSortDirection === 'asc' ? ' ▴' : ' ▾') : ''}
                          </th>
                          <th className="py-2.5 font-bold uppercase tracking-wider text-right">Buy/Sell</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {scannerLoading && scannerResults.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-500 italic">Running real-time scan...</td>
                          </tr>
                        ) : scannerResults.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">No instruments match this scanner condition currently.</td>
                          </tr>
                        ) : (
                          getSortedScannerResults().map((row) => (
                            <tr key={row.fullName} className="hover:bg-white/[0.01] transition-colors">
                              <td className="py-3">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-white">{row.symbol}</span>
                                  <span className="text-[8px] text-slate-500 font-mono mt-0.5">{row.fullName}</span>
                                </div>
                              </td>
                              <td className="py-3 text-right font-mono font-bold text-white">
                                ₹{formatCurrency(row.ltp)}
                              </td>
                              <td className="py-3 text-right font-mono font-bold">
                                <span className={row.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                  ({row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}%)
                                </span>
                              </td>
                              <td className="py-3 text-right font-mono text-slate-400">
                                {row.volume ? row.volume.toLocaleString('en-IN') : '—'}
                              </td>
                              
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Bottom Actions */}
                  <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-white/5">
                    <button 
                      onClick={() => {
                        const copyText = scannerResults.map(r => `${r.symbol}\t₹${r.ltp}\t${r.change}%`).join('\n');
                        navigator.clipboard.writeText(copyText);
                        showAlert('Copied scanner results to clipboard!');
                      }}
                      className="px-4 py-2 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Copy
                    </button>
                    <button 
                      onClick={() => {
                        const isSubscribed = subscribedAlerts.includes(selectedScanner);
                        if (isSubscribed) {
                          setSubscribedAlerts(prev => prev.filter(s => s !== selectedScanner));
                        } else {
                          setSubscribedAlerts(prev => [...prev, selectedScanner]);
                          const currentSymbols = scannerResults.map(r => r.symbol);
                          prevScannerMatchesRef.current[selectedScanner] = currentSymbols;
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 h-auto ${
                        subscribedAlerts.includes(selectedScanner)
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-indigo-600 border-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {subscribedAlerts.includes(selectedScanner) ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Alerts Active
                        </>
                      ) : (
                        'Set Alerts'
                      )}
                    </button>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}
        
        {/* Morning IP Modal */}
        {showMorningIpModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl shadow-2xl max-w-sm w-full relative overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              <button 
                onClick={closeIpModal}
                className="absolute top-3 right-3 text-slate-400 hover:text-white"
              >
                ✕
              </button>
              <h3 className="text-lg font-display font-bold text-white mb-2 flex items-center gap-2">
                🚀 Morning IP Check
              </h3>
              <p className="text-sm text-slate-300 mb-4">
                Please whitelist these public IP addresses in your Kite Connect Dashboard for today's session:
              </p>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between bg-black/50 border border-white/10 rounded-lg p-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">IPv4</span>
                    <code className="text-emerald-400 font-mono text-sm">{ipv4}</code>
                  </div>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(ipv4);
                      setCopiedIpv4(true);
                      setTimeout(() => setCopiedIpv4(false), 2000);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer"
                  >
                    {copiedIpv4 ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-black/50 border border-white/10 rounded-lg p-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">IPv6</span>
                    <code className="text-emerald-400 font-mono text-xs max-w-[150px] truncate" title={ipv6}>{ipv6}</code>
                  </div>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(ipv6);
                      setCopiedIpv6(true);
                      setTimeout(() => setCopiedIpv6(false), 2000);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer"
                  >
                    {copiedIpv6 ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={closeIpModal}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="mt-auto px-6 py-4 border-t border-white/5 bg-[#0f1524]/60 text-center text-xs text-slate-500">
        AI Trading Strategy & Portfolio Orchestrator Platform &copy; 2026. Loopback Mode.
      </footer>

      {/* FLOATING SCANNER ALERT TOAST */}
      {toastNotification && (
        <div className="fixed bottom-6 right-6 z-[99999] max-w-sm w-96 p-4 rounded-2xl bg-slate-950/95 border border-indigo-500/35 shadow-2xl shadow-indigo-500/10 backdrop-blur-md animate-in slide-in-from-bottom-5 fade-in duration-300 flex flex-col gap-3 text-slate-200">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 truncate max-w-[200px]" title={toastNotification.scannerName}>
                Alert: {toastNotification.scannerName}
              </span>
            </div>
            <button 
              onClick={() => setToastNotification(null)}
              className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer bg-transparent border-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <span className="text-base font-bold text-white block">{toastNotification.symbol}</span>
              <span className="text-[10px] text-slate-500 block font-medium">Matched at {toastNotification.timestamp}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-slate-200 block">₹{formatCurrency(toastNotification.ltp)}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                toastNotification.change >= 0 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {toastNotification.change >= 0 ? '+' : ''}{toastNotification.change}%
              </span>
            </div>
          </div>

          <div className="flex gap-2 border-t border-white/5 pt-3">
            <button
              onClick={async () => {
                try {
                  const ltp = toastNotification.ltp;
                  const limitPrice = roundToTickSize(ltp * 1.01);
                  const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      exchange: 'NSE',
                      tradingsymbol: toastNotification.symbol,
                      transaction_type: 'BUY',
                      quantity: 1,
                      product: 'MIS',
                      order_type: 'LIMIT',
                      price: limitPrice
                    })
                  });
                  if (res.ok) {
                    showAlert(`Placed quick BUY order for ${toastNotification.symbol} successfully!`);
                    setToastNotification(null);
                  } else {
                    const err = await res.json();
                    showAlert('Order failed: ' + err.error);
                  }
                } catch (e) {
                  showAlert('Order failed: ' + e.message);
                }
              }}
              className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-emerald-600/10 h-auto border-0"
            >
              Quick BUY
            </button>
            <button
              onClick={async () => {
                try {
                  const ltp = toastNotification.ltp;
                  const limitPrice = roundToTickSize(ltp * 0.99);
                  const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      exchange: 'NSE',
                      tradingsymbol: toastNotification.symbol,
                      transaction_type: 'SELL',
                      quantity: 1,
                      product: 'MIS',
                      order_type: 'LIMIT',
                      price: limitPrice
                    })
                  });
                  if (res.ok) {
                    showAlert(`Placed quick SELL order for ${toastNotification.symbol} successfully!`);
                    setToastNotification(null);
                  } else {
                    const err = await res.json();
                    showAlert('Order failed: ' + err.error);
                  }
                } catch (e) {
                  showAlert('Order failed: ' + e.message);
                }
              }}
              className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-rose-600/10 h-auto border-0"
            >
              Quick SELL
            </button>
          </div>
        </div>
      )}

      {view === 'charts' && (
        <div className="flex flex-col gap-6 w-full text-slate-200 animate-in fade-in duration-200">
          {/* Header / Intro Card */}
          <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-display font-bold text-white">Historical Data Backtest Platform</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select stock collections cached in your MongoDB database and execute metrics analysis and filter tests.
              </p>
            </div>
          </div>

          {/* Selector Form Card */}
          <Card className="glass-panel border-0 ring-0 p-5">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {/* Stock Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Database Stock Collection</label>
                  <Select value={chartSymbol} onValueChange={(val) => {
                    setChartSymbol(val);
                    const st = availableStocks.find(s => s.symbol === val);
                    if (st && st.intervals && st.intervals.length > 0) {
                      setChartInterval(st.intervals[0]);
                    }
                  }}>
                    <SelectTrigger className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 text-xs h-auto text-white focus:ring-0">
                      <SelectValue placeholder="Select Cached Stock" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-white/10 text-white text-xs max-h-[250px] overflow-y-auto">
                      {availableStocks.length === 0 ? (
                        <SelectItem disabled value="none">No stock data cached in DB</SelectItem>
                      ) : (
                        availableStocks.map((s) => (
                          <SelectItem key={s.symbol} value={s.symbol}>
                            {s.symbol} ({s.intervals.join(', ')})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Interval Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Timeframe Interval</label>
                  <Select value={chartInterval} onValueChange={setChartInterval}>
                    <SelectTrigger className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 text-xs h-auto text-white focus:ring-0">
                      <SelectValue placeholder="Select Interval" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-white/10 text-white text-xs">
                      {(() => {
                        const activeStock = availableStocks.find(s => s.symbol === chartSymbol);
                        const intervals = activeStock ? activeStock.intervals : ['day'];
                        return intervals.map(inv => (
                          <SelectItem key={inv} value={inv}>
                            {inv === 'minute' ? '1 Minute' : inv === 'day' ? 'Daily' : inv}
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>

                {/* From Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">From Date</label>
                  <input 
                    type="date"
                    value={chartFromDate}
                    onChange={(e) => setChartFromDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 h-[38px] [color-scheme:dark]"
                  />
                </div>

                {/* To Date & Action Buttons */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">To Date</label>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      value={chartToDate}
                      onChange={(e) => setChartToDate(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 h-[38px] [color-scheme:dark]"
                    />
                    <Button 
                      onClick={fetchCandles}
                      disabled={chartLoading || !chartSymbol}
                      className="px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 h-[38px] cursor-pointer"
                    >
                      {chartLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Load Data</span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {chartError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                  {chartError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Backtest & Data analysis Area */}
          {chartLoading ? (
            <div className="flex flex-col items-center justify-center h-[350px] glass-panel border-0 rounded-2xl">
              <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
              <span className="text-sm text-slate-400 font-semibold">Querying candles from MongoDB Atlas database...</span>
              <span className="text-xs text-slate-500 mt-1">Filtering data records based on dates.</span>
            </div>
          ) : (
            <Card className="glass-panel border-0 ring-0 p-5">
              <CardContent className="p-0">
                <BacktestPlatform 
                  candles={candlesData} 
                  symbol={chartSymbol} 
                  interval={chartInterval} 
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}

// Binary Market Data Parsing Helpers for Zerodha Kite Connect WebSocket
const parseQuotePacket = (view, length) => {
  if (length < 8 || view.byteLength < 8) return null;
  const token = view.getInt32(0);
  
  // Segment calculation
  const segment = token & 0xff;
  const NseCD = 3;
  const BseCD = 6;
  const Indices = 9;
  
  let divisor = 100.0;
  if (segment === NseCD) {
    divisor = 10000000.0;
  } else if (segment === BseCD) {
    divisor = 10000.0;
  }
  
  const ltp = view.getInt32(4) / divisor;
  const isIndex = segment === Indices;
  
  // LTP Mode (8 bytes)
  if (length === 8) {
    return {
      token,
      ltp,
      mode: 'ltp',
      isIndex
    };
  }
  
  // Index Quote/Full Mode (28 or 32 bytes)
  if (isIndex) {
    if (length >= 28 && view.byteLength >= 28) {
      const high = view.getInt32(8) / divisor;
      const low = view.getInt32(12) / divisor;
      const open = view.getInt32(16) / divisor;
      const close = view.getInt32(20) / divisor;
      const priceChange = view.getInt32(24) / divisor;
      
      const data = {
        token,
        ltp,
        high,
        low,
        open,
        close,
        priceChange,
        isIndex: true,
        mode: length === 28 ? 'quote' : 'full'
      };
      
      if (length >= 32 && view.byteLength >= 32) {
        data.exchangeTimestamp = view.getInt32(28);
      }
      return data;
    }
    return null;
  }
  
  // Tradeable Instruments (44 or 184 bytes)
  if (length >= 44 && view.byteLength >= 44) {
    const lastTradedQty = view.getInt32(8);
    const avgTradedPrice = view.getInt32(12) / divisor;
    const volume = view.getInt32(16);
    const totalBuy = view.getInt32(20);
    const totalSell = view.getInt32(24);
    const open = view.getInt32(28) / divisor;
    const high = view.getInt32(32) / divisor;
    const low = view.getInt32(36) / divisor;
    const close = view.getInt32(40) / divisor;
    
    const data = {
      token,
      ltp,
      lastTradedQty,
      avgTradedPrice,
      volume,
      totalBuy,
      totalSell,
      open,
      high,
      low,
      close,
      isIndex: false,
      mode: length === 44 ? 'quote' : 'full'
    };
    
    if (length >= 184 && view.byteLength >= 184) {
      data.lastTradedTimestamp = view.getInt32(44);
      data.oi = view.getInt32(48);
      data.oiDayHigh = view.getInt32(52);
      data.oiDayLow = view.getInt32(56);
      data.exchangeTimestamp = view.getInt32(60);
      
      // Parse 10 depth entries (5 buy, 5 sell)
      const buy = [];
      const sell = [];
      let offset = 64;
      for (let i = 0; i < 10; i++) {
        // Each entry is 12 bytes: Qty (4), Price (4), Orders (2), Padding/Reserved (2)
        if (offset + 10 > view.byteLength) break;
        const qty = view.getInt32(offset);
        const price = view.getInt32(offset + 4) / divisor;
        const orders = view.getInt16(offset + 8);
        const entry = { quantity: qty, price, orders };
        if (i < 5) {
          buy.push(entry);
        } else {
          sell.push(entry);
        }
        offset += 12;
      }
      data.depth = { buy, sell };
    }
    return data;
  }

  return null;
};

const parseKiteBinaryMessage = (arrayBuffer) => {
  if (arrayBuffer.byteLength < 2) return [];
  const view = new DataView(arrayBuffer);
  const numPackets = view.getInt16(0);
  let offset = 2;
  const parsedPackets = [];

  for (let i = 0; i < numPackets; i++) {
    if (offset + 2 > arrayBuffer.byteLength) break;
    const packetLength = view.getInt16(offset);
    offset += 2;

    if (offset + packetLength > arrayBuffer.byteLength) break;
    const packetBuffer = arrayBuffer.slice(offset, offset + packetLength);
    const packetView = new DataView(packetBuffer);
    
    const parsed = parseQuotePacket(packetView, packetLength);
    if (parsed) {
      parsedPackets.push(parsed);
    }
    offset += packetLength;
  }
  return parsedPackets;
};
