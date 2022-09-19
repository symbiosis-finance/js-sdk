import { Config, ExtraStablePoolConfig } from './config';

export const STABLE_LP_TOKEN_DECIMALS = 18;
export const RATED_POOL_LP_TOKEN_DECIMALS = 24;

export class NearUtils {
  private allStablePoolIds: (number | string)[];

  constructor(
    private config: Config,
    private extraStablePoolConfig: ExtraStablePoolConfig
  ) {
    this.allStablePoolIds = [
      config.STABLE_POOL_ID,
      config.STABLE_POOL_USN_ID,
      extraStablePoolConfig.BTC_STABLE_POOL_ID,
      extraStablePoolConfig.STNEAR_POOL_ID,
      extraStablePoolConfig.CUSD_STABLE_POOL_ID,
      extraStablePoolConfig.LINEAR_POOL_ID,
      extraStablePoolConfig.NEAX_POOL_ID,
    ]
      .filter((_) => _)
      .map((id) => id.toString());
  }

  getStableTokenIndex(stable_pool_id: string | number) {
    const id = stable_pool_id.toString();
    switch (id) {
      case this.config.STABLE_POOL_ID.toString():
        return this.config.STABLE_TOKEN_INDEX;
      case this.config.STABLE_POOL_USN_ID.toString():
        return this.config.STABLE_TOKEN_USN_INDEX;
      case this.extraStablePoolConfig.BTC_STABLE_POOL_ID:
        return this.extraStablePoolConfig.BTC_STABLE_POOL_INDEX;
      case this.extraStablePoolConfig.STNEAR_POOL_ID:
        return this.extraStablePoolConfig.STNEAR_POOL_INDEX;
      case this.extraStablePoolConfig.CUSD_STABLE_POOL_ID:
        return this.extraStablePoolConfig.CUSD_STABLE_POOL_INDEX;
      case this.extraStablePoolConfig.LINEAR_POOL_ID:
        return this.extraStablePoolConfig.LINEAR_POOL_INDEX;
      case this.extraStablePoolConfig.NEAX_POOL_ID:
        return this.extraStablePoolConfig.NEAX_POOL_INDEX;
    }
  }

  isRatedPool(id: string | number) {
    return this.extraStablePoolConfig.RATED_POOLS_IDS.includes(id.toString());
  }

  isStablePool(id: string | number) {
    return this.allStablePoolIds
      .map((id) => id.toString())
      .includes(id.toString());
  }

  getStablePoolDecimal(id: string | number) {
    if (this.isRatedPool(id)) return RATED_POOL_LP_TOKEN_DECIMALS;
    else if (this.isStablePool(id)) return STABLE_LP_TOKEN_DECIMALS;
  }
}
