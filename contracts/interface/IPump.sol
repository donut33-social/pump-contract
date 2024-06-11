// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

interface IPump {
    // errors
    error CantBeZeroAddress();
    error CantSetSocialDistributionMoreThanTotalSupply();

    // events
    event NewToken(string indexed tick, address indexed token, address indexed creator);
    event SocialDistributionContractChanged(address indexed oldContract, address indexed newContract);
    event SocialDistributionPercentageChanged(uint256 indexed oldPercent, uint256 indexed newPercent);
    event MaxSupplyChanged(uint256 indexed oldMaxSupply, uint256 indexed newMaxSupply);
}