require('@nomicfoundation/hardhat-toolbox') 
require('hardhat-deploy')
require('hardhat-gas-reporter')
require('dotenv/config')

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  namedAccounts: {
    deployer: 0,
    tokenOwner: 1
  },
  network: {
    hardhat: {
      chainId: 1337
    },
    testnet: {
      url: '',
      accounts: [
        ''
      ]
    },
    bitlayer: {
      url: '',
      accounts: [
        ''
      ]
    },
  },
  etherscan: {
    apiKey: ''
  }
};
