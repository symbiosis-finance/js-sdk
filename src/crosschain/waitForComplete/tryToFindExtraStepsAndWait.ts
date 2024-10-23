import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { TxNotFound } from './constants'
import { fetchData, longPolling } from './utils'
import { TransactionReceipt } from '@ethersproject/providers'
import { ERC20__factory, Synthesis__factory, WTON__factory } from '../contracts'
import { BigNumber } from 'ethers'
import { LogDescription } from '@ethersproject/abi'
import { waitForTonTxComplete } from './waitForTonDepositTxMined'
import { NATIVE_TON_BRIDGE_OPTIONS, TON_TOKEN_DECIMALS } from '../chainUtils'
import { SwapEthToTonEvent } from '../contracts/WTON'
import { Address } from '@ton/core'
import { parseUnits } from 'ethers/lib/utils'

interface ThorStatusResponse {
    observed_tx: {
        tx: {
            id: string
        }
        out_hashes?: string[]
        status?: string
    }
}

type ExtraStep = 'thorChain' | 'burnRequestBtc' | 'burnRequestTon' | 'swapEthToTon'

export async function tryToFindExtraStepsAndWait(
    symbiosis: Symbiosis,
    chainId: ChainId,
    txHash: string
): Promise<{ extraStep?: ExtraStep; outHash: string }> {
    const txHash1 = '0x3e3b57b535dab277f9bcd120ca4008d9ad194ce98c55f21252ae56ed3f349d50'
    const provider = symbiosis.getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash1)
    if (!receipt) {
        throw new TxNotFound(txHash)
    }

    const isThorChainDeposit = await findThorChainDeposit(receipt)
    if (isThorChainDeposit) {
        const outHash = await waitForThorChainTx(txHash)
        return {
            extraStep: 'thorChain',
            outHash,
        }
    }

    const burnRequestBtc = await findBurnRequestBtc(receipt)
    if (burnRequestBtc) {
        const { burnSerial, rtoken } = burnRequestBtc
        const btc = symbiosis.tokens().find((t) => t.address.toLowerCase() === rtoken.toLowerCase())
        if (!btc) {
            throw new Error('BTC token not found')
        }
        const forwarderUrl = symbiosis.getForwarderUrl(btc.chainId)
        const outHash = await waitUnwrapBtcTxComplete(forwarderUrl, burnSerial)

        return {
            extraStep: 'burnRequestBtc',
            outHash,
        }
    }

    const burnRequestTon = await findBurnRequestTON(receipt)
    if (burnRequestTon) {
        const { internalId, chainId } = burnRequestTon

        const outHash = await waitForTonTxComplete(symbiosis, internalId, +chainId)
        return {
            extraStep: 'burnRequestTon',
            outHash,
        }
    }

    const nativeTonBridge = await findNativeTonBridge(symbiosis, chainId, receipt)
    if (nativeTonBridge) {
        const { outHash } = nativeTonBridge
        return {
            extraStep: 'swapEthToTon',
            outHash,
        }
    }

    return {
        outHash: txHash,
    }
}

export async function findThorChainDeposit(receipt: TransactionReceipt) {
    const thorChainDepositTopic0 = '0xef519b7eb82aaf6ac376a6df2d793843ebfd593de5f1a0601d3cc6ab49ebb395'
    const log = receipt.logs.find((log) => {
        return log.topics[0] === thorChainDepositTopic0
    })

    return !!log
}

export async function waitForThorChainTx(txHash: string): Promise<string> {
    const txHashCleaned = txHash.startsWith('0x') ? txHash.slice(2) : txHash
    const thorUrl = new URL(`https://thornode.ninerealms.com/thorchain/tx/${txHashCleaned}`)

    return longPolling({
        pollingFunction: async () => {
            const result: ThorStatusResponse = await fetchData(thorUrl)

            const { status, out_hashes } = result.observed_tx
            if (status === 'done' && out_hashes && out_hashes.length > 0) {
                return out_hashes.find((outHash) => {
                    return outHash !== '0000000000000000000000000000000000000000000000000000000000000000'
                })
            }

            return
        },
        successCondition: (btcHash) => !!btcHash,
        error: new TxNotFound(txHash),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 60_000, // 1 minute
    })
}

async function findBurnRequestBtc(receipt: TransactionReceipt): Promise<
    | {
          burnSerial: BigNumber
          rtoken: string
      }
    | undefined
> {
    const synthesisInterface = Synthesis__factory.createInterface()
    const topic0 = synthesisInterface.getEventTopic('BurnRequestBTC')
    const log = receipt.logs.find((log) => {
        return log.topics[0] === topic0
    })
    if (!log) {
        return
    }
    const data: LogDescription = synthesisInterface.parseLog(log)

    const { burnSerial, rtoken } = data.args

    return { burnSerial, rtoken }
}

async function findBurnRequestTON(receipt: TransactionReceipt): Promise<
    | {
          internalId: string
          chainId: string
      }
    | undefined
> {
    const synthesisInterface = Synthesis__factory.createInterface()
    const burnRequestTonTopic = synthesisInterface.getEventTopic('BurnRequestTON')
    const log = receipt.logs.find((log) => {
        return log.topics[0] === burnRequestTonTopic
    })

    if (!log) {
        return
    }
    const data: LogDescription = synthesisInterface.parseLog(log)

    const { id, chainID } = data.args

    return { internalId: id, chainId: chainID.toString() }
}

interface UnwrapSerialBTCResponse {
    serial: number
    to: string
    tx: string
    value: number
    outputIdx: string
}

