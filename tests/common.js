const { ethers } = require('hardhat')

async function deployFactory() {
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

module.exports = {
    deployFactory
}