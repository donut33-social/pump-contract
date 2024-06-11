// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {ERC20} from "./solady/src/tokens/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IToken.sol";

contract Token is IToken, ERC20 {
    string private _name;
    string private _symbol;
    uint256 public maxSupply;

    // distribute token to social contract
    address public socialDistributionContract;
    uint256 public socialDistributionAmount;
    uint256 distributionPeriod;


    bool public listed = false;
    mapping(string => bool) public registedTick;

    function initialize(
        string memory tick,
        address socialDistributionContract_,
        uint256 socialDistributionAmount_,
        uint256 maxSupply_
    ) public override {
        if (registedTick[tick]) {
            revert TickHasBeenCreated();
        }
        _name = tick;
        _symbol = tick;
        registedTick[tick] = true;
        socialDistributionContract = socialDistributionContract_;
        socialDistributionAmount = socialDistributionAmount_;
        maxSupply = maxSupply_;
        _mint(socialDistributionContract, socialDistributionAmount_);
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function allowance(address owner, address spender) public view override returns (uint256 result) {
        if (!listed) {
            return 0;
        }
        result = super.allowance(owner, spender);
    }

    // only listed token can do erc20 transfer functions
    function _transfer(address from, address to, uint256 amount) internal override {
        if (listed) {
            super._beforeTokenTransfer(from, to, amount);
        }else if (from == socialDistributionContract) {
            super._transfer(from, to, amount);
        }else {
            revert TokenNotListed();
        }
    }

    function _approve(address owner, address spender, uint256 amount) internal override {
        if (listed) {
            super._approve(owner, spender, amount);
        }else {
            revert TokenNotListed();
        }
    }
}
