pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Wallet.sol";


/**
 * @dev Implementation of the wallet controller contract.
 * It aims to serve as an orchestration mechanism to generate new wallets. The main idea is that any ethereum
 * address could call the `generate` method in order to have a new address available to receive funds.
 */
contract WalletFactory is Ownable {
    using Clones for address;

    /**
     * @dev Event fired whenever the `oldMaster` address has been replaced by the `newMaster` once.
     */
    event MasterChanged(address oldMaster, address newMaster);

    /**
     * @dev Event fired whenever a new address has been generated via the `generate` method.
     */
    event AddressGenerated(address indexed generatedAddress);

    /**
     * @dev Address where all funds coming from `Wallet` contracts will be collected in.
     */
    address payable public master;

    /**
     * @dev Address where the `Wallet` implementation lies. Used for cloning so that some gas can be saved
     * in the process.
     */
    address public template;

    constructor(address payable _master, address _template) {
        require(_template != address(0), "WalletFactory: template address cannot be zero");

        template = _template;
        setMaster(_master);
    }

    /**
     * @dev Changes the current master address for `_newMaster`.
     * This operation can only be performed by the owner.
     */
    function setMaster(address payable _newMaster) public onlyOwner {
        require(_newMaster != address(0), "WalletFactory: master address cannot be zero");

        address oldMaster = master;
        master = _newMaster;
        emit MasterChanged(oldMaster, _newMaster);
    }

    /**
     * @dev Generates a new `Wallet` contract using cloning method and returns its address.
     */
    function generate() public returns (address) {
        address clone = template.clone();
        Wallet(payable(clone)).setup();
        emit AddressGenerated(clone);
        return clone;
    }

    /**
     * @dev Generates several new `Wallet` contracts at once and returns their addresses.
     */
    function generateMany(uint _numWallets) public returns (address[] memory) {
        require(_numWallets > 0, "WalletFactory: you must specify a number of wallets greater than zero");

        address[] memory generatedAddresses = new address[](_numWallets);
        for (uint i = 0; i < _numWallets; i++) {
            generatedAddresses[i] = generate();
        }
        return generatedAddresses;
    }
}
