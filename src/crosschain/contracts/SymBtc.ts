/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
    BaseContract,
    BigNumber,
    BigNumberish,
    BytesLike,
    CallOverrides,
    ContractTransaction,
    Overrides,
    PopulatedTransaction,
    Signer,
    utils,
} from 'ethers'
import { FunctionFragment, Result, EventFragment } from '@ethersproject/abi'
import { Listener, Provider } from '@ethersproject/providers'
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from './common'

export declare namespace SymBtc {
    export type FromBTCTransactionTailStruct = {
        receiveSide: string
        receiveSideCalldata: BytesLike
        receiveSideOffset: BigNumberish
    }

    export type FromBTCTransactionTailStructOutput = [string, string, BigNumber] & {
        receiveSide: string
        receiveSideCalldata: string
        receiveSideOffset: BigNumber
    }
}

export interface SymBtcInterface extends utils.Interface {
    contractName: 'SymBtc'
    functions: {
        'bridge()': FunctionFragment
        'btcChainId()': FunctionFragment
        'btcTokenAddress()': FunctionFragment
        'getBTCCalldata(uint256,bytes32,uint32,uint64,uint256,uint256,address,(address,bytes,uint256))': FunctionFragment
        'getBTCExternalID(bytes32,uint32,address)': FunctionFragment
        'getBTCInternalID(bytes32,uint32)': FunctionFragment
        'getBtcTotalSupply()': FunctionFragment
        'getHashBTC(uint256,bytes32,uint32,uint64,uint256,uint256,address,(address,bytes,uint256))': FunctionFragment
        'getMpcHash(address)': FunctionFragment
        'getSyntToken()': FunctionFragment
        'initialize(address,address,address,uint256)': FunctionFragment
        'mpc()': FunctionFragment
        'owner()': FunctionFragment
        'packBTCTransactionTail((address,bytes,uint256))': FunctionFragment
        'renounceOwnership()': FunctionFragment
        'synthesis()': FunctionFragment
        'transferOwnership(address)': FunctionFragment
        'unpackBTCTransactionTail(bytes)': FunctionFragment
    }

    encodeFunctionData(functionFragment: 'bridge', values?: undefined): string
    encodeFunctionData(functionFragment: 'btcChainId', values?: undefined): string
    encodeFunctionData(functionFragment: 'btcTokenAddress', values?: undefined): string
    encodeFunctionData(
        functionFragment: 'getBTCCalldata',
        values: [
            BigNumberish,
            BytesLike,
            BigNumberish,
            BigNumberish,
            BigNumberish,
            BigNumberish,
            string,
            SymBtc.FromBTCTransactionTailStruct
        ]
    ): string
    encodeFunctionData(functionFragment: 'getBTCExternalID', values: [BytesLike, BigNumberish, string]): string
    encodeFunctionData(functionFragment: 'getBTCInternalID', values: [BytesLike, BigNumberish]): string
    encodeFunctionData(functionFragment: 'getBtcTotalSupply', values?: undefined): string
    encodeFunctionData(
        functionFragment: 'getHashBTC',
        values: [
            BigNumberish,
            BytesLike,
            BigNumberish,
            BigNumberish,
            BigNumberish,
            BigNumberish,
            string,
            SymBtc.FromBTCTransactionTailStruct
        ]
    ): string
    encodeFunctionData(functionFragment: 'getMpcHash', values: [string]): string
    encodeFunctionData(functionFragment: 'getSyntToken', values?: undefined): string
    encodeFunctionData(functionFragment: 'initialize', values: [string, string, string, BigNumberish]): string
    encodeFunctionData(functionFragment: 'mpc', values?: undefined): string
    encodeFunctionData(functionFragment: 'owner', values?: undefined): string
    encodeFunctionData(
        functionFragment: 'packBTCTransactionTail',
        values: [SymBtc.FromBTCTransactionTailStruct]
    ): string
    encodeFunctionData(functionFragment: 'renounceOwnership', values?: undefined): string
    encodeFunctionData(functionFragment: 'synthesis', values?: undefined): string
    encodeFunctionData(functionFragment: 'transferOwnership', values: [string]): string
    encodeFunctionData(functionFragment: 'unpackBTCTransactionTail', values: [BytesLike]): string

