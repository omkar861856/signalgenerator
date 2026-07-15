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
function calculateEMA(candles, period) {
    if (candles.length < period) return 0;
    const k = 2 / (period + 1);
    let ema = candles[0].close;
    for (let i = 1; i < candles.length; i++) {
        ema = candles[i].close * k + ema * (1 - k);
    }
    return ema;
}

function calculateRSI(candles, period = 14) {
    if (candles.length <= period) return 50;
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

function calculateMACD(candles) {
    if (candles.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    
    // Simple MACD calculation: EMA12 - EMA26
    const ema12 = calculateEMA(candles, 12);
    const ema26 = calculateEMA(candles, 26);
    const macd = ema12 - ema26;
    
    // Signal line is EMA9 of MACD
    // To simplify, we return the macd value and a signal line mock
    return {
        macd,
        signal: macd * 0.9,
        histogram: macd - (macd * 0.9)
    };
}

function calculateBollingerBands(candles, period = 20, stdDevMultiplier = 2) {
    if (candles.length < period) return { middle: 0, upper: 0, lower: 0, bandwidth: 0 };
    
    const slice = candles.slice(-period);
    const sum = slice.reduce((acc, c) => acc + c.close, 0);
    const middle = sum / period;
    
    const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const upper = middle + stdDevMultiplier * stdDev;
    const lower = middle - stdDevMultiplier * stdDev;
    const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
    
    return { middle, upper, lower, bandwidth };
}

function calculateVWAP(candles) {
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
        return Math.abs(tick.change) < 0.3;
    },
    'F&O IV Crush Setup': (tick, candles) => {
        return tick.change > -0.5 && tick.change < 0.5;
    },
    'Futures Long Buildup': (tick, candles) => {
        if (!candles || candles.length < 5) return false;
        const avgVol = candles.slice(-5).reduce((acc, c) => acc + c.volume, 0) / 5;
        return tick.change > 1.2 && tick.volume > avgVol * 1.3;
    },
    'Futures Short Buildup': (tick, candles) => {
        if (!candles || candles.length < 5) return false;
        const avgVol = candles.slice(-5).reduce((acc, c) => acc + c.volume, 0) / 5;
        return tick.change < -1.2 && tick.volume > avgVol * 1.3;
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
                    scanners[cs.name] = new Function('tick', 'candles', cs.functionBody);
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
        logStream("CRITICAL: Reconnection limits exceeded. No more reconnection attempts will be made.");
    });
}

// REST helper to return scanner results
function getScannerResults(scannerName, indexName) {
    const scannerFn = scanners[scannerName];
    if (!scannerFn) return [];
    
    const tokens = indexTokenLists[indexName] || [];
    const results = [];

    tokens.forEach(token => {
        const tick = quoteCache[token];
        const candles = historicalCandles[token] || [];
        if (tick && tick.ltp > 0) {
            try {
                // Pass token as third argument for strategies that need specific cache (like 15m)
                const matched = scannerFn(tick, candles, token);
                if (matched) {
                    const symbolClean = tick.symbol.split(':').pop();
                    results.push({
                        symbol: symbolClean,
                        fullName: tick.symbol,
                        ltp: tick.ltp,
                        change: parseFloat(tick.change.toFixed(2)),
                        volume: tick.volume,
                        buyQty: tick.depth?.buy?.reduce((acc, d) => acc + d.quantity, 0) || 0,
                        sellQty: tick.depth?.sell?.reduce((acc, d) => acc + d.quantity, 0) || 0
                    });
                }
            } catch (err) {
                // Ignore calculation errors for single stock baseline
            }
        }
    });

    // Sort results by absolute change descending
    return results.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
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
    let token = symbolToTokenMap[symbol] || symbolToTokenMap[`NSE:${symbol}`] || symbolToTokenMap[`BSE:${symbol}`];
    if (token && quoteCache[token]) {
        return quoteCache[token].ltp;
    }
    return null;
}

function getTokenBySymbol(symbol) {
    return symbolToTokenMap[symbol] || symbolToTokenMap[`NSE:${symbol}`] || symbolToTokenMap[`BSE:${symbol}`] || null;
}

module.exports = {
    setKiteInstance: (kite) => {
        kiteRestInstance = kite;
        // Start sync shortly after getting the instance, if initialized
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
    getConnectionLogs: () => connectionLogs,
    isInitialized: () => isInitialized,
    getConnectionLogsList: () => connectionLogs,
    getWsStatus: () => {
        if (!tickerInstance) return 'disconnected';
        return tickerInstance.connected() ? 'connected' : 'connecting';
    },
    getSubscribedCount: () => Object.keys(quoteCache).length,
    registerCustomScanner: (name, description, functionBody) => {
        try {
            scanners[name] = new Function('tick', 'candles', functionBody);
            let customList = [];
            if (fs.existsSync(customScannersFile)) {
                customList = JSON.parse(fs.readFileSync(customScannersFile, 'utf8'));
            }
            customList = customList.filter(cs => cs.name !== name);
            customList.push({ name, description, functionBody });
            fs.writeFileSync(customScannersFile, JSON.stringify(customList, null, 2), 'utf8');
            return true;
        } catch (e) {
            console.error(`Failed to register custom scanner ${name}:`, e);
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
    }
};
