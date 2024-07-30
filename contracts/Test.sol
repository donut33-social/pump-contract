// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {ERC20} from "./solady/src/tokens/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IToken.sol";
import "./interface/IIPShare.sol";
import "./interface/IPump.sol";
import "./interface/IUniswapV2Router02.sol";
import "./interface/IUniswapV2Factory.sol";

contract Test is ERC20 {
    function name() public pure override returns (string memory) {
        return 'test';
    }

    function symbol() public pure override returns (string memory) {
        return 'test';
    }

    bool listed = false;

    address private WETH = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    address private uniswapV2Factory = 0x6725F303b657a9451d8BA641348b6761A6CC7a17;
    address private uniswapV2Router02 = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;

    function test() public payable {
        // listed = true;
        uint256 liquidityAmount = 2000000 ether;
        _mint(address(this), liquidityAmount);
        _approve(address(this), uniswapV2Router02, liquidityAmount);

        // v2
        // create pair
        // IUniswapV2Factory factory = IUniswapV2Factory(uniswapV2Factory);
        IUniswapV2Router02 router = IUniswapV2Router02(uniswapV2Router02);

        // address pair = factory.createPair(address(this), router.WETH());
        router.addLiquidityETH{
            value: msg.value
        }(address(this), liquidityAmount, 0, 0, msg.sender, block.timestamp + 300);
    }

        function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        if (listed) {
            return super._beforeTokenTransfer(from, to, amount);
        } else if (from == address(this) || to == address(this) || from == address(0)) {
            return super._beforeTokenTransfer(from, to, amount);
        } else {
            
        }
    }
}