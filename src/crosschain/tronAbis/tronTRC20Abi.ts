export const TRON_TRC20_ABI = [
    { stateMutability: 'Nonpayable', type: 'Constructor' },
    {
        inputs: [
            { indexed: true, name: 'owner', type: 'address' },
            { indexed: true, name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
        ],
        name: 'Approval',
        type: 'Event',
    },
    {
        inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
        ],
        name: 'Transfer',
        type: 'Event',
    },
    {
        outputs: [{ type: 'uint256' }],
        constant: true,
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        name: 'allowance',
        stateMutability: 'View',
        type: 'Function',
    },
    {
        outputs: [{ type: 'bool' }],
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
        ],
        name: 'approve',
        stateMutability: 'Nonpayable',
        type: 'Function',
    },
    {
        outputs: [{ type: 'uint256' }],
        constant: true,
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        stateMutability: 'View',
        type: 'Function',
    },
    {
        outputs: [{ type: 'uint8' }],
        constant: true,
        name: 'decimals',
        stateMutability: 'View',
        type: 'Function',
    },
    {
        outputs: [{ type: 'bool' }],
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'subtractedValue', type: 'uint256' },
        ],
        name: 'decreaseAllowance',
        stateMutability: 'Nonpayable',
        type: 'Function',
    },
    {
        outputs: [{ type: 'bool' }],
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'addedValue', type: 'uint256' },
        ],
        name: 'increaseAllowance',
        stateMutability: 'Nonpayable',
        type: 'Function',
    },
    { outputs: [{ type: 'string' }], constant: true, name: 'name', stateMutability: 'View', type: 'Function' },
    {
        outputs: [{ type: 'string' }],
        constant: true,
        name: 'symbol',
        stateMutability: 'View',
        type: 'Function',
    },
    {
        outputs: [{ type: 'uint256' }],
        constant: true,
        name: 'totalSupply',
        stateMutability: 'View',
        type: 'Function',
    },
    {
        outputs: [{ type: 'bool' }],
        inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        name: 'transfer',
        stateMutability: 'Nonpayable',
        type: 'Function',
    },
    {
        outputs: [{ type: 'bool' }],
        inputs: [
            { name: 'sender', type: 'address' },
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        name: 'transferFrom',
        stateMutability: 'Nonpayable',
        type: 'Function',
    },
] as const
