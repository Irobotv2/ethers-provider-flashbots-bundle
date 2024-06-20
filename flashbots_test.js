const { ethers, Wallet, providers } = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

// Constants
const ETHEREUM_RPC_URL = 'https://virtual.mainnet.rpc.tenderly.co/c4e60e60-6398-4e23-9ffc-f48f66d9706e';
const PRIVATE_KEY = '03680460bd83d52a2be9932b4b1e1f2251d6d56481eaa23e5f364194ca04fbf3';
const ARBITRAGE_EXECUTOR_ADDRESS = '0x16e3b07f69fc42ef99bcfb1ce9ca15bea61e2f97';

// Initialize provider
const provider = new providers.JsonRpcProvider(ETHEREUM_RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);

// Example transaction data
const TRANSACTIONS = [
    {
        to: ARBITRAGE_EXECUTOR_ADDRESS,
        data: null, // Placeholder for encoded data
        value: ethers.utils.parseEther('0'), // Example value
        gasLimit: ethers.utils.hexlify(100000), // Ensure gasLimit is hex
        gasPrice: ethers.utils.hexlify(ethers.utils.parseUnits('100', 'gwei')) // Ensure gasPrice is hex
    }
];

async function main() {
    try {
        // Generate an auth signer wallet (not used for transactions)
        const authSigner = Wallet.createRandom();

        // Create Flashbots provider
        const flashbotsProvider = await FlashbotsBundleProvider.create(
            provider, // Normal ethers.js provider for gas estimations and nonce lookups
            authSigner // Wallet for signing request payloads, not transactions
        );

        // Encode the function call to your arbitrage executor contract
        const abi = [
            "function executeArbitrage(uint256 amount1, uint256 amount2, uint256 amount3)"
        ];
        const contract = new ethers.Contract(ARBITRAGE_EXECUTOR_ADDRESS, abi, wallet);

        TRANSACTIONS[0].data = contract.interface.encodeFunctionData('executeArbitrage', [
            ethers.utils.parseUnits('1000', 18), // Amount1
            ethers.utils.parseUnits('0.1', 18),  // Amount2
            ethers.utils.parseUnits('500', 18)   // Amount3
        ]);

        // Create transaction object and sign it
        const signedTransactions = await Promise.all(TRANSACTIONS.map(async (tx, index) => {
            const transaction = {
                to: tx.to,
                data: tx.data,
                value: tx.value.toHexString(), // Ensure value is hex
                gasLimit: tx.gasLimit, // Already hex
                gasPrice: tx.gasPrice, // Already hex
                nonce: ethers.utils.hexlify(await provider.getTransactionCount(wallet.address, 'latest') + index) // Ensure nonce is hex
            };
            return await wallet.signTransaction(transaction);
        }));

        const transactionBundle = signedTransactions.map(signedTransaction => ({ signedTransaction }));

        // Print out the transaction bundle for debugging
        console.log('Transaction Bundle:', JSON.stringify(transactionBundle, null, 2));

        // Get the current block number and target the next block
        const blockNumber = await provider.getBlockNumber();
        const targetBlockNumber = blockNumber + 1;

        // Simulate the bundle
        const simulation = await flashbotsProvider.simulate(transactionBundle, targetBlockNumber);
        console.log('Simulation:', simulation);

        // Send the bundle
        const result = await flashbotsProvider.sendBundle(transactionBundle, targetBlockNumber);
        console.log('Result:', result);

        // Check bundle status
        const bundleResolution = await result.wait();
        console.log('Bundle Resolution:', bundleResolution);

        // Print transaction hash
        bundleResolution.bundleTransactions.forEach((tx, index) => {
            console.log(`Transaction ${index + 1} Hash:`, tx.hash);
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch((error) => {
    console.error('Unhandled Error:', error);
});
