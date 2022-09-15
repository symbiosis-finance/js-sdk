import { toNonDivisibleNumber, toReadableNumber } from '../utils/numbers';
import { PoolRPCView } from './api';
import { STABLE_POOL_ID, POOL_TOKEN_REFRESH_INTERVAL } from './near';
import moment from 'moment';
import { isRatedPool, isStablePool } from './near';

export const STABLE_LP_TOKEN_DECIMALS = 18;
export const RATED_POOL_LP_TOKEN_DECIMALS = 24;

export const getStablePoolDecimal = (id: string | number) => {
  if (isRatedPool(id)) return RATED_POOL_LP_TOKEN_DECIMALS;
  else if (isStablePool(id)) return STABLE_LP_TOKEN_DECIMALS;
};

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
  id: Number(id >= 0 ? id : pool.id),
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

// @@
const refFiViewFunction = ({
  methodName,
  args,
}: {
  methodName: string;
  args?: object;
}) => {
  return {} as any;
};

export const getPool = async (id: number): Promise<Pool> => {
  return refFiViewFunction({
    methodName: 'get_pool',
    args: { pool_id: id },
  }).then((pool: PoolRPCView) => parsePool(pool, id));
};

export const getStablePool = async (pool_id: number): Promise<StablePool> => {
  if (isRatedPool(pool_id)) {
    const pool_info = await refFiViewFunction({
      methodName: 'get_rated_pool',
      args: { pool_id },
    });

    return {
      ...pool_info,
      id: pool_id,
    };
  }

  const pool_info = await refFiViewFunction({
    methodName: 'get_stable_pool',
    args: { pool_id },
  });

  return {
    ...pool_info,
    id: pool_id,
    rates: pool_info.c_amounts.map((i: any) =>
      toNonDivisibleNumber(STABLE_LP_TOKEN_DECIMALS, '1')
    ),
  };
};

export const getStablePoolFromCache = async (
  id?: string,
  loadingTrigger?: boolean
) => {
  const stable_pool_id = id || STABLE_POOL_ID.toString();

  const pool_key = getStablePoolKey(stable_pool_id);

  const info = getStablePoolInfoKey(stable_pool_id);

  const stablePoolCache = JSON.parse(localStorage.getItem(pool_key));

  const stablePoolInfoCache = JSON.parse(localStorage.getItem(info));

  const isStablePoolCached =
    stablePoolCache?.update_time &&
    Number(stablePoolCache.update_time) >
      Number(moment().unix() - Number(POOL_TOKEN_REFRESH_INTERVAL));

  const isStablePoolInfoCached =
    stablePoolInfoCache?.update_time &&
    Number(stablePoolInfoCache.update_time) >
      Number(moment().unix() - Number(POOL_TOKEN_REFRESH_INTERVAL));

  const loadingTriggerSig =
    typeof loadingTrigger === 'undefined' ||
    (typeof loadingTrigger !== 'undefined' && loadingTrigger);

  const stablePool =
    isStablePoolCached || !loadingTriggerSig
      ? stablePoolCache
      : await getPool(Number(stable_pool_id));

  const stablePoolInfo =
    isStablePoolInfoCached || !loadingTriggerSig
      ? stablePoolInfoCache
      : await getStablePool(Number(stable_pool_id));

  if (!isStablePoolCached && loadingTriggerSig) {
    localStorage.setItem(
      pool_key,
      JSON.stringify({ ...stablePool, update_time: moment().unix() })
    );
  }

  if (!isStablePoolInfoCached && loadingTriggerSig) {
    localStorage.setItem(
      info,
      JSON.stringify({ ...stablePoolInfo, update_time: moment().unix() })
    );
  }
  stablePool.rates = stablePoolInfo.token_account_ids.reduce(
    (acc: any, cur: any, i: number) => ({
      ...acc,
      [cur]: toReadableNumber(
        getStablePoolDecimal(stablePool.id),
        stablePoolInfo.rates[i]
      ),
    }),
    {}
  );

  return [stablePool, stablePoolInfo];
};
