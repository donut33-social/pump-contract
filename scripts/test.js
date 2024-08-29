const { ethers } = require('hardhat');

async function main() {
    console.log('start')
    const [signer] = await ethers.getSigners();
    console.log("deployer:", signer.address, 'balance:', await signer.provider.getBalance(signer.address), '\n', await signer.provider.getFeeData())

    const token = await ethers.getContractAt('UniswapV2Router02', 
        '0xd7d2Aa52f5491cB60ccD85b8c39935BF0baCd142'
    );
    console.log(1, token.target)
    const tx = await token.factory();
    console.log(4, tx)
}

main().catch(error => {
    console.error(error)
}).finally(process.exit)