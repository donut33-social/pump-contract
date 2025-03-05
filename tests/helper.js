const { ethers } = require("hardhat");

function parseAmount(amount) {
  return ethers.parseEther(amount.toString());
}

async function getEthBalance(user) {
  return ethers.provider.getBalance(user);
}

async function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

module.exports = {
  parseAmount,
  getEthBalance,
  sleep
}