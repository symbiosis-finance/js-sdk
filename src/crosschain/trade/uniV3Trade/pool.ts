import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'
import { computePoolAddress, Pool } from '@uniswap/v3-sdk'
import { ethers } from 'ethers'
import { FeeAmount } from '@uniswap/v3-sdk/dist/constants'
import { Token } from '@uniswap/sdk-core'
import { UniV3Factory } from '../../contracts'

export async function getPool(
    factory: UniV3Factory,
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount
): Promise<Pool | undefined> {
    const currentPoolAddress = computePoolAddress({
        factoryAddress: factory.address,
        tokenA,
        tokenB,
        fee,
    })

    const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, factory.provider)
    try {
        const [token0, token1, liquidity, slot0] = await Promise.all([
            poolContract.token0(),
            poolContract.token1(),
            poolContract.liquidity(),
            poolContract.slot0(),
        ])
        const tokens = {
            [tokenA.address]: tokenA,
            [tokenB.address]: tokenB,
        }
        return new Pool(
            new Token(tokens[token0].chainId, token0, tokens[token0].decimals),
            new Token(tokens[token1].chainId, token1, tokens[token1].decimals),
            fee,
            slot0[0].toString(), // sqrtPriceX96
            liquidity.toString(),
            slot0[1] // tick
        )
    } catch (e) {
        return
    }
}
