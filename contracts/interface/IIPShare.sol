// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

interface IIPShare {
    function valueCapture(address subject) external payable;
    function createShare(address subject, uint256 amount) external payable;
    function ipshareCreated(address subject) external returns (bool);
    function buyShares(address subject, address buyer) external payable returns (uint256);
    function sellShares(address subject, uint256 shareAmount) external;
    function getPendingProfits(address subject, address staker) external view returns (uint256);
    function getMaxStaker(address subject) external view returns (address, uint256);
    function getPrice(uint256 supply,uint256 amount) external pure returns (uint256);
    function getBuyPrice(address subject, uint256 amount) external view returns (uint256);
    function getSellPrice(address subject, uint256 amount) external view returns (uint256);
    function getBuyPriceAfterFee(address subject, uint256 amount) external view returns (uint256);
    function getSellPriceAfterFee(address subject, uint256 amount) external view returns (uint256);
    function getBuyAmountByValue(uint256 supply, uint256 ethAmount) external pure returns (uint256);

    error OnlyDonut();
    error DonutNotSet();
    error PendingTradeNow();
    error OnlyStaker();
    error FeePercentIsTooLarge();
    error TooMuchFee();
    error CanntPauseNow();
    error CanntUnpauseNow();
    error IPShareAlreadyCreated();
    error InsufficientPay();
    error RefundFail();
    error PayCreateFeeFail();
    error IPShareNotExist();
    error CostTradeFeeFail();
    error CanntSellLast10Shares();
    error UnableToSendFunds();
    error NoFunds();
    error InsufficientShares();
    error InUnstakingPeriodNow();
    error WrongAmountOrInsufficientStakeAmount();
    error NoIPShareToRedeem();
    error IPShareIsInlockingPeriodNow();
    error NoProfitToClaim();
}