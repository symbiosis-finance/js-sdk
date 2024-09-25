/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  OmniPoolOracle,
  OmniPoolOracleInterface,
} from "../OmniPoolOracle";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "version",
        type: "uint8",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "Paused",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "Unpaused",
    type: "event",
  },
  {
    inputs: [],
    name: "a",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "devaddr",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_pool",
        type: "address",
      },
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "lastIndex",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "lpDividendRatio",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "lpFee",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "paused",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pool",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "poolDev",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_id",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "quoteDeposit",
    outputs: [
      {
        internalType: "uint256",
        name: "lpTokenToMint",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "liabilityToMint",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "reward",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_fromAsset",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_toAsset",
        type: "uint256",
      },
      {
        internalType: "int256",
        name: "_fromAmount",
        type: "int256",
      },
    ],
    name: "quoteFrom",
    outputs: [
      {
        internalType: "uint256",
        name: "actualToAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "lpFeeAmount",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_id",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_liquidity",
        type: "uint256",
      },
    ],
    name: "quoteWithdraw",
    outputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "liabilityToBurn",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "fee",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b506123b1806100206000396000f3fe608060405234801561001057600080fd5b506004361061011b5760003560e01c80638456cb59116100b2578063c4d66de811610081578063e8fa77a011610066578063e8fa77a01461023b578063f2fde38b1461024e578063f3f6f0d71461026157600080fd5b8063c4d66de814610215578063d49e77cd1461022857600080fd5b80638456cb59146101cc5780638da5cb5b146101d45780639c6f81cb146101e5578063a3602bee146101ed57600080fd5b80635c975abb116100ee5780635c975abb1461019e578063704ce43e146101b4578063715018a6146101bc578063815bfd29146101c457600080fd5b80630dbe671f146101205780630f4d3eaf1461013b57806316f0115b146101695780633f4ba83a14610194575b600080fd5b610128610269565b6040519081526020015b60405180910390f35b61014e610149366004611fde565b610304565b60408051938452602084019290925290820152606001610132565b60975461017c906001600160a01b031681565b6040516001600160a01b039091168152602001610132565b61019c610816565b005b60655460ff166040519015158152602001610132565b61012861087a565b61019c6108d8565b6101286108ea565b61019c610948565b6033546001600160a01b031661017c565b61017c6109aa565b6102006101fb366004612000565b610a40565b60408051928352602083019190915201610132565b61019c610223366004611ee0565b611157565b60985461017c906001600160a01b031681565b61014e610249366004611fde565b6112c1565b61019c61025c366004611ee0565b6117b3565b610128611843565b609754604080517f0dbe671f00000000000000000000000000000000000000000000000000000000815290516000926001600160a01b031691630dbe671f916004808301926020929190829003018186803b1580156102c757600080fd5b505afa1580156102db573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102ff9190611fc5565b905090565b609754604051634f75b51160e11b815260048101849052600091829182916001600160a01b031690639eeb6a229060240160e06040518083038186803b15801561034d57600080fd5b505afa158015610361573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906103859190611f21565b60600151609754604051634f75b51160e11b81526004810188905286916001600160a01b031690639eeb6a229060240160e06040518083038186803b1580156103cd57600080fd5b505afa1580156103e1573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906104059190611f21565b60200151610413919061226c565b61041d91906120ca565b9150816104715760405162461bcd60e51b815260206004820152600e60248201527f5a65726f206c697175696469747900000000000000000000000000000000000060448201526064015b60405180910390fd5b600061047c8361231d565b609754604051634f75b51160e11b8152600481018990529192506000916001600160a01b0390911690639eeb6a229060240160e06040518083038186803b1580156104c657600080fd5b505afa1580156104da573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906104fe9190611f21565b51609754604051634f75b51160e11b8152600481018a90529192506000916001600160a01b0390911690639eeb6a229060240160e06040518083038186803b15801561054957600080fd5b505afa15801561055d573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906105819190611f21565b6020015190506000609760009054906101000a90046001600160a01b03166001600160a01b0316630dbe671f6040518163ffffffff1660e01b815260040160206040518083038186803b1580156105d757600080fd5b505afa1580156105eb573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061060f9190611fc5565b9050600061061d858461202c565b9050600061062b85856118a1565b9050600061064d61063c85846118a1565b610646908461228b565b86906118de565b90506000600261066f61066887670de0b6b3a764000061228b565b8a906118de565b610679908461202c565b610683919061209c565b905060006106b98261069f61069888806121cc565b89906118de565b6106a985806121cc565b6106b3919061202c565b906118fe565b6106c3908361202c565b90506106cf818961228b565b9b5050505050508686106106ee576106e787876122e3565b94506106f2565b8596505b609754604051634f75b51160e11b8152600481018b905261077b916001600160a01b031690639eeb6a229060240160e06040518083038186803b15801561073857600080fd5b505afa15801561074c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906107709190611f21565b6080015188906119c2565b609754604051634f75b51160e11b8152600481018c9052919850610809916001600160a01b0390911690639eeb6a229060240160e06040518083038186803b1580156107c657600080fd5b505afa1580156107da573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906107fe9190611f21565b6080015186906119c2565b9450505050509250925092565b6098546001600160a01b031633146108705760405162461bcd60e51b815260206004820152600960248201527f466f7262696464656e00000000000000000000000000000000000000000000006044820152606401610468565b610878611a2a565b565b609754604080517f704ce43e00000000000000000000000000000000000000000000000000000000815290516000926001600160a01b03169163704ce43e916004808301926020929190829003018186803b1580156102c757600080fd5b6108e0611a7c565b6108786000611ad6565b609754604080517f815bfd2900000000000000000000000000000000000000000000000000000000815290516000926001600160a01b03169163815bfd29916004808301926020929190829003018186803b1580156102c757600080fd5b6098546001600160a01b031633146109a25760405162461bcd60e51b815260206004820152600960248201527f466f7262696464656e00000000000000000000000000000000000000000000006044820152606401610468565b610878611b40565b609754604080517f91cca3db00000000000000000000000000000000000000000000000000000000815290516000926001600160a01b0316916391cca3db916004808301926020929190829003018186803b158015610a0857600080fd5b505afa158015610a1c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102ff9190611f04565b609754604051634f75b51160e11b81526004810185905260009182918291829182918291610ad6916001600160a01b031690639eeb6a229060240160e06040518083038186803b158015610a9357600080fd5b505afa158015610aa7573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610acb9190611f21565b608001518890611b7d565b609754604051634f75b51160e11b8152600481018b90529198506000916001600160a01b0390911690639eeb6a229060240160e06040518083038186803b158015610b2057600080fd5b505afa158015610b34573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610b589190611f21565b51609754604080517f0dbe671f000000000000000000000000000000000000000000000000000000008152905192935083926000926001600160a01b031691630dbe671f916004808301926020929190829003018186803b158015610bbc57600080fd5b505afa158015610bd0573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610bf49190611fc5565b609754604051634f75b51160e11b8152600481018f90529192506000916001600160a01b0390911690639eeb6a229060240160e06040518083038186803b158015610c3e57600080fd5b505afa158015610c52573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610c769190611f21565b6000015190506000609760009054906101000a90046001600160a01b03166001600160a01b0316639eeb6a228f6040518263ffffffff1660e01b8152600401610cc191815260200190565b60e06040518083038186803b158015610cd957600080fd5b505afa158015610ced573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610d119190611f21565b6020015190506000609760009054906101000a90046001600160a01b03166001600160a01b0316639eeb6a228f6040518263ffffffff1660e01b8152600401610d5c91815260200190565b60e06040518083038186803b158015610d7457600080fd5b505afa158015610d88573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610dac9190611f21565b60200151929850909650909450508315801590610dc857508415155b610e145760405162461bcd60e51b815260206004820152600d60248201527f496e76616c69642076616c7565000000000000000000000000000000000000006044820152606401610468565b6000610e5483610e2487806121cc565b610e2e919061209c565b88610e3989806121cc565b610e43919061209c565b610e4d919061202c565b83906118de565b610e5e848961202c565b610e68919061228b565b90506000610e8087610e7a8e8b61202c565b906118a1565b90506000610e8e83886118a1565b87610e9986856118a1565b610ea3908561228b565b610ead908b6121cc565b610eb7919061209c565b610ec1919061228b565b90506000610ecf8286611bd7565b9050600086610ede8a846118de565b610ee8919061228b565b90506000811215610f0357610efc8161231d565b9b50610f07565b809b505b50505088851015610f5a5760405162461bcd60e51b815260206004820152600f60248201527f4e6f7420656e6f756768206361736800000000000000000000000000000000006044820152606401610468565b609754604080517f704ce43e0000000000000000000000000000000000000000000000000000000081529051610ff8926001600160a01b03169163704ce43e916004808301926020929190829003018186803b158015610fb957600080fd5b505afa158015610fcd573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610ff19190611fc5565b8a90611c12565b995060008c13156110145761100d8a8a6122e3565b9a50611018565b889a505b609754604051634f75b51160e11b8152600481018f90526110a1916001600160a01b031690639eeb6a229060240160e06040518083038186803b15801561105e57600080fd5b505afa158015611072573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906110969190611f21565b608001518c906119c2565b9a50611144609760009054906101000a90046001600160a01b03166001600160a01b0316639eeb6a228f6040518263ffffffff1660e01b81526004016110e991815260200190565b60e06040518083038186803b15801561110157600080fd5b505afa158015611115573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906111399190611f21565b608001518b906119c2565b9950505050505050505050935093915050565b600054610100900460ff16158080156111775750600054600160ff909116105b806111915750303b158015611191575060005460ff166001145b6112035760405162461bcd60e51b815260206004820152602e60248201527f496e697469616c697a61626c653a20636f6e747261637420697320616c72656160448201527f647920696e697469616c697a65640000000000000000000000000000000000006064820152608401610468565b6000805460ff191660011790558015611226576000805461ff0019166101001790555b61122e611c46565b611236611ccb565b609780546001600160a01b0384167fffffffffffffffffffffffff000000000000000000000000000000000000000091821617909155609880549091163317905580156112bd576000805461ff0019169055604051600181527f7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb38474024989060200160405180910390a15b5050565b609754604051634f75b51160e11b81526004810184905260009182918291611353916001600160a01b0390911690639eeb6a229060240160e06040518083038186803b15801561131057600080fd5b505afa158015611324573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906113489190611f21565b608001518590611d54565b609754604051634f75b51160e11b81526004810188905291955085916000916001600160a01b031690639eeb6a229060240160e06040518083038186803b15801561139d57600080fd5b505afa1580156113b1573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906113d59190611f21565b51609754604051634f75b51160e11b8152600481018a90529192506000916001600160a01b0390911690639eeb6a229060240160e06040518083038186803b15801561142057600080fd5b505afa158015611434573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906114589190611f21565b6020015190506000609760009054906101000a90046001600160a01b03166001600160a01b0316630dbe671f6040518163ffffffff1660e01b815260040160206040518083038186803b1580156114ae57600080fd5b505afa1580156114c2573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906114e69190611fc5565b9050816114f557879550611665565b6000611501858561202c565b121561154f5760405162461bcd60e51b815260206004820152600d60248201527f496e76616c69642076616c7565000000000000000000000000000000000000006044820152606401610468565b600061155b84846118a1565b90506000611569858761202c565b9050600061157784866118de565b6115829060026121cc565b61159e61159786670de0b6b3a764000061228b565b84906118de565b6115a8919061202c565b905060006115c0866115ba87826118de565b906118de565b6115ca84806118de565b6115ec866115d88a8a6121cc565b6115e2919061209c565b610646908b61228b565b6115f6919061228b565b611600919061202c565b90506000816116108760046121cc565b61161a91906121cc565b61162484806121cc565b61162e919061228b565b905060026116538761164084876118fe565b6116498761231d565b610e7a919061202c565b61165d919061209c565b9a5050505050505b87861061167d5761167688876122e3565b9450611681565b8795505b609754604051634f75b51160e11b8152600481018b90526000916001600160a01b031690639eeb6a229060240160e06040518083038186803b1580156116c657600080fd5b505afa1580156116da573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906116fe9190611f21565b60200151905080156117a357609754604051634f75b51160e11b8152600481018c905282916001600160a01b031690639eeb6a229060240160e06040518083038186803b15801561174e57600080fd5b505afa158015611762573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906117869190611f21565b60600151611794908961226c565b61179e91906120ca565b6117a5565b865b975050505050509250925092565b6117bb611a7c565b6001600160a01b0381166118375760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201527f64647265737300000000000000000000000000000000000000000000000000006064820152608401610468565b61184081611ad6565b50565b609754604080517ff3f6f0d700000000000000000000000000000000000000000000000000000000815290516000926001600160a01b03169163f3f6f0d7916004808301926020929190829003018186803b1580156102c757600080fd5b6000816118af60028261209c565b6118c1670de0b6b3a7640000866121cc565b6118cb919061202c565b6118d5919061209c565b90505b92915050565b6000670de0b6b3a76400006118f460028261209c565b6118c184866121cc565b600060038313156119b3576000821380156119195750828213155b15611925575080611955565b60008212801561193d57508261193a8361231d565b13155b156119525761194b8261231d565b9050611955565b50815b6000600282611964818761209c565b61196e919061202c565b611978919061209c565b90505b8181146119ad57905080600281611992818761209c565b61199c919061202c565b6119a6919061209c565b905061197b565b506118d8565b82156118d85750600192915050565b600060128260ff1610156119f7576119db8260126122fa565b6119e690600a612121565b6119f090846120ca565b90506118d8565b60128260ff161115611a2357611a0e6012836122fa565b611a1990600a612121565b6119f0908461226c565b5090919050565b611a32611d84565b6065805460ff191690557f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa335b6040516001600160a01b03909116815260200160405180910390a1565b6033546001600160a01b031633146108785760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e65726044820152606401610468565b603380546001600160a01b038381167fffffffffffffffffffffffff0000000000000000000000000000000000000000831681179093556040519116919082907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e090600090a35050565b611b48611dd6565b6065805460ff191660011790557f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258611a5f3390565b600060128260ff161015611bab57611b968260126122fa565b611ba190600a612121565b6119f090846121cc565b60128260ff161115611a2357611bc26012836122fa565b611bcd90600a612121565b6119f0908461209c565b6000600283611c0881670de0b6b3a7640000611bf48760046121cc565b611bfe91906121cc565b6106a988806121cc565b6118cb919061228b565b6000670de0b6b3a7640000611c286002826120ca565b611c32848661226c565b611c3c9190612084565b6118d591906120ca565b600054610100900460ff16611cc35760405162461bcd60e51b815260206004820152602b60248201527f496e697469616c697a61626c653a20636f6e7472616374206973206e6f74206960448201527f6e697469616c697a696e670000000000000000000000000000000000000000006064820152608401610468565b610878611e29565b600054610100900460ff16611d485760405162461bcd60e51b815260206004820152602b60248201527f496e697469616c697a61626c653a20636f6e7472616374206973206e6f74206960448201527f6e697469616c697a696e670000000000000000000000000000000000000000006064820152608401610468565b6065805460ff19169055565b600060128260ff161015611d6d57611a0e8260126122fa565b60128260ff161115611a23576119db6012836122fa565b60655460ff166108785760405162461bcd60e51b815260206004820152601460248201527f5061757361626c653a206e6f74207061757365640000000000000000000000006044820152606401610468565b60655460ff16156108785760405162461bcd60e51b815260206004820152601060248201527f5061757361626c653a20706175736564000000000000000000000000000000006044820152606401610468565b600054610100900460ff16611ea65760405162461bcd60e51b815260206004820152602b60248201527f496e697469616c697a61626c653a20636f6e7472616374206973206e6f74206960448201527f6e697469616c697a696e670000000000000000000000000000000000000000006064820152608401610468565b61087833611ad6565b8051611eba81612366565b919050565b80518015158114611eba57600080fd5b805160ff81168114611eba57600080fd5b600060208284031215611ef257600080fd5b8135611efd81612366565b9392505050565b600060208284031215611f1657600080fd5b8151611efd81612366565b600060e08284031215611f3357600080fd5b60405160e0810181811067ffffffffffffffff82111715611f6457634e487b7160e01b600052604160045260246000fd5b806040525082518152602083015160208201526040830151604082015260608301516060820152611f9760808401611ecf565b6080820152611fa860a08401611eaf565b60a0820152611fb960c08401611ebf565b60c08201529392505050565b600060208284031215611fd757600080fd5b5051919050565b60008060408385031215611ff157600080fd5b50508035926020909101359150565b60008060006060848603121561201557600080fd5b505081359360208301359350604090920135919050565b6000808212827f7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff038413811516156120665761206661233a565b82600160ff1b03841281161561207e5761207e61233a565b50500190565b600082198211156120975761209761233a565b500190565b6000826120ab576120ab612350565b6000198314600160ff1b831416156120c5576120c561233a565b500590565b6000826120d9576120d9612350565b500490565b600181815b808511156121195781600019048211156120ff576120ff61233a565b8085161561210c57918102915b93841c93908002906120e3565b509250929050565b60006118d560ff84168360008261213a575060016118d8565b81612147575060006118d8565b816001811461215d576002811461216757612183565b60019150506118d8565b60ff8411156121785761217861233a565b50506001821b6118d8565b5060208310610133831016604e8410600b84101617156121a6575081810a6118d8565b6121b083836120de565b80600019048211156121c4576121c461233a565b029392505050565b60007f7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff60008413600084138583048511828216161561220d5761220d61233a565b600160ff1b600087128682058812818416161561222c5761222c61233a565b600087129250878205871284841616156122485761224861233a565b8785058712818416161561225e5761225e61233a565b505050929093029392505050565b60008160001904831182151516156122865761228661233a565b500290565b600080831283600160ff1b018312811516156122a9576122a961233a565b837f7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0183138116156122dd576122dd61233a565b50500390565b6000828210156122f5576122f561233a565b500390565b600060ff821660ff8416808210156123145761231461233a565b90039392505050565b6000600160ff1b8214156123335761233361233a565b5060000390565b634e487b7160e01b600052601160045260246000fd5b634e487b7160e01b600052601260045260246000fd5b6001600160a01b038116811461184057600080fdfea26469706673582212203b7f3bb1aa41c8479d600ab7a7c4738d0a79beab9ad61c6b4563e2091d13d90764736f6c63430008050033";

type OmniPoolOracleConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: OmniPoolOracleConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class OmniPoolOracle__factory extends ContractFactory {
  constructor(...args: OmniPoolOracleConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
    this.contractName = "OmniPoolOracle";
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<OmniPoolOracle> {
    return super.deploy(overrides || {}) as Promise<OmniPoolOracle>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): OmniPoolOracle {
    return super.attach(address) as OmniPoolOracle;
  }
  connect(signer: Signer): OmniPoolOracle__factory {
    return super.connect(signer) as OmniPoolOracle__factory;
  }
  static readonly contractName: "OmniPoolOracle";
  public readonly contractName: "OmniPoolOracle";
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): OmniPoolOracleInterface {
    return new utils.Interface(_abi) as OmniPoolOracleInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): OmniPoolOracle {
    return new Contract(address, _abi, signerOrProvider) as OmniPoolOracle;
  }
}
