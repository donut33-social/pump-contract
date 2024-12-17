// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {ERC20} from "./solady/src/tokens/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IToken.sol";
import "./interface/IIPShare.sol";
import "./interface/IPump.sol";
import "./interface/IUniswapV2Router02.sol";
import "./interface/IUniswapV3Factory.sol";
import "./interface/IBondingCurve.sol";
import "./interface/INonfungiblePositionManager.sol";

contract Token is IToken, ERC20, ReentrancyGuard {
    string private _name;
    string private _symbol;
    uint256 private constant divisor = 10000;

    // distribute token total amount
    uint256 private constant socialDistributionAmount = 150000000 ether;
    uint256 private constant bondingCurveTotalAmount = 650000000 ether;
    uint256 private constant liquidityAmount = 200000000 ether;

    uint256 private bondingCurveSupply = 0;

    // last claim to social pool time
    uint256 public lastClaimTime;
    // pending reward in social pool to claim, init 50m to the bonding curve period
    uint256 public pendingClaimSocialRewards = 50000000 ether;
    // total claimed reward from social pool
    uint256 public totalClaimedSocialRewards;

    uint256 public startTime;
    mapping(uint256 => bool) public claimedOrder;

    // state
    address private manager;
    address public ipshareSubject;
    IBondingCurve public bondingCurve;
    bool public listed = false;
    bool initialized = false;

    // dex
    address private pair;
    address private WETH = 0x4200000000000000000000000000000000000006;
    // 200000000 token and 4.546377500541374 ether price for uni v3
    uint160 private sqrtPriceX96 = 11945307467447461835399701;

    IUniswapV3Factory public uniswapV3Factory 
        = IUniswapV3Factory(0x33128a8fC17869897dcE68Ed026d694621f6FDfD);
        
    INonfungiblePositionManager public positionManager 
        = INonfungiblePositionManager(0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1);

    receive() external payable {
        if (!listed) {
            buyToken(0, address(0), 0, address(0));
        }
    }

    function initialize(
        address manager_, 
        address ipshareSubject_, 
        string memory tick) public {
        if (initialized) {
            revert TokenInitialized();
        }
        initialized = true;
        manager = manager_;
        ipshareSubject = ipshareSubject_;
        bondingCurve = IBondingCurve(manager_);
        _name = tick;
        _symbol = tick;
        _mint(address(this), bondingCurveTotalAmount + liquidityAmount);
        _mint(address(manager), socialDistributionAmount);

        // create v3 pool and set price
        pair = uniswapV3Factory.createPool(address(this), WETH, 10000);
        IUniswapV3Factory(pair).initialize(sqrtPriceX96);
    }

    /********************************** bonding curve ********************************/
    function buyToken(
        uint256 expectAmount,
        address sellsman,
        uint16 slippage,
        address receiver
    ) public payable nonReentrant returns (uint256) {
        sellsman = _checkBondingCurveState(sellsman);
        if (receiver == address(0)) {
            receiver = tx.origin;
        }
        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        uint256 buyFunds = msg.value;
        uint256 tiptagFee = (msg.value * feeRatio[0]) / divisor;
        uint256 sellsmanFee = (msg.value * feeRatio[1]) / divisor;

        uint256 tokenReceived = bondingCurve
            .getBuyAmountByValue(bondingCurveSupply, buyFunds - tiptagFee - sellsmanFee);

        address tiptapFeeAddress = IPump(manager).getFeeReceiver();

        if (tokenReceived + bondingCurveSupply >= bondingCurveTotalAmount) {
            uint256 actualAmount = bondingCurveTotalAmount - bondingCurveSupply;
            // calculate used eth
            uint256 usedEth = bondingCurve.getBuyPriceAfterFee(bondingCurveSupply,actualAmount);
            if (usedEth > msg.value) {
                revert InsufficientFund();
            }
            if (usedEth < msg.value) {
                // refund
                (bool success, ) = msg.sender.call{value: msg.value - usedEth}("");
                if (!success) {
                    revert RefundFail();
                }
            }

            buyFunds = usedEth;
            tiptagFee = (usedEth * feeRatio[0]) / divisor;
            sellsmanFee = (usedEth * feeRatio[1]) / divisor;

            (bool success1, ) = tiptapFeeAddress.call{value: tiptagFee}("");
            if (!success1) {
                revert CostFeeFail();
            }
            IIPShare(IPump(manager).getIPShare()).valueCapture{value: sellsmanFee}(sellsman);
            this.transfer(receiver, actualAmount);
            bondingCurveSupply += actualAmount;

            emit Trade(receiver, sellsman, true, actualAmount, usedEth, tiptagFee, sellsmanFee);
            // build liquidity pool
            _makeLiquidityPool();
            listed = true;
            return actualAmount;
        } else {
            if (
                slippage > 0 &&
                (tokenReceived > (expectAmount * (divisor + slippage)) / divisor ||
                    tokenReceived < (expectAmount * (divisor - slippage)) / divisor)
            ) {
                revert OutOfSlippage();
            }

            (bool success, ) = tiptapFeeAddress.call{value: tiptagFee}("");
            if (!success) {
                revert CostFeeFail();
            }

            IIPShare(IPump(manager).getIPShare()).valueCapture{value: sellsmanFee}(sellsman);
            this.transfer(receiver, tokenReceived);
            bondingCurveSupply += tokenReceived;
            emit Trade(receiver, sellsman, true, tokenReceived, msg.value, tiptagFee, sellsmanFee);
            return tokenReceived;
        }
    }

    function sellToken(uint256 amount, uint256 expectReceive, address sellsman, uint16 slippage) public nonReentrant {
        sellsman = _checkBondingCurveState(sellsman);

        uint256 sellAmount = amount;
        if (balanceOf(msg.sender) < sellAmount) {
            sellAmount = balanceOf(msg.sender);
        }
        
        if (sellAmount < 100000000) {
            revert DustIssue();
        }
        uint256 afterSupply = 0;
        afterSupply = bondingCurveSupply - sellAmount;
        
        uint256 price = bondingCurve.getPrice(afterSupply, sellAmount);

        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        address tiptagFeeAddress = IPump(manager).getFeeReceiver();

        uint256 tiptagFee = (price * feeRatio[0]) / divisor;
        uint256 sellsmanFee = (price * feeRatio[1]) / divisor;
        uint256 receivedEth = price - tiptagFee - sellsmanFee;

        if (
            expectReceive > 0 &&
            slippage > 0 &&
            (receivedEth > ((divisor + slippage) * expectReceive) / divisor ||
                receivedEth < ((divisor - slippage) * expectReceive) / divisor)
        ) {
            revert OutOfSlippage();
        }

        transfer(address(this), sellAmount);

        {
            (bool success1, ) = tiptagFeeAddress.call{value: tiptagFee}("");
            (bool success2, ) = msg.sender.call{value: receivedEth}("");
            if (!success1 || !success2) {
                revert RefundFail();
            }
        }

        IIPShare(IPump(manager).getIPShare()).valueCapture{value: sellsmanFee}(sellsman);
        bondingCurveSupply -= sellAmount;

        emit Trade(msg.sender, sellsman, false, sellAmount, price, tiptagFee, sellsmanFee);
    }

    function _checkBondingCurveState(address sellsman) private returns (address) {
        if (listed) {
            revert TokenListed();
        }
        if (sellsman == address(0)) {
            sellsman = ipshareSubject;
        } else if (!IIPShare(IPump(manager).getIPShare()).ipshareCreated(sellsman)) {
            revert IPShareNotCreated();
        }
        return sellsman;
    }

    /********************************** to dex ********************************/
    function _makeLiquidityPool() private {
        
    }

    /********************************** erc20 function ********************************/
    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    // only listed token can do erc20 transfer functions
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        if  (!listed && to == pair && from != address(this)) {
            revert TokenNotListed();
        }
        return super._beforeTokenTransfer(from, to, amount);
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (listed) {
            return super.balanceOf(account);
        }
        if (account == pair || account == address(positionManager)) {
            revert TokenNotListed();
        }
        return super.balanceOf(account);
    }
}
