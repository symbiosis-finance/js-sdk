/**
 * Example swapping(zapping) of 15 BUSD from BNB chain
 * to BTC via renBTC on Polygon
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
const provider = symbiosis.getProvider(ChainId.BSC_MAINNET)
const signer = wallet.connect(provider)

const tokenIn = new Token({
    chainId: ChainId.BSC_MAINNET,
    address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    name: 'Binance USD',
    symbol: 'BUSD',
    decimals: 18,
})

const tokenAmountIn = new TokenAmount(
    tokenIn,
    '15000000000000000000' // 15 BUSD
)

const renChainId = ChainId.MATIC_MAINNET

const btcAddress = '' // TODO set your address

async function zapErc20ToBTC() {
    try {
        if (btcAddress.length === 0) {
            throw new Error('Btc address is empty')
        }

        const zapping = symbiosis.newZappingRenBTC()

        // Calculates fee for zapping between chains and transactionRequest
        console.log('Calculating zap...')
        const { transactionRequest, fee, tokenAmountOut, route, priceImpact, approveTo } = await zapping.exactIn(
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
        const log = await zapping.waitForComplete(receipt)
        console.log('Cross-chain zap completed', log.transactionHash)

        const btcHash = await zapping.waitForREN(log.transactionHash)
        console.log('BTC received', btcHash)
    } catch (e) {
        console.error(e)
    }
}

console.log('>>>')
zapErc20ToBTC().then(() => {
    console.log('<<<')
})
