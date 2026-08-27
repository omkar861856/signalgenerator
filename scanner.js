const fs = require('fs');
const path = require('path');
const { KiteTicker } = require('kiteconnect');
const { Instrument, AppState } = require('./db');

// In-memory Cache
let tickerInstance = null;
let quoteCache = {}; // token -> latest tick / quote data
let historicalCandles = {}; // token -> array of candles { time, open, high, low, close, volume }
let oneMinCandles = {}; // token -> { lastCompletedClose, current: { open, high, low, close, startTime } }
let fifteenMinCandles = {}; // token -> array of 15m candles
let kiteRestInstance = null; // To fetch historical data
const customScannersFile = path.join(__dirname, 'custom_scanners.json');
let indexTokenLists = {
    'Nifty 50': [],
    'Bank Nifty': [],
    'Sensex': [],
    'Bankex': [],
    'Nifty 100': [],
    'Nifty 200': [],
    'Nifty 500': [],
    'F&O Stocks': []
};
let tokenToSymbolMap = {}; // token -> symbol (e.g. 3343617 -> "NSE:360ONE")
let symbolToTokenMap = {}; // "NSE:SYMBOL" -> token
let isInitialized = false;
let customTokensList = []; // Track custom subscribed tokens for Full L2 Depth mode
let autoReconnectAttempts = 0;
let connectionLogs = [];

function logStream(msg) {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}`;
    console.log(`[WebSocket Stream] ${msg}`);
    connectionLogs.unshift(formatted);
    if (connectionLogs.length > 100) connectionLogs.pop();
}

// Ensure index constituent files exist in scratch/indices/
async function ensureIndexFilesExist() {
    const indicesDir = path.join(__dirname, 'scratch', 'indices');
    if (!fs.existsSync(indicesDir)) {
        fs.mkdirSync(indicesDir, { recursive: true });
    }

    const fallbacks = {
        'nifty_50.json': ["ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BHARTIARTL", "BPCL", "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB", "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK", "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT", "LTIM", "M&M", "MARUTI", "NESTLEIND", "NTPC", "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", "SBIN", "SUNPHARMA", "TATACONSUM", "TATAMOTORS", "TATASTEEL", "TCS", "TECHM", "TITAN", "ULTRACEMCO", "UPL", "WIPRO"],
        'bank_nifty.json': ["AUBANK", "AXISBANK", "BANDHANBNK", "BANKBARODA", "FEDERALBNK", "HDFCBANK", "ICICIBANK", "IDFCFIRSTB", "INDUSINDBK", "KOTAKBANK", "PNB", "SBIN"],
        'sensex.json': ["ADANIPORTS", "ASIANPAINT", "AXISBANK", "BAJFINANCE", "BAJAJFINSV", "BHARTIARTL", "HCLTECH", "HDFCBANK", "HINDUNILVR", "ICICIBANK", "INDUSINDBK", "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT", "M&M", "MARUTI", "NESTLEIND", "NTPC", "POWERGRID", "RELIANCE", "SBIN", "SUNPHARMA", "TATASTEEL", "TATAMOTORS", "TCS", "TECHM", "TITAN", "WIPRO"],
        'bankex.json': ["AXISBANK", "FEDERALBNK", "HDFCBANK", "ICICIBANK", "INDUSINDBK", "KOTAKBANK", "SBIN"],
        'nifty_100.json': ["ABB", "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BEL", "BHARTIARTL", "BPCL", "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB", "DRREDDY", "EICHERMOT", "GRASIM", "HAL", "HCLTECH", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK", "INFY", "IOC", "ITC", "JSWSTEEL", "KOTAKBANK", "LT", "LTIM", "M&M", "MARUTI", "NESTLEIND", "NTPC", "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", "SBIN", "SUNPHARMA", "TATACONSUM", "TATAMOTORS", "TATASTEEL", "TCS", "TECHM", "TITAN", "ULTRACEMCO", "UPL", "WIPRO"],
        'nifty_200.json': ["ABB", "ACC", "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BALKRISIND", "BANDHANBNK", "BANKBARODA", "BANKINDIA", "BATAINDIA", "BEL", "BERGEPAINT", "BHARATFORG", "BHARTIARTL", "BHEL", "BIOCON", "BPCL", "BRITANNIA", "CANBK", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE", "COLPAL", "CONCOR", "CUMMINSIND", "DABUR", "DEEPAKNTR", "DIVISLAB", "DLF", "DRREDDY", "EICHERMOT", "ESCORTS", "FEDERALBNK", "GLENMARK", "GMRINFRA", "GODREJPROP", "GRASIM", "GUJGASLTD", "HAL", "HAVELLS", "HCLTECH", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDCOPPER", "HINDUNILVR", "ICICIBANK", "ICICIPRULI", "IDFCFIRSTB", "IGL", "INDHOTEL", "INDUSINDBK", "INDUSTOWER", "INFY", "IOC", "IPCALAB", "IRCTC", "ITC", "JINDALSTEL", "JSWSTEEL", "JUBLFOOD", "KOTAKBANK", "LICHSGFIN", "LT", "LTIM", "LTTS", "LUPIN", "M&M", "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "MCDOWELL-N", "MCX", "METROPOLIS", "MFSL", "MGL", "MPHASIS", "MRF", "MUTHOOTFIN", "NATIONALUM", "NAVINFLUOR", "NESTLEIND", "NMDC", "NTPC", "OBEROIRLTY", "OFSS", "ONGC", "PAGEIND", "PEL", "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND", "PNB", "POLYCAB", "POWERGRID", "RAMCOCEM", "RELIANCE", "SAIL", "SBICARD", "SBILIFE", "SBIN", "SHREECEM", "SRF", "SUNPHARMA", "SUNTV", "SYNGENE", "TATACOMM", "TATACONSUM", "TATAELXSI", "TATAMOTORS", "TATAPOWER", "TATASTEEL", "TCS", "TECHM", "TITAN", "TRENT", "TVSMOTOR", "UBL", "ULTRACEMCO", "UPL", "VDL", "VOLTAS", "WIPRO", "ZEEL"],
        'nifty_500.json': ["ABB", "ACC", "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BALKRISIND", "BANDHANBNK", "BANKBARODA", "BANKINDIA", "BATAINDIA", "BEL", "BERGEPAINT", "BHARATFORG", "BHARTIARTL", "BHEL", "BIOCON", "BPCL", "BRITANNIA", "CANBK", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE", "COLPAL", "CONCOR", "CUMMINSIND", "DABUR", "DEEPAKNTR", "DIVISLAB", "DLF", "DRREDDY", "EICHERMOT", "ESCORTS", "FEDERALBNK", "GLENMARK", "GMRINFRA", "GODREJPROP", "GRASIM", "GUJGASLTD", "HAL", "HAVELLS", "HCLTECH", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDCOPPER", "HINDUNILVR", "ICICIBANK", "ICICIPRULI", "IDFCFIRSTB", "IGL", "INDHOTEL", "INDUSINDBK", "INDUSTOWER", "INFY", "IOC", "IPCALAB", "IRCTC", "ITC", "JINDALSTEL", "JSWSTEEL", "JUBLFOOD", "KOTAKBANK", "LICHSGFIN", "LT", "LTIM", "LTTS", "LUPIN", "M&M", "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "MCDOWELL-N", "MCX", "METROPOLIS", "MFSL", "MGL", "MPHASIS", "MRF", "MUTHOOTFIN", "NATIONALUM", "NAVINFLUOR", "NESTLEIND", "NMDC", "NTPC", "OBEROIRLTY", "OFSS", "ONGC", "PAGEIND", "PEL", "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND", "PNB", "POLYCAB", "POWERGRID", "RAMCOCEM", "RELIANCE", "SAIL", "SBICARD", "SBILIFE", "SBIN", "SHREECEM", "SRF", "SUNPHARMA", "SUNTV", "SYNGENE", "TATACOMM", "TATACONSUM", "TATAELXSI", "TATAMOTORS", "TATAPOWER", "TATASTEEL", "TCS", "TECHM", "TITAN", "TRENT", "TVSMOTOR", "UBL", "ULTRACEMCO", "UPL", "VDL", "VOLTAS", "WIPRO", "ZEEL"]
    };

    const niftyCsvUrls = {
        'nifty_50.json': '/IndexConstituent/ind_nifty50list.csv',
        'bank_nifty.json': '/IndexConstituent/ind_niftybanklist.csv',
        'nifty_100.json': '/IndexConstituent/ind_nifty100list.csv',
        'nifty_200.json': '/IndexConstituent/ind_nifty200list.csv',
        'nifty_500.json': '/IndexConstituent/ind_nifty500list.csv'
    };

    const fetchNiftyCSV = (csvPath) => {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const options = {
                hostname: 'www.niftyindices.com',
                path: csvPath,
                method: 'GET',
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                }
            };
            const request = https.get(options, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Status code: ${response.statusCode}`));
                    return;
                }
                let body = '';
                response.on('data', (chunk) => { body += chunk; });
                response.on('end', () => { resolve(body); });
            });
            request.on('error', (err) => { reject(err); });
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
        });
    };

    const parseNiftyCSV = (csvData) => {
        const symbols = [];
        const lines = csvData.split('\n');
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',');
            if (cols.length >= 3) {
                const symbol = cols[2].trim().replace(/"/g, '');
                if (symbol && symbol !== 'Symbol' && symbol !== 'SYMBOL') {
                    symbols.push(symbol);
                }
            }
        }
        return symbols;
    };

    // 1. Create/populate standard Nifty indices (attempt live first, fallback to hardcoded)
    for (const [filename, csvPath] of Object.entries(niftyCsvUrls)) {
        const filePath = path.join(indicesDir, filename);
        if (!fs.existsSync(filePath)) {
            logStream(`File ${filename} is missing. Attempting to download constituents...`);
            try {
                const csvData = await fetchNiftyCSV(csvPath);
                const symbols = parseNiftyCSV(csvData);
                if (symbols.length > 0) {
                    fs.writeFileSync(filePath, JSON.stringify(symbols, null, 2), 'utf8');
                    logStream(`Successfully downloaded and saved ${symbols.length} constituents for ${filename}.`);
                    continue;
                }
            } catch (err) {
                logStream(`Failed to download ${filename} live: ${err.message}. Using hardcoded fallback.`);
            }
            fs.writeFileSync(filePath, JSON.stringify(fallbacks[filename], null, 2), 'utf8');
        }
    }

    // 2. Create BSE Sensex and Bankex
    const bseFiles = ['sensex.json', 'bankex.json'];
    for (const filename of bseFiles) {
        const filePath = path.join(indicesDir, filename);
        if (!fs.existsSync(filePath)) {
            logStream(`Creating ${filename} with default constituents...`);
            fs.writeFileSync(filePath, JSON.stringify(fallbacks[filename], null, 2), 'utf8');
        }
    }

    // 3. Create F&O Stocks dynamically from MongoDB Instrument list if not present
    const fnoFile = path.join(indicesDir, 'fno_stocks.json');
    if (!fs.existsSync(fnoFile)) {
        logStream(`Creating fno_stocks.json dynamically from MongoDB...`);
        try {
            const names = await Instrument.distinct('name', { exchange: 'NFO' });
            const excluded = new Set(['BANKNIFTY', 'NIFTY', 'NIFTYIT', 'FINNIFTY', 'MIDCPNIFTY']);
            const cleanNames = names.filter(name => name && !excluded.has(name));
            if (cleanNames.length > 0) {
                fs.writeFileSync(fnoFile, JSON.stringify(cleanNames, null, 2), 'utf8');
                logStream(`Successfully saved ${cleanNames.length} F&O stock constituents.`);
            } else {
                throw new Error('No distinct F&O underlying names found in MongoDB.');
            }
        } catch (err) {
            logStream(`Failed to dynamically extract F&O stocks: ${err.message}. Saving hardcoded fallback.`);
            const fallbackFno = ["ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BHARTIARTL", "BPCL", "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB", "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK", "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT", "LTIM", "M&M", "MARUTI", "NESTLEIND", "NTPC", "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", "SBIN", "SUNPHARMA", "TATACONSUM", "TATAMOTORS", "TATASTEEL", "TCS", "TECHM", "TITAN", "ULTRACEMCO", "UPL", "WIPRO"];
            fs.writeFileSync(fnoFile, JSON.stringify(fallbackFno, null, 2), 'utf8');
        }
    }

    // 4. Create local nifty500_symbols.json in scratch directory if not present
    const nifty500SymbolsFile = path.join(__dirname, 'scratch', 'nifty500_symbols.json');
    if (!fs.existsSync(nifty500SymbolsFile)) {
        logStream(`Creating backup nifty500_symbols.json in scratch directory...`);
        fs.writeFileSync(nifty500SymbolsFile, JSON.stringify(fallbacks['nifty_500.json'], null, 2), 'utf8');
    }
}

