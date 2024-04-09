require("@nomicfoundation/hardhat-toolbox")
require("@openzeppelin/hardhat-upgrades")
require("dotenv").config()

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET_JSON_RPC_URL,
      },
      chainId: 1,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.4.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
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
