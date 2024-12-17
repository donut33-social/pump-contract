// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;
import './UniswapV2/FullMath.sol';
import './interface/IPump.sol';
import './solady/src/utils/FixedPointMathLib.sol';

// 2.56023544514595e44, 2.33842833569031e+26
// y = (1 / a) * (x + b) ^ 2
// collect 6.84 eth to the bonding curve pool
// the initial price is 1.4 / (10 ^ 9)
// the finally price of bonding curve pool is 2 / (10 ^ 8)
// total sell 650000000 tokens in bonding curve pool
contract BondingCurve {
    uint256 private divisor = 10000;
    address private manager;

    constructor(address _manager) {
        manager = _manager;
    }

    /**
     * calculate the eth price when user buy amount tokens
     */
    function getPrice(uint256 supply, uint256 amount) public pure returns (uint256) {
        uint256 a = FullMath.mulDiv(4.546377500541374 ether, 2 ** 192, 200000000 ether);
        uint256 sqrtPrice = FixedPointMathLib.sqrt(a);
        int256 tick = FixedPointMathLib.lnWad(int256(sqrtPrice * 1e18)) 
        / FixedPointMathLib.lnWad(int256(1.0001 * 1e18));
        return sqrtPrice;
        // uint256 a = 1_400_000_000;
        // uint256 b = 2.4442889787856833e26;
        // uint256 x = FixedPointMathLib.mulWad(a, b);
        // uint256 e1 = uint256(FixedPointMathLib.expWad(int256((supply + amount) * 1e18 / b)));
        // uint256 e2 = uint256(FixedPointMathLib.expWad(int256((supply) * 1e18 / b)));
        // return FixedPointMathLib.mulWad(e1 - e2, x);
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

    function getBuyAmountByValue(uint256 bondingCurveSupply, uint256 ethAmount) public pure returns (uint256) {
        uint256 a = 1_400_000_000;
        uint256 b = 2.4442889787856833e26;
        // b * ln(ethAmount / (a*b) + exp(bondingCurveSupply/b)) - bondingCurveSupply;
        uint256 ab = FixedPointMathLib.mulWad(a, b);
        uint256 sab = FixedPointMathLib.divWad(ethAmount, ab);
        uint256 e = uint256(FixedPointMathLib.expWad(int256(bondingCurveSupply * 1e18 / b)));
        uint256 ln = uint256(FixedPointMathLib.lnWad(int256(sab + e)));
        return FixedPointMathLib.mulWad(b, ln) - bondingCurveSupply;
    }
}
