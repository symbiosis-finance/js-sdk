import invariant from 'tiny-invariant'

import { ChainId } from '../constants'

import { WETH, Token } from './token'
import { Pair } from './pair'
import { Price } from './fractions'

export class Route {
    public readonly pairs: Pair[]
    public readonly path: Token[]
    public readonly input: Token
    public readonly output: Token
    public readonly midPrice: Price

    public constructor(pairs: Pair[], input: Token, output?: Token) {
        invariant(pairs.length > 0, 'PAIRS')
        invariant(
            pairs.every((pair) => pair.chainId === pairs[0].chainId),
            'CHAIN_IDS'
        )
        invariant(
            pairs[0].involvesToken(input) || (input.isNative && pairs[0].involvesToken(WETH[pairs[0].chainId])),
            'INPUT'
        )
        invariant(
            typeof output === 'undefined' ||
                pairs[pairs.length - 1].involvesToken(output) ||
                (output.isNative && pairs[pairs.length - 1].involvesToken(WETH[pairs[0].chainId])),
            'OUTPUT'
        )

        const path: Token[] = [input.isNative ? WETH[pairs[0].chainId] : (input as Token)]
        for (const [i, pair] of pairs.entries()) {
            const currentInput = path[i]
            invariant(currentInput.equals(pair.token0) || currentInput.equals(pair.token1), 'PATH')
            const output = currentInput.equals(pair.token0) ? pair.token1 : pair.token0
            path.push(output)
        }

        this.pairs = pairs
        this.path = path
        this.midPrice = Price.fromRoute(this)
        this.input = input
        this.output = output ?? path[path.length - 1]
    }

    public get chainId(): ChainId {
        return this.pairs[0].chainId
    }
}
