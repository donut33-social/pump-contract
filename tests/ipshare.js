const { deployIPShare } = require('./common')
const { getEthBalacne, parseAmount } = require('./helper')
const { ZeroAddress } = require('ethers')
const { ethers } = require('hardhat')
const { expect } = require('chai')
const { time, loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers')

describe("IPShare", function () {
    let ipshare;
    let theFan;
    let owner;
    let alice;
    let bob;
    let carol;
    let subject;
    let theFanFeeDestination;
    let createFee = 1000000000000000;

    async function getSubjectFee(amount) {
        return amount * await ipshare.subjectFeePercent() / 10000n
    }

    async function getProtocolFee(amount) {
        return amount * await ipshare.theFanFeePercent() / 10000n
    }

    async function createIPShare(user, amount, price) {
        return ipshare.connect(user).createShare(user, amount, {
            value: parseAmount(price)
        })
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
            theFan,
            // users
            owner,
            alice,
            bob,
            carol,
            buyer,
            // fee receivers
            theFanFeeDestination,
            subject
        } = await loadFixture(deployIPShare));
    })

    describe('admin', function() {
        describe('adminSetTheFan', function() {
            it("will revert if the caller is not the owner", async () => {
                await expect(ipshare.connect(alice).adminSetTheFan(theFan.address)).to.be
                .revertedWithCustomError(ipshare, 'OwnableUnauthorizedAccount');
            });
        
            it("set theFan contract address", async () => {
            await ipshare.connect(owner).adminSetTheFan(theFan);
            expect(await ipshare.theFan()).eq(theFan.address);
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
      
          describe("adminSetTheFanFeePercent", function () {
            it("will revert if the caller is not the owner", async () => {
              await expect(ipshare.connect(alice).adminSetTheFanFeePercent(520)).to.be
                .revertedWithCustomError(ipshare, 'OwnableUnauthorizedAccount');
            })
      
            it("TheFan fee must not be greater than 10%", async () => {
              await expect(ipshare.connect(owner).adminSetTheFanFeePercent(2000)).
                to.be.revertedWithCustomError(ipshare, 'FeePercentIsTooLarge')
            })
      
            it("set correct fee percentage", async () => {
              const fee = 999;
              await ipshare.connect(owner).adminSetTheFanFeePercent(fee)
              expect(await ipshare.theFanFeePercent()).eq(fee);
            })
          })
      
          describe("adminSetTheFanFeeDestination:Which address does the fee go to", function () {
            it("will revert if the caller is not the owner", async () => {
              const addr = "0x1234567890123456789012345678901234567890"
              await expect(ipshare.connect(alice).adminSetTheFanFeeDestination(addr)).to.be
              .revertedWithCustomError(ipshare, 'OwnableUnauthorizedAccount');
            })
      
            it("set TheFan fee collector", async () => {
              const addr = "0x1234567890123456789012345678901234567890"
              await ipshare.connect(owner).adminSetTheFanFeeDestination(addr)
              expect(await ipshare.theFanFeeDestination()).eq(addr)
            })
          })
    })

    describe('Start trade', function() {
        beforeEach(async () => {
            await createIPShare(subject, 0, '0.001')
        })

        it('Can buy and sell shares', async () => {
            // buyer,
            // subject,
            // true,
            // ipshareReceived,
            // buyFunds,
            // theFanFee,
            // subjectFee,
            // supply + ipshareReceived
            await expect(buyIPShare(subject, alice, 0.01))
                .to.emit(ipshare, 'Trade')
                .withArgs(
                    alice,
                    subject,
                    true,
                    25736762993503133133n,
                    10000000000000000n,
                    250000000000000n,
                    450000000000000n,
                    35736762993503133133n
                )

            await expect(sellIPShare(subject, alice, parseAmount(10)))
                .to.emit(ipshare, 'Trade')
                .withArgs(
                    alice,
                    subject,
                    false,
                    10000000000000000000n,
                    5956762079075731n,
                    148919051976893n,
                    268054293558407n,
                    25736762993503133133n
                )
        })

        it('Can stake and unstake shares', async () => {
            await buyIPShare(subject, alice, 0.1)
            await expect(ipshare.connect(alice).stake(subject, parseAmount(30)))
                .to.emit(ipshare, 'Stake')
                .withArgs(alice, subject, true, parseAmount(30), parseAmount(30))
            await expect(ipshare.connect(alice).stake(subject, parseAmount(20)))
                .to.emit(ipshare, 'Stake')
                .withArgs(alice, subject, true, parseAmount(20), parseAmount(50))

            await expect(ipshare.connect(alice).unstake(subject, parseAmount(10)))
                .to.emit(ipshare, 'Stake')
                .withArgs(alice, subject, false, parseAmount(10), parseAmount(40))

            await time.increase(86400 * 8)
            // redeem
            const balanceBefore = await ipshare.ipshareBalance(subject, alice)
            await ipshare.connect(alice).redeem(subject)
            const balanceAfter = await ipshare.ipshareBalance(subject, alice)
            expect(balanceBefore + parseAmount(10)).eq(balanceAfter)
        })

        it("Can capture value and claim reward", async () => {
            await buyIPShare(subject, alice, 0.1)
            await ipshare.connect(alice).stake(subject, parseAmount(10))
            await expect(ipshare.valueCapture(subject, {
                value: parseAmount(0.1)
            })).to.emit(ipshare, 'ValueCaptured')
            .withArgs(subject, owner, parseAmount(0.1))

            const sbb = await ipshare.ipshareBalance(subject, subject)
            const abb = await ipshare.ipshareBalance(subject, alice)

            await expect(ipshare.connect(subject).claim(subject))
                .to.revertedWithCustomError(ipshare, 'OnlyStaker')
            await ipshare.connect(alice).claim(subject)

            const sba = await ipshare.ipshareBalance(subject, subject)
            const aba = await ipshare.ipshareBalance(subject, alice)
            
            expect(sba).eq(sbb)
            expect(aba).gt(abb)
            // expect((sba - sbb) / (aba - abb)).eq(1)
            // console.log(sba - sbb, aba - abb)
        })
    })
})