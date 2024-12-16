// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;
import './UniswapV2/FullMath.sol';
import './interface/IPump.sol';

// 2.56023544514595e44, 2.33842833569031e+26
// y = (1 / a) * (x + b) ^ 2
// collect 6.84 eth to the bonding curve pool
// the initial price is 1.4 / (10 ^ 9)
// the finally price of bonding curve pool is 2 / (10 ^ 8)
// total sell 650000000 tokens in bonding curve pool
contract BondingCurve {
    uint256 private divisor = 10000;
    uint256 private bondingCurveTotalAmount = 650000000 ether;
    address private manager;

    constructor(address _manager) {
        manager = _manager;
    }

    /**
     * calculate the eth price when user buy amount tokens
     */
    function getPrice(uint256 supply, uint256 amount) public pure returns (uint256) {
        uint256 a = 3.90589077225667e43;
        uint256 b = 2.33842833569031e26;
        supply = supply + b;
        uint256 m = amount ** 2 + amount * 3 * supply + 3 * supply * supply;
        return FullMath.mulDiv(m / 1e8 , amount , 3e10 * a);
    }
    
    function getSellPrice(uint256 supply, uint256 amount) public pure returns (uint256) {
        return getPrice(supply - amount, amount);
    }

    function getBuyPriceAfterFee(uint256 supply, uint256 amount) public view returns (uint256) {
        uint256 price = getPrice(supply, amount);
        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        return ((price * divisor) / (divisor - feeRatio[0] - feeRatio[1]));
    }

    function getSellPriceAfterFee(uint256 supply, uint256 amount) public view returns (uint256) {
        uint256 price = getSellPrice(supply, amount);
        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        return (price * (divisor - feeRatio[0] - feeRatio[1])) / divisor;
    }

    function _getBuyAmountByValue(uint256 bondingCurveSupply, uint256 ethAmount) private pure returns (uint256) {
        uint256 a = 2.56023544514595 * (10 ** 44);
        uint256 b = 2.33842833569031 * (10 ** 26);
        return floorCbrt(ethAmount * a + 
                (bondingCurveSupply + b) ** 2 / 1e18 * (bondingCurveSupply + b) / 1e18) * 1e12
                 - bondingCurveSupply - 2 * b;
    }

    // function _getBuyAmountByValue(uint256 bondingCurveSupply, uint256 ethAmount) private view returns (uint256) {
    //     return (floorCbrt(ethAmount * a * 3e36 + 
    //             bondingCurveSupply ** 3) - bondingCurveSupply) 
    //             - b;
    // }

    function getBuyAmountByValue(uint256 bondingCurveSupply, uint256 ethAmount) public view returns (uint256) {
        uint256 amount = _getBuyAmountByValue(bondingCurveSupply, ethAmount);
        if (amount + bondingCurveSupply > bondingCurveTotalAmount) {
            return bondingCurveTotalAmount - bondingCurveSupply;
        }
        return amount;
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
