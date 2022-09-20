import { Account } from 'near-api-js';

const DEFAULT_PAGE_LIMIT = 100;

const parsePool = (pool: any, id: number) => ({
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

const getAllPools = async (
  refFiContractId: string,
  account: Account,
  page: number = 1,
  perPage: number = DEFAULT_PAGE_LIMIT
) => {
  const index = (page - 1) * perPage;

  const poolData = await account.viewFunction(refFiContractId, 'get_pools', {
    from_index: index,
    limit: perPage,
  });

  return poolData
    .map((rawPool: any, i: number) => parsePool(rawPool, i + index))
    .map(
      (pool: {
        id: number;
        tokenIds: string[];
        supplies: any[];
        fee: number;
        shareSupply: string;
        token0_ref_price: string;
        Dex: string;
      }) => ({
        id: pool.id,
        token1Id: pool.tokenIds[0],
        token2Id: pool.tokenIds[1],
        token1Supply: pool.supplies[pool.tokenIds[0] as any],
        token2Supply: pool.supplies[pool.tokenIds[1] as any],
        fee: pool.fee,
        shares: pool.shareSupply,
        update_time: Date.now(),
        token0_price: pool.token0_ref_price || '0',
        Dex: pool.Dex,
      })
    );
};

export async function loadPools(account: Account, refFiContractId: string) {
  const totalPools = await account.viewFunction(
    refFiContractId,
    'get_number_of_pools'
  );

  const pages = Math.ceil(totalPools / DEFAULT_PAGE_LIMIT);

  const pools = (
    await Promise.all(
      Array.from({ length: pages }, (_, i) =>
        getAllPools(refFiContractId, account, i + 1)
      )
    )
  )
    .flat()
    .map((p) => ({ ...p, Dex: 'ref' }));

  return pools;
}
