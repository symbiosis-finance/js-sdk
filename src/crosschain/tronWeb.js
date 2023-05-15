/**
 * Copied internal functions from TronWeb
 */
import { AbiCoder } from '@ethersproject/abi'
import { utils } from 'ethers'
import TronWeb from 'tronweb'

const ADDRESS_PREFIX_REGEX = /^(41)/

function extractSize(type) {
    const size = type.match(/([a-zA-Z0-9])(\[.*\])/)
    return size ? size[2] : ''
}

function extractArrayDim(type) {
    const size = extractSize(type)
    return (size.match(/\]\[/g) || []).length + 1
}

function _addressToHex(value) {
    return TronWeb.address.toHex(value).replace(ADDRESS_PREFIX_REGEX, '0x')
}

export function encodeParamsV2ByABI(funABI, args) {
    const types = []

    const buildFullTypeDefinition = (typeDef) => {
        if (typeDef && typeDef.type.indexOf('tuple') === 0 && typeDef.components) {
            const innerTypes = typeDef.components.map((innerType) => {
                return buildFullTypeDefinition(innerType)
            })
            return `tuple(${innerTypes.join(',')})${extractSize(typeDef.type)}`
        }

        if (/trcToken/.test(typeDef.type)) return typeDef.type.replace(/trcToken/, 'uint256')

        return typeDef.type
    }

    const convertTypes = (types) => {
        for (let i = 0; i < types.length; i++) {
            const type = types[i]
            if (/trcToken/.test(type)) types[i] = type.replace(/trcToken/, 'uint256')
        }
    }

    const convertAddresses = (addrArr) => {
        if (Array.isArray(addrArr)) {
            addrArr.forEach((addrs, i) => {
                addrArr[i] = convertAddresses(addrs)
            })
            return addrArr
        } else {
            return _addressToHex(addrArr)
        }
    }

    const mapTuple = (components, args, dimension) => {
        if (dimension > 1) {
            if (args.length) {
                args.forEach((arg) => {
                    mapTuple(components, arg, dimension - 1)
                })
            }
        } else {
            if (args.length && dimension) {
                args.forEach((arg) => {
                    encodeArgs(components, arg)
                })
            }
        }
    }

    const encodeArgs = (inputs = [], args) => {
        if (inputs.length)
            inputs.forEach((input, i) => {
                const type = input.type

                if (args[i])
                    if (type === 'address') args[i] = _addressToHex(args[i])
                    else if (type.match(/^([^\x5b]*)(\x5b|$)/)[0] === 'address[') convertAddresses(args[i])
                    else if (type.indexOf('tuple') === 0)
                        if (extractSize(type)) {
                            const dimension = extractArrayDim(type)
                            mapTuple(input.components, args[i], dimension)
                        } else encodeArgs(input.components, args[i])
            })
    }

    if (funABI.inputs && funABI.inputs.length) {
        for (let i = 0; i < funABI.inputs.length; i++) {
            const type = funABI.inputs[i].type
            // "false" will be converting to `false` and "true" will be working
            // fine as abiCoder assume anything in quotes as `true`
            if (type === 'bool' && args[i] === 'false') {
                args[i] = false
            }
            types.push(type.indexOf('tuple') === 0 ? buildFullTypeDefinition(funABI.inputs[i]) : type)
            if (args.length < types.length) {
                args.push('')
            }
        }
    }

    encodeArgs(funABI.inputs, args)
    convertTypes(types)

    const abiCoder = new AbiCoder()
    return abiCoder.encode(types, args)
}

export function getFunctionSelector(abi) {
    abi.stateMutability = abi.stateMutability ? abi.stateMutability.toLowerCase() : 'nonpayable'
    abi.type = abi.type ? abi.type.toLowerCase() : ''
    if (abi.type === 'fallback' || abi.type === 'receive') return '0x'
    let iface = new utils.Interface([abi])
    if (abi.type === 'event') {
        return iface.getEvent(abi.name).format(utils.FormatTypes.sighash)
    }
    return iface.getFunction(abi.name).format(utils.FormatTypes.sighash)
}
