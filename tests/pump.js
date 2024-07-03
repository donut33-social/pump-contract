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

    async function getClaimSignature(tokenAddress, orderId, amount, user) {
        const message = ethers.solidityPackedKeccak256(['address', 'uint256', 'address', 'uint256'],
            [tokenAddress, orderId, user, amount]
        );
        return await owner.signMessage(ethers.toBeArray(message))
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

        it("will revert if provide insufficient create fee", async () => {
            await expect(pump.createToken('T1', {value: parseAmount(0.00003)}))
                .to.revertedWithCustomError(pump, 'InsufficientCreateFee')
        })

        it("Everyone can create more than one token", async () => {
            let token1 = await pump.connect(alice).createToken('T1', { value: parseAmount(0.00005)}); // 0x8abe34a3bc8eb3b8d486ebf0c216d9bb7e4c5eab
            let token2 = await pump.connect(alice).createToken('T2', { value: parseAmount(0.00005)}); // 0x74831469a345d15e1279a03d385d547b171a4e37

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
            token = await pump.createToken('T1', { value: parseAmount(0.00005) })
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

        it("Can buy token when create token", async () => {
            let imp = await pump.tokenImplementation();
            imp = await ethers.getContractAt('Token', imp)
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await imp.getBuyAmountByValue(feeInfo.buyFund)

            await pump.createToken('T2', { value: parseAmount(0.10005) })
            let token = await ethers.getContractAt('Token', '0xcd7a1ce5c281146e32d9f1c652dcda21e1eef7e4')
            expect(await token.balanceOf(owner)).eq(buyAmount)
        })

        it("Can trade with bonding curve", async () => {
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)

            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, alice, {
                value: buyFund
            })).to.changeTokenBalance(token, alice, buyAmount)
            
            await expect(token.connect(alice).sellToken(parseAmount(100), 0, ethers.ZeroAddress, 0))
                .to.changeTokenBalance(token, alice, parseAmount(-100))
        })

        it('Can buy token for otherone', async () => {
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)

            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, bob, {
                value: buyFund
            })).to.changeTokenBalance(token, bob, buyAmount)

            expect(await token.balanceOf(alice)).eq(0);
            
            await expect(token.connect(bob).sellToken(parseAmount(100), 0, ethers.ZeroAddress, 0))
                .to.changeTokenBalance(token, bob, parseAmount(-100))
        })

        it("Check event", async () => {
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)

            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, alice, {
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
            await token.connect(bob).buyToken(parseAmount(1000), ethers.ZeroAddress, 0, bob, {
                value: parseAmount(0.1)
            })
            await expect(token.connect(bob).transfer(alice, parseAmount(100)))
                .to.revertedWithCustomError(token, 'TokenNotListed');
        })

        it("Can transfer back to token self", async () => {
            await token.connect(bob).buyToken(parseAmount(1000), ethers.ZeroAddress, 0, bob, {
                value: parseAmount(0.1)
            })
            await expect(token.connect(bob).transfer(token.target, parseAmount(100)))
                .to.changeTokenBalance(token, bob, parseAmount(-100))
        })

        it("will revert if out of slippage", async () => {
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            let buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)

            // 0 slippage means not consider slippage
            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, alice, {
                value: buyFund
            })).to.emit(token, 'Trade')

            const sellAmount = parseAmount(100)
            const sellFeeInfo = await getSellFeeData(sellAmount)
            await expect(token.connect(alice).sellToken(sellAmount, 0, ethers.ZeroAddress, 0))
                .to.emit(token, 'Trade')
                .withArgs(alice, false, sellAmount, sellFeeInfo.sellFund, sellFeeInfo.tipTapFee, sellFeeInfo.ipshareFee)

            buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)
            // lower slippage will fail
            await expect(token.connect(alice).buyToken(buyAmount * 110n / 100n, ethers.ZeroAddress, 900, alice, {
                value: buyFund
            })).to.revertedWithCustomError(token, 'OutOfSlippage')
            // enough slippage will ok
            await expect(token.connect(alice).buyToken(buyAmount * 110n / 100n, ethers.ZeroAddress, 1100, alice, {
                value: buyFund
            })).to.emit(token, 'Trade')
        })

        it("The sellsman cant purchase token if he did not created ipshare", async () => {
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            let buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)

            await expect(token.connect(alice).buyToken(buyAmount, bob, 0, alice, {
                value: buyFund
            })).to.revertedWithCustomError(token, 'IPShareNotCreated')

            await token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, alice, {
                value: buyFund
            })
            await expect(token.connect(alice).sellToken(parseAmount(10), 0, bob, 0))
                .to.revertedWithCustomError(token, 'IPShareNotCreated')
        })

        it("Sellsman who created ipshare can purchase token", async () => {
            await ipshare.createShare(bob);
            const buyFund = parseAmount(0.1)

            const feeInfo = await getBuyFeeData(buyFund)
            let buyAmount = await token.getBuyAmountByValue(feeInfo.buyFund)

            // get ipshare fee
            const subjectFeePercent = await ipshare.subjectFeePercent();
            const donutFeePercent = await ipshare.donutFeePercent();
            const divisor = 10000n;

            await expect(token.connect(alice).buyToken(buyAmount, bob, 0, alice, {
                value: buyFund
            })).to.changeEtherBalances([
                alice,
                token,
                bob,
                ipshare,
                donutFeeDestination
            ],[
                -buyFund,
                buyFund * (divisor - feeInfo.feeRatio[0] - feeInfo.feeRatio[1]) / divisor,
                buyFund * feeInfo.feeRatio[1] / divisor * subjectFeePercent / divisor,
                buyFund * feeInfo.feeRatio[1] / divisor * (divisor - donutFeePercent - subjectFeePercent) / divisor,
                buyFund * (feeInfo.feeRatio[0]) / divisor + buyFund * feeInfo.feeRatio[1] / divisor * donutFeePercent / divisor
            ])
        })

        it("Cannt claim social reward", async () => {
            const timestamp = Date.now()
            expect(await token.startTime()).eq(parseInt((timestamp - timestamp % 86400000) / 1000));
            const claimAmount = parseAmount(100);
            const orderId = 23059723523125626n;
            const signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)
            await expect(token.connect(alice).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.01)
            }))
                .to.revertedWithCustomError(token, 'TokenNotListed')
        })

        it("Social curation reward calculation", async () => {
            // calculateReward
            const now = parseInt(Date.now() / 1000);
            const startTime = await token.startTime();
            expect(await token.calculateReward(23535, startTime + 10000n)).eq(parseAmount(1 * 10000));
            expect(await token.calculateReward(startTime, now)).eq(parseAmount(1 * (now - parseInt(startTime))));
            expect(await token.calculateReward(startTime + 10001n, startTime + 20000n)).eq(parseAmount(1 * 10000))
            
            // getCurrentDistibutionEra
            const currentEra = await token.getCurrentDistibutionEra()
            expect(currentEra[0]).eq(parseAmount(1))
            expect(currentEra[1]).eq(startTime)
            expect(currentEra[2]).eq(startTime + 86400n * 30n)

            // getCurrentRewardPerDay
            expect(await token.getCurrentRewardPerDay()).eq(parseAmount(86400n * 1n))
        })
    })

    describe('Token list', function () {
        let token;
        let feeRatio;
        beforeEach(async () => {
            token = await pump.createToken('T1', { value: parseAmount(0.00005) })
            token = await ethers.getContractAt('Token', '0xea8f1a548075307ba5287a29fb2465ac634ed92e')
            await token.setUniForTest(weth, uniswapV2Factory, uniswapV2Router02);
            feeRatio = await getFeeRatio();
            // console.log(1, weth.target, uniswapV2Factory.target, uniswapV2Router02.target)
        })

        it("Will refund ETH when use buy the tail token", async () => {
            const bondingAmount = parseAmount(7000000)
            const gb = await token.getETHAmountToDex() // 0.3572916666666667
            const p = await token.getPrice(bondingAmount, parseAmount(1)); //1.53125021875e-7
            // console.log(3, gb.toString()/1e18 ,p.toString() / 1e18)

            const needEth = gb;
            const ethBalanceBefore = await getEthBalance(alice);
            await expect(token.connect(alice).buyToken(bondingAmount, ethers.ZeroAddress, 0, alice, {
                value: needEth + 1000000n
            })).to.changeTokenBalances(token, [
                alice, token
            ], [
                bondingAmount,
                parseAmount(-9000000)
            ])
            // will refund left eths
            expect(await getEthBalance(alice)).lt(ethBalanceBefore - 1000000n)
        })

        it("The last buyer will make the liquidity pool too", async () => {
            let buyAmount = parseAmount(6000000)
            let needEth = await token.getBuyPriceAfterFee(buyAmount)
            await token.connect(bob).buyToken(buyAmount, ethers.ZeroAddress, 0, bob, {
                value: needEth
            })

            const balanceOfBob = await token.balanceOf(bob)
            // console.log('balance of bob', balanceOfBob)

            buyAmount = parseAmount(1000000)
            needEth = await token.getBuyPriceAfterFee(buyAmount)
            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, alice, {
                value: needEth
            })).to.changeTokenBalance(token, alice, parseAmount(7000000) - balanceOfBob)
        })

        it('will emit list event with the last buy', async () => {
            let buyAmount = parseAmount(6000000)
            let needEth = await token.getBuyPriceAfterFee(buyAmount)
            await token.connect(bob).buyToken(buyAmount, ethers.ZeroAddress, 0, bob, {
                value: needEth
            })

            const balanceOfBob = await token.balanceOf(bob)
            // console.log('balance of bob', balanceOfBob)

            buyAmount = parseAmount(1000000)
            needEth = await token.getBuyPriceAfterFee(buyAmount)
            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, alice, {
                value: needEth
            })).to.emit(token, 'TokenListedToDex');
        })

    })

    describe('After token list', function () {
        let token;
        let feeRatio;
        beforeEach(async () => {
            token = await pump.createToken('T1', { value: parseAmount(0.00005) })
            token = await ethers.getContractAt('Token', '0xea8f1a548075307ba5287a29fb2465ac634ed92e')
            await token.setUniForTest(weth, uniswapV2Factory, uniswapV2Router02);
            feeRatio = await getFeeRatio();
            let buyAmount = parseAmount(7100000)
            let needEth = await token.getBuyPriceAfterFee(buyAmount)
            await token.connect(bob).buyToken(buyAmount, ethers.ZeroAddress, 0, bob, {
                value: needEth
            })
        })

        it("Can trade token to everyone", async () => {
            await expect(token.connect(bob).transfer(alice, parseAmount(10000)))
                .to.changeTokenBalances(token, [
                    alice, bob
                ], [
                    parseAmount(10000), parseAmount(-10000)
                ])
            await expect(token.connect(alice).transfer(carol, parseAmount(1000)))
                .to.changeTokenBalances(token, [
                    alice, carol
                ], [
                    parseAmount(-1000), parseAmount(1000)
                ])
        })

        it("Can claim curation token", async () => {
            const pendingClaimSocialRewards = await token.pendingClaimSocialRewards();
            const totalClaimedSocialRewards = await token.totalClaimedSocialRewards();
            console.log(1, pendingClaimSocialRewards, totalClaimedSocialRewards)

            const timestamp = Date.now()
            expect(await token.startTime()).eq(parseInt((timestamp - timestamp % 86400000) / 1000));
            let claimAmount = parseAmount(100);
            let orderId = 23059723523125626n;
            let signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)
            await expect(token.connect(alice).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.0003)
            }))
                .to.emit(token, 'UserClaimReward')
                .withArgs(orderId, alice, claimAmount);

            orderId = 23852135483n;
            signature = await getClaimSignature(token.target, orderId, claimAmount, bob.address)
            await expect(token.connect(bob).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.0005)
            })).to.changeTokenBalances(token, [bob, token], [claimAmount, -claimAmount])
        })

        it('Will revert if the signature is valid', async () => {
            const claimAmount = parseAmount(100);
            const orderId = 23059723523125626n;
            const signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)
            await expect(token.connect(alice).userClaim(token, orderId, claimAmount, signature.replace('3', '5'), {
                value: parseAmount(0.222)
            }))
                .to.revertedWithCustomError(token, 'InvalidSignature')
        })

        it('will revert if insufficient claim fee', async () => {
            const claimAmount = parseAmount(100);
            const orderId = 23059723523125626n;
            const signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)
            await expect(token.connect(alice).userClaim(token, orderId, claimAmount, signature, {
                value: 100000000n
            })).to.revertedWithCustomError(token, 'CostFeeFail')
        })

        it('will refund the left fee back to user', async () => {
            const claimAmount = parseAmount(100);
            const orderId = 23059723523125626n;
            const signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)
            await expect(token.connect(alice).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.1)
            })).to.changeEtherBalance(alice, parseAmount(-0.000005))
        })

        it('will revert if the claim amount is greater than social pool', async () => {
            const claimAmount = parseAmount(10000000);
            const orderId = 23059723523125626n;
            const signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)
            await expect(token.connect(alice).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.002)
            }))
                .to.revertedWithCustomError(token, 'InvalidClaimAmount')
        })

        it('will revert if the order has been claimed', async () => {
            let claimAmount = parseAmount(100);
            let orderId = 23059723523125626n;
            let signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)
            await expect(token.connect(alice).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.0003)
            }))
                .to.emit(token, 'UserClaimReward')
                .withArgs(orderId, alice, claimAmount);

            await expect(token.connect(alice).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.0003)
            }))
                .to.revertedWithCustomError(token, 'ClaimOrderExist')

            claimAmount = parseAmount(1000);
            signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)
            await expect(token.connect(alice).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.0003)
            }))
                .to.revertedWithCustomError(token, 'ClaimOrderExist')
        })

        it('will revet if user use the token a signature to claim token b reward', async () => {
            let claimAmount = parseAmount(100);
            let orderId = 23059723523125626n;
            let signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)
            await expect(token.connect(bob).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.0003)
            }))
                .to.revertedWithCustomError(token, 'InvalidSignature')
        })

        it('Cannt trade with bonding curve', async () => {
            await expect(token.connect(alice).buyToken(parseAmount(1000), ethers.ZeroAddress, 0, alice, {
                value: parseAmount(0.01)
            })).to.revertedWithCustomError(token, 'TokenListed')

            await expect(token.connect(bob).sellToken(parseAmount(100), 0, ethers.ZeroAddress, 0))
                .to.revertedWithCustomError(token, 'TokenListed')
        })

        it("Can swap token with uniswap", async () => {
            const now = parseInt(Date.now() / 1000) + 10;
            await token.connect(bob).approve(uniswapV2Router02, parseAmount(100000000));
            await expect(uniswapV2Router02.connect(bob).swapExactTokensForETH(
                parseAmount(100000),
                0,
                [token, weth],
                alice,
                now
            )).to.changeTokenBalance(token, bob, parseAmount(-100000));

            // await expect(uniswapV2Router02.connect(bob).swapExactETHForTokens(
            //     parseAmount(1000),
            //     [weth, token],
            //     bob,
            //     now,
            //     {
            //         value: parseAmount(0.1)
            //     }
            // )).to.changeEtherBalance(token, bob, parseAmount(10000));
        })
    })
})