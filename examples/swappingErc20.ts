/**
 * Example swapping of 15 USDC from Rinkeby
 * to BNB on BNB Chain Testnet
 */

import { ChainId, Symbiosis, Token, TokenAmount } from 'symbiosis-js-sdk'
import { BytesLike, ethers } from 'ethers'
import { Contract } from '@ethersproject/contracts'
import { MaxUint256 } from '@ethersproject/constants'

const approveAbi = [
    {
        constant: false,
        inputs: [
            { name: '_spender', type: 'address' },
            { name: '_value', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function',
    },
]

const privateKey = '' // TODO paste your private key

const wallet = new ethers.Wallet(privateKey as BytesLike)

// Create Symbiosis instance using MAINNET config
// with clientId = `sdk-example-app`
const symbiosis = new Symbiosis('mainnet', 'sdk-example-app')
const provider = symbiosis.getProvider(ChainId.MATIC_MAINNET)
const signer = wallet.connect(provider)

const tokenIn = new Token({
    chainId: ChainId.MATIC_MAINNET,
    address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
})

const tokenAmountIn = new TokenAmount(
    tokenIn,
    '15000000' // 15 USDC
)

const tokenOut = new Token({
    chainId: ChainId.BSC_MAINNET,
    isNative: true,
    address: '',
    symbol: 'BNB',
    decimals: 18,
})

try {
    const swapping = symbiosis.newSwapping()

    // Calculates fee for swapping between chains and transactionRequest
    console.log('Calculating swap...')
    const { transactionRequest, fee, tokenAmountOut, route, priceImpact, approveTo, type } = await swapping.exactIn(
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
        fee: fee.toSignificant(),
        tokenAmountOut: tokenAmountOut.toSignificant(),
        route: route.map((i) => i.symbol).join(' -> '),
        priceImpact: priceImpact.toSignificant(),
        approveTo,
    })

    if (!tokenAmountIn.token.isNative) {
        console.log('Approving...')
        const tokenContract = new Contract(tokenAmountIn.token.address, JSON.stringify(approveAbi), signer)
        const approveResponse = await tokenContract.approve(approveTo, MaxUint256)
        console.log('Approved', approveResponse.hash)

        const approveReceipt = await approveResponse.wait(1)
        console.log('Approve mined', approveReceipt.transactionHash)
    }

    // Send transaction to chain
    const transactionResponse = await signer.sendTransaction(transactionRequest)
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
