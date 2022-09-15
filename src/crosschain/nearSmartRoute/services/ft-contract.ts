import metadataDefaults from '../utils/metadata';
import { nearMetadata, WRAP_NEAR_CONTRACT_ID } from './wrap-near';

export const NEAR_ICON =
  'https://near.org/wp-content/themes/near-19/assets/img/brand-icon.png';
const BANANA_ID = 'berryclub.ek.near';
const CHEDDAR_ID = 'token.cheddar.near';
const CUCUMBER_ID = 'farm.berryclub.ek.near';
const HAPI_ID = 'd9c2d319cd7e6177336b0a9c93c21cb48d84fb54.factory.bridge.near';
const WOO_ID = '4691937a7508860f876c9c0a2a617e7d9e945d4b.factory.bridge.near';

// @@
export const ftViewFunction = (
  tokenId: string,
  {
    methodName,
    args,
  }: {
    methodName: string;
    args?: object;
  }
) => {
  return {} as any;
};

// @@
const db = {} as any;

export interface TokenMetadata {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  icon: string;
  ref?: number | string;
  near?: number | string;
  aurora?: number | string;
  total?: number;
  onRef?: boolean;
  onTri?: boolean;
  amountLabel?: string;
  amount?: number;
  nearNonVisible?: number | string;
}
export const ftGetTokenMetadata = async (
  id: string,
  accountPage?: boolean
): Promise<TokenMetadata> => {
  try {
    let metadata = await db.allTokens().where({ id: id }).first();
    if (!metadata) {
      metadata = await ftViewFunction(id, {
        methodName: 'ft_metadata',
      });
      await db.allTokens().put({
        id: id,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        icon: metadata.icon,
      });
    }

    if (metadata.id === WRAP_NEAR_CONTRACT_ID) {
      if (accountPage)
        return {
          ...metadata,
          icon: metadataDefaults[WRAP_NEAR_CONTRACT_ID],
        };

      return {
        ...metadata,
        icon: nearMetadata.icon,
        symbol: 'NEAR',
      };
    } else if (
      !metadata.icon ||
      metadata.icon === NEAR_ICON ||
      metadata.id === BANANA_ID ||
      metadata.id === CHEDDAR_ID ||
      metadata.id === CUCUMBER_ID ||
      metadata.id === HAPI_ID ||
      metadata.id === WOO_ID ||
      metadata.id === WRAP_NEAR_CONTRACT_ID
    ) {
      metadata.icon = metadataDefaults[id];
    }
    return {
      id,
      ...metadata,
    };
  } catch (err) {
    return {
      id,
      name: id,
      symbol: id?.split('.')[0].slice(0, 8),
      decimals: 6,
      icon: null,
    };
  }
};