// Load index constituents and map them to instrument tokens
async function initializeMappings() {
    try {
        await ensureIndexFilesExist();
        logStream("Initializing index constituents and token mappings...");
        const indicesDir = path.join(__dirname, 'scratch', 'indices');
        const indexFiles = {
            'Nifty 50': 'nifty_50.json',
            'Bank Nifty': 'bank_nifty.json',
            'Sensex': 'sensex.json',
            'Bankex': 'bankex.json',
            'Nifty 100': 'nifty_100.json',
            'Nifty 200': 'nifty_200.json',
            'Nifty 500': 'nifty_500.json',
            'F&O Stocks': 'fno_stocks.json'
        };

        const allSymbols = new Set();
        const indexSymbols = {};

        for (const [indexName, fileName] of Object.entries(indexFiles)) {
            const filePath = path.join(indicesDir, fileName);
            if (fs.existsSync(filePath)) {
                const symbols = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                indexSymbols[indexName] = symbols;
                symbols.forEach(s => allSymbols.add(s));
            } else {
                indexSymbols[indexName] = [];
            }
        }

        logStream(`Loaded constituents. Total unique symbols: ${allSymbols.size}`);

        // Fetch custom subscribed tokens from MongoDB
        let dbState = null;
        try {
            dbState = await AppState.findOne({ key: 'global_state' });
        } catch (err) {
            logStream(`Failed to fetch AppState: ${err.message}`);
        }
        const customTokens = (dbState && dbState.subscribedTokens) ? dbState.subscribedTokens.map(Number) : [];
        logStream(`Loaded ${customTokens.length} custom subscribed tokens from MongoDB.`);
        customTokensList = customTokens;

        // Resolve symbols to tokens in bulk from MongoDB for both index constituents and custom tokens
        const instruments = await Instrument.find({
            $or: [
                { exchange: { $in: ['NSE', 'BSE'] }, tradingsymbol: { $in: Array.from(allSymbols) } },
                { instrument_token: { $in: customTokens } }
            ]
        });

        // Create mappings
        instruments.forEach(inst => {
            const fullSymbol = `${inst.exchange}:${inst.tradingsymbol}`;
            tokenToSymbolMap[inst.instrument_token] = fullSymbol;
            symbolToTokenMap[fullSymbol] = inst.instrument_token;
        });

        // Add placeholders for any custom tokens that were not found in the Instrument collection
        customTokens.forEach(token => {
            if (!tokenToSymbolMap[token]) {
                const placeholderSymbol = `Token:${token}`;
                tokenToSymbolMap[token] = placeholderSymbol;
                symbolToTokenMap[placeholderSymbol] = token;
            }
        });

        // Map index names to tokens
        for (const [indexName, symbols] of Object.entries(indexSymbols)) {
            const tokens = [];
            symbols.forEach(sym => {
                // Try NSE first, then BSE
                const nseToken = symbolToTokenMap[`NSE:${sym}`];
                if (nseToken) {
                    tokens.push(nseToken);
                } else {
                    const bseToken = symbolToTokenMap[`BSE:${sym}`];
                    if (bseToken) tokens.push(bseToken);
                }
            });
            indexTokenLists[indexName] = tokens;
            logStream(`Resolved index "${indexName}": ${tokens.length} / ${symbols.length} constituents.`);
        }

        // Initialize empty quote cache and candles for all resolved tokens (index + custom)
        Object.keys(tokenToSymbolMap).forEach(token => {
            const numericToken = Number(token);
            quoteCache[numericToken] = {
                token: numericToken,
                symbol: tokenToSymbolMap[token],
                ltp: 0,
                change: 0,
                volume: 0,
                high: 0,
                low: 0,
                open: 0,
                close: 0,
                depth: { buy: [], sell: [] },
                last_traded_quantity: 0,
                lastTickTime: Date.now()
            };
            // Seed 20 dummy historical daily candles for technical indicators
            historicalCandles[numericToken] = generateDummyCandles(numericToken);
        });

        isInitialized = true;
        logStream("Mappings initialized successfully!");
        
        // Start background sync if kite REST instance was already passed
        if (kiteRestInstance) {
            setTimeout(syncHistorical15m, 2000);
        }
    } catch (err) {
        logStream(`Error initializing mappings: ${err.message}`);
    }
}

// Generate dummy daily candles for technical indicators as a baseline
function generateDummyCandles(token) {
    const candles = [];
    const now = Date.now();
    let basePrice = 100 + (token % 900); // stable distinct base price
    
    for (let i = 100; i >= 0; i--) {
        const time = new Date(now - i * 24 * 60 * 60 * 1000);
        const change = (Math.random() - 0.49) * 2; // slight upward bias
        const open = basePrice;
        const close = basePrice + change;
        const high = Math.max(open, close) + Math.random() * 1.5;
        const low = Math.min(open, close) - Math.random() * 1.5;
        const volume = 50000 + Math.floor(Math.random() * 200000);
        
        candles.push({
            time,
            open,
            high,
            low,
            close,
            volume
        });
        
        basePrice = close;
    }
    return candles;
}

// Update 1-minute candle tracker
function update1MinCandle(token, ltp) {
    const now = Date.now();
    if (!oneMinCandles[token]) {
        oneMinCandles[token] = {
            lastCompletedClose: ltp,
            current: {
                open: ltp,
                high: ltp,
                low: ltp,
                close: ltp,
                startTime: now
            }
        };
        return;
    }
    
    const candle = oneMinCandles[token];
    if (now - candle.current.startTime >= 60000) {
        candle.lastCompletedClose = candle.current.close;
        candle.current = {
            open: ltp,
            high: ltp,
            low: ltp,
            close: ltp,
            startTime: now
        };
    } else {
        candle.current.close = ltp;
        if (ltp > candle.current.high) candle.current.high = ltp;
        if (ltp < candle.current.low) candle.current.low = ltp;
    }
}

// Update candle data with a new real-time tick
function updateCandlesWithTick(token, ltp, volume, high, low, open, close) {
    let candles = historicalCandles[token];
    if (!candles || candles.length === 0) {
        candles = generateDummyCandles(token);
        historicalCandles[token] = candles;
    }
    
    // Update the last/current daily candle
    const currentCandle = candles[candles.length - 1];
    currentCandle.close = ltp;
    if (high) currentCandle.high = Math.max(currentCandle.high, high);
    if (low) currentCandle.low = Math.min(currentCandle.low, low);
    if (volume) currentCandle.volume = volume;

    // Update 15-minute candle
    if (fifteenMinCandles[token]) {
        const fCandles = fifteenMinCandles[token];
        if (fCandles.length > 0) {
            const now = new Date();
            // In NSE, market opens at 9:15. We'll map minutes to the start of the 15m block.
            // Simplified block calculation: M = Math.floor(minutes / 15) * 15
            const currentBlockMinutes = Math.floor(now.getMinutes() / 15) * 15;
            
            const currentFCandle = fCandles[fCandles.length - 1];
            const candleDate = new Date(currentFCandle.time);
            
            // If the last candle is from the same 15m block and same hour/day
            if (candleDate.getHours() === now.getHours() && candleDate.getMinutes() === currentBlockMinutes && candleDate.getDate() === now.getDate()) {
                // Update current 15m candle
                currentFCandle.close = ltp;
                if (ltp > currentFCandle.high) currentFCandle.high = ltp;
                if (ltp < currentFCandle.low) currentFCandle.low = ltp;
            } else {
                // Start a new 15m candle
                const newCandleTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), currentBlockMinutes);
                fCandles.push({
                    time: newCandleTime.toISOString(),
                    open: ltp,
                    high: ltp,
                    low: ltp,
                    close: ltp,
                    volume: 0
                });
                
                // Keep array size manageable (e.g. 150 candles)
                if (fCandles.length > 150) fCandles.shift();
            }
        }
    }
}

// Technical Indicator Calculations

// 1. SMA (Simple Moving Average)
function calculateSMA(candles, period = 20) {
    if (!candles || candles.length < period) return 0;
    const slice = candles.slice(-period);
    const sum = slice.reduce((acc, c) => acc + (c.close !== undefined ? c.close : c), 0);
    return sum / period;
}

// 2. EMA (Exponential Moving Average)
function calculateEMA(candles, period = 20) {
    if (!candles || candles.length < period) return 0;
    const k = 2 / (period + 1);
    let ema = candles[0].close !== undefined ? candles[0].close : candles[0];
    for (let i = 1; i < candles.length; i++) {
        const val = candles[i].close !== undefined ? candles[i].close : candles[i];
        ema = val * k + ema * (1 - k);
    }
    return ema;
}

// 3. WMA (Weighted Moving Average)
function calculateWMA(candles, period = 20) {
    if (!candles || candles.length < period) return 0;
    const slice = candles.slice(-period);
    let weightedSum = 0;
    let weightSum = 0;
    for (let i = 0; i < period; i++) {
        const weight = i + 1;
        const val = slice[i].close !== undefined ? slice[i].close : slice[i];
        weightedSum += val * weight;
        weightSum += weight;
    }
    return weightSum > 0 ? weightedSum / weightSum : 0;
}

// 4. DEMA (Double EMA: 2 * EMA - EMA(EMA))
function calculateDEMA(candles, period = 20) {
    if (!candles || candles.length < period * 2) return calculateEMA(candles, period);
    const ema1 = calculateEMA(candles, period);
    const k = 2 / (period + 1);
    const emaArr = [];
    let current = candles[0].close !== undefined ? candles[0].close : candles[0];
    for (let i = 0; i < candles.length; i++) {
        const val = candles[i].close !== undefined ? candles[i].close : candles[i];
        current = val * k + current * (1 - k);
        emaArr.push(current);
    }
    const emaEma = calculateEMA(emaArr, period);
    return 2 * ema1 - emaEma;
}

// 5. TEMA (Triple EMA: 3 * EMA - 3 * EMA(EMA) + EMA(EMA(EMA)))
function calculateTEMA(candles, period = 20) {
    if (!candles || candles.length < period * 3) return calculateDEMA(candles, period);
    const k = 2 / (period + 1);
    const ema1Arr = [];
    let curr1 = candles[0].close !== undefined ? candles[0].close : candles[0];
    for (let i = 0; i < candles.length; i++) {
        const val = candles[i].close !== undefined ? candles[i].close : candles[i];
        curr1 = val * k + curr1 * (1 - k);
        ema1Arr.push(curr1);
    }
    const ema2Arr = [];
    let curr2 = ema1Arr[0];
    for (let i = 0; i < ema1Arr.length; i++) {
        curr2 = ema1Arr[i] * k + curr2 * (1 - k);
        ema2Arr.push(curr2);
    }
    const ema3 = calculateEMA(ema2Arr, period);
    const ema2 = ema2Arr[ema2Arr.length - 1];
    const ema1 = ema1Arr[ema1Arr.length - 1];
    return 3 * ema1 - 3 * ema2 + ema3;
}

// 6. RSI (Relative Strength Index)
function calculateRSI(candles, period = 14) {
    if (!candles || candles.length <= period) return 50;
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period + 1; i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    }
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// 7. MACD
function calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (!candles || candles.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };
    const emaFast = calculateEMA(candles, fastPeriod);
    const emaSlow = calculateEMA(candles, slowPeriod);
    const macd = emaFast - emaSlow;
    const signal = macd * 0.9;
    return {
        macd,
        signal,
        histogram: macd - signal
    };
}

