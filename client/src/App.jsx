import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Shield, Zap, Settings, Play, Check, X, 
  Copy, Trash2, LogOut, RefreshCw, AlertTriangle, Lock, Plus, Search, 
  FileText, LayoutDashboard, CopyCheck, Brain, CircleDot, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Eye, EyeOff, Activity, Flame, Info, Sparkles, Wand2, Briefcase, IndianRupee, PieChart, Cpu, Server, Database, Globe, Square, Code, LineChart, History, MessageSquare, Menu, RefreshCcw, Sliders
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BacktestPlatform from './components/BacktestPlatform';
import { createChart, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';

// Formatting helper
const formatCurrency = (val) => {
  if (typeof val !== 'number' || isNaN(val)) return '0.00';
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatBytes = (bytes) => {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const dm = 2;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
  const [activeAssetMode, setActiveAssetMode] = useState('fno');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [profitTargetExit, setProfitTargetExit] = useState(0);
  const [lossTargetExit, setLossTargetExit] = useState(0);
  const [pnlExitMode, setPnlExitMode] = useState('current');
  const [pnlExitAutoEnabled, setPnlExitAutoEnabled] = useState(true);
  const [reallocationAutoEnabled, setReallocationAutoEnabled] = useState(false);
  const [lastReallocationTime, setLastReallocationTime] = useState(null);
  const [showMorningIpModal, setShowMorningIpModal] = useState(false);

  // Equity vs F&O Risk settings states
  const [settingsTab, setSettingsTab] = useState('fno'); // 'equity' or 'fno'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const getMonitoringUrl = (port, path = '') => {
    if (typeof window === 'undefined') return `http://localhost:${port}${path}`;
    const hostname = window.location.hostname;
    return `http://${hostname}:${port}${path}`;
  };
  const [equityStopLossPercent, setEquityStopLossPercent] = useState(1);
  const [equityTargetPercent, setEquityTargetPercent] = useState(2);
  const [fnoStopLossPercent, setFnoStopLossPercent] = useState(15);
  const [fnoTargetPercent, setFnoTargetPercent] = useState(30);

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
  const [fnoScannersList, setFnoScannersList] = useState([
    { name: 'F&O Theta Decay Setup', tf: 'day', description: 'Identifies underlyings trading range-bound (change between -0.3% and +0.3%), ideal for deploying short straddles or iron condors.' },
    { name: 'F&O IV Crush Setup', tf: 'day', description: 'Identifies options where premium volatility is consolidating, perfect for capturing premium shrinkage.' },
    { name: 'Futures Long Buildup', tf: '15min', description: 'Identifies stocks showing strong price gains (>1.2%) on high volume buildup.' },
    { name: 'Futures Short Buildup', tf: '15min', description: 'Identifies stocks showing strong price drop (<-1.2%) on high volume buildup.' }
  ]);
  const [selectedFnoScanner, setSelectedFnoScanner] = useState('F&O Theta Decay Setup');
  const [fnoScannerResults, setFnoScannerResults] = useState([]);
  const [fnoScannerLoading, setFnoScannerLoading] = useState(false);
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
  const [dbSpace, setDbSpace] = useState(null);
  const [dbSpaceLoading, setDbSpaceLoading] = useState(false);
  const [dbBackups, setDbBackups] = useState({ backups: [], allSymbols: [], syncStatus: null });
  const [dbBackupsLoading, setDbBackupsLoading] = useState(false);
  const [dbBackupsSearch, setDbBackupsSearch] = useState('');
  const [dbBackupsFilter, setDbBackupsFilter] = useState('all'); // 'all' | 'synced' | 'pending' | 'syncing'
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
  const [fastEmaPeriod, setFastEmaPeriod] = useState(9);
  const [slowEmaPeriod, setSlowEmaPeriod] = useState(21);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [buySignalExpr, setBuySignalExpr] = useState("close > ema_fast and ema_fast > ema_slow and rsi > 50");
  const [sellSignalExpr, setSellSignalExpr] = useState("close < ema_fast or rsi < 40");
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState('');
  const [backtestResults, setBacktestResults] = useState(null);
  const [backtestCandles, setBacktestCandles] = useState([]);
  const [backtestChartLoading, setBacktestChartLoading] = useState(false);
  
  const lastAutoSymbolRef = useRef('');
  const lastAutoIntervalRef = useRef('');

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
          setBacktestSymbol(prev => {
            if (data.stocks.some(s => s.symbol === prev)) return prev;
            return data.stocks[0].symbol;
          });
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

  const fetchBacktestCandles = useCallback(async () => {
    if (!backtestSymbol) return;
    setBacktestChartLoading(true);
    try {
      let kiteInterval = '15minute';
      if (backtestInterval === 'minute') kiteInterval = 'minute';
      else if (backtestInterval === '5minute') kiteInterval = '5minute';
      else if (backtestInterval === '15minute') kiteInterval = '15minute';
      else if (backtestInterval === '30minute') kiteInterval = '30minute';
      else if (backtestInterval === '60minute') kiteInterval = '60minute';
      else if (backtestInterval === 'day') kiteInterval = 'day';

      const cleanSymbol = backtestSymbol.toUpperCase().replace(/^(NSE|BSE|MCX|NCDEX):/, '');
      const res = await fetch(`/api/history?symbol=${cleanSymbol}&interval=${kiteInterval}`);
      if (res.ok) {
        const data = await res.json();
        const loadedCandles = data.candles || [];
        setBacktestCandles(loadedCandles);
        
        if (loadedCandles.length > 0 && (backtestSymbol !== lastAutoSymbolRef.current || backtestInterval !== lastAutoIntervalRef.current)) {
          const firstDate = new Date(loadedCandles[0].time).toISOString().split('T')[0];
          const lastDate = new Date(loadedCandles[loadedCandles.length - 1].time).toISOString().split('T')[0];
          setBacktestFromDate(firstDate);
          setBacktestToDate(lastDate);
          lastAutoSymbolRef.current = backtestSymbol;
          lastAutoIntervalRef.current = backtestInterval;
        }
      }
    } catch (err) {
      console.error('[Fetch Backtest Candles Error]:', err);
    } finally {
      setBacktestChartLoading(false);
    }
  }, [backtestSymbol, backtestInterval]);

  useEffect(() => {
    if (view === 'strategies') {
      fetchBacktestCandles();
    }
  }, [view, backtestSymbol, backtestInterval, fetchBacktestCandles]);

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
      const res = await fetch('/api/server-ip');
      const data = await res.json();
      setIpv4(data.ipv4 || 'Not Found');
      setIpv6(data.ipv6 || 'Not Found');
    } catch (err) {
      setIpv4('Unavailable');
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
      }, 1000);
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
        if (data.activeAssetMode !== undefined) {
          setActiveAssetMode(data.activeAssetMode);
        }
        if (data.equityStopLossPercent !== undefined) setEquityStopLossPercent(data.equityStopLossPercent);
        if (data.equityTargetPercent !== undefined) setEquityTargetPercent(data.equityTargetPercent);
        if (data.fnoStopLossPercent !== undefined) setFnoStopLossPercent(data.fnoStopLossPercent);
        if (data.fnoTargetPercent !== undefined) setFnoTargetPercent(data.fnoTargetPercent);
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

  const fetchDbSpace = useCallback(async () => {
    setDbSpaceLoading(true);
    try {
      const res = await fetch('/api/system/db-space');
      const data = await res.json();
      if (data.success) {
        setDbSpace(data);
      }
    } catch (err) {
      console.error('Error fetching db space stats:', err);
    } finally {
      setDbSpaceLoading(false);
    }
  }, []);

  const fetchDbBackups = useCallback(async () => {
    setDbBackupsLoading(true);
    try {
      const res = await fetch('/api/admin/db-backups');
      const data = await res.json();
      if (data.success) {
        setDbBackups({
          backups: data.backups || [],
          allSymbols: data.allSymbols || [],
          syncStatus: data.syncStatus || null
        });
      }
    } catch (err) {
      console.error('Error fetching db backups list:', err);
    } finally {
      setDbBackupsLoading(false);
    }
  }, []);

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
      
      fetchDbSpace();
      fetchDbBackups();
    }
  }, [view, appConfig.hasAccessToken, fetchDbSpace, fetchDbBackups]);

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

  const runFnoScanner = useCallback(async (scannerName = selectedFnoScanner) => {
    setFnoScannerLoading(true);
    try {
      const res = await fetch(`/api/scanners/results?scanner=${encodeURIComponent(scannerName)}&index=${encodeURIComponent('F&O Stocks')}`);
      const data = await res.json();
      if (data && data.results) {
        setFnoScannerResults(data.results);
      }
    } catch (err) {
      console.error('Error running F&O scanner:', err);
    } finally {
      setFnoScannerLoading(false);
    }
  }, [selectedFnoScanner]);

  // Poll F&O scanner results every 1 second when view is 'fno'
  useEffect(() => {
    if (!appConfig.hasAccessToken || view !== 'fno') return;
    let timer = null;

    const pollFnoScannerResults = () => {
      runFnoScanner(selectedFnoScanner);
    };

    pollFnoScannerResults();
    timer = setInterval(pollFnoScannerResults, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [view, selectedFnoScanner, appConfig.hasAccessToken, runFnoScanner]);

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

  const handleGlobalAssetModeChange = async (mode) => {
    setActiveAssetMode(mode);
    try {
      await saveAppStateField({ activeAssetMode: mode });
      // Proactively refresh dashboard data
      updateDashboardData();
    } catch (err) {
      console.error('Failed to update active asset mode:', err);
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

      if (chatData.reply && (
        chatData.reply.includes("not allowed to place orders") || 
        chatData.reply.includes("quota exceeded") || 
        chatData.reply.includes("exceeded your current quota") || 
        chatData.reply.includes("IP (")
      )) {
        showAlert(chatData.reply, 'Execution Error / Warning');
      }
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

      if (data.response && (
        data.response.includes("not allowed to place orders") || 
        data.response.includes("quota exceeded") || 
        data.response.includes("exceeded your current quota") || 
        data.response.includes("IP (")
      )) {
        showAlert(data.response, 'Execution Error / Warning');
      }
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
              console.log('[WS Packet Debug] Parsed packet tokens:', packets.map(p => p.token));
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
        .filter(p => p.instrument_token)
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
      const payload = { 
        activeStrategy,
        activeAssetMode,
        equityStopLossPercent,
        equityTargetPercent,
        fnoStopLossPercent,
        fnoTargetPercent
      };
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

    const indicatorsConfig = {
      indicators: {
        ema_fast: { type: 'EMA', period: Number(fastEmaPeriod) },
        ema_slow: { type: 'EMA', period: Number(slowEmaPeriod) },
        rsi: { type: 'RSI', period: Number(rsiPeriod) }
      },
      buy_signal: buySignalExpr,
      sell_signal: sellSignalExpr
    };

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

  const addCustomTokenToSubscribe = (token) => {
    if (!subscribedTokens.includes(token)) {
      setSubscribedTokens(prev => {
        const next = Array.from(new Set([...prev, token]));
        if (wsStatus === 'connected' && wsRef.current) {
          wsRef.current.send(JSON.stringify({ a: "subscribe", v: [token] }));
          wsRef.current.send(JSON.stringify({ a: "mode", v: ["quote", [token]] }));
        }
        return next;
      });
    }
  };

  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  if (urlParams.get('view') === 'tradingview-matrix') {
    return (
      <TradingViewMatrix 
        liveQuotes={liveQuotes} 
        wsStatus={wsStatus} 
        subscribedTokens={subscribedTokens} 
        addCustomTokenToSubscribe={addCustomTokenToSubscribe} 
      />
    );
  }
  if (urlParams.get('view') === 'fno-matrix') {
    return (
      <FnOTradingViewMatrix 
        liveQuotes={liveQuotes} 
        wsStatus={wsStatus} 
        subscribedTokens={subscribedTokens} 
        addCustomTokenToSubscribe={addCustomTokenToSubscribe} 
      />
    );
  }

  return (
    <div className="flex min-h-screen relative font-sans text-slate-100 bg-[#0b0f19]">
      
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.1),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />

      {/* Collapsible Sidebar */}
      <aside className={`flex flex-col border-r border-white/5 bg-[#0f1524]/80 backdrop-blur-md transition-all duration-300 ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      } sticky top-0 h-screen z-40 flex-shrink-0`}>
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5 h-[73px]">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <span className="font-display font-bold text-white text-lg">▲</span>
          </div>
          {!isSidebarCollapsed && (
            <h1 className="font-display text-base font-bold tracking-tight text-white animate-in fade-in duration-200">
              KITE<span className="font-light text-purple-400">✦CHATBOT</span>
            </h1>
          )}
        </div>

        {/* Mode Switcher */}
        <div className="p-4 border-b border-white/5">
          {isSidebarCollapsed ? (
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={() => handleGlobalAssetModeChange('equity')}
                title="Equity Mode"
                className={`w-10 h-10 flex items-center justify-center font-bold text-[10px] rounded-xl transition-all cursor-pointer ${
                  activeAssetMode === 'equity'
                    ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                EQ
              </button>
              <button
                onClick={() => handleGlobalAssetModeChange('fno')}
                title="F&O Mode"
                className={`w-10 h-10 flex items-center justify-center font-bold text-[10px] rounded-xl transition-all cursor-pointer ${
                  activeAssetMode === 'fno'
                    ? 'bg-purple-600 text-white shadow shadow-purple-600/10'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                FO
              </button>
            </div>
          ) : (
            <div className="flex bg-black/45 border border-white/5 p-0.5 rounded-xl">
              <button
                onClick={() => handleGlobalAssetModeChange('equity')}
                className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded-lg transition-all cursor-pointer ${
                  activeAssetMode === 'equity'
                    ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Equity
              </button>
              <button
                onClick={() => handleGlobalAssetModeChange('fno')}
                className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded-lg transition-all cursor-pointer ${
                  activeAssetMode === 'fno'
                    ? 'bg-purple-600 text-white shadow shadow-purple-600/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                F&O
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex-1 py-4 overflow-y-auto px-3">
          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, activeColor: 'bg-indigo-600/80' },
              { id: 'scanners', label: 'Scanners', icon: Activity, activeColor: 'bg-indigo-600/80' },
              { id: 'charts', label: 'Backtest Platform', icon: Sliders, activeColor: 'bg-indigo-600/80' },
              { id: 'strategies', label: 'Strategies', icon: Settings, activeColor: 'bg-indigo-600/80' },
              { id: 'fno', label: 'F&O Scanners', icon: Flame, activeColor: 'bg-purple-600/80' },
              { id: 'monitoring', label: 'Monitoring', icon: Cpu, activeColor: 'bg-rose-600/80' },
              { id: 'admin', label: 'Admin', icon: FileText, activeColor: 'bg-indigo-600/80' },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = view === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  title={isSidebarCollapsed ? tab.label : ''}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? `${tab.activeColor} text-white shadow-lg shadow-indigo-500/5`
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                  } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{tab.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Header Status Bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0f1524]/60 backdrop-blur-md sticky top-0 z-40 h-[73px]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <span className="text-xs text-slate-400 font-semibold tracking-wide uppercase font-display">
              {isSidebarCollapsed ? "KITE✦CHATBOT" : ""}
            </span>
          </div>

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
                  <div className="border-t border-white/5 pt-2 mt-1 flex flex-col gap-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-[10px] bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border-indigo-500/20 cursor-pointer flex items-center justify-center gap-1 font-semibold"
                      onClick={() => window.open('/?view=tradingview-matrix', '_blank')}
                    >
                      <LineChart className="h-3 w-3" />
                      Live Charts Grid
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-[10px] bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border-purple-500/20 cursor-pointer flex items-center justify-center gap-1 font-semibold"
                      onClick={() => window.open('/?view=fno-matrix', '_blank')}
                    >
                      <Flame className="h-3.5 w-3.5" />
                      F&O Trading Matrix
                    </Button>
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

                    {/* Active Trading Mode Toggle */}
                    <div className="flex flex-col gap-2.5 mt-2 border-t border-white/5 pt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-400 font-semibold text-xs">Active Trading Mode</label>
                        <span className="text-[10px] text-slate-500 font-mono">Applies settings globally</span>
                      </div>
                      <div className="flex bg-black/40 border border-white/5 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setActiveAssetMode('equity')}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            activeAssetMode === 'equity' 
                              ? 'bg-indigo-600 text-white shadow' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Equity Mode
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAssetMode('fno')}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            activeAssetMode === 'fno' 
                              ? 'bg-purple-600 text-white shadow' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          F&O Mode
                        </button>
                      </div>
                    </div>

                    {/* Equity vs F&O Risk Toggle */}
                    <div className="flex flex-col gap-2.5 mt-2 border-t border-white/5 pt-3">
                      <label className="text-slate-400 font-semibold text-xs">Risk/Reward Configuration</label>
                      <div className="flex bg-black/40 border border-white/5 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setSettingsTab('equity')}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            settingsTab === 'equity' 
                              ? 'bg-indigo-600 text-white shadow' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Equity Intraday
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettingsTab('fno')}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            settingsTab === 'fno' 
                              ? 'bg-purple-600 text-white shadow' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          F&O Derivatives
                        </button>
                      </div>

                      {/* Config Inputs */}
                      {settingsTab === 'equity' ? (
                        <div className="grid grid-cols-2 gap-3 mt-1 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Stop-Loss (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={equityStopLossPercent}
                              onChange={(e) => setEquityStopLossPercent(parseFloat(e.target.value) || 0)}
                              className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Target Profit (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={equityTargetPercent}
                              onChange={(e) => setEquityTargetPercent(parseFloat(e.target.value) || 0)}
                              className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 mt-1 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Stop-Loss (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={fnoStopLossPercent}
                              onChange={(e) => setFnoStopLossPercent(parseFloat(e.target.value) || 0)}
                              className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Target Profit (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={fnoTargetPercent}
                              onChange={(e) => setFnoTargetPercent(parseFloat(e.target.value) || 0)}
                              className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                            />
                          </div>
                        </div>
                      )}
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
                        <select 
                          value={backtestSymbol}
                          onChange={(e) => setBacktestSymbol(e.target.value)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
                        >
                          {availableStocks.length === 0 ? (
                            <option value="">No synced symbols available</option>
                          ) : (
                            availableStocks.map((s, idx) => (
                              <option key={idx} value={s.symbol}>{s.symbol}</option>
                            ))
                          )}
                        </select>
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

                      {/* Interactive Form for Indicators */}
                      <div className="md:col-span-2 grid grid-cols-3 gap-3 border-t border-white/5 pt-3">
                        <div className="flex flex-col gap-1 text-xs">
                          <label className="text-slate-400 font-semibold">Fast EMA Period</label>
                          <input 
                            type="number" 
                            value={fastEmaPeriod}
                            onChange={(e) => setFastEmaPeriod(parseInt(e.target.value) || 9)}
                            className="bg-black/35 border border-white/5 rounded-xl px-3 py-1.5 text-white text-center focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-xs">
                          <label className="text-slate-400 font-semibold">Slow EMA Period</label>
                          <input 
                            type="number" 
                            value={slowEmaPeriod}
                            onChange={(e) => setSlowEmaPeriod(parseInt(e.target.value) || 21)}
                            className="bg-black/35 border border-white/5 rounded-xl px-3 py-1.5 text-white text-center focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-xs">
                          <label className="text-slate-400 font-semibold">RSI Period</label>
                          <input 
                            type="number" 
                            value={rsiPeriod}
                            onChange={(e) => setRsiPeriod(parseInt(e.target.value) || 14)}
                            className="bg-black/35 border border-white/5 rounded-xl px-3 py-1.5 text-white text-center focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-xs md:col-span-2">
                        <label className="text-slate-400 font-semibold">Buy Condition</label>
                        <input 
                          type="text" 
                          value={buySignalExpr}
                          onChange={(e) => setBuySignalExpr(e.target.value)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-1.5 text-white focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1 text-xs md:col-span-2">
                        <label className="text-slate-400 font-semibold">Sell Condition</label>
                        <input 
                          type="text" 
                          value={sellSignalExpr}
                          onChange={(e) => setSellSignalExpr(e.target.value)}
                          className="bg-black/35 border border-white/5 rounded-xl px-3 py-1.5 text-white focus:outline-none"
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
        {/* VIEW: MONITORING VIEW                                                    */}
        {/* ========================================================================= */}
        {view === 'monitoring' && (
          <div className="flex flex-col gap-6">
            <div className="glass-panel p-6 border-slate-800 bg-[#0f1524]/40 backdrop-blur-md rounded-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6 flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-rose-400" />
                    System Telemetry & Live Monitoring
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Real-time metrics, logs aggregation, and monitoring infrastructure dashboard.
                  </p>
                </div>
                <div className="flex gap-2">
                  <a 
                    href={getMonitoringUrl(3000, "/d/signal-generator-metrics/signal-generator-telemetry?orgId=1&refresh=5s&theme=dark")} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Open Grafana
                  </a>
                  <a 
                    href={getMonitoringUrl(9090)} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Server className="h-3.5 w-3.5" />
                    Open Prometheus
                  </a>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-[#0b0f19] border border-white/5 p-4 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-3">Scrapers Status</span>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Express Backend (/metrics)</span>
                      <span className="bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded text-[10px] uppercase">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>VectorBT FastAPI (/metrics)</span>
                      <span className="bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded text-[10px] uppercase">Active</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0b0f19] border border-white/5 p-4 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-3">Logs & Loki</span>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Loki Ingest Host</span>
                      <span className="bg-indigo-500/20 text-indigo-400 font-semibold px-2 py-0.5 rounded text-[10px] uppercase">Running</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Promtail Container Agent</span>
                      <span className="bg-indigo-500/20 text-indigo-400 font-semibold px-2 py-0.5 rounded text-[10px] uppercase">Active</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0b0f19] border border-white/5 p-4 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-3">Alerts Manager</span>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Alertmanager (Port 9093)</span>
                      <span className="bg-amber-500/20 text-amber-400 font-semibold px-2 py-0.5 rounded text-[10px] uppercase">Online</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Alert Routing Rules</span>
                      <span className="bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded text-[10px] uppercase">Loaded</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Embedding the live Grafana dashboard */}
              <div className="border border-white/5 rounded-xl overflow-hidden h-[450px] bg-[#070b13] flex flex-col items-center justify-center text-center p-6 text-slate-400 relative">
                <iframe 
                  src={getMonitoringUrl(3000, "/d/signal-generator-metrics/signal-generator-telemetry?orgId=1&refresh=5s&theme=dark&kiosk")} 
                  width="100%" 
                  height="100%" 
                  frameBorder="0"
                  title="Grafana Dashboard Live Feed"
                  className="absolute inset-0 z-10"
                />
                <div className="flex flex-col items-center gap-2">
                  <Sliders className="h-8 w-8 text-slate-600 animate-pulse" />
                  <span className="text-xs">Connecting to Grafana Live Feed...</span>
                  <span className="text-[10px] text-slate-500 mt-1 max-w-sm">Ensure your Docker compose monitoring stack is started (`docker-compose up -d`) to load this panel.</span>
                </div>
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

            {/* Monitoring Stack Check Row */}
            <div className="glass-panel p-3.5 flex flex-wrap items-center justify-between border-slate-800 bg-[#0f1524]/40 backdrop-blur-md rounded-xl gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <Activity className="h-4 w-4 text-rose-500 animate-pulse" />
                    Monitoring Stack Check:
                  </div>
                  <span className="text-[10px] text-slate-500">Grafana Credentials: <code className="text-slate-400 bg-white/5 px-1 py-0.5 rounded font-mono">admin</code> / <code className="text-slate-400 bg-white/5 px-1 py-0.5 rounded font-mono">admin</code></span>
                </div>

                {/* Grafana Button */}
                <a 
                  href={getMonitoringUrl(3000, "/d/signal-generator-metrics/signal-generator-telemetry?orgId=1&refresh=5s&theme=dark")} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 text-xs text-slate-300 transition-all hover:border-rose-500/30 group cursor-pointer"
                  title="Open Grafana Dashboard"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] uppercase font-bold text-rose-400">Grafana</span>
                  <span className="text-[10px] text-slate-400 font-mono">Port 3000</span>
                </a>

                {/* Prometheus Button */}
                <a 
                  href={getMonitoringUrl(9090)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 text-xs text-slate-300 transition-all hover:border-orange-500/30 group cursor-pointer"
                  title="Open Prometheus Scraper"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] uppercase font-bold text-orange-400">Prometheus</span>
                  <span className="text-[10px] text-slate-400 font-mono">Port 9090</span>
                </a>

                {/* Alertmanager Button */}
                <a 
                  href={getMonitoringUrl(9093)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 text-xs text-slate-300 transition-all hover:border-amber-500/30 group cursor-pointer"
                  title="Open Alertmanager"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] uppercase font-bold text-amber-400">Alertmanager</span>
                  <span className="text-[10px] text-slate-400 font-mono">Port 9093</span>
                </a>

                {/* Loki Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-white/5 text-xs text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] uppercase font-bold text-indigo-400">Loki Logs</span>
                  <span className="text-[10px] text-slate-400 font-mono">Port 3100</span>
                </div>
              </div>
              
              <button 
                onClick={() => setView('monitoring')}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-0"
              >
                <Cpu className="h-3.5 w-3.5" />
                Go to Telemetry Tab
              </button>
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

              {/* SignalGenerator System Blueprint & Documentation Console */}
              <div className="glass-panel p-6 flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center gap-2.5 border-b border-white/5 pb-4">
                  <Sliders className="h-6 w-6 text-indigo-400 animate-pulse" />
                  <div>
                    <h3 className="font-display font-bold text-base text-white">SignalGenerator Blueprint & Documentation Console</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Interactive architectural directory, data structures, and configuration telemetry</p>
                  </div>
                </div>

                {/* Subsystem Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs text-slate-300">
                  
                  {/* Card 1: Zerodha Kite Connect API & Rate Limits */}
                  <div className="bg-[#0f1524]/60 border border-white/5 p-4 rounded-xl flex flex-col gap-3.5 relative">
                    <h4 className="font-semibold text-indigo-300 flex items-center gap-2 border-b border-white/5 pb-2">
                      <Globe className="h-4.5 w-4.5 text-indigo-400" /> API Rate Limit Categories
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Outgoing API requests to Zerodha are rate-limited. Hover over any category to view the complete list of mapped API methods:
                    </p>
                    <ul className="flex flex-col gap-2.5">
                      <li className="flex items-center justify-between border-b border-white/5 pb-1.5 relative group cursor-help hover:bg-white/[0.01] px-1 rounded transition-all">
                        <span className="font-medium text-slate-200">Quote Endpoint (1 r/s)</span>
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">getOHLC, getQuote, getLTP</span>
                        <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-slate-900 border border-white/10 p-2.5 rounded-lg shadow-2xl text-[11px] font-mono text-indigo-200 z-50 min-w-[200px] backdrop-blur-md">
                          <div className="font-sans font-semibold text-slate-300 border-b border-white/5 pb-1 mb-1.5 flex justify-between">
                            <span>Quote Endpoints</span>
                            <span className="text-indigo-400">1 r/s</span>
                          </div>
                          <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                            <div>• getOHLC</div>
                            <div>• getQuote</div>
                            <div>• getLTP</div>
                          </div>
                        </div>
                      </li>
                      <li className="flex items-center justify-between border-b border-white/5 pb-1.5 relative group cursor-help hover:bg-white/[0.01] px-1 rounded transition-all">
                        <span className="font-medium text-slate-200">Historical Endpoint (3 r/s)</span>
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">getHistoricalData</span>
                        <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-slate-900 border border-white/10 p-2.5 rounded-lg shadow-2xl text-[11px] font-mono text-indigo-200 z-50 min-w-[200px] backdrop-blur-md">
                          <div className="font-sans font-semibold text-slate-300 border-b border-white/5 pb-1 mb-1.5 flex justify-between">
                            <span>Historical Endpoints</span>
                            <span className="text-indigo-400">3 r/s</span>
                          </div>
                          <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                            <div>• getHistoricalData</div>
                          </div>
                        </div>
                      </li>
                      <li className="flex items-center justify-between border-b border-white/5 pb-1.5 relative group cursor-help hover:bg-white/[0.01] px-1 rounded transition-all">
                        <span className="font-medium text-slate-200">Order Placement (10 r/s)</span>
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">placeOrder, cancelOrder...</span>
                        <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-slate-900 border border-white/10 p-2.5 rounded-lg shadow-2xl text-[11px] font-mono text-indigo-200 z-50 min-w-[200px] backdrop-blur-md">
                          <div className="font-sans font-semibold text-slate-300 border-b border-white/5 pb-1 mb-1.5 flex justify-between">
                            <span>Order Endpoints</span>
                            <span className="text-indigo-400">10 r/s</span>
                          </div>
                          <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                            <div>• placeOrder</div>
                            <div>• modifyOrder</div>
                            <div>• cancelOrder</div>
                            <div>• placeGTT</div>
                            <div>• modifyGTT</div>
                            <div>• deleteGTT</div>
                          </div>
                        </div>
                      </li>
                      <li className="flex items-center justify-between pb-1 relative group cursor-help hover:bg-white/[0.01] px-1 rounded transition-all">
                        <span className="font-medium text-slate-200">Other Endpoints (10 r/s)</span>
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">getPositions, getMargins...</span>
                        <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-slate-900 border border-white/10 p-2.5 rounded-lg shadow-2xl text-[11px] font-mono text-indigo-200 z-50 min-w-[200px] backdrop-blur-md">
                          <div className="font-sans font-semibold text-slate-300 border-b border-white/5 pb-1 mb-1.5 flex justify-between">
                            <span>Other Endpoints</span>
                            <span className="text-indigo-400">10 r/s</span>
                          </div>
                          <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                            <div>• getPositions</div>
                            <div>• getGTTs</div>
                            <div>• getMargins</div>
                            <div>• getHoldings</div>
                            <div>• generateSession</div>
                            <div>• getvirtualContractNote</div>
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Card 2: Server Background Polling Loops */}
                  <div className="bg-[#0f1524]/60 border border-white/5 p-4 rounded-xl flex flex-col gap-3.5">
                    <h4 className="font-semibold text-indigo-300 flex items-center gap-2 border-b border-white/5 pb-2">
                      <Activity className="h-4.5 w-4.5 text-indigo-400" /> Server Background Polling
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      The Express server maintains asynchronous, optimized polling loops to sync states, trailing stop-losses, and execute capital reallocations:
                    </p>
                    <ul className="flex flex-col gap-2.5">
                      <li className="flex items-start gap-2 border-b border-white/5 pb-2">
                        <div className="bg-indigo-500/10 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-indigo-400">1000ms</div>
                        <div>
                          <span className="font-medium text-slate-200 block">Positions Polling & Trailing SL</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Calls <code>getPositions()</code> to track active MIS trades, calculate trailing stop-losses, and check target exits.</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2 border-b border-white/5 pb-2">
                        <div className="bg-indigo-500/10 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-indigo-400">3s</div>
                        <div>
                          <span className="font-medium text-slate-200 block">GTT Triggers Update</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Calls <code>getGTTs()</code> to sync exit GTT order statuses and remove out-of-sync or duplicate triggers.</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="bg-indigo-500/10 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-indigo-400">5s</div>
                        <div>
                          <span className="font-medium text-slate-200 block">Margins & Funds Sync</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Calls <code>getMargins()</code> to update available cash limits and track capital allocations.</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Card 3: MongoDB Database Schema & Caches */}
                  <div className="bg-emerald-950/15 border border-emerald-500/20 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05),0_0_20px_-5px_rgba(16,185,129,0.1)] p-4 rounded-xl flex flex-col gap-3.5 backdrop-blur-md">
                    <h4 className="font-semibold text-emerald-300 flex items-center gap-2 border-b border-emerald-500/15 pb-2">
                      <Database className="h-4.5 w-4.5 text-emerald-400" /> Database Collections
                    </h4>
                    <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                      MongoDB tracks configuration states and local cached market data to minimize external API roundtrips:
                    </p>
                    <ul className="flex flex-col gap-2.5">
                      <li className="flex items-start justify-between border-b border-emerald-500/10 pb-2">
                        <div>
                          <span className="font-medium text-emerald-200 block">AppState Schema</span>
                          <span className="text-[10px] text-emerald-400/70 block mt-0.5">Global configuration, active strategy, watchlisted stocks, stop-loss/target, and chat memories.</span>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/15 text-emerald-300 font-mono">Document</span>
                      </li>
                      <li className="flex items-start justify-between border-b border-emerald-500/10 pb-2">
                        <div>
                          <span className="font-medium text-emerald-200 block">HistoricalCandles Schema</span>
                          <span className="text-[10px] text-emerald-400/70 block mt-0.5">Caches 15-minute and daily candle records (high, low, open, close, volume) for indicators.</span>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/15 text-emerald-300 font-mono">Collection</span>
                      </li>
                      <li className="flex items-start justify-between border-b border-emerald-500/10 pb-2">
                        <div>
                          <span className="font-medium text-emerald-200 block">Instruments & Docs Schemas</span>
                          <span className="text-[10px] text-emerald-400/70 block mt-0.5">Tracks 100K+ Zerodha instrument tokens and crawls docs to feed API parameters to OpenAI.</span>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/15 text-emerald-300 font-mono">Collection</span>
                      </li>
                    </ul>

                    {/* MongoDB Storage Space Left Telemetry */}
                    <div className="border-t border-emerald-500/20 pt-3.5 mt-1 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400/80">Database Storage Telemetry</span>
                        <button 
                          onClick={fetchDbSpace}
                          disabled={dbSpaceLoading}
                          className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
                          title="Refresh Database Stats"
                        >
                          <RefreshCw className={`h-3 w-3 ${dbSpaceLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {dbSpace ? (
                        <div className="flex flex-col gap-2.5">
                          {/* Disk Space Progress */}
                          <div className="bg-emerald-950/20 border border-emerald-500/15 p-2.5 rounded-lg flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-medium text-emerald-400/80">Host Disk Storage</span>
                              <span className="font-mono text-emerald-200 font-semibold">
                                {dbSpace.hostDisk?.avail || 'N/A'} Free of {dbSpace.hostDisk?.size || 'N/A'} ({100 - parseInt(dbSpace.hostDisk?.usePct || '0')}% left)
                              </span>
                            </div>
                            <div className="w-full bg-slate-950/80 rounded-full h-1.5 overflow-hidden border border-emerald-500/10">
                              <div 
                                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full" 
                                style={{ width: dbSpace.hostDisk?.usePct || '0%' }}
                              />
                            </div>
                          </div>

                          {/* DB Stats Grid */}
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="bg-emerald-950/30 border border-emerald-500/15 p-2 rounded-lg flex flex-col gap-0.5">
                              <span className="text-emerald-400/70">Data Size</span>
                              <span className="font-mono text-emerald-300 font-semibold">{dbSpace.db?.dataSizeMb || '0.00'} MB</span>
                            </div>
                            <div className="bg-emerald-950/30 border border-emerald-500/15 p-2 rounded-lg flex flex-col gap-0.5">
                              <span className="text-emerald-400/70">Storage Size</span>
                              <span className="font-mono text-emerald-300 font-semibold">{dbSpace.db?.storageSizeMb || '0.00'} MB</span>
                            </div>
                            <div className="bg-emerald-950/30 border border-emerald-500/15 p-2 rounded-lg flex flex-col gap-0.5">
                              <span className="text-emerald-400/70">Index Size</span>
                              <span className="font-mono text-emerald-300 font-semibold">{dbSpace.db?.indexSizeMb || '0.00'} MB</span>
                            </div>
                            <div className="bg-emerald-950/30 border border-emerald-500/15 p-2 rounded-lg flex flex-col gap-0.5">
                              <span className="text-emerald-400/70">Total Documents</span>
                              <span className="font-mono text-emerald-300 font-semibold">{(dbSpace.db?.documents || 0).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Database Network Traffic */}
                          <div className="bg-emerald-950/25 border border-emerald-500/15 p-2.5 rounded-lg flex flex-col gap-1.5 mt-0.5">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400/80 mb-0.5">
                              Network Telemetry
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-emerald-400/60">Bytes In (Incoming)</span>
                                <span className="font-mono text-emerald-300 font-semibold">{formatBytes(dbSpace.network?.bytesIn)}</span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-emerald-400/60">Bytes Out (Outgoing)</span>
                                <span className="font-mono text-emerald-300 font-semibold">{formatBytes(dbSpace.network?.bytesOut)}</span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-emerald-400/60">Requests</span>
                                <span className="font-mono text-emerald-300 font-semibold">{(dbSpace.network?.numRequests || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      ) : (
                        <div className="text-[10px] text-emerald-500 italic py-2 text-center">
                          {dbSpaceLoading ? 'Loading telemetry...' : 'Telemetry unavailable.'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 4: OpenAI Strategy Engine & SDK Modification */}
                  <div className="bg-[#0f1524]/60 border border-white/5 p-4 rounded-xl flex flex-col gap-3.5">
                    <h4 className="font-semibold text-indigo-300 flex items-center gap-2 border-b border-white/5 pb-2">
                      <Brain className="h-4.5 w-4.5 text-indigo-400" /> AI Engine & Local SDK Patches
                    </h4>
                    
                    <div className="flex flex-col gap-2.5">
                      <div className="bg-slate-900/50 border border-white/5 p-2.5 rounded-lg">
                        <div className="flex items-center gap-1.5 text-slate-200 font-medium mb-1">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> OpenAI Chat Decision Engine
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Extracts trading symbols from user conversation, structures index lists, and returns system actions. Real-time indicators are compiled locally, structured, and fed to GPT models for strategic decisions.
                        </p>
                      </div>

                      <div className="bg-slate-900/50 border border-white/5 p-2.5 rounded-lg">
                        <div className="flex items-center gap-1.5 text-slate-200 font-medium mb-1">
                          <Shield className="h-3.5 w-3.5 text-emerald-400" /> Local SDK Reconnection Patch
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          The local <code>kiteconnect-sdk</code> code has been modified in <code>ticker.ts/ticker.js</code> to remove the default <code>process.exit(1)</code> triggers on connection limit failures, preventing WebSocket timeouts from crashing the server.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Divider */}
                <div className="border-t border-white/5 my-2"></div>

                {/* Section: Operational Pipeline Timeline */}
                <div className="flex flex-col gap-4">
                  <h4 className="font-semibold text-indigo-300 flex items-center gap-2">
                    <Activity className="h-4.5 w-4.5 text-indigo-400 animate-pulse" /> Complete App Execution & Lifecycle Pipeline
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed -mt-2">
                    Understanding the end-to-end data flow: from initial session authorization to real-time execution loops and AI decisions.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {/* Step 1 */}
                    <div className="bg-[#0f1524]/40 border border-white/5 p-3.5 rounded-lg flex flex-col gap-1.5 hover:border-indigo-500/20 transition-all">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded font-mono">STEP 1</span>
                        <span className="font-medium text-slate-200">Session & Cache Init</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        On startup, <code>server.js</code> restores token keys from <code>.session_cache.json</code>. If expired or empty, it triggers the Zerodha OAuth login callback to secure Kite API client authorization.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-[#0f1524]/40 border border-white/5 p-3.5 rounded-lg flex flex-col gap-1.5 hover:border-indigo-500/20 transition-all">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded font-mono">STEP 2</span>
                        <span className="font-medium text-slate-200">DB Sync & Cache Warmup</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Connects to MongoDB, synchronizes 100K+ Zerodha instrument definitions, loads cached historical 15-minute/daily candles, and retrieves previous chatbot memory context.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-[#0f1524]/40 border border-white/5 p-3.5 rounded-lg flex flex-col gap-1.5 hover:border-indigo-500/20 transition-all">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded font-mono">STEP 3</span>
                        <span className="font-medium text-slate-200">Live WebSocket Streaming</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Launches the <code>KiteTicker</code> WebSocket stream in <code>scanner.js</code> to capture real-time price ticks. Modified SDK catches reconnection limits without crashing the server.
                      </p>
                    </div>

                    {/* Step 4 */}
                    <div className="bg-[#0f1524]/40 border border-white/5 p-3.5 rounded-lg flex flex-col gap-1.5 hover:border-indigo-500/20 transition-all">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded font-mono">STEP 4</span>
                        <span className="font-medium text-slate-200">Indicator Compilation</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Raw price ticks are aggregated into 1m and 15m candlestick logs inside memory. Tech indicators (RSI, MACD, Moving Averages, Supertrend) are compiled on each fresh candle arrival.
                      </p>
                    </div>

                    {/* Step 5 */}
                    <div className="bg-[#0f1524]/40 border border-white/5 p-3.5 rounded-lg flex flex-col gap-1.5 hover:border-indigo-500/20 transition-all">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded font-mono">STEP 5</span>
                        <span className="font-medium text-slate-200">Background SL Guard</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Every <code>1000ms</code>, the server fetches net positions to check trailing stop-loss, target exits, or auto-exit timers (at 3:24 PM), triggering exit orders if metrics are crossed.
                      </p>
                    </div>

                    {/* Step 6 */}
                    <div className="bg-[#0f1524]/40 border border-white/5 p-3.5 rounded-lg flex flex-col gap-1.5 hover:border-indigo-500/20 transition-all">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded font-mono">STEP 6</span>
                        <span className="font-medium text-slate-200">AI Consult & Reallocation</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        OpenAI parses prompt context to structure trade calls. Every 15 minutes during market hours, capital reallocations are run to optimize active margin assignments dynamically.
                      </p>
                    </div>

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

              {/* Stock Database Backups Card */}
              <div className="glass-panel p-5">
                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-400" />
                    <h3 className="font-display font-semibold text-sm">Stock Database Backups</h3>
                  </div>
                  <button 
                    onClick={fetchDbBackups}
                    disabled={dbBackupsLoading}
                    className="p-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 disabled:opacity-50 transition-all cursor-pointer"
                    title="Refresh Backups"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${dbBackupsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col gap-2 mb-3">
                  <input 
                    type="text"
                    placeholder="Search stocks by symbol..."
                    value={dbBackupsSearch}
                    onChange={(e) => setDbBackupsSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                  />
                  <div className="flex flex-wrap gap-1">
                    {['all', 'synced', 'pending', 'syncing'].map(f => (
                      <button
                        key={f}
                        onClick={() => setDbBackupsFilter(f)}
                        className={`text-[9px] font-bold px-2 py-1 rounded transition-all cursor-pointer border ${
                          dbBackupsFilter === f
                            ? 'bg-indigo-500/25 border-indigo-500/30 text-indigo-300'
                            : 'bg-white/[0.01] border-white/5 text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto flex flex-col gap-2.5 pr-1">
                  {dbBackupsLoading && (!dbBackups.backups || dbBackups.backups.length === 0) ? (
                    <p className="text-xs text-slate-500 py-6 text-center">Loading backups...</p>
                  ) : (() => {
                    const backupsArray = dbBackups.backups || [];
                    const allSymbols = dbBackups.allSymbols || [];
                    const syncStatus = dbBackups.syncStatus || null;

                    // Group by symbol
                    const grouped = {};
                    backupsArray.forEach(item => {
                      if (!grouped[item.symbol]) {
                        grouped[item.symbol] = [];
                      }
                      grouped[item.symbol].push(item);
                    });

                    // Build merged list
                    const merged = [];
                    allSymbols.forEach(sym => {
                      const hasBackup = !!grouped[sym];
                      const isSyncing = syncStatus?.status === 'running' && syncStatus?.currentSymbol === sym;
                      merged.push({
                        symbol: sym,
                        timeframes: hasBackup ? grouped[sym] : [],
                        isSynced: hasBackup,
                        isSyncing: isSyncing,
                        isPending: !hasBackup && !isSyncing
                      });
                    });

                    // Add items from backups not in allSymbols
                    Object.keys(grouped).forEach(sym => {
                      if (!allSymbols.includes(sym)) {
                        merged.push({
                          symbol: sym,
                          timeframes: grouped[sym],
                          isSynced: true,
                          isSyncing: syncStatus?.status === 'running' && syncStatus?.currentSymbol === sym,
                          isPending: false
                        });
                      }
                    });

                    // Apply filters
                    const filtered = merged.filter(item => {
                      const matchesSearch = item.symbol.toLowerCase().includes(dbBackupsSearch.toLowerCase());
                      if (!matchesSearch) return false;

                      if (dbBackupsFilter === 'synced') return item.isSynced;
                      if (dbBackupsFilter === 'pending') return item.isPending;
                      if (dbBackupsFilter === 'syncing') return item.isSyncing;
                      return true;
                    });

                    if (filtered.length === 0) {
                      return <p className="text-xs text-slate-500 py-6 text-center">No stocks match filter.</p>;
                    }

                    const formatInterval = (intv) => {
                      if (intv === '15minute') return '15m';
                      if (intv === 'minute') return '1m';
                      if (intv === 'day') return '1d';
                      return intv;
                    };

                    return filtered.map(item => (
                      <div 
                        key={item.symbol} 
                        className={`border p-2.5 rounded-lg flex flex-col gap-1.5 transition-all ${
                          item.isSyncing 
                            ? 'bg-blue-500/5 border-blue-500/30 shadow-[0_0_10px_-2px_rgba(59,130,246,0.2)]' 
                            : item.isSynced 
                              ? 'bg-white/[0.02] border-white/5' 
                              : 'bg-black/20 border-white/[0.01] opacity-50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[11px] text-slate-200">{item.symbol}</span>
                            {item.isSyncing && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 animate-pulse">
                                Syncing
                              </span>
                            )}
                            {item.isPending && (
                              <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                                Pending
                              </span>
                            )}
                            {item.isSynced && !item.isSyncing && (
                              <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                Synced
                              </span>
                            )}
                          </div>
                        </div>

                        {item.isSynced && (
                          <div className="flex flex-wrap gap-1">
                            {item.timeframes.map((tf, tIdx) => (
                              <span 
                                key={tIdx} 
                                className="text-[9px] font-medium px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/15 text-indigo-300 flex items-center gap-1"
                                title={`Range: ${new Date(tf.minTime).toLocaleDateString()} - ${new Date(tf.maxTime).toLocaleDateString()}`}
                              >
                                {formatInterval(tf.interval)}: <span className="font-mono font-bold text-indigo-200">{(tf.count || 0).toLocaleString()}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2.4: F&O DERIVATIVES & SCANNERS DASHBOARD                           */}
      {/* ========================================================================= */}
      {view === 'fno' && (
        <div className="flex flex-col gap-6 w-full text-slate-200 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-purple-500/10 bg-purple-950/5">
            <div>
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Flame className="h-5 w-5 text-purple-400 animate-pulse" />
                F&O Derivatives & Scanners Dashboard
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan underlying derivatives, track Open Interest structures, and deploy AI-executed option strategies with single-click actions.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => window.open('/?view=fno-matrix', '_blank')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5" />
                Launch F&O Matrix ↗
              </Button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Sidebar: Scanner List & Watchlist */}
            <div className="flex flex-col gap-6">
              {/* Watchlist card */}
              <Card className="glass-panel border-0 ring-0 p-4 flex flex-col gap-3">
                <CardHeader className="p-0 border-b border-white/5 pb-2">
                  <CardTitle className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5 font-display">
                    <IndianRupee className="h-4 w-4 text-purple-400" />
                    Index Underlyings
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex flex-col gap-2">
                  <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <div>
                      <span className="text-xs font-bold text-white">NIFTY 50</span>
                      <span className="text-[10px] text-slate-500 block">Spot Underlying</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-400 font-mono">₹22,050.40</span>
                      <span className="text-[10px] text-emerald-500 block font-mono">+0.65%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <div>
                      <span className="text-xs font-bold text-white">NIFTY BANK</span>
                      <span className="text-[10px] text-slate-500 block">Spot Underlying</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-400 font-mono">₹45,310.50</span>
                      <span className="text-[10px] text-emerald-500 block font-mono">+0.82%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scanners menu card */}
              <Card className="glass-panel border-0 ring-0 p-4 flex flex-col gap-3">
                <CardHeader className="p-0 border-b border-white/5 pb-2">
                  <CardTitle className="text-xs uppercase font-bold tracking-wider text-slate-400 font-display">F&O Scanners</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex flex-col gap-2">
                  {fnoScannersList.map((sc) => (
                    <button
                      key={sc.name}
                      onClick={() => setSelectedFnoScanner(sc.name)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-0.5 ${
                        selectedFnoScanner === sc.name
                          ? 'bg-purple-600/10 border-purple-500/30 text-white'
                          : 'bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <CircleDot className={`h-3 w-3 ${selectedFnoScanner === sc.name ? 'text-purple-400' : 'text-slate-500'}`} />
                        {sc.name}
                      </span>
                      <span className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{sc.description}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Main table: Scan results & Actions */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card className="glass-panel border-0 ring-0 p-5 flex flex-col h-full min-h-[400px]">
                <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between border-b border-white/5 pb-3 flex-wrap gap-2">
                  <div>
                    <CardTitle className="font-display font-semibold text-sm text-white">
                      Scan Results: <span className="text-purple-400">{selectedFnoScanner}</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Matches found in the F&O stock universe. Click on actions to execute option legs.
                    </CardDescription>
                  </div>
                  {fnoScannerLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-purple-400">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Scanning...</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-x-auto">
                  {fnoScannerResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500">
                      <Search className="h-8 w-8 mb-2 opacity-40" />
                      <span className="text-xs">No matching F&O underlyings detected.</span>
                      <span className="text-[10px] text-slate-600 mt-1">Polling live quotes stream for matching conditions.</span>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-white/5 hover:bg-transparent">
                          <TableHead className="text-[10px] uppercase font-bold text-slate-400 w-24">Symbol</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-slate-400 text-right">LTP (₹)</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-slate-400 text-right">Change (%)</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-slate-400 text-center w-60">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fnoScannerResults.map((res) => (
                          <TableRow key={res.symbol} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <TableCell className="font-bold text-xs text-white">{res.symbol}</TableCell>
                            <TableCell className="text-xs text-right font-mono font-semibold">₹{formatCurrency(res.ltp)}</TableCell>
                            <TableCell className={`text-xs text-right font-mono font-bold ${res.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {res.change >= 0 ? '+' : ''}{res.change.toFixed(2)}%
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1.5 justify-center">
                                <button
                                  onClick={async () => {
                                    setToastNotification("Routing ATM CE+PE Short Straddle...");
                                    try {
                                      await fetch('/api/fno/strategy-deploy', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          strategyName: 'Short Straddle',
                                          index: res.symbol,
                                          stopLoss: 15,
                                          target: 30,
                                          optionType: 'Both'
                                        })
                                      });
                                      setToastNotification(`Successfully deployed Straddle on ${res.symbol}!`);
                                    } catch (err) {
                                      setToastNotification(`Failed to route order: ${err.message}`);
                                    }
                                  }}
                                  className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/20 rounded-lg text-[9px] font-bold text-purple-300 cursor-pointer"
                                >
                                  Short Straddle ⚡
                                </button>
                                <button
                                  onClick={async () => {
                                    setToastNotification(`Routing Long ATM CE on ${res.symbol}...`);
                                    try {
                                      await fetch('/api/fno/strategy-deploy', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          strategyName: 'Option Buying Crossover',
                                          index: res.symbol,
                                          stopLoss: 10,
                                          target: 25,
                                          optionType: 'CE'
                                        })
                                      });
                                      setToastNotification(`Long Call position opened on ${res.symbol}!`);
                                    } catch (err) {
                                      setToastNotification(`Failed: ${err.message}`);
                                    }
                                  }}
                                  className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/20 rounded-lg text-[9px] font-bold text-emerald-300 cursor-pointer"
                                >
                                  Buy Call 🟢
                                </button>
                                <button
                                  onClick={async () => {
                                    setToastNotification(`Routing Long ATM PE on ${res.symbol}...`);
                                    try {
                                      await fetch('/api/fno/strategy-deploy', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          strategyName: 'Option Buying Breakdown',
                                          index: res.symbol,
                                          stopLoss: 10,
                                          target: 25,
                                          optionType: 'PE'
                                        })
                                      });
                                      setToastNotification(`Long Put position opened on ${res.symbol}!`);
                                    } catch (err) {
                                      setToastNotification(`Failed: ${err.message}`);
                                    }
                                  }}
                                  className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/20 rounded-lg text-[9px] font-bold text-rose-300 cursor-pointer"
                                >
                                  Buy Put 🔴
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
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
                Configure indicators JSON, run simulation queries against MongoDB cached candles, and analyze visual TradingView charts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Left/Main Column: Configuration & Parameters */}
            <div className="xl:col-span-1 flex flex-col gap-6">
              <Card className="glass-panel border-0 ring-0 p-5 flex flex-col gap-4">
                <CardHeader className="p-0 border-b border-white/5 pb-3 flex flex-row items-center gap-2">
                  <Sliders className="h-5 w-5 text-indigo-400" />
                  <CardTitle className="font-display font-semibold text-sm text-white">Backtest Configuration</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex flex-col gap-4 mt-2">
                  <form onSubmit={handleRunBacktest} className="flex flex-col gap-4">
                    {/* Stock Dropdown */}
                    <div className="flex flex-col gap-1.5 text-xs">
                      <label className="text-slate-400 font-semibold">Cached Database Stock</label>
                      <Select value={backtestSymbol} onValueChange={(val) => {
                        setBacktestSymbol(val);
                        const st = availableStocks.find(s => s.symbol === val);
                        if (st && st.intervals && st.intervals.length > 0) {
                          setBacktestInterval(st.intervals[0]);
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

                    {/* Timeframe Interval */}
                    <div className="flex flex-col gap-1.5 text-xs">
                      <label className="text-slate-400 font-semibold">Timeframe Interval</label>
                      <Select value={backtestInterval} onValueChange={setBacktestInterval}>
                        <SelectTrigger className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 text-xs h-auto text-white focus:ring-0">
                          <SelectValue placeholder="Select Interval" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950 border-white/10 text-white text-xs">
                          {(() => {
                            const activeStock = availableStocks.find(s => s.symbol === backtestSymbol);
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

                    <div className="grid grid-cols-2 gap-3">
                      {/* From Date */}
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">From Date</label>
                        <input 
                          type="date"
                          value={backtestFromDate}
                          onChange={(e) => setBacktestFromDate(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                        />
                      </div>

                      {/* To Date */}
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">To Date</label>
                        <input 
                          type="date"
                          value={backtestToDate}
                          onChange={(e) => setBacktestToDate(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Capital */}
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">Initial Capital (₹)</label>
                        <input 
                          type="number"
                          value={backtestCapital}
                          onChange={(e) => setBacktestCapital(parseFloat(e.target.value) || 0)}
                          className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                        />
                      </div>

                      {/* Leverage */}
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">Leverage Power</label>
                        <input 
                          type="number"
                          value={backtestLeverage}
                          onChange={(e) => setBacktestLeverage(parseFloat(e.target.value) || 0)}
                          className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-xs text-center"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center">
                      {/* Target Margin % */}
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="text-slate-400 font-semibold">Target Margin %</label>
                        <input 
                          type="number"
                          value={backtestMarginPct}
                          onChange={(e) => setBacktestMarginPct(parseFloat(e.target.value) || 0)}
                          className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-white focus:outline-none text-xs text-center"
                        />
                      </div>

                      {/* Allow Short Positions */}
                      <div className="flex items-center gap-2 cursor-pointer select-none mt-4">
                        <input 
                          type="checkbox"
                          id="chart-allow-shorting"
                          checked={backtestAllowShorting}
                          onChange={(e) => setBacktestAllowShorting(e.target.checked)}
                          className="h-4 w-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="chart-allow-shorting" className="text-slate-300 font-semibold text-xs cursor-pointer">Allow Shorts</label>
                      </div>
                    </div>

                    {/* Interactive Form for Indicators */}
                    <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-3">
                      <div className="flex flex-col gap-1 text-[11px]">
                        <label className="text-slate-400 font-semibold">Fast EMA</label>
                        <input 
                          type="number" 
                          value={fastEmaPeriod}
                          onChange={(e) => setFastEmaPeriod(parseInt(e.target.value) || 9)}
                          className="bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-white text-center focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-[11px]">
                        <label className="text-slate-400 font-semibold">Slow EMA</label>
                        <input 
                          type="number" 
                          value={slowEmaPeriod}
                          onChange={(e) => setSlowEmaPeriod(parseInt(e.target.value) || 21)}
                          className="bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-white text-center focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-[11px]">
                        <label className="text-slate-400 font-semibold">RSI Period</label>
                        <input 
                          type="number" 
                          value={rsiPeriod}
                          onChange={(e) => setRsiPeriod(parseInt(e.target.value) || 14)}
                          className="bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-white text-center focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-[11px]">
                      <label className="text-slate-400 font-semibold">Buy Condition</label>
                      <input 
                        type="text" 
                        value={buySignalExpr}
                        onChange={(e) => setBuySignalExpr(e.target.value)}
                        className="bg-black/35 border border-white/5 rounded-xl px-3 py-1.5 text-white focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1 text-[11px]">
                      <label className="text-slate-400 font-semibold">Sell Condition</label>
                      <input 
                        type="text" 
                        value={sellSignalExpr}
                        onChange={(e) => setSellSignalExpr(e.target.value)}
                        className="bg-black/35 border border-white/5 rounded-xl px-3 py-1.5 text-white focus:outline-none"
                      />
                    </div>

                    <Button 
                      type="submit"
                      disabled={backtestLoading}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 h-auto border-0 cursor-pointer"
                    >
                      {backtestLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Run Backtest & Load Chart</span>
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: TradingView Chart, Metrics & Detailed Candle Table */}
            <div className="xl:col-span-2 flex flex-col gap-6">
              {/* TradingView Widget Card */}
              {backtestSymbol && (
                <Card className="glass-panel border-0 ring-0 p-5 flex flex-col gap-3">
                  <CardHeader className="p-0 border-b border-white/5 pb-3 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-indigo-400" />
                      <CardTitle className="font-display font-semibold text-sm text-white">TradingView Historical Chart: {backtestSymbol}</CardTitle>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Candlestick Feed</span>
                  </CardHeader>
                  <CardContent className="p-0 mt-3 h-[450px] rounded-xl overflow-hidden bg-black/45 border border-white/5 relative">
                    <TradingViewWidget 
                      symbol={backtestSymbol}
                      interval={backtestInterval === 'day' ? 'D' : backtestInterval === '60minute' ? '60' : backtestInterval === '30minute' ? '15' : backtestInterval === '15minute' ? '15' : backtestInterval === '5minute' ? '5' : '1'}
                      showEMA9={true}
                      showEMA21={true}
                      showBB={false}
                      trades={backtestResults?.trades || []}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Backtest Results Cards */}
              {backtestResults && (
                <Card className="glass-panel border-0 ring-0 p-5 flex flex-col gap-4">
                  <CardHeader className="p-0 border-b border-white/5 pb-3 flex flex-row items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-400" />
                    <CardTitle className="font-display font-semibold text-sm text-white">Backtest Simulation Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col gap-4 mt-2">
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
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-semibold">Strategy Benchmark</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                        <span className="text-slate-500 uppercase font-bold text-[8px] block">Max Drawdown</span>
                        <span className="text-sm font-bold text-rose-400 block mt-0.5">{backtestResults.summary?.maxDrawdownPct?.toFixed(2)}%</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-semibold">Peak-to-Trough risk</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                        <span className="text-slate-500 uppercase font-bold text-[8px] block">Sharpe Ratio</span>
                        <span className="text-sm font-bold text-indigo-300 block mt-0.5">{backtestResults.summary?.sharpeRatio?.toFixed(2)}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-semibold">Risk-adjusted return</span>
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
                  </CardContent>
                </Card>
              )}

              {/* Detailed Candle Database Table */}
              <Card className="glass-panel border-0 ring-0 p-5">
                <CardContent className="p-0">
                  <BacktestPlatform 
                    candles={backtestCandles} 
                    symbol={backtestSymbol} 
                    interval={backtestInterval} 
                    trades={backtestResults?.trades || []}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
      </div> {/* Closes flex-1 flex flex-col wrapper */}
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

// Helper to resolve TradingView compatible symbols for F&O, indices, and derivatives
const resolveTradingViewSymbol = (exchange, symbol) => {
  if (!symbol) return '';
  const cleanSymbol = symbol.replace(/\s+/g, '').toUpperCase();
  
  // Custom index mappings
  if (cleanSymbol === 'NIFTY50' || cleanSymbol === 'NIFTY') return 'NSE:NIFTY';
  if (cleanSymbol === 'NIFTYBANK' || cleanSymbol === 'BANKNIFTY') return 'NSE:BANKNIFTY';
  if (cleanSymbol === 'FINNIFTY') return 'NSE:FINNIFTY';
  if (cleanSymbol === 'MIDCPNIFTY') return 'NSE:MIDCPNIFTY';

  // Option / Future regex to extract underlying
  // Matches: RELIANCE26JUL2500CE, NIFTY26JUL22000PE, RELIANCE26JULFUT, etc.
  const monthRegex = /(?:24|25|26|27)(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i;
  const match = cleanSymbol.match(monthRegex);
  if (match) {
    const idx = cleanSymbol.indexOf(match[0]);
    if (idx > 0) {
      const underlying = cleanSymbol.substring(0, idx);
      return `NSE:${underlying}`;
    }
  }

  // Fallback for options/futures ending in CE/PE/FUT without standard year prefix
  if (cleanSymbol.endsWith('CE') || cleanSymbol.endsWith('PE') || cleanSymbol.endsWith('FUT')) {
    const cleaned = cleanSymbol.replace(/\d+.*$/, '').replace(/FUT$/, '');
    if (cleaned) {
      return `NSE:${cleaned}`;
    }
  }

  // Standard fallback
  const ex = (exchange || 'NSE').toUpperCase();
  return `${ex}:${cleanSymbol}`;
};

// EMA Calculation Utility
// EMA Calculation Utility
const calculateEMA = (data, period) => {
  const k = 2 / (period + 1);
  let emaArray = [];
  let ema = data[0].close;
  emaArray.push({ time: data[0].time, value: ema });
  for (let i = 1; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    emaArray.push({ time: data[i].time, value: ema });
  }
  return emaArray;
};

// Bollinger Bands Calculation Utility
const calculateBollingerBands = (data, period = 20, multiplier = 2) => {
  if (!data || data.length < period) return [];
  const bands = [];
  
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, c) => acc + c.close, 0);
    const middle = sum / period;
    
    const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    bands.push({
      time: data[i].time,
      middle: middle,
      upper: middle + multiplier * stdDev,
      lower: middle - multiplier * stdDev
    });
  }
  
  return bands;
};

// List of all standard TradingView studies mapped to their internal studies IDs
const ALL_INDICATORS = [
  { name: "9 EMA (Blue)", id: "ema9" },
  { name: "21 EMA (Orange)", id: "ema21" },
  { name: "Bollinger Bands", id: "bb" }
];

// Parameterized TradingView Widget Component using lightweight-charts
const TradingViewWidget = React.memo(({ symbol, interval, quote, showEMA9, showEMA21, showBB, instrumentToken, buyPrice, sellPrice, trades = [] }) => {
  const containerRef = useRef();
  const chartRef = useRef();
  const candlestickSeriesRef = useRef();
  const currentBarRef = useRef(null);
  const candlesListRef = useRef([]);
  const ema9SeriesRef = useRef(null);
  const ema21SeriesRef = useRef(null);
  const ema9DataRef = useRef([]);
  const ema21DataRef = useRef([]);
  const bbUpperSeriesRef = useRef(null);
  const bbMiddleSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);
  const markersApiRef = useRef(null);
  const [noData, setNoData] = useState(false);
  const savePendingRef = useRef(null);
  const lastSaveTimeRef = useRef(0);

  // Throttled function to save current live candle to MongoDB
  const triggerSaveToDb = useCallback((candleToSave) => {
    if (!instrumentToken || !candleToSave) return;
    const now = Date.now();
    const cleanSymbol = symbol ? symbol.toUpperCase() : 'INFY';
    
    let kiteInterval = '15minute';
    if (interval === '1') kiteInterval = 'minute';
    else if (interval === '5') kiteInterval = '5minute';
    else if (interval === '15') kiteInterval = '15minute';
    else if (interval === '60') kiteInterval = '60minute';
    else if (interval === 'D') kiteInterval = 'day';

    const payload = {
      symbol: cleanSymbol,
      instrumentToken: Number(instrumentToken),
      interval: kiteInterval,
      candle: candleToSave
    };

    const performSave = async () => {
      try {
        await fetch('/api/history/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        lastSaveTimeRef.current = Date.now();
      } catch (err) {
        console.error('[TradingViewWidget] Failed to save live candle:', err.message);
      }
    };

    if (now - lastSaveTimeRef.current > 3000) {
      if (savePendingRef.current) {
        clearTimeout(savePendingRef.current);
        savePendingRef.current = null;
      }
      performSave();
    } else {
      if (!savePendingRef.current) {
        savePendingRef.current = setTimeout(() => {
          performSave();
          savePendingRef.current = null;
        }, 3000);
      }
    }
  }, [symbol, interval, instrumentToken]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Map interval from '15' or '1' or '5' to Kite collection interval
    let kiteInterval = '15minute';
    if (interval === '1') kiteInterval = 'minute';
    else if (interval === '5') kiteInterval = '5minute';
    else if (interval === '15') kiteInterval = '15minute';
    else if (interval === '60') kiteInterval = '60minute';
    else if (interval === 'D') kiteInterval = 'day';

    // Clean symbol (strip exchange prefix)
    const cleanSymbol = symbol ? symbol.toUpperCase().replace(/^(NSE|BSE|MCX|NCDEX):/, '') : 'INFY';

    let active = true;
    let chartInstance = null;
    let resizeObserverInstance = null;

    async function loadData() {
      try {
        const res = await fetch(`/api/history?symbol=${cleanSymbol}&interval=${kiteInterval}`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();

        if (!active) return;

        if (!data || data.length === 0) {
          setNoData(true);
          return;
        }

        setNoData(false);

        // Clear container
        containerRef.current.innerHTML = '';

        // Create Chart
        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth || 400,
          height: containerRef.current.clientHeight || 380,
          layout: {
            background: { color: '#0B0F19' },
            textColor: '#94A3B8',
          },
          grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
          },
          crosshair: {
            mode: 0,
          },
          localization: {
            timeFormatter: (time) => {
              const date = new Date(time * 1000);
              return date.toLocaleString('en-US', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
            }
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time, tickMarkType, locale) => {
              const date = new Date(time * 1000);
              const options = { timeZone: 'Asia/Kolkata' };
              
              if (tickMarkType === 0) { // Year
                return date.toLocaleString(locale || 'en-US', { ...options, year: 'numeric' });
              } else if (tickMarkType === 1) { // Month
                return date.toLocaleString(locale || 'en-US', { ...options, month: 'short' });
              } else if (tickMarkType === 2) { // Day
                return date.toLocaleString(locale || 'en-US', { ...options, day: 'numeric', month: 'short' });
              } else { // Time
                return date.toLocaleString(locale || 'en-US', { 
                  ...options, 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  hour12: false 
                });
              }
            }
          },
        });

        chartInstance = chart;

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#10b981',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
        });

        candlestickSeriesRef.current = candlestickSeries;
        markersApiRef.current = createSeriesMarkers(candlestickSeries);
        const lastCandle = data[data.length - 1];
        currentBarRef.current = {
          time: lastCandle.time,
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close
        };

        candlesListRef.current = [...data];

        candlestickSeries.setData(data);
        chart.timeScale().fitContent();

        // Add horizontal price lines for entry (taken price) and exit (sold price)
        if (buyPrice && buyPrice > 0) {
          candlestickSeries.createPriceLine({
            price: buyPrice,
            color: '#3b82f6', // blue
            lineWidth: 2,
            lineStyle: 2, // dashed
            axisLabelVisible: true,
            title: `Taken: ₹${buyPrice.toFixed(2)}`,
          });
        }

        if (sellPrice && sellPrice > 0) {
          candlestickSeries.createPriceLine({
            price: sellPrice,
            color: '#ef4444', // red
            lineWidth: 2,
            lineStyle: 2, // dashed
            axisLabelVisible: true,
            title: `Sold: ₹${sellPrice.toFixed(2)}`,
          });
        }

        // Calculate and add EMA 9 overlay if checked
        if (showEMA9) {
          const ema9Data = calculateEMA(data, 9);
          ema9DataRef.current = ema9Data;
          
          if (ema9Data.length > 0) {
            const ema9Series = chart.addSeries(LineSeries, {
              color: '#3b82f6', // blue
              lineWidth: 1.5,
              title: '9 EMA',
              lastValueVisible: false,
              priceLineVisible: false
            });
            ema9Series.setData(ema9Data);
            ema9SeriesRef.current = ema9Series;
          }
        }

        // Calculate and add EMA 21 overlay if checked
        if (showEMA21) {
          const ema21Data = calculateEMA(data, 21);
          ema21DataRef.current = ema21Data;
          
          if (ema21Data.length > 0) {
            const ema21Series = chart.addSeries(LineSeries, {
              color: '#f97316', // orange
              lineWidth: 1.5,
              title: '21 EMA',
              lastValueVisible: false,
              priceLineVisible: false
            });
            ema21Series.setData(ema21Data);
            ema21SeriesRef.current = ema21Series;
          }
        }

        // Calculate and add Bollinger Bands overlays if checked
        if (showBB) {
          const bbData = calculateBollingerBands(data, 20, 2);
          
          if (bbData.length > 0) {
            const bbUpperSeries = chart.addSeries(LineSeries, {
              color: 'rgba(239, 68, 68, 0.45)', // semi-transparent red
              lineWidth: 1.2,
              title: 'BB Upper',
              lastValueVisible: false,
              priceLineVisible: false
            });
            bbUpperSeries.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
            bbUpperSeriesRef.current = bbUpperSeries;
            
            const bbMiddleSeries = chart.addSeries(LineSeries, {
              color: 'rgba(234, 179, 8, 0.45)', // semi-transparent yellow
              lineWidth: 1.2,
              lineStyle: 2, // dashed
              title: 'BB Middle',
              lastValueVisible: false,
              priceLineVisible: false
            });
            bbMiddleSeries.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
            bbMiddleSeriesRef.current = bbMiddleSeries;

            const bbLowerSeries = chart.addSeries(LineSeries, {
              color: 'rgba(16, 185, 129, 0.45)', // semi-transparent green
              lineWidth: 1.2,
              title: 'BB Lower',
              lastValueVisible: false,
              priceLineVisible: false
            });
            bbLowerSeries.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
            bbLowerSeriesRef.current = bbLowerSeries;
          }
        }

        // Use ResizeObserver to dynamically update chart dimensions when parent/grid layout changes
        const resizeObserver = new ResizeObserver((entries) => {
          if (!entries || entries.length === 0) return;
          const { width, height } = entries[0].contentRect;
          if (width > 0 && height > 0) {
            chart.applyOptions({ width, height });
          }
        });
        resizeObserver.observe(containerRef.current);
        resizeObserverInstance = resizeObserver;

      } catch (err) {
        console.error('Error rendering lightweight chart:', err);
        if (active) setNoData(true);
      }
    }

    loadData();

    return () => {
      active = false;
      if (resizeObserverInstance) {
        resizeObserverInstance.disconnect();
      }
      if (chartInstance) {
        chartInstance.remove();
      }
      candlestickSeriesRef.current = null;
      markersApiRef.current = null;
      ema9SeriesRef.current = null;
      ema21SeriesRef.current = null;
      ema9DataRef.current = [];
      ema21DataRef.current = [];
      bbUpperSeriesRef.current = null;
      bbMiddleSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
      if (savePendingRef.current) {
        clearTimeout(savePendingRef.current);
      }
    };
  }, [symbol, interval, showEMA9, showEMA21, showBB, buyPrice, sellPrice]);

  useEffect(() => {
    if (!markersApiRef.current) return;
    
    if (trades && trades.length > 0) {
      const markers = [];
      trades.forEach(trade => {
        const entrySec = Math.floor(new Date(trade.entryTime).getTime() / 1000);
        const exitSec = Math.floor(new Date(trade.exitTime).getTime() / 1000);
        
        markers.push({
          time: entrySec,
          position: trade.direction === 'LONG' ? 'belowBar' : 'aboveBar',
          color: trade.direction === 'LONG' ? '#10b981' : '#ef4444',
          shape: trade.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
          text: `${trade.direction === 'LONG' ? 'BUY' : 'SELL'} @ ₹${trade.entryPrice.toFixed(1)}`
        });
        
        markers.push({
          time: exitSec,
          position: trade.direction === 'LONG' ? 'aboveBar' : 'belowBar',
          color: '#a855f7',
          shape: trade.direction === 'LONG' ? 'arrowDown' : 'arrowUp',
          text: `EXIT @ ₹${trade.exitPrice.toFixed(1)}`
        });
      });
      
      markers.sort((a, b) => a.time - b.time);
      const validTimes = new Set(candlesListRef.current.map(d => d.time));
      const filteredMarkers = markers.filter(m => validTimes.has(m.time));
      markersApiRef.current.setMarkers(filteredMarkers);
    } else {
      markersApiRef.current.setMarkers([]);
    }
  }, [trades]);

  // Real-time update handler when new WebSocket quote tick arrives
  useEffect(() => {
    console.log(`[TradingViewWidget Debug] ${symbol} quote update received. ltp: ${quote?.ltp}, token: ${quote?.token}`);
    if (!candlestickSeriesRef.current || !quote || !quote.ltp) return;
    
    const quotePrice = quote.ltp;
    
    // Resolve interval in seconds
    let intervalSeconds = 15 * 60; // default 15m
    if (interval === '1') intervalSeconds = 60;
    else if (interval === '5') intervalSeconds = 5 * 60;
    else if (interval === '15') intervalSeconds = 15 * 60;
    else if (interval === '60') intervalSeconds = 60 * 60;
    else if (interval === 'D') intervalSeconds = 24 * 60 * 60;
    
    const quoteTime = quote.timestamp ? new Date(quote.timestamp).getTime() : (quote.lastTickTime || Date.now());
    const quoteTimeSec = Math.floor(quoteTime / 1000);
    const candleTimeSec = Math.floor(quoteTimeSec / intervalSeconds) * intervalSeconds;
    
    let currentBar = currentBarRef.current;
    let candles = candlesListRef.current;
    
    if (currentBar && currentBar.time === candleTimeSec) {
      // Update existing bar
      currentBar.high = Math.max(currentBar.high, quotePrice);
      currentBar.low = Math.min(currentBar.low, quotePrice);
      currentBar.close = quotePrice;
      
      if (candles.length > 0 && candles[candles.length - 1].time === candleTimeSec) {
        candles[candles.length - 1] = { ...currentBar };
      }
    } else {
      // Create new bar
      currentBar = {
        time: candleTimeSec,
        open: currentBar ? currentBar.close : quotePrice,
        high: quotePrice,
        low: quotePrice,
        close: quotePrice
      };
      
      if (candles.length > 0 && candles[candles.length - 1].time !== candleTimeSec) {
        candles.push({ ...currentBar });
      } else if (candles.length === 0) {
        candles.push({ ...currentBar });
      }
    }
    
    currentBarRef.current = currentBar;
    
    try {
      candlestickSeriesRef.current.update({
        time: currentBar.time,
        open: currentBar.open,
        high: currentBar.high,
        low: currentBar.low,
        close: currentBar.close
      });

      // Update EMA 9 in real-time
      if (showEMA9 && ema9SeriesRef.current) {
        const updateEmaSeries = (emaSeriesRef, emaDataRef, period) => {
          if (!emaSeriesRef.current) return;
          const k = 2 / (period + 1);
          const emaData = emaDataRef.current;
          
          if (emaData.length > 0) {
            const lastEmaIndex = emaData.length - 1;
            const lastEma = emaData[lastEmaIndex];
            
            if (lastEma.time === candleTimeSec) {
              const prevEmaVal = emaData.length > 1 ? emaData[emaData.length - 2].value : lastEma.value;
              const newVal = quotePrice * k + prevEmaVal * (1 - k);
              lastEma.value = newVal;
              emaSeriesRef.current.update({ time: candleTimeSec, value: newVal });
            } else {
              const prevEmaVal = lastEma.value;
              const newVal = quotePrice * k + prevEmaVal * (1 - k);
              const newEmaEntry = { time: candleTimeSec, value: newVal };
              emaData.push(newEmaEntry);
              emaSeriesRef.current.update(newEmaEntry);
            }
          }
        };
        updateEmaSeries(ema9SeriesRef, ema9DataRef, 9);
      }

      // Update EMA 21 in real-time
      if (showEMA21 && ema21SeriesRef.current) {
        const updateEmaSeries = (emaSeriesRef, emaDataRef, period) => {
          if (!emaSeriesRef.current) return;
          const k = 2 / (period + 1);
          const emaData = emaDataRef.current;
          
          if (emaData.length > 0) {
            const lastEmaIndex = emaData.length - 1;
            const lastEma = emaData[lastEmaIndex];
            
            if (lastEma.time === candleTimeSec) {
              const prevEmaVal = emaData.length > 1 ? emaData[emaData.length - 2].value : lastEma.value;
              const newVal = quotePrice * k + prevEmaVal * (1 - k);
              lastEma.value = newVal;
              emaSeriesRef.current.update({ time: candleTimeSec, value: newVal });
            } else {
              const prevEmaVal = lastEma.value;
              const newVal = quotePrice * k + prevEmaVal * (1 - k);
              const newEmaEntry = { time: candleTimeSec, value: newVal };
              emaData.push(newEmaEntry);
              emaSeriesRef.current.update(newEmaEntry);
            }
          }
        };
        updateEmaSeries(ema21SeriesRef, ema21DataRef, 21);
      }

      // Update Bollinger Bands in real-time
      if (showBB && bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
        const period = 20;
        const multiplier = 2;
        
        if (candles.length >= period) {
          const slice = candles.slice(candles.length - period);
          const sum = slice.reduce((acc, c) => acc + c.close, 0);
          const middle = sum / period;
          
          const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - middle, 2), 0) / period;
          const stdDev = Math.sqrt(variance);
          
          const upper = middle + multiplier * stdDev;
          const lower = middle - multiplier * stdDev;
          
          bbUpperSeriesRef.current.update({ time: candleTimeSec, value: upper });
          bbMiddleSeriesRef.current.update({ time: candleTimeSec, value: middle });
          bbLowerSeriesRef.current.update({ time: candleTimeSec, value: lower });
        }
      }

      // Save live candle state to MongoDB
      triggerSaveToDb(currentBar);

    } catch (err) {
      console.error('[TradingViewWidget] Real-time candle update failed:', err.message);
    }
  }, [quote, interval, showEMA9, showEMA21, showBB, triggerSaveToDb]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {noData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-slate-400 text-xs p-4 text-center">
          <span>⚠️ No local candles for <strong>{symbol}</strong> in MongoDB.</span>
          <span className="text-[10px] text-slate-500 mt-1">Run strategy scanner or backtests to cache market data.</span>
        </div>
      )}
    </div>
  );
});

// TradingViewMatrix Component
function TradingViewMatrix({ liveQuotes = {}, wsStatus = 'disconnected', subscribedTokens = [], addCustomTokenToSubscribe }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [selectedStudies, setSelectedStudies] = useState([]);
  const [indicatorSearch, setIndicatorSearch] = useState('');
  const [customTickers, setCustomTickers] = useState([]);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchError, setSearchError] = useState('');
  const [mode, setMode] = useState('open'); // 'open' | 'all'
  const [columns, setColumns] = useState(2); // Default to 2 columns (Double Row) for one-chart per stock card layout
  const [timeRemaining, setTimeRemaining] = useState(60);

  const fetchPositions = async () => {
    try {
      const res = await fetch('/api/positions');
      if (res.ok) {
        const data = await res.json();
        setPositions(data.net || []);
      }
    } catch (err) {
      console.error('Error fetching positions for TradingView matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          fetchPositions();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setLoading(true);
    fetchPositions();
    setTimeRemaining(60);
  };

  const handleAddCustomSymbol = async (e) => {
    e.preventDefault();
    setSearchError('');
    if (!searchSymbol.trim()) return;
    
    const cleanSym = searchSymbol.trim().toUpperCase();
    
    const isAlreadyInPositions = positions.some(p => p.tradingsymbol.toUpperCase() === cleanSym);
    const isAlreadyInCustom = customTickers.some(c => c.tradingsymbol === cleanSym);
    
    if (isAlreadyInPositions || isAlreadyInCustom) {
      setSearchError('Ticker already present in the matrix.');
      return;
    }
    
    try {
      const res = await fetch(`/api/resolve-symbol?symbol=${cleanSym}`);
      if (!res.ok) {
        throw new Error(`Symbol "${cleanSym}" not found`);
      }
      const data = await res.json();
      
      if (addCustomTokenToSubscribe) {
        addCustomTokenToSubscribe(data.instrument_token);
      }
      
      setCustomTickers(prev => [
        ...prev,
        {
          tradingsymbol: data.tradingsymbol,
          exchange: data.exchange,
          instrument_token: data.instrument_token,
          quantity: 0,
          pnl: 0,
          last_price: 0,
          isCustom: true
        }
      ]);
      setSearchSymbol('');
    } catch (err) {
      setSearchError(err.message || 'Error resolving symbol.');
    }
  };

  const handleRemoveCustomSymbol = (token) => {
    setCustomTickers(prev => prev.filter(c => c.instrument_token !== token));
  };

  const misPositions = positions.filter(p => p.product === 'MIS');
  const filteredPositions = mode === 'open' 
    ? misPositions.filter(p => p.quantity !== 0)
    : misPositions;

  const displayPositions = [...filteredPositions, ...customTickers];

  // Columns styling mapping for the cards grid
  let gridColsClass = 'grid-cols-1 xl:grid-cols-2';
  if (columns === 1) gridColsClass = 'grid-cols-1';
  else if (columns === 2) gridColsClass = 'grid-cols-1 xl:grid-cols-2';
  else if (columns === 3) gridColsClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="flex flex-col min-h-screen text-slate-100 bg-[#0b0f19] p-6 relative">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.06),transparent_50%)] pointer-events-none" />

      {/* Header Panel */}
      <div className="glass-panel p-5 mb-6 flex flex-col xl:flex-row items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-display font-bold text-white text-lg">▲</span>
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              MIS Live Charts Matrix
              <span className="text-[10px] uppercase font-bold bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">
                TradingView Embed Widget
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive 15-Minute chart matrices for active/intraday MIS stocks
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
          {/* Mode Switcher */}
          <div className="bg-black/30 p-1 rounded-xl border border-white/5 flex gap-1">
            <button
              onClick={() => setMode('open')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                mode === 'open'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Open Positions ({misPositions.filter(p => p.quantity !== 0).length})
            </button>
            <button
              onClick={() => setMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                mode === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Intraday MIS ({misPositions.length})
            </button>
          </div>

          {/* Grid Layout Switcher */}
          <div className="bg-black/30 p-1 rounded-xl border border-white/5 flex gap-1 items-center">
            <span className="text-[10px] text-slate-400 px-1 font-semibold">Columns:</span>
            {[1, 2, 3].map(cols => (
              <button
                key={cols}
                onClick={() => setColumns(cols)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  columns === cols
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {cols === 1 ? '1 Col' : cols === 2 ? '2 Cols' : '3 Cols'}
              </button>
            ))}
          </div>

          {/* Multi-Indicator Dropdown Selector */}
          <div className="relative">
            <button
              onClick={() => setShowIndicatorMenu(prev => !prev)}
              className="px-3.5 py-1.5 bg-black/30 hover:bg-black/50 text-white border border-white/5 rounded-xl transition-all cursor-pointer text-xs font-semibold flex items-center gap-2 relative z-30"
            >
              📊 Indicators ({selectedStudies.length})
              <ChevronDown className={`h-3 w-3 transition-transform ${showIndicatorMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showIndicatorMenu && (
              <>
                <div 
                  className="fixed inset-0 z-[9998]" 
                  onClick={() => setShowIndicatorMenu(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#0f1524] border border-white/10 p-3 shadow-2xl z-[9999] flex flex-col gap-2 glass-panel">
                  {/* Search Input */}
                  <input
                    type="text"
                    value={indicatorSearch}
                    onChange={(e) => setIndicatorSearch(e.target.value)}
                    placeholder="Search indicators..."
                    className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  
                  {/* Indicator Checklist List */}
                  <div className="max-h-60 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar pr-1">
                    {ALL_INDICATORS.filter(ind => 
                      ind.name.toLowerCase().includes(indicatorSearch.toLowerCase())
                    ).map(ind => {
                      const isSelected = selectedStudies.includes(ind.id);
                      return (
                        <label 
                          key={ind.id} 
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-indigo-600/20 text-indigo-300 font-semibold' 
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <span>{ind.name}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedStudies(prev => 
                                prev.includes(ind.id) 
                                  ? prev.filter(x => x !== ind.id) 
                                  : [...prev, ind.id]
                              );
                            }}
                            className="rounded border-white/10 text-indigo-600 focus:ring-0 h-3.5 w-3.5 cursor-pointer ml-2"
                          />
                        </label>
                      );
                    })}
                    {ALL_INDICATORS.filter(ind => 
                      ind.name.toLowerCase().includes(indicatorSearch.toLowerCase())
                    ).length === 0 && (
                      <span className="text-[11px] text-slate-500 text-center py-4">No indicators match search.</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Dynamic Ticker Search Bar */}
          <form onSubmit={handleAddCustomSymbol} className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5 relative">
            <input
              type="text"
              value={searchSymbol}
              onChange={(e) => {
                setSearchSymbol(e.target.value);
                setSearchError('');
              }}
              placeholder="Add Ticker (e.g. RELIANCE)"
              className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-44 font-medium"
            />
            <button
              type="submit"
              className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-md font-bold transition-all cursor-pointer"
            >
              Add
            </button>
            {searchError && (
              <span className="absolute left-0 -bottom-5 text-[9px] text-rose-400 font-semibold px-2 animate-pulse">
                ⚠️ {searchError}
              </span>
            )}
          </form>

          {/* Refresh Info */}
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-xl">
            <RefreshCw className={`h-3 w-3 text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Auto-refresh in <strong className="text-white font-mono">{timeRemaining}s</strong></span>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={handleManualRefresh}
            className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 rounded-xl transition-all cursor-pointer flex items-center justify-center"
            title="Refresh positions"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Return to Dashboard */}
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-xl transition-all cursor-pointer text-xs font-semibold"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* WebSocket Diagnostics Bar */}
      <div className="glass-panel p-3.5 mb-6 flex flex-wrap items-center justify-between gap-4 text-xs relative z-10 bg-indigo-950/20 border-indigo-500/10">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Kite WS Connection:</span>
          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wide flex items-center gap-1.5 ${
            wsStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            wsStatus === 'connecting' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              wsStatus === 'connected' ? 'bg-emerald-400' :
              wsStatus === 'connecting' ? 'bg-amber-400' :
              'bg-rose-400'
            }`} />
            {wsStatus.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Subscribed Instruments:</span>
          <span className="bg-black/30 px-2 py-1 rounded font-mono text-[11px] text-slate-300 border border-white/5 max-w-lg truncate" title={subscribedTokens.join(', ')}>
            {subscribedTokens.length > 0 ? subscribedTokens.join(', ') : 'None'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Matrix Ticker Count:</span>
          <span className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded font-bold">
            {displayPositions.length} Total
          </span>
        </div>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-20 glass-panel relative z-10">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mb-4" />
          <p className="text-slate-400 text-sm">Fetching live position data...</p>
        </div>
      ) : (
        <div className={`grid ${gridColsClass} gap-6 flex-1 relative z-10`}>
          {/* Active position charts */}
          {displayPositions.map((pos, idx) => {
            const isLong = pos.quantity > 0;
            const isClosed = pos.quantity === 0;
            const pnl = pos.pnl || 0;
            const exchange = pos.exchange || 'NSE';
            const tvSymbol = resolveTradingViewSymbol(exchange, pos.tradingsymbol);
            
            // Compute buy/sell prices for chart lines
            let buyPrice = 0;
            let sellPrice = 0;

            if (pos.quantity > 0) {
              // Active Long position: entry is buy_price or average_price
              buyPrice = pos.buy_price || pos.average_price || 0;
              if (pos.sell_quantity > 0) {
                sellPrice = pos.sell_price || 0;
              }
            } else if (pos.quantity < 0) {
              // Active Short position: entry is sell_price or average_price
              buyPrice = pos.sell_price || pos.average_price || 0;
              if (pos.buy_quantity > 0) {
                sellPrice = pos.buy_price || 0;
              }
            } else {
              // Closed position: show both entry and exit if we did trades
              if (pos.buy_quantity > 0 && pos.sell_quantity > 0) {
                buyPrice = pos.buy_price || pos.average_price || 0;
                sellPrice = pos.sell_price || 0;
              }
            }

            return (
              <Card key={idx} className="glass-panel border-0 ring-0 p-0 flex flex-col overflow-hidden h-full">
                <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between gap-2 bg-[#0f1524]/40">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white font-display">{pos.tradingsymbol}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pos.isCustom ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/20' : 'bg-white/10 text-slate-400'}`}>
                        {pos.isCustom ? 'CUSTOM' : pos.product}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      LTP: ₹{formatCurrency(pos.last_price || (liveQuotes[pos.instrument_token]?.ltp) || pos.average_price || 0)} | Qty: {pos.quantity}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-0.5">
                    {pos.isCustom ? (
                      <button
                        onClick={() => handleRemoveCustomSymbol(pos.instrument_token)}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                        title="Remove custom chart"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        <span className={`text-xs font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnl >= 0 ? '+' : ''}₹{formatCurrency(pnl)}
                        </span>
                        <a
                          href={`https://www.tradingview.com/symbols/${tvSymbol}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                        >
                          TradingView ↗
                        </a>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-1 bg-black/40 min-h-[380px] h-[420px]">
                  <TradingViewWidget 
                    symbol={tvSymbol} 
                    interval="15" 
                    quote={liveQuotes[pos.instrument_token]} 
                    showEMA9={selectedStudies.includes('ema9')} 
                    showEMA21={selectedStudies.includes('ema21')} 
                    showBB={selectedStudies.includes('bb')} 
                    instrumentToken={pos.instrument_token} 
                    buyPrice={buyPrice}
                    sellPrice={sellPrice}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// FnOTradingViewMatrix Component
function FnOTradingViewMatrix({ liveQuotes = {}, wsStatus = 'disconnected', subscribedTokens = [], addCustomTokenToSubscribe }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudies, setSelectedStudies] = useState(['ema9', 'ema21']);
  const [customTickers, setCustomTickers] = useState([]);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchError, setSearchError] = useState('');
  const [mode, setMode] = useState('open'); // 'open' | 'all'
  const [columns, setColumns] = useState(2);
  const [timeRemaining, setTimeRemaining] = useState(60);

  // F&O Strategy configuration states
  const [strategyPreset, setStrategyPreset] = useState('Bull Call Spread');
  const [underlyingIndex, setUnderlyingIndex] = useState('NIFTY');
  const [slPercent, setSlPercent] = useState('15');
  const [targetPercent, setTargetPercent] = useState('30');
  const [strategyLogs, setStrategyLogs] = useState([]);
  const [deploying, setDeploying] = useState(false);

  const fetchPositions = async () => {
    try {
      const res = await fetch('/api/positions?type=fno');
      if (res.ok) {
        const data = await res.json();
        setPositions(data.net || []);
      }
    } catch (err) {
      console.error('Error fetching positions for F&O matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          fetchPositions();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setLoading(true);
    fetchPositions();
    setTimeRemaining(60);
  };

  const handleDeployStrategy = async () => {
    setDeploying(true);
    setStrategyLogs([]);
    
    try {
      const response = await fetch('/api/fno/strategy-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyName: strategyPreset,
          index: underlyingIndex,
          stopLoss: parseFloat(slPercent) || 15,
          target: parseFloat(targetPercent) || 30,
          optionType: strategyPreset.includes('Put') ? 'PE' : 'CE'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Animate log messages one by one
        let currentLogIndex = 0;
        const intervalId = setInterval(() => {
          if (currentLogIndex < data.logs.length) {
            setStrategyLogs(prev => [...prev, data.logs[currentLogIndex]]);
            currentLogIndex++;
          } else {
            clearInterval(intervalId);
            setDeploying(false);
            fetchPositions(); // refresh positions after deploy
          }
        }, 800);
      } else {
        const errData = await response.json();
        setStrategyLogs([`Error deploying strategy: ${errData.error || 'Server error'}`]);
        setDeploying(false);
      }
    } catch (err) {
      setStrategyLogs([`Failed to deploy strategy: ${err.message}`]);
      setDeploying(false);
    }
  };

  const handleAddCustomSymbol = async (e) => {
    e.preventDefault();
    setSearchError('');
    if (!searchSymbol.trim()) return;
    
    const cleanSym = searchSymbol.trim().toUpperCase();
    
    const isAlreadyInPositions = positions.some(p => p.tradingsymbol.toUpperCase() === cleanSym);
    const isAlreadyInCustom = customTickers.some(c => c.tradingsymbol === cleanSym);
    
    if (isAlreadyInPositions || isAlreadyInCustom) {
      setSearchError('Ticker already present in the matrix.');
      return;
    }

    try {
      const res = await fetch(`/api/resolve-symbol?symbol=${cleanSym}`);
      if (!res.ok) {
        throw new Error(`Symbol "${cleanSym}" not found`);
      }
      const data = await res.json();
      
      if (addCustomTokenToSubscribe) {
        addCustomTokenToSubscribe(data.instrument_token);
      }
      
      setCustomTickers(prev => [
        ...prev,
        {
          tradingsymbol: data.tradingsymbol,
          exchange: data.exchange,
          instrument_token: data.instrument_token,
          quantity: 0,
          pnl: 0,
          last_price: 0,
          isCustom: true
        }
      ]);
      setSearchSymbol('');
    } catch (err) {
      setSearchError(err.message || 'Error resolving symbol.');
    }
  };

  const handleRemoveCustomSymbol = (token) => {
    setCustomTickers(prev => prev.filter(c => c.instrument_token !== token));
  };

  // Filter open or closed F&O positions
  const filteredPositions = mode === 'open' 
    ? positions.filter(p => p.quantity !== 0)
    : positions;

  const displayPositions = [...filteredPositions, ...customTickers];

  let gridColsClass = 'grid-cols-1 xl:grid-cols-2';
  if (columns === 1) gridColsClass = 'grid-cols-1';
  else if (columns === 2) gridColsClass = 'grid-cols-1 xl:grid-cols-2';
  else if (columns === 3) gridColsClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  const formatCurrency = (val) => {
    if (typeof val !== 'number' || isNaN(val)) return '0.00';
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const resolveTradingViewSymbol = (exchange, symbol) => {
    return `${exchange}:${symbol}`;
  };

  return (
    <div className="flex flex-col min-h-screen text-slate-100 bg-[#0b0f19] p-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.06),transparent_50%)] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Flame className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2">
              F&O Option Strategy Matrix
            </h1>
            <p className="text-xs text-slate-400">Monitor option premiums, underlying futures, and AI-deployed legs.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Grid columns presets */}
          <div className="flex bg-white/5 border border-white/5 p-1 rounded-xl gap-1">
            <button
              onClick={() => setColumns(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${columns === 1 ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Single
            </button>
            <button
              onClick={() => setColumns(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${columns === 2 ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Double
            </button>
            <button
              onClick={() => setColumns(3)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${columns === 3 ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Triple
            </button>
          </div>

          {/* Mode switch */}
          <div className="flex bg-white/5 border border-white/5 p-1 rounded-xl gap-1">
            <button
              onClick={() => setMode('open')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${mode === 'open' ? 'bg-purple-600/80 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Active Legs
            </button>
            <button
              onClick={() => setMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${mode === 'all' ? 'bg-purple-600/80 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              All Trades
            </button>
          </div>

          {/* Add custom underlying/strike ticker */}
          <form onSubmit={handleAddCustomSymbol} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Add symbol e.g. NIFTY26JUL22000CE"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                className="bg-white/5 hover:bg-white/[0.08] focus:bg-[#0f1524] border border-white/5 focus:border-purple-500/50 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all w-60"
              />
            </div>
            <button
              type="submit"
              className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-lg shadow-purple-600/15"
            >
              <Plus className="h-4 w-4" />
            </button>
            {searchError && (
              <span className="absolute mt-9 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] px-2 py-0.5 rounded-md z-20">
                ⚠️ {searchError}
              </span>
            )}
          </form>

          {/* Refresh Info */}
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-xl">
            <RefreshCw className={`h-3 w-3 text-purple-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Auto-refresh in <strong className="text-white font-mono">{timeRemaining}s</strong></span>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={handleManualRefresh}
            className="p-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border border-purple-500/20 rounded-xl transition-all cursor-pointer flex items-center justify-center"
            title="Refresh positions"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Return to Dashboard */}
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-xl transition-all cursor-pointer text-xs font-semibold"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Options Strategy Control Bar */}
      <div className="glass-panel p-4 mb-6 relative z-10 border-purple-500/10 bg-purple-950/5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2 font-display">
          <Brain className="h-4 w-4 text-purple-400" />
          AI F&O Options Strategy Deployment
        </h3>
        
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Options Strategy Preset</span>
            <select
              value={strategyPreset}
              onChange={(e) => setStrategyPreset(e.target.value)}
              className="bg-[#0f1524] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white cursor-pointer focus:border-purple-500/50 outline-none"
            >
              <option value="Bull Call Spread">Bull Call Spread (ATM Buy + OTM Sell)</option>
              <option value="Bear Put Spread">Bear Put Spread (ATM Buy + OTM Sell)</option>
              <option value="Short Straddle">Short Straddle (ATM Short CE + Short PE)</option>
              <option value="Iron Condor">Iron Condor (OTM Short CE/PE + OTM Buy Hedge)</option>
              <option value="Option Buying Breakout">AI Option Buying Breakout</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Index Underlying</span>
            <select
              value={underlyingIndex}
              onChange={(e) => setUnderlyingIndex(e.target.value)}
              className="bg-[#0f1524] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white cursor-pointer focus:border-purple-500/50 outline-none"
            >
              <option value="NIFTY">NIFTY 50</option>
              <option value="BANKNIFTY">NIFTY BANK</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 w-24">
            <span className="text-[10px] uppercase font-bold text-slate-400">Stop Loss (%)</span>
            <input
              type="number"
              value={slPercent}
              onChange={(e) => setSlPercent(e.target.value)}
              placeholder="e.g. 15"
              className="bg-[#0f1524] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white w-full outline-none focus:border-purple-500/50"
            />
          </div>

          <div className="flex flex-col gap-1 w-24">
            <span className="text-[10px] uppercase font-bold text-slate-400">Target (%)</span>
            <input
              type="number"
              value={targetPercent}
              onChange={(e) => setTargetPercent(e.target.value)}
              placeholder="e.g. 30"
              className="bg-[#0f1524] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white w-full outline-none focus:border-purple-500/50"
            />
          </div>

          <button
            onClick={handleDeployStrategy}
            disabled={deploying}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 cursor-pointer flex items-center gap-1.5"
          >
            {deploying ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Deploy Strategy via AI
          </button>
        </div>

        {strategyLogs.length > 0 && (
          <div className="mt-4 bg-black/40 border border-white/5 rounded-xl p-3.5 max-h-40 overflow-y-auto font-mono text-[10px] text-slate-300 flex flex-col gap-1.5 scrollbar-thin">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">
              <span>AI Execution Logs</span>
              <button 
                onClick={() => setStrategyLogs([])} 
                className="text-slate-400 hover:text-white"
              >
                Clear
              </button>
            </div>
            {strategyLogs.map((log, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-purple-400 flex-shrink-0">➜</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WebSocket Diagnostics Bar */}
      <div className="glass-panel p-3.5 mb-6 flex flex-wrap items-center justify-between gap-4 text-xs relative z-10 bg-purple-950/10 border-purple-500/10">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Kite WS Connection:</span>
          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wide flex items-center gap-1.5 ${
            wsStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            wsStatus === 'connecting' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              wsStatus === 'connected' ? 'bg-emerald-400' :
              wsStatus === 'connecting' ? 'bg-amber-400' :
              'bg-rose-400'
            }`} />
            {wsStatus.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Subscribed Instruments:</span>
          <span className="bg-black/30 px-2 py-1 rounded font-mono text-[11px] text-slate-300 border border-white/5 max-w-lg truncate" title={subscribedTokens.join(', ')}>
            {subscribedTokens.length > 0 ? subscribedTokens.join(', ') : 'None'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">F&O Contract Count:</span>
          <span className="bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded font-bold">
            {displayPositions.length} Total
          </span>
        </div>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-20 glass-panel relative z-10">
          <RefreshCw className="h-8 w-8 text-purple-500 animate-spin mb-4" />
          <p className="text-slate-400 text-sm">Fetching F&O position data...</p>
        </div>
      ) : displayPositions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-20 glass-panel relative z-10 bg-slate-900/30 text-center">
          <Flame className="h-10 w-10 text-purple-500/50 mb-3" />
          <p className="text-slate-300 font-semibold text-sm">No active F&O legs found.</p>
          <p className="text-slate-500 text-xs mt-1">Select a strategy preset and click 'Deploy Strategy' to get started.</p>
        </div>
      ) : (
        <div className={`grid ${gridColsClass} gap-6 flex-1 relative z-10`}>
          {displayPositions.map((pos, idx) => {
            const isLong = pos.quantity > 0;
            const isClosed = pos.quantity === 0;
            const pnl = pos.pnl || 0;
            const exchange = pos.exchange || 'NFO';
            const tvSymbol = resolveTradingViewSymbol(exchange, pos.tradingsymbol);
            
            let buyPrice = 0;
            let sellPrice = 0;

            if (pos.quantity > 0) {
              buyPrice = pos.buy_price || pos.average_price || 0;
              if (pos.sell_quantity > 0) {
                sellPrice = pos.sell_price || 0;
              }
            } else if (pos.quantity < 0) {
              buyPrice = pos.sell_price || pos.average_price || 0;
              if (pos.buy_quantity > 0) {
                sellPrice = pos.buy_price || 0;
              }
            } else {
              if (pos.buy_quantity > 0 && pos.sell_quantity > 0) {
                buyPrice = pos.buy_price || pos.average_price || 0;
                sellPrice = pos.sell_price || 0;
              }
            }

            return (
              <Card key={idx} className="glass-panel border-0 ring-0 p-0 flex flex-col overflow-hidden h-full">
                <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between gap-2 bg-[#0f1524]/40">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white font-display">{pos.tradingsymbol}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pos.isCustom ? 'bg-purple-600/30 text-purple-300 border border-purple-500/20' : 'bg-white/10 text-slate-400'}`}>
                        {pos.isCustom ? 'CUSTOM' : pos.product}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Premium LTP: ₹{formatCurrency(pos.last_price || (liveQuotes[pos.instrument_token]?.ltp) || pos.average_price || 0)} | Qty: {pos.quantity}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-0.5">
                    {pos.isCustom ? (
                      <button
                        onClick={() => handleRemoveCustomSymbol(pos.instrument_token)}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                        title="Remove custom chart"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        <span className={`text-xs font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnl >= 0 ? '+' : ''}₹{formatCurrency(pnl)}
                        </span>
                        <span className="text-[9px] text-purple-400 select-none">F&O Contract</span>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-1 bg-black/40 min-h-[380px] h-[420px]">
                  <TradingViewWidget 
                    symbol={tvSymbol} 
                    interval="15" 
                    quote={liveQuotes[pos.instrument_token]} 
                    showEMA9={true} 
                    showEMA21={true} 
                    showBB={false} 
                    instrumentToken={pos.instrument_token} 
                    buyPrice={buyPrice}
                    sellPrice={sellPrice}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
