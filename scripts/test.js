const { ethers } = require('hardhat');

async function main() {
    console.log('start')
    const [signer] = await ethers.getSigners();
    console.log("deployer:", signer.address, 'balance:', await signer.provider.getBalance(signer.address), '\n', await signer.provider.getFeeData())

    const token = await ethers.deployContract('Test');
    console.log(1, token.target)
    const tx = await token.test({
        value: ethers.parseEther('0.00001'),
        gasLimit: 3200000
    });
    console.log(4, tx.hash)
    await tx.wait();
}

main().catch(error => {
    console.error(error)
}).finally(process.exit)