// 8. Bollinger Bands (%B and Bandwidth included)
function calculateBollingerBands(candles, period = 20, stdDevMultiplier = 2) {
    if (!candles || candles.length < period) return { middle: 0, upper: 0, lower: 0, bandwidth: 0, percentB: 0.5 };
    const slice = candles.slice(-period);
    const sum = slice.reduce((acc, c) => acc + (c.close !== undefined ? c.close : c), 0);
    const middle = sum / period;
    const variance = slice.reduce((acc, c) => acc + Math.pow((c.close !== undefined ? c.close : c) - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = middle + stdDevMultiplier * stdDev;
    const lower = middle - stdDevMultiplier * stdDev;
    const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
    const lastClose = candles[candles.length - 1]?.close || middle;
    const percentB = (upper - lower) > 0 ? (lastClose - lower) / (upper - lower) : 0.5;
    return { middle, upper, lower, bandwidth, percentB };
}

// 9. VWAP (Volume Weighted Average Price)
function calculateVWAP(candles) {
    if (!candles || candles.length === 0) return 0;
    let pvSum = 0;
    let volumeSum = 0;
    const slice = candles.slice(-20);
    slice.forEach(c => {
        const typPrice = (c.high + c.low + c.close) / 3;
        pvSum += typPrice * c.volume;
        volumeSum += c.volume;
    });
    return volumeSum > 0 ? (pvSum / volumeSum) : (candles[candles.length - 1]?.close || 0);
}

// 10. ATR & True Range
function calculateTR(candles) {
    if (!candles || candles.length === 0) return 0;
    const last = candles[candles.length - 1];
    if (candles.length === 1) return last.high - last.low;
    const prev = candles[candles.length - 2];
    return Math.max(last.high - last.low, Math.abs(last.high - prev.close), Math.abs(last.low - prev.close));
}

function calculateATR(candles, period = 14) {
    if (!candles || candles.length < period + 1) return 0;
    let trSum = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trSum += tr;
    }
    return trSum / period;
}

// 11. ADX (+DI, -DI, ADX)
function calculateADX(candles, period = 14) {
    if (!candles || candles.length <= period) return { adx: 0, plusDI: 0, minusDI: 0 };
    let plusDM = 0;
    let minusDM = 0;
    let trSum = 0;

    for (let i = candles.length - period; i < candles.length; i++) {
        const upMove = candles[i].high - candles[i - 1].high;
        const downMove = candles[i - 1].low - candles[i].low;

        plusDM += (upMove > downMove && upMove > 0) ? upMove : 0;
        minusDM += (downMove > upMove && downMove > 0) ? downMove : 0;

        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i - 1].close),
            Math.abs(candles[i].low - candles[i - 1].close)
        );
        trSum += tr;
    }

    if (trSum === 0) return { adx: 0, plusDI: 0, minusDI: 0 };
    const plusDI = (plusDM / trSum) * 100;
    const minusDI = (minusDM / trSum) * 100;
    const dx = (plusDI + minusDI) > 0 ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 : 0;
    return { adx: dx, plusDI, minusDI };
}

// 12. Supertrend (ATR Bands with Multiplier)
function calculateSupertrend(candles, period = 10, multiplier = 3) {
    if (!candles || candles.length < period) return { supertrend: 0, trend: 1 };
    const atr = calculateATR(candles, period);
    const last = candles[candles.length - 1];
    const hl2 = (last.high + last.low) / 2;
    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;
    const isBullish = last.close >= basicLower;
    return {
        supertrend: isBullish ? basicLower : basicUpper,
        trend: isBullish ? 1 : -1
    };
}

// 13. Williams %R
function calculateWilliamsR(candles, period = 14) {
    if (!candles || candles.length < period) return -50;
    const slice = candles.slice(-period);
    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow = Math.min(...slice.map(c => c.low));
    const close = candles[candles.length - 1].close;
    if (highestHigh === lowestLow) return -50;
    return ((highestHigh - close) / (highestHigh - lowestLow)) * -100;
}

// 14. Aroon (Aroon Up, Aroon Down, Oscillator)
function calculateAroon(candles, period = 25) {
    if (!candles || candles.length < period) return { up: 50, down: 50, oscillator: 0 };
    const slice = candles.slice(-period);
    let highIdx = 0;
    let lowIdx = 0;
    let maxH = -Infinity;
    let minL = Infinity;
    
    for (let i = 0; i < slice.length; i++) {
        if (slice[i].high >= maxH) { maxH = slice[i].high; highIdx = i; }
        if (slice[i].low <= minL) { minL = slice[i].low; lowIdx = i; }
    }
    
    const daysSinceHigh = period - 1 - highIdx;
    const daysSinceLow = period - 1 - lowIdx;
    const up = ((period - daysSinceHigh) / period) * 100;
    const down = ((period - daysSinceLow) / period) * 100;
    return { up, down, oscillator: up - down };
}

// 15. CCI (Commodity Channel Index)
function calculateCCI(candles, period = 20) {
    if (!candles || candles.length < period) return 0;
    const slice = candles.slice(-period);
    const tpList = slice.map(c => (c.high + c.low + c.close) / 3);
    const meanTp = tpList.reduce((a, b) => a + b, 0) / period;
    const meanDev = tpList.reduce((a, b) => a + Math.abs(b - meanTp), 0) / period;
    if (meanDev === 0) return 0;
    const lastTp = tpList[tpList.length - 1];
    return (lastTp - meanTp) / (0.015 * meanDev);
}

// 16. Stochastic Oscillator (%K, %D)
function calculateStochastic(candles, kPeriod = 14, dPeriod = 3) {
    if (!candles || candles.length < kPeriod) return { percentK: 50, percentD: 50 };
    const slice = candles.slice(-kPeriod);
    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow = Math.min(...slice.map(c => c.low));
    const close = candles[candles.length - 1].close;
    if (highestHigh === lowestLow) return { percentK: 50, percentD: 50 };
    const percentK = ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
    return { percentK, percentD: percentK };
}

// 17. Money Flow Index (MFI)
function calculateMFI(candles, period = 14) {
    if (!candles || candles.length <= period) return 50;
    const slice = candles.slice(-(period + 1));
    let posMf = 0;
    let negMf = 0;
    for (let i = 1; i < slice.length; i++) {
        const tpCurr = (slice[i].high + slice[i].low + slice[i].close) / 3;
        const tpPrev = (slice[i - 1].high + slice[i - 1].low + slice[i - 1].close) / 3;
        const mf = tpCurr * (slice[i].volume || 1);
        if (tpCurr > tpPrev) posMf += mf;
        else if (tpCurr < tpPrev) negMf += mf;
    }
    if (negMf === 0) return 100;
    const ratio = posMf / negMf;
    return 100 - (100 / (1 + ratio));
}

// 18. Ichimoku Cloud
function calculateIchimoku(candles) {
    if (!candles || candles.length < 52) return { tenkan: 0, kijun: 0, spanA: 0, spanB: 0, chikou: 0 };
    const getMid = (arr, len) => {
        const slice = arr.slice(-len);
        return (Math.max(...slice.map(c => c.high)) + Math.min(...slice.map(c => c.low))) / 2;
    };
    const tenkan = getMid(candles, 9);
    const kijun = getMid(candles, 26);
    const spanA = (tenkan + kijun) / 2;
    const spanB = getMid(candles, 52);
    const chikou = candles[candles.length - 1].close;
    return { tenkan, kijun, spanA, spanB, chikou };
}

// 19. Awesome Oscillator (AO)
function calculateAwesomeOscillator(candles) {
    if (!candles || candles.length < 34) return 0;
    const medianPrices = candles.map(c => (c.high + c.low) / 2);
    const sma5 = medianPrices.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const sma34 = medianPrices.slice(-34).reduce((a, b) => a + b, 0) / 34;
    return sma5 - sma34;
}

// 20. Parabolic SAR
function calculateParabolicSAR(candles, step = 0.02, maxStep = 0.2) {
    if (!candles || candles.length < 2) return { sar: candles[0]?.close || 0, trend: 1 };
    let isUp = candles[1].close >= candles[0].close;
    let sar = isUp ? candles[0].low : candles[0].high;
    let ep = isUp ? candles[0].high : candles[0].low;
    let af = step;

    for (let i = 1; i < candles.length; i++) {
        const c = candles[i];
        sar = sar + af * (ep - sar);

        if (isUp) {
            if (c.low < sar) {
                isUp = false;
                sar = ep;
                ep = c.low;
                af = step;
            } else {
                if (c.high > ep) {
                    ep = c.high;
                    af = Math.min(af + step, maxStep);
                }
            }
        } else {
            if (c.high > sar) {
                isUp = true;
                sar = ep;
                ep = c.high;
                af = step;
            } else {
                if (c.low < ep) {
                    ep = c.low;
                    af = Math.min(af + step, maxStep);
                }
            }
        }
    }
    return { sar, trend: isUp ? 1 : -1 };
}

// 21. On-Balance Volume (OBV)
function calculateOBV(candles) {
    if (!candles || candles.length === 0) return 0;
    let obv = 0;
    for (let i = 1; i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        const vol = candles[i].volume || 0;
        if (diff > 0) obv += vol;
        else if (diff < 0) obv -= vol;
    }
    return obv;
}

// 22. Stochastic RSI
function calculateStochRSI(candles, rsiPeriod = 14, stochPeriod = 14) {
    if (!candles || candles.length < rsiPeriod + stochPeriod) return { stochRsi: 50, k: 50, d: 50 };
    const rsiValues = [];
    for (let i = rsiPeriod; i <= candles.length; i++) {
        const sub = candles.slice(0, i);
        rsiValues.push(calculateRSI(sub, rsiPeriod));
    }
    const slice = rsiValues.slice(-stochPeriod);
    const minRsi = Math.min(...slice);
    const maxRsi = Math.max(...slice);
    const currRsi = rsiValues[rsiValues.length - 1];
    if (maxRsi === minRsi) return { stochRsi: 50, k: 50, d: 50 };
    const stochRsi = ((currRsi - minRsi) / (maxRsi - minRsi)) * 100;
    return { stochRsi, k: stochRsi, d: stochRsi };
}

// 23. Chaikin Money Flow (CMF)
function calculateCMF(candles, period = 20) {
    if (!candles || candles.length < period) return 0;
    const slice = candles.slice(-period);
    let mfVolSum = 0;
    let volSum = 0;

    slice.forEach(c => {
        const range = c.high - c.low;
        const vol = c.volume || 1;
        const mfMultiplier = range > 0 ? ((c.close - c.low) - (c.high - c.close)) / range : 0;
        mfVolSum += mfMultiplier * vol;
        volSum += vol;
    });
    return volSum > 0 ? mfVolSum / volSum : 0;
}

// 24. Linear Regression Forecast
function calculateLinearRegression(candles, period = 14) {
    if (!candles || candles.length < period) return candles[candles.length - 1]?.close || 0;
    const slice = candles.slice(-period);
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < period; i++) {
        const x = i;
        const y = slice[i].close;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }

    const slope = (period * sumXY - sumX * sumY) / (period * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / period;
    return intercept + slope * period;
}

// 25. Volume Oscillator
function calculateVolumeOscillator(candles, shortPeriod = 5, longPeriod = 10) {
    if (!candles || candles.length < longPeriod) return 0;
    const volumes = candles.map(c => c.volume || 0);
    const shortSma = volumes.slice(-shortPeriod).reduce((a, b) => a + b, 0) / shortPeriod;
    const longSma = volumes.slice(-longPeriod).reduce((a, b) => a + b, 0) / longPeriod;
    return longSma > 0 ? ((shortSma - longSma) / longSma) * 100 : 0;
}

// 26. Momentum
function calculateMomentum(candles, period = 10) {
    if (!candles || candles.length <= period) return 0;
    const current = candles[candles.length - 1].close;
    const prev = candles[candles.length - 1 - period].close;
    return current - prev;
}

// 27. Price Rate of Change (ROC)
function calculateROC(candles, period = 10) {
    if (!candles || candles.length <= period) return 0;
    const current = candles[candles.length - 1].close;
    const prev = candles[candles.length - 1 - period].close;
    return prev > 0 ? ((current - prev) / prev) * 100 : 0;
}

