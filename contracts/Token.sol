// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {ERC20} from "./solady/src/tokens/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IToken.sol";
import "./interface/IIPShare.sol";
import "./interface/IPump.sol";

contract Token is IToken, ERC20, ReentrancyGuard {
    string private _name;
    string private _symbol;
    uint256 private constant secondPerDay = 86400;
    uint256 private constant divisor = 10000;

    // distribute token total amount
    uint256 private constant socialDistributionAmount = 10000000;
    uint256 private constant bondingCurveTotalAmount = 7000000;
    uint256 private constant liquidityAmount = 2000000;

    // social distribution
    struct Distribution {
        uint256 amount;
        uint256 startTime;
        uint256 stopTime;
    }
    Distribution[] private distributionEras;
    uint256 public lastClaimTime;
    uint256 public pendingClaimSocialRewards;
    uint256 public totalClaimedSocialRewards;

    uint256 public startTime;
    mapping(uint256 => bool) private claimedOrder;

    // bonding curve
    uint256 public bondingCurveSupply;
    uint256 private constant priceParam = 640000000;

    // state
    address private manager;
    address public ipshareSubject;
    bool public listed = false;
    bool initialized = false;

    function initialize(address manager_, address ipshareSubject_, string memory tick) public override {
        if (initialized) {
            revert TokenInitialized();
        }
        initialized = true;
        manager = manager_;
        ipshareSubject = ipshareSubject_;
        _name = tick;
        _symbol = tick;
        startTime = block.timestamp - (block.timestamp % secondPerDay);
        _mint(address(this), socialDistributionAmount + bondingCurveTotalAmount + liquidityAmount);
    }

    /********************************** social distribution ********************************/
    function calculateReward(uint256 from, uint256 to) public view returns (uint256 rewards) {
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

    function userClaim(uint256 orderId, uint256 amount, address user, bytes calldata signature) public {
        if (!listed) {
            revert TokenNotListed();
        }
        if (claimedOrder[orderId]) {
            revert ClaimOrderExist();
        }
        if (signature.length != 65) {
            revert InvalidSignature();
        }

        if (msg.sender != user) {
            revert InvalidClaimer();
        }

        bytes32 data = keccak256(abi.encodePacked(orderId, msg.sender, amount));
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

        transfer(msg.sender, amount);

        emit UserClaimReward(orderId, msg.sender, amount);
    }

    /********************************** bonding curve ********************************/
    function buyToken(uint256 expectAmount, address sellsman, uint8 slippage) public payable nonReentrant returns (uint256) {
        sellsman = _checkBondingCurveState(sellsman);

        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        uint256 buyFunds = msg.value;
        uint256 tiptagFee = msg.value * feeRatio[0] / divisor;
        uint256 sellsmanFee = msg.value * feeRatio[1] / divisor;
        
        uint256 tokenReceived = getBuyAmountByValue(buyFunds - tiptagFee - sellsmanFee);
        if (tokenReceived > expectAmount * (divisor + slippage) / divisor 
            || tokenReceived < expectAmount * (divisor - slippage) / divisor) {
            revert OutOfSlippage();
        }

        address tiptapFeeAddress = IPump(manager).getFeeReceiver();

        if (tokenReceived + bondingCurveSupply > bondingCurveTotalAmount) {
            uint256 actualAmount = bondingCurveTotalAmount - bondingCurveSupply;
            // calculate used eth
            uint256 usedEth = getBuyPriceAfterFee(actualAmount);
            if (usedEth > msg.value){
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
            tiptagFee = usedEth * feeRatio[0] / divisor;
            sellsmanFee = usedEth * feeRatio[1] / divisor;

            (bool success1, ) = tiptapFeeAddress.call{value: tiptagFee}("");
            if (!success1) {
                revert CostFeeFail();
            }
            IIPShare(IPump(manager).getIPShare()).valueCapture{value: sellsmanFee}(ipshareSubject);
            transfer(msg.sender, actualAmount);
            bondingCurveSupply += actualAmount;

            emit Trade(
                msg.sender,
                true,
                actualAmount,
                usedEth,
                tiptagFee,
                sellsmanFee
            );
            // build liquidity pool
        } else {

        }
    }

    function sellToken(uint256 amount, address sellsman, uint8 slippage) public nonReentrant {
        sellsman = _checkBondingCurveState(sellsman);
    }

    function _checkBondingCurveState(address sellsman) private returns (address) {
        if (listed) {
            revert TokenListed();
        }
        if (sellsman == address(0)) {
            sellsman = ipshareSubject;
        }else if (!IIPShare(IPump(manager).getIPShare()).ipshareCreated(sellsman)) {
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
        return price * (divisor + feeRatio[0] + feeRatio[1]) / divisor;
    }

    function getSellPriceAfterFee(uint256 amount) public view returns (uint256) {
        uint256 price = getSellPrice(amount);
        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        return price * (divisor - feeRatio[0] - feeRatio[1]) / divisor;
    }

    function getBuyAmountByValue(uint256 ethAmount) public view returns (uint256) {
        return floorCbrt(ethAmount * priceParam * 3e36 + bondingCurveSupply ** 3) - bondingCurveSupply;
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
        } else if (from == address(this)) {
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
