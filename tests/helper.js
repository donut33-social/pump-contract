const { ethers } = require("hardhat");

function parseAmount(amount) {
  return ethers.parseEther(amount.toString());
}

async function getEthBalance(user) {
  return ethers.provider.getBalance(user);
}

async function sendEth(sender, receiver, value) {
  await sender.sendTransaction({
    to: receiver.address,
    value
  })
}


module.exports = {
  parseAmount,
  getEthBalance,
  sendEth
}