// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {ERC20} from "./solady/src/tokens/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IToken.sol";
import "./interface/IIPShare.sol";
import "./interface/IPump.sol";
import "./interface/IUniswapV2Router02.sol";
import "./interface/IUniswapV2Factory.sol";
// import "hardhat/console.sol";

contract Token is IToken, ERC20, ReentrancyGuard {
    string private _name;
    string private _symbol;
    uint256 private constant secondPerDay = 86400;
    uint256 private constant divisor = 10000;

    // distribute token total amount
    uint256 private constant socialDistributionAmount = 1500000 ether;
    uint256 private constant bondingCurveTotalAmount = 7000000 ether;
    uint256 private constant liquidityAmount = 1500000 ether;
    // first 100000 of 7000000 in bonding curve will be locked for 3 days
    uint256 private constant totalLockedInBondingCurvePeriod = 1000000 ether;

    // social distribution - start util the list event
    struct Distribution {
        uint256 amount;
        uint256 startTime;
        uint256 stopTime;
    }
    Distribution[] private distributionEras;
    // last claim to social pool time
    uint256 public lastClaimTime;
    // pending reward in social pool to claim, init 500k to the bonding curve period
    uint256 public pendingClaimSocialRewards = 500000 ether;
    // total claimed reward from social pool
    uint256 public totalClaimedSocialRewards;
    uint256 public unlockTime;

    uint256 public startTime;
    mapping(uint256 => bool) public claimedOrder;
    mapping(address => uint256) public userLockedInBondingCurve;

    // bonding curve
    uint256 public bondingCurveSupply;
    uint256 private constant priceParam = 11.43333333 ether;

    // state
    address private manager;
    address public ipshareSubject;
    bool public listed = false;
    bool initialized = false;

    // dex
    address private WETH = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    address private uniswapV2Factory = 0x6725F303b657a9451d8BA641348b6761A6CC7a17;
    address private uniswapV2Router02 = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;

    address private constant BlackHole = 0x000000000000000000000000000000000000dEaD;
    // 10 - price: 2.041667e-7
    uint256 private constant ethAmountToDex = 10 ether;

    receive() external payable {
        if (!listed) {
            buyToken(0, address(0), 0, address(0));
        }
    }

    function initialize(address manager_, address ipshareSubject_, string memory tick) public override {
        if (initialized) {
            revert TokenInitialized();
        }
        initialized = true;
        manager = manager_;
        ipshareSubject = ipshareSubject_;
        _name = tick;
        _symbol = tick;
        // before dawn of today
        startTime = block.timestamp - (block.timestamp % secondPerDay);
        lastClaimTime = startTime - 1;
        unlockTime = block.timestamp + IPump(manager).getLockTime();
        _mint(address(this), socialDistributionAmount + bondingCurveTotalAmount + liquidityAmount);
    }

    // TODO - del this
    function setUniForTest(address _WETH, address _uniswapV2Factory, address _uniswapV2Router02) public {
        WETH = _WETH;
        uniswapV2Factory = _uniswapV2Factory;
        uniswapV2Router02 = _uniswapV2Router02;
    }

    /********************************** social distribution ********************************/
    function calculateReward(uint256 from, uint256 to) public view returns (uint256 rewards) {
        if (!listed) return 0;
        uint256 rewardedTime = from - 1;
        if (rewardedTime < startTime) {
            rewardedTime = startTime;
        }

        for (uint8 i = 0; i < distributionEras.length; i++) {
            if (rewardedTime > distributionEras[i].stopTime) {
                continue;
            }
            if (to <= distributionEras[i].stopTime) {
                rewards += (to - rewardedTime) * distributionEras[i].amount;
            } else {
                rewards += (distributionEras[i].stopTime - rewardedTime) * distributionEras[i].amount;
            }
        }
    }

    function getCurrentDistibutionEra() public view returns (Distribution memory era) {
        for (uint8 i = 0; i < distributionEras.length; i++) {
            if (block.timestamp >= distributionEras[i].startTime && block.timestamp < distributionEras[i].stopTime) {
                return distributionEras[i];
            }
        }
    }

    function getCurrentRewardPerDay() public view returns (uint256) {
        return getCurrentDistibutionEra().amount * secondPerDay;
    }

    // set distributed rewards can be claimed by user
    function claimPendingSocialRewards() public {
        // calculate rewards
        uint256 rewards = calculateReward(lastClaimTime, block.timestamp);
        if (rewards > 0) {
            pendingClaimSocialRewards += rewards;
            lastClaimTime = block.timestamp;
            emit ClaimDistributedReward(block.timestamp, rewards);
        }
    }

    function userClaim(address token, uint256 orderId, uint256 amount, bytes calldata signature) public payable {
        if (!listed) {
            revert TokenNotListed();
        }
        if (claimedOrder[orderId]) {
            revert ClaimOrderExist();
        }
        if (signature.length != 65) {
            revert InvalidSignature();
        }
        if (token != address(this)) {
            revert InvalidSignature();
        }

        uint256 claimFee = IPump(manager).getClaimFee();
        if (msg.value < claimFee) {
            revert CostFeeFail();
        } else if (msg.value > claimFee) {
            (bool success, ) = msg.sender.call{value: msg.value - claimFee}("");
            if (!success) {
                revert RefundFail();
            }
        } else {
            address receiver = IPump(manager).getFeeReceiver();
            (bool success, ) = receiver.call{value: claimFee}("");
            if (!success) {
                revert CostFeeFail();
            }
        }

        bytes32 data = keccak256(abi.encodePacked(token, orderId, msg.sender, amount));
        if (!_check(data, signature)) {
            revert InvalidSignature();
        }

        if (pendingClaimSocialRewards < amount) {
            claimPendingSocialRewards();
        }

        if (pendingClaimSocialRewards < amount) {
            revert InvalidClaimAmount();
        }

        pendingClaimSocialRewards -= amount;
        totalClaimedSocialRewards += amount;

        claimedOrder[orderId] = true;

        this.transfer(msg.sender, amount);

        emit UserClaimReward(orderId, msg.sender, amount);
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

        uint256 tokenReceived = _getBuyAmountByValue(buyFunds - tiptagFee - sellsmanFee);

        address tiptapFeeAddress = IPump(manager).getFeeReceiver();

        if (tokenReceived + bondingCurveSupply >= bondingCurveTotalAmount) {
            uint256 actualAmount = bondingCurveTotalAmount - bondingCurveSupply;
            // calculate used eth
            uint256 usedEth = getBuyPriceAfterFee(actualAmount);
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

            // update user locked amount
            if (block.timestamp < unlockTime && bondingCurveSupply < totalLockedInBondingCurvePeriod) {
                uint256 needLock = totalLockedInBondingCurvePeriod - bondingCurveSupply;
                if (tokenReceived < needLock) {
                    needLock = tokenReceived;
                }
                userLockedInBondingCurve[receiver] += needLock;
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
        if (sellAmount == 0) revert InsufficientBalance();
        if (block.timestamp < unlockTime && balanceOf(msg.sender) - sellAmount < userLockedInBondingCurve[msg.sender]) {
            if (balanceOf(msg.sender) <= userLockedInBondingCurve[msg.sender]) {
                revert CanntSellLockedToken();
            }
            sellAmount = balanceOf(msg.sender) - userLockedInBondingCurve[msg.sender];
        }
        uint256 afterSupply = 0;
        afterSupply = bondingCurveSupply - sellAmount;
        
        uint256 price = getPrice(afterSupply, sellAmount);

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

    /**
     * calculate the eth price when user buy amount tokens
     */
    function getPrice(uint256 supply, uint256 amount) public pure returns (uint256) {
        uint256 price = amount * (amount ** 2 + 3 * amount * supply + 3 * (supply ** 2));
        return price / priceParam / 3e36;
    }

    function getBuyPrice(uint256 amount) public view returns (uint256) {
        return getPrice(bondingCurveSupply, amount);
    }

    function getSellPrice(uint256 amount) public view returns (uint256) {
        return getPrice(bondingCurveSupply - amount, amount);
    }

    function getBuyPriceAfterFee(uint256 amount) public view returns (uint256) {
        uint256 price = getBuyPrice(amount);
        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        return ((price * divisor) / (divisor - feeRatio[0] - feeRatio[1]));
    }

    function getSellPriceAfterFee(uint256 amount) public view returns (uint256) {
        uint256 price = getSellPrice(amount);
        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        return (price * (divisor - feeRatio[0] - feeRatio[1])) / divisor;
    }

    function _getBuyAmountByValue(uint256 ethAmount) private view returns (uint256) {
        return floorCbrt(ethAmount * priceParam * 3e36 + bondingCurveSupply ** 3) - bondingCurveSupply;
    }

    function getBuyAmountByValue(uint256 ethAmount) public view returns (uint256) {
        uint256 amount = _getBuyAmountByValue(ethAmount);
        if (amount + bondingCurveSupply > bondingCurveTotalAmount) {
            return bondingCurveTotalAmount - bondingCurveSupply;
        }
        return amount;
    }

    function getETHAmountToDex() public view returns (uint256) {
        return getBuyPriceAfterFee(bondingCurveTotalAmount - bondingCurveSupply);
    }

    function floorCbrt(uint256 n) internal pure returns (uint256) {
        unchecked {
            uint256 x = 0;
            for (uint256 y = 1 << 255; y > 0; y >>= 3) {
                x <<= 1;
                uint256 z = 3 * x * (x + 1) + 1;
                if (n / y >= z) {
                    n -= y * z;
                    x += 1;
                }
            }
            return x;
        }
    }

    /********************************** to dex ********************************/
    function _makeLiquidityPool() private {
        _approve(address(this), uniswapV2Router02, liquidityAmount);

        // v2
        // create pair
        IUniswapV2Factory factory = IUniswapV2Factory(uniswapV2Factory);
        IUniswapV2Router02 router = IUniswapV2Router02(uniswapV2Router02);
        address pair = factory.createPair(address(this), WETH);

        router.addLiquidityETH{
            value: address(this).balance
        }(address(this), liquidityAmount, 0, 0, BlackHole, block.timestamp + 300);

        startTime = block.timestamp - (block.timestamp % secondPerDay);
        lastClaimTime = startTime - 1;

        distributionEras.push(
            Distribution({amount: 115740740740740740, startTime: startTime, stopTime: startTime + 100 * 86400})
        );

        emit TokenListedToDex(pair);

        // v3
        // create pool
        // address pool = INonfungiblePositionManager(positionManager).createAndInitializePoolIfNecessary(
        //     address(this),
        //     WETH,
        //     500,
        //     sqrtPrice
        // );

        // if (pool == address(0)) {
        //     revert CreateDexPoolFail();
        // }

        // INonfungiblePositionManager.MintParams memory params
        //     = INonfungiblePositionManager.MintParams({
        //     token0: address(this),
        //     token1: WETH,
        //     fee: 500,
        //     tickLower: -887220,
        //     tickUpper: 887220,
        //     amount0Desired: liquidityAmount,
        //     amount1Desired: ethAmountToDex,
        //     amount0Min: 0,
        //     amount1Min: 0,
        //     recipient: BlackHole,
        //     deadline: block.timestamp
        // });

        // // // add liquidity
        // INonfungiblePositionManager(positionManager).mint{
        //     value: ethAmountToDex
        // }(
        //     params
        // );
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
        if (listed) {
            return super._beforeTokenTransfer(from, to, amount);
        } else if (from == address(this) || to == address(this) || from == address(0)) {
            return super._beforeTokenTransfer(from, to, amount);
        } else {
            revert TokenNotListed();
        }
    }

    function _check(bytes32 data, bytes calldata sign) internal view returns (bool) {
        bytes32 r = abi.decode(sign[:32], (bytes32));
        bytes32 s = abi.decode(sign[32:64], (bytes32));
        uint8 v = uint8(sign[64]);
        if (v < 27) {
            if (v == 0 || v == 1) v += 27;
        }
        bytes memory profix = "\x19Ethereum Signed Message:\n32";
        bytes32 info = keccak256(abi.encodePacked(profix, data));
        address addr = ecrecover(info, v, r, s);
        return addr == IPump(manager).getClaimSigner();
    }
}