    decodeFunctionResult(functionFragment: 'bridge', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'btcChainId', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'btcTokenAddress', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getBTCCalldata', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getBTCExternalID', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getBTCInternalID', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getBtcTotalSupply', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getHashBTC', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getMpcHash', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getSyntToken', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'initialize', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'mpc', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'owner', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'packBTCTransactionTail', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'renounceOwnership', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'synthesis', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'transferOwnership', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'unpackBTCTransactionTail', data: BytesLike): Result

    events: {
        'OwnershipTransferred(address,address)': EventFragment
    }

    getEvent(nameOrSignatureOrTopic: 'OwnershipTransferred'): EventFragment
}

export type OwnershipTransferredEvent = TypedEvent<[string, string], { previousOwner: string; newOwner: string }>

export type OwnershipTransferredEventFilter = TypedEventFilter<OwnershipTransferredEvent>

export interface SymBtc extends BaseContract {
    contractName: 'SymBtc'
    connect(signerOrProvider: Signer | Provider | string): this
    attach(addressOrName: string): this
    deployed(): Promise<this>

    interface: SymBtcInterface

    queryFilter<TEvent extends TypedEvent>(
        event: TypedEventFilter<TEvent>,
        fromBlockOrBlockhash?: string | number | undefined,
        toBlock?: string | number | undefined
    ): Promise<Array<TEvent>>

    listeners<TEvent extends TypedEvent>(eventFilter?: TypedEventFilter<TEvent>): Array<TypedListener<TEvent>>
    listeners(eventName?: string): Array<Listener>
    removeAllListeners<TEvent extends TypedEvent>(eventFilter: TypedEventFilter<TEvent>): this
    removeAllListeners(eventName?: string): this
    off: OnEvent<this>
    on: OnEvent<this>
    once: OnEvent<this>
    removeListener: OnEvent<this>

