const { ethers } = require('hardhat')

const TokenContract = '0x90863715B81e1A950ff76cA65026b46e7dDa4d1D'

async function main() {
    const token = await ethers.getContractAt('Token', TokenContract)
    console.log(1, await token.balanceOf('0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac'))
    const tx = await token.sellToken(ethers.parseEther('6999990'), 0, ethers.ZeroAddress, 0)
    console.log(tx.hash)
    await tx.wait()
}

main().catch(console.error).finally(process.exit)