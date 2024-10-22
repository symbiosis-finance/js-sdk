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

export declare namespace TonUtils {
    export type TonAddressStruct = {
        workchain: BigNumberish
        address_hash: BytesLike
    }

    export type TonAddressStructOutput = [number, string] & {
        workchain: number
        address_hash: string
    }

    export type SignatureStruct = { signer: string; signature: BytesLike }

    export type SignatureStructOutput = [string, string] & {
        signer: string
        signature: string
    }

    export type TonTxIDStruct = {
        address_: TonUtils.TonAddressStruct
        tx_hash: BytesLike
        lt: BigNumberish
    }

    export type TonTxIDStructOutput = [TonUtils.TonAddressStructOutput, string, BigNumber] & {
        address_: TonUtils.TonAddressStructOutput
        tx_hash: string
        lt: BigNumber
    }

    export type SwapDataStruct = {
        receiver: string
        amount: BigNumberish
        tx: TonUtils.TonTxIDStruct
    }

    export type SwapDataStructOutput = [string, BigNumber, TonUtils.TonTxIDStructOutput] & {
        receiver: string
        amount: BigNumber
        tx: TonUtils.TonTxIDStructOutput
    }
}

export interface WTONInterface extends utils.Interface {
    contractName: 'WTON'
    functions: {
        'allowBurn()': FunctionFragment
        'allowance(address,address)': FunctionFragment
        'approve(address,uint256)': FunctionFragment
        'balanceOf(address)': FunctionFragment
        'burn(uint256,(int8,bytes32))': FunctionFragment
        'burnFrom(address,uint256,(int8,bytes32))': FunctionFragment
        'checkSignature(bytes32,(address,bytes))': FunctionFragment
        'decimals()': FunctionFragment
        'decreaseAllowance(address,uint256)': FunctionFragment
        'finishedVotings(bytes32)': FunctionFragment
        'getFullOracleSet()': FunctionFragment
        'getNewBurnStatusId(bool,int256)': FunctionFragment
        'getNewSetId(int256,address[])': FunctionFragment
        'getSwapDataId((address,uint64,((int8,bytes32),bytes32,uint64)))': FunctionFragment
        'increaseAllowance(address,uint256)': FunctionFragment
        'isOracle(address)': FunctionFragment
        'name()': FunctionFragment
        'oraclesSet(uint256)': FunctionFragment
        'symbol()': FunctionFragment
        'totalSupply()': FunctionFragment
        'transfer(address,uint256)': FunctionFragment
        'transferFrom(address,address,uint256)': FunctionFragment
        'voteForMinting((address,uint64,((int8,bytes32),bytes32,uint64)),(address,bytes)[])': FunctionFragment
        'voteForNewOracleSet(int256,address[],(address,bytes)[])': FunctionFragment
        'voteForSwitchBurn(bool,int256,(address,bytes)[])': FunctionFragment
    }

    encodeFunctionData(functionFragment: 'allowBurn', values?: undefined): string
    encodeFunctionData(functionFragment: 'allowance', values: [string, string]): string
    encodeFunctionData(functionFragment: 'approve', values: [string, BigNumberish]): string
    encodeFunctionData(functionFragment: 'balanceOf', values: [string]): string
    encodeFunctionData(functionFragment: 'burn', values: [BigNumberish, TonUtils.TonAddressStruct]): string
    encodeFunctionData(functionFragment: 'burnFrom', values: [string, BigNumberish, TonUtils.TonAddressStruct]): string
    encodeFunctionData(functionFragment: 'checkSignature', values: [BytesLike, TonUtils.SignatureStruct]): string
    encodeFunctionData(functionFragment: 'decimals', values?: undefined): string
    encodeFunctionData(functionFragment: 'decreaseAllowance', values: [string, BigNumberish]): string
    encodeFunctionData(functionFragment: 'finishedVotings', values: [BytesLike]): string
    encodeFunctionData(functionFragment: 'getFullOracleSet', values?: undefined): string
    encodeFunctionData(functionFragment: 'getNewBurnStatusId', values: [boolean, BigNumberish]): string
    encodeFunctionData(functionFragment: 'getNewSetId', values: [BigNumberish, string[]]): string
    encodeFunctionData(functionFragment: 'getSwapDataId', values: [TonUtils.SwapDataStruct]): string
    encodeFunctionData(functionFragment: 'increaseAllowance', values: [string, BigNumberish]): string
    encodeFunctionData(functionFragment: 'isOracle', values: [string]): string
    encodeFunctionData(functionFragment: 'name', values?: undefined): string
    encodeFunctionData(functionFragment: 'oraclesSet', values: [BigNumberish]): string
    encodeFunctionData(functionFragment: 'symbol', values?: undefined): string
    encodeFunctionData(functionFragment: 'totalSupply', values?: undefined): string
    encodeFunctionData(functionFragment: 'transfer', values: [string, BigNumberish]): string
    encodeFunctionData(functionFragment: 'transferFrom', values: [string, string, BigNumberish]): string
    encodeFunctionData(
        functionFragment: 'voteForMinting',
        values: [TonUtils.SwapDataStruct, TonUtils.SignatureStruct[]]
    ): string
    encodeFunctionData(
        functionFragment: 'voteForNewOracleSet',
        values: [BigNumberish, string[], TonUtils.SignatureStruct[]]
    ): string
    encodeFunctionData(
        functionFragment: 'voteForSwitchBurn',
        values: [boolean, BigNumberish, TonUtils.SignatureStruct[]]
    ): string

