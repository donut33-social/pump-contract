require('@nomicfoundation/hardhat-toolbox') 
require('hardhat-deploy')
require('hardhat-gas-reporter')
require('dotenv').config();

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
    bitlayer: {
      url: 'https://rpc.bitlayer.org',
      chainId: 200901,
      accounts: [
        process.env.KEY
      ]
    },
  },
  etherscan: {
    apiKey: ''
  },
  // flattenExporter: {
  //   src: "./contracts",
  //   path: "./flat",
  //   clear: true,
  // },
  paths: {
    tests: "./tests"
  },
  // contractSizer: {
  //   alphaSort: false,
  //   runOnCompile: false,
  //   disambiguatePaths: false
  // },
  // allowUnlimitedContractSize: false,
};
