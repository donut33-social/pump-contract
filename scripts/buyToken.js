const { ethers } = require('hardhat')

const TokenContract = '0x527F1505e184a5E5582a35109F34197CbD0c99c7'

async function main() {
    const [signer] = await ethers.getSigners();
   
    const token = await ethers.getContractAt('Token', TokenContract)
    console.log(await token.symbol())
    const tx = await token.buyToken(ethers.parseEther('100000'), ethers.ZeroAddress, 0, '0x76B713f30734450CE566C170Fda27E8dce63b1F6', {
        value: ethers.parseEther('0.00001')
    })
    console.log(tx.hash)
    await tx.wait()
}

main().catch(console.error).finally(process.exit)