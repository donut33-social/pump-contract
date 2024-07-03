const { ethers } = require('hardhat')

const TokenContract = '0xAeDbdD8E25e5134Bd076DAD86b117B6F025479FB'

async function main() {
    const [signer] = await ethers.getSigners();
   
    const token = await ethers.getContractAt('Token', TokenContract)
    console.log(await token.symbol())
    const tx = await token.buyToken(ethers.parseEther('1000'), ethers.ZeroAddress, 0, '0x4288DbFc78fFA002C21AfD130Fc2461783C5c4C2', {
        value: ethers.parseEther('0.00001')
    })
    console.log(tx.hash)
    await tx.wait()
}

main().catch(console.error).finally(process.exit)