    decodeFunctionResult(functionFragment: 'allowBurn', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'allowance', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'approve', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'balanceOf', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'burn', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'burnFrom', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'checkSignature', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'decimals', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'decreaseAllowance', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'finishedVotings', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getFullOracleSet', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getNewBurnStatusId', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getNewSetId', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'getSwapDataId', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'increaseAllowance', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'isOracle', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'name', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'oraclesSet', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'symbol', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'totalSupply', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'transfer', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'transferFrom', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'voteForMinting', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'voteForNewOracleSet', data: BytesLike): Result
    decodeFunctionResult(functionFragment: 'voteForSwitchBurn', data: BytesLike): Result

    events: {
        'Approval(address,address,uint256)': EventFragment
        'NewOracleSet(int256,address[])': EventFragment
        'SwapEthToTon(address,int8,bytes32,uint256)': EventFragment
        'SwapTonToEth(int8,bytes32,bytes32,uint64,address,uint256)': EventFragment
        'Transfer(address,address,uint256)': EventFragment
    }

    getEvent(nameOrSignatureOrTopic: 'Approval'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'NewOracleSet'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'SwapEthToTon'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'SwapTonToEth'): EventFragment
    getEvent(nameOrSignatureOrTopic: 'Transfer'): EventFragment
}

export type ApprovalEvent = TypedEvent<
    [string, string, BigNumber],
    { owner: string; spender: string; value: BigNumber }
>

export type ApprovalEventFilter = TypedEventFilter<ApprovalEvent>

export type NewOracleSetEvent = TypedEvent<[BigNumber, string[]], { oracleSetHash: BigNumber; newOracles: string[] }>

export type NewOracleSetEventFilter = TypedEventFilter<NewOracleSetEvent>

export type SwapEthToTonEvent = TypedEvent<
    [string, number, string, BigNumber],
    { from: string; to_wc: number; to_addr_hash: string; value: BigNumber }
>

export type SwapEthToTonEventFilter = TypedEventFilter<SwapEthToTonEvent>

export type SwapTonToEthEvent = TypedEvent<
    [number, string, string, BigNumber, string, BigNumber],
    {
        workchain: number
        ton_address_hash: string
        ton_tx_hash: string
        lt: BigNumber
        to: string
        value: BigNumber
    }
>

export type SwapTonToEthEventFilter = TypedEventFilter<SwapTonToEthEvent>

export type TransferEvent = TypedEvent<[string, string, BigNumber], { from: string; to: string; value: BigNumber }>

export type TransferEventFilter = TypedEventFilter<TransferEvent>

export interface WTON extends BaseContract {
    contractName: 'WTON'
    connect(signerOrProvider: Signer | Provider | string): this
    attach(addressOrName: string): this
    deployed(): Promise<this>

    interface: WTONInterface

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
        allowBurn(overrides?: CallOverrides): Promise<[boolean]>

        allowance(owner: string, spender: string, overrides?: CallOverrides): Promise<[BigNumber]>

