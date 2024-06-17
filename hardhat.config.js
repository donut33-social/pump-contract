
require('@nomicfoundation/hardhat-toolbox') 
require('hardhat-deploy')
require('hardhat-gas-reporter')
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: 
  {
    compilers:[
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {version: "0.5.0",
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000
        }
      }},
      {version: "0.6.12",
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000
        }
      }}
    ],
    overrides: {
      "contracts/UniswapV2/SushiswapFactoryV2.sol": {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      "contracts/UniswapV2/SushiswapV2Router02.sol": {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      }
    }
  },
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
