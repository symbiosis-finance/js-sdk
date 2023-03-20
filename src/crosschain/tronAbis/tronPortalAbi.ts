export const TRON_PORTAL_ABI = [
    {
        inputs: [
            {
                internalType: 'address',
                name: '_bridge',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_wrapper',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_whitelistedToken',
                type: 'address',
            },
            {
                internalType: 'contract IMetaRouter',
                name: '_metaRouter',
                type: 'address',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'constructor',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: 'bytes32',
                name: 'id',
                type: 'bytes32',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'to',
                type: 'address',
            },
            {
                indexed: false,
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
            },
            {
                indexed: false,
                internalType: 'uint256',
                name: 'bridgingFee',
                type: 'uint256',
            },
            {
                indexed: false,
                internalType: 'address',
                name: 'token',
                type: 'address',
            },
        ],
        name: 'BurnCompleted',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: 'bytes32',
                name: 'requestId',
                type: 'bytes32',
            },
            {
                indexed: true,
                internalType: 'bytes32',
                name: 'clientId',
                type: 'bytes32',
            },
        ],
        name: 'ClientIdLog',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: 'bytes32',
                name: 'id',
                type: 'bytes32',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'to',
                type: 'address',
            },
        ],
        name: 'MetaRevertRequest',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: 'address',
                name: 'previousOwner',
                type: 'address',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'newOwner',
                type: 'address',
            },
        ],
        name: 'OwnershipTransferred',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: 'address',
                name: 'account',
                type: 'address',
            },
        ],
        name: 'Paused',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: 'bytes32',
                name: 'id',
                type: 'bytes32',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'to',
                type: 'address',
            },
        ],
        name: 'RevertBurnRequest',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: 'bytes32',
                name: 'id',
                type: 'bytes32',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'to',
                type: 'address',
            },
            {
                indexed: false,
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
            },
            {
                indexed: false,
                internalType: 'uint256',
                name: 'bridgingFee',
                type: 'uint256',
            },
            {
                indexed: false,
                internalType: 'address',
                name: 'token',
                type: 'address',
            },
        ],
        name: 'RevertSynthesizeCompleted',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: 'address',
                name: 'metaRouter',
                type: 'address',
            },
        ],
        name: 'SetMetaRouter',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: 'address',
                name: 'token',
                type: 'address',
            },
            {
                indexed: false,
                internalType: 'uint256',
                name: 'threshold',
                type: 'uint256',
            },
        ],
        name: 'SetTokenThreshold',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: 'address',
                name: 'token',
                type: 'address',
            },
            {
                indexed: false,
                internalType: 'bool',
                name: 'activate',
                type: 'bool',
            },
        ],
        name: 'SetWhitelistToken',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: 'bytes32',
                name: 'id',
                type: 'bytes32',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'from',
                type: 'address',
            },
            {
                indexed: true,
                internalType: 'uint256',
                name: 'chainID',
                type: 'uint256',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'revertableAddress',
                type: 'address',
            },
            {
                indexed: false,
                internalType: 'address',
                name: 'to',
                type: 'address',
            },
            {
                indexed: false,
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
            },
            {
                indexed: false,
                internalType: 'address',
                name: 'token',
                type: 'address',
            },
        ],
        name: 'SynthesizeRequest',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: 'address',
                name: 'account',
                type: 'address',
            },
        ],
        name: 'Unpaused',
        type: 'event',
    },
    {
        inputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        name: 'balanceOf',
        outputs: [
            {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'bridge',
        outputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getChainID',
        outputs: [
            {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
            },
        ],
        stateMutability: 'pure',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: 'uint256',
                        name: 'stableBridgingFee',
                        type: 'uint256',
                    },
                    {
                        internalType: 'bytes32',
                        name: 'internalID',
                        type: 'bytes32',
                    },
                    {
                        internalType: 'address',
                        name: 'receiveSide',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'managerChainBridge',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'sourceChainBridge',
                        type: 'address',
                    },
                    {
                        internalType: 'uint256',
                        name: 'managerChainId',
                        type: 'uint256',
                    },
                    {
                        internalType: 'uint256',
                        name: 'sourceChainId',
                        type: 'uint256',
                    },
                    {
                        internalType: 'address',
                        name: 'router',
                        type: 'address',
                    },
                    {
                        internalType: 'bytes',
                        name: 'swapCalldata',
                        type: 'bytes',
                    },
                    {
                        internalType: 'address',
                        name: 'sourceChainSynthesis',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'burnToken',
                        type: 'address',
                    },
                    {
                        internalType: 'bytes',
                        name: 'burnCalldata',
                        type: 'bytes',
                    },
                    {
                        internalType: 'bytes32',
                        name: 'clientID',
                        type: 'bytes32',
                    },
                ],
                internalType: 'struct MetaRouteStructs.MetaRevertTransaction',
                name: '_metaRevertTransaction',
                type: 'tuple',
            },
        ],
        name: 'metaRevertRequest',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'metaRouter',
        outputs: [
            {
                internalType: 'contract IMetaRouter',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: 'uint256',
                        name: 'stableBridgingFee',
                        type: 'uint256',
                    },
                    {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                    },
                    {
                        internalType: 'address',
                        name: 'rtoken',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'chain2address',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'receiveSide',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'oppositeBridge',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'syntCaller',
                        type: 'address',
                    },
                    {
                        internalType: 'uint256',
                        name: 'chainID',
                        type: 'uint256',
                    },
                    {
                        internalType: 'address[]',
                        name: 'swapTokens',
                        type: 'address[]',
                    },
                    {
                        internalType: 'address',
                        name: 'secondDexRouter',
                        type: 'address',
                    },
                    {
                        internalType: 'bytes',
                        name: 'secondSwapCalldata',
                        type: 'bytes',
                    },
                    {
                        internalType: 'address',
                        name: 'finalReceiveSide',
                        type: 'address',
                    },
                    {
                        internalType: 'bytes',
                        name: 'finalCalldata',
                        type: 'bytes',
                    },
                    {
                        internalType: 'uint256',
                        name: 'finalOffset',
                        type: 'uint256',
                    },
                    {
                        internalType: 'address',
                        name: 'revertableAddress',
                        type: 'address',
                    },
                    {
                        internalType: 'bytes32',
                        name: 'clientID',
                        type: 'bytes32',
                    },
                ],
                internalType: 'struct MetaRouteStructs.MetaSynthesizeTransaction',
                name: '_metaSynthesizeTransaction',
                type: 'tuple',
            },
        ],
        name: 'metaSynthesize',
        outputs: [
            {
                internalType: 'bytes32',
                name: '',
                type: 'bytes32',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: '_stableBridgingFee',
                type: 'uint256',
            },
            {
                internalType: 'bytes32',
                name: '_externalID',
                type: 'bytes32',
            },
            {
                internalType: 'address',
                name: '_to',
                type: 'address',
            },
            {
                internalType: 'uint256',
                name: '_amount',
                type: 'uint256',
            },
            {
                internalType: 'address',
                name: '_rToken',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_finalReceiveSide',
                type: 'address',
            },
            {
                internalType: 'bytes',
                name: '_finalCalldata',
                type: 'bytes',
            },
            {
                internalType: 'uint256',
                name: '_finalOffset',
                type: 'uint256',
            },
        ],
        name: 'metaUnsynthesize',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'owner',
        outputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'pause',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'paused',
        outputs: [
            {
                internalType: 'bool',
                name: '',
                type: 'bool',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'renounceOwnership',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'requestCount',
        outputs: [
            {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'bytes32',
                name: '',
                type: 'bytes32',
            },
        ],
        name: 'requests',
        outputs: [
            {
                internalType: 'address',
                name: 'recipient',
                type: 'address',
            },
            {
                internalType: 'address',
                name: 'chain2address',
                type: 'address',
            },
            {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
            },
            {
                internalType: 'address',
                name: 'rtoken',
                type: 'address',
            },
            {
                internalType: 'enum Portal.RequestState',
                name: 'state',
                type: 'uint8',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: '_stableBridgingFee',
                type: 'uint256',
            },
            {
                internalType: 'bytes32',
                name: '_internalID',
                type: 'bytes32',
            },
            {
                internalType: 'address',
                name: '_receiveSide',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_oppositeBridge',
                type: 'address',
            },
            {
                internalType: 'uint256',
                name: '_chainId',
                type: 'uint256',
            },
            {
                internalType: 'bytes32',
                name: '_clientID',
                type: 'bytes32',
            },
        ],
        name: 'revertBurnRequest',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: '_stableBridgingFee',
                type: 'uint256',
            },
            {
                internalType: 'bytes32',
                name: '_externalID',
                type: 'bytes32',
            },
        ],
        name: 'revertSynthesize',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'contract IMetaRouter',
                name: '_metaRouter',
                type: 'address',
            },
        ],
        name: 'setMetaRouter',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'address',
                name: '_token',
                type: 'address',
            },
            {
                internalType: 'uint256',
                name: '_threshold',
                type: 'uint256',
            },
        ],
        name: 'setTokenThreshold',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'address',
                name: '_token',
                type: 'address',
            },
            {
                internalType: 'bool',
                name: '_activate',
                type: 'bool',
            },
        ],
        name: 'setWhitelistToken',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: '_stableBridgingFee',
                type: 'uint256',
            },
            {
                internalType: 'address',
                name: '_token',
                type: 'address',
            },
            {
                internalType: 'uint256',
                name: '_amount',
                type: 'uint256',
            },
            {
                internalType: 'address',
                name: '_chain2address',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_receiveSide',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_oppositeBridge',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_revertableAddress',
                type: 'address',
            },
            {
                internalType: 'uint256',
                name: '_chainID',
                type: 'uint256',
            },
            {
                internalType: 'bytes32',
                name: '_clientID',
                type: 'bytes32',
            },
        ],
        name: 'synthesize',
        outputs: [
            {
                internalType: 'bytes32',
                name: '',
                type: 'bytes32',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: '_stableBridgingFee',
                type: 'uint256',
            },
            {
                internalType: 'address',
                name: '_chain2address',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_receiveSide',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_oppositeBridge',
                type: 'address',
            },
            {
                internalType: 'address',
                name: '_revertableAddress',
                type: 'address',
            },
            {
                internalType: 'uint256',
                name: '_chainID',
                type: 'uint256',
            },
            {
                internalType: 'bytes32',
                name: '_clientID',
                type: 'bytes32',
            },
        ],
        name: 'synthesizeNative',
        outputs: [
            {
                internalType: 'bytes32',
                name: '',
                type: 'bytes32',
            },
        ],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: 'uint256',
                        name: 'stableBridgingFee',
                        type: 'uint256',
                    },
                    {
                        internalType: 'bytes',
                        name: 'approvalData',
                        type: 'bytes',
                    },
                    {
                        internalType: 'address',
                        name: 'token',
                        type: 'address',
                    },
                    {
                        internalType: 'uint256',
                        name: 'amount',
                        type: 'uint256',
                    },
                    {
                        internalType: 'address',
                        name: 'chain2address',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'receiveSide',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'oppositeBridge',
                        type: 'address',
                    },
                    {
                        internalType: 'address',
                        name: 'revertableAddress',
                        type: 'address',
                    },
                    {
                        internalType: 'uint256',
                        name: 'chainID',
                        type: 'uint256',
                    },
                    {
                        internalType: 'bytes32',
                        name: 'clientID',
                        type: 'bytes32',
                    },
                ],
                internalType: 'struct Portal.SynthesizeWithPermitTransaction',
                name: '_syntWithPermitTx',
                type: 'tuple',
            },
        ],
        name: 'synthesizeWithPermit',
        outputs: [
            {
                internalType: 'bytes32',
                name: '',
                type: 'bytes32',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        name: 'tokenThreshold',
        outputs: [
            {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        name: 'tokenWhitelist',
        outputs: [
            {
                internalType: 'bool',
                name: '',
                type: 'bool',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'address',
                name: 'newOwner',
                type: 'address',
            },
        ],
        name: 'transferOwnership',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'unpause',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: '_stableBridgingFee',
                type: 'uint256',
            },
            {
                internalType: 'bytes32',
                name: '_externalID',
                type: 'bytes32',
            },
            {
                internalType: 'address',
                name: '_token',
                type: 'address',
            },
            {
                internalType: 'uint256',
                name: '_amount',
                type: 'uint256',
            },
            {
                internalType: 'address',
                name: '_to',
                type: 'address',
            },
        ],
        name: 'unsynthesize',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'bytes32',
                name: '',
                type: 'bytes32',
            },
        ],
        name: 'unsynthesizeStates',
        outputs: [
            {
                internalType: 'enum Portal.UnsynthesizeState',
                name: '',
                type: 'uint8',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'versionRecipient',
        outputs: [
            {
                internalType: 'string',
                name: '',
                type: 'string',
            },
        ],
        stateMutability: 'pure',
        type: 'function',
    },
    {
        inputs: [],
        name: 'wrapper',
        outputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
] as const
