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
    pnlExitAutoEnabled: { type: Boolean, default: true },
    reallocationAutoEnabled: { type: Boolean, default: false },
    equityStopLossPercent: { type: Number, default: 1 },
    equityTargetPercent: { type: Number, default: 2 },
    fnoStopLossPercent: { type: Number, default: 15 },
    fnoTargetPercent: { type: Number, default: 30 },
    activeAssetMode: { type: String, default: 'equity' }
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
}, { collection: 'candles', timestamps: true });

HistoricalCandleSchema.index({ symbol: 1, interval: 1, timestamp: 1 }, { unique: true });
HistoricalCandleSchema.index({ timestamp: 1 });
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
                serverSelectionTimeoutMS: 5000
            });
            console.log('[MongoDB] Connected successfully to database.');
            
            // Ensure default global state document exists
            let state = await AppState.findOne({ key: 'global_state' });
            if (!state) {
                state = new AppState({ key: 'global_state', pnlExitMode: 'current', pnlExitAutoEnabled: true });
                await state.save();
                console.log('[MongoDB] Created default global state document.');
            } else {
                state.pnlExitMode = 'current';
                state.pnlExitAutoEnabled = true;
                await state.save();
                console.log('[MongoDB] Updated global state to set pnlExitMode: current and pnlExitAutoEnabled: true.');
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
}, { timestamps: true });

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
}, { timestamps: true });

InstrumentSchema.index({ tradingsymbol: 1 });
InstrumentSchema.index({ exchange: 1, tradingsymbol: 1 });

const Instrument = mongoose.model('Instrument', InstrumentSchema);

async function cleanupRedundantDBData() {
    try {
        console.log('[DB Maintenance] Starting redundant data cleanup...');
        
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
    cleanupRedundantDBData
};
