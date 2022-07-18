/**
 * Example swapping(zapping) of some ETH
 * to BTC via renBTC on BNB Chain
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
    '100000000000000000' // 0.1 ETH // TODO change amount if needed
)

const btcAddress = '' // TODO set your address

const renChainId = ChainId.BSC_MAINNET

async function zapNativeToBtc() {
    const zapping = symbiosis.newZappingRenBTC()

    // Calculates fee for zapping between chains and transactionRequest
    console.log('Calculating zap...')
    try {
        if (btcAddress.length === 0) {
            throw new Error('Btc address is empty')
        }

        const { transactionRequest, fee, tokenAmountOut, route, priceImpact } = await zapping.exactIn(
            tokenAmountIn, // TokenAmount object
            renChainId, // Ren chain id
            wallet.address, // from account address
            btcAddress, // to account address
            wallet.address, // account who can revert stucked transaction
            300, // 3% slippage
            Date.now() + 20 * 60, // 20 minutes deadline
            true
        )

        console.log({
            tokenAmountIn: tokenAmountIn.toSignificant(),
            fee: fee.toSignificant(),
            route: route.map((i) => i.symbol).join(' -> '),
            tokenAmountOut: tokenAmountOut.toSignificant(),
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
        const log = await zapping.waitForComplete(receipt)
        console.log('Cross-chain zap completed', log.transactionHash)
    } catch (e) {
        console.error(e)
    }
}

zapNativeToBtc().then(() => {
    console.log('<<<')
})
