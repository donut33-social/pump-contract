const ethers = require('ethers');
// error TokenNotListed();
// error TokenListed();
// error IPShareNotCreated();
// error TokenInitialized();
// error ClaimOrderExist();
// error InvalidSignature();
// error InvalidClaimAmount();
// error InvalidClaimer();
// error OutOfSlippage();
// error InsufficientFund();
// error RefundFail();
// error CostFeeFail();
// error CreateDexPoolFail();
// Error signature string
const errorSignature = "buyToken()";

// Calculate Keccak-256 hash
const hash = ethers.keccak256(ethers.toUtf8Bytes(errorSignature));

// Get the first 4 bytes (8 hex characters)
const signature = hash.substring(0, 10);

console.log(signature); 