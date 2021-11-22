const Wallet = artifacts.require('Wallet')
const WalletFactory = artifacts.require('WalletFactory')

module.exports = async (deployer, network, accounts) => {
  const master = network === 'mainnet' ? '0x10327Ea75dF3935f5eAD94F5C02Cc2378DB936c3' : accounts[0]
  await deployer.deploy(Wallet)
  const template = await Wallet.deployed()
  await deployer.deploy(WalletFactory, master, template.address)
  const walletFactoryInstance = await WalletFactory.deployed()
  await walletFactoryInstance.transferOwnership(master)
}
