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

export interface BridgeInterface extends utils.Interface {
    contractName: 'Bridge'
    functions: {
        'changeMPC(address)': FunctionFragment
        'changeMPCSigned(address,bytes)': FunctionFragment
        'currentChainId()': FunctionFragment
        'initialize(address)': FunctionFragment
        'isAdmin(address)': FunctionFragment
        'isTransmitter(address)': FunctionFragment
        'mpc()': FunctionFragment
        'newMPC()': FunctionFragment
        'newMPCEffectiveTime()': FunctionFragment
        'oldMPC()': FunctionFragment
        'owner()': FunctionFragment
        'receiveRequestV2(bytes,address)': FunctionFragment
        'receiveRequestV2Signed(bytes,address,bytes)': FunctionFragment
        'renounceOwnership()': FunctionFragment
        'setAdminPermission(address,bool)': FunctionFragment
        'setTransmitterStatus(address,bool)': FunctionFragment
        'transferOwnership(address)': FunctionFragment
        'transmitRequestV2(bytes,address,address,uint256)': FunctionFragment
        'withdrawFee(address,address,uint256)': FunctionFragment
    }

    encodeFunctionData(functionFragment: 'changeMPC', values: [string]): string
    encodeFunctionData(functionFragment: 'changeMPCSigned', values: [string, BytesLike]): string
    encodeFunctionData(functionFragment: 'currentChainId', values?: undefined): string
    encodeFunctionData(functionFragment: 'initialize', values: [string]): string
    encodeFunctionData(functionFragment: 'isAdmin', values: [string]): string
    encodeFunctionData(functionFragment: 'isTransmitter', values: [string]): string
    encodeFunctionData(functionFragment: 'mpc', values?: undefined): string
    encodeFunctionData(functionFragment: 'newMPC', values?: undefined): string
    encodeFunctionData(functionFragment: 'newMPCEffectiveTime', values?: undefined): string
    encodeFunctionData(functionFragment: 'oldMPC', values?: undefined): string
    encodeFunctionData(functionFragment: 'owner', values?: undefined): string
    encodeFunctionData(functionFragment: 'receiveRequestV2', values: [BytesLike, string]): string
    encodeFunctionData(functionFragment: 'receiveRequestV2Signed', values: [BytesLike, string, BytesLike]): string
    encodeFunctionData(functionFragment: 'renounceOwnership', values?: undefined): string
    encodeFunctionData(functionFragment: 'setAdminPermission', values: [string, boolean]): string
    encodeFunctionData(functionFragment: 'setTransmitterStatus', values: [string, boolean]): string
    encodeFunctionData(functionFragment: 'transferOwnership', values: [string]): string
    encodeFunctionData(functionFragment: 'transmitRequestV2', values: [BytesLike, string, string, BigNumberish]): string
    encodeFunctionData(functionFragment: 'withdrawFee', values: [string, string, BigNumberish]): string

    decodeFunctionResult(functionFragment: 'changeMPC', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'changeMPCSigned', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'currentChainId', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'initialize', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'isAdmin', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'isTransmitter', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'mpc', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'newMPC', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'newMPCEffectiveTime', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'oldMPC', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'owner', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'receiveRequestV2', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'receiveRequestV2Signed', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'renounceOwnership', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'setAdminPermission', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'setTransmitterStatus', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'transferOwnership', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'transmitRequestV2', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'withdrawFee', data: BytesLike): Result

    events: {
        'LogChangeMPC(address,address,uint256,uint256)': EventFragment
        'OracleRequest(address,bytes,address,address,uint256)': EventFragment
        'OwnershipTransferred(address,address)': EventFragment
        'SetAdminPermission(address,bool)': EventFragment
        'SetTransmitterStatus(address,bool)': EventFragment
    }

    getEvent(nameOrSignatureOrTopic: 'LogChangeMPC'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'OracleRequest'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'OwnershipTransferred'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'SetAdminPermission'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'SetTransmitterStatus'): EventFragment
}

export type LogChangeMPCEvent = TypedEvent<
    [string, string, BigNumber, BigNumber],
    {
        oldMPC: string
        newMPC: string
        effectiveTime: BigNumber
        chainId: BigNumber
    }
>

export type LogChangeMPCEventFilter = TypedEventFilter<LogChangeMPCEvent>

export type OracleRequestEvent = TypedEvent<
    [string, string, string, string, BigNumber],
    {
        bridge: string
        callData: string
        receiveSide: string
        oppositeBridge: string
        chainId: BigNumber
    }
>

export type OracleRequestEventFilter = TypedEventFilter<OracleRequestEvent>

export type OwnershipTransferredEvent = TypedEvent<[string, string], { previousOwner: string; newOwner: string }>

export type OwnershipTransferredEventFilter = TypedEventFilter<OwnershipTransferredEvent>

