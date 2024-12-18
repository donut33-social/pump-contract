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
        async function createToken(deployer, tick, salt) {
            return new Promise(async (resolve, reject) => {
                try {
                    pump.on('NewToken', (tick, token) => {
                        resolve({ token, tick })
                    })
                    await sleep(0.1)
                    const trans = await pump.connect(deployer).createToken(tick, salt[0], {
                        value: parseAmount(0.001)
                    });
                } catch (error) {
                    reject(error)
                }
            })
        }
        
        it("should generate token address less than weth", async function () {
            for (let i = 0; i < 10; i++) {
                let salt = await pump.generateSalt(alice);
                const { token, tick } = await createToken(alice, 'T' + i, salt);
                expect(token).to.be.equal(salt[1]);
                expect(BigInt(token)).to.be.lessThan(BigInt(weth.target));
            }

            for (let i = 0; i < 10; i++) {
                let salt = await pump.generateSalt(bob);
                const { token, tick } = await createToken(bob, 'TB' + i, salt);
                expect(token).to.be.equal(salt[1]);
                expect(BigInt(token)).to.be.lessThan(BigInt(weth.target));
            }
        })

        it("Can not create same tick", async function () {
            let salt = await pump.generateSalt(alice);
            await createToken(alice, 'T1', salt); 
            salt = await pump.generateSalt(alice);
            await expect(pump.connect(alice).createToken('T1', salt[0]))
                .to.revertedWithCustomError(pump, 'TickHasBeenCreated');
        })
    })

    describe("Before list", function () {
        it("Can buy token when create token", async () => {
        })

        it("Can buy token with bonding curve", async () => {
        })

        it("Can buy token by send ETH to token contract", async () => {
        })

        it("Can sell token with bonding curve", async () => {
        })

        it("Can buy token for otherone", async () => {
        })

        it("Can trade with otherone", async () => {
        })

        it("The sellsman cant purchase token if he did not created ipshare", async () => {
        })

        it("Sellsman who created ipshare can purchase token", async () => {
        })

        it("Cannt claim social reward", async () => {
        })

        it('Cannt make lp before list', async () => {
        })
    })

    describe("Token listed", function () {
        it("Will refund ETH when use buy the tail token", async () => {
        })

        it("The last buyer will make the liquidity pool too", async () => {})

        it('will emit list event with the last buy', async () => {})
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