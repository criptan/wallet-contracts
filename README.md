# Wallet contracts

This project is a collection on smart contracts for the Ethereum blockchain that aims to
serve as wallets where users can deposit their funds in both ether and ERC20 tokens.

The idea is to interact with the [WalletFactory](./contracts/WalletFactory.sol) contract to
generate newly created [Wallet](./contracts/Wallet.sol) so that it becomes available to receive funds. Those funds
can only be collected through few available methods that always send everything to the
``master`` address specified by the [WalletFactory](./contracts/WalletFactory.sol) contract.


## Build the contracts

```sh
$ yarn run build
```


## Testing

In order to test the contracts follow these steps:

1) Install the dependencies:

```sh
$ yarn install
```

2) Start the test blockchain:

```sh
$ yarn run ganache
```

3) Run the actual tests:

```sh
$ yarn run test
```

## Security Audit

The security audit was carried out by [Omniscia](https://omniscia.io/). You can find it [here](https://omniscia.io/criptan-wallet-implementation/compilation).