    functions: {
        bridge(overrides?: CallOverrides): Promise<[string]>

        btcChainId(overrides?: CallOverrides): Promise<[BigNumber]>

        btcTokenAddress(overrides?: CallOverrides): Promise<[string]>

        getBTCCalldata(
            _btcFee: BigNumberish,
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _wrapSerial: BigNumberish,
            _stableBridgingFee: BigNumberish,
            _amount: BigNumberish,
            _to: string,
            _tail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<[string]>

        getBTCExternalID(
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _receiveSide: string,
            overrides?: CallOverrides
        ): Promise<[string]>

        getBTCInternalID(_btcTxId: BytesLike, _inputIndex: BigNumberish, overrides?: CallOverrides): Promise<[string]>

        getBtcTotalSupply(overrides?: CallOverrides): Promise<[BigNumber]>

        getHashBTC(
            _btcFee: BigNumberish,
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _wrapSerial: BigNumberish,
            _stableBridgingFee: BigNumberish,
            _amount: BigNumberish,
            _to: string,
            _transactionTail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<[string]>

        getMpcHash(_newMPC: string, overrides?: CallOverrides): Promise<[string]>

        getSyntToken(overrides?: CallOverrides): Promise<[string]>

        initialize(
            _bridgeAddress: string,
            _synthesisAddress: string,
            _tokenAddress: string,
            _chainId: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        mpc(overrides?: CallOverrides): Promise<[string]>

        owner(overrides?: CallOverrides): Promise<[string]>

        packBTCTransactionTail(
            _transactionTail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<[string]>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>

        synthesis(overrides?: CallOverrides): Promise<[string]>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        unpackBTCTransactionTail(
            _transactionTail: BytesLike,
            overrides?: CallOverrides
        ): Promise<[SymBtc.FromBTCTransactionTailStructOutput]>
    }

    bridge(overrides?: CallOverrides): Promise<string>

    btcChainId(overrides?: CallOverrides): Promise<BigNumber>

    btcTokenAddress(overrides?: CallOverrides): Promise<string>

    getBTCCalldata(
        _btcFee: BigNumberish,
        _btcTxId: BytesLike,
        _inputIndex: BigNumberish,
        _wrapSerial: BigNumberish,
        _stableBridgingFee: BigNumberish,
        _amount: BigNumberish,
        _to: string,
        _tail: SymBtc.FromBTCTransactionTailStruct,
        overrides?: CallOverrides
    ): Promise<string>

    getBTCExternalID(
        _btcTxId: BytesLike,
        _inputIndex: BigNumberish,
        _receiveSide: string,
        overrides?: CallOverrides
    ): Promise<string>

    getBTCInternalID(_btcTxId: BytesLike, _inputIndex: BigNumberish, overrides?: CallOverrides): Promise<string>

    getBtcTotalSupply(overrides?: CallOverrides): Promise<BigNumber>

    getHashBTC(
        _btcFee: BigNumberish,
        _btcTxId: BytesLike,
        _inputIndex: BigNumberish,
        _wrapSerial: BigNumberish,
        _stableBridgingFee: BigNumberish,
        _amount: BigNumberish,
        _to: string,
        _transactionTail: SymBtc.FromBTCTransactionTailStruct,
        overrides?: CallOverrides
    ): Promise<string>

    getMpcHash(_newMPC: string, overrides?: CallOverrides): Promise<string>

    getSyntToken(overrides?: CallOverrides): Promise<string>

    initialize(
        _bridgeAddress: string,
        _synthesisAddress: string,
        _tokenAddress: string,
        _chainId: BigNumberish,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    mpc(overrides?: CallOverrides): Promise<string>

    owner(overrides?: CallOverrides): Promise<string>

    packBTCTransactionTail(
        _transactionTail: SymBtc.FromBTCTransactionTailStruct,
        overrides?: CallOverrides
    ): Promise<string>

    renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>

    synthesis(overrides?: CallOverrides): Promise<string>

    transferOwnership(
        newOwner: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    unpackBTCTransactionTail(
        _transactionTail: BytesLike,
        overrides?: CallOverrides
    ): Promise<SymBtc.FromBTCTransactionTailStructOutput>

    callStatic: {
        bridge(overrides?: CallOverrides): Promise<string>

        btcChainId(overrides?: CallOverrides): Promise<BigNumber>

        btcTokenAddress(overrides?: CallOverrides): Promise<string>

        getBTCCalldata(
            _btcFee: BigNumberish,
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _wrapSerial: BigNumberish,
            _stableBridgingFee: BigNumberish,
            _amount: BigNumberish,
            _to: string,
            _tail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<string>

        getBTCExternalID(
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _receiveSide: string,
            overrides?: CallOverrides
        ): Promise<string>

        getBTCInternalID(_btcTxId: BytesLike, _inputIndex: BigNumberish, overrides?: CallOverrides): Promise<string>

        getBtcTotalSupply(overrides?: CallOverrides): Promise<BigNumber>

        getHashBTC(
            _btcFee: BigNumberish,
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _wrapSerial: BigNumberish,
            _stableBridgingFee: BigNumberish,
            _amount: BigNumberish,
            _to: string,
            _transactionTail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<string>

        getMpcHash(_newMPC: string, overrides?: CallOverrides): Promise<string>

        getSyntToken(overrides?: CallOverrides): Promise<string>

        initialize(
            _bridgeAddress: string,
            _synthesisAddress: string,
            _tokenAddress: string,
            _chainId: BigNumberish,
            overrides?: CallOverrides
        ): Promise<void>

        mpc(overrides?: CallOverrides): Promise<string>

        owner(overrides?: CallOverrides): Promise<string>

        packBTCTransactionTail(
            _transactionTail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<string>

        renounceOwnership(overrides?: CallOverrides): Promise<void>

        synthesis(overrides?: CallOverrides): Promise<string>

        transferOwnership(newOwner: string, overrides?: CallOverrides): Promise<void>

        unpackBTCTransactionTail(
            _transactionTail: BytesLike,
            overrides?: CallOverrides
        ): Promise<SymBtc.FromBTCTransactionTailStructOutput>
    }

    filters: {
        'OwnershipTransferred(address,address)'(
            previousOwner?: string | null,
            newOwner?: string | null
        ): OwnershipTransferredEventFilter
        OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): OwnershipTransferredEventFilter
    }

    estimateGas: {
        bridge(overrides?: CallOverrides): Promise<BigNumber>

        btcChainId(overrides?: CallOverrides): Promise<BigNumber>

        btcTokenAddress(overrides?: CallOverrides): Promise<BigNumber>

        getBTCCalldata(
            _btcFee: BigNumberish,
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _wrapSerial: BigNumberish,
            _stableBridgingFee: BigNumberish,
            _amount: BigNumberish,
            _to: string,
            _tail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<BigNumber>

        getBTCExternalID(
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _receiveSide: string,
            overrides?: CallOverrides
        ): Promise<BigNumber>

        getBTCInternalID(_btcTxId: BytesLike, _inputIndex: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>

        getBtcTotalSupply(overrides?: CallOverrides): Promise<BigNumber>

        getHashBTC(
            _btcFee: BigNumberish,
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _wrapSerial: BigNumberish,
            _stableBridgingFee: BigNumberish,
            _amount: BigNumberish,
            _to: string,
            _transactionTail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<BigNumber>

        getMpcHash(_newMPC: string, overrides?: CallOverrides): Promise<BigNumber>

        getSyntToken(overrides?: CallOverrides): Promise<BigNumber>

        initialize(
            _bridgeAddress: string,
            _synthesisAddress: string,
            _tokenAddress: string,
            _chainId: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        mpc(overrides?: CallOverrides): Promise<BigNumber>

        owner(overrides?: CallOverrides): Promise<BigNumber>

        packBTCTransactionTail(
            _transactionTail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<BigNumber>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<BigNumber>

        synthesis(overrides?: CallOverrides): Promise<BigNumber>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        unpackBTCTransactionTail(_transactionTail: BytesLike, overrides?: CallOverrides): Promise<BigNumber>
    }

    populateTransaction: {
        bridge(overrides?: CallOverrides): Promise<PopulatedTransaction>

        btcChainId(overrides?: CallOverrides): Promise<PopulatedTransaction>

        btcTokenAddress(overrides?: CallOverrides): Promise<PopulatedTransaction>

        getBTCCalldata(
            _btcFee: BigNumberish,
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _wrapSerial: BigNumberish,
            _stableBridgingFee: BigNumberish,
            _amount: BigNumberish,
            _to: string,
            _tail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<PopulatedTransaction>

        getBTCExternalID(
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _receiveSide: string,
            overrides?: CallOverrides
        ): Promise<PopulatedTransaction>

        getBTCInternalID(
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            overrides?: CallOverrides
        ): Promise<PopulatedTransaction>

        getBtcTotalSupply(overrides?: CallOverrides): Promise<PopulatedTransaction>

        getHashBTC(
            _btcFee: BigNumberish,
            _btcTxId: BytesLike,
            _inputIndex: BigNumberish,
            _wrapSerial: BigNumberish,
            _stableBridgingFee: BigNumberish,
            _amount: BigNumberish,
            _to: string,
            _transactionTail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<PopulatedTransaction>

        getMpcHash(_newMPC: string, overrides?: CallOverrides): Promise<PopulatedTransaction>

        getSyntToken(overrides?: CallOverrides): Promise<PopulatedTransaction>

        initialize(
            _bridgeAddress: string,
            _synthesisAddress: string,
            _tokenAddress: string,
            _chainId: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        mpc(overrides?: CallOverrides): Promise<PopulatedTransaction>

        owner(overrides?: CallOverrides): Promise<PopulatedTransaction>

        packBTCTransactionTail(
            _transactionTail: SymBtc.FromBTCTransactionTailStruct,
            overrides?: CallOverrides
        ): Promise<PopulatedTransaction>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<PopulatedTransaction>

        synthesis(overrides?: CallOverrides): Promise<PopulatedTransaction>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        unpackBTCTransactionTail(_transactionTail: BytesLike, overrides?: CallOverrides): Promise<PopulatedTransaction>
    }
}
