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
            uniswapV2Router02
        } = await loadFixture(deployPumpFactory));
    })

    describe('boding curve', function () {
        it('caculate buy amount of bonding curve', async () => {
            const res1 = await pump.getPrice(0n, parseAmount(1000000));
            const res2 = await pump.getPrice(0n, parseAmount(2000000));
            const res3 = await pump.getPrice(0n, parseAmount(5000000));
            const res4 = await pump.getPrice(0n, parseAmount(10000000));
            const res5 = await pump.getPrice(0n, parseAmount(100000000));
            const res6 = await pump.getPrice(0n, parseAmount(200000000));
            const res7 = await pump.getPrice(0n, parseAmount(500000000));
            const res8 = await pump.getPrice(0n, parseAmount(650000000));

            const res9 = await pump.getPrice(0n, parseAmount(1000000));
            const res10 = await pump.getPrice(parseAmount(1000000),   parseAmount(1000000));
            const res11 = await pump.getPrice(parseAmount(2000000),   parseAmount(3000000));
            const res12 = await pump.getPrice(parseAmount(5000000),   parseAmount(5000000));
            const res13 = await pump.getPrice(parseAmount(10000000),  parseAmount(10000000));
            const res14 = await pump.getPrice(parseAmount(20000000),  parseAmount(80000000));
            const res15 = await pump.getPrice(parseAmount(100000000), parseAmount(400000000));
            const res16 = await pump.getPrice(parseAmount(500000000), parseAmount(150000000));
            console.log(res1.toString() / 1e18, res2.toString() / 1e18, res3.toString() / 1e18, res4.toString() / 1e18, res5.toString() / 1e18,
                res6.toString() / 1e18, res7.toString() / 1e18, res8.toString() / 1e18)
            console.log(res9.toString() / 1e18, res10.toString() / 1e18, res11.toString() / 1e18, res12.toString() / 1e18, res13.toString() / 1e18,
                res14.toString() / 1e18, res15.toString() / 1e18, res16.toString() / 1e18)
        })

        it('caculate sell amount of bonding curve', async () => {
            const res1 = await pump.getSellPrice(parseAmount(1000000), parseAmount(1000000));
            const res2 = await pump.getSellPrice(parseAmount(2000000), parseAmount(2000000));
            const res3 = await pump.getSellPrice(parseAmount(5000000), parseAmount(5000000));
            const res4 = await pump.getSellPrice(parseAmount(10000000), parseAmount(10000000));
            const res5 = await pump.getSellPrice(parseAmount(100000000), parseAmount(100000000));
            const res6 = await pump.getSellPrice(parseAmount(200000000), parseAmount(200000000));
            const res7 = await pump.getSellPrice(parseAmount(500000000), parseAmount(500000000));
            const res8 = await pump.getSellPrice(parseAmount(650000000), parseAmount(650000000));
            console.log(res1.toString() / 1e18, res2.toString() / 1e18, res3.toString() / 1e18, res4.toString() / 1e18, res5.toString() / 1e18,
                res6.toString() / 1e18, res7.toString() / 1e18, res8.toString() / 1e18)
        })

        it('caculate buy amount of bonding curve', async () => {
            const res1 = await pump.getBuyAmountByValue(0n, parseAmount(0.00140286772));
            const res2 = await pump.getBuyAmountByValue(0n, parseAmount(0.00281148658166495));
            const res3 = await pump.getBuyAmountByValue(0n, parseAmount(0.007072086151254231));
            const res4 = await pump.getBuyAmountByValue(0n, parseAmount(0.014290327579344862));
            const res5 = await pump.getBuyAmountByValue(0n, parseAmount(0.029177420762386986));
            const res6 = await pump.getBuyAmountByValue(0n, parseAmount(0.17297813736471093));
            const res7 = await pump.getBuyAmountByValue(0n, parseAmount(0.4333946033215489));
            const res8 = await pump.getBuyAmountByValue(0n, parseAmount(4.546377500541374));
            console.log(res1.toString() / 1e18, res2.toString() / 1e18, res3.toString() / 1e18, res4.toString() / 1e18, res5.toString() / 1e18,
                res6.toString() / 1e18, res7.toString() / 1e18, res8.toString() / 1e18)


            
            const res9 = await pump.getBuyAmountByValue(0n, parseAmount(0.00140286772));
            const res10 = await pump.getBuyAmountByValue(parseAmount(1000000), parseAmount(0.001408618853710473));
            const res11 = await pump.getBuyAmountByValue(parseAmount(2000000), parseAmount(0.004260599569589271));
            const res12 = await pump.getBuyAmountByValue(parseAmount(5000000), parseAmount(0.007218241428090631));
            const res13 = await pump.getBuyAmountByValue(parseAmount(10000000), parseAmount(0.014290327579344862));
            const res14 = await pump.getBuyAmountByValue(parseAmount(20000000), parseAmount(0.14380071660232394));
            const res15 = await pump.getBuyAmountByValue(parseAmount(100000000), parseAmount(2.1312897788425706));
            const res16 = await pump.getBuyAmountByValue(parseAmount(500000000), parseAmount(2.242109584334092));
            console.log(res9.toString() / 1e18, res10.toString() / 1e18, res11.toString() / 1e18, res12.toString() / 1e18, res13.toString() / 1e18,
                res14.toString() / 1e18, res15.toString() / 1e18, res16.toString() / 1e18)
        })
    })
})