const { ethers } = require('hardhat')

const TokenContract = '0x68503A15efD0D2F81D185a07d60Ed9Ac2a66B59e'
const WETH = '0x4200000000000000000000000000000000000006';
const wrapUni = '0x3AcC8fC1C54456864A191E5d12Af8A6BDeA57E8E';

async function main() {
    try {
        const [signer] = await ethers.getSigners();
       
        // const token = await ethers.getContractAt('Token', TokenContract)
        // console.log(signer.address, await token.symbol(), await token.balanceOf(signer.address), await token.listed())
        // return;
        // const tx = await token.buyToken(ethers.parseEther('7000000'), ethers.ZeroAddress, 0, '0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac', {
        //     value: ethers.parseEther('0.03')
        // })
        // console.log(tx.hash)
        // await tx.wait()
        
        const uni = await ethers.getContractAt('WrappedUniV2ForTipTag', wrapUni);
        const tx = await uni.buyToken(ethers.ZeroAddress, 0, [WETH, TokenContract], signer.address, Math.floor(Date.now() / 1000) + 300, {
            value: ethers.parseEther('0.0001')
        });
        console.log(tx.hash)
        await tx.wait();
        console.log('ok')
    } catch (error) {
        try {
            console.error(error)
            const errorInterface = errorCode;
            const iface = new ethers.Interface(errorInterface);
            console.log(33, error)
            const decodeError = iface.parseError(error.transaction.data);
            console.log(43, decodeError);
        } catch (e) {
            console.log(453, e)
        }
        return;
    }
}

var errorCode = [
    "error OnlyHumanAllowed()",
    "error IllegalRatios()",
    "error GameIsNotStarted()",
    "error IPShareNotExist()",
    "error InvalidCurrency()",
    "error DonutNotSet()",
    "error PendingTradeNow()",
    "error OnlyDonut()",
    "error OnlyStaker()",
    "error FeePercentIsTooLarge()",
    "error TooMuchFee()",
    "error CanntPauseNow()",
    "error CanntUnpauseNow()",
    "error IPShareAlreadyCreated()",
    "error InsufficientPay()",
    "error RefundFail()",
    "error PayCreateFeeFail()",
    "error IPShareNotExist()",
    "error CostTradeFeeFail()",
    "error CanntSellLast10Shares()",
    "error UnableToSendFunds()",
    "error NoFunds()",
    "error InsufficientShares()",
    "error InUnstakingPeriodNow()",
    "error WrongAmountOrInsufficientStakeAmount()",
    "error NoIPShareToRedeem()",
    "error IPShareIsInlockingPeriodNow()",
    "error NoProfitToClaim()",
    "error TickHasBeenCreated()",
    "error CantBeZeroAddress()",
    "error CantSetSocialDistributionMoreThanTotalSupply()",
    "error TooMuchFee()",
    "error InsufficientCreateFee()",
    "error PreMineTokenFail()",
    "error RefundFail()",
    "error TokenNotListed()",
    "error TokenListed()",
    "error IPShareNotCreated()",
    "error TokenInitialized()",
    "error ClaimOrderExist()",
    "error InvalidSignature()",
    "error InvalidClaimAmount()",
    "error InvalidClaimer()",
    "error OutOfSlippage()",
    "error CreateDexPoolFail()",
    "error InsufficientFund()",
    "error RefundFail()",
    "error CostFeeFail()",
  ]

main().catch(console.error).finally(process.exit)