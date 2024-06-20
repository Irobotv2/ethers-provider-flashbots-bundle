const { ethers } = require('ethers');

// Function to validate and correct address
function validateAndCorrectAddress(address) {
    // Convert to lowercase and trim
    address = address.toLowerCase().trim();

    // Validate and get checksummed address
    try {
        const checksummedAddress = ethers.utils.getAddress(address);
        console.log(`Valid address: ${checksummedAddress}`);
        return checksummedAddress;
    } catch (error) {
        console.error(`Invalid address: ${address}`);
        console.error(`Error: ${error.reason}`);
        return null;
    }
}

// List of addresses to validate
const addresses = [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC (corrected)
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    '0x16e3B07f69fc42eF99bcfb1CE9CA15BEa61e2F97'  // Arbitrage Executor
];

const correctedAddresses = addresses.map(validateAndCorrectAddress);

const [
    WETH_ADDRESS,
    USDC_ADDRESS,
    DAI_ADDRESS,
    ARBITRAGE_EXECUTOR_ADDRESS
] = correctedAddresses;
