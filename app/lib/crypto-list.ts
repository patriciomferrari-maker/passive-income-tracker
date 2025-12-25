// Popular Cryptocurrencies List
// Top 50 cryptocurrencies by market cap

export interface CryptoInfo {
    symbol: string;
    name: string;
    coingeckoId: string;
}

export const POPULAR_CRYPTOS: CryptoInfo[] = [
    { symbol: 'BTC', name: 'Bitcoin', coingeckoId: 'bitcoin' },
    { symbol: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum' },
    { symbol: 'USDT', name: 'Tether', coingeckoId: 'tether' },
    { symbol: 'BNB', name: 'BNB', coingeckoId: 'binancecoin' },
    { symbol: 'SOL', name: 'Solana', coingeckoId: 'solana' },
    { symbol: 'USDC', name: 'USDC', coingeckoId: 'usd-coin' },
    { symbol: 'XRP', name: 'XRP', coingeckoId: 'ripple' },
    { symbol: 'ADA', name: 'Cardano', coingeckoId: 'cardano' },
    { symbol: 'DOGE', name: 'Dogecoin', coingeckoId: 'dogecoin' },
    { symbol: 'TRX', name: 'TRON', coingeckoId: 'tron' },
    { symbol: 'AVAX', name: 'Avalanche', coingeckoId: 'avalanche-2' },
    { symbol: 'LINK', name: 'Chainlink', coingeckoId: 'chainlink' },
    { symbol: 'TON', name: 'Toncoin', coingeckoId: 'the-open-network' },
    { symbol: 'DOT', name: 'Polkadot', coingeckoId: 'polkadot' },
    { symbol: 'MATIC', name: 'Polygon', coingeckoId: 'matic-network' },
    { symbol: 'SHIB', name: 'Shiba Inu', coingeckoId: 'shiba-inu' },
    { symbol: 'DAI', name: 'Dai', coingeckoId: 'dai' },
    { symbol: 'LTC', name: 'Litecoin', coingeckoId: 'litecoin' },
    { symbol: 'BCH', name: 'Bitcoin Cash', coingeckoId: 'bitcoin-cash' },
    { symbol: 'UNI', name: 'Uniswap', coingeckoId: 'uniswap' },
    { symbol: 'ATOM', name: 'Cosmos', coingeckoId: 'cosmos' },
    { symbol: 'XLM', name: 'Stellar', coingeckoId: 'stellar' },
    { symbol: 'NEAR', name: 'NEAR Protocol', coingeckoId: 'near' },
    { symbol: 'XMR', name: 'Monero', coingeckoId: 'monero' },
    { symbol: 'APT', name: 'Aptos', coingeckoId: 'aptos' },
    { symbol: 'ALGO', name: 'Algorand', coingeckoId: 'algorand' },
    { symbol: 'VET', name: 'VeChain', coingeckoId: 'vechain' },
    { symbol: 'FIL', name: 'Filecoin', coingeckoId: 'filecoin' },
    { symbol: 'AAVE', name: 'Aave', coingeckoId: 'aave' },
    { symbol: 'ETC', name: 'Ethereum Classic', coingeckoId: 'ethereum-classic' },
    { symbol: 'ARB', name: 'Arbitrum', coingeckoId: 'arbitrum' },
    { symbol: 'OP', name: 'Optimism', coingeckoId: 'optimism' },
    { symbol: 'GRT', name: 'The Graph', coingeckoId: 'the-graph' },
    { symbol: 'SAND', name: 'The Sandbox', coingeckoId: 'the-sandbox' },
    { symbol: 'MANA', name: 'Decentraland', coingeckoId: 'decentraland' },
    { symbol: 'AXS', name: 'Axie Infinity', coingeckoId: 'axie-infinity' },
    { symbol: 'FTM', name: 'Fantom', coingeckoId: 'fantom' },
    { symbol: 'HBAR', name: 'Hedera', coingeckoId: 'hedera-hashgraph' },
    { symbol: 'EOS', name: 'EOS', coingeckoId: 'eos' },
    { symbol: 'XTZ', name: 'Tezos', coingeckoId: 'tezos' },
    { symbol: 'THETA', name: 'Theta Network', coingeckoId: 'theta-token' },
    { symbol: 'FLOW', name: 'Flow', coingeckoId: 'flow' },
    { symbol: 'ICP', name: 'Internet Computer', coingeckoId: 'internet-computer' },
    { symbol: 'EGLD', name: 'MultiversX', coingeckoId: 'elrond-erd-2' },
    { symbol: 'KCS', name: 'KuCoin Token', coingeckoId: 'kucoin-shares' },
    { symbol: 'CAKE', name: 'PancakeSwap', coingeckoId: 'pancakeswap-token' },
    { symbol: 'CRO', name: 'Cronos', coingeckoId: 'crypto-com-chain' },
    { symbol: 'ZEC', name: 'Zcash', coingeckoId: 'zcash' },
    { symbol: 'DASH', name: 'Dash', coingeckoId: 'dash' },
    { symbol: 'NEO', name: 'Neo', coingeckoId: 'neo' },
];

/**
 * Find crypto info by symbol
 */
export function findCryptoBySymbol(symbol: string): CryptoInfo | undefined {
    return POPULAR_CRYPTOS.find(
        c => c.symbol.toLowerCase() === symbol.toLowerCase()
    );
}

/**
 * Find crypto info by CoinGecko ID
 */
export function findCryptoByCoingeckoId(id: string): CryptoInfo | undefined {
    return POPULAR_CRYPTOS.find(c => c.coingeckoId === id);
}

/**
 * Get crypto icon/emoji
 */
export function getCryptoIcon(symbol: string): string {
    const icons: Record<string, string> = {
        BTC: '₿',
        ETH: 'Ξ',
        USDT: '₮',
        BNB: '🔶',
        SOL: '◎',
        USDC: '🔵',
        XRP: '✕',
        ADA: '₳',
        DOGE: '🐕',
        DOT: '⬤',
        MATIC: '🟣',
        LINK: '⬢',
        UNI: '🦄',
        ATOM: '⚛️',
    };

    return icons[symbol.toUpperCase()] || '🪙';
}
