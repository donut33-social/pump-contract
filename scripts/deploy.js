const { ethers } = require('hardhat');

async function main() {
    console.log('start')
    const [signer] = await ethers.getSigners();
    console.log("deployer:", signer.address, 'balance:', await signer.provider.getBalance(signer.address), '\n', await signer.provider.getFeeData())
    // return;
    const ipshare = await ethers.deployContract('IPShare');
    console.log(1, ipshare.target)

    const pump = await ethers.deployContract('Pump', [ipshare.target, '0x06Deb72b2e156Ddd383651aC3d2dAb5892d9c048'])
    console.log(2, pump.target)
}

main().catch(error => {
    console.error(error)
}).finally(process.exit)