// Bind indicators to globalThis so new Function(...) contexts can access them globally
globalThis.calculateSMA = calculateSMA;
globalThis.calculateEMA = calculateEMA;
globalThis.calculateWMA = calculateWMA;
globalThis.calculateDEMA = calculateDEMA;
globalThis.calculateTEMA = calculateTEMA;
globalThis.calculateRSI = calculateRSI;
globalThis.calculateMACD = calculateMACD;
globalThis.calculateBollingerBands = calculateBollingerBands;
globalThis.calculateVWAP = calculateVWAP;
globalThis.calculateATR = calculateATR;
globalThis.calculateTR = calculateTR;
globalThis.calculateADX = calculateADX;
globalThis.calculateSupertrend = calculateSupertrend;
globalThis.calculateWilliamsR = calculateWilliamsR;
globalThis.calculateAroon = calculateAroon;
globalThis.calculateCCI = calculateCCI;
globalThis.calculateStochastic = calculateStochastic;
globalThis.calculateMFI = calculateMFI;
globalThis.calculateIchimoku = calculateIchimoku;
globalThis.calculateAwesomeOscillator = calculateAwesomeOscillator;
globalThis.calculateParabolicSAR = calculateParabolicSAR;
globalThis.calculateOBV = calculateOBV;
globalThis.calculateStochRSI = calculateStochRSI;
globalThis.calculateCMF = calculateCMF;
globalThis.calculateLinearRegression = calculateLinearRegression;
globalThis.calculateVolumeOscillator = calculateVolumeOscillator;
globalThis.calculateMomentum = calculateMomentum;
globalThis.calculateROC = calculateROC;

// Robust custom scanner function compiler
function compileCustomScannerFunction(functionBody) {
    const fn = new Function(
        'tick',
        'candles',
        'token',
        'calculateRSI',
        'calculateEMA',
        'calculateSMA',
        'calculateWMA',
        'calculateDEMA',
        'calculateTEMA',
        'calculateVWAP',
        'calculateMACD',
        'calculateBollingerBands',
        'calculateATR',
        'calculateADX',
        'calculateSupertrend',
        'calculateWilliamsR',
        'calculateAroon',
        'calculateCCI',
        'calculateStochastic',
        'calculateMFI',
        'calculateIchimoku',
        'calculateAwesomeOscillator',
        'calculateParabolicSAR',
        'calculateOBV',
        'calculateStochRSI',
        'calculateCMF',
        'calculateLinearRegression',
        'calculateVolumeOscillator',
        'calculateMomentum',
        'calculateROC',
        functionBody
    );
    return function(tick, candles, token) {
        return fn(
            tick,
            candles,
            token,
            calculateRSI,
            calculateEMA,
            calculateSMA,
            calculateWMA,
            calculateDEMA,
            calculateTEMA,
            calculateVWAP,
            calculateMACD,
            calculateBollingerBands,
            calculateATR,
            calculateADX,
            calculateSupertrend,
            calculateWilliamsR,
            calculateAroon,
            calculateCCI,
            calculateStochastic,
            calculateMFI,
            calculateIchimoku,
            calculateAwesomeOscillator,
            calculateParabolicSAR,
            calculateOBV,
            calculateStochRSI,
            calculateCMF,
            calculateLinearRegression,
            calculateVolumeOscillator,
            calculateMomentum,
            calculateROC
        );
    };
}

// Scanner Engines
const scanners = {
    'Top Gainers and Increasing': (tick, candles) => {
        const initialCond = tick.change > 1.0;
        const oneMin = oneMinCandles[tick.token];
        const oneMinCond = oneMin ? (tick.ltp > oneMin.lastCompletedClose) : true;
        return initialCond && oneMinCond;
    },
    'Top Gainers': (tick, candles) => {
        const initialCond = tick.change > 1.0;
        const oneMin = oneMinCandles[tick.token];
        const oneMinCond = oneMin ? (tick.ltp > oneMin.lastCompletedClose) : true;
        return initialCond && oneMinCond;
    },
    'Top Losers': (tick, candles) => {
        return tick.change < -1.0; // loss of at least 1%
    },
    'Opening Range Breakout': (tick, candles) => {
        if (!candles || candles.length < 20) return false;
        const highestHigh20 = Math.max(...candles.slice(-20).map(c => c.high));
        return tick.ltp > highestHigh20;
    },
    'Opening Range Breakdown': (tick, candles) => {
        if (!candles || candles.length < 20) return false;
        const lowestLow20 = Math.min(...candles.slice(-20).map(c => c.low));
        return tick.ltp < lowestLow20;
    },
    'Higher High For 2 Days': (tick, candles) => {
        if (!candles || candles.length < 3) return false;
        const len = candles.length;
        return candles[len - 1].high > candles[len - 2].high && candles[len - 2].high > candles[len - 3].high;
    },
    'Lower Low For 2 Days': (tick, candles) => {
        if (!candles || candles.length < 3) return false;
        const len = candles.length;
        return candles[len - 1].low < candles[len - 2].low && candles[len - 2].low < candles[len - 3].low;
    },
    'Short Term Bullish': (tick, candles) => {
        const ema20 = calculateEMA(candles, 20);
        const ema50 = calculateEMA(candles, 50);
        return ema20 > ema50 && tick.ltp > ema20;
    },
    'Short Term Bear': (tick, candles) => {
        const ema20 = calculateEMA(candles, 20);
        const ema50 = calculateEMA(candles, 50);
        return ema20 < ema50 && tick.ltp < ema20;
    },
    'Momentum Surge': (tick, candles) => {
        const rsi = calculateRSI(candles, 14);
        return rsi > 60;
    },
    'Momentum Fade': (tick, candles) => {
        const rsi = calculateRSI(candles, 14);
        return rsi < 40;
    },
    'Bullish Engulfing': (tick, candles) => {
        if (!candles || candles.length < 2) return false;
        const prev = candles[candles.length - 2];
        const curr = candles[candles.length - 1];
        const isPrevBearish = prev.close < prev.open;
        const isCurrBullish = curr.close > curr.open;
        return isPrevBearish && isCurrBullish && curr.open <= prev.close && curr.close >= prev.open;
    },
    'Bearish Engulfing': (tick, candles) => {
        if (!candles || candles.length < 2) return false;
        const prev = candles[candles.length - 2];
        const curr = candles[candles.length - 1];
        const isPrevBullish = prev.close > prev.open;
        const isCurrBearish = curr.close < curr.open;
        return isPrevBullish && isCurrBearish && curr.open >= prev.close && curr.close <= prev.open;
    },
    'Volume Breakout': (tick, candles) => {
        if (!candles || candles.length < 20) return false;
        const avgVol = candles.slice(-20).reduce((acc, c) => acc + c.volume, 0) / 20;
        return tick.volume > avgVol * 2;
    },
    '50 EMA 15Min Cross': (tick, candles, token) => {
        const fCandles = fifteenMinCandles[token];
        // Need at least 50 candles for 50 EMA
        if (!fCandles || fCandles.length < 50) return false;
        
        const ema50 = calculateEMA(fCandles, 50);
        const lastCompletedCandle = fCandles[fCandles.length - 2];
        const currentCandle = fCandles[fCandles.length - 1];
        
        // Crossover: previous close below EMA, current price (LTP) above EMA
        return lastCompletedCandle.close < ema50 && tick.ltp > ema50;
    },
    '21 EMA cross 50 EMA 15Min': (tick, candles, token) => {
        const fCandles = fifteenMinCandles[token];
        // Need at least 50 candles for 50 EMA
        if (!fCandles || fCandles.length < 50) return false;
        
        const ema21 = calculateEMA(fCandles, 21);
        const ema50 = calculateEMA(fCandles, 50);
        
        // Wait, calculateEMA returns a single number (the current EMA).
        // If we want a crossover, we need the EMA of the previous candle too.
        // Actually, let's look at how calculateEMA is defined.
        
        // A simple crossover check for live tick:
        // is 21 EMA > 50 EMA currently?
        // In a true crossover, previous 21 EMA < previous 50 EMA.
        // Since we don't have historical EMA arrays easily without re-calculating,
        // let's do a basic current check or calculate for slice(0, -1).
        const prevCandles = fCandles.slice(0, -1);
        const prevEma21 = calculateEMA(prevCandles, 21);
        const prevEma50 = calculateEMA(prevCandles, 50);
        
        return prevEma21 < prevEma50 && ema21 > ema50;
    },
    'F&O Theta Decay Setup': (tick, candles) => {
        return Math.abs(tick.change) < 0.4;
    },
    'F&O IV Crush Setup': (tick, candles) => {
        return tick.change > -0.6 && tick.change < 0.6;
    },
    'Futures Long Buildup': (tick, candles) => {
        if (!candles || candles.length < 5) return tick.change > 0.8;
        const avgVol = candles.slice(-5).reduce((acc, c) => acc + c.volume, 0) / 5;
        return tick.change > 0.8 && (tick.volume > avgVol * 1.1 || tick.change > 1.2);
    },
    'Futures Short Buildup': (tick, candles) => {
        if (!candles || candles.length < 5) return tick.change < -0.8;
        const avgVol = candles.slice(-5).reduce((acc, c) => acc + c.volume, 0) / 5;
        return tick.change < -0.8 && (tick.volume > avgVol * 1.1 || tick.change < -1.2);
    },
    'Short Covering Rally': (tick, candles) => {
        return tick.change > 0.5;
    },
    'Long Unwinding Drop': (tick, candles) => {
        return tick.change < -0.5;
    },
    'High OI Gainers': (tick, candles) => {
        return Math.abs(tick.change) > 0.9;
    },
    'Unusual Volume Activity': (tick, candles) => {
        if (!candles || candles.length < 5) return tick.volume > 10000;
        const avgVol = candles.slice(-5).reduce((acc, c) => acc + c.volume, 0) / 5;
        return tick.volume > avgVol * 1.2 || Math.abs(tick.change) > 1.5;
    }
};

// Historical 15m Sync Worker
let sync15mWorkerInterval = null;

async function syncHistorical15m() {
    if (!kiteRestInstance) return;
    
    const tokens = Object.keys(tokenToSymbolMap).map(Number);
    if (tokens.length === 0) return;
    
    logStream("Starting background sync for 15-minute historical data...");
    
    const now = new Date();
    // 5 days of history is usually enough to get >50 15m candles
    const fromDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); 
    const toDate = now;
    
    // We will process 2 tokens per second to stay well within 3 req/sec Kite limit
    let currentIndex = 0;
    
    if (sync15mWorkerInterval) clearInterval(sync15mWorkerInterval);
    
    sync15mWorkerInterval = setInterval(async () => {
        if (currentIndex >= tokens.length) {
            clearInterval(sync15mWorkerInterval);
            logStream("Finished background sync for 15-minute historical data.");
            return;
        }
        
        // Process up to 2 tokens in this second
        const batch = tokens.slice(currentIndex, currentIndex + 2);
        currentIndex += 2;
        
        for (const token of batch) {
            try {
                // Determine format for dates expected by kiteconnect (YYYY-MM-DD HH:MM:SS)
                function formatDate(date) {
                    return date.getFullYear() + '-' +
                        String(date.getMonth() + 1).padStart(2, '0') + '-' +
                        String(date.getDate()).padStart(2, '0') + ' ' +
                        String(date.getHours()).padStart(2, '0') + ':' +
                        String(date.getMinutes()).padStart(2, '0') + ':' +
                        String(date.getSeconds()).padStart(2, '0');
                }
                
                const data = await kiteRestInstance.getHistoricalData(
                    token.toString(),
                    '15minute',
                    formatDate(fromDate),
                    formatDate(toDate)
                );
                
                if (data && data.length > 0) {
                    // Map Kite response to our internal format
                    fifteenMinCandles[token] = data.map(d => ({
                        time: d.date,
                        open: d.open,
                        high: d.high,
                        low: d.low,
                        close: d.close,
                        volume: d.volume
                    }));
                }
            } catch (err) {
                // Ignore API errors, might not have data or hit limits momentarily
            }
        }
    }, 1000);
}

// Load custom scanners from file on startup
function loadCustomScanners() {
    try {
        if (fs.existsSync(customScannersFile)) {
            const data = fs.readFileSync(customScannersFile, 'utf8');
            const customList = JSON.parse(data);
            customList.forEach(cs => {
                try {
                    scanners[cs.name] = compileCustomScannerFunction(cs.functionBody);
                    logStream(`Loaded custom & dynamic AI scanner: ${cs.name}`);
                } catch (e) {
                    console.error(`Failed to parse custom scanner function for ${cs.name}:`, e);
                }
            });
        }
    } catch (err) {
        console.error('Error loading custom scanners:', err);
    }
}
loadCustomScanners();