export type SetAdminPermissionEvent = TypedEvent<[string, boolean], { admin: string; permission: boolean }>

export type SetAdminPermissionEventFilter = TypedEventFilter<SetAdminPermissionEvent>

export type SetTransmitterStatusEvent = TypedEvent<[string, boolean], { transmitter: string; status: boolean }>

export type SetTransmitterStatusEventFilter = TypedEventFilter<SetTransmitterStatusEvent>

export interface Bridge extends BaseContract {
    contractName: 'Bridge'
    connect(signerOrProvider: Signer | Provider | string): this
    attach(addressOrName: string): this
    deployed(): Promise<this>

    interface: BridgeInterface

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
        changeMPC(
            _newMPC: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        changeMPCSigned(
            _newMPC: string,
            signature: BytesLike,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        currentChainId(overrides?: CallOverrides): Promise<[BigNumber]>

        initialize(
            _mpc: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        isAdmin(arg0: string, overrides?: CallOverrides): Promise<[boolean]>

        isTransmitter(arg0: string, overrides?: CallOverrides): Promise<[boolean]>

        mpc(overrides?: CallOverrides): Promise<[string]>

        newMPC(overrides?: CallOverrides): Promise<[string]>

        newMPCEffectiveTime(overrides?: CallOverrides): Promise<[BigNumber]>

        oldMPC(overrides?: CallOverrides): Promise<[string]>

        owner(overrides?: CallOverrides): Promise<[string]>

        receiveRequestV2(
            _callData: BytesLike,
            _receiveSide: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        receiveRequestV2Signed(
            _callData: BytesLike,
            _receiveSide: string,
            signature: BytesLike,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>

        setAdminPermission(
            _user: string,
            _permission: boolean,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        setTransmitterStatus(
            _transmitter: string,
            _status: boolean,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        transmitRequestV2(
            _callData: BytesLike,
            _receiveSide: string,
            _oppositeBridge: string,
            _chainId: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        withdrawFee(
            token: string,
            to: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>
    }

    changeMPC(
        _newMPC: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    changeMPCSigned(
        _newMPC: string,
        signature: BytesLike,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    currentChainId(overrides?: CallOverrides): Promise<BigNumber>

    initialize(_mpc: string, overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>

    isAdmin(arg0: string, overrides?: CallOverrides): Promise<boolean>

    isTransmitter(arg0: string, overrides?: CallOverrides): Promise<boolean>

    mpc(overrides?: CallOverrides): Promise<string>

    newMPC(overrides?: CallOverrides): Promise<string>

    newMPCEffectiveTime(overrides?: CallOverrides): Promise<BigNumber>

    oldMPC(overrides?: CallOverrides): Promise<string>

    owner(overrides?: CallOverrides): Promise<string>

    receiveRequestV2(
        _callData: BytesLike,
        _receiveSide: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    receiveRequestV2Signed(
        _callData: BytesLike,
        _receiveSide: string,
        signature: BytesLike,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>

    setAdminPermission(
        _user: string,
        _permission: boolean,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    setTransmitterStatus(
        _transmitter: string,
        _status: boolean,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    transferOwnership(
        newOwner: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    transmitRequestV2(
        _callData: BytesLike,
        _receiveSide: string,
        _oppositeBridge: string,
        _chainId: BigNumberish,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    withdrawFee(
        token: string,
        to: string,
        amount: BigNumberish,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    callStatic: {
        changeMPC(_newMPC: string, overrides?: CallOverrides): Promise<boolean>

        changeMPCSigned(_newMPC: string, signature: BytesLike, overrides?: CallOverrides): Promise<boolean>

        currentChainId(overrides?: CallOverrides): Promise<BigNumber>

        initialize(_mpc: string, overrides?: CallOverrides): Promise<void>

        isAdmin(arg0: string, overrides?: CallOverrides): Promise<boolean>

        isTransmitter(arg0: string, overrides?: CallOverrides): Promise<boolean>

        mpc(overrides?: CallOverrides): Promise<string>

        newMPC(overrides?: CallOverrides): Promise<string>

        newMPCEffectiveTime(overrides?: CallOverrides): Promise<BigNumber>

        oldMPC(overrides?: CallOverrides): Promise<string>

        owner(overrides?: CallOverrides): Promise<string>

        receiveRequestV2(_callData: BytesLike, _receiveSide: string, overrides?: CallOverrides): Promise<void>

        receiveRequestV2Signed(
            _callData: BytesLike,
            _receiveSide: string,
            signature: BytesLike,
            overrides?: CallOverrides
        ): Promise<void>

        renounceOwnership(overrides?: CallOverrides): Promise<void>

        setAdminPermission(_user: string, _permission: boolean, overrides?: CallOverrides): Promise<void>

        setTransmitterStatus(_transmitter: string, _status: boolean, overrides?: CallOverrides): Promise<void>

        transferOwnership(newOwner: string, overrides?: CallOverrides): Promise<void>

        transmitRequestV2(
            _callData: BytesLike,
            _receiveSide: string,
            _oppositeBridge: string,
            _chainId: BigNumberish,
            overrides?: CallOverrides
        ): Promise<void>

        withdrawFee(token: string, to: string, amount: BigNumberish, overrides?: CallOverrides): Promise<boolean>
    }

    filters: {
        'LogChangeMPC(address,address,uint256,uint256)'(
            oldMPC?: string | null,
            newMPC?: string | null,
            effectiveTime?: BigNumberish | null,
            chainId?: null
        ): LogChangeMPCEventFilter
        LogChangeMPC(
            oldMPC?: string | null,
            newMPC?: string | null,
            effectiveTime?: BigNumberish | null,
            chainId?: null
        ): LogChangeMPCEventFilter

        'OracleRequest(address,bytes,address,address,uint256)'(
            bridge?: null,
            callData?: null,
            receiveSide?: null,
            oppositeBridge?: null,
            chainId?: null
        ): OracleRequestEventFilter
        OracleRequest(
            bridge?: null,
            callData?: null,
            receiveSide?: null,
            oppositeBridge?: null,
            chainId?: null
        ): OracleRequestEventFilter

        'OwnershipTransferred(address,address)'(
            previousOwner?: string | null,
            newOwner?: string | null
        ): OwnershipTransferredEventFilter
        OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): OwnershipTransferredEventFilter

        'SetAdminPermission(address,bool)'(admin?: string | null, permission?: null): SetAdminPermissionEventFilter
        SetAdminPermission(admin?: string | null, permission?: null): SetAdminPermissionEventFilter

        'SetTransmitterStatus(address,bool)'(
            transmitter?: string | null,
            status?: null
        ): SetTransmitterStatusEventFilter
        SetTransmitterStatus(transmitter?: string | null, status?: null): SetTransmitterStatusEventFilter
    }

    estimateGas: {
        changeMPC(_newMPC: string, overrides?: Overrides & { from?: string | Promise<string> }): Promise<BigNumber>

        changeMPCSigned(
            _newMPC: string,
            signature: BytesLike,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        currentChainId(overrides?: CallOverrides): Promise<BigNumber>

        initialize(_mpc: string, overrides?: Overrides & { from?: string | Promise<string> }): Promise<BigNumber>

        isAdmin(arg0: string, overrides?: CallOverrides): Promise<BigNumber>

        isTransmitter(arg0: string, overrides?: CallOverrides): Promise<BigNumber>

        mpc(overrides?: CallOverrides): Promise<BigNumber>

        newMPC(overrides?: CallOverrides): Promise<BigNumber>

        newMPCEffectiveTime(overrides?: CallOverrides): Promise<BigNumber>

        oldMPC(overrides?: CallOverrides): Promise<BigNumber>

        owner(overrides?: CallOverrides): Promise<BigNumber>

        receiveRequestV2(
            _callData: BytesLike,
            _receiveSide: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        receiveRequestV2Signed(
            _callData: BytesLike,
            _receiveSide: string,
            signature: BytesLike,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<BigNumber>

        setAdminPermission(
            _user: string,
            _permission: boolean,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        setTransmitterStatus(
            _transmitter: string,
            _status: boolean,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        transmitRequestV2(
            _callData: BytesLike,
            _receiveSide: string,
            _oppositeBridge: string,
            _chainId: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        withdrawFee(
            token: string,
            to: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>
    }

    populateTransaction: {
        changeMPC(
            _newMPC: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        changeMPCSigned(
            _newMPC: string,
            signature: BytesLike,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        currentChainId(overrides?: CallOverrides): Promise<PopulatedTransaction>

        initialize(
            _mpc: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        isAdmin(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>

        isTransmitter(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>

        mpc(overrides?: CallOverrides): Promise<PopulatedTransaction>

        newMPC(overrides?: CallOverrides): Promise<PopulatedTransaction>

        newMPCEffectiveTime(overrides?: CallOverrides): Promise<PopulatedTransaction>

        oldMPC(overrides?: CallOverrides): Promise<PopulatedTransaction>

        owner(overrides?: CallOverrides): Promise<PopulatedTransaction>

        receiveRequestV2(
            _callData: BytesLike,
            _receiveSide: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        receiveRequestV2Signed(
            _callData: BytesLike,
            _receiveSide: string,
            signature: BytesLike,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<PopulatedTransaction>

        setAdminPermission(
            _user: string,
            _permission: boolean,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        setTransmitterStatus(
            _transmitter: string,
            _status: boolean,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        transmitRequestV2(
            _callData: BytesLike,
            _receiveSide: string,
            _oppositeBridge: string,
            _chainId: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        withdrawFee(
            token: string,
            to: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>
    }
}
