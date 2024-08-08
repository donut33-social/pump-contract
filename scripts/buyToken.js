const { ethers } = require('hardhat')

const TokenContract = '0xb7471efd68791A26e2eC4422D9eABd9c2FFfD088'

async function main() {
    try {
        const [signer] = await ethers.getSigners();
       
        const token = await ethers.getContractAt('Token', TokenContract)
        console.log(signer.address, await token.symbol(), await token.balanceOf(signer.address), await token.listed())
        return;
        const tx = await token.buyToken(ethers.parseEther('7000000'), ethers.ZeroAddress, 0, '0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac', {
            value: ethers.parseEther('0.03')
        })
        console.log(tx.hash)
        await tx.wait()
    } catch (error) {
        try {
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