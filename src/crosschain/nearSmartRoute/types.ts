import { TokenMetadata } from './services/ft-contract';
import { Pool } from './services/pool';
import { RoutePool } from './services/stable-swap';
import { PoolMode } from './services/swap';

export interface EstimateSwapView {
  estimate: string;
  pool: Pool;
  intl?: any;
  dy?: string;
  status?: PoolMode;
  token?: TokenMetadata;
  noFeeAmountOut?: string;
  inputToken?: string;
  outputToken?: string;
  nodeRoute?: string[];
  tokens?: TokenMetadata[];
  routeInputToken?: string;
  route?: RoutePool[];
  allRoutes?: RoutePool[][];
  allNodeRoutes?: string[][];
  totalInputAmount?: string;
}
