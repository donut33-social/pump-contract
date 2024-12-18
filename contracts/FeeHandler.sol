// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interface/IPump.sol";
import "./interface/INonfungiblePositionManager.sol";
import "./interface/IToken.sol";

contract FeeHandler is IERC721Receiver {
    event Received(address indexed from, uint256 tokenId);
    event NewLock(uint256 tokenId);
    event ClaimedFees(
        uint256 tipTagFee0,
        uint256 tipTagFee1,
        uint256 salesmanFee0,
        uint256 salesmanFee1
    );

    address public beneficiary;
    address public token;
    IPump public manager;
    IERC721 public ERC721;
    uint256 public tokenId;

    constructor(
        address pump,
        address token_,
        address position,
        uint256 token_id
    ) {
        manager = IPump(pump);
        ERC721 = IERC721(position);
        tokenId = token_id;
        token = token_;
        emit NewLock(token_id);
    }

    receive() external payable virtual {}

    function handleFee() external {
        uint256[2] memory fee = manager.getFeeRatio();
        uint256 tipTagFee = fee[0] * 10000 / (fee[0] + fee[1]);

        IERC20 token0 = IERC20(token);
        IERC20 token1 = IERC20(manager.getWETH());

        INonfungiblePositionManager positionManager 
            = INonfungiblePositionManager(manager.getNonfungiblePositionManager());

        positionManager
            .collect(
                INonfungiblePositionManager.CollectParams({
                    recipient: address(this),
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max,
                    tokenId: tokenId
                })
            );

        uint256 amount0 = token0.balanceOf(address(this));
        uint256 amount1 = token1.balanceOf(address(this));

        uint256 tipTagFee0 = amount0 * tipTagFee / 10000;
        uint256 tipTagFee1 = amount1 * tipTagFee / 10000;

        uint256 salesmanFee0 = amount0 - tipTagFee0;
        uint256 salesmanFee1 = amount1 - tipTagFee1;

        token0.transfer(manager.getFeeReceiver(), tipTagFee0);
        token0.transfer(IToken(token).getIPShare(), salesmanFee0);

        token1.transfer(manager.getFeeReceiver(), tipTagFee1);
        token1.transfer(IToken(token).getIPShare(), salesmanFee1);

        emit ClaimedFees(
            tipTagFee0,
            tipTagFee1,
            salesmanFee0,
            salesmanFee1
        );
    }

    function onERC721Received(
        address,
        address from,
        uint256 id,
        bytes calldata data
    ) external override returns (bytes4) {
        emit Received(from, id);
        return IERC721Receiver.onERC721Received.selector;
    }
}