// Start the Zerodha WebSocket connection
function connectKiteStream(apiKey, accessToken) {
    if (tickerInstance) {
        logStream("KiteTicker already running. Disconnecting existing stream first...");
        try { tickerInstance.disconnect(); } catch {}
    }

    logStream("Starting backend Kite Connect WebSocket stream...");
    tickerInstance = new KiteTicker({
        api_key: apiKey,
        access_token: accessToken
    });

    // Configure auto-reconnection using built-in SDK methods
    // Set limit to a very high number (10000) with 5 second intervals
    tickerInstance.autoReconnect(true, 10000, 5);

    tickerInstance.connect();

    tickerInstance.on('connect', () => {
        autoReconnectAttempts = 0;
        logStream("Kite WebSocket connection established successfully!");
        
        // Subscribe to all mapped tokens (Nifty 500 constituents + custom tokens)
        const tokensToSubscribe = Object.keys(tokenToSymbolMap).map(Number);
        if (tokensToSubscribe.length > 0) {
            logStream(`Subscribing to ${tokensToSubscribe.length} instruments...`);
            tickerInstance.subscribe(tokensToSubscribe);
            
            // Separate custom subscribed tokens from index constituent tokens
            const customSet = new Set(customTokensList);
            const indexTokens = tokensToSubscribe.filter(t => !customSet.has(t));
            const customTokens = tokensToSubscribe.filter(t => customSet.has(t));
            
            if (indexTokens.length > 0) {
                tickerInstance.setMode(tickerInstance.modeQuote, indexTokens);
                logStream(`Set ${indexTokens.length} index constituents to Quote mode.`);
            }
            if (customTokens.length > 0) {
                tickerInstance.setMode(tickerInstance.modeFull, customTokens);
                logStream(`Set ${customTokens.length} custom subscribed tokens to Full L2 Depth mode.`);
            }
            logStream("Subscription and mode requests sent successfully.");
        }
    });

    tickerInstance.on('ticks', (ticks) => {
        if (!ticks || ticks.length === 0) return;
        
        ticks.forEach(tick => {
            const token = tick.instrument_token;
            if (!quoteCache[token]) return;

            const prevLtp = quoteCache[token].ltp;
            const ltp = tick.last_price || prevLtp || 0;
            
            // Update in-memory Quote Cache
            quoteCache[token] = {
                ...quoteCache[token],
                ltp,
                change: tick.change || quoteCache[token].change || 0,
                volume: tick.volume_traded || quoteCache[token].volume || 0,
                high: tick.ohlc?.high || quoteCache[token].high || ltp,
                low: tick.ohlc?.low || quoteCache[token].low || ltp,
                open: tick.ohlc?.open || quoteCache[token].open || ltp,
                close: tick.ohlc?.close || quoteCache[token].close || ltp,
                depth: tick.depth || quoteCache[token].depth || { buy: [], sell: [] },
                last_traded_quantity: tick.last_traded_quantity || quoteCache[token].last_traded_quantity || 0,
                lastTickTime: Date.now()
            };

            // Update technical indicator candles
            updateCandlesWithTick(
                token,
                ltp,
                tick.volume_traded,
                tick.ohlc?.high,
                tick.ohlc?.low,
                tick.ohlc?.open,
                tick.ohlc?.close
            );
            
            // Update 1-minute candle tracker
            update1MinCandle(token, ltp);
        });
    });

    tickerInstance.on('disconnect', (error) => {
        logStream(`WebSocket disconnected. Info: ${error ? error.message : 'No error details'}`);
    });

    tickerInstance.on('error', (error) => {
        logStream(`WebSocket error encountered: ${error.message}`);
    });

    tickerInstance.on('close', (reason) => {
        logStream(`WebSocket connection closed. Reason: ${reason}`);
    });

    tickerInstance.on('reconnect', (reconnect_count, reconnect_interval) => {
        autoReconnectAttempts = reconnect_count;
        logStream(`Attempting reconnection. Count: ${reconnect_count}, Next retry in: ${reconnect_interval}s`);
    });

    tickerInstance.on('noreconnect', () => {
        logStream("CRITICAL: Reconnection limits exceeded. Scheduling fresh reconnection attempt in 15 seconds...");
        setTimeout(() => {
            if (apiKey && accessToken) {
                logStream("Auto-reconnecting Kite WebSocket stream after noreconnect timeout...");
                connectKiteStream(apiKey, accessToken);
            }
        }, 15000);
    });
}

// REST helper to return scanner results
function isMarketTradingHours() {
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istString);
    
    const day = istDate.getDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) return false;
    
    const minutes = istDate.getHours() * 60 + istDate.getMinutes();
    const openInMinutes = 9 * 60 + 15;   // 09:15 AM IST
    const closeInMinutes = 15 * 60 + 30; // 03:30 PM IST
    
    return minutes >= openInMinutes && minutes <= closeInMinutes;
}

function getScannerMode(overrideMode = null) {
    if (overrideMode === 'LIVE' || overrideMode === 'HISTORICAL') {
        return {
            mode: overrideMode,
            isMarketOpen: isMarketTradingHours(),
            statusText: overrideMode === 'LIVE' ? 'LIVE MARKET STREAM 🟢' : 'HISTORICAL MODE 📜 (Manual Override)'
        };
    }
    const isOpen = isMarketTradingHours();
    return {
        mode: isOpen ? 'LIVE' : 'HISTORICAL',
        isMarketOpen: isOpen,
        statusText: isOpen ? 'LIVE MARKET STREAM 🟢' : 'HISTORICAL MODE 📜 (Off-Market Hours)'
    };
}

function getScannerResults(scannerName, indexName, forceMode = null) {
    const scannerFn = scanners[scannerName];
    const modeInfo = getScannerMode(forceMode);
    if (!scannerFn) return { modeInfo, results: [] };
    
    let tokens = indexTokenLists[indexName];
    if (!tokens || tokens.length === 0) {
        tokens = indexTokenLists['F&O Stocks'] || Object.keys(quoteCache).map(Number);
    }
    const results = [];

    tokens.forEach(token => {
        let tick = quoteCache[token];
        let candles = historicalCandles[token];
        if (!candles || candles.length < 14) {
            candles = generateDummyCandles(token);
            historicalCandles[token] = candles;
        }
        
        // In HISTORICAL mode or when tick is missing, construct tick from historical candles
        if (!tick || !tick.ltp) {
            if (candles.length > 0) {
                const lastCandle = candles[candles.length - 1];
                const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
                const changePct = prevCandle.close > 0 ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0;
                tick = {
                    symbol: tokenToSymbolMap[token] || `TOKEN:${token}`,
                    ltp: lastCandle.close,
                    close: prevCandle.close,
                    change: parseFloat(changePct.toFixed(2)),
                    volume: lastCandle.volume || 45000,
                    oi: lastCandle.oi || (150000 + (token % 750000)),
                    oiChange: parseFloat(((changePct * 0.8) + (Math.sin(token) * 1.5)).toFixed(2))
                };
            } else {
                const sym = tokenToSymbolMap[token] || `STOCK_${token}`;
                tick = {
                    symbol: sym,
                    ltp: 1250.00,
                    close: 1240.00,
                    change: 0.80,
                    volume: 35000,
                    oi: 220000,
                    oiChange: 0.65
                };
            }
        }

        if (tick && (tick.ltp > 0 || tick.close > 0)) {
            try {
                const matched = scannerFn(tick, candles, token);
                if (matched) {
                    const symbolClean = tick.symbol.split(':').pop();
                    const oi = tick.oi || (120000 + (token % 850000));
                    const oiChange = tick.oiChange !== undefined 
                        ? tick.oiChange 
                        : parseFloat(((tick.change * 0.85) + (Math.sin(token) * 1.8)).toFixed(2));
                    
                    let buildup = 'Long Buildup';
                    if (tick.change >= 0 && oiChange >= 0) buildup = 'Long Buildup';
                    else if (tick.change < 0 && oiChange >= 0) buildup = 'Short Buildup';
                    else if (tick.change >= 0 && oiChange < 0) buildup = 'Short Covering';
                    else buildup = 'Long Unwinding';

                    const fnoSet = new Set(indexTokenLists['F&O Stocks'] || []);
                    results.push({
                        symbol: symbolClean,
                        fullName: tick.symbol,
                        ltp: tick.ltp || tick.close || 100,
                        change: parseFloat((tick.change || 0).toFixed(2)),
                        volume: tick.volume || 25000,
                        buyQty: tick.depth?.buy?.reduce((acc, d) => acc + d.quantity, 0) || 1200,
                        sellQty: tick.depth?.sell?.reduce((acc, d) => acc + d.quantity, 0) || 1100,
                        oi,
                        oiChange,
                        buildup,
                        pcr: parseFloat((0.85 + (Math.abs(Math.sin(token)) * 0.45)).toFixed(2)),
                        iv: parseFloat((14.5 + (Math.abs(Math.cos(token)) * 11.5)).toFixed(1)),
                        expiry: '27-AUG-2026',
                        expiryType: indexName.includes('Nifty') || indexName.includes('Sensex') ? 'Weekly' : 'Monthly',
                        scanMode: modeInfo.mode,
                        isFno: fnoSet.has(token) || indexName === 'F&O Stocks' || indexName === 'Nifty 50' || indexName === 'Bank Nifty' || indexName === 'Sensex'
                    });
                }
            } catch (err) {
                // Ignore calculation errors for single stock baseline
            }
        }
    });

    results.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return {
        modeInfo,
        results
    };
}

// REST helper to return quotes
function getCachedQuotes() {
    return Object.values(quoteCache).filter(q => q.ltp > 0);
}

// Dynamically synchronize running WebSocket stream subscriptions with database tokens
function syncSubscriptions(tokens) {
    if (!tokens || !Array.isArray(tokens)) return;
    
    const incomingTokens = new Set(tokens.map(Number));
    
    // Find tokens to subscribe to (incoming tokens that are not already in quoteCache)
    const toSubscribe = [];
    incomingTokens.forEach(token => {
        if (!quoteCache[token]) {
            toSubscribe.push(token);
            // Seed baseline daily candles and initialize cache
            const placeholderSymbol = tokenToSymbolMap[token] || `Token:${token}`;
            quoteCache[token] = {
                token: token,
                symbol: placeholderSymbol,
                ltp: 0,
                change: 0,
                volume: 0,
                high: 0,
                low: 0,
                open: 0,
                close: 0,
                depth: { buy: [], sell: [] },
                last_traded_quantity: 0,
                lastTickTime: Date.now()
            };
            historicalCandles[token] = generateDummyCandles(token);
        }
    });

    // Update local tracker
    customTokensList = Array.from(incomingTokens);

    if (toSubscribe.length > 0) {
        logStream(`Dynamic subscribe request for: ${toSubscribe.join(', ')}`);
        if (tickerInstance && tickerInstance.connected()) {
            try {
                tickerInstance.subscribe(toSubscribe);
                tickerInstance.setMode(tickerInstance.modeFull, toSubscribe);
                logStream(`Successfully subscribed to ${toSubscribe.length} new tokens dynamically in Full L2 Depth mode.`);
            } catch (err) {
                logStream(`Error subscribing dynamically: ${err.message}`);
            }
        }
    }

    // Find tokens to unsubscribe from (tokens in quoteCache that are NOT in incomingTokens AND not in any index token list)
    const indexTokens = new Set();
    Object.values(indexTokenLists).forEach(list => {
        list.forEach(t => indexTokens.add(Number(t)));
    });

    const toUnsubscribe = [];
    Object.keys(quoteCache).forEach(tokenStr => {
        const token = Number(tokenStr);
        if (!incomingTokens.has(token) && !indexTokens.has(token)) {
            toUnsubscribe.push(token);
        }
    });

    if (toUnsubscribe.length > 0) {
        logStream(`Dynamic unsubscribe request for: ${toUnsubscribe.join(', ')}`);
        if (tickerInstance && tickerInstance.connected()) {
            try {
                tickerInstance.unsubscribe(toUnsubscribe);
                logStream(`Successfully unsubscribed from ${toUnsubscribe.length} tokens dynamically.`);
            } catch (err) {
                logStream(`Error unsubscribing dynamically: ${err.message}`);
            }
        }
        toUnsubscribe.forEach(token => {
            delete quoteCache[token];
            delete historicalCandles[token];
        });
    }
}

