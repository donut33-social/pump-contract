const { Signer, Contract, ContractFactory, utils } = require("ethers");
const { linkLibraries } = require("./linkLibraries")
const WETH9 = require("./WETH9.json");

const artifacts = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
  WETH9,
  UniswapV3Pool: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"),
};

// TODO: Should replace these with the proper typechain output.
// type INonfungiblePositionManager = Contract;
// type IUniswapV3Factory = Contract;

class UniswapV3Deployer {
  static async deploy(actor) {
    const deployer = new UniswapV3Deployer(actor);

    const weth9 = await deployer.deployWETH9();
    console.log(31, weth9.target) //0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
    const factory = await deployer.deployFactory();
    console.log(32, factory.target) //0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
    const router = await deployer.deployRouter(factory.target, weth9.target);

    console.log(33, router.target) //0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
    const nftDescriptorLibrary = await deployer.deployNFTDescriptorLibrary();
    console.log(34, nftDescriptorLibrary.target) //0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
    const positionDescriptor = await deployer.deployPositionDescriptor(
      nftDescriptorLibrary.target,
      weth9.target
    );
    console.log(35, positionDescriptor.target)
    const positionManager = await deployer.deployNonfungiblePositionManager(
      factory.target,
      weth9.target,
      // '0xa9dD0d1DEd484e678039699D4eF34b6F8060a6C8'
      positionDescriptor.target
    );
    console.log(36, positionManager.target) //0x0165878A594ca255338adfa4d48449f69242Eb8F

    return {
      weth9: weth9,
      factory: factory,
      router: router,
      nftDescriptorLibrary: nftDescriptorLibrary,
      positionManager: positionManager,
      artifacts
    };
  }

  deployer;

  constructor(deployer) {
    this.deployer = deployer;
  }

  async deployFactory() {
    return await this.deployContract(
      artifacts.UniswapV3Factory.abi,
      artifacts.UniswapV3Factory.bytecode,
      [],
      this.deployer
    );
  }

  async deployWETH9() {
    return await this.deployContract(
      artifacts.WETH9.abi,
      artifacts.WETH9.bytecode,
      [],
      this.deployer
    );
  }

  async deployRouter(factoryAddress, weth9Address) {
    return await this.deployContract(
      artifacts.SwapRouter.abi,
      artifacts.SwapRouter.bytecode,
      [factoryAddress, weth9Address],
      this.deployer
    );
  }

  async deployNFTDescriptorLibrary() {
    return await this.deployContract(
      artifacts.NFTDescriptor.abi,
      artifacts.NFTDescriptor.bytecode,
      [],
      this.deployer
    );
  }

  async deployPositionDescriptor(
    nftDescriptorLibraryAddress,
    weth9Address
  ) {
    const linkedBytecode = linkLibraries(
      {
        bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
        linkReferences: {
          "NFTDescriptor.sol": {
            NFTDescriptor: [
              {
                length: 20,
                start: 1681,
              },
            ],
          },
        },
      },
      {
        NFTDescriptor: nftDescriptorLibraryAddress,
      }
    );

    return (await this.deployContract(
      artifacts.NonfungibleTokenPositionDescriptor.abi,
      linkedBytecode,
      [weth9Address, ethers.encodeBytes32String('ETH')],
      this.deployer
    ));
  }

  async deployNonfungiblePositionManager(
    factoryAddress,
    weth9Address,
    positionDescriptorAddress
  ) {
    return await this.deployContract(
      artifacts.NonfungiblePositionManager.abi,
      artifacts.NonfungiblePositionManager.bytecode,
      [factoryAddress, weth9Address, positionDescriptorAddress],
      this.deployer
    );
  }

   async deployContract(
    abi,
    bytecode,
    deployParams,
    actor
  ) {
    const factory = new ContractFactory(abi, bytecode, actor);
    return await factory.deploy(...deployParams);
  }
}

module.exports = {
  UniswapV3Deployer
}