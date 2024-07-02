const { ethers } = require('hardhat')

const PumpContract = '0xF21649D901A082772Bd7B5d5eD5039C7a43A5789'

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