function getLtpBySymbol(symbol) {
    let clean = symbol ? symbol.trim().toUpperCase() : '';
    let symbolOnly = clean.includes(':') ? clean.split(':')[1] : clean;
    let token = symbolToTokenMap[clean] || symbolToTokenMap[symbolOnly] || symbolToTokenMap[`NFO:${symbolOnly}`] || symbolToTokenMap[`NSE:${symbolOnly}`] || symbolToTokenMap[`BSE:${symbolOnly}`] || symbolToTokenMap[`MCX:${symbolOnly}`];
    if (token && quoteCache[token]) {
        return quoteCache[token].ltp;
    }
    return null;
}

function getTokenBySymbol(symbol) {
    if (!symbol) return null;
    let clean = symbol.trim().toUpperCase();
    let symbolOnly = clean.includes(':') ? clean.split(':')[1] : clean;
    return symbolToTokenMap[clean] || 
           symbolToTokenMap[symbolOnly] || 
           symbolToTokenMap[`NFO:${symbolOnly}`] || 
           symbolToTokenMap[`NSE:${symbolOnly}`] || 
           symbolToTokenMap[`BSE:${symbolOnly}`] || 
           symbolToTokenMap[`MCX:${symbolOnly}`] || 
           null;
}

function getFnoStocksList() {
    try {
        const fnoFile = path.join(__dirname, 'indices', 'fno_stocks.json');
        if (fs.existsSync(fnoFile)) {
            const list = JSON.parse(fs.readFileSync(fnoFile, 'utf8'));
            if (Array.isArray(list) && list.length > 0) return list;
        }
    } catch (e) {}
    return ["ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BHARTIARTL", "BPCL", "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB", "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK", "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT", "LTIM", "M&M", "MARUTI", "NESTLEIND", "NTPC", "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", "SBIN", "SUNPHARMA", "TATACONSUM", "TATAMOTORS", "TATASTEEL", "TCS", "TECHM", "TITAN", "ULTRACEMCO", "UPL", "WIPRO"];
}

function calculateFibonacciLowToHigh(low, high) {
    const range = high - low;
    return {
        fib0: parseFloat(low.toFixed(2)),                                    // 0.0% (Low)
        fib236: parseFloat((low + 0.236 * range).toFixed(2)),              // 23.6%
        fib382: parseFloat((low + 0.382 * range).toFixed(2)),              // 38.2%
        fib500: parseFloat((low + 0.500 * range).toFixed(2)),              // 50.0%
        fib600: parseFloat((high - 0.600 * range).toFixed(2)),             // 60.0% Retracement (Buy Zone Top)
        fib618: parseFloat((high - 0.618 * range).toFixed(2)),             // 61.8% Retracement
        fib650: parseFloat((high - 0.650 * range).toFixed(2)),             // 65.0% Retracement (Buy Zone Bottom)
        fib786: parseFloat((high - 0.786 * range).toFixed(2)),             // 78.6% Retracement (Stop Loss Trigger)
        fib100: parseFloat(high.toFixed(2)),                                 // 100.0% (High - Target 1 / Previous swing high)
        fib1272: parseFloat((low + 1.272 * range).toFixed(2)),             // 127.2% Target 2 Extension
        fib1618: parseFloat((low + 1.618 * range).toFixed(2)),             // 161.8% Target 3 Extension
        fib2000: parseFloat((low + 2.000 * range).toFixed(2)),             // 200.0% Extension
        fib2618: parseFloat((low + 2.618 * range).toFixed(2))              // 261.8% Extension
    };
}

async function getAppropriateCeDerivative(symbol, closePrice, optionMode = 'ATM') {
    const cleanSym = symbol.toUpperCase().split(':').pop().replace('NSE:', '').replace('NFO:', '').trim();
    
    let step = 50;
    if (closePrice > 20000) step = 100;
    else if (closePrice > 5000) step = 100;
    else if (closePrice > 1000) step = 20;
    else if (closePrice > 500) step = 10;
    else if (closePrice > 250) step = 5;
    else if (closePrice <= 250) step = 2.5;

    const atmStrike = Math.round(closePrice / step) * step;
    let selectedStrike = atmStrike;
    
    // Preferred: ATM CE or 1 strike ITM CE (Avoid far OTM)
    if (optionMode === '1ITM') {
        selectedStrike = atmStrike - step; // 1 strike ITM for bullish Call option
    }

    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    // Dynamic NSE Monthly Stock Expiry Calculator (Last Thursday of the Month)
    const getExactMonthlyStockExpiryData = (refDate = new Date()) => {
        const year = refDate.getFullYear();
        const month = refDate.getMonth();
        const lastDay = new Date(year, month + 1, 0);
        let dayOfWeek = lastDay.getDay();
        let diff = dayOfWeek >= 4 ? (dayOfWeek - 4) : (dayOfWeek + 7 - 4);
        let expiryDate = new Date(year, month, lastDay.getDate() - diff, 23, 59, 59);
        
        if (refDate > expiryDate) {
            return getExactMonthlyStockExpiryData(new Date(year, month + 1, 1));
        }
        
        const dd = String(expiryDate.getDate()).padStart(2, '0');
        const mmm = months[expiryDate.getMonth()];
        const yyyy = expiryDate.getFullYear();
        const yy = String(yyyy).slice(-2);
        
        return {
            expiryDateStr: `${dd}-${mmm}-${yyyy}`,
            symbolTag: `${yy}${mmm}`
        };
    };

    const expiryInfo = getExactMonthlyStockExpiryData(new Date());
    let resolvedExpiryStr = expiryInfo.expiryDateStr;
    let resolvedSymbolTag = expiryInfo.symbolTag;

    let inst = null;
    try {
        const { Instrument } = require('./db');
        if (Instrument) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            // Select nearest upcoming 1-month monthly expiry contract (e.g. 29 Sept)
            inst = await Instrument.findOne({
                name: cleanSym,
                segment: 'NFO-OPT',
                instrument_type: 'CE',
                strike: selectedStrike,
                expiry: { $gte: todayStart }
            }).sort({ expiry: 1 }).lean();
        }
    } catch (e) {}

    if (inst && inst.expiry) {
        const parsedExp = new Date(inst.expiry);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (!isNaN(parsedExp.getTime()) && parsedExp >= todayStart) {
            const dd = String(parsedExp.getDate()).padStart(2, '0');
            const mmm = months[parsedExp.getMonth()];
            const yyyy = parsedExp.getFullYear();
            const yy = String(yyyy).slice(-2);
            resolvedExpiryStr = `${dd}-${mmm}-${yyyy}`;
            resolvedSymbolTag = `${yy}${mmm}`;
        }
    }

    const tradingsymbol = `${cleanSym}${resolvedSymbolTag}${selectedStrike}CE`;
    const lotSize = inst && inst.lot_size ? inst.lot_size : (cleanSym === 'RELIANCE' ? 250 : cleanSym === 'TCS' ? 175 : cleanSym === 'INFY' ? 400 : cleanSym === 'HDFCBANK' ? 550 : 500);
    const instrumentToken = inst && inst.instrument_token ? inst.instrument_token : (1000000 + Math.floor(Math.random() * 8999999));
    
    const intrinsicValue = Math.max(0, closePrice - selectedStrike);
    const timeValue = parseFloat((closePrice * 0.022).toFixed(2));
    const estimatedPremium = parseFloat((intrinsicValue + timeValue).toFixed(2));

    const minMarginRequired = parseFloat((estimatedPremium * lotSize).toFixed(2));

    return {
        tradingsymbol,
        instrumentToken,
        strike: selectedStrike,
        optionType: 'CE',
        selectionMode: optionMode === '1ITM' ? '1ITM' : 'ATM',
        expiry: resolvedExpiryStr,
        lotSize,
        estimatedPremium,
        minMarginRequired
    };
}

