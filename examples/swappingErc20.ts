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

// Create Symbiosis instance using TESTNET config
// with clientId = `sdk-example-app`
const symbiosis = new Symbiosis('testnet', 'sdk-example-app')
const provider = symbiosis.getProvider(ChainId.ETH_RINKEBY)
const signer = wallet.connect(provider)

const tokenIn = new Token({
    chainId: ChainId.ETH_RINKEBY,
    address: '0x4DBCdF9B62e891a7cec5A2568C3F4FAF9E8Abe2b',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
})

const tokenAmountIn = new TokenAmount(
    tokenIn,
    '15000000' // 15 USDC
)

const tokenOut = new Token({
    chainId: ChainId.BSC_TESTNET,
    isNative: true,
    address: '',
    symbol: 'BNB',
    decimals: 18,
})

async function swapErc20() {
    try {
        const swapping = symbiosis.newSwapping()

        // Calculates fee for swapping between chains and transactionRequest
        console.log('Calculating swap...')
        const { transactionRequest, fee, tokenAmountOut, route, priceImpact, approveTo } = await swapping.exactIn(
            tokenAmountIn, // TokenAmount object
            tokenOut, // Token object
            wallet.address, // from account address
            wallet.address, // to account address
            wallet.address, // account who can revert stucked transaction
            300, // 3% slippage
            Date.now() + 20 * 60 // 20 minutes deadline
        )

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
}

console.log('>>>')
swapErc20().then(() => {
    console.log('<<<')
})
