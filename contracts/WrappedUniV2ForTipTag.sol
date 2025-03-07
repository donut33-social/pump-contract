// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IUniswapV2Router02.sol";
import "./Token.sol";
import "./interface/IIPShare.sol";

contract WrappedUniV2ForTipTag is Ownable {
    IIPShare public ipshare;
    address public uniswapRouter02 = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address public WETH = 0x4200000000000000000000000000000000000006;
    address public feeAddress;

    uint16 public sellsmanRatio = 100;
    uint16 public tagaiRatio = 100;

    constructor(
        address _ipshare,
        address _feeAddress,
        uint16 _sellsmanRatio,
        uint16 _tagaiRatio
    ) Ownable(msg.sender) {
        ipshare = IIPShare(_ipshare);
        feeAddress = _feeAddress;
        sellsmanRatio = _sellsmanRatio;
        tagaiRatio = _tagaiRatio;
    }

    function adminSetFeeRatio(
        uint16 _sellsmanRatio,
        uint16 _tagaiRatio
    ) public onlyOwner {
        require(
            _sellsmanRatio < 1000 && _tagaiRatio < 1000,
            "fee ratio too high"
        );
        sellsmanRatio = _sellsmanRatio;
        tagaiRatio = _tagaiRatio;
    }

    function adminSetIpshare(address addr) public onlyOwner {
        ipshare = IIPShare(addr);
    }

    function adminSetFeeAddress(address addr) public onlyOwner {
        feeAddress = addr;
    }

    function buyToken(
        address sellsman,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) public payable {
        require(path[0] == WETH, "wrong path");
        address _token = path[1];
        Token token = Token(payable(_token));
        if (sellsman == address(0)) {
            sellsman = token.ipshareSubject();
        }
        require(ipshare.ipshareCreated(sellsman), "Not a valid sellsman");
        require(token.listed(), "Token not listed");

        uint256 buyFund = msg.value;

        if (sellsmanRatio > 0) {
            uint256 sellsmanFee = (msg.value * sellsmanRatio) / 10000;
            require(sellsmanFee >= 10000, "Too low fund");
            buyFund = buyFund - sellsmanFee;

            ipshare.valueCapture{value: sellsmanFee}(sellsman);
        }
        if (tagaiRatio > 0) {
            uint256 tagaiFee = (msg.value * tagaiRatio) / 10000;
            require(tagaiFee >= 10000, "Tool low fee");
            buyFund = buyFund - tagaiFee;
            (bool success, ) = feeAddress.call{value: tagaiFee}("");
            require(success, "Pay fee fail");
        }

        IUniswapV2Router02(uniswapRouter02).swapExactETHForTokens{
            value: buyFund
        }(amountOutMin, path, to, deadline);
    }

    function sellToken(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline,
        address sellsman
    ) public {
        require(path[1] == WETH, "wrong path");

        Token token = Token(payable(path[0]));
        if (sellsman == address(0)) {
            sellsman = token.ipshareSubject();
        }

        require(ipshare.ipshareCreated(sellsman), "Not a valid sellsman");
        require(token.listed(), "Token not listed");

        IUniswapV2Router02 univ2 = IUniswapV2Router02(uniswapRouter02);
        uint[] memory amountOuts = univ2.getAmountsOut(amountIn, path);
        require(amountOuts.length > 0, "Failed to get amountOuts");
        require(
            token.approve(uniswapRouter02, amountOuts[0]),
            "Falied approve"
        );

        bool result = token.transferFrom(
            msg.sender,
            address(this),
            amountOuts[0]
        );
        require(result, "Transfer failed");

        uint[] memory amounts = univ2.swapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            address(this),
            deadline
        );
        uint amount = amounts[amounts.length - 1];
        if (sellsmanRatio > 0) {
            uint sellsmanFee = (amounts[amounts.length - 1] * sellsmanRatio) /
                10000;
            amount -= sellsmanFee;
            ipshare.valueCapture{value: sellsmanFee}(sellsman);
        }
        if (tagaiRatio > 0) {
            uint256 tagaiFee = (amounts[amounts.length - 1] * tagaiRatio) /
                10000;
            amount -= tagaiFee;
            (bool res, ) = feeAddress.call{value: tagaiFee}("");
            require(res, "Pay fee fail");
        }
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer to failed");
    }
}
