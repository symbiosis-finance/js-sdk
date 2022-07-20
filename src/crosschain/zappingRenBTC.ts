import RenJS from '@renproject/ren'
import { Signer } from 'ethers'
import { Ethereum, Bitcoin, BinanceSmartChain, Polygon } from '@renproject/chains'
import { AddressZero } from '@ethersproject/constants'
import { ChainId } from '../constants'
import { Token, TokenAmount } from '../entities'
import { SwapExactIn, BaseSwapping } from './baseSwapping'
import { MulticallRouter, RenMintGatewayV3 } from './contracts'
import { Log, TransactionReceipt } from '@ethersproject/providers'

interface ZappingRenBTCWaitForComplete {
    log: Log
    waitForREN: () => Promise<string | undefined>
}

export type ZappingRenBTCExactIn = Omit<SwapExactIn, 'execute'> & {
    execute: ReturnType<ZappingRenBTC['buildExecute']>
}

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

    public async exactIn(
        tokenAmountIn: TokenAmount,
        renChainId: ChainId,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        use1Inch = true
    ): Promise<ZappingRenBTCExactIn> {
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

        const { tokenAmountOut, execute, ...result } = await this.doExactIn(
            tokenAmountIn,
            renBTC,
            from,
            this.multicallRouter.address,
            revertableAddress,
            slippage,
            deadline,
            use1Inch
        )

        const btcAmountOut = await this.estimateBTCOutput(renChainId, tokenAmountOut)

        return {
            ...result,
            execute: this.buildExecute(execute),
            tokenAmountOut: btcAmountOut,
        }
    }

    public async waitForComplete(receipt: TransactionReceipt): Promise<ZappingRenBTCWaitForComplete> {
        const log = await this.doWaitForComplete(receipt)

        return { log, waitForREN: () => this.waitForREN(log.transactionHash) }
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

    private async estimateBTCOutput(renChainId: ChainId, tokenAmountOut: TokenAmount): Promise<TokenAmount> {
        const provider = this.symbiosis.providers.get(renChainId)
        if (!provider) {
            throw new Error(`Provider not found for chain ${renChainId}`)
        }

        let network: 'mainnet' | 'testnet'
        let ethereum: Ethereum | BinanceSmartChain | Polygon

        if (renChainId === ChainId.ETH_KOVAN) {
            network = 'testnet'

            ethereum = new Ethereum({
                network,
                provider,
            })
        } else if (renChainId === ChainId.BSC_MAINNET) {
            network = 'mainnet'

            ethereum = new BinanceSmartChain({
                network,
                provider,
            })
        } else if (renChainId === ChainId.MATIC_MAINNET) {
            network = 'mainnet'

            ethereum = new Polygon({
                network,
                provider,
            })
        } else {
            throw new Error(`Unsupported chain ${renChainId}`)
        }

        const bitcoin = new Bitcoin({ network })
        const renJS = new RenJS(network).withChains(ethereum, bitcoin)

        const fees = await renJS.getFees({
            asset: 'BTC',
            from: ethereum.Account(),
            to: 'Bitcoin',
        })

        const estimateOutput = fees.estimateOutput(tokenAmountOut.raw.toString()).toString()

        return new TokenAmount(
            new Token({
                chainId: renChainId,
                symbol: 'BTC',
                name: 'Bitcoin',
                address: AddressZero,
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

    private buildExecute(execute: Awaited<SwapExactIn>['execute']) {
        return async (signer: Signer) => {
            const { response, waitForMined } = await execute(signer)

            return {
                response,
                waitForMined: async () => {
                    const { receipt } = await waitForMined()

                    return {
                        receipt,
                        waitForComplete: () => this.waitForComplete(receipt),
                    }
                },
            }
        }
    }

    private async waitForREN(transactionHas: string): Promise<string | undefined> {
        const provider = this.symbiosis.getProvider(ChainId.ETH_KOVAN)
        if (!provider) {
            return
        }

        const ethereum = new Ethereum({
            network: 'testnet',
            provider,
        })

        const bitcoin = new Bitcoin({ network: 'testnet' })
        const renJS = new RenJS('testnet').withChains(ethereum, bitcoin)

        const gateway = await renJS.gateway({
            asset: bitcoin.assets.BTC,
            from: ethereum.Transaction({
                txHash: transactionHas,
            }),
            to: bitcoin.Address(this.userAddress),
        })

        const result = new Promise<string | undefined>((resolve) => {
            gateway.on('transaction', async (tx) => {
                console.log(tx)

                await tx.renVM.submit()
                await tx.renVM.wait()

                await tx.out.submit?.()
                await tx.out.wait()

                const outTx = tx.out.progress.transaction
                console.log('Done:', outTx)

                console.log(tx.toChain.transactionExplorerLink(outTx!))

                resolve(outTx ? tx.toChain.transactionExplorerLink(outTx) : undefined)
            })
        })

        await gateway.in?.submit?.()
        await gateway.in?.wait(1)

        return result
    }
}