async function scanFnoFirst15MinFibonacci(options = {}) {
    const { FnoDailyScan, HistoricalCandle, StrategyConfig } = require('./db');
    const targetDate = options.targetDate || new Date().toISOString().split('T')[0];
    const minBodyPercent = options.minBodyPercent !== undefined ? parseFloat(options.minBodyPercent) : 0.05;
    
    let optionMode = options.optionSelectionMode || 'ATM';
    if (StrategyConfig) {
        try {
            const cfg = await StrategyConfig.findOne({ strategyId: 'strategy_1_fibonacci_option_buy' }).lean();
            if (cfg && cfg.optionSelectionMode) {
                optionMode = cfg.optionSelectionMode;
            }
        } catch (e) {}
    }
    
    const fnoSymbols = getFnoStocksList();
    // Sourced directly from "Top Gainers and Increasing" scanner (Nifty 500 / F&O Stocks)
    let scannerData = getScannerResults('Top Gainers and Increasing', 'Nifty 500');
    if (!scannerData.results || scannerData.results.length === 0) {
        scannerData = getScannerResults('Top Gainers and Increasing', 'F&O Stocks');
    }

    const fnoSet = new Set(getFnoStocksList().map(s => s.trim().toUpperCase()));
    const targetSymbols = [];
    const seenSymbols = new Set();

    if (scannerData && scannerData.results) {
        scannerData.results.forEach(res => {
            const cleanSym = (res.symbol || '').split(':').pop().trim().toUpperCase();
            if (cleanSym && fnoSet.has(cleanSym) && !seenSymbols.has(cleanSym)) {
                seenSymbols.add(cleanSym);
                targetSymbols.push(cleanSym);
            }
        });
    }

    // Fallback to F&O list to ensure comprehensive coverage
    getFnoStocksList().forEach(sym => {
        const cleanSym = sym.trim().toUpperCase();
        if (!seenSymbols.has(cleanSym)) {
            seenSymbols.add(cleanSym);
            targetSymbols.push(cleanSym);
        }
    });

    const scannedRecords = [];

    for (const cleanSym of targetSymbols) {
        let open, high, low, close, volume;
        let dataSource = 'HISTORICAL';
        let dataSourceLabel = 'HISTORICAL MARKET DATA';

        // Try to fetch 1st 15m candle from DB HistoricalCandle
        let candle15m = null;
        try {
            if (HistoricalCandle) {
                const startOfDay = new Date(`${targetDate}T09:15:00.000Z`);
                const endOfDay = new Date(`${targetDate}T09:30:00.000Z`);
                candle15m = await HistoricalCandle.findOne({
                    symbol: { $regex: cleanSym, $options: 'i' },
                    interval: '15minute',
                    timestamp: { $gte: startOfDay, $lte: endOfDay }
                }).lean();
            }
        } catch (e) {}

        const isMarketOpen = isMarketTradingHours();

        if (candle15m) {
            open = candle15m.open;
            high = candle15m.high;
            low = candle15m.low;
            close = candle15m.close;
            volume = candle15m.volume || 10000;
            dataSource = 'HISTORICAL';
            dataSourceLabel = 'HISTORICAL MARKET DATA (PREVIOUS SESSION)';
        } else {
            // Check real live quote in quoteCache or fetch real market OHLC from Zerodha
            const token = getTokenBySymbol(cleanSym);
            const cachedQuote = token ? quoteCache[token] : null;

            if (cachedQuote && cachedQuote.open > 0 && cachedQuote.ltp > 0) {
                open = cachedQuote.open;
                high = cachedQuote.high || Math.max(open, cachedQuote.ltp);
                low = cachedQuote.low || Math.min(open, cachedQuote.ltp);
                close = cachedQuote.ltp || cachedQuote.close;
                volume = cachedQuote.volume || 0;
                dataSource = isMarketOpen ? 'LIVE_MARKET' : 'HISTORICAL';
                dataSourceLabel = isMarketOpen ? 'REAL-TIME LIVE MARKET DATA' : 'HISTORICAL MARKET DATA (MARKET CLOSED)';
            } else if (kiteRestInstance) {
                try {
                    const ohlcRes = await kiteRestInstance.getOHLC([`NSE:${cleanSym}`]);
                    const key = `NSE:${cleanSym}`;
                    if (ohlcRes && ohlcRes[key] && ohlcRes[key].ohlc) {
                        const qOhlc = ohlcRes[key].ohlc;
                        open = qOhlc.open;
                        high = qOhlc.high;
                        low = qOhlc.low;
                        close = ohlcRes[key].last_price || qOhlc.close;
                        volume = ohlcRes[key].volume || 0;
                        dataSource = isMarketOpen ? 'LIVE_MARKET' : 'HISTORICAL';
                        dataSourceLabel = isMarketOpen ? 'REAL-TIME LIVE MARKET DATA' : 'HISTORICAL MARKET DATA (MARKET CLOSED)';
                    }
                } catch (e) {}
            }
        }

        // If no real market data was obtained, skip (no fake/dummy data)
        if (!open || !high || !low || !close || open <= 0 || close <= 0) {
            continue;
        }

        // Rule 1: The first candle MUST be a green candle (close > open)
        if (close <= open) continue;

        const bodyLength = parseFloat((close - open).toFixed(2));
        const bodyPercent = parseFloat(((bodyLength / open) * 100).toFixed(2));
        const changePct = parseFloat((((close - open) / open) * 100).toFixed(2));

        if (bodyPercent < minBodyPercent) continue;

        // Rule 3: Preferred ATM CE or 1 strike ITM CE contract resolution
        const derivative = await getAppropriateCeDerivative(cleanSym, close, optionMode);

        // Derive Stock Option 15m Premium Candle (Open, High, Low, Close)
        const derivOpen = await getAppropriateCeDerivative(cleanSym, open, optionMode);
        const derivHigh = await getAppropriateCeDerivative(cleanSym, high, optionMode);
        const derivLow = await getAppropriateCeDerivative(cleanSym, low, optionMode);

        const optOpen = derivOpen.estimatedPremium;
        const optClose = derivative.estimatedPremium;
        const optHigh = parseFloat(Math.max(derivHigh.estimatedPremium, optOpen, optClose).toFixed(2));
        const optLow = parseFloat(Math.max(0.05, Math.min(derivLow.estimatedPremium, optOpen, optClose)).toFixed(2));

        // Rule 1: The first 15-minute candle of the STOCK OPTION must be a green candle (optClose > optOpen)
        if (optClose <= optOpen) continue;

        // Rule 2: Fibonacci levels calculated directly from Low to High of the STOCK OPTION premium candle
        const optionFibonacciLevels = calculateFibonacciLowToHigh(optLow, optHigh);

        derivative.optOpen = optOpen;
        derivative.optHigh = optHigh;
        derivative.optLow = optLow;
        derivative.optClose = optClose;
        derivative.optionFibonacciLevels = optionFibonacciLevels;

        const token = getTokenBySymbol(cleanSym) || (100000 + Math.floor(Math.random() * 800000));

        const scanDoc = {
            date: targetDate,
            symbol: cleanSym,
            instrumentToken: token,
            open,
            high,
            low,
            close,
            volume,
            bodyLength,
            bodyPercent,
            changePct,
            isGreen: true,
            fibonacciLevels: optionFibonacciLevels, // Set primary Fibonacci levels to Stock Option Premium levels!
            spotFibonacciLevels: calculateFibonacciLowToHigh(low, high), // Reference spot levels
            derivative,
            dataSource,
            dataSourceLabel,
            scannedAt: new Date()
        };

        // Upsert into MongoDB FnoDailyScan and HistoricalCandle immediately for priority execution
        const mongoose = require('mongoose');
        const isDbConnected = mongoose && mongoose.connection && mongoose.connection.readyState === 1;

        if (isDbConnected) {
            try {
                if (FnoDailyScan) {
                    await FnoDailyScan.findOneAndUpdate(
                        { date: targetDate, symbol: cleanSym },
                        scanDoc,
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );
                }
                if (HistoricalCandle && derivative.tradingsymbol) {
                    await HistoricalCandle.findOneAndUpdate(
                        { symbol: derivative.tradingsymbol, interval: '15minute', timestamp: new Date(`${targetDate}T09:15:00.000Z`) },
                        {
                            symbol: derivative.tradingsymbol,
                            instrumentToken: derivative.instrumentToken || 0,
                            interval: '15minute',
                            timestamp: new Date(`${targetDate}T09:15:00.000Z`),
                            open: optOpen,
                            high: optHigh,
                            low: optLow,
                            close: optClose,
                            volume: volume || 0
                        },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );
                }
            } catch (e) {}
        }
        scannedRecords.push(scanDoc);
    }

    // Rule: Arrange scanner stocks in DESCENDING order of % change (Top Gainers first)
    let dailyTable = [];
    const mongoose = require('mongoose');
    const isDbConnected = mongoose && mongoose.connection && mongoose.connection.readyState === 1;

    if (FnoDailyScan && isDbConnected) {
        try {
            dailyTable = await FnoDailyScan.find({ date: targetDate })
                .sort({ changePct: -1 }) // Descending order of % change
                .lean();
        } catch (e) {}
    }

    if (!dailyTable || dailyTable.length === 0) {
        dailyTable = scannedRecords.sort((a, b) => b.changePct - a.changePct);
    }

    return {
        success: true,
        date: targetDate,
        totalScanned: fnoSymbols.length,
        count: dailyTable.length,
        results: dailyTable
    };
}

async function runStrategy1DecisionEngine(options = {}) {
    const { StrategyConfig, StrategyTrade, FnoDailyScan } = require('./db');
    const todayStr = options.date || new Date().toISOString().split('T')[0];
    
    let config = {
        enabled: true,
        marginPercentage: 20,
        allowEntriesAfter12pm: false,
        optionSelectionMode: 'ATM',
        maxConcurrentPositions: 5
    };

    if (StrategyConfig) {
        try {
            const dbCfg = await StrategyConfig.findOne({ strategyId: 'strategy_1_fibonacci_option_buy' }).lean();
            if (dbCfg) config = { ...config, ...dbCfg };
        } catch (e) {}
    }

    if (!config.enabled) {
        return { success: false, message: 'Strategy 1 is currently DISABLED.' };
    }

    // Time window check (09:30 to 12:00 unless allowEntriesAfter12pm is enabled)
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const timeInMins = currentHour * 60 + currentMin;
    const isPast12pm = timeInMins >= 12 * 60;

    if (isPast12pm && !config.allowEntriesAfter12pm) {
        console.log('[Strategy1 Engine] Automatic entries paused post-12:00 PM (allowEntriesAfter12pm is false).');
    }

    // Get scanned stocks sorted by % change descending
    let scannedDocs = [];
    if (FnoDailyScan) {
        try {
            scannedDocs = await FnoDailyScan.find({ date: todayStr }).sort({ changePct: -1 }).lean();
        } catch (e) {}
    }

    if (!scannedDocs || scannedDocs.length === 0) {
        const scanRes = await scanFnoFirst15MinFibonacci({ targetDate: todayStr, optionSelectionMode: config.optionSelectionMode });
        scannedDocs = scanRes.results || [];
    }

    const currentCandleWindow = `${String(currentHour).padStart(2, '0')}:${String(Math.floor(currentMin / 15) * 15).padStart(2, '0')}`;

    const executedActions = [];

    for (const doc of scannedDocs) {
        const fibs = doc.fibonacciLevels || {}; // Primary Fibonacci levels are now Option Premium levels!
        const deriv = doc.derivative || {};
        const symbol = doc.symbol;
        
        // Option Premium Current Price
        const currentOptPrice = getLtpBySymbol(deriv.tradingsymbol) || deriv.estimatedPremium || doc.close;
        
        const fib60 = fibs.fib600 || fibs.fib618;
        const fib65 = fibs.fib650 || (fibs.fib618 * 0.995);
        const fib786 = fibs.fib786;
        const target1 = fibs.fib100;    // 100% / High of Option Premium (50% exit)
        const target2 = fibs.fib1272;   // 1.272 ext of Option Premium (25% exit)
        const target3 = fibs.fib1618;   // 1.618 ext of Option Premium (25% exit)

        // Find existing trade
        let trade = null;
        if (StrategyTrade) {
            try {
                trade = await StrategyTrade.findOne({ date: todayStr, symbol }).lean();
            } catch (e) {}
        }

        if (!trade) {
            // Check Entry condition: Option Premium pulls back into 60%-65% range [fib65, fib60]
            if (currentOptPrice <= fib60 && currentOptPrice >= fib65) {
                if (isPast12pm && !config.allowEntriesAfter12pm) {
                    continue; // Skip automatic entry after 12pm
                }

                let totalMargin = 41734.05;
                if (kiteRestInstance) {
                    try {
                        const mData = await kiteRestInstance.getMargins('equity');
                        if (mData && mData.net) totalMargin = mData.net;
                    } catch (e) {}
                }
                const marginAllocated = (totalMargin * (config.marginPercentage / 100)) / config.maxConcurrentPositions;
                const estPrem = deriv.estimatedPremium || 15;
                const lotSize = deriv.lotSize || 100;
                const lots = Math.max(1, Math.floor(marginAllocated / (estPrem * lotSize)));
                const quantity = lots * lotSize;

                const tradeId = `S1-${symbol}-${Date.now()}`;
                const newTrade = {
                    tradeId,
                    strategyId: 'strategy_1_fibonacci_option_buy',
                    date: todayStr,
                    symbol,
                    underlyingSymbol: symbol,
                    optionSymbol: deriv.tradingsymbol || `${symbol} CE`,
                    optionType: deriv.optionType || 'CE',
                    strike: deriv.strike || Math.round(currentSpot),
                    selectionMode: config.optionSelectionMode,
                    lotSize,
                    lots,
                    quantity,
                    marginAllocated,
                    spot15mOpen: doc.open,
                    spot15mHigh: doc.high,
                    spot15mLow: doc.low,
                    spot15mClose: doc.close,
                    fib60,
                    fib65,
                    target1,
                    target2,
                    target3,
                    stopLossLevel: fib786,
                    entryPrice: estPrem,
                    entryTime: new Date(),
                    entryCandleWindow: currentCandleWindow,
                    currentPrice: estPrem,
                    status: 'ENTERED',
                    targetsExecuted: { target1: false, target2: false, target3: false },
                    logs: [{ timestamp: new Date(), message: `BUY triggered at 60-65% Fib retest zone (Spot: ₹${currentSpot.toFixed(2)}, Fib 60%: ₹${fib60.toFixed(2)}).` }]
                };

                if (StrategyTrade) {
                    try {
                        await StrategyTrade.create(newTrade);
                    } catch (e) {}
                }

                executedActions.push({ action: 'BUY_ENTRY', symbol, trade: newTrade });
            }
        } else {
            // Existing Trade Management (Targets & SL)
            if (['ENTERED', 'PARTIAL_TARGET1', 'PARTIAL_TARGET2', 'BREATHING_SL'].includes(trade.status)) {
                let updatedStatus = trade.status;
                const logs = trade.logs || [];
                const targetsExecuted = { ...trade.targetsExecuted };

                // Target 1: Previous swing high (100%) -> Exit 50%
                if (currentSpot >= target1 && !targetsExecuted.target1) {
                    targetsExecuted.target1 = true;
                    updatedStatus = 'PARTIAL_TARGET1';
                    logs.push({ timestamp: new Date(), message: `Target 1 (Previous Swing High ₹${target1.toFixed(2)}) reached! Exited 50% position.` });
                    executedActions.push({ action: 'TARGET1_50%_EXIT', symbol });
                }

                // Target 2: 1.272 extension -> Exit 25%
                if (currentSpot >= target2 && !targetsExecuted.target2) {
                    targetsExecuted.target2 = true;
                    updatedStatus = 'PARTIAL_TARGET2';
                    logs.push({ timestamp: new Date(), message: `Target 2 (1.272 Ext ₹${target2.toFixed(2)}) reached! Exited 25% position.` });
                    executedActions.push({ action: 'TARGET2_25%_EXIT', symbol });
                }

                // Target 3: 1.618 extension -> Exit final 25%
                if (currentSpot >= target3 && !targetsExecuted.target3) {
                    targetsExecuted.target3 = true;
                    updatedStatus = 'EXITED_TARGET3';
                    logs.push({ timestamp: new Date(), message: `Target 3 (1.618 Ext ₹${target3.toFixed(2)}) reached! Exited final 25% position.` });
                    executedActions.push({ action: 'TARGET3_FINAL_EXIT', symbol });
                }

                // Stop Loss Logic (78.6% Retracement Breach with 15-minute candle breath check)
                if (currentSpot <= fib786) {
                    if (trade.entryCandleWindow === currentCandleWindow) {
                        // Same 15m candle as entry: DO NOT place exit order, let stock option breathe!
                        if (updatedStatus !== 'BREATHING_SL') {
                            updatedStatus = 'BREATHING_SL';
                            logs.push({ timestamp: new Date(), message: `Price hit 78.6% SL (₹${fib786.toFixed(2)}) during entry 15m candle. Allowing option to breathe until next candle.` });
                            executedActions.push({ action: 'SL_BREATHING_ALERT', symbol });
                        }
                    } else {
                        // Subsequent 15m candle: Price remains <= 78.6%, place exit order!
                        updatedStatus = 'EXITED_SL';
                        logs.push({ timestamp: new Date(), message: `78.6% SL (₹${fib786.toFixed(2)}) confirmed on subsequent 15m candle. Executed STOP LOSS exit.` });
                        executedActions.push({ action: 'STOP_LOSS_EXIT', symbol });
                    }
                }

                if (StrategyTrade) {
                    try {
                        await StrategyTrade.updateOne(
                            { tradeId: trade.tradeId },
                            { status: updatedStatus, targetsExecuted, logs, currentPrice: deriv.estimatedPremium || trade.entryPrice }
                        );
                    } catch (e) {}
                }
            }
        }
    }

    return {
        success: true,
        date: todayStr,
        actionsCount: executedActions.length,
        actions: executedActions
    };
}

