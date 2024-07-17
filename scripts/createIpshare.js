const { ethers } = require('hardhat')

const IPShareContract = '0xeBB703Be7B200027e0Ef4185ccE7aEE293b2B4ab'

async function main() {
    const [signer] = await ethers.getSigners();
    console.log(22, signer.address)
    const ipshare = await ethers.getContractAt('IPShare', IPShareContract, signer);
    console.log(33, await ipshare.ipshareCreated('0x76B713f30734450CE566C170Fda27E8dce63b1F6'))
    return
    const tx = await ipshare.createShare(signer.address);
    console.log(35, tx)
    await tx.wait()
    console.log('finished')
}

main().catch(console.error).finally(process.exit)