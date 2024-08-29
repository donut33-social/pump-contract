// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "./interface/IPump.sol";
import "./Token.sol";
import "./interface/IIPShare.sol";
// import "hardhat/console.sol";

contract Pump is Ownable, Nonces, IPump {
    address private ipshare;
    uint256 public createFee = 5 ether;
    uint256 private claimFee = 0.5 ether;
    address private feeReceiver;
    address private claimSigner;
    uint256 private lockTime = 3 * 86400;
    uint256[2] private feeRatio;  // 0: to tiptag; 1: to salesman

    mapping(address => bool) public createdTokens;
    mapping(string => bool) public createdTicks;

    uint256 public totalTokens;

    constructor(address _ipshare, address _feeReceiver) Ownable(msg.sender) {
        ipshare = _ipshare;
        feeReceiver = _feeReceiver;
        feeRatio = [100, 100];
        claimSigner = msg.sender;
    }

    receive() external payable {}

    // admin function
    function adminChangeIPShare(address _ipshare) public onlyOwner {
        emit IPShareChanged(ipshare, _ipshare);
        ipshare = _ipshare;
    }

    function adminChangeCreateFee(uint256 _createFee) public onlyOwner {
        if (_createFee > 500 ether) {
            revert TooMuchFee();
        }
        emit CreateFeeChanged(createFee, _createFee);
        createFee = _createFee;
    }

    function adminChangeFeeRatio(uint256[2] calldata ratios) public onlyOwner {
        if (ratios[0] > 9000 || ratios[1] > 9000) {
            revert TooMuchFee();
        }
        feeRatio = ratios;
        emit FeeRatiosChanged(ratios[0], ratios[1]);
    }

    function adminChangeClaimSigner(address signer) public onlyOwner {
        emit ClaimSignerChanged(claimSigner, signer);
        claimSigner = signer;
    }

    function adminChangeFeeAddress(address _feeReceiver) public onlyOwner {
        emit FeeAddressChanged(feeReceiver, _feeReceiver);
        feeReceiver = _feeReceiver;
    }

    function adminChangeLockTime(uint256 _lockTime) public onlyOwner {
        emit LockTimeChanged(lockTime, _lockTime);
        lockTime = _lockTime;
    }

    function getIPShare() public override view returns (address) {
        return ipshare;
    }

    function getFeeReceiver() public override view returns (address) {
        return feeReceiver;
    }

    function getLockTime() public override view returns (uint256) {
        return lockTime;
    }

    function getFeeRatio() public override view returns (uint256[2] memory) {
        return feeRatio;
    }
    function getClaimFee() public override view returns (uint256) {
        return claimFee;
    }

    function getClaimSigner() public override view returns (address) {
        return claimSigner;
    }

    function createToken(string calldata tick) public override payable returns (address) {
        if (createdTicks[tick]) {
            revert TickHasBeenCreated();
        }
        createdTicks[tick] = true;

        // check user created ipshare
        address creator = tx.origin;
        
        if (!IIPShare(ipshare).ipshareCreated(creator)) {
            // create ipshare
            IIPShare(ipshare).createShare(creator);
        }

        // cost fee
        if (createFee != 0 && msg.value < createFee) {
            revert InsufficientCreateFee();
        }
        (bool success, ) = feeReceiver.call{value: createFee}("");
        if (!success) {
            revert InsufficientCreateFee();
        }
        // if (msg.value > createFee) {
        //     // refund asset
        //    (bool success, ) = msg.sender.call{value: msg.value - createFee}("");
        //     if (!success) {
        //         revert RefundFail();
        //     }
        // }

        // bytes32 salt;
        // unchecked {
        //     salt = keccak256(abi.encodePacked(tick, _useNonce(address(creator)), address(creator)));
        // }

        Token token = new Token();
        address instance  = address(token);

        // address instance = Clones.cloneDeterministic(tokenImplementation, salt);
        emit NewToken(tick, instance, creator);
        
        token.initialize(
            address(this),
            creator,
            tick
        );

        if (msg.value > createFee) {
            (bool success1, ) = instance.call{
                value: msg.value - createFee
            }(abi.encodeWithSignature("buyToken(uint256,address,uint16,address)", 0, creator, 0, creator));
            if (!success1) {
                revert PreMineTokenFail();
            }
            uint256 leftValue = address(this).balance;
            if (leftValue > 0) {
                (bool success2, ) = msg.sender.call{value: leftValue}("");
                if (!success2) {
                    revert RefundFail();
                }
            }
        }
        createdTokens[instance] = true;
        totalTokens += 1;
        // console.log(instance);
        return instance;
    }
}
