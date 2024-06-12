const { ethers } = require("hardhat");
const { parseAmount } = require("./helper");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function deployPumpFactory() {
    const [
        owner,
        alice,
        bob,
        carol,
        socialContract
    ] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('Pump');
    const factory = await Factory.deploy(socialContract);
    return {
        owner,
        alice,
        bob,
        carol,
        factory,
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
        ftSubject
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
        subject,
        ftSubject
      };
}

async function deployCurationRewards() {

}

module.exports = {
    deployPumpFactory,
    deployIPShare,
    deployCurationRewards
}