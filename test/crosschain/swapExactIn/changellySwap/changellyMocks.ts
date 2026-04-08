import type { FixRateForAmountResponse, CreateFixTransactionResponse, CurrencyFullResponse } from '../../../../src/crosschain/swapExactIn/swapChangelly/types'

// Based on real SOL → LTC Changelly API response
export const mockFixRate: FixRateForAmountResponse = {
    id: 'x23c',
    result: '1',
    from: 'sol',
    to: 'ltc',
    networkFee: '0.00501204',
    max: '1000',
    maxFrom: '1000',
    maxTo: '1500',
    min: '0.1',
    minFrom: '0.1',
    minTo: '0.15',
    amountFrom: '0.3',
    amountTo: '0.44870955',
    expiredAt: Date.now() + 60000,
}

export const mockFixTx: CreateFixTransactionResponse = {
    id: '4fs0djsqm1cic0j6',
    type: 'fixed',
    payinAddress: 'H2NLNh8tvrSvRXF1ocbuyJr8DNxoEJootD2z2KxFRio8',
    payinExtraId: '',
    payoutAddress: 'ltc1qgxu8r4fdwd64fy77w8mcqfaz9h37jmjme45vvm',
    payoutExtraId: '',
    refundAddress: '2r7H8BSvV2qvhUq5rMVhvESpwbjjVUVS2htzMF5DRx95',
    refundExtraId: '',
    amountExpectedFrom: '0.3',
    amountExpectedTo: '0.44870955',
    status: 'new',
    payTill: new Date(Date.now() + 600000).toISOString(),
    currencyTo: 'ltc',
    currencyFrom: 'sol',
    createdAt: Date.now(),
    networkFee: '0.00501204',
}

// Real Changelly getCurrenciesFull responses covering all chain types:
// - Native gas tokens (EVM, Solana, TON, Tron)
// - Changelly-native chains (XRP, DOGE, LTC)
// - EVM ERC-20 with mixed-case checksummed addresses
// - Tron TRC-20 (base58 address)
// - Solana SPL token (base58 address)
// - TON jetton
// - SUI token
export const mockCurrenciesFull: CurrencyFullResponse[] = [
    // Native gas tokens
    { name: 'ETH', ticker: 'eth', fullName: 'Ethereum', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 2, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'ETH', blockchain: 'ethereum', blockchainPrecision: 18 },
    { name: 'BNB', ticker: 'bnbbsc', fullName: 'BNB', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 2, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'BNB', blockchain: 'binance_smart_chain', blockchainPrecision: 18 },
    { name: 'SOL', ticker: 'sol', fullName: 'Solana', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 1, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'SOL', blockchain: 'solana', blockchainPrecision: 9 },
    { name: 'TON', ticker: 'ton', fullName: 'Toncoin', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 20, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'TON', blockchain: 'ton', blockchainPrecision: 9 },
    { name: 'TRX', ticker: 'trx', fullName: 'Tron', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 2, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'TRX', blockchain: 'tron', blockchainPrecision: 6 },
    // Changelly-native chain gas tokens
    { name: 'XRP', ticker: 'xrp', fullName: 'Ripple', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 2, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'XRP', blockchain: 'ripple', blockchainPrecision: 6 },
    { name: 'DOGE', ticker: 'doge', fullName: 'Dogecoin', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 3, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'DOGE', blockchain: 'doge', blockchainPrecision: 8 },
    { name: 'LTC', ticker: 'ltc', fullName: 'Litecoin', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 3, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'LTC', blockchain: 'litecoin', blockchainPrecision: 8 },
    // EVM ERC-20 with mixed-case addresses (real Changelly data)
    { name: 'USDC', ticker: 'usdc', fullName: 'USD Coin', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 2, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'ERC20', blockchain: 'ethereum', blockchainPrecision: 6, contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { name: 'ENSO', ticker: 'enso', fullName: 'Enso', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 2, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'ERC20', blockchain: 'ethereum', blockchainPrecision: 18, contractAddress: '0x699F088b5DddcAFB7c4824db5B10B57B37cB0C66' },
    { name: 'GALA', ticker: 'gala', fullName: 'GALA', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 9, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'ERC20', blockchain: 'ethereum', blockchainPrecision: 8, contractAddress: '0xd1d2Eb1B1e90B638588728b4130137D262C87cae' },
    { name: 'DAI', ticker: 'dai', fullName: 'Dai', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 15, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'ERC20', blockchain: 'ethereum', blockchainPrecision: 18, contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
    // BSC BEP-20
    { name: 'DAIBSC', ticker: 'daibsc', fullName: 'Dai BSC', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 10, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'BEP20', blockchain: 'binance_smart_chain', blockchainPrecision: 18, contractAddress: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3' },
    // Tron TRC-20 (base58 address)
    { name: 'USDT', ticker: 'usdtrx', fullName: 'Tether', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 2, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'TRC20', blockchain: 'tron', blockchainPrecision: 6, contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
    // Solana SPL tokens (base58 addresses)
    { name: 'TRUMP', ticker: 'trump', fullName: 'OFFICIAL TRUMP', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 5, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'SOL', blockchain: 'solana', blockchainPrecision: 6, contractAddress: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN' },
    { name: 'GIGA', ticker: 'giga', fullName: 'Gigachad', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 5, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'SOL', blockchain: 'solana', blockchainPrecision: 5, contractAddress: '63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9' },
    // TON jetton
    { name: 'NOT', ticker: 'not', fullName: 'Notcoin', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 20, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'TON', blockchain: 'ton', blockchainPrecision: 9, contractAddress: 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT' },
    // SUI token
    { name: 'USDCSUI', ticker: 'usdcsui', fullName: 'USD Coin Sui', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 8, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'SUI', blockchain: 'sui', blockchainPrecision: 6, contractAddress: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC' },
    // Optimism token
    { name: 'WLD', ticker: 'wld', fullName: 'Worldcoin', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 2, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'OPTIMISM', blockchain: 'optimism', blockchainPrecision: 18, contractAddress: '0xdc6ff44d5d932cbd77b52e5612ba0529dc6226f1' },
    // Arbitrum token
    { name: 'RAIN', ticker: 'rain', fullName: 'Rain', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 10, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'ARB', blockchain: 'arbitrum', blockchainPrecision: 18, contractAddress: '0x25118290e6a5f4139381d072181157035864099d' },
    // Disabled token (should be skipped)
    { name: 'GPS', ticker: 'gps', fullName: 'GoPlus', enabled: false, enabledFrom: false, enabledTo: false, fixRateEnabled: false, payinConfirmations: 20, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'BASE', blockchain: 'BASE', blockchainPrecision: 18, contractAddress: '0x0c1dc73159e30c4b06170f2593d3118968a0dca5' },
    // Unsupported blockchain (should be skipped)
    { name: 'RUNE', ticker: 'rune', fullName: 'THORChain', enabled: true, enabledFrom: true, enabledTo: true, fixRateEnabled: true, payinConfirmations: 20, addressUrl: '', transactionUrl: '', image: '', fixedTime: 0, protocol: 'RUNE', blockchain: 'thorchain', blockchainPrecision: 8 },
]
