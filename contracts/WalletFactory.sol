pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Wallet.sol";

contract WalletFactory is Ownable {
    using Clones for address;

    event MasterChanged(address oldMaster, address newMaster);
    event AddressGenerated(address indexed generatedAddress);

    address payable public master;
    address public template;

    constructor(address payable _master, address _template) {
        require(_template != address(0), "WalletFactory: template address cannot be zero");

        template = _template;
        setMaster(_master);
    }

    function setMaster(address payable _newMaster) public onlyOwner {
        require(_newMaster != address(0), "WalletFactory: master address cannot be zero");

        address oldMaster = master;
        master = _newMaster;
        emit MasterChanged(oldMaster, _newMaster);
    }

    function generate() public returns (address) {
        address clone = template.clone();
        Wallet(payable(clone)).setup();
        emit AddressGenerated(clone);
        return clone;
    }

    function generateMany(uint _numWallets) public returns (address[] memory) {
        require(_numWallets > 0, "WalletFactory: you must specify a number of wallets greater than zero");

        address[] memory generatedAddresses = new address[](_numWallets);
        for (uint i = 0; i < _numWallets; i++) {
            generatedAddresses[i] = generate();
        }
        return generatedAddresses;
    }
}
