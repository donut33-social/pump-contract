const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { expect } = require('chai');
const { deployPumpFactory, deployIPShare } = require('./common')
const { ethers } = require('hardhat')
const { parseAmount, getEthBalance } = require('./helper')

describe("Pump", function () {
    let owner;
    let alice;
    let bob;
    let socialContract;
    let ipshare;
    let pump
    
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
            pump
        } = await loadFixture(deployPumpFactory));
    })

    it("Deploy factory", function () {
        
    })

    describe("Create token", function () {
        const socialPercent = 1000;
        const maxSupply = parseAmount(1000);

        it("Can create token use factory", async () => {
            let token = await pump.createToken('T1', { value: parseAmount(0.01) })
            token = await ethers.getContractAt('Token', '0x9386272303cd9b9f676d2734abbe38efcf18e54e')
            const imp = await pump.tokenImplementation(); // 0xa16E02E87b7454126E5E10d957A927A7F5B5d2be
            expect(await token.name()).to.equal('T1')
            expect(await token.symbol()).to.equal('T1')
            expect(await token.decimals()).to.equal(18)
        })

        it("Everyone can create more than one token", async () => {
            let token1 = await pump.connect(alice).createToken('T1', { value: parseAmount(0.01)}); // 0x1e186129acd2e299f937b2e8d69dd8df6901df93
            let token2 = await pump.connect(alice).createToken('T2', { value: parseAmount(0.01)}); // 0x922a0b8540f842c2a19e6fad32e3532962c8e5df

            token1 = await ethers.getContractAt('Token', '0x1e186129acd2e299f937b2e8d69dd8df6901df93');
            token2 = await ethers.getContractAt('Token', '0x922a0b8540f842c2a19e6fad32e3532962c8e5df')

            expect(await token1.name()).to.equal('T1')
            expect(await token1.symbol()).to.equal('T1')

            expect(await token2.name()).to.equal('T2')
            expect(await token2.symbol()).to.equal('T2')

            expect(await pump.totalTokens()).to.equal(2);
            expect(await pump.createdTokens('0x1e186129acd2e299f937b2e8d69dd8df6901df93')).to.equal(true);
            expect(await pump.createdTokens('0x922a0b8540f842c2a19e6fad32e3532962c8e5df')).to.equal(true);
            expect(await pump.createdTokens('0xa16E02E87b7454126E5E10d957A927A7F5B5d2be')).to.equal(false);

            expect(await token1.totalSupply()).eq(parseAmount(10000000));
            expect(await token1.balanceOf('0x1e186129acd2e299f937b2e8d69dd8df6901df93')).eq(parseAmount(10000000));
        })


    })
})