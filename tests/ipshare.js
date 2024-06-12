const { deployIPShare } = require('./common')
const { getEthBalacne, parseAmount } = require('./helper')
const { ZeroAddress } = require('ethers')
const { ethers } = require('hardhat')
const { expect } = require('chai')
const { time, loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers')

describe("IPShare", function () {
    let ipshare;
    let donut;
    let owner;
    let alice;
    let bob;
    let carol;
    let subject;
    let donutFeeDestination;
    let createFee = 0;

    async function getSubjectFee(amount) {
        return amount * await ipshare.subjectFeePercent() / 10000n
    }

    async function getProtocolFee(amount) {
        return amount * await ipshare.donutFeePercent() / 10000n
    }

    async function createIPShare(user, amount, price) {
        return ipshare.connect(user).createShare(user, parseAmount(amount), { value: parseAmount(price) })
    }

    async function buyIPShare(subject, buyer, amount) {
        return ipshare.connect(buyer).buyShares(subject, buyer, {
          value: parseAmount(amount),
        });
      }

    async function sellIPShare(subject, seller, share) {
        return ipshare.connect(seller).sellShares(subject, share/* parseAmount(share) */);
    }

    async function stakeIPShare(subject, staker, share) {
        return ipshare.connect(staker).stake(subject, parseAmount(share));
    }

    async function unstakeIPShare(subject, staker, share) {
        return ipshare.connect(staker).unstake(subject, parseAmount(share));
    }
    

    beforeEach(async () => {
       ({
            ipshare,
            donut,
            // users
            owner,
            alice,
            bob,
            carol,
            buyer,
            // fee receivers
            donutFeeDestination,
            subject
        } = await loadFixture(deployIPShare));
    })

    describe('admin', function() {
        describe('adminSetDonut', function() {
            it("will revert if the caller is not the owner", async () => {
                await expect(ipshare.connect(alice).adminSetDonut(donut.address)).to.be
                .revertedWithCustomError(ipshare, 'OwnableUnauthorizedAccount');
            });
        
            it("set donut contract address", async () => {
            await ipshare.connect(owner).adminSetDonut(donut);
            expect(await ipshare.donut()).eq(donut.address);
            })
        })

        describe("admin start trade", function () {
            it("will revert if the caller is not the owner", async () => {
                await expect(ipshare.connect(alice).adminStartTrade()).to.be
                .revertedWithCustomError(ipshare, 'OwnableUnauthorizedAccount');

                expect(await ipshare.startTrade()).eq(false);
            });
        
            it("Start trade", async () => {
            await ipshare.connect(owner).adminStartTrade();
            expect(await ipshare.startTrade()).eq(true);
            })
        })

        describe("admin start fomo3d", function () {
            it("will revert if the caller is not the owner", async () => {
                await expect(ipshare.connect(alice).adminStartFM3D()).to.be
                .revertedWithCustomError(ipshare, 'OwnableUnauthorizedAccount');

                expect(await ipshare.startFM3D()).eq(false);
            });
        
            it("Start fomo 3d", async () => {
                await expect(ipshare.connect(owner).adminStartFM3D()).to.be
                    .revertedWithCustomError(ipshare, 'DonutNotSet');
                await ipshare.connect(owner).adminSetDonut(donut);
                await ipshare.connect(owner).adminStartFM3D();
                expect(await ipshare.startFM3D()).eq(true)
            })
        })  
        
        describe("adminSetSubjectFeePercent", function () {
            it("will revert if the caller is not the owner", async () => {
              await expect(ipshare.connect(alice).adminSetSubjectFeePercent(520)).to.be
              .revertedWithCustomError(ipshare, 'OwnableUnauthorizedAccount');
            })
      
            it("subject fee must not be greater than 10%", async () => {
              await expect(ipshare.connect(owner).adminSetSubjectFeePercent(2000)).
                to.be.revertedWithCustomError(ipshare, 'FeePercentIsTooLarge')
            })
      
            it("set correct fee percentage", async () => {
              const fee = 999;
              await ipshare.connect(owner).adminSetSubjectFeePercent(fee)
              expect(await ipshare.subjectFeePercent()).eq(fee);
            })
          })
      
          describe("adminSetDonutFeePercent", function () {
            it("will revert if the caller is not the owner", async () => {
              await expect(ipshare.connect(alice).adminSetDonutFeePercent(520)).to.be
                .revertedWithCustomError(ipshare, 'OwnableUnauthorizedAccount');
            })
      
            it("donut fee must not be greater than 10%", async () => {
              await expect(ipshare.connect(owner).adminSetDonutFeePercent(2000)).
                to.be.revertedWithCustomError(ipshare, 'FeePercentIsTooLarge')
            })
      
            it("set correct fee percentage", async () => {
              const fee = 999;
              await ipshare.connect(owner).adminSetDonutFeePercent(fee)
              expect(await ipshare.donutFeePercent()).eq(fee);
            })
          })
      
          describe("adminSetDonutFeeDestination:Which address does the fee go to", function () {
            it("will revert if the caller is not the owner", async () => {
              const addr = "0x1234567890123456789012345678901234567890"
              await expect(ipshare.connect(alice).adminSetDonutFeeDestination(addr)).to.be
              .revertedWithCustomError(ipshare, 'OwnableUnauthorizedAccount');
            })
      
            it("set donut fee collector", async () => {
              const addr = "0x1234567890123456789012345678901234567890"
              await ipshare.connect(owner).adminSetDonutFeeDestination(addr)
              expect(await ipshare.donutFeeDestination()).eq(addr)
            })
          })
    })

    describe('before trade', function() {
        it('Everyone can create ipshare', async () => {
            let amount = 0;
            await expect(createIPShare(alice, amount, 5))
                .to.emit(ipshare, "CreateIPshare")
                .withArgs(alice.address, parseAmount(amount + 10), createFee);

            expect(await ipshare.ipshareCreated(alice)).eq(true);

            amount = 10
            await expect(createIPShare(bob, amount, 5))
                .to.emit(ipshare, "CreateIPshare")
                .withArgs(bob.address, parseAmount(amount + 10), createFee);

            expect(await ipshare.ipshareCreated(bob)).eq(true);
        })

        it('Cannt buy and sell shares', async () => {
            await createIPShare(alice, 10, 5);
            await expect(ipshare.connect(bob).buyShares(alice, bob, {
                value: parseAmount(1)
            })).to.be.revertedWithCustomError(ipshare, 'PendingTradeNow')
            await expect(ipshare.connect(alice).buyShares(alice, alice, {
                value: parseAmount(1)
            })).to.be.revertedWithCustomError(ipshare, 'PendingTradeNow')
        })

        it('Can create ipshare for other one', async () => {
            let amount = 1;
            await expect(ipshare.connect(alice).createShare(bob, parseAmount(amount), { value: parseAmount(5) }))
            .to.emit(ipshare, 'CreateIPshare')
            .withArgs(bob.address, parseAmount(amount + 10), createFee);
            expect(await ipshare.ipshareBalance(alice, alice)).eq(0);
            expect(await ipshare.ipshareBalance(alice, bob)).eq(0);
            expect(await ipshare.ipshareCreated(alice)).eq(false);
            expect(await ipshare.ipshareBalance(bob, alice)).eq(0);
            expect(await ipshare.ipshareBalance(bob, bob)).eq(0);
            expect(await ipshare.ipshareSupply(bob)).eq(parseAmount(amount + 10))
        })

        it('Auto stake when create ipshare', async () => {
            let amount = 0;
            await expect(createIPShare(alice, amount, 5))
                .to.emit(ipshare, "CreateIPshare")
                .withArgs(alice.address, parseAmount(amount + 10), createFee);

            expect(await ipshare.ipshareCreated(alice)).eq(true);
            expect(await ipshare.ipshareBalance(alice, alice)).eq(0);
            expect(await ipshare.ipshareSupply(alice)).eq(parseAmount(amount + 10));
            const aliceStakeInfo = await ipshare.getStakerInfo(alice, alice);
            expect(aliceStakeInfo[0]).eq(alice);
            expect(aliceStakeInfo[1]).eq(parseAmount(amount + 10))

            amount = 10
            await expect(createIPShare(bob, amount, 5))
                .to.emit(ipshare, "CreateIPshare")
                .withArgs(bob.address, parseAmount(amount + 10), createFee);

            expect(await ipshare.ipshareCreated(bob)).eq(true);
            expect(await ipshare.ipshareBalance(bob, bob)).eq(0);
            expect(await ipshare.ipshareSupply(bob)).eq(parseAmount(amount + 10));
            const bobStakeInfo = await ipshare.getStakerInfo(bob, bob);
            expect(bobStakeInfo[0]).eq(bob);
            expect(bobStakeInfo[1]).eq(parseAmount(amount + 10))
        })

        it("Can capture value", async () => {
            await createIPShare(subject, 10, 5);
            
        })
    })
})