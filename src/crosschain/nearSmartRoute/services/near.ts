import getConfig, { getExtraStablePoolConfig } from './config';

const config = getConfig();

export const POOL_TOKEN_REFRESH_INTERVAL = config.POOL_TOKEN_REFRESH_INTERVAL;

export const STABLE_POOL_ID = config.STABLE_POOL_ID;

export const STABLE_POOL_USN_ID = config.STABLE_POOL_USN_ID;

export const {
  BTCIDS,
  CUSDIDS,
  BTC_STABLE_POOL_ID,
  CUSD_STABLE_POOL_ID,
  STNEAR_POOL_ID,
  STNEARIDS,
  BTC_STABLE_POOL_INDEX,
  CUSD_STABLE_POOL_INDEX,
  STNEAR_POOL_INDEX,
  LINEARIDS,
  LINEAR_POOL_INDEX,
  LINEAR_POOL_ID,
  NEAX_POOL_ID,
  NEAX_POOL_INDEX,
  NEARXIDS,
} = getExtraStablePoolConfig();

export const extraStableTokenIds = BTCIDS.concat(LINEARIDS)
  .concat(STNEARIDS)
  .concat(NEARXIDS)
  .concat(CUSDIDS)
  .filter((_) => !!_);

export const isRatedPool = (id: string | number) => {
  return getExtraStablePoolConfig().RATED_POOLS_IDS.includes(id.toString());
};

export const ALL_STABLE_POOL_IDS = [
  STABLE_POOL_ID,
  STABLE_POOL_USN_ID,
  BTC_STABLE_POOL_ID,
  STNEAR_POOL_ID,
  CUSD_STABLE_POOL_ID,
  LINEAR_POOL_ID,
  NEAX_POOL_ID,
]
  .filter((_) => _)
  .map((id) => id.toString());

export const STABLE_TOKEN_INDEX = config.STABLE_TOKEN_INDEX;

export const STABLE_TOKEN_USN_INDEX = config.STABLE_TOKEN_USN_INDEX;

export const getStableTokenIndex = (stable_pool_id: string | number) => {
  const id = stable_pool_id.toString();
  switch (id) {
    case STABLE_POOL_ID.toString():
      return STABLE_TOKEN_INDEX;
    case STABLE_POOL_USN_ID.toString():
      return STABLE_TOKEN_USN_INDEX;
    case BTC_STABLE_POOL_ID:
      return BTC_STABLE_POOL_INDEX;
    case STNEAR_POOL_ID:
      return STNEAR_POOL_INDEX;
    case CUSD_STABLE_POOL_ID:
      return CUSD_STABLE_POOL_INDEX;
    case LINEAR_POOL_ID:
      return LINEAR_POOL_INDEX;
    case NEAX_POOL_ID:
      return NEAX_POOL_INDEX;
  }
};

export const isStablePool = (id: string | number) => {
  return ALL_STABLE_POOL_IDS.map((id) => id.toString()).includes(id.toString());
};
