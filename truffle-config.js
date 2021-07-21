require('dotenv').config()
const HDWalletProvider = require("truffle-hdwallet-provider")

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },
    mainnet: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
      network_id: 1
    },
    ropsten: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, `https://ropsten.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
      network_id: 3,
      networkCheckTimeout: 3000,
      skipDryRun: true
    },
  },
  mocha: {
    slow: 1000
  },
  compilers: {
    solc: {
      version: "0.8.6",
      parser: "solcjs",
      optimizer: {
        enabled: true,
        runs: 200
      },
    }
  }
}
