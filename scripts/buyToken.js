const { ethers } = require('hardhat')

const TokenContract = '0xcc842ca5024492ea44d1ab4f61af0f0f4c5b33f1'

async function main() {
    const token = await ethers.getContractAt('Token', TokenContract)
    console.log(await token.symbol())
    const tx = await token.buyToken(ethers.parseEther('10'), ethers.ZeroAddress, 0, {
        value: ethers.parseEther('0.0001')
    })
    console.log(tx.hash)
    await tx.wait()
}

main().catch(console.error).finally(process.exit)