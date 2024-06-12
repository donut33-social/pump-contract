const { ethers } = require("hardhat");

function parseAmount(amount) {
  return ethers.parseEther(amount.toString());
}

async function getEthBalance(user) {
  return ethers.provider.getBalance(user);
}


module.exports = {
  parseAmount,
  getEthBalance
}