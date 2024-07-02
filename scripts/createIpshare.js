const { ethers } = require('hardhat')

const IPShareContract = '0xf6DDd65295Ca7A672C34043aa62f32C01FBfb29D'

async function main() {
    const [signer] = await ethers.getSigners();
    const ipshare = await ethers.getContractAt('IPShare', IPShareContract, signer);
    const tx = await ipshare.createShare(signer.address);
    console.log(35, tx)
    await tx.wait()
    console.log('finished')
}

main().catch(console.error).finally(process.exit)