// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "./interface/IPump.sol";
import "./Token.sol";
import "hardhat/console.sol";

contract Pump is Ownable, Nonces, IPump {
    address public immutable tokenImplementation;
    uint256 public socialDistributionPercent = 500;
    address public socialDistributionContract;
    uint256 private denominator = 10000;
    uint256 public maxSupply = 23 ether;

    mapping(address => bool) public createdTokens;

    uint256 public totalTokens;

    constructor(address _socialDistributionContract) Ownable(msg.sender) {
        socialDistributionContract = _socialDistributionContract;
        tokenImplementation = address(new Token());
        string memory tick = 'Matrix';
        Token(tokenImplementation).initialize(
            tick,
            socialDistributionContract,
            (maxSupply * socialDistributionPercent) / denominator,
            maxSupply
        );
        emit NewToken(tick, tokenImplementation, msg.sender);
    }

    // admin function
    function adminChangeSocialDistributionContract(address _socialDistributionContract) public onlyOwner {
        if (_socialDistributionContract == address(0)) {
            revert CantBeZeroAddress();
        }
        emit SocialDistributionContractChanged(socialDistributionContract, _socialDistributionContract);
        socialDistributionContract = _socialDistributionContract;
    }

    function admintChangeSocialDistributionPercent(uint256 _socialDistributionPercent) public onlyOwner {
        if (_socialDistributionPercent > denominator) {
            revert CantSetSocialDistributionMoreThanTotalSupply();
        }
        emit SocialDistributionPercentageChanged(socialDistributionPercent, _socialDistributionPercent);
        socialDistributionPercent = _socialDistributionPercent;
    }

    function adminChangeMaxSupply(uint256 _maxSupply) public onlyOwner {
        emit MaxSupplyChanged(maxSupply, _maxSupply);
        maxSupply = _maxSupply;
    }

    function createToken(string calldata tick) external payable returns (address) {
        bytes32 salt;
        address creator = tx.origin;
        unchecked {
            salt = keccak256(abi.encodePacked(tick, _useNonce(address(creator)), address(creator)));
        }

        address instance = Clones.cloneDeterministic(tokenImplementation, salt);
        Token(instance).initialize(
            tick,
            socialDistributionContract,
            (maxSupply * socialDistributionPercent) / denominator,
            maxSupply
        );

        createdTokens[instance] = true;
        totalTokens += 1;
        emit NewToken(tick, instance, creator);
        console.log(instance);
        return instance;
    }
}
