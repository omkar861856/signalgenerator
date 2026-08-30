const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;


const AppStateSchema = new mongoose.Schema({
    key: { type: String, default: 'global_state', unique: true },
    selectedMarginPercentage: { type: Number, default: 100 },
    watchlistedStocks: { type: [String], default: [] },
    subscribedTokens: { type: [Number], default: [] },
    intradayTriggers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    openOrdersDecisions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    intradayActionsLogs: { type: [String], default: [] },
    activeStrategy: { type: String, default: 'momentum_surfing_morning' },
    customStopLossPercent: { type: Number, default: 2 },
    customTargetPercent: { type: Number, default: 4 },
    customSystemPrompt: { type: String, default: '' },
    profitTargetExit: { type: Number, default: 0 },
    lossTargetExit: { type: Number, default: 0 },
    pnlExitMode: { type: String, default: 'current' },
    pnlExitAutoEnabled: { type: Boolean, default: false },
    systemAutomationEnabled: { type: Boolean, default: true },
    reallocationAutoEnabled: { type: Boolean, default: false },
    equityStopLossPercent: { type: Number, default: 1 },
    equityTargetPercent: { type: Number, default: 2 },
    fnoStopLossPercent: { type: Number, default: 15 },
    fnoTargetPercent: { type: Number, default: 30 },
    activeAssetMode: { type: String, default: 'equity' },
    smartRiskParams: { type: mongoose.Schema.Types.Mixed, default: { autoTradeEnabled: true, capitalPerTrade: 25000, maxAllocation: 100000, stopLossPct: 1.5, targetProfitPct: 3.5, trailingSlPct: 0.8, productType: 'MIS' } }
}, { minimize: false, timestamps: true });

const AppState = mongoose.model('AppState', AppStateSchema);

const HistoricalCandleSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    instrumentToken: { type: Number, required: true },
    interval: { type: String, required: true },
    timestamp: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, default: 0 },
    oi: { type: Number, default: 0 }
}, { collection: 'candles', timestamps: true, bufferCommands: false });

HistoricalCandleSchema.index({ symbol: 1, interval: 1, timestamp: 1 }, { unique: true });
HistoricalCandleSchema.index({ timestamp: 1 }, { expireAfterSeconds: 14 * 86400 });
HistoricalCandleSchema.index({ instrumentToken: 1 });

const HistoricalCandle = mongoose.model('HistoricalCandle', HistoricalCandleSchema);

// Register connection lifecycle handlers
mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Connection lost. Mongoose will attempt auto-reconnecting...');
});
mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
});
mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Connection re-established successfully.');
});

async function connectDB(retries = 15, delayMs = 3000) {
    if (!MONGO_URI) {
        console.error('[MongoDB] MONGO_URI is not defined in environment variables.');
        return;
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await mongoose.connect(MONGO_URI, {
                serverSelectionTimeoutMS: 5000,
                bufferCommands: false
            });
            console.log('[MongoDB] Connected successfully to database.');
            
            // Ensure default global state document exists
            let state = await AppState.findOne({ key: 'global_state' });
            if (!state) {
                state = new AppState({ key: 'global_state', pnlExitMode: 'current', pnlExitAutoEnabled: false });
                await state.save();
                console.log('[MongoDB] Created default global state document.');
            } else {
                console.log('[MongoDB] Loaded existing global state document.');
            }
            return;
        } catch (err) {
            console.error(`[MongoDB] Connection attempt ${attempt}/${retries} failed: ${err.message}`);
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                console.error('[MongoDB] Initial connection retries exhausted. Retrying connection in background...');
                setTimeout(() => connectDB(5, 5000), 10000);
            }
        }
    }
}

const KiteDocSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    content: { type: String, required: true }
}, { timestamps: true, bufferCommands: false });

const KiteDoc = mongoose.model('KiteDoc', KiteDocSchema);

const InstrumentSchema = new mongoose.Schema({
    instrument_token: { type: Number, required: true, unique: true },
    exchange_token: { type: String },
    tradingsymbol: { type: String, required: true },
    name: { type: String },
    last_price: { type: Number },
    expiry: { type: String },
    strike: { type: Number },
    tick_size: { type: Number },
    lot_size: { type: Number },
    instrument_type: { type: String },
    segment: { type: String },
    exchange: { type: String }
}, { timestamps: true, bufferCommands: false });

InstrumentSchema.index({ tradingsymbol: 1 });
InstrumentSchema.index({ exchange: 1, tradingsymbol: 1 });
InstrumentSchema.index({ segment: 1, instrument_type: 1 });
InstrumentSchema.index({ name: 1, segment: 1 });

const Instrument = mongoose.model('Instrument', InstrumentSchema);

