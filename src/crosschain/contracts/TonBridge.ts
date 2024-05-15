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

export declare namespace TonBridge {
    export type TonAddressStruct = {
        workchain: BigNumberish
        address_hash: BytesLike
    }

    export type TonAddressStructOutput = [number, string] & {
        workchain: number
        address_hash: string
    }
}

export interface TonBridgeInterface extends utils.Interface {
    contractName: 'TonBridge'
    functions: {
        'bridgeChainId()': FunctionFragment
        'broadcaster()': FunctionFragment
        'callBridgeRequest(uint256,address,(int8,bytes32))': FunctionFragment
        'changeBridgeChainId(uint256)': FunctionFragment
        'changeBroadcaster(address)': FunctionFragment
        'changeSymbiosisBridge(address)': FunctionFragment
        'changeTonBridge(address)': FunctionFragment
        'initialize(address,address,uint256,address)': FunctionFragment
        'owner()': FunctionFragment
        'renounceOwnership()': FunctionFragment
        'symbiosisBridge()': FunctionFragment
        'tonBridge()': FunctionFragment
        'transferOwnership(address)': FunctionFragment
    }

    encodeFunctionData(functionFragment: 'bridgeChainId', values?: undefined): string
    encodeFunctionData(functionFragment: 'broadcaster', values?: undefined): string
    encodeFunctionData(
        functionFragment: 'callBridgeRequest',
        values: [BigNumberish, string, TonBridge.TonAddressStruct]
    ): string
    encodeFunctionData(functionFragment: 'changeBridgeChainId', values: [BigNumberish]): string
    encodeFunctionData(functionFragment: 'changeBroadcaster', values: [string]): string
    encodeFunctionData(functionFragment: 'changeSymbiosisBridge', values: [string]): string
    encodeFunctionData(functionFragment: 'changeTonBridge', values: [string]): string
    encodeFunctionData(functionFragment: 'initialize', values: [string, string, BigNumberish, string]): string
    encodeFunctionData(functionFragment: 'owner', values?: undefined): string
    encodeFunctionData(functionFragment: 'renounceOwnership', values?: undefined): string
    encodeFunctionData(functionFragment: 'symbiosisBridge', values?: undefined): string
    encodeFunctionData(functionFragment: 'tonBridge', values?: undefined): string
    encodeFunctionData(functionFragment: 'transferOwnership', values: [string]): string

    decodeFunctionResult(functionFragment: 'bridgeChainId', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'broadcaster', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'callBridgeRequest', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'changeBridgeChainId', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'changeBroadcaster', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'changeSymbiosisBridge', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'changeTonBridge', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'initialize', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'owner', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'renounceOwnership', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'symbiosisBridge', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'tonBridge', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'transferOwnership', data: BytesLike): Result

    events: {
        'ChangeBridgeChainId(uint256)': EventFragment
        'ChangeBroadcaster(address)': EventFragment
        'ChangeSymbiosisBridge(address)': EventFragment
        'ChangeTonBridge(address)': EventFragment
        'OwnershipTransferred(address,address)': EventFragment
    }

    getEvent(nameOrSignatureOrTopic: 'ChangeBridgeChainId'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'ChangeBroadcaster'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'ChangeSymbiosisBridge'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'ChangeTonBridge'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'OwnershipTransferred'): EventFragment
}

export type ChangeBridgeChainIdEvent = TypedEvent<[BigNumber], { newBridgeChainId: BigNumber }>

export type ChangeBridgeChainIdEventFilter = TypedEventFilter<ChangeBridgeChainIdEvent>

export type ChangeBroadcasterEvent = TypedEvent<[string], { newBroadcaster: string }>

export type ChangeBroadcasterEventFilter = TypedEventFilter<ChangeBroadcasterEvent>

export type ChangeSymbiosisBridgeEvent = TypedEvent<[string], { newBridge: string }>

export type ChangeSymbiosisBridgeEventFilter = TypedEventFilter<ChangeSymbiosisBridgeEvent>

export type ChangeTonBridgeEvent = TypedEvent<[string], { newBridge: string }>

export type ChangeTonBridgeEventFilter = TypedEventFilter<ChangeTonBridgeEvent>

export type OwnershipTransferredEvent = TypedEvent<[string, string], { previousOwner: string; newOwner: string }>

export type OwnershipTransferredEventFilter = TypedEventFilter<OwnershipTransferredEvent>

export interface TonBridge extends BaseContract {
    contractName: 'TonBridge'
    connect(signerOrProvider: Signer | Provider | string): this
    attach(addressOrName: string): this
    deployed(): Promise<this>

    interface: TonBridgeInterface

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
        bridgeChainId(overrides?: CallOverrides): Promise<[BigNumber]>

        broadcaster(overrides?: CallOverrides): Promise<[string]>

