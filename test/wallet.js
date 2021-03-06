const truffleAssert = require('truffle-assertions')
const {constants} = require('@openzeppelin/test-helpers')

const ERC20 = artifacts.require('@openzeppelin/contracts/ERC20PresetMinterPauser')
const Wallet = artifacts.require('Wallet')
const WalletFactory = artifacts.require('WalletFactory')

const {ZERO_ADDRESS} = constants
const toBN = web3.utils.toBN
const salt = '0x3b4a741ce135d043acc7fba2ad0f64e9b97e169ebc0f867117eed224005cad4a'

contract('WalletFactory', (accounts) => {
  const master = accounts[5]
  const creator = accounts[0]
  const tokenOwner = accounts[3]
  let walletFactoryInstance
  let template
  let tokenInstance

  beforeEach(async () => {
    template = await Wallet.new()
    tokenInstance = await ERC20.new('Test token', 'TST', {from: tokenOwner})
    await tokenInstance.mint(tokenOwner, toBN(1000).mul(toBN(10).pow(toBN(18))), {from: tokenOwner})
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
  
  it('should hold the correct master address', async () => {
    const actualMasterAddress = await walletFactoryInstance.master.call()
    assert.equal(actualMasterAddress, master)
  })
  
  it('should not matter whether the template has called "setup" previously or not', async () => {
    await template.setup({from: accounts[8]})
    const tx = await walletFactoryInstance.generate(salt, [])
    const walletContractAddress = tx.receipt.logs[0].args.generatedAddress
    const walletInstance = await Wallet.at(walletContractAddress)
    const masterAddress = await walletInstance.master.call()
    assert.equal(masterAddress, master)
  })
  
  it('should generate the correct address for a given salt', async () => {
    await template.setup({from: accounts[8]})
    const tx = await walletFactoryInstance.generate(salt, [])
    const walletContractAddress = tx.receipt.logs[0].args.generatedAddress
    const computedAddress = await walletFactoryInstance.computeAddress(salt)
    assert.equal(computedAddress, walletContractAddress)
  })
  
  it('should return whether there is an already generated contract or not', async () => {
    await template.setup({from: accounts[8]})
    const computedAddress = await walletFactoryInstance.computeAddress(salt)
    let isGenerated = await walletFactoryInstance.isWalletGenerated(salt)
    assert.isNotOk(isGenerated)
    const tx = await walletFactoryInstance.generate(salt, [])
    const walletContractAddress = tx.receipt.logs[0].args.generatedAddress
    assert.equal(walletContractAddress, computedAddress)
    isGenerated = await walletFactoryInstance.isWalletGenerated(salt)
    assert.isOk(isGenerated)
  })

  it('should collect funds when deploying the wallet contract', async () => {
    await template.setup({from: accounts[8]})
    const amount = toBN(1e16)  // 0.01 ETH
    const sender = accounts[1]
    const computedAddress = await walletFactoryInstance.computeAddress(salt)
    
    let etherBalance = toBN(await web3.eth.getBalance(computedAddress))
    assert.equal(etherBalance, '0')
    let tokenBalance = toBN(await tokenInstance.balanceOf(computedAddress))
    assert.equal(tokenBalance.toString(), '0')
    
    const tx1 = await web3.eth.sendTransaction({
      from: sender,
      to: computedAddress,
      value: amount,
    })
    assert.isOk(tx1.status)
    etherBalance = await web3.eth.getBalance(computedAddress)
    assert.equal(etherBalance.toString(), amount.toString())
    
    let tx2 = await tokenInstance.transfer(computedAddress, amount, {from: tokenOwner})
    assert.isOk(tx2.receipt.status)
    tokenBalance = toBN(await tokenInstance.balanceOf(computedAddress))
    assert.equal(tokenBalance.toString(), amount.toString())
    
    const tx3 = await walletFactoryInstance.generate(salt, [ZERO_ADDRESS, tokenInstance.address])
    assert.isOk(tx3.receipt.status)
    const walletContractAddress = tx3.receipt.logs[0].args.generatedAddress
    assert.equal(computedAddress, walletContractAddress)

    etherBalance = toBN(await web3.eth.getBalance(computedAddress))
    assert.equal(etherBalance, '0')
    tokenBalance = toBN(await tokenInstance.balanceOf(computedAddress))
    assert.equal(tokenBalance.toString(), '0')
  })

  contract('Wallet', () => {
    let walletInstance

    beforeEach(async () => {
      const tx = await walletFactoryInstance.generate(salt, [])
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
      const result = await truffleAssert.createTransactionResult(walletFactoryInstance, tx.transactionHash)
      truffleAssert.eventEmitted(result, 'EtherReceived', {
        sender,
        receiver: walletInstance.address,
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

    it('should require at least one element when calling `collectMany`', async () => {
      const fn = walletInstance.collectMany([])
      await truffleAssert.reverts(fn, 'Wallet: at least one asset must be specified')
    })
    
    it('should return the correct master address defined by the WalletFactory', async () => {
      const walletFactoryActualMasterAddress = await walletFactoryInstance.master.call()
      assert.equal(walletFactoryActualMasterAddress, master)
      const walletActualMasterAddress = await walletInstance.master.call()
      assert.equal(walletActualMasterAddress, master)
    })
  })
})
