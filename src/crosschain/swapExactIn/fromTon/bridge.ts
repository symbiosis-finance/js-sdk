import { SwapExactInResult } from '../../types'
import { Error } from '../../error'
import { Bridge, EVM_TO_TON } from '../../chainUtils/ton'
import { Address } from '@ton/core'
import { Percent, TokenAmount } from '../../../entities'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { FromTonParams, MIN_META_SYNTH_TONS } from '../fromTonSwap'

export function bridgeFromTon(params: FromTonParams): SwapExactInResult | undefined {
    const { context, poolConfig } = params
    const { symbiosis, tokenAmountIn, tokenOut, to, deadline } = context

    const sToken = symbiosis.getRepresentation(tokenAmountIn.token, poolConfig.chainId)
    if (!sToken) {
        return
    }
    if (!tokenOut.equals(sToken)) {
        return
    }

    const tonPortal = symbiosis.config.chains.find((chain) => chain.id === tokenAmountIn.token.chainId)?.tonPortal
    if (!tonPortal) {
        throw new Error('Ton portal not found in symbiosis config')
    }

    const tonTokenAddress = EVM_TO_TON[tokenAmountIn.token.address.toLowerCase()]
    if (!tonTokenAddress) {
        throw new Error('EVM address not found in EVM_TO_TON')
    }

    const cell = Bridge.synthesizeMessage({
        stableBridgingFee: BigInt('0'),
        token: Address.parse(tonTokenAddress),
        amount: BigInt(tokenAmountIn.raw.toString()),
        chain2Address: Buffer.from(to.slice(2), 'hex'),
        receiveSide: Buffer.from(symbiosis.synthesis(poolConfig.chainId).address.slice(2), 'hex'),
        oppositeBridge: Buffer.from(symbiosis.bridge(poolConfig.chainId).address.slice(2), 'hex'),
        revertableAddress: Buffer.from(to.slice(2), 'hex'),
        chainId: BigInt(poolConfig.chainId),
    })

    const tonFee = new TokenAmount(tokenAmountIn.token, MIN_META_SYNTH_TONS)

    return {
        kind: 'bridge',
        transactionType: 'ton',
        transactionRequest: {
            validUntil: deadline,
            messages: [
                {
                    address: tonPortal,
                    amount: tokenAmountIn.add(tonFee).raw.toString(),
                    payload: cell.toBoc().toString('base64'),
                },
            ],
        },
        tokenAmountOut: new TokenAmount(tokenOut, tokenAmountIn.raw),
        tokenAmountOutMin: new TokenAmount(tokenOut, tokenAmountIn.raw),
        approveTo: AddressZero,
        routes: [
            {
                provider: 'symbiosis',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
        fees: [
            {
                provider: 'ton',
                value: tonFee,
                description: 'TON fee',
            },
            {
                provider: 'symbiosis',
                value: new TokenAmount(tokenOut, '0'),
                description: 'Bridge fee',
            },
        ],
        priceImpact: new Percent('0', '0'),
    }
}
