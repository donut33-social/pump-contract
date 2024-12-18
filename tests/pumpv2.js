const { loadFixture, mine } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { expect } = require('chai');
const { deployPumpFactory, deployIPShare } = require('./common')
const { ethers } = require('hardhat')
const { parseAmount, getEthBalance, sleep } = require('./helper');
const { bigint } = require('hardhat/internal/core/params/argumentTypes');

describe("Pump", function () {
    let owner;
    let alice;
    let bob;
    let socialContract;
    let ipshare;
    let pump;
    let weth;
    let uniswapV3Factory;
    let positionManager
    let testERC20
    let artifacts
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
            uniswapV3Factory,
            positionManager,
            testERC20,
            artifacts
        } = await loadFixture(deployPumpFactory));
    })

    async function getFeeRatio() {
        const r = await pump.getFeeRatio()
        return r
    }

    async function getCreateFee() {
        return await pump.createFee()
    }

    async function createToken(deployer, tick, salt, createValue) {
        return new Promise(async (resolve, reject) => {
            try {
                pump.on('NewToken', (tick, token) => {
                    resolve({ token, tick })
                })
                await sleep(0.1)
                const trans = await pump.connect(deployer ?? owner).createToken(tick, salt[0], {
                    value: createValue
                });
                await pump.adminChangeClaimSigner(owner)
            } catch (error) {
                reject(error)
            }
        })
    }

    async function getClaimSignature(tokenAddress, orderId, amount, user) {
        const message = ethers.solidityPackedKeccak256(['address', 'uint256', 'address', 'uint256'],
            [tokenAddress, orderId, user, amount]
        );
        return await owner.signMessage(ethers.toBeArray(message))
    }

    describe("Uni v3", function () {
        it("should create pool", async function () {
            let pool = await uniswapV3Factory.createPool(testERC20, weth, 10000);
            let poolAddress = await uniswapV3Factory.getPool(testERC20, weth, 10000);
            expect(poolAddress).to.not.be.null;
            pool = await ethers.getContractAt(artifacts.UniswapV3Pool.abi, poolAddress);
            await pool.initialize(124523523544);
        })
    })

    describe("Create token", function () {
        let createValue;
        beforeEach(async () => {
            createValue = await getCreateFee();
        })

        it("should generate token address less than weth", async function () {
            for (let i = 0; i < 10; i++) {
                let salt = await pump.generateSalt(alice);
                const { token, tick } = await createToken(alice, 'T' + i, salt, createValue);
                expect(token).to.be.equal(salt[1]);
                expect(BigInt(token)).to.be.lessThan(BigInt(weth.target));
            }

            for (let i = 0; i < 10; i++) {
                let salt = await pump.generateSalt(bob);
                const { token, tick } = await createToken(bob, 'TB' + i, salt, createValue);
                expect(token).to.be.equal(salt[1]);
                expect(BigInt(token)).to.be.lessThan(BigInt(weth.target));
            }
        })

        it("Can not create same tick", async function () {
            let salt = await pump.generateSalt(alice);
            await createToken(alice, 'T1', salt, createValue); 
            salt = await pump.generateSalt(alice);
            await expect(pump.connect(alice).createToken('T1', salt[0]))
                .to.revertedWithCustomError(pump, 'TickHasBeenCreated');
        })
    })

    describe("Before list", function () {
        let token;
        let pair;
        let createFee;
        beforeEach(async () => {
            createFee = await getCreateFee()
            const salt = await pump.generateSalt(alice);
            token = await createToken(alice, 'T1', salt, createFee);
            token = await ethers.getContractAt('Token', token.token);
            pair = await token.pair();
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

        async function getBondingCurveSupply() {
            return await token.bondingCurveSupply()
        }

        it("Distribute social reward to pump", async () => {
            expect(await token.balanceOf(pump.target)).eq(parseAmount(150000000))
            expect(await token.balanceOf(token.target)).eq(parseAmount(850000000))
        })

        it("Can buy token when create token", async () => {
            const buyFund = parseAmount(0.1)
            const feeInfo = await getBuyFeeData(buyFund)
            
            const buyAmount = await pump.getBuyAmountByValue(0, feeInfo.buyFund);

            const salt = await pump.generateSalt(owner)
            let testToken = await createToken(owner, 'T2', salt, createFee + buyFund)
            testToken = await ethers.getContractAt('Token', testToken.token)
            expect(await testToken.balanceOf(owner)).eq(buyAmount);
        })

        it("Can buy token with bonding curve", async () => {
            const buyFund = parseAmount(0.2)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await pump.getBuyAmountByValue(0, feeInfo.buyFund);

            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, alice, {
                value: buyFund
            })).to.changeTokenBalance(token, alice, buyAmount)
        })

        it("Can buy token by send ETH to token contract", async () => {
            const buyFund = parseAmount(0.2)
            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await pump.getBuyAmountByValue(0, feeInfo.buyFund);

            await expect(bob.sendTransaction({
                to: token.target,
                value: buyFund
            })).to.changeTokenBalance(token, bob, buyAmount)
        })

        it("Can sell token with bonding curve", async () => {
            await token.connect(alice).buyToken(parseAmount(100000000), ethers.ZeroAddress, 0, alice, {
                value: parseAmount(0.1)
            });

            await expect(token.connect(alice).sellToken(parseAmount(10000000), 0, ethers.ZeroAddress, 0))
                .to.changeTokenBalance(token, alice, -parseAmount(10000000))
        })

        it("Can buy token for otherone", async () => {
            const buyFund = parseAmount(0.2)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await pump.getBuyAmountByValue(0, feeInfo.buyFund);

            await expect(token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, bob, {
                value: buyFund
            })).to.changeTokenBalance(token, bob, buyAmount)
        })

        it("Can trade with otherone", async () => {
            const buyFund = parseAmount(0.2)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await pump.getBuyAmountByValue(0, feeInfo.buyFund);
            await token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, alice, {
                value: buyFund
            })

            const transferAmount = parseAmount(100000)

            await expect(token.connect(alice).transfer(bob, transferAmount))
                .to.changeTokenBalances(token, [alice, bob], [-transferAmount, transferAmount])
            
            const tranferAmount2 = parseAmount(5000)

            await expect(token.connect(bob).transfer(carol, tranferAmount2))
                .to.changeTokenBalances(token, [bob, carol], [-tranferAmount2, tranferAmount2])
        })

        it("The bonding curve price calculate need to be correct", async () => {
            const buyFund = parseAmount(0.2)
            await token.connect(alice).buyToken(parseAmount(100000000), ethers.ZeroAddress, 0, alice, {
                value: buyFund
            })
            let supply = await getBondingCurveSupply()

            const price = await pump.getBuyPriceAfterFee(supply, parseAmount(100000000))
            expect(price).eq(277605852434926720n)

            await token.connect(alice).buyToken(parseAmount(100000000), ethers.ZeroAddress, 0, alice, {
                value: 277605852434926720n
            })
            supply = await getBondingCurveSupply()

            const sellPrice = await pump.getSellPriceAfterFee(supply, parseAmount(100000000))
            expect(sellPrice).eq(266612660678503621n)
            expect(price * 9800n / 10000n * 9800n / 10000n).eq(sellPrice)
        })

        it("The sellsman cant purchase token if he did not created ipshare", async () => {
            const buyFund = parseAmount(0.2)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await pump.getBuyAmountByValue(0, feeInfo.buyFund);
            await expect(token.connect(alice).buyToken(buyAmount, bob, 0, alice, {
                value: buyFund
            })).to.be.revertedWithCustomError(token, 'IPShareNotCreated')
        })

        it("Sellsman who created ipshare can purchase token", async () => {
            await ipshare.connect(bob).createShare(ethers.ZeroAddress)

            const buyFund = parseAmount(0.2)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await pump.getBuyAmountByValue(0, feeInfo.buyFund);
            await expect(token.connect(alice).buyToken(buyAmount, bob, 0, alice, {
                value: buyFund
            })).to.changeTokenBalance(token, alice, buyAmount)
        })

        it("Cannt claim social reward", async () => {
            await mine(1000);
            const claimAmount = parseAmount(100);
            const orderId = 23059723523125626n;
            const signature = await getClaimSignature(token.target, orderId, claimAmount, alice.address)

            await expect(pump.connect(alice).userClaim(token, orderId, claimAmount, signature, {
                value: parseAmount(0.01)
            }))
                .to.revertedWithCustomError(token, 'TokenNotListed')
        })

        it("Cannt transfer/read banlance of v3 pool and position manager", async () => {
            const buyFund = parseAmount(0.2)

            const feeInfo = await getBuyFeeData(buyFund)
            const buyAmount = await pump.getBuyAmountByValue(0, feeInfo.buyFund);
            await token.connect(alice).buyToken(buyAmount, ethers.ZeroAddress, 0, alice, {
                value: buyFund
            })

            const transferAmount = parseAmount(10000)
            await expect(token.connect(alice).transfer(pair, transferAmount))
                .to.be.revertedWithCustomError(token, 'TokenNotListed')

            await expect(token.balanceOf(pair))
                .to.be.revertedWithCustomError(token, 'TokenNotListed')
            
            await expect(token.balanceOf(positionManager))
                .to.be.revertedWithCustomError(token, 'TokenNotListed')
        })

        it('Cannt make lp before list', async () => {
            const MintParams = {
                token0: token.target, // USDC 地址
                token1: weth.target, // WETH 地址
                fee: 10000, // 0.3% 池子
                tickLower: -887220, // 全域范围的 tickLower
                tickUpper: 887220, // 全域范围的 tickUpper
                amount0Desired: parseAmount(1000000), // USDC 的数量 (1000 USDC)
                amount1Desired: parseAmount(0.1), // WETH 的数量 (1 WETH)
                amount0Min: 0, // 滑点保护
                amount1Min: 0, // 滑点保护
                recipient: alice.address, // 接收流动性 NFT 的地址
                deadline: Math.floor(Date.now() / 1000) + 60 * 10, // 当前时间戳 + 10 分钟
              };

            await token.connect(alice).buyToken(parseAmount(100000000), ethers.ZeroAddress, 0, alice, {
                value: parseAmount(0.1)
            })

            await token.connect(alice).approve(positionManager.target, parseAmount(100000000))

            try {
                await positionManager.mint(MintParams)
            } catch (error) {
                console.error('cannt provide liquidity before list')
            }
        })
    })

    describe("Token listed", function () {
        let token;
        let pair;
        let createFee;
        beforeEach(async () => {
            createFee = await getCreateFee()
            const salt = await pump.generateSalt(alice);
            token = await createToken(alice, 'T1', salt, createFee);
            token = await ethers.getContractAt('Token', token.token);
            pair = await token.pair();
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

        async function getBondingCurveSupply() {
            return await token.bondingCurveSupply()
        }

        it("Will refund ETH when use buy the tail token", async () => {

        })

        it("The last buyer will make the liquidity pool too", async () => {})

        it('will emit list event with the last buy', async () => {})

        it('The list price is correct', async () => {})

        it('List will cost most of the token in contract', async () => {})
    })

    describe('After token list', function () {
        it("Can trade token to everyone", async () => {})

        it("Can transfer eth to token contract", async () => {})

        it("Can claim curation token", async () => {})

        it('Will revert if the signature is valid', async () => {})

        it('will revert if insufficient claim fee', async () => {})

        it('will refund the left fee back to user', async () => {})

        it('will revert if the claim amount is greater than social pool', async () => {})

        it('will revert if the order has been claimed', async () => {})

        it('will revet if user use the token a signature to claim token b reward', async () => {})

        it('Cannt trade with bonding curve', async () => {})

        it("Can swap token with uniswap", async () => {})

        it("Can provide liquidity outside of the pool", async () => {})

        it("Can get swap fee from uniswap", async () => {})
    })
})