        callBridgeRequest(
            _amount: BigNumberish,
            _token: string,
            _tonAddress: TonBridge.TonAddressStruct,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        changeBridgeChainId(
            _newBridgeChainId: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        changeBroadcaster(
            _newBroadcaster: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        changeSymbiosisBridge(
            _newSymbiosisBridge: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        changeTonBridge(
            _newTonBridge: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        initialize(
            _tonBridge: string,
            _symbiosisBridge: string,
            _bridgeChainId: BigNumberish,
            _broadcaster: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        owner(overrides?: CallOverrides): Promise<[string]>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>

        symbiosisBridge(overrides?: CallOverrides): Promise<[string]>

        tonBridge(overrides?: CallOverrides): Promise<[string]>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>
    }

    bridgeChainId(overrides?: CallOverrides): Promise<BigNumber>

    broadcaster(overrides?: CallOverrides): Promise<string>

    callBridgeRequest(
        _amount: BigNumberish,
        _token: string,
        _tonAddress: TonBridge.TonAddressStruct,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    changeBridgeChainId(
        _newBridgeChainId: BigNumberish,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    changeBroadcaster(
        _newBroadcaster: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    changeSymbiosisBridge(
        _newSymbiosisBridge: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    changeTonBridge(
        _newTonBridge: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    initialize(
        _tonBridge: string,
        _symbiosisBridge: string,
        _bridgeChainId: BigNumberish,
        _broadcaster: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    owner(overrides?: CallOverrides): Promise<string>

    renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>

    symbiosisBridge(overrides?: CallOverrides): Promise<string>

    tonBridge(overrides?: CallOverrides): Promise<string>

    transferOwnership(
        newOwner: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    callStatic: {
        bridgeChainId(overrides?: CallOverrides): Promise<BigNumber>

        broadcaster(overrides?: CallOverrides): Promise<string>

        callBridgeRequest(
            _amount: BigNumberish,
            _token: string,
            _tonAddress: TonBridge.TonAddressStruct,
            overrides?: CallOverrides
        ): Promise<void>

        changeBridgeChainId(_newBridgeChainId: BigNumberish, overrides?: CallOverrides): Promise<void>

        changeBroadcaster(_newBroadcaster: string, overrides?: CallOverrides): Promise<void>

        changeSymbiosisBridge(_newSymbiosisBridge: string, overrides?: CallOverrides): Promise<void>

        changeTonBridge(_newTonBridge: string, overrides?: CallOverrides): Promise<void>

        initialize(
            _tonBridge: string,
            _symbiosisBridge: string,
            _bridgeChainId: BigNumberish,
            _broadcaster: string,
            overrides?: CallOverrides
        ): Promise<void>

        owner(overrides?: CallOverrides): Promise<string>

        renounceOwnership(overrides?: CallOverrides): Promise<void>

        symbiosisBridge(overrides?: CallOverrides): Promise<string>

        tonBridge(overrides?: CallOverrides): Promise<string>

        transferOwnership(newOwner: string, overrides?: CallOverrides): Promise<void>
    }

    filters: {
        'ChangeBridgeChainId(uint256)'(newBridgeChainId?: null): ChangeBridgeChainIdEventFilter
        ChangeBridgeChainId(newBridgeChainId?: null): ChangeBridgeChainIdEventFilter

        'ChangeBroadcaster(address)'(newBroadcaster?: null): ChangeBroadcasterEventFilter
        ChangeBroadcaster(newBroadcaster?: null): ChangeBroadcasterEventFilter

        'ChangeSymbiosisBridge(address)'(newBridge?: null): ChangeSymbiosisBridgeEventFilter
        ChangeSymbiosisBridge(newBridge?: null): ChangeSymbiosisBridgeEventFilter

        'ChangeTonBridge(address)'(newBridge?: null): ChangeTonBridgeEventFilter
        ChangeTonBridge(newBridge?: null): ChangeTonBridgeEventFilter

        'OwnershipTransferred(address,address)'(
            previousOwner?: string | null,
            newOwner?: string | null
        ): OwnershipTransferredEventFilter
        OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): OwnershipTransferredEventFilter
    }

    estimateGas: {
        bridgeChainId(overrides?: CallOverrides): Promise<BigNumber>

        broadcaster(overrides?: CallOverrides): Promise<BigNumber>

        callBridgeRequest(
            _amount: BigNumberish,
            _token: string,
            _tonAddress: TonBridge.TonAddressStruct,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        changeBridgeChainId(
            _newBridgeChainId: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        changeBroadcaster(
            _newBroadcaster: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        changeSymbiosisBridge(
            _newSymbiosisBridge: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        changeTonBridge(
            _newTonBridge: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        initialize(
            _tonBridge: string,
            _symbiosisBridge: string,
            _bridgeChainId: BigNumberish,
            _broadcaster: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        owner(overrides?: CallOverrides): Promise<BigNumber>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<BigNumber>

        symbiosisBridge(overrides?: CallOverrides): Promise<BigNumber>

        tonBridge(overrides?: CallOverrides): Promise<BigNumber>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>
    }

    populateTransaction: {
        bridgeChainId(overrides?: CallOverrides): Promise<PopulatedTransaction>

        broadcaster(overrides?: CallOverrides): Promise<PopulatedTransaction>

        callBridgeRequest(
            _amount: BigNumberish,
            _token: string,
            _tonAddress: TonBridge.TonAddressStruct,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        changeBridgeChainId(
            _newBridgeChainId: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        changeBroadcaster(
            _newBroadcaster: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        changeSymbiosisBridge(
            _newSymbiosisBridge: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        changeTonBridge(
            _newTonBridge: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        initialize(
            _tonBridge: string,
            _symbiosisBridge: string,
            _bridgeChainId: BigNumberish,
            _broadcaster: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        owner(overrides?: CallOverrides): Promise<PopulatedTransaction>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<PopulatedTransaction>

        symbiosisBridge(overrides?: CallOverrides): Promise<PopulatedTransaction>

        tonBridge(overrides?: CallOverrides): Promise<PopulatedTransaction>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>
    }
}
