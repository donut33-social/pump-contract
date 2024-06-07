const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { expect } = require('chai');
const { deployFactory } = require('./common')
const { ethers } = require('hardhat')

describe("Pump", function () {
    let owner;
    let alice;
    let bob;
    let factory;
    let socialContract;
    
    beforeEach(async () => {
        ({ 
            owner,
            alice,
            bob,
            carol,
            factory,
            socialContract
        } = await loadFixture(deployFactory));
    })

    function parseEther(n) {
        return BigInt(n) * 1000000000000000000n;
    }

    it("Deploy factory", function () {
        
    })

    describe("Create token", function () {
        const socialPercent = 1000;
        const maxSupply = parseEther(1000);

        it("Can create token use factory", async () => {
            let token = await factory.createToken('T1')
            token = await ethers.getContractAt('Token', '0xbcb2ac9308240f5e5bed2575bae5e50c267c65ef')
            const imp = await factory.tokenImplementation(); // 0xa16E02E87b7454126E5E10d957A927A7F5B5d2be
            expect(await token.name()).to.equal('T1')
            expect(await token.symbol()).to.equal('T1')
            expect(await token.decimals()).to.equal(18)
        })

        it("Everyone can create more than one token", async () => {
            let token1 = await factory.connect(alice).createToken('T1'); // 0xda85071b2cd6af36e463cdaf6ae46dbc8b0d04c7
            let token2 = await factory.connect(alice).createToken('T2'); // 0xdbdf4425d01031e50f76800175880ce10c25ea22

            token1 = await ethers.getContractAt('Token', '0xda85071b2cd6af36e463cdaf6ae46dbc8b0d04c7');
            token2 = await ethers.getContractAt('Token', '0xdbdf4425d01031e50f76800175880ce10c25ea22')

            expect(await token1.name()).to.equal('T1')
            expect(await token1.symbol()).to.equal('T1')

            expect(await token2.name()).to.equal('T2')
            expect(await token2.symbol()).to.equal('T2')

            expect(await factory.totalTokens()).to.equal(2);
            expect(await factory.createdTokens('0xda85071b2cd6af36e463cdaf6ae46dbc8b0d04c7')).to.equal(true);
            expect(await factory.createdTokens('0xdbdf4425d01031e50f76800175880ce10c25ea22')).to.equal(true);
            expect(await factory.createdTokens('0xa16E02E87b7454126E5E10d957A927A7F5B5d2be')).to.equal(false);
        })
    })
})