async function waitUnwrapBtcTxComplete(forwarderUrl: string, burnSerialBtc: BigNumber): Promise<string> {
    const unwrapInfoUrl = new URL(`${forwarderUrl}/unwrap?serial=${burnSerialBtc.toString()}`)

    const result = await longPolling<UnwrapSerialBTCResponse>({
        pollingFunction: async (): Promise<UnwrapSerialBTCResponse> => {
            return fetchData(unwrapInfoUrl)
        },
        successCondition: (result) => !!result.outputIdx,
        error: new TxNotFound(burnSerialBtc.toString()),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 10_000, // 10 seconds
    })

    return result.tx
}

// native TON bridge
export async function findNativeTonBridge(symbiosis: Symbiosis, chainId: ChainId, receipt: TransactionReceipt) {
    const provider = symbiosis.getProvider(chainId)
    const currentBlock = await provider.getBlockNumber()
    const now = Math.floor(Date.now() / 1000)

    //1. search on ERC20 transfer event to broadcaster EOA
    const erc20Interface = ERC20__factory.createInterface()
    const transferTopic = erc20Interface.getEventTopic('Transfer')
    const logs = receipt.logs.filter((log) => {
        return log.topics[0] === transferTopic
    })

    if (logs.length === 0) {
        throw new Error('No transfer logs found')
    }

    const transferEvents = logs.map((log) => {
        const data = erc20Interface.parseLog(log)
        const { from, to, value } = data.args
        return { from, to, value }
    })

    const broadcasterEOA = symbiosis.config.revertableAddress.default.toLowerCase()

    const transferEventToBroadcaster = transferEvents.find(({ to }) => to.toLowerCase() === broadcasterEOA)

    if (!transferEventToBroadcaster) {
        throw new Error(`No transfer event to broadcaster found in ${receipt.transactionHash}`)
    }

    const WTON = NATIVE_TON_BRIDGE_OPTIONS.find((option) => option.chainId === chainId)?.wTon.address

    if (!WTON) {
        throw new Error(`No WTON found in ${chainId}`)
    }

    //2. search on WTON contract swapEthToTon event
    const wtonContractInterface = WTON__factory.createInterface()
    const swapEthToTonFilter = WTON__factory.connect(WTON, provider).filters.SwapEthToTon(broadcasterEOA)

    const swapEthToTonEventFound = await longPolling({
        pollingFunction: async () => {
            const swapEthToTonLogs = await provider.getLogs({
                ...swapEthToTonFilter,
                fromBlock: currentBlock,
                toBlock: 'latest',
            })

            const swapEthToTonEvent = swapEthToTonLogs
                .map((log) => {
                    return wtonContractInterface.parseLog(log)
                })
                .find((event) => event.args.value.eq(BigInt(transferEventToBroadcaster.value)))?.args

            if (!swapEthToTonEvent) {
                return null
            }

            const { to_wc, to_addr_hash, value } = swapEthToTonEvent

            return {
                workchain: to_wc,
                addrHash: to_addr_hash,
                value,
            }
        },
        successCondition: (result) => !!result,
        error: new Error(`No swapEthToTon event found on ${WTON}`),
        exceedDelay: 300_000, // 5 minutes
        pollingInterval: 10_000, // 10 seconds
    })

    if (!swapEthToTonEventFound) {
        throw new Error(`No swapEthToTon event found on ${WTON}`)
    }

    //3. search in TON blockchain
    const tonClient = await symbiosis.getTonClient()
    const bridgeTonAddr = NATIVE_TON_BRIDGE_OPTIONS.find((option) => option.chainId === chainId)?.bridgeTonAddr
    const MULTIPLIER = BigNumber.from('100')
    const PERCENT = BigNumber.from('25') // 0.25%
    const STATIC_BRIDGE_FEE = parseUnits('5', TON_TOKEN_DECIMALS) // 5 TON fee

    const tonPercentFee = BigNumber.from(swapEthToTonEventFound.value).mul(PERCENT).div(MULTIPLIER.mul('100'))

    // we don't know exactly how much TON will be received from bridge, but we know that it should be in range
    const tonReceivedFromBridge = BigNumber.from(swapEthToTonEventFound.value).sub(tonPercentFee).sub(STATIC_BRIDGE_FEE)
    const percentagesGap = tonReceivedFromBridge.mul(2).div(100) // 2%
    const tonAmountRange = [tonReceivedFromBridge.sub(percentagesGap), tonReceivedFromBridge.add(percentagesGap)]

    const tonAddress = Address.parse(`${swapEthToTonEventFound.workchain}:${swapEthToTonEventFound.addrHash.slice(2)}`)

    const txTon = await longPolling({
        pollingFunction: async () => {
            const txs = await tonClient.getTransactions(tonAddress, {
                limit: 20,
                archival: true,
            })

            const tx = txs.find((tx) => {
                if (!Address.isAddress(tx?.inMessage?.info.src) || !bridgeTonAddr) {
                    return undefined
                }

                if (tx.now < now) {
                    return undefined
                }

                const txInMessageAddr = tx.inMessage.info.src
                const tonTxValue =
                    tx.inMessage.info.type === 'internal'
                        ? BigNumber.from(tx.inMessage.info.value.coins)
                        : BigNumber.from(0)

                return (
                    txInMessageAddr.equals(Address.parse(bridgeTonAddr)) &&
                    tx.inMessage.info.type === 'internal' &&
                    tonTxValue.gt(tonAmountRange[0]) &&
                    tonTxValue.lt(tonAmountRange[1])
                )
            })

            return tx
        },
        successCondition: (tx) => !!tx,
        error: new Error(`No transaction found on ${tonAddress.toString()} in TON blockchain`),
        exceedDelay: 600_000, // 10 minutes
        pollingInterval: 10_000, // 10 seconds
    })

    return {
        outHash: txTon.hash().toString('hex'),
    }
}
