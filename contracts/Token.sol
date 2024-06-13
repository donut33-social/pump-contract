// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {ERC20} from "./solady/src/tokens/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IToken.sol";
import "./interface/IIPShare.sol";
import "./interface/IPump.sol";

contract Token is IToken, ERC20 {
    string private _name;
    string private _symbol;
    uint256 private constant secondPerDay = 86400;

    // distribute token total amount
    uint256 private constant socialDistributionAmount = 10000000;
    uint256 private constant bondingCurveTotalAmount = 7000000;
    uint256 private constant liquidityAmount = 2000000;

    // social distribution
    struct Distribution {
        uint256 amount;
        uint256 startTime;
        uint256 stopTime;
    }
    Distribution[] private distributionEras;
    uint256 public lastClaimTime;
    uint256 public pendingClaimSocialRewards;
    uint256 public totalClaimedSocialRewards;

    uint256 public startTime;
    mapping(uint256 => bool) private claimedOrder;

    // bonding curve
    uint256 public bondingCurveSupply;

    // state
    address private manager;
    address public ipshareSubject;
    bool public listed = false;
    bool initialized = false;

    function initialize(
        address manager_,
        address ipshareSubject_,
        string memory tick
    ) public override {
        if (initialized) {
            revert TokenInitialized();
        }
        initialized = true;
        manager = manager_;
        ipshareSubject = ipshareSubject_;
        _name = tick;
        _symbol = tick;
        startTime = block.timestamp - (block.timestamp % secondPerDay);
        _mint(address(this), socialDistributionAmount + bondingCurveTotalAmount + liquidityAmount);
    }

    /********************************** social distribution ********************************/
    function calculateReward(uint256 from, uint256 to) public view returns (uint256 rewards) {
        uint256 rewardedTime = from - 1;
        if (rewardedTime < startTime) {
            rewardedTime = startTime;
        }

        for (uint8 i = 0; i < distributionEras.length; i++) {
            if (rewardedTime > distributionEras[i].stopTime) {
                continue;
            }
            if (to <= distributionEras[i].stopTime) {
                rewards += (to - rewardedTime) * distributionEras[i].amount;
            } else {
                rewards += (distributionEras[i].stopTime - rewardedTime) * distributionEras[i].amount;
            }
        }
    }

    function getCurrentDistibutionEra() public view returns (Distribution memory era) {
        for (uint8 i = 0; i < distributionEras.length; i++) {
            if (block.timestamp >= distributionEras[i].startTime && block.timestamp < distributionEras[i].stopTime) {
                return distributionEras[i];
            }
        }
    }

    function getCurrentRewardPerDay() public view returns (uint256) {
        return getCurrentDistibutionEra().amount * secondPerDay;
    }

    // set distributed rewards can be claimed by user
    function claimPendingSocialRewards() public {
        // calculate rewards
        uint256 rewards = calculateReward(lastClaimTime, block.timestamp);
        if (rewards > 0){
            pendingClaimSocialRewards += rewards;
            lastClaimTime = block.timestamp;
            emit ClaimDistributedReward(block.timestamp, rewards);
        }
    }

    function userClaim(uint256 orderId, uint256 amount, address user, bytes calldata signature) public {
        address signer = IPump(manager).getClaimSigner();
        if (!listed) {
            revert TokenNotListed();
        }
        if (claimedOrder[orderId]) {
            revert ClaimOrderExist();
        }
        if (signature.length != 65) {
            revert InvalidSignature();
        }

        if (msg.sender != user) {
            revert InvalidClaimer();
        }

        bytes32 data = keccak256(
            abi.encodePacked(orderId, msg.sender, amount)
        );
        if (!_check(data, signature)) {
            revert InvalidSignature();
        }

        if (pendingClaimSocialRewards < amount) {
            claimPendingSocialRewards();
        }

        if (pendingClaimSocialRewards < amount) {
            revert InvalidClaimAmount();
        }

        transfer(msg.sender, amount);
    }

    /********************************** bonding curve ********************************/

    /********************************** to dex ********************************/


    /********************************** erc20 function ********************************/
    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    // only listed token can do erc20 transfer functions
    function transfer(address from, address to, uint256 amount) internal override {
        if (listed) {
            super.transfer(from, to, amount);
        }else if (from == address(this)) {
            super.transfer(from, to, amount);
        }else {
            revert TokenNotListed();
        }
    }

    function approve(address owner, address spender, uint256 amount) internal override {
        if (listed) {
            super.approve(owner, spender, amount);
        }else {
            revert TokenNotListed();
        }
    }

    function _check(
        bytes32 data,
        bytes calldata sign
    ) internal view returns (bool) {
        bytes32 r = abi.decode(sign[:32], (bytes32));
        bytes32 s = abi.decode(sign[32:64], (bytes32));
        uint8 v = uint8(sign[64]);
        if (v < 27) {
            if (v == 0 || v == 1) v += 27;
        }
        bytes memory profix = "\x19Ethereum Signed Message:\n32";
        bytes32 info = keccak256(abi.encodePacked(profix, data));
        address addr = ecrecover(info, v, r, s);
        return addr == signAddress;
    }
}
