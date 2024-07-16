const { ethers } = require('hardhat')

const PumpContract = '0x9846Cd626C2f6549978aA190eD884993D4AA86BB'

async function main() {
    const [signer] = await ethers.getSigners();
    const pump = await ethers.getContractAt('Pump', PumpContract, signer)
    const tx = await pump.createToken('FOMO', {
        value: ethers.parseEther('0.0005')
    });
    console.log(tx.hash)
    await tx.wait();
}

main().catch(console.error).finally(process.exit)