const FnoDailyScanSchema = new mongoose.Schema({
    date: { type: String, required: true, index: true }, // Format YYYY-MM-DD
    symbol: { type: String, required: true },
    instrumentToken: { type: Number },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, default: 0 },
    bodyLength: { type: Number, required: true },
    bodyPercent: { type: Number, required: true },
    isGreen: { type: Boolean, default: true },
    changePct: { type: Number, default: 0 },
    fibonacciLevels: {
        fib0: { type: Number },     // Low (0%)
        fib236: { type: Number },   // 23.6%
        fib382: { type: Number },   // 38.2%
        fib500: { type: Number },   // 50%
        fib600: { type: Number },   // 60% Retracement
        fib618: { type: Number },   // 61.8% Retracement (Golden ratio)
        fib650: { type: Number },   // 65% Retracement
        fib786: { type: Number },   // 78.6% Retracement (Stop loss level)
        fib100: { type: Number },   // High (100% - Previous swing high)
        fib1272: { type: Number },  // 127.2% Target 2
        fib1618: { type: Number },  // 161.8% Target 3
        fib2000: { type: Number },  // 200%
        fib2618: { type: Number }   // 261.8%
    },
    derivative: {
        tradingsymbol: { type: String },
        instrumentToken: { type: Number },
        strike: { type: Number },
        optionType: { type: String, default: 'CE' },
        selectionMode: { type: String, default: 'ATM' }, // 'ATM' or '1ITM'
        expiry: { type: String },
        lotSize: { type: Number, default: 1 },
        estimatedPremium: { type: Number, default: 0 },
        minMarginRequired: { type: Number, default: 0 }
    },
    dataSource: { type: String, default: 'HISTORICAL' },
    dataSourceLabel: { type: String, default: 'HISTORICAL MARKET DATA' },
    scannedAt: { type: Date, default: Date.now }
}, { collection: 'fno_daily_scans', timestamps: true, bufferCommands: false });

FnoDailyScanSchema.index({ date: 1, symbol: 1 }, { unique: true });
FnoDailyScanSchema.index({ date: 1, changePct: -1 });

const FnoDailyScan = mongoose.model('FnoDailyScan', FnoDailyScanSchema);

// Strategy Configuration Schema
const StrategyConfigSchema = new mongoose.Schema({
    strategyId: { type: String, required: true, unique: true, default: 'strategy_1_fibonacci_option_buy' },
    name: { type: String, default: '1st 15-Minute F&O Fibonacci Option Buying Strategy' },
    enabled: { type: Boolean, default: false },
    marginPercentage: { type: Number, default: 20 }, // Margin utilization % (e.g. 20%)
    allowEntriesAfter12pm: { type: Boolean, default: false },
    optionSelectionMode: { type: String, default: 'ATM' }, // 'ATM' | '1ITM'
    minBodyPercent: { type: Number, default: 0.05 },
    maxConcurrentPositions: { type: Number, default: 5 },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'strategy_configs', timestamps: true });

const StrategyConfig = mongoose.model('StrategyConfig', StrategyConfigSchema);

// Strategy Trade Execution & SL Breath Monitoring Schema
const StrategyTradeSchema = new mongoose.Schema({
    tradeId: { type: String, required: true, unique: true },
    strategyId: { type: String, default: 'strategy_1_fibonacci_option_buy' },
    date: { type: String, required: true, index: true },
    symbol: { type: String, required: true },
    underlyingSymbol: { type: String, required: true },
    optionSymbol: { type: String, required: true },
    optionType: { type: String, default: 'CE' },
    strike: { type: Number, required: true },
    selectionMode: { type: String, default: 'ATM' },
    lotSize: { type: Number, default: 1 },
    lots: { type: Number, default: 1 },
    quantity: { type: Number, default: 1 },
    marginAllocated: { type: Number, default: 0 },
    spot15mOpen: { type: Number },
    spot15mHigh: { type: Number },
    spot15mLow: { type: Number },
    spot15mClose: { type: Number },
    fib60: { type: Number },
    fib65: { type: Number },
    target1: { type: Number }, // Previous high (50% exit)
    target2: { type: Number }, // 1.272 ext (25% exit)
    target3: { type: Number }, // 1.618 ext (25% exit)
    stopLossLevel: { type: Number }, // 78.6% retracement
    entryPrice: { type: Number },
    entryTime: { type: Date },
    entryCandleWindow: { type: String }, // e.g. "09:30-09:45"
    currentPrice: { type: Number },
    status: { 
        type: String, 
        enum: ['WATCHING', 'ENTERED', 'PARTIAL_TARGET1', 'PARTIAL_TARGET2', 'EXITED_TARGET3', 'BREATHING_SL', 'EXITED_SL', 'CANCELLED'],
        default: 'WATCHING' 
    },
    targetsExecuted: {
        target1: { type: Boolean, default: false },
        target2: { type: Boolean, default: false },
        target3: { type: Boolean, default: false }
    },
    slBreachedCandleWindow: { type: String }, // Timestamp window when 78.6% hit
    exitPrice: { type: Number },
    exitTime: { type: Date },
    exitReason: { type: String },
    pnl: { type: Number, default: 0 },
    logs: [{ timestamp: { type: Date, default: Date.now }, message: String }]
}, { collection: 'strategy_trades', timestamps: true });

StrategyTradeSchema.index({ date: 1, symbol: 1 });
StrategyTradeSchema.index({ status: 1 });

