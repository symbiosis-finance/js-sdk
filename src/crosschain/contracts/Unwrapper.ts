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

export interface UnwrapperInterface extends utils.Interface {
    contractName: 'Unwrapper'
    functions: {
        'owner()': FunctionFragment
        'renounceOwnership()': FunctionFragment
        'setWrapper(address)': FunctionFragment
        'transferOwnership(address)': FunctionFragment
        'unwrap(uint256,address)': FunctionFragment
        'wrapper()': FunctionFragment
    }

    encodeFunctionData(functionFragment: 'owner', values?: undefined): string
    encodeFunctionData(functionFragment: 'renounceOwnership', values?: undefined): string
    encodeFunctionData(functionFragment: 'setWrapper', values: [string]): string
    encodeFunctionData(functionFragment: 'transferOwnership', values: [string]): string
    encodeFunctionData(functionFragment: 'unwrap', values: [BigNumberish, string]): string
    encodeFunctionData(functionFragment: 'wrapper', values?: undefined): string

    decodeFunctionResult(functionFragment: 'owner', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'renounceOwnership', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'setWrapper', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'transferOwnership', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'unwrap', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'wrapper', data: BytesLike): Result

    events: {
        'OwnershipTransferred(address,address)': EventFragment
    }

    getEvent(nameOrSignatureOrTopic: 'OwnershipTransferred'): EventFragment
}

export type OwnershipTransferredEvent = TypedEvent<[string, string], { previousOwner: string; newOwner: string }>

export type OwnershipTransferredEventFilter = TypedEventFilter<OwnershipTransferredEvent>

export interface Unwrapper extends BaseContract {
    contractName: 'Unwrapper'
    connect(signerOrProvider: Signer | Provider | string): this
    attach(addressOrName: string): this
    deployed(): Promise<this>

    interface: UnwrapperInterface

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
        owner(overrides?: CallOverrides): Promise<[string]>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>

        setWrapper(
            _newWrapper: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        unwrap(
            _amountIn: BigNumberish,
            _to: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        wrapper(overrides?: CallOverrides): Promise<[string]>
    }

    owner(overrides?: CallOverrides): Promise<string>

    renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>

    setWrapper(
        _newWrapper: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    transferOwnership(
        newOwner: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    unwrap(
        _amountIn: BigNumberish,
        _to: string,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    wrapper(overrides?: CallOverrides): Promise<string>

    callStatic: {
        owner(overrides?: CallOverrides): Promise<string>

        renounceOwnership(overrides?: CallOverrides): Promise<void>

        setWrapper(_newWrapper: string, overrides?: CallOverrides): Promise<void>

        transferOwnership(newOwner: string, overrides?: CallOverrides): Promise<void>

        unwrap(_amountIn: BigNumberish, _to: string, overrides?: CallOverrides): Promise<void>

        wrapper(overrides?: CallOverrides): Promise<string>
    }

    filters: {
        'OwnershipTransferred(address,address)'(
            previousOwner?: string | null,
            newOwner?: string | null
        ): OwnershipTransferredEventFilter
        OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): OwnershipTransferredEventFilter
    }

    estimateGas: {
        owner(overrides?: CallOverrides): Promise<BigNumber>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<BigNumber>

        setWrapper(_newWrapper: string, overrides?: Overrides & { from?: string | Promise<string> }): Promise<BigNumber>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        unwrap(
            _amountIn: BigNumberish,
            _to: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        wrapper(overrides?: CallOverrides): Promise<BigNumber>
    }

    populateTransaction: {
        owner(overrides?: CallOverrides): Promise<PopulatedTransaction>

        renounceOwnership(overrides?: Overrides & { from?: string | Promise<string> }): Promise<PopulatedTransaction>

        setWrapper(
            _newWrapper: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        transferOwnership(
            newOwner: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        unwrap(
            _amountIn: BigNumberish,
            _to: string,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        wrapper(overrides?: CallOverrides): Promise<PopulatedTransaction>
    }
}
