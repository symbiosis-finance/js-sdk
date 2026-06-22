import { networks } from 'bitcoinjs-lib'

import { getAddress } from '../src/crosschain/chainUtils/btc'

function main() {
    const pkScript = process.argv[2]
    if (!pkScript) {
        console.error('Usage: npx tsx scripts/pkScriptToAddress.ts <pkScriptHex>')
        console.error('Example: npx tsx scripts/pkScriptToAddress.ts 0x0014751e76e8199196d454941c45d1b3a323f1433bd6')
        process.exit(1)
    }

    const normalized = pkScript.startsWith('0x') ? pkScript : `0x${pkScript}`
    const addr = getAddress(normalized, networks.bitcoin)
    console.log(addr)
}

main()
