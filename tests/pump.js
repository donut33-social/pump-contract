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
            token = await ethers.getContractAt('Token', '0xe7f55e411708632e324b8ff6c2fc8fed76a746df')
            const imp = await pump.tokenImplementation(); // 0xa16E02E87b7454126E5E10d957A927A7F5B5d2be
            expect(await token.name()).to.equal('T1')
            expect(await token.symbol()).to.equal('T1')
            expect(await token.decimals()).to.equal(18)
        })

        it("Everyone can create more than one token", async () => {
            let token1 = await pump.connect(alice).createToken('T1', { value: parseAmount(0.01)}); // 0x9e9d8cb3bd6ecb7c439cc903f1d7a3db5f530a41
            let token2 = await pump.connect(alice).createToken('T2', { value: parseAmount(0.01)}); // 0x19b6a1e9c02825bf9f0579f7bdee57891798373f

            token1 = await ethers.getContractAt('Token', '0x9e9d8cb3bd6ecb7c439cc903f1d7a3db5f530a41');
            token2 = await ethers.getContractAt('Token', '0x19b6a1e9c02825bf9f0579f7bdee57891798373f')

            expect(await token1.name()).to.equal('T1')
            expect(await token1.symbol()).to.equal('T1')

            expect(await token2.name()).to.equal('T2')
            expect(await token2.symbol()).to.equal('T2')

            expect(await pump.totalTokens()).to.equal(2);
            expect(await pump.createdTokens('0x9e9d8cb3bd6ecb7c439cc903f1d7a3db5f530a41')).to.equal(true);
            expect(await pump.createdTokens('0x19b6a1e9c02825bf9f0579f7bdee57891798373f')).to.equal(true);
            expect(await pump.createdTokens('0xa16E02E87b7454126E5E10d957A927A7F5B5d2be')).to.equal(false);
        })
    })
})