        approve(
            spender: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        balanceOf(account: string, overrides?: CallOverrides): Promise<[BigNumber]>

        burn(
            amount: BigNumberish,
            addr: TonUtils.TonAddressStruct,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        burnFrom(
            account: string,
            amount: BigNumberish,
            addr: TonUtils.TonAddressStruct,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        checkSignature(digest: BytesLike, sig: TonUtils.SignatureStruct, overrides?: CallOverrides): Promise<[void]>

        decimals(overrides?: CallOverrides): Promise<[number]>

        decreaseAllowance(
            spender: string,
            subtractedValue: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        finishedVotings(arg0: BytesLike, overrides?: CallOverrides): Promise<[boolean]>

        getFullOracleSet(overrides?: CallOverrides): Promise<[string[]]>

        getNewBurnStatusId(
            newBurnStatus: boolean,
            nonce: BigNumberish,
            overrides?: CallOverrides
        ): Promise<[string] & { result: string }>

        getNewSetId(
            oracleSetHash: BigNumberish,
            set: string[],
            overrides?: CallOverrides
        ): Promise<[string] & { result: string }>

        getSwapDataId(data: TonUtils.SwapDataStruct, overrides?: CallOverrides): Promise<[string] & { result: string }>

        increaseAllowance(
            spender: string,
            addedValue: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        isOracle(arg0: string, overrides?: CallOverrides): Promise<[boolean]>

        name(overrides?: CallOverrides): Promise<[string]>

        oraclesSet(arg0: BigNumberish, overrides?: CallOverrides): Promise<[string]>

        symbol(overrides?: CallOverrides): Promise<[string]>

        totalSupply(overrides?: CallOverrides): Promise<[BigNumber]>

        transfer(
            recipient: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        transferFrom(
            sender: string,
            recipient: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        voteForMinting(
            data: TonUtils.SwapDataStruct,
            signatures: TonUtils.SignatureStruct[],
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        voteForNewOracleSet(
            oracleSetHash: BigNumberish,
            newOracles: string[],
            signatures: TonUtils.SignatureStruct[],
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>

        voteForSwitchBurn(
            newBurnStatus: boolean,
            nonce: BigNumberish,
            signatures: TonUtils.SignatureStruct[],
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<ContractTransaction>
    }

    allowBurn(overrides?: CallOverrides): Promise<boolean>

    allowance(owner: string, spender: string, overrides?: CallOverrides): Promise<BigNumber>

    approve(
        spender: string,
        amount: BigNumberish,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    balanceOf(account: string, overrides?: CallOverrides): Promise<BigNumber>

    burn(
        amount: BigNumberish,
        addr: TonUtils.TonAddressStruct,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    burnFrom(
        account: string,
        amount: BigNumberish,
        addr: TonUtils.TonAddressStruct,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    checkSignature(digest: BytesLike, sig: TonUtils.SignatureStruct, overrides?: CallOverrides): Promise<void>

    decimals(overrides?: CallOverrides): Promise<number>

    decreaseAllowance(
        spender: string,
        subtractedValue: BigNumberish,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    finishedVotings(arg0: BytesLike, overrides?: CallOverrides): Promise<boolean>

    getFullOracleSet(overrides?: CallOverrides): Promise<string[]>

    getNewBurnStatusId(newBurnStatus: boolean, nonce: BigNumberish, overrides?: CallOverrides): Promise<string>

    getNewSetId(oracleSetHash: BigNumberish, set: string[], overrides?: CallOverrides): Promise<string>

    getSwapDataId(data: TonUtils.SwapDataStruct, overrides?: CallOverrides): Promise<string>

    increaseAllowance(
        spender: string,
        addedValue: BigNumberish,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    isOracle(arg0: string, overrides?: CallOverrides): Promise<boolean>

    name(overrides?: CallOverrides): Promise<string>

    oraclesSet(arg0: BigNumberish, overrides?: CallOverrides): Promise<string>

    symbol(overrides?: CallOverrides): Promise<string>

    totalSupply(overrides?: CallOverrides): Promise<BigNumber>

    transfer(
        recipient: string,
        amount: BigNumberish,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    transferFrom(
        sender: string,
        recipient: string,
        amount: BigNumberish,
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    voteForMinting(
        data: TonUtils.SwapDataStruct,
        signatures: TonUtils.SignatureStruct[],
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    voteForNewOracleSet(
        oracleSetHash: BigNumberish,
        newOracles: string[],
        signatures: TonUtils.SignatureStruct[],
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    voteForSwitchBurn(
        newBurnStatus: boolean,
        nonce: BigNumberish,
        signatures: TonUtils.SignatureStruct[],
        overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>

    callStatic: {
        allowBurn(overrides?: CallOverrides): Promise<boolean>

        allowance(owner: string, spender: string, overrides?: CallOverrides): Promise<BigNumber>

        approve(spender: string, amount: BigNumberish, overrides?: CallOverrides): Promise<boolean>

        balanceOf(account: string, overrides?: CallOverrides): Promise<BigNumber>

        burn(amount: BigNumberish, addr: TonUtils.TonAddressStruct, overrides?: CallOverrides): Promise<void>

        burnFrom(
            account: string,
            amount: BigNumberish,
            addr: TonUtils.TonAddressStruct,
            overrides?: CallOverrides
        ): Promise<void>

        checkSignature(digest: BytesLike, sig: TonUtils.SignatureStruct, overrides?: CallOverrides): Promise<void>

        decimals(overrides?: CallOverrides): Promise<number>

        decreaseAllowance(spender: string, subtractedValue: BigNumberish, overrides?: CallOverrides): Promise<boolean>

        finishedVotings(arg0: BytesLike, overrides?: CallOverrides): Promise<boolean>

        getFullOracleSet(overrides?: CallOverrides): Promise<string[]>

        getNewBurnStatusId(newBurnStatus: boolean, nonce: BigNumberish, overrides?: CallOverrides): Promise<string>

        getNewSetId(oracleSetHash: BigNumberish, set: string[], overrides?: CallOverrides): Promise<string>

        getSwapDataId(data: TonUtils.SwapDataStruct, overrides?: CallOverrides): Promise<string>

        increaseAllowance(spender: string, addedValue: BigNumberish, overrides?: CallOverrides): Promise<boolean>

        isOracle(arg0: string, overrides?: CallOverrides): Promise<boolean>

        name(overrides?: CallOverrides): Promise<string>

        oraclesSet(arg0: BigNumberish, overrides?: CallOverrides): Promise<string>

        symbol(overrides?: CallOverrides): Promise<string>

        totalSupply(overrides?: CallOverrides): Promise<BigNumber>

        transfer(recipient: string, amount: BigNumberish, overrides?: CallOverrides): Promise<boolean>

        transferFrom(
            sender: string,
            recipient: string,
            amount: BigNumberish,
            overrides?: CallOverrides
        ): Promise<boolean>

        voteForMinting(
            data: TonUtils.SwapDataStruct,
            signatures: TonUtils.SignatureStruct[],
            overrides?: CallOverrides
        ): Promise<void>

        voteForNewOracleSet(
            oracleSetHash: BigNumberish,
            newOracles: string[],
            signatures: TonUtils.SignatureStruct[],
            overrides?: CallOverrides
        ): Promise<void>

        voteForSwitchBurn(
            newBurnStatus: boolean,
            nonce: BigNumberish,
            signatures: TonUtils.SignatureStruct[],
            overrides?: CallOverrides
        ): Promise<void>
    }

    filters: {
        'Approval(address,address,uint256)'(
            owner?: string | null,
            spender?: string | null,
            value?: null
        ): ApprovalEventFilter
        Approval(owner?: string | null, spender?: string | null, value?: null): ApprovalEventFilter

        'NewOracleSet(int256,address[])'(oracleSetHash?: null, newOracles?: null): NewOracleSetEventFilter
        NewOracleSet(oracleSetHash?: null, newOracles?: null): NewOracleSetEventFilter

        'SwapEthToTon(address,int8,bytes32,uint256)'(
            from?: string | null,
            to_wc?: null,
            to_addr_hash?: BytesLike | null,
            value?: null
        ): SwapEthToTonEventFilter
        SwapEthToTon(
            from?: string | null,
            to_wc?: null,
            to_addr_hash?: BytesLike | null,
            value?: null
        ): SwapEthToTonEventFilter

        'SwapTonToEth(int8,bytes32,bytes32,uint64,address,uint256)'(
            workchain?: null,
            ton_address_hash?: BytesLike | null,
            ton_tx_hash?: BytesLike | null,
            lt?: null,
            to?: string | null,
            value?: null
        ): SwapTonToEthEventFilter
        SwapTonToEth(
            workchain?: null,
            ton_address_hash?: BytesLike | null,
            ton_tx_hash?: BytesLike | null,
            lt?: null,
            to?: string | null,
            value?: null
        ): SwapTonToEthEventFilter

        'Transfer(address,address,uint256)'(from?: string | null, to?: string | null, value?: null): TransferEventFilter
        Transfer(from?: string | null, to?: string | null, value?: null): TransferEventFilter
    }

    estimateGas: {
        allowBurn(overrides?: CallOverrides): Promise<BigNumber>

        allowance(owner: string, spender: string, overrides?: CallOverrides): Promise<BigNumber>

        approve(
            spender: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        balanceOf(account: string, overrides?: CallOverrides): Promise<BigNumber>

        burn(
            amount: BigNumberish,
            addr: TonUtils.TonAddressStruct,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        burnFrom(
            account: string,
            amount: BigNumberish,
            addr: TonUtils.TonAddressStruct,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        checkSignature(digest: BytesLike, sig: TonUtils.SignatureStruct, overrides?: CallOverrides): Promise<BigNumber>

        decimals(overrides?: CallOverrides): Promise<BigNumber>

        decreaseAllowance(
            spender: string,
            subtractedValue: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        finishedVotings(arg0: BytesLike, overrides?: CallOverrides): Promise<BigNumber>

        getFullOracleSet(overrides?: CallOverrides): Promise<BigNumber>

        getNewBurnStatusId(newBurnStatus: boolean, nonce: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>

        getNewSetId(oracleSetHash: BigNumberish, set: string[], overrides?: CallOverrides): Promise<BigNumber>

        getSwapDataId(data: TonUtils.SwapDataStruct, overrides?: CallOverrides): Promise<BigNumber>

        increaseAllowance(
            spender: string,
            addedValue: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        isOracle(arg0: string, overrides?: CallOverrides): Promise<BigNumber>

        name(overrides?: CallOverrides): Promise<BigNumber>

        oraclesSet(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>

        symbol(overrides?: CallOverrides): Promise<BigNumber>

        totalSupply(overrides?: CallOverrides): Promise<BigNumber>

        transfer(
            recipient: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        transferFrom(
            sender: string,
            recipient: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        voteForMinting(
            data: TonUtils.SwapDataStruct,
            signatures: TonUtils.SignatureStruct[],
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        voteForNewOracleSet(
            oracleSetHash: BigNumberish,
            newOracles: string[],
            signatures: TonUtils.SignatureStruct[],
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>

        voteForSwitchBurn(
            newBurnStatus: boolean,
            nonce: BigNumberish,
            signatures: TonUtils.SignatureStruct[],
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<BigNumber>
    }

    populateTransaction: {
        allowBurn(overrides?: CallOverrides): Promise<PopulatedTransaction>

        allowance(owner: string, spender: string, overrides?: CallOverrides): Promise<PopulatedTransaction>

        approve(
            spender: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        balanceOf(account: string, overrides?: CallOverrides): Promise<PopulatedTransaction>

        burn(
            amount: BigNumberish,
            addr: TonUtils.TonAddressStruct,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        burnFrom(
            account: string,
            amount: BigNumberish,
            addr: TonUtils.TonAddressStruct,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        checkSignature(
            digest: BytesLike,
            sig: TonUtils.SignatureStruct,
            overrides?: CallOverrides
        ): Promise<PopulatedTransaction>

        decimals(overrides?: CallOverrides): Promise<PopulatedTransaction>

        decreaseAllowance(
            spender: string,
            subtractedValue: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        finishedVotings(arg0: BytesLike, overrides?: CallOverrides): Promise<PopulatedTransaction>

        getFullOracleSet(overrides?: CallOverrides): Promise<PopulatedTransaction>

        getNewBurnStatusId(
            newBurnStatus: boolean,
            nonce: BigNumberish,
            overrides?: CallOverrides
        ): Promise<PopulatedTransaction>

        getNewSetId(
            oracleSetHash: BigNumberish,
            set: string[],
            overrides?: CallOverrides
        ): Promise<PopulatedTransaction>

        getSwapDataId(data: TonUtils.SwapDataStruct, overrides?: CallOverrides): Promise<PopulatedTransaction>

        increaseAllowance(
            spender: string,
            addedValue: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        isOracle(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>

        name(overrides?: CallOverrides): Promise<PopulatedTransaction>

        oraclesSet(arg0: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>

        symbol(overrides?: CallOverrides): Promise<PopulatedTransaction>

        totalSupply(overrides?: CallOverrides): Promise<PopulatedTransaction>

        transfer(
            recipient: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        transferFrom(
            sender: string,
            recipient: string,
            amount: BigNumberish,
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        voteForMinting(
            data: TonUtils.SwapDataStruct,
            signatures: TonUtils.SignatureStruct[],
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        voteForNewOracleSet(
            oracleSetHash: BigNumberish,
            newOracles: string[],
            signatures: TonUtils.SignatureStruct[],
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>

        voteForSwitchBurn(
            newBurnStatus: boolean,
            nonce: BigNumberish,
            signatures: TonUtils.SignatureStruct[],
            overrides?: Overrides & { from?: string | Promise<string> }
        ): Promise<PopulatedTransaction>
    }
}
