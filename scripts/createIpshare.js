const { ethers } = require('hardhat')

const IPShareContract = '0x183434ba0726b244521cB1C46AE5C90538146db8'

async function main() {
    const [signer] = await ethers.getSigners();
    const ipshare = await ethers.getContractAt('IPShare', IPShareContract, signer);
    const tx = await ipshare.createShare(signer.address);
    console.log(35, tx)
    await tx.wait()
    console.log('finished')
}

main().catch(console.error).finally(process.exit)