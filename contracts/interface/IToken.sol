// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

interface IToken {
    error TokenNotListed();
    error TokenListed();
    error IPShareNotCreated();
    error TokenInitialized();
    error ClaimOrderExist();
    error InvalidSignature();
    error InvalidClaimAmount();
    error InvalidClaimer();

    event ClaimDistributedReward(uint256 indexed timestamp, uint256 indexed amount);
    event UserClaimReward(uint256 indexed orderId, address indexed user, uint256 indexed amount);

    function initialize(
        address manager_,
        address ipshareSubject_,
        string memory tick_
    ) external;
    
}
