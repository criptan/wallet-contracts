const Wallet = artifacts.require('Wallet')
const WalletFactory = artifacts.require('WalletFactory')

module.exports = async (deployer, network, accounts) => {
  const master = network === 'mainnet' ? process.env.MASTER : accounts[0]
  await deployer.deploy(Wallet)
  const template = await Wallet.deployed()
  await deployer.deploy(WalletFactory, master, template.address)
  if (process.env.OWNER) {
    const walletFactoryInstance = await WalletFactory.deployed()
    await walletFactoryInstance.transferOwnership(process.env.OWNER)
  }
}
