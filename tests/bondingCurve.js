const { loadFixture, mine } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { expect } = require('chai');
const { deployPumpFactory, deployIPShare } = require('./common')
const { ethers } = require('hardhat')
const { parseAmount, getEthBalance } = require('./helper');

describe("Pump", function () {
    let owner;
    let alice;
    let bob;
    let socialContract;
    let ipshare;
    let pump;
    let weth;
    let uniswapV2Factory;
    let uniswapV2Router02;
    let bondingCurve;
    
    beforeEach(async () => {
        ({ 
            ipshare,
            donut,
            owner,
            alice,
            bob,
            carol,
            buyer,
            donutFeeDestination,
            dexFeeDestination,
            subject,
            pump,
            weth,
            uniswapV2Factory,
            uniswapV2Router02,
            bondingCurve
        } = await loadFixture(deployPumpFactory));
    })

    describe('boding curve', function () {
        it('caculate bonding curve', async () => {
            const res1 = await bondingCurve.getPrice(0n, parseAmount(1000000));
            const res2 = await bondingCurve.getPrice(0n, parseAmount(2000000));
            const res3 = await bondingCurve.getPrice(0n, parseAmount(5000000));
            const res4 = await bondingCurve.getPrice(0n, parseAmount(10000000));
            const res5 = await bondingCurve.getPrice(0n, parseAmount(100000000));
            const res6 = await bondingCurve.getPrice(0n, parseAmount(200000000));
            const res7 = await bondingCurve.getPrice(0n, parseAmount(500000000));
            const res8 = await bondingCurve.getPrice(0n, parseAmount(650000000));
            const res9 = await bondingCurve.getPrice(parseAmount(500000000), parseAmount(150000000));
            console.log(res1.toString() / 1e18, res2.toString() / 1e18, res3.toString() / 1e18, res4.toString() / 1e18, res5.toString() / 1e18,
                res6.toString() / 1e18, res7.toString() / 1e18, res8.toString() / 1e18, res9.toString() / 1e18)
        })
    })
})