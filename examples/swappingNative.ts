/**
 * Example swapping of some ETH
 * to BNB on BNB Chain Testnet
 */

import { ChainId, Symbiosis, Token, TokenAmount } from 'symbiosis-js-sdk'
import { BytesLike, ethers } from 'ethers'

const privateKey = '' // TODO paste your private key
const wallet = new ethers.Wallet(privateKey as BytesLike)

// Create Symbiosis instance using MAINNET config
// with clientId = `sdk-example-app`
const symbiosis = new Symbiosis('mainnet', 'sdk-example-app')

const tokenIn = new Token({
    chainId: ChainId.ETH_MAINNET,
    address: '',
    symbol: 'ETH',
    decimals: 18,
    isNative: true,
})

const tokenAmountIn = new TokenAmount(
    tokenIn,
    '100000000000' // 0.000001 ETH // TODO change amount if needed
)

const tokenOut = new Token({
    chainId: ChainId.BSC_MAINNET,
    isNative: true,
    address: '',
    symbol: 'BNB',
    decimals: 18,
})

const swapping = symbiosis.newSwapping()

// Calculates fee for swapping between chains and transactionRequest
console.log('Calculating swap...')
try {
    const { transactionRequest, fee, tokenAmountOut, route, priceImpact, type } = await swapping.exactIn(
        tokenAmountIn, // TokenAmount object
        tokenOut, // Token object
        wallet.address, // from account address
        wallet.address, // to account address
        wallet.address, // account who can revert stucked transaction
        300, // 3% slippage
        Date.now() + 20 * 60 // 20 minutes deadline
    )

    if (type !== 'evm') {
        throw new Error('This example works only with EVM chains')
    }

    console.log({
        tokenAmountIn: tokenAmountIn.toSignificant(),
        fee: fee.toSignificant(),
        tokenAmountOut: tokenAmountOut.toSignificant(),
        route: route.map((i) => i.symbol).join(' -> '),
        priceImpact: priceImpact.toSignificant(),
    })

    // Send transaction to chain
    const transactionResponse = await wallet
        .connect(symbiosis.getProvider(transactionRequest.chainId as ChainId))
        .sendTransaction(transactionRequest)
    console.log('Transaction sent', transactionResponse.hash)

    // Wait for transaction to be mined
    const receipt = await transactionResponse.wait(1)
    console.log('Transaction mined', receipt.transactionHash)

    // Wait for transaction to be completed on recipient chain
    const log = await swapping.waitForComplete(receipt)
    console.log('Cross-chain swap completed', log.transactionHash)
} catch (e) {
    console.error(e)
}
