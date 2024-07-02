const { ethers } = require('hardhat')

const TokenContract = '0xcc842ca5024492ea44d1ab4f61af0f0f4c5b33f1'

async function main() {
    const token = await ethers.getContractAt('Token', TokenContract)
    const tx = await token.sellToken(ethers.parseEther('5'), 0, ethers.ZeroAddress, 0)
    console.log(tx.hash)
    await tx.wait()
}

main().catch(console.error).finally(process.exit)