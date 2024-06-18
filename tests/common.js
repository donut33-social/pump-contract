const { ethers } = require("hardhat");
const { parseAmount } = require("./helper");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { UniswapV3Deployer } = require('./vendor/UniswapV3Deployer')

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
     
       // deploy weth
    const wethFactory = await ethers.getContractFactory("WETH9");
    const weth = await wethFactory.deploy();

        // deploy dex
    const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
    const uniswapV2Factory = await UniswapV2Factory.deploy(dexFeeDestination);
    await uniswapV2Factory.connect(dexFeeDestination).setFeeTo(dexFeeDestination);

    let initCode = await uniswapV2Factory.pairCodeHash();
    // need set this code to pairFor(function) of UniswapV2Library
    initCode = initCode.replace('0x', '');
    console.log('init code:', initCode);

    // deploy router
    let routerFactory = await ethers.getContractFactory("UniswapV2Router02");
    let uniswapV2Router02 = await routerFactory.deploy(uniswapV2Factory, weth);

    const Factory = await ethers.getContractFactory('Pump');
    const pump = await Factory.deploy(ipshare, donutFeeDestination);
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
        weth,
        uniswapV2Factory,
        uniswapV2Router02
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
    console.log('ipsharef, ', ipshare.target);
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

async function deployCurationRewards() {

}

module.exports = {
    deployPumpFactory,
    deployIPShare,
    deployCurationRewards
}