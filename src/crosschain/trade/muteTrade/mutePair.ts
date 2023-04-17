import { Pair, Token, TokenAmount } from '../../../entities'

interface MutePairParams {
    tokenAmountA: TokenAmount
    tokenAmountB: TokenAmount
    poolAddress: string
    stable: boolean
}

const MUTE_PAIR_SYMBOL = 'MUTE-LP'

// Wrap Uniswap Pair to add stable flag and custom liquidity token
export class MutePair extends Pair {
    readonly liquidityToken: Token
    readonly stable: boolean

    constructor({ tokenAmountA, tokenAmountB, poolAddress, stable }: MutePairParams) {
        super(tokenAmountA, tokenAmountB)

        this.stable = stable
        this.liquidityToken = new Token({
            chainId: tokenAmountA.token.chainId,
            address: poolAddress,
            decimals: 18,
            symbol: MUTE_PAIR_SYMBOL,
            name: 'Mute LP',
        })
    }

    public static getAddress(): string {
        throw new Error('Mute doesn`t get address from init hash like Uniswap')
    }
}

export function isMutePair(pair: Pair): pair is MutePair {
    return 'stable' in pair && pair.liquidityToken.symbol === MUTE_PAIR_SYMBOL
}
