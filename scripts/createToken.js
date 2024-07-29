const { ethers } = require('hardhat')

const PumpContract = '0xECf36295a20B018EDF8A9eE4a7D82a2C97EF84A5'

async function main() {
    const [signer] = await ethers.getSigners();
    const pump = await ethers.getContractAt('Pump', PumpContract, signer)
    const tx = await pump.createToken('FOMOa', {
        value: ethers.parseEther('0.00005')
    });
    console.log(tx.hash)
    await tx.wait();
}

main().catch(console.error).finally(process.exit)