require("@nomicfoundation/hardhat-toolbox")
require("@openzeppelin/hardhat-upgrades")
require("hardhat-change-network")
require("hardhat-tracer")
require("dotenv").config()

const path = require("path")

require("./tasks/amb-e2e.js")
require("./tasks/xdai-e2e.js")
require("./tasks/omnibridge-e2e.js")

module.exports = {
  // hardhat config
  networks: {
    // default: {
    //   url: process.env.GNOSIS_JSON_RPC_URL,
    // },
    hardhat: {
      forking: {
        url: process.env.MAINNET_JSON_RPC_URL, //process.env.GNOSIS_JSON_RPC_URL,
        blockNumber: 35443343,
      },
    },
    gnosis: {
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
        version: "0.7.5",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "istanbul",
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
