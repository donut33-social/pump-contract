const { ethers } = require("hardhat");
const { parseAmount } = require("./helper");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { UniswapV3Deployer } = require("./vendor/UniswapV3Deployer");

async function deployPumpFactory() {
    const {
        ipshare,
        donut,
        owner,
        alice,
        bob,
        carol,
        buyer,
        donutFeeDestination,
        dexFeeDestination,
        subject
     } = await deployIPShare()

    const res = await UniswapV3Deployer.deploy(owner);
     
    //    // deploy weth
    // const wethFactory = await ethers.getContractFactory("WETH9");
    // const weth = await wethFactory.deploy();

    //     // deploy dex
    // const UniswapV3Factory = await ethers.getContractFactory("UniswapV3Factory");
    // const uniswapV3Factory = await UniswapV3Factory.deploy();
    // uniswapV3Factory.deployed();
    
    // const PositionManager = await ethers.getContractFactory("NonfungiblePositionManager");
    // const positionManager = await PositionManager.deploy(uniswapV3Factory, weth);
    // positionManager.deployed();

    const Factory = await ethers.getContractFactory('Pump');
    const pump = await Factory.deploy(ipshare, donutFeeDestination, res.weth9, res.positionManager, res.factory);

    const TestERC20 = await ethers.getContractFactory('TestERC20');
    const testERC20 = await TestERC20.deploy();
    return {
        ipshare,
        donut,
        owner,
        alice,
        bob,
        carol,
        buyer,
        donutFeeDestination,
        dexFeeDestination,
        subject,
        pump,
        weth: res.weth9,
        uniswapV3Factory: res.factory,
        positionManager: res.positionManager,
        testERC20,
        artifacts: res.artifacts
    }
}

async function deployIPShare() {
    const [
        owner, 
        alice, 
        bob, 
        carol, 
        donut, 
        buyer, 
        donutFeeDestination, 
        dexFeeDestination,
        subject
    ] = await ethers.getSigners();

    const ipshareFactory = await ethers.getContractFactory('IPShare');
    const ipshare = await ipshareFactory.deploy();
    await ipshare.adminSetDonutFeeDestination(donutFeeDestination);
    return {
        // contracts
        ipshare,
        donut,
        // users
        owner,
        alice,
        bob,
        carol,
        buyer,
        // fee receivers
        donutFeeDestination,
        dexFeeDestination,
        subject
      };
}


module.exports = {
    deployPumpFactory,
    deployIPShare
}