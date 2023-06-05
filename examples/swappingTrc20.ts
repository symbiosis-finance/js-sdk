/**
 * Example swapping of 15 USDT from Tron Shasta Testnet to USDT on Polygon Mumbai Testnet
 */

import { ChainId, Symbiosis, Token, TokenAmount } from 'symbiosis-js-sdk'
import { MaxUint256 } from '@ethersproject/constants'

const APPROVE_ABI = [
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

const PRIVATE_KEY = '' // TODO paste your private key
const RECIPIENT_ADDRESS = '' // TODO paste your recipient address

// Create Symbiosis instance using TESTNET config
// with clientId = `sdk-example-app`
const symbiosis = new Symbiosis('testnet', 'sdk-example-app')

const tronWeb = symbiosis.tronWeb(ChainId.TRON_TESTNET)

const TOKEN_IN = new Token({
    address: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
    chainId: ChainId.TRON_TESTNET,
    decimals: 6,
    name: 'USDT',
    symbol: 'USDT',
})

const TOKEN_AMOUNT_IN = new TokenAmount(
    TOKEN_IN,
    '15000000' // 15 USDT
)

const TOKEN_OUT = new Token({
    address: '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
    chainId: 80001,
    decimals: 6,
    name: 'USDT',
    symbol: 'USDT',
})

try {
    const swapping = symbiosis.newSwapping()

    const senderAddress = tronWeb.address.fromPrivateKey(PRIVATE_KEY)

    // Calculates fee for swapping between chains and transactionRequest
    console.log('Calculating swap...')
    const { transactionRequest, fee, tokenAmountOut, route, priceImpact, approveTo, type } = await swapping.exactIn(
        TOKEN_AMOUNT_IN, // TokenAmount object
        TOKEN_OUT, // Token object
        senderAddress, // from account address
        RECIPIENT_ADDRESS, // to account address
        RECIPIENT_ADDRESS, // account who can revert stucked transaction
        300, // 3% slippage
        Date.now() + 20 * 60 // 20 minutes deadline
    )

    if (type !== 'tron') {
        throw new Error('This example works only with TRON wallet')
    }

    console.log({
        fee: fee.toSignificant(),
        tokenAmountOut: tokenAmountOut.toSignificant(),
        route: route.map((i) => i.symbol).join(' -> '),
        priceImpact: priceImpact.toSignificant(),
        approveTo,
    })

    if (!TOKEN_AMOUNT_IN.token.isNative) {
        console.log('Approving...')
        const tokenContract = tronWeb.contract(APPROVE_ABI, TOKEN_AMOUNT_IN.token.address)

        const approveResponse = await tokenContract
            .approve(approveTo, MaxUint256)
            .send({ owner_address: senderAddress }, PRIVATE_KEY)

        console.log('Approved', approveResponse.hash)
    }

    const { call_value, contract_address, fee_limit, function_selector, owner_address, raw_parameter } =
        transactionRequest

    const triggerResult = await tronWeb.transactionBuilder.triggerSmartContract(
        contract_address,
        function_selector,
        {
            rawParameter: raw_parameter,
            callValue: call_value,
            feeLimit: fee_limit,
        },
        [],
        owner_address
    )

    const signedTx = await tronWeb.trx.sign(triggerResult.transaction, PRIVATE_KEY)

    const sendResult = await tronWeb.trx.sendRawTransaction(signedTx)

    console.log('Transaction sent', sendResult.txid)

    // Wait for transaction to be completed on recipient chain
    const recipientTxHash = await symbiosis.waitForComplete(TOKEN_OUT.chainId, sendResult.txid)
    console.log('Cross-chain swap completed', recipientTxHash)
} catch (e) {
    console.error(e)
}
