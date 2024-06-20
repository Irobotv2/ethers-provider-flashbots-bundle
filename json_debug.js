const https = require('https');
const { ethers, Wallet, providers } = require('ethers');

// Constants
const ETHEREUM_RPC_URL = 'https://virtual.mainnet.rpc.tenderly.co/c4e60e60-6398-4e23-9ffc-f48f66d9706e';
const FLASHBOTS_RELAY_URL = 'relay.flashbots.net';
const PRIVATE_KEY = '03680460bd83d52a2be9932b4b1e1f2251d6d56481eaa23e5f364194ca04fbf3';
const ARBITRAGE_EXECUTOR_ADDRESS = '0x16e3b07f69fc42ef99bcfb1ce9ca15bea61e2f97';

// Initialize provider
const provider = new providers.JsonRpcProvider(ETHEREUM_RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);

async function main() {
    try {
        // Generate an auth signer wallet (not used for transactions)
        const authSigner = Wallet.createRandom();

        // Create multiple transactions
        const transactions = [
            {
                to: ARBITRAGE_EXECUTOR_ADDRESS,
                data: '0x', // Placeholder for encoded data
                value: ethers.utils.parseEther('0').toHexString(), // Ensure value is hex
                gasLimit: ethers.utils.hexlify(100000), // Ensure gasLimit is hex
                gasPrice: ethers.utils.hexlify(ethers.utils.parseUnits('100', 'gwei')), // Ensure gasPrice is hex
                nonce: ethers.utils.hexlify(await provider.getTransactionCount(wallet.address, 'latest'))
            },
            {
                to: ARBITRAGE_EXECUTOR_ADDRESS,
                data: '0x', // Placeholder for encoded data
                value: ethers.utils.parseEther('0').toHexString(), // Ensure value is hex
                gasLimit: ethers.utils.hexlify(100000), // Ensure gasLimit is hex
                gasPrice: ethers.utils.hexlify(ethers.utils.parseUnits('100', 'gwei')), // Ensure gasPrice is hex
                nonce: ethers.utils.hexlify(await provider.getTransactionCount(wallet.address, 'latest') + 1)
            }
            // Add more transactions as needed
        ];

        console.log('Transaction Objects:', transactions);

        // Sign the transactions
        const signedTransactions = await Promise.all(transactions.map(async (tx) => {
            return await wallet.signTransaction(tx);
        }));
        const transactionBundle = signedTransactions.map(signedTransaction => ({ signedTransaction }));

        console.log('Signed Transactions:', signedTransactions);

        // Construct JSON payload
        const blockNumber = await provider.getBlockNumber();
        const targetBlockNumber = ethers.utils.hexStripZeros(ethers.utils.hexlify(blockNumber + 1));
        const payload = {
            method: "eth_sendBundle",
            params: [
                {
                    txs: signedTransactions,
                    blockNumber: targetBlockNumber
                }
            ],
            id: 42,
            jsonrpc: "2.0"
        };

        console.log('Constructed Payload:', payload);

        // Generate the X-Flashbots-Signature header
        const payloadString = JSON.stringify(payload);
        console.log('Payload String:', payloadString);
        const payloadHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(payloadString));
        console.log('Payload Hash:', payloadHash);
        const signature = await authSigner.signMessage(payloadHash);
        console.log('Generated Signature:', signature);

        // Send the request using https
        const options = {
            hostname: FLASHBOTS_RELAY_URL,
            port: 443,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadString),
                'X-Flashbots-Signature': `${authSigner.address}:${signature}`
            }
        };

        console.log('Request Options:', options);

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    console.log('Response:', JSON.parse(data));
                } catch (e) {
                    console.error('Error parsing response:', data);
                }
            });
        });

        req.on('error', (e) => {
            console.error('Request Error:', e);
        });

        req.write(payloadString);
        req.end();

    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch((error) => {
    console.error('Unhandled Error:', error);
});
