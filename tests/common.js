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
        subject,
        socialContract
     } = await deployIPShare()
     const uniContracts = await UniswapV3Deployer.deploy(owner);

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
        socialContract
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
        subject,
        socialContract
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
        subject,
        socialContract
      };
}

async function deployCurationRewards() {

}

module.exports = {
    deployPumpFactory,
    deployIPShare,
    deployCurationRewards
}