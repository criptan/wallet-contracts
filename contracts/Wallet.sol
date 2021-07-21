pragma solidity 0.8.6;

import "./WalletFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Wallet {
    event EtherReceived(address indexed sender, uint amount);
    event EtherSent(address indexed receiver, uint amount);

    WalletFactory public factory;

    function setup() public {
        require(address(factory) == address(0), "Wallet: cannot call setup twice");

        factory = WalletFactory(msg.sender);
    }

    function collectEther() public returns (uint) {
        uint balance = address(this).balance;
        factory.master().transfer(balance);
        emit EtherSent(factory.master(), balance);
        return balance;
    }

    function collect(address _asset) public returns (uint) {
        uint balance;
        if (_asset == address(0)) {
            balance = collectEther();
        } else {
            IERC20 token = IERC20(_asset);
            balance = token.balanceOf(address(this));
            require(token.transfer(factory.master(), balance), "Wallet: could not transfer the ERC20 tokens");
        }
        return balance;
    }

    function collectMany(address[] calldata _assets) public returns (uint[] memory) {
        require(_assets.length > 0, "Wallet: at least one asset must be specified");

        uint[] memory values = new uint[](_assets.length);
        for (uint i = 0; i < _assets.length; i++) {
            values[i] = collect(_assets[i]);
        }
        return values;
    }

    receive() external payable {
        emit EtherReceived(msg.sender, msg.value);
    }
}
