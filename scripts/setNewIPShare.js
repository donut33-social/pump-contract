const { ethers } = require('hardhat');

async function main() {
    console.log('start')
    const [signer] = await ethers.getSigners();
    console.log("deployer:", signer.address, 'balance:', await signer.provider.getBalance(signer.address), '\n', await signer.provider.getFeeData())
    // return;
    const pump = await ethers.getContractAt('Pump', '0x2752815C81D421d52cA4038c4ab9081A32685b50');
    const ipshare = await pump.adminChangeIPShare('0xb6eec8EaEAEd773F47265f743Db607eb547BD2Dc');
    console.log(1, pump.target)

    // const pump = await ethers.deployContract('Pump', [ipshare.target, '0x06Deb72b2e156Ddd383651aC3d2dAb5892d9c048'])
    // console.log(2, pump.target)
}

main().catch(error => {
    console.error(error)
}).finally(process.exit)