const StrategyTrade = mongoose.model('StrategyTrade', StrategyTradeSchema);

const DailyUniqueScannerStockSchema = new mongoose.Schema({
    date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    symbol: { type: String, required: true },            // Short tradingsymbol e.g. RELIANCE
    fullName: { type: String },                          // Full symbol e.g. NSE:RELIANCE
    ltp: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
    isFno: { type: Boolean, default: false },            // Options chain enabled stock flag
    scannersMatched: { type: [String], default: [] },    // Array of scanner names where stock appeared today
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now }
}, { collection: 'daily_unique_scanner_stocks', timestamps: true, bufferCommands: false });

DailyUniqueScannerStockSchema.index({ date: 1, symbol: 1 }, { unique: true });
DailyUniqueScannerStockSchema.index({ date: 1, isFno: 1 });

const DailyUniqueScannerStock = mongoose.model('DailyUniqueScannerStock', DailyUniqueScannerStockSchema);

async function cleanupRedundantDBData() {
    if (mongoose.connection.readyState !== 1) {
        console.log('[DB Maintenance] Skipping cleanup - MongoDB is not connected.');
        return { deletedCount: 0 };
    }
    try {
        console.log('[DB Maintenance] Starting redundant data cleanup...');
        
        // 0. Auto-prune historical candles older than 7 days
        const cutoff7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const oldCandlesRes = await HistoricalCandle.deleteMany({ timestamp: { $lt: cutoff7Days } });
        if (oldCandlesRes.deletedCount > 0) {
            console.log(`[DB Maintenance] Auto-pruned ${oldCandlesRes.deletedCount} historical candles older than 7 days.`);
        }

        // 1. Wipe invalid/corrupted candles (missing or NaN OHLC)
        const invalidCandlesRes = await HistoricalCandle.deleteMany({
            $or: [
                { open: { $exists: false } },
                { high: { $exists: false } },
                { low: { $exists: false } },
                { close: { $exists: false } },
                { open: null },
                { close: null }
            ]
        });
        console.log(`[DB Maintenance] Removed ${invalidCandlesRes.deletedCount || 0} invalid/corrupted candle records.`);

        // 2. Remove duplicate candles by (symbol, interval, timestamp)
        const candleDuplicates = await HistoricalCandle.aggregate([
            {
                $group: {
                    _id: { symbol: "$symbol", interval: "$interval", timestamp: "$timestamp" },
                    dups: { $push: "$_id" },
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]);

        let removedCandleDups = 0;
        for (const doc of candleDuplicates) {
            const idsToDelete = doc.dups.slice(1);
            const delRes = await HistoricalCandle.deleteMany({ _id: { $in: idsToDelete } });
            removedCandleDups += delRes.deletedCount || 0;
        }
        console.log(`[DB Maintenance] Removed ${removedCandleDups} duplicate candle records.`);

        // 3. Remove duplicate instruments by instrument_token
        const instrumentDuplicates = await Instrument.aggregate([
            {
                $group: {
                    _id: "$instrument_token",
                    dups: { $push: "$_id" },
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]);

        let removedInstDups = 0;
        for (const doc of instrumentDuplicates) {
            const idsToDelete = doc.dups.slice(1);
            const delRes = await Instrument.deleteMany({ _id: { $in: idsToDelete } });
            removedInstDups += delRes.deletedCount || 0;
        }
        console.log(`[DB Maintenance] Removed ${removedInstDups} duplicate instrument records.`);

        // 4. Clean AppState lists
        const state = await AppState.findOne({ key: 'global_state' });
        if (state) {
            let modified = false;
            if (Array.isArray(state.watchlistedStocks)) {
                const uniqueWatchlist = [...new Set(state.watchlistedStocks.filter(Boolean))];
                if (uniqueWatchlist.length !== state.watchlistedStocks.length) {
                    state.watchlistedStocks = uniqueWatchlist;
                    modified = true;
                }
            }
            if (Array.isArray(state.subscribedTokens)) {
                const uniqueTokens = [...new Set(state.subscribedTokens.filter(Boolean))];
                if (uniqueTokens.length !== state.subscribedTokens.length) {
                    state.subscribedTokens = uniqueTokens;
                    modified = true;
                }
            }
            if (modified) {
                await state.save();
                console.log('[DB Maintenance] Cleaned AppState watchlist and token duplicates.');
            }
        }

        console.log('[DB Maintenance] Database cleanup completed successfully!');
        return {
            success: true,
            invalidCandlesRemoved: invalidCandlesRes.deletedCount || 0,
            duplicateCandlesRemoved: removedCandleDups,
            duplicateInstrumentsRemoved: removedInstDups
        };
    } catch (err) {
        console.error('[DB Maintenance] Error during DB cleanup:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    connectDB,
    AppState,
    HistoricalCandle,
    KiteDoc,
    Instrument,
    FnoDailyScan,
    DailyUniqueScannerStock,
    StrategyConfig,
    StrategyTrade,
    cleanupRedundantDBData
};
