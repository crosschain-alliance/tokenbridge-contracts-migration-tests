require("@nomicfoundation/hardhat-toolbox")
require("@openzeppelin/hardhat-upgrades")
require("hardhat-change-network")
require("dotenv").config()
const path = require("path")

require("./tasks/amb-e2e.js")
require("./tasks/xdai-e2e.js")
require("./tasks/omnibridge-e2e.js")

require("./tasks/deploy/deployAMB.js")
require("./tasks/deploy/deployxDAI.js")
require("./tasks/deploy/deployHashiManager.js")

module.exports = {
  // hardhat config
  networks: {
    hardhat: {
      forking: {
        url: process.env.GNOSIS_JSON_RPC_URL,
        // url: process.env.GNOSIS_JSON_RPC_URL, // change the value when running test in fork gnosis environment,
        // blockNumber: 35443343,
      },
    },
    gnosis: {
      accounts: [process.env.PRIVATE_KEY],
      chainId: 100,
      url: process.env.GNOSIS_JSON_RPC_URL,
    },
    xdai: {
      accounts: [process.env.PRIVATE_KEY],
      chainId: 100,
      url: process.env.GNOSIS_JSON_RPC_URL,
    },
    mainnet: {
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1,
      url: process.env.MAINNET_JSON_RPC_URL,
    },
    fmainnet: {
      url: "http://127.0.0.1:8545",
    },
    fgnosis: {
      url: "http://127.0.0.1:8544",
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
      chiado: process.env.BLOCKSCOUT_API_KEY,
      gnosis: process.env.GNOSISSCAN_API_KEY,
      xdai: process.env.BLOCKSCOUT_API_KEY, // use --network xdai to verify on blockscout
      mainnet: process.env.ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: 'xdai',
        chainId: 100,
        urls: {
          apiURL: 'https://gnosis.blockscout.com//api',
          browserURL: 'https://gnosis.blockscout.com/',
        },
      },
      {
        network: 'chiado',
        chainId: 10200,
        urls: {
          apiURL: 'https://gnosis-chiado.blockscout.com/api',
          browserURL: 'https://gnosis-chiado.blockscout.com/',
        },
      },
    ],
  },
  
  solidity: {
    compilers: [
      {
        version: "0.4.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100, // NOTE: change to 100 when using HomeBridgeErcToNative
          },
          evmVersion: "byzantium",
        },
      },
      {
        version: "0.8.20",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
    ],
  },
}
