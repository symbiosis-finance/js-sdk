import { Address } from '@ton/core'
import { BaseSwapping } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { SwapExactInParams, SwapExactInResult } from './types'
import { CROSS_CHAIN_ID } from './constants'

export const TON_TOKEN_DECIMALS = 9

export type Option = { chainId: ChainId; bridge: string; wTon: Token }

export class SwappingToTon extends BaseSwapping {
    protected userAddress!: string

    public async exactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        this.userAddress = params.to

        return this.doExactIn({
            ...params,
            to: params.from,
        })
    }

    // TODO: wait for advisor to work with testnet
    protected async getFeeV2(): Promise<{ fee: TokenAmount; save: TokenAmount }> {
        const feeToken = this.symbiosis.tokens().find((token) => token.chainId === ChainId.TON_TESTNET)

        return {
            fee: new TokenAmount(feeToken!, '100000000'),
            save: new TokenAmount(feeToken!, '0'),
        }
    }

    // uncomment for test from omni chain (bsc testnet) Wait advisor to work with testnet
    // protected async getFee(): Promise<{ fee: TokenAmount; save: TokenAmount }> {
    //     const feeToken = this.symbiosis.tokens().find((token) => token.chainId === ChainId.TON_TESTNET)

    //     return {
    //         fee: new TokenAmount(feeToken!, '100000000'),
    //         save: new TokenAmount(feeToken!, '0'),
    //     }
    // }

    protected metaBurnSyntheticToken(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const synthesis = this.symbiosis.synthesis(this.tokenAmountIn.token.chainId)

        const amount = this.transit.getBridgeAmountIn()

        const { workChain, hash } = Address.parse(this.userAddress)

        const tonAddress = {
            workchain: workChain,
            address_hash: `0x${hash.toString('hex')}`,
        }

        const tonPortal = this.symbiosis.config.chains.find((chain) => chain.id === this.tokenOut.chainId)?.tonPortal

        if (!tonPortal) {
            throw new Error('Ton portal is not found')
        }

        // take first 20 bytes (evm address size)of tonPortal base64 address
        const receiveSide = `0x${Buffer.from(tonPortal, 'base64').toString('hex').slice(0, 40)}`

        return [
            synthesis.address,
            synthesis.interface.encodeFunctionData('burnSyntheticTokenTON', [
                fee ? fee?.raw.toString() : '0', // uint256 stableBridgingFee;
                amount.token.address,
                amount.raw.toString(),
                CROSS_CHAIN_ID,
                tonAddress,
                receiveSide,
                '0x0000000000000000000000000000000000000001', // any arbitary data, this addresses passed from relayer
                this.from,
                this.tokenOut.chainId,
                this.symbiosis.clientId,
            ]),
        ]
    }

    protected finalOffsetV2(): number {
        return 100
    }

    protected finalCalldataV2(feeV2?: TokenAmount | undefined): string {
        const { workChain, hash } = Address.parse(this.userAddress)

        const tonAddress = {
            workchain: workChain,
            address_hash: `0x${hash.toString('hex')}`,
        }

        const tonPortal = this.symbiosis.config.chains.find((chain) => chain.id === this.tokenOut.chainId)?.tonPortal

        if (!tonPortal) {
            throw new Error('Ton portal is not found')
        }

        // take first 20 bytes (evm address size)of tonPortal base64 address
        const receiveSide = `0x${Buffer.from(tonPortal, 'base64').toString('hex').slice(0, 40)}`

        return this.synthesisV2.interface.encodeFunctionData('burnSyntheticTokenTON', [
            feeV2 ? feeV2?.raw.toString() : '0', // uint256 stableBridgingFee;
            this.transit.amountOut.token.address,
            this.transit.amountOut.raw.toString(),
            CROSS_CHAIN_ID,
            tonAddress,
            receiveSide,
            '0x0000000000000000000000000000000000000001',
            this.from,
            this.tokenOut.chainId,
            this.symbiosis.clientId,
        ])
    }
}
