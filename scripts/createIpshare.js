const { ethers } = require('hardhat')

const IPShareContract = '0xc610d07F7B40a0ee0bDaA40D188699d4a72B615F'

async function main() {
    const [signer] = await ethers.getSigners();
    const ipshare = await ethers.getContractAt('IPShare', IPShareContract, signer);
    const tx = await ipshare.createShare(signer.address);
    console.log(35, tx)
    await tx.wait()
    console.log('finished')
}

main().catch(console.error).finally(process.exit)