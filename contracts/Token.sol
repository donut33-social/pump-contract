// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { ERC20 } from "./solady/src/tokens/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IToken.sol";

contract Token is IToken, ERC20 {
    string private _name;
    string private _symbol;

    function initialize(string memory name_, string memory symbol_) public override {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory)  {
        return _symbol;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}