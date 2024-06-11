// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

interface IToken {
    error TickHasBeenCreated();
    error TokenNotListed();
    function initialize(
        string memory tick_,
        address socialDistributionContract_,
        uint256 socialDistributionAmount_,
        uint256 maxSupply_
    ) external;
}
