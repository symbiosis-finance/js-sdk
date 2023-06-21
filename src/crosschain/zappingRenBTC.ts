import RenJS from '@renproject/ren'
import { Signer } from 'ethers'
import { Bitcoin } from '@renproject/chains-bitcoin'
import { Ethereum, BinanceSmartChain, Polygon } from '@renproject/chains-ethereum'
import { ChainId } from '../constants'
import { Token, TokenAmount } from '../entities'
import { SwapExactIn, BaseSwapping, EthSwapExactIn } from './baseSwapping'
import { MulticallRouter, RenMintGatewayV3 } from './contracts'

export type ZappingRenBTCExactIn = Promise<
    Omit<Awaited<SwapExactIn>, 'execute'> & {
        execute: ReturnType<ZappingRenBTC['buildExecute']>
        renBTCAmountOut: TokenAmount
    }
>

const fromUTF8String = (input: string): Uint8Array => {
    const a = []
    const encodedInput = encodeURIComponent(input)
    for (let i = 0; i < encodedInput.length; i++) {
        if (encodedInput[i] === '%') {
            // Load the next two characters of encodedInput and treat them
            // as a UTF-8 code.
            a.push(parseInt(encodedInput.substr(i + 1, 2), 16))
            i += 2
        } else {
            a.push(encodedInput.charCodeAt(i))
        }
    }
    return new Uint8Array(a)
}

export class ZappingRenBTC extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected renMintGatewayV3!: RenMintGatewayV3
    protected renBTCAddress!: string
    protected renChainId!: ChainId

    public async exactIn(
        tokenAmountIn: TokenAmount,
        renChainId: ChainId,
        from: string,
        to: string,
        slippage: number,
        deadline: number,
        use1Inch = true
    ): ZappingRenBTCExactIn {
        this.renChainId = renChainId
        this.multicallRouter = this.symbiosis.multicallRouter(renChainId)
        this.userAddress = to

        const renRenGatewayRegistry = this.symbiosis.renRenGatewayRegistry(renChainId)

        this.renBTCAddress = await renRenGatewayRegistry.getRenAssetBySymbol('BTC')

        const renBTC = new Token({
            address: this.renBTCAddress,
            chainId: renChainId,
            decimals: 8,
            name: 'renBTC',
            symbol: 'renBTC',
            icons: {
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5777.png',
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5777.png',
            },
        })

        const mintGatewayAddress = await renRenGatewayRegistry.getMintGatewayBySymbol('BTC')

        this.renMintGatewayV3 = this.symbiosis.renMintGatewayByAddress(mintGatewayAddress, renChainId)

        const exactIn = await this.doExactIn(tokenAmountIn, renBTC, from, from, slippage, deadline, use1Inch)

        if (exactIn.type === 'tron') {
            // @@ TODO: implement
            throw new Error('Unsupported chain')
        }

        const { tokenAmountOut, execute, ...result } = exactIn

        const btcAmountOut = await this.estimateBTCOutput(tokenAmountOut)

        return {
            ...result,
            execute: this.buildExecute(execute),
            renBTCAmountOut: tokenAmountOut,
            tokenAmountOut: btcAmountOut,
        }
    }

    protected tradeCTo(): string {
        return this.multicallRouter.address
    }

    public async waitForREN(transactionHash: string): Promise<string | undefined> {
        const { bitcoin, ethereum, renJS } = this.createRENJS()

        const gateway = await renJS.gateway({
            asset: bitcoin.assets.BTC,
            from: ethereum.Transaction({
                txHash: transactionHash,
            }),
            to: bitcoin.Address(this.userAddress),
        })

        const result = new Promise<string | undefined>((resolve, reject) => {
            gateway.on('transaction', async (tx) => {
                try {
                    await tx.renVM.submit()
                    await tx.renVM.wait()

                    await tx.out.submit?.()
                    await tx.out.wait()
                } catch (e) {
                    reject(e)

                    return
                }

                const outTx = tx.out.progress.transaction

                resolve(outTx?.txHash)
            })
        })

        await gateway.in?.submit?.()
        await gateway.in?.wait(1)

        return result
    }

    protected finalReceiveSide(): string {
        return this.multicallRouter.address
    }

    protected finalCalldata(): string | [] {
        return this.buildMulticall()
    }

    protected finalOffset(): number {
        return 36
    }

    private buildMulticall() {
        if (!this.tradeC) {
            throw new Error('TradeC is not set')
        }

        if (!this.tradeC.callDataOffset) {
            throw new Error('TradeC is not initialized')
        }

        const burnCalldata = (this.renMintGatewayV3.interface as any).encodeFunctionData('burn(bytes,uint256)', [
            fromUTF8String(this.userAddress),
            this.tradeC.amountOut.raw.toString(),
        ])

        const callDatas = [this.tradeC.callData, burnCalldata]
        const receiveSides = [this.tradeC.routerAddress, this.renMintGatewayV3.address]
        const path = [this.tradeC.tokenAmountIn.token.address, this.tradeC.amountOut.token.address]
        const offsets = [this.tradeC.callDataOffset, 68]

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            this.tradeC.tokenAmountIn.raw.toString(),
            callDatas,
            receiveSides,
            path,
            offsets,
            this.from,
        ])
    }

    private createRENJS() {
        const provider = this.symbiosis.providers.get(this.renChainId)
        if (!provider) {
            throw new Error(`Provider not found for chain ${this.renChainId}`)
        }

        let network: 'mainnet' | 'testnet'
        let ethereum: Ethereum | BinanceSmartChain | Polygon

        if (this.renChainId === ChainId.BSC_MAINNET) {
            network = 'mainnet'

            ethereum = new BinanceSmartChain({
                network,
                provider,
            })
        } else if (this.renChainId === ChainId.MATIC_MAINNET) {
            network = 'mainnet'

            ethereum = new Polygon({
                network,
                provider,
            })
        } else {
            throw new Error(`Unsupported chain ${this.renChainId}`)
        }

        const bitcoin = new Bitcoin({ network })
        const renJS = new RenJS(network).withChains(ethereum, bitcoin)

        return { bitcoin, ethereum, renJS, network }
    }

    private async estimateBTCOutput(tokenAmountOut: TokenAmount): Promise<TokenAmount> {
        const { ethereum, renJS, network } = this.createRENJS()

        const fees = await renJS.getFees({
            asset: 'BTC',
            from: ethereum.Account(),
            to: 'Bitcoin',
        })

        const estimateOutput = fees.estimateOutput(tokenAmountOut.raw.toString()).toString()

        return new TokenAmount(
            new Token({
                chainId: network === 'mainnet' ? ChainId.BTC_MAINNET : ChainId.BTC_TESTNET,
                symbol: 'BTC',
                name: 'Bitcoin',
                address: '',
                decimals: 8,
                isNative: true,
                icons: {
                    small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                    large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                },
            }),
            estimateOutput
        )
    }

    private buildExecute(execute: EthSwapExactIn['execute']) {
        return async (signer: Signer) => {
            const { response, waitForMined } = await execute(signer)

            return {
                response,
                waitForMined: async () => {
                    const { receipt } = await waitForMined()

                    return {
                        receipt,
                        waitForComplete: async () => {
                            const log = await this.waitForComplete(receipt)

                            return { log, waitForREN: () => this.waitForREN(log.transactionHash) }
                        },
                    }
                },
            }
        }
    }
}
