const truffleAssert = require('truffle-assertions')
const {constants} = require('@openzeppelin/test-helpers')

const ERC20 = artifacts.require('@openzeppelin/contracts/ERC20PresetMinterPauser');
const Wallet = artifacts.require("Wallet")
const WalletFactory = artifacts.require("WalletFactory")

const {ZERO_ADDRESS} = constants
const toBN = web3.utils.toBN

contract('WalletFactory', (accounts) => {
  const master = accounts[5]
  const creator = accounts[0]
  let walletFactoryInstance

  beforeEach(async () => {
    const template = await Wallet.new()
    walletFactoryInstance = await WalletFactory.new(master, template.address)
  })

  it('should be able to change the owner', async () => {
    const newOwner = accounts[3]
    const owner = await walletFactoryInstance.owner()
    assert.equal(owner, creator)
    const tx = await walletFactoryInstance.transferOwnership(newOwner)
    assert.isOk(tx.receipt.status)
    truffleAssert.eventEmitted(tx, 'OwnershipTransferred', {
      previousOwner: creator,
      newOwner,
    })
    const actualNewOwner = await walletFactoryInstance.owner()
    assert.equal(actualNewOwner, newOwner)
  })

  it('should only let the current owner change owners', async () => {
    const newOwner = accounts[3]
    const fn = walletFactoryInstance.transferOwnership(newOwner, {from: accounts[2]})
    await truffleAssert.reverts(fn)
  })

  it('should not allow empty address as master', async () => {
    const fn = walletFactoryInstance.setMaster(ZERO_ADDRESS)
    await truffleAssert.reverts(fn, 'WalletFactory: master address cannot be zero')
  })

  it('should not allow empty address as template', async () => {
    const fn = WalletFactory.new(master, ZERO_ADDRESS)
    await truffleAssert.reverts(fn, 'WalletFactory: template address cannot be zero')
  })

  it('should allow the admin to change the master address', async () => {
    const newMaster = accounts[8]
    await walletFactoryInstance.setMaster(newMaster)
    const actualNewMaster = await walletFactoryInstance.master()
    assert.equal(actualNewMaster, newMaster)
  })

  it('should only allow the owner to change the master address', async () => {
    const sender = accounts[8]
    const fn = walletFactoryInstance.setMaster(sender, {from: sender})
    await truffleAssert.reverts(fn)
  })

  it('should be able to create many new wallets at once', async () => {
    const numWallets = 10
    const tx = await walletFactoryInstance.generateMany(numWallets)
    const addressSet = new Set()
    truffleAssert.eventEmitted(tx, 'AddressGenerated', (event) => {
      addressSet.add(event.generatedAddress)
      return true
    })
    // all wallets must have different addresses
    assert.equal(addressSet.size, numWallets)
  })

  contract('Wallet', () => {
    let walletInstance
    let tokenInstance
    const tokenOwner = accounts[3]

    beforeEach(async () => {
      const tx = await walletFactoryInstance.generate()
      const walletContractAddress = tx.receipt.logs[0].args.generatedAddress
      truffleAssert.eventEmitted(tx, 'AddressGenerated', {
        generatedAddress: walletContractAddress,
      })
      walletInstance = await Wallet.at(walletContractAddress)
      tokenInstance = await ERC20.new('Test token', 'TST', {from: tokenOwner})
      await tokenInstance.mint(tokenOwner, toBN(1000).mul(toBN(10).pow(toBN(18))), {from: tokenOwner})
    })

    it('should have no ether at all upon creation', async () => {
      const balance = await web3.eth.getBalance(walletInstance.address)
      assert.equal('0', balance)
    })

    it('should log an event when receiving ether', async () => {
      const amount = toBN(1e16)  // 0.01 ETH
      const sender = accounts[1]
      const tx = await web3.eth.sendTransaction({
        from: sender,
        to: walletInstance.address,
        value: amount,
      })
      assert.isOk(tx.status)
      const result = await truffleAssert.createTransactionResult(walletInstance, tx.transactionHash)
      truffleAssert.eventEmitted(result, 'EtherReceived', {
        sender,
        amount,
      })
      const balance = await web3.eth.getBalance(walletInstance.address)
      assert.equal(balance, amount.toString())
    })

    it('should be able to collect received ether using explicit function', async () => {
      const amount = toBN(1e16)
      await web3.eth.sendTransaction({
        from: accounts[4],
        to: walletInstance.address,
        value: amount,
      })

      // balance before collecting should be greater than zero
      const walletBalanceBefore = await web3.eth.getBalance(walletInstance.address)
      assert.equal(walletBalanceBefore, amount.toString())
      const masterBalanceBefore = await web3.eth.getBalance(master)

      // collecting the balance
      const tx = await walletInstance.collectEther()
      assert.isOk(tx.receipt.status)
      truffleAssert.eventEmitted(tx, 'EtherSent', {
        receiver: master,
        amount,
      })
      // checking balances after
      const walletBalanceAfter = await web3.eth.getBalance(walletInstance.address)
      assert.equal('0', walletBalanceAfter)
      const masterBalanceAfter = await web3.eth.getBalance(master)
      assert.equal(toBN(masterBalanceAfter).toString(), (toBN(masterBalanceBefore).add(amount)).toString())
    })

    it('should collect any ERC20 token', async () => {
      const amount = toBN(1e16)
      let tx = await tokenInstance.transfer(walletInstance.address, amount, {from: tokenOwner})
      assert.isOk(tx.receipt.status)
      truffleAssert.eventEmitted(tx, 'Transfer', {
        from: tokenOwner,
        to: walletInstance.address,
        value: amount,
      })

      // balance before collecting should be greater than zero
      const walletBalanceBefore = await tokenInstance.balanceOf(walletInstance.address)
      assert.equal(walletBalanceBefore, amount.toString())
      const masterBalanceBefore = await tokenInstance.balanceOf(master)

      // collecting the balance
      tx = await walletInstance.collect(tokenInstance.address)
      assert.isOk(tx.receipt.status)
      const result = await truffleAssert.createTransactionResult(tokenInstance, tx.receipt.transactionHash)
      truffleAssert.eventEmitted(result, 'Transfer', {
        from: walletInstance.address,
        to: master,
        value: amount,
      })
      // checking balances after
      const walletBalanceAfter = await tokenInstance.balanceOf(walletInstance.address)
      assert.equal('0', walletBalanceAfter)
      const masterBalanceAfter = await tokenInstance.balanceOf(master)
      assert.equal(toBN(masterBalanceAfter).toString(), (toBN(masterBalanceBefore).add(amount)).toString())
    })
    it('should not allow any caller to invoke the "setup" function again', async () => {
      const fn = walletInstance.setup({from: accounts[7]})
      await truffleAssert.reverts(fn, 'Wallet: cannot call setup twice')
    })
    it('should be able to collect both ether and ERC20 tokens in a single transaction', async () => {
      const amount = toBN(1e16)

      // sending ether
      const masterEtherBalanceBefore = await web3.eth.getBalance(master)
      await web3.eth.sendTransaction({
        from: tokenOwner,
        to: walletInstance.address,
        value: amount,
      })
      const walletEtherBalanceBefore = await web3.eth.getBalance(walletInstance.address)
      assert.equal(walletEtherBalanceBefore, amount.toString())

      // sending ERC20 tokens
      const masterTokenBalanceBefore = await tokenInstance.balanceOf(master)
      await tokenInstance.transfer(walletInstance.address, amount, {from: tokenOwner})
      const walletTokenBalanceBefore = await tokenInstance.balanceOf(walletInstance.address)
      assert.equal(walletTokenBalanceBefore, amount.toString())

      // collecting funds
      const tx = await walletInstance.collectMany([ZERO_ADDRESS, tokenInstance.address])
      assert.isOk(tx.receipt.status)
      truffleAssert.eventEmitted(tx, 'EtherSent', {
        receiver: master,
        amount,
      })
      const result = await truffleAssert.createTransactionResult(tokenInstance, tx.receipt.transactionHash)
      truffleAssert.eventEmitted(result, 'Transfer', {
        from: walletInstance.address,
        to: master,
        value: amount,
      })

      // checking ether after
      const walletEtherBalanceAfter = await web3.eth.getBalance(walletInstance.address)
      assert.equal(walletEtherBalanceAfter, '0')
      const masterEtherBalanceAfter = await web3.eth.getBalance(master)
      assert.equal(masterEtherBalanceAfter, toBN(masterEtherBalanceBefore).add(amount).toString())

      // checking ERC20 tokens after
      const walletTokenBalanceAfter = await tokenInstance.balanceOf(walletInstance.address)
      assert.equal(walletTokenBalanceAfter, '0')
      const masterTokenBalanceAfter = await tokenInstance.balanceOf(master)
      assert.equal(masterTokenBalanceAfter, toBN(masterTokenBalanceBefore).add(amount).toString())
    })
  })
})
