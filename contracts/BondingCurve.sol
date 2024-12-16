// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;
import './UniswapV2/FullMath.sol';
import './interface/IPump.sol';

// y = (1 / a) * (x + b) ^ 2 + c
// y = (x + 3 * 10^25) ^ 2 / (3.3303167420814 * 10 ^ 44) + 1266968325
// collect 5.7 eth to the bonding curve pool
// the initial price is 1.8 / (10 ^ 9)
// the finally price of bonding curve pool is 2.2 / (10 ^ 8)
// total sell 650000000 tokens in bonding curve pool
contract BondingCurve {
    // y = x^2 / a - x / b + 1 / c
    uint256 private a = 3.3303167420814 * (10 ** 44);
    uint256 private b = 3 * (10 ** 25);
    uint256 private c = 1266968325;
    uint256 private divisor = 10000;
    address private manager;

    constructor(uint256 _a, uint256 _b, uint256 _c, address _manager) {
        a = _a;
        b = _b;
        c = _c;
        manager = _manager;
    }

    /**
     * calculate the eth price when user buy amount tokens
     */
    function getPrice(uint128 supply, uint128 amount) public pure returns (uint256) {
        supply = supply + b;
        amount = amount + b;
        uint256 m = FullMath.mulDiv(amount, amount, a) + FullMath.mulDiv(amount * 3, supply, a) + FullMath.mulDiv(3 * supply, supply, a);
        return FullMath.mulDiv(m, amount, 3e36) + FullMath(amount, c, 1e36);
    }

    function getSellPrice(uint128 supply, uint128 amount) public view returns (uint256) {
        return getPrice(supply - amount, amount);
    }

    function getBuyPriceAfterFee(uint128 supply, uint128 amount) public view returns (uint256) {
        uint256 price = getPrice(supply, amount);
        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        return ((price * divisor) / (divisor - feeRatio[0] - feeRatio[1]));
    }

    function getSellPriceAfterFee(uint128 supply, uint128 amount) public view returns (uint256) {
        uint256 price = getSellPrice(supply, amount);
        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        return (price * (divisor - feeRatio[0] - feeRatio[1])) / divisor;
    }

    function _getBuyAmountByValue(uint256 ethAmount) private view returns (uint256) {
        return (floorCbrt(ethAmount * priceParam * 3e36 + 
                (bondingCurveSupply / 100) ** 3) - (bondingCurveSupply / 100)) 
                * 100;
    }

    function _getBuyAmountByValue(uint256 bondingCurveSupply, uint256 ethAmount) private view returns (uint256) {
        return (floorCbrt(ethAmount * a * 3e36 + 
                bondingCurveSupply ** 3) - bondingCurveSupply) 
                - b;
    }

    function getBuyAmountByValue(uint256 ethAmount) public view returns (uint256) {
        uint256 amount = _getBuyAmountByValue(ethAmount);
        if (amount + bondingCurveSupply > bondingCurveTotalAmount) {
            return bondingCurveTotalAmount - bondingCurveSupply;
        }
        return amount;
    }

    function getETHAmountToDex() public view returns (uint256) {
        return getBuyPriceAfterFee(bondingCurveTotalAmount - bondingCurveSupply);
    }

    function floorCbrt(uint256 n) internal pure returns (uint256) {
        unchecked {
            uint256 x = 0;
            for (uint256 y = 1 << 255; y > 0; y >>= 3) {
                x <<= 1;
                uint256 z = 3 * x * (x + 1) + 1;
                if (n / y >= z) {
                    n -= y * z;
                    x += 1;
                }
            }
            return x;
        }
    }
}
