import { MaxUint256, AddressZero } from '@ethersproject/constants'
import { Log, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import * as base64 from '@ethersproject/base64'
import { toUtf8Bytes } from '@ethersproject/strings'
import { hexlify } from '@ethersproject/bytes'
import { Signer, BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { transactions } from 'near-api-js'
import BN from 'bn.js'
import { ChainId } from '../constants'
import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import { Execute, WaitForMined } from './bridging'
import { BIPS_BASE } from './constants'
import type { Symbiosis } from './symbiosis'
import { UniLikeTrade } from './uniLikeTrade'
import { calculateGasMargin, canOneInch, getExternalId, getInternalId, objectToBase64 } from './utils'
import { WaitForComplete } from './waitForComplete'
import { AdaRouter, AvaxRouter, UniLikeRouter } from './contracts'
import { OneInchTrade } from './oneInchTrade'
import { DataProvider } from './dataProvider'
import { Transit } from './transit'
import { NearTrade } from './nearTrade'
import { Interface } from '@ethersproject/abi'

export type NearTransactionRequest = Record<string, unknown>

export type SwapExactIn = Promise<{
    nearTransactionRequest?: NearTransactionRequest
    execute: (signer: Signer) => Execute
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    tokenAmountOutWithZeroFee: TokenAmount
    route: Token[]
    priceImpact: Percent
    amountInUsd: TokenAmount
    transactionRequest: TransactionRequest
    approveTo: string
}>

export abstract class BaseSwapping {
    public amountInUsd: TokenAmount | undefined

    protected from!: string
    protected to!: string
    protected revertableAddress!: string
    protected tokenAmountIn!: TokenAmount
    protected tokenOut!: Token
    protected slippage!: number
    protected deadline!: number
    protected ttl!: number
    protected use1Inch!: boolean

    protected route!: Token[]

    protected tradeA: UniLikeTrade | OneInchTrade | NearTrade | undefined
    protected transit!: Transit
    protected tradeC: UniLikeTrade | OneInchTrade | NearTrade | undefined

    protected dataProvider: DataProvider

    protected readonly symbiosis: Symbiosis

    public constructor(symbiosis: Symbiosis) {
        this.symbiosis = symbiosis
        this.dataProvider = new DataProvider(symbiosis)
    }

    protected async doExactIn(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        use1Inch: boolean
    ): SwapExactIn {
        this.use1Inch = use1Inch
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.from = from
        this.to = to
        this.revertableAddress = revertableAddress
        this.slippage = slippage
        this.deadline = deadline
        this.ttl = deadline - Math.floor(Date.now() / 1000)

        if (!this.symbiosis.isTransitStable(tokenAmountIn.token)) {
            this.tradeA = this.buildTradeA()
            await this.tradeA.init()
        }

        this.transit = this.buildTransit()
        await this.transit.init()

        this.amountInUsd = this.transit.amount()

        if (!this.symbiosis.isTransitStable(tokenOut)) {
            this.tradeC = this.buildTradeC()
            await this.tradeC.init()
        }

        this.route = this.getRoute()

        const fee = await this.getFee(this.transit.feeToken)

        const tokenAmountOutWithZeroFee = this.tokenAmountOut()

        // >>> NOTE create trades with calculated fee
        this.transit = await this.buildTransit(fee)
        await this.transit.init()

        if (!this.symbiosis.isTransitStable(tokenOut)) {
            this.tradeC = this.buildTradeC()
            await this.tradeC.init()
        }
        // <<< NOTE create trades with calculated fee

        if (tokenAmountIn.token.isFromNear()) {
            const transactionRequest = {} // @@

            const nearTransactionRequest = this.getNearTransactionRequest(fee)

            return {
                execute: (signer: Signer) => this.execute(transactionRequest, signer),
                fee,
                tokenAmountOut: this.tokenAmountOut(),
                tokenAmountOutWithZeroFee, // uses for calculation pure swap price except fee
                route: this.route,
                priceImpact: this.calculatePriceImpact(),
                amountInUsd: this.amountInUsd,
                transactionRequest,
                approveTo: this.approveTo(),
                nearTransactionRequest,
            }
        }

        const transactionRequest = this.getTransactionRequest(fee)

        return {
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
            fee,
            tokenAmountOut: this.tokenAmountOut(),
            tokenAmountOutWithZeroFee, // uses for calculation pure swap price except fee
            route: this.route,
            priceImpact: this.calculatePriceImpact(),
            amountInUsd: this.amountInUsd,
            transactionRequest,
            approveTo: this.approveTo(),
        }
    }

    protected approveTo(): string {
        return this.symbiosis.chainConfig(this.tokenAmountIn.token.chainId).metaRouterGateway
    }

    protected async execute(transactionRequest: TransactionRequest, signer: Signer): Execute {
        const transactionRequestWithGasLimit = { ...transactionRequest }

        const gasLimit = await signer.estimateGas(transactionRequest)

        transactionRequestWithGasLimit.gasLimit = calculateGasMargin(gasLimit)

        const response = await signer.sendTransaction(transactionRequestWithGasLimit)

        return {
            response,
            waitForMined: (confirmations = 1) => this.waitForMined(confirmations, response),
        }
    }

    protected async waitForMined(confirmations: number, response: TransactionResponse): WaitForMined {
        const receipt = await response.wait(confirmations)

        return {
            receipt,
            waitForComplete: () => this.waitForComplete(receipt),
        }
    }

    public async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        if (!this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        return new WaitForComplete({
            direction: this.transit.direction,
            tokenOut: this.tokenOut,
            symbiosis: this.symbiosis,
            revertableAddress: this.revertableAddress,
            chainIdIn: this.tokenAmountIn.token.chainId,
        }).waitForComplete(receipt)
    }

    protected getNearTransactionRequest(fee: TokenAmount): NearTransactionRequest {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const chainIdOut = this.tokenOut.chainId
        const tokenAmount = this.transit.getBridgeAmountIn()

        let finalCalldata: Uint8Array | string | [] = this.finalCalldata()
        if (Array.isArray(finalCalldata)) {
            finalCalldata = toUtf8Bytes('')
        }

        const bridgeAmount = tokenAmount.raw.toString()

        const otherSideSynthCallData = {
            MetaSynthesize: {
                stable_bridging_fee: fee.raw.toString(), // This fee is deducted from amount and sent to Bridge
                amount: bridgeAmount, // Amount of transferred token
                real_token: tokenAmount.token.address, // Token to be held on Near and synthesized on other chain
                chain_to_address: base64.encode(this.to), // 20-byte eth address
                receive_side: base64.encode(this.symbiosis.synthesisNonEvm(chainIdOut).address), // 20-byte eth address
                opposite_bridge: base64.encode(this.symbiosis.bridgeV2NonEvm(chainIdOut).address), // 20-byte eth address
                synth_caller: this.from, // caller
                chain_id: chainIdOut.toString(), // Chain id on which we should synthesize held tokens
                swap_tokens: this.swapTokens().map((address) => base64.encode(address)),
                second_dex_router: base64.encode(this.secondDexRouter()), // First swap's contract address
                second_swap_calldata: base64.encode(this.secondSwapCalldata()), // Second swap contract address (not needed on Near)
                final_receive_side: base64.encode(this.finalReceiveSide()), // Final contract to call address
                final_calldata: base64.encode(finalCalldata), // For example Portal.meta_synthesize method's call
                final_offset: this.finalOffset().toString(), // Not used on Near. Used to change amount on EVM side via inline assembly
                revertable_address: base64.encode(this.revertableAddress), // 20-byte Ethereum address to return money on in case of error
            },
        }

        if (!this.tradeA) {
            const token = this.tokenAmountIn.token
            const address = token.address

            return {
                receiverId: address,
                actions: [
                    transactions.functionCall(
                        'ft_transfer_call',
                        {
                            amount: bridgeAmount,
                            receiver_id: 'portal.symbiosis-finance.testnet', // @@
                            msg: JSON.stringify(otherSideSynthCallData),
                        },
                        new BN('300000000000000'), // gas
                        new BN('1') // amount
                    ),
                ],
            }
        }

        if (!(this.tradeA instanceof NearTrade)) {
            throw new Error('NearTrade expected')
        }

        const { route, callData } = this.tradeA

        const args = {
            first_gas_limit: '135000000000000',
            second_gas_limit: '45000000000000',
            first_account: route[0].address,
            first_function_name: 'ft_transfer_call',
            first_msg: callData,
            approved_tokens: route.map((token) => token.address),
            second_account: 'portal.symbiosis-finance.testnet', // @@
            second_function_name: 'meta_synthesize',
            second_msg: objectToBase64(otherSideSynthCallData),
        }

        if (this.tokenAmountIn.token.isNative) {
            return {
                receiverId: 'metarouter.symbiosis-finance.testnet',
                actions: [
                    transactions.functionCall(
                        'native_meta_route',
                        { args },
                        new BN('300000000000000'), // gas,
                        new BN(this.tokenAmountIn.raw.toString()) // amount,
                    ),
                ],
            }
        }

        return {
            receiverId: route[0].address,
            actions: [
                transactions.functionCall(
                    'ft_transfer_call',
                    {
                        amount: this.tokenAmountIn.raw.toString(),
                        receiver_id: 'metarouter.symbiosis-finance.testnet', // @@
                        msg: JSON.stringify({ MetaRoute: args }),
                    },
                    new BN('300000000000000'), // gas,
                    new BN(1) // amount,
                ),
            ],
        }
    }

    protected getTransactionRequest(fee: TokenAmount): TransactionRequest {
        const chainId = this.tokenAmountIn.token.chainId

        const [relayRecipient, otherSideCalldata] = this.otherSideData(fee)

        const amount = this.tradeA ? this.tradeA.tokenAmountIn : this.tokenAmountIn
        const value =
            this.tradeA && this.tokenAmountIn.token.isNative
                ? BigNumber.from(this.tradeA.tokenAmountIn.raw.toString())
                : undefined

        const metaRouter = this.symbiosis.metaRouter(chainId)
        const data = metaRouter.interface.encodeFunctionData('metaRoute', [
            {
                amount: amount.raw.toString(),
                nativeIn: amount.token.isNative,
                approvedTokens: this.approvedTokens(),
                firstDexRouter: this.firstDexRouter(),
                firstSwapCalldata: this.firstSwapCalldata(),
                secondDexRouter: this.secondDexRouter(),
                secondSwapCalldata: this.transit.direction === 'burn' ? this.secondSwapCalldata() : [],
                relayRecipient,
                otherSideCalldata,
            },
        ])

        return {
            chainId,
            to: metaRouter.address,
            data,
            value,
        }
    }

    protected calculatePriceImpact(): Percent {
        const zero = new Percent(JSBI.BigInt(0), BIPS_BASE) // 0%
        const pia = this.tradeA?.priceImpact || zero
        const pib = this.transit.priceImpact || zero
        const pic = this.tradeC?.priceImpact || zero

        // console.log([pia, pib, pic].map((i) => i.toSignificant()))

        let pi = pia.add(pib).add(pic)

        const max = new Percent(JSBI.BigInt(10000), BIPS_BASE) // 100%
        if (pi.greaterThan(max)) pi = max

        return new Percent(pi.numerator, pi.denominator)
    }

    protected tokenAmountOut(): TokenAmount {
        if (this.tradeC) {
            return this.tradeC.amountOut
        }

        return this.transit.amountOut
    }

    protected buildTradeA(): UniLikeTrade | OneInchTrade | NearTrade {
        const chainId = this.tokenAmountIn.token.chainId
        const tokenOut = this.symbiosis.transitStable(chainId)

        if (this.tokenAmountIn.token.isFromNear()) {
            return new NearTrade(this.tokenAmountIn, tokenOut, this.symbiosis)
        }

        const from = this.symbiosis.metaRouter(chainId).address
        const to = from

        if (this.use1Inch && canOneInch(chainId)) {
            const oracle = this.symbiosis.oneInchOracle(chainId)
            return new OneInchTrade(
                this.tokenAmountIn,
                tokenOut,
                from,
                to,
                this.slippage / 100,
                oracle,
                this.dataProvider
            )
        }

        const dexFee = this.symbiosis.dexFee(chainId)

        let routerA: UniLikeRouter | AvaxRouter | AdaRouter = this.symbiosis.uniLikeRouter(chainId)
        if (chainId === ChainId.AVAX_MAINNET) {
            routerA = this.symbiosis.avaxRouter(chainId)
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(chainId)) {
            routerA = this.symbiosis.adaRouter(chainId)
        }

        return new UniLikeTrade(this.tokenAmountIn, tokenOut, to, this.slippage, this.ttl, routerA, dexFee)
    }

    protected buildTransit(fee?: TokenAmount): Transit {
        return new Transit(
            this.symbiosis,
            this.dataProvider,
            this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn,
            this.tokenOut,
            this.slippage,
            this.deadline,
            fee
        )
    }

    protected buildTradeC() {
        const chainId = this.tokenOut.chainId
        const amountIn = this.transit.amountOut

        if (this.tokenOut.isFromNear()) {
            return new NearTrade(amountIn, this.tokenOut, this.symbiosis)
        }

        if (this.use1Inch && canOneInch(chainId)) {
            const from = this.symbiosis.metaRouter(chainId).address
            const oracle = this.symbiosis.oneInchOracle(chainId)
            return new OneInchTrade(
                amountIn,
                this.tokenOut,
                from,
                this.to,
                this.slippage / 100,
                oracle,
                this.dataProvider
            )
        }

        const dexFee = this.symbiosis.dexFee(chainId)

        let routerC: UniLikeRouter | AvaxRouter | AdaRouter = this.symbiosis.uniLikeRouter(chainId)
        if (chainId === ChainId.AVAX_MAINNET) {
            routerC = this.symbiosis.avaxRouter(chainId)
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(chainId)) {
            routerC = this.symbiosis.adaRouter(chainId)
        }

        return new UniLikeTrade(amountIn, this.tokenOut, this.to, this.slippage, this.ttl, routerC, dexFee)
    }

    protected getRoute(): Token[] {
        const started = this.tradeA ? [] : [this.tokenAmountIn.token]
        const terminated = this.tradeC ? [] : [this.tokenOut]

        return [
            ...started,
            ...(this.tradeA ? this.tradeA.route : []),
            ...this.transit.route,
            ...(this.tradeC ? this.tradeC.route : []),
            ...terminated,
        ].reduce((acc: Token[], token: Token) => {
            const found = acc.find((i) => i.equals(token))
            if (found) return acc
            return [...acc, token]
        }, [])
    }

    protected otherSideBurnCallData(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const synthesis = this.symbiosis.synthesisNonEvm(this.tokenAmountIn.token.chainId)

        const amount = this.transit.getBridgeAmountIn()

        let finalCallData: Uint8Array | string | [] = this.finalCalldata()
        if (Array.isArray(finalCallData)) {
            finalCallData = toUtf8Bytes('')
        }

        return [
            synthesis.address,
            synthesis.interface.encodeFunctionData('metaBurnSyntheticToken', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    amount: amount.raw.toString(),
                    syntCaller: this.from,
                    finalReceiveSide: toUtf8Bytes(this.tradeC?.routerAddress ?? ''),
                    sToken: amount.token.address,
                    finalCallData,
                    finalOffset: this.finalOffset(),
                    chain2address: toUtf8Bytes(this.to), // @@
                    revertableAddress: toUtf8Bytes(this.revertableAddress), // @@
                    receiveSide: toUtf8Bytes('portal.symbiosis-finance.testnet'), // @@
                    oppositeBridge: toUtf8Bytes('bridge.symbiosis-finance.testnet'), // @@
                    chainID: this.tokenOut.chainId,
                    clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    protected otherSideSynthCallData(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId
        const tokenAmount = this.transit.getBridgeAmountIn()

        const portal = this.symbiosis.portal(chainIdIn)

        return [
            portal.address,
            portal.interface.encodeFunctionData('metaSynthesize', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    amount: tokenAmount.raw.toString(),
                    rtoken: tokenAmount.token.address,
                    chain2address: this.to,
                    receiveSide: this.symbiosis.synthesis(chainIdOut).address,
                    oppositeBridge: this.symbiosis.bridge(chainIdOut).address,
                    syntCaller: this.from,
                    chainID: chainIdOut,
                    swapTokens: this.swapTokens(),
                    secondDexRouter: this.secondDexRouter(),
                    secondSwapCalldata: this.secondSwapCalldata(),
                    finalReceiveSide: this.finalReceiveSide(),
                    finalCalldata: this.finalCalldata(),
                    finalOffset: this.finalOffset(),
                    revertableAddress: this.revertableAddress,
                    clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    protected otherSideData(fee: TokenAmount): [string, string] {
        return this.transit.direction === 'burn' ? this.otherSideBurnCallData(fee) : this.otherSideSynthCallData(fee)
    }

    protected async feeMintCallData(): Promise<[string, string]> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId

        const synthesis = this.symbiosis.synthesisNonEvm(chainIdOut)

        const internalId = getInternalId({
            contractAddress: AddressZero,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: synthesis.address,
            revertableAddress: this.revertableAddress,
            chainId: chainIdOut,
        })

        const amount = this.transit.getBridgeAmountIn()

        const callData = synthesis.interface.encodeFunctionData('metaMintSyntheticToken', [
            {
                stableBridgingFee: '1',
                amount: amount.raw.toString(),
                externalID: externalId,
                tokenReal: toUtf8Bytes(amount.token.address),
                chainID: chainIdIn,
                to: this.to,
                swapTokens: this.swapTokens(),
                secondDexRouter: this.secondDexRouter(),
                secondSwapCalldata: this.secondSwapCalldata(),
                finalReceiveSide: this.finalReceiveSide(),
                finalCalldata: this.finalCalldata(),
                finalOffset: this.finalOffset(),
            },
        ])

        return [synthesis.address, callData]
    }

    protected async feeBurnCallData(): Promise<[string, string]> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId

        const internalId = getInternalId({
            contractAddress: AddressZero,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: AddressZero,
            revertableAddress: AddressZero,
            chainId: chainIdOut,
        })

        const amount = this.transit.amountOut

        const nonEvmPortalInterface = new Interface([
            'function metaUnsynthesize(uint256 _stableBridgingFee, bytes32 _externalID, bytes _to, uint256 _amount, bytes _rToken, bytes _finalReceiveSide, bytes _finalCalldata, uint256 _finalOffset)',
        ])

        const calldata = nonEvmPortalInterface.encodeFunctionData('metaUnsynthesize', [
            '1', // _stableBridgingFee
            externalId, // _externalID,
            toUtf8Bytes(this.to), // _to
            amount.raw.toString(), // _amount
            toUtf8Bytes(amount.token.address), // _rToken
            toUtf8Bytes(this.finalReceiveSide()), // _finalReceiveSide
            this.finalCalldata(), // _finalCalldata
            this.finalOffset(), // _finalOffset
        ])

        let receiveSide: string
        if (this.tokenOut.isFromNear()) {
            receiveSide = 'portal.symbiosis-finance.testnet'
        } else {
            receiveSide = this.symbiosis.portal(chainIdOut).address
        }

        return [receiveSide, calldata]
    }

    protected async getFee(feeToken: Token): Promise<TokenAmount> {
        if (!this.tokenOut || !this.tokenAmountIn) {
            throw new Error('Set tokens')
        }

        let token: Token
        if (this.tokenAmountIn.token.isFromNear()) {
            const synth = this.symbiosis.findSyntheticStable(this.tokenOut.chainId, this.tokenAmountIn.token.chainId)

            if (!synth) {
                throw new Error('Cant synth stable')
            }

            token = synth
        } else {
            token = feeToken
        }

        const [receiveSide, calldata] =
            this.transit.direction === 'burn' ? await this.feeBurnCallData() : await this.feeMintCallData()

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom: this.tokenAmountIn.token.chainId,
            chainIdTo: this.tokenOut.chainId,
        })

        return new TokenAmount(token, fee.toString())
    }

    protected approvedTokens(): string[] {
        let firstToken = this.tradeA ? this.tradeA.tokenAmountIn.token.address : this.tokenAmountIn.token.address
        if (!firstToken) {
            firstToken = AddressZero // AddressZero if first token is GasToken
        }

        let tokens: string[]
        if (this.transit.direction === 'burn') {
            tokens = [firstToken, ...this.transit.route.map((i) => i.address)]
        } else {
            tokens = [firstToken, this.tradeA ? this.tradeA.amountOut.token.address : this.tokenAmountIn.token.address]
        }
        return tokens
    }

    protected firstDexRouter(): string {
        return this.tradeA?.routerAddress || AddressZero
    }

    protected firstSwapCalldata(): string | [] {
        return this.tradeA?.callData || []
    }

    protected secondDexRouter(): string {
        return this.transit.receiveSide
    }

    protected secondSwapCalldata(): string | [] {
        return this.transit.callData
    }

    protected finalReceiveSide(): string {
        return this.tradeC?.routerAddress || AddressZero
    }

    protected finalCalldata(): string | [] {
        if (!this.tradeC?.callData) {
            return []
        }

        if (this.tradeC instanceof NearTrade) {
            // @@ Move to NearTrade class?
            return hexlify(
                toUtf8Bytes(
                    JSON.stringify({
                        MetaRoute: {
                            first_function_name: 'ft_transfer_call',
                            first_gas_limit: '100000000000000',
                            second_gas_limit: '45000000000000',
                            first_msg: this.tradeC.callData,
                            approved_tokens: this.tradeC.route.map((token) => token.address),
                            first_account: this.tradeC.route[0].address,
                            second_account: this.to,
                            second_function_name: '',
                            second_msg: '',
                        },
                    })
                )
            )
        }

        return this.tradeC?.callData || []
    }

    protected finalOffset(): number {
        return this.tradeC?.callDataOffset || 0
    }

    protected swapTokens(): string[] {
        const tokens = this.transit.route.map((i) => i.address)

        if (this.tradeC) {
            tokens.push(wrappedToken(this.tradeC.amountOut.token).address)
        }
        return tokens
    }
}
