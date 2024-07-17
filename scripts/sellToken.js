const { ethers } = require('hardhat')

const TokenContract = '0x527F1505e184a5E5582a35109F34197CbD0c99c7'

async function main() {
    const token = await ethers.getContractAt('Token', TokenContract)
    console.log(1, await token.balanceOf('0x76B713f30734450CE566C170Fda27E8dce63b1F6'))
    const tx = await token.sellToken(ethers.parseEther('10000'), 0, ethers.ZeroAddress, 0)
    console.log(tx.hash)
    await tx.wait()
}

main().catch(console.error).finally(process.exit)