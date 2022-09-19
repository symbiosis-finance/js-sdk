import { Context } from '../context';
import { toNonDivisibleNumber, toReadableNumber } from '../utils/numbers';
import { PoolRPCView } from './api';
import { STABLE_LP_TOKEN_DECIMALS } from './near';

export const DEFAULT_PAGE_LIMIT = 100;
const getStablePoolKey = (id: string) => `STABLE_POOL_VALUE_${id}`;

export const getStablePoolInfoKey = (id: string) =>
  `REF_FI_STABLE_Pool_INFO_VALUE_${id}`;

export interface Pool {
  id: number;
  tokenIds: string[];
  supplies: { [key: string]: string };
  fee: number;
  shareSupply: string;
  tvl: number;
  token0_ref_price: string;
  partialAmountIn?: string;
  Dex?: string;
  rates?: {
    [id: string]: string;
  };
}

export interface StablePool {
  id: number;
  token_account_ids: string[];
  decimals: number[];
  amounts: string[];
  c_amounts: string[];
  total_fee: number;
  shares_total_supply: string;
  amp: number;
  rates: string[];
}

export const parsePool = (pool: PoolRPCView, id?: number): Pool => ({
  id: Number(id !== undefined && id >= 0 ? id : pool.id),
  tokenIds: pool.token_account_ids,
  supplies: pool.amounts.reduce(
    (acc: { [tokenId: string]: string }, amount: string, i: number) => {
      acc[pool.token_account_ids[i]] = amount;
      return acc;
    },
    {}
  ),
  fee: pool.total_fee,
  shareSupply: pool.shares_total_supply,
  tvl: pool.tvl,
  token0_ref_price: pool.token0_ref_price,
});

export const getPool = async (context: Context, id: number): Promise<Pool> => {
  return context
    .refFiViewFunction({
      methodName: 'get_pool',
      args: { pool_id: id },
    })
    .then((pool: PoolRPCView) => parsePool(pool, id));
};

export const getStablePool = async (
  context: Context,
  pool_id: number
): Promise<StablePool> => {
  if (context.nearUtils.isRatedPool(pool_id)) {
    const pool_info = await context.refFiViewFunction({
      methodName: 'get_rated_pool',
      args: { pool_id },
    });

    return {
      ...pool_info,
      id: pool_id,
    };
  }

  const pool_info = await context.refFiViewFunction({
    methodName: 'get_stable_pool',
    args: { pool_id },
  });

  return {
    ...pool_info,
    id: pool_id,
    rates: pool_info.c_amounts.map(() =>
      toNonDivisibleNumber(STABLE_LP_TOKEN_DECIMALS, '1')
    ),
  };
};

export const getStablePoolFromCache = async (
  context: Context,
  id?: string,
  loadingTrigger?: boolean
) => {
  const stable_pool_id = id || context.config.STABLE_POOL_ID.toString();

  const pool_key = getStablePoolKey(stable_pool_id);

  const info = getStablePoolInfoKey(stable_pool_id);

  const stablePoolCache = JSON.parse(localStorage.getItem(pool_key)!);

  const stablePoolInfoCache = JSON.parse(localStorage.getItem(info)!);

  const isStablePoolCached =
    stablePoolCache?.update_time &&
    Number(stablePoolCache.update_time) >
      Number(Date.now() - Number(context.config.POOL_TOKEN_REFRESH_INTERVAL));

  const isStablePoolInfoCached =
    stablePoolInfoCache?.update_time &&
    Number(stablePoolInfoCache.update_time) >
      Number(Date.now() - Number(context.config.POOL_TOKEN_REFRESH_INTERVAL));

  const loadingTriggerSig =
    typeof loadingTrigger === 'undefined' ||
    (typeof loadingTrigger !== 'undefined' && loadingTrigger);

  const stablePool =
    isStablePoolCached || !loadingTriggerSig
      ? stablePoolCache
      : await getPool(context, Number(stable_pool_id));

  const stablePoolInfo =
    isStablePoolInfoCached || !loadingTriggerSig
      ? stablePoolInfoCache
      : await getStablePool(context, Number(stable_pool_id));

  if (!isStablePoolCached && loadingTriggerSig) {
    localStorage.setItem(
      pool_key,
      JSON.stringify({ ...stablePool, update_time: Date.now() })
    );
  }

  if (!isStablePoolInfoCached && loadingTriggerSig) {
    localStorage.setItem(
      info,
      JSON.stringify({ ...stablePoolInfo, update_time: Date.now() })
    );
  }
  stablePool.rates = stablePoolInfo.token_account_ids.reduce(
    (acc: any, cur: any, i: number) => ({
      ...acc,
      [cur]: toReadableNumber(
        context.nearUtils.getStablePoolDecimal(stablePool.id)!,
        stablePoolInfo.rates[i]
      ),
    }),
    {}
  );

  return [stablePool, stablePoolInfo];
};
