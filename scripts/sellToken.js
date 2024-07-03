const { ethers } = require('hardhat')

const TokenContract = '0xAeDbdD8E25e5134Bd076DAD86b117B6F025479FB'

async function main() {
    const token = await ethers.getContractAt('Token', TokenContract)
    const tx = await token.sellToken(ethers.parseEther('5'), 0, ethers.ZeroAddress, 0)
    console.log(tx.hash)
    await tx.wait()
}

main().catch(console.error).finally(process.exit)