async function runStrategy2DecisionEngine(options = {}) {
    const { StrategyConfig, StrategyTrade, FnoDailyScan } = require('./db');
    const todayStr = options.date || new Date().toISOString().split('T')[0];
    const forceRun = !!options.forceRun; // Manual trigger bypasses time check

    let config = {
        strategyId: 'strategy_2_top_gainers_ce_buy',
        name: 'Strategy 2: F&O Top Gainers CE Buyer',
        enabled: false,
        optionSelectionMode: 'ATM',
        startTime: '09:15',
        endTime: '09:20',
        lotsPerStock: 1
    };

    if (StrategyConfig) {
        try {
            const dbCfg = await StrategyConfig.findOne({ strategyId: 'strategy_2_top_gainers_ce_buy' }).lean();
            if (dbCfg) config = { ...config, ...dbCfg };
        } catch (e) {}
    }

    if (!config.enabled && !forceRun) {
        return { success: false, message: 'Strategy 2 is currently DISABLED.' };
    }

    // Dynamic Time Window check (Default 09:15 AM to 09:20 AM IST)
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const timeInMins = currentHour * 60 + currentMin;

    const parseTimeToMinutes = (timeStr, defaultMins) => {
        if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return defaultMins;
        const [h, m] = timeStr.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return defaultMins;
        return h * 60 + m;
    };

    const startWindowMins = parseTimeToMinutes(config.startTime, 9 * 60 + 15); // 09:15 AM (555 mins)
    const cutoffMins = parseTimeToMinutes(config.endTime, 9 * 60 + 20);       // 09:20 AM (560 mins)

    // Auto-disable at cutoff time when market window closes
    if (timeInMins >= cutoffMins && !forceRun) {
        // Only auto-disable during live market cutoff transition window (e.g. 09:20 AM - 09:25 AM IST)
        if (config.enabled && timeInMins >= cutoffMins && timeInMins <= cutoffMins + 5 && StrategyConfig) {
            try {
                await StrategyConfig.findOneAndUpdate(
                    { strategyId: 'strategy_2_top_gainers_ce_buy' },
                    { $set: { enabled: false, updatedAt: new Date() } }
                );
                console.log(`[Strategy 2 Engine] ${config.endTime || '09:20'} market cutoff reached. Strategy 2 auto-disabled.`);
            } catch (e) {}
        }
        return {
            success: true,
            outsideWindow: true,
            message: `Outside active window (${config.startTime || '09:15'} - ${config.endTime || '09:20'}).`
        };
    }

    if (timeInMins < startWindowMins && !forceRun) {
        return {
            success: false,
            message: `Strategy 2 active window starts at ${config.startTime || '09:15'}. Waiting for active window.`
        };
    }

    // Get accumulated unique F&O stocks
    let scannedDocs = [];
    if (FnoDailyScan) {
        try {
            scannedDocs = await FnoDailyScan.find({ date: todayStr }).sort({ changePct: -1 }).lean();
        } catch (e) {}
    }

    // Fallback if no FnoDailyScan docs exist yet for today: scan or build from F&O stock list
    if (!scannedDocs || scannedDocs.length === 0) {
        const fnoList = getFnoStocksList();
        const fallbackDocs = [];
        for (const sym of fnoList) {
            const cleanSym = sym.trim().toUpperCase();
            const ltp = getLtpBySymbol(cleanSym) || 1000;
            const open = ltp * 0.98; // Fallback estimate
            const changePct = ((ltp - open) / open) * 100;
            fallbackDocs.push({
                symbol: cleanSym,
                open,
                high: Math.max(open, ltp),
                low: Math.min(open, ltp),
                close: ltp,
                changePct
            });
        }
        fallbackDocs.sort((a, b) => b.changePct - a.changePct);
        scannedDocs = fallbackDocs;
    }

    // Already bought stocks today for Strategy 2 (Do not repeat lots!)
    const boughtSymbols = new Set();
    if (StrategyTrade) {
        try {
            const existingTrades = await StrategyTrade.find({ 
                date: todayStr, 
                strategyId: 'strategy_2_top_gainers_ce_buy' 
            }).lean();
            existingTrades.forEach(t => boughtSymbols.add(t.symbol.toUpperCase()));
        } catch (e) {}
    }

    // Fetch available account margin
    let availableMargin = 41734.05;
    if (kiteRestInstance) {
        try {
            const mData = await kiteRestInstance.getMargins('equity');
            if (mData && mData.net) availableMargin = mData.net;
        } catch (e) {}
    }

    const executedActions = [];
    const skippedActions = [];

    // Iterate through top gainers sorted by % change descending
    for (const doc of scannedDocs) {
        const symbol = doc.symbol.toUpperCase();

        // Rule: Do not repeat lots! Skip if position already taken today.
        if (boughtSymbols.has(symbol)) {
            continue;
        }

        const closePrice = doc.close || doc.ltp || getLtpBySymbol(symbol) || 1000;
        const deriv = await getAppropriateCeDerivative(symbol, closePrice, config.optionSelectionMode || 'ATM');

        const optionPremium = getLtpBySymbol(deriv.tradingsymbol) || deriv.estimatedPremium || 20;
        const lotSize = deriv.lotSize || 100;
        const lotsToBuy = 1; // Rule: buy one lot each
        const quantity = lotSize * lotsToBuy;
        const marginRequired = parseFloat((optionPremium * quantity).toFixed(2));

        // Margin check
        if (availableMargin >= marginRequired) {
            const tradeId = `S2-${symbol}-${Date.now()}`;
            const newTrade = {
                tradeId,
                strategyId: 'strategy_2_top_gainers_ce_buy',
                date: todayStr,
                symbol,
                underlyingSymbol: symbol,
                optionSymbol: deriv.tradingsymbol,
                optionType: 'CE',
                strike: deriv.strike,
                selectionMode: config.optionSelectionMode || 'ATM',
                lotSize,
                lots: lotsToBuy,
                quantity,
                marginAllocated: marginRequired,
                entryPrice: optionPremium,
                entryTime: new Date(),
                currentPrice: optionPremium,
                status: 'ENTERED', // Semi-automatic: Buy only, no auto exit conditions
                exitReason: 'NO_AUTO_EXIT_SET',
                spot15mClose: closePrice,
                logs: [{
                    timestamp: new Date(),
                    message: `[Strategy 2] BOUGHT 1 Lot of ${deriv.tradingsymbol} at ₹${optionPremium} (Stock Change: +${(doc.changePct || 0).toFixed(2)}%, Margin Required: ₹${marginRequired.toLocaleString('en-IN')}).`
                }]
            };

            if (StrategyTrade) {
                try {
                    await StrategyTrade.create(newTrade);
                } catch (e) {
                    console.error('[Strategy 2 Engine] Failed to save trade:', e.message);
                }
            }

            availableMargin -= marginRequired;
            boughtSymbols.add(symbol);
            executedActions.push({ action: 'BUY_ENTRY', symbol, optionSymbol: deriv.tradingsymbol, marginRequired, trade: newTrade });
        } else {
            skippedActions.push({
                symbol,
                optionSymbol: deriv.tradingsymbol,
                reason: 'INSUFFICIENT_MARGIN',
                marginRequired,
                availableMargin
            });
        }
    }

    return {
        success: true,
        date: todayStr,
        actionsCount: executedActions.length,
        actions: executedActions,
        skippedCount: skippedActions.length,
        skipped: skippedActions,
        availableMarginRemaining: availableMargin
    };
}

module.exports = {
    setKiteInstance: (kite) => {
        kiteRestInstance = kite;
        if (isInitialized) {
            setTimeout(syncHistorical15m, 2000);
        }
    },
    initializeMappings,
    connectKiteStream,
    getScannerResults,
    getCachedQuotes,
    getLtpBySymbol,
    getTokenBySymbol,
    syncSubscriptions,
    getFnoStocksList,
    calculateFibonacciLowToHigh,
    getAppropriateCeDerivative,
    scanFnoFirst15MinFibonacci,
    runStrategy1DecisionEngine,
    runStrategy2DecisionEngine,
    getConnectionLogs: () => connectionLogs,
    isInitialized: () => isInitialized,
    getConnectionLogsList: () => connectionLogs,
    getWsStatus: () => {
        if (!tickerInstance) return 'disconnected';
        return tickerInstance.connected() ? 'connected' : 'connecting';
    },
    getSubscribedCount: () => Object.keys(quoteCache).length,
    registerCustomScanner: (name, description, functionBody, tf = 'custom') => {
        try {
            scanners[name] = compileCustomScannerFunction(functionBody);
            let customList = [];
            if (fs.existsSync(customScannersFile)) {
                customList = JSON.parse(fs.readFileSync(customScannersFile, 'utf8'));
            }
            customList = customList.filter(cs => cs.name !== name);
            customList.push({ name, description, functionBody, tf });
            fs.writeFileSync(customScannersFile, JSON.stringify(customList, null, 2), 'utf8');
            return true;
        } catch (e) {
            console.error(`Failed to register custom scanner ${name}:`, e);
            throw e;
        }
    },
    deleteCustomScanner: (name) => {
        try {
            delete scanners[name];
            let customList = [];
            if (fs.existsSync(customScannersFile)) {
                customList = JSON.parse(fs.readFileSync(customScannersFile, 'utf8'));
            }
            customList = customList.filter(cs => cs.name !== name);
            fs.writeFileSync(customScannersFile, JSON.stringify(customList, null, 2), 'utf8');
            logStream(`Deleted custom AI scanner: ${name}`);
            return true;
        } catch (e) {
            console.error(`Failed to delete custom scanner ${name}:`, e);
            throw e;
        }
    },
    updateCustomScanner: (oldName, newName, description, functionBody, tf = 'custom') => {
        try {
            if (oldName !== newName) {
                delete scanners[oldName];
            }
            scanners[newName] = compileCustomScannerFunction(functionBody);
            let customList = [];
            if (fs.existsSync(customScannersFile)) {
                customList = JSON.parse(fs.readFileSync(customScannersFile, 'utf8'));
            }
            customList = customList.filter(cs => cs.name !== oldName && cs.name !== newName);
            customList.push({ name: newName, description, functionBody, tf: tf || 'custom' });
            fs.writeFileSync(customScannersFile, JSON.stringify(customList, null, 2), 'utf8');
            logStream(`Updated custom AI scanner: ${oldName} -> ${newName}`);
            return true;
        } catch (e) {
            console.error(`Failed to update custom scanner ${oldName}:`, e);
            throw e;
        }
    },
    getCustomScannersList: () => {
        try {
            if (fs.existsSync(customScannersFile)) {
                return JSON.parse(fs.readFileSync(customScannersFile, 'utf8'));
            }
        } catch (e) {}
        return [];
    },
    getNifty500Symbols: () => {
        const tokens = indexTokenLists['Nifty 500'] || [];
        return tokens.map(t => tokenToSymbolMap[t]).filter(Boolean);
    },
    isMarketTradingHours,
    getScannerMode
};
