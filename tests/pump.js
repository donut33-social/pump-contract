const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
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
    let uniswapV2Router02
    
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

    async function getFeeRatio() {
        const r = await pump.getFeeRatio()
        return r
    }

    describe("Create token", function () {
        it("Can create token use factory", async () => {
            let token = await pump.createToken('T1', { value: parseAmount(0.01) })
            token = await ethers.getContractAt('Token', '0xea8f1a548075307ba5287a29fb2465ac634ed92e')
            const imp = await pump.tokenImplementation(); // 0xa16E02E87b7454126E5E10d957A927A7F5B5d2be
            expect(await token.name()).to.equal('T1')
            expect(await token.symbol()).to.equal('T1')
            expect(await token.decimals()).to.equal(18)
        })

        it("Everyone can create more than one token", async () => {
            let token1 = await pump.connect(alice).createToken('T1', { value: parseAmount(0.01)}); // 0x8abe34a3bc8eb3b8d486ebf0c216d9bb7e4c5eab
            let token2 = await pump.connect(alice).createToken('T2', { value: parseAmount(0.01)}); // 0x74831469a345d15e1279a03d385d547b171a4e37

            token1 = await ethers.getContractAt('Token', '0x8abe34a3bc8eb3b8d486ebf0c216d9bb7e4c5eab');
            token2 = await ethers.getContractAt('Token', '0x74831469a345d15e1279a03d385d547b171a4e37')

            expect(await token1.name()).to.equal('T1')
            expect(await token1.symbol()).to.equal('T1')

            expect(await token2.name()).to.equal('T2')
            expect(await token2.symbol()).to.equal('T2')

            expect(await pump.totalTokens()).to.equal(2);
            expect(await pump.createdTokens('0x8abe34a3bc8eb3b8d486ebf0c216d9bb7e4c5eab')).to.equal(true);
            expect(await pump.createdTokens('0x74831469a345d15e1279a03d385d547b171a4e37')).to.equal(true);
            expect(await pump.createdTokens('0xa16E02E87b7454126E5E10d957A927A7F5B5d2be')).to.equal(false);

            expect(await token1.totalSupply()).eq(parseAmount(10000000));
            expect(await token1.balanceOf('0x8abe34a3bc8eb3b8d486ebf0c216d9bb7e4c5eab')).eq(parseAmount(10000000));
        })
    })

    describe('Token before list', function () {
        let token;
        beforeEach(async () => {
            token = await pump.createToken('T1', { value: parseAmount(0.01) })
            token = await ethers.getContractAt('Token', '0xea8f1a548075307ba5287a29fb2465ac634ed92e')
            await token.setUniForTest(weth, uniswapV2Factory, uniswapV2Router02);
            // console.log(1, weth.target, uniswapV2Factory.target, uniswapV2Router02.target)
        })

        async function getBuyFeeData(buyEthAmount) {
            const feeRatio = await getFeeRatio()
            const tipTapFee = buyEthAmount * feeRatio[0] / 10000n;
            const ipshareFee = buyEthAmount * feeRatio[1] / 10000n;
            const buyFund = buyEthAmount - tipTapFee - ipshareFee;
            return {
                tipTapFee,
                ipshareFee,
                buyFund,
                feeRatio
            }
        }

        async function getSellFeeData(sellAmount) {
            const feeRatio = await getFeeRatio()
            let sellFund = await token.getSellPrice(sellAmount)
            const tipTapFee = sellFund * feeRatio[0] / 10000n;
            const ipshareFee = sellFund * feeRatio[1] / 10000n; 
            const receiveEth = sellFund - tipTapFee - ipshareFee;
            return {
                feeRatio,
                sellFund,
                tipTapFee,
                ipshareFee,
                receiveEth
            }
        }

        it("Can trade with bonding curve", async () => {
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)

            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, {
                value: buyFund
            })).to.changeTokenBalance(token, alice, buyAmount)
            
            await expect(token.connect(alice).sellToken(parseAmount(100), 0, ethers.ZeroAddress, 0))
                .to.changeTokenBalance(token, alice, parseAmount(-100))
            // console.log(44, await token.balanceOf(alice))
        })

        it("Check event", async () => {
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)

            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, {
                value: buyFund
            })).to.emit(token, 'Trade')
            .withArgs(alice, true, buyAmount, buyFund, feeInfo.tipTapFee, feeInfo.ipshareFee)
            .to.emit(ipshare, 'Trade')


            const sellAmount = parseAmount(100)
            const sellFeeInfo = await getSellFeeData(sellAmount)
            await expect(token.connect(alice).sellToken(sellAmount, 0, ethers.ZeroAddress, 0))
                .to.emit(token, 'Trade')
                .withArgs(alice, false, sellAmount, sellFeeInfo.sellFund, sellFeeInfo.tipTapFee, sellFeeInfo.ipshareFee)
        })

        it("Cannt trade with other users", async () => {
            await token.connect(bob).buyToken(parseAmount(1000), ethers.ZeroAddress, 0, {
                value: parseAmount(0.1)
            })
            await expect(token.connect(bob).transfer(alice, parseAmount(100)))
                .to.revertedWithCustomError(token, 'TokenNotListed');
        })

        it("Can transfer back to token self", async () => {
            await token.connect(bob).buyToken(parseAmount(1000), ethers.ZeroAddress, 0, {
                value: parseAmount(0.1)
            })
            await expect(token.connect(bob).transfer(token.target, parseAmount(100)))
                .to.changeTokenBalance(token, bob, parseAmount(-100))
        })

        it("will revert if out of slippage", async () => {
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            let buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)

            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 300, {
                value: buyFund + parseAmount(0.000001)
            })).to.emit(token, 'Trade')

            const sellAmount = parseAmount(100)
            const sellFeeInfo = await getSellFeeData(sellAmount)
            await expect(token.connect(alice).sellToken(sellAmount, 0, ethers.ZeroAddress, 0))
                .to.emit(token, 'Trade')
                .withArgs(alice, false, sellAmount, sellFeeInfo.sellFund, sellFeeInfo.tipTapFee, sellFeeInfo.ipshareFee)

            buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)
            // lower slippage will fail
            await expect(token.connect(alice).buyToken(buyAmount * 110n / 100n, ethers.ZeroAddress, 900, {
                value: buyFund
            })).to.revertedWithCustomError(token, 'OutOfSlippage')
            // enough slippage will ok
            await expect(token.connect(alice).buyToken(buyAmount * 110n / 100n, ethers.ZeroAddress, 1100, {
                value: buyFund
            })).to.emit(token, 'Trade')
        })

        it("Can claim social reward", async () => {
            const timestamp = Date.now()
            expect(await token.startTime()).eq(parseInt((timestamp - timestamp % 86400000) / 1000));


        })
    })

    describe('Token list', function () {

    })
})