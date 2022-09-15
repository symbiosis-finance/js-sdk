import { TokenMetadata } from './ft-contract';

export interface PoolRPCView {
  id: number;
  token_account_ids: string[];
  token_symbols: string[];
  amounts: string[];
  pool_kind?: string;
  total_fee: number;
  shares_total_supply: string;
  tvl: number;
  token0_ref_price: string;
  share: string;
  decimalsHandled?: boolean;
  tokens_meta_data?: TokenMetadata[];
}
