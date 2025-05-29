"use client";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import idl from "../aibet.json";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AibetProgram } from "../types/program";
import { PlatformStats } from "../types/accounts";


const LAMPORTS_PER_SOL = 1000000000;

export default function AdminPage() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [program, setProgram] = useState<AibetProgram | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [depositAmount, setDepositAmount] = useState("1");
  const [withdrawAmount, setWithdrawAmount] = useState("1");
  const [platformBalance, setPlatformBalance] = useState<number>(0);

  useEffect(() => {
    if (!publicKey) return;

    const provider = new AnchorProvider(
      connection, 
      { publicKey, signTransaction, signAllTransactions } as any,
      { commitment: "confirmed" }
    );
    const prog = new Program(idl, provider) as unknown as AibetProgram;
    setProgram(prog);

    // Load platform stats
    loadPlatformStats();
  }, [connection, publicKey]);

  const loadPlatformStats = async () => {
    if (!program) return;
    try {
      const accounts = await program.account.platformStats.all();
      if (accounts.length > 0) {
        setPlatformStats(accounts[0].account);
        // Get vault balance
        const balance = await connection.getBalance(accounts[0].publicKey);
        setPlatformBalance(balance / LAMPORTS_PER_SOL);
      }
    } catch (e) {
      console.error("Failed to load platform stats:", e);
    }
  };

  const initializePlatform = async () => {
    if (!program || !publicKey) return;
    try {
      const platformStatsKeypair = web3.Keypair.generate();
      await program.methods
        .initializePlatform()
        .accounts({
          admin: publicKey,
          platformStats: platformStatsKeypair.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([platformStatsKeypair])
        .rpc();

      toast.success("Platform initialized successfully");
      await loadPlatformStats();
    } catch (e) {
      console.error("Failed to initialize platform:", e);
      toast.error("Failed to initialize platform: " + (e as Error).message);
    }
  };

  const handleDeposit = async () => {
    if (!program || !publicKey || !platformStats) return;
    try {
      const lamports = new BN(parseFloat(depositAmount) * LAMPORTS_PER_SOL);
      await program.methods
        .adminDeposit(lamports)
        .accounts({
          admin: publicKey,
          platformVault: platformStats.admin,
        })
        .rpc();
      
      toast.success("Deposit successful");
      await loadPlatformStats();
    } catch (e) {
      toast.error("Deposit failed: " + (e as Error).message);
    }
  };

  const handleWithdraw = async () => {
    if (!program || !publicKey || !platformStats) return;
    try {
      const lamports = new BN(parseFloat(withdrawAmount) * LAMPORTS_PER_SOL);
      await program.methods
        .adminWithdraw(lamports)
        .accounts({
          admin: publicKey,
          platformVault: platformStats.admin,
          platformStats: platformStats.admin,
        })
        .rpc();
      
      toast.success("Withdrawal successful");
      await loadPlatformStats();
    } catch (e) {
      toast.error("Withdrawal failed: " + (e as Error).message);
    }
  };

  return (
    <div className="mt-10 space-y-8 max-w-2xl mx-auto p-4 text-black">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl text-gray-300 font-bold">Admin Panel 🛠️</h1>
        <WalletMultiButton />
      </div>

      {!platformStats ? (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Platform Not Initialized</h2>
          <button 
            onClick={initializePlatform} 
            className="bg-blue-600 px-4 py-2 text-white rounded hover:bg-blue-700"
          >
            Initialize Platform
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Platform Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Platform Balance</p>
                <p className="font-medium">{platformBalance.toFixed(4)} SOL</p>
              </div>
              <div>
                <p className="text-gray-600">Withdrawn Today</p>
                <p className="font-medium">
                  {(platformStats.withdrawnToday.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Deposit</h3>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="border px-2 py-1 rounded w-full mb-2"
              />
              <button
                onClick={handleDeposit}
                className="bg-green-600 px-4 py-2 text-white rounded w-full hover:bg-green-700"
              >
                Deposit SOL
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Withdraw</h3>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="border px-2 py-1 rounded w-full mb-2"
              />
              <button
                onClick={handleWithdraw}
                className="bg-red-600 px-4 py-2 text-white rounded w-full hover:bg-red-700"
              >
                Withdraw SOL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}