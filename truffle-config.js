require('dotenv').config()
const HDWalletProvider = require('truffle-hdwallet-provider')

module.exports = {
  plugins: ['solidity-coverage', 'truffle-plugin-verify'],
  networks: {
    development: {
      host: '127.0.0.1',
      port: 7545,
      network_id: '*'
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
    goerli: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
      network_id: 5,
      networkCheckTimeout: 3000,
      skipDryRun: true
    }
  },
  mocha: {
    slow: 1000
  },
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  },
  compilers: {
    solc: {
      version: '0.8.6',
      parser: 'solcjs',
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
}
