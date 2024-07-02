const { ethers } = require('hardhat')

const TokenContract = '0x99baced155b80f65f366692d5f2d414e13007a1d'

async function main() {
    const token = await ethers.getContractAt('Token', TokenContract)
    const tx = await token.buyToken(ethers.parseEther('10'), ethers.ZeroAddress, 0, {
        value: ethers.parseEther('0.0001')
    })
    console.log(tx.hash)
    await tx.wait()
}

main().catch(console.error).finally(process.exit)