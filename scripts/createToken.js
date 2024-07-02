const { ethers } = require('hardhat')

const PumpContract = '0xFe992EF5f73Ac289052F1742B918278a62686fD1'

async function main() {
    const [signer] = await ethers.getSigners();
    const pump = await ethers.getContractAt('Pump', PumpContract, signer)
    const tx = await pump.createToken('TEST', {
        value: ethers.parseEther('0.00005')
    });
    console.log(tx.hash)
    await tx.wait();
}

main().catch(console.error).finally(process.exit)