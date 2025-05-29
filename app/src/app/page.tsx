"use client";

import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import {
  Rocket,
  DollarSign,
  Moon,
  RotateCcw,
  Coins,
  Wallet,
  History,
  Twitter,
  Send,
} from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "./components/lib/utils";
import Particles from "./components/Particles";
import { motion } from "framer-motion";
import MoonBackground from "./components/moon-background";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, BN, web3 } from "@coral-xyz/anchor";
import idl from "./aibet.json";
import { PublicKey } from "@solana/web3.js";
import { TransactionService } from "./services/transactions";
import { AibetProgram } from "./types/program";
import { Player } from "./types/accounts";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { logo } from "./components/favicon";

export default function Page() {
  const [betAmount, setBetAmount] = useState<number>(0.01);
  const [balance, setBalance] = useState<number>(1.0);
  const [lastResults, setLastResults] = useState<string[]>([]);
  const [showResult, setShowResult] = useState<"win" | "lose" | "">("");
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, signTransaction, signAllTransactions, connected } = wallet;
  const [program, setProgram] = useState<AibetProgram | null>(null);
  const [playerPda, setPlayerPda] = useState<PublicKey | null>(null);
  const [stats, setStats] = useState<Player | null>(null);
  const [betNumber, setBetNumber] = useState<number>(1);
  const [txService, setTxService] = useState<TransactionService | null>(null);

  const programID = new PublicKey("4u7ukPnbiHn8bfYJEftm6Euyrsi2EsBgbACG5J3pmoP2");
  const seed = "playerd";
  const COMMITMENT = "confirmed";

  const platformVault = new PublicKey("8t2SXCwNVTg4zjjhAqo6DP15BWM85Rw4CYmxWn9HJcxv");
  const platformStats = new PublicKey("8V84icV2wjej47759MLLJntjdMqo9bceGs69v7bScEzr");
  const vrfProgramAddress = new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");

  const handleBet = (): void => {
    if (!connected) {
      setErrorMessage("Please connect your wallet first!");
      return;
    }

    if (betAmount <= 0 || betAmount > balance) return;

    setIsSpinning(true);
    setBalance((prev) => prev - betAmount);

    // Clear any previous error messages
    setErrorMessage("");

    setTimeout(() => {
      const win = Math.random() > 0.5;
      const result: "win" | "lose" = win ? "win" : "lose";

      setShowResult(result);
      setLastResults((prev) => [result, ...prev].slice(0, 10));

      if (win) {
        setBalance((prev) => prev + betAmount * 2);
        confetti({
          particleCount: 300,
          spread: 70,
          origin: { y: 0.6 },
          colors: [
            "#f44336", "#e91e63", "#9c27b0", "#673ab7", "#3f51b5", "#2196f3",
            "#03a9f4", "#00bcd4", "#009688", "#4CAF50", "#8BC34A", "#CDDC39",
            "#FFEB3B", "#FFC107", "#FF9800", "#FF5722",
          ],
        });
      }

      setIsSpinning(false);
    }, 1500);
  };

  useEffect(() => {
    if (!publicKey) return;

    const provider = new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions } as any,
      { commitment: "confirmed" }
    );
    const prog = new Program(idl, provider) as unknown as AibetProgram;
    setProgram(prog);

    (async () => {
      const [pda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from(seed), publicKey.toBytes()],
        programID
      );
      setPlayerPda(pda);
    })();
  }, [connection, publicKey]);

  useEffect(() => {
    if (!program || !playerPda || !publicKey) return;
    
    const service = new TransactionService(
      program,
      playerPda,
      publicKey,
      platformVault,
      platformStats,
      vrfProgramAddress
    );
    setTxService(service);
  }, [program, playerPda, publicKey]);

  // Add this function after the other async functions and before the return statement
  const getStats = async () => {
    if (!program || !playerPda) return;
    try {
      const account = await program.account.player.fetch(playerPda);
      setStats(account);
      console.log("Player stats:", account);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
      setErrorMessage("Failed to fetch stats: " + (e as Error).message);
    }
  };

  const initializePlayer = async () => {
    if (!txService) return;
    try {
      await txService.initializePlayer();
      await getStats();
    } catch (e) {
      console.error("Failed to initialize player:", e);
      setErrorMessage("Failed to initialize player: " + (e as Error).message);
    }
  };

  const placeBet = async () => {
    if (!txService) return;
    try {
      setIsSpinning(true);
      await txService.placeBet(betNumber, betAmount.toString());
      await getStats();
    } catch (e) {
      console.error("Failed to place bet:", e);
      setErrorMessage("Failed to place bet: " + (e as Error).message);
    } finally {
      setIsSpinning(false);
    }
  };

  const withdrawWinnings = async () => {
    if (!txService) return;
    try {
      await txService.withdraw();
      await getStats();
    } catch (e) {
      console.error("Failed to withdraw:", e);
      setErrorMessage("Failed to withdraw: " + (e as Error).message);
    }
  };

  // Reset error message after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a3a] text-white overflow-hidden relative">
      {/* Moon background */}
      <MoonBackground />

      <div className="container mx-auto px-4 py-7 relative z-10 h-full">
        <header className="flex justify-between items-center mb-8 sticky top-0">
          <div className="flex items-center gap-2">
            <img src={logo.src} width={50} height={50} alt="Logo" />
            <h1 className="hidden md:block text-xl font-bold bg-gradient-to-r from-gray-100 via-blue-100 to-gray-200 bg-clip-text text-transparent">
              MOONBETS
            </h1>
          </div>

          <div className="flex gap-5 items-center">
            <div className="flex items-center gap-3 ml-4">
              <a
                href="#"
                className="text-blue-300 hover:text-blue-100 transition-colors"
                aria-label="Twitter/X"
              >
                <Twitter size={20} />
              </a>
              <a
                href="#"
                className="text-blue-300 hover:text-blue-100 transition-colors"
                aria-label="Telegram"
              >
                <Send size={20} />
              </a>
            </div>
            <WalletMultiButton />
          </div>
        </header>

        {/* Error message display */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-100 rounded-md text-center">
            {errorMessage}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-y-8 md:gap-8">
          <Card className="lg:col-span-2 bg-black/40 border-blue-500/30 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="relative h-full">
                {/* Background decoration */}
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <div className="w-96 h-96 rounded-full bg-blue-300 blur-3xl"></div>
                </div>

                <div className="relative p-8 flex flex-col items-center justify-center min-h-[400px]">
                  {/* Bet amount input with fancy border */}
                  <div className="mb-8 w-full max-w-xs">
                    <label className="block text-center mb-4 text-xl font-bold text-blue-200">
                      BET AMOUNT
                    </label>
                    <div className="relative">
                      {/* Fancy input border wrapper */}
                      <div className="relative p-[2px] rounded-md overflow-hidden bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-gradient-x">
                        <Input
                          type="text"
                          value={betAmount}
                          onChange={(e: { target: { value: string; }; }) =>
                            setBetAmount(Number.parseFloat(e.target.value) || 0)
                          }
                          className={cn(
                            "text-center text-2xl py-6 bg-black border-0 text-white rounded-[3px]",
                            !connected && "opacity-70"
                          )}
                          min={0.001}
                          max={connected ? balance : 0}
                          step={0.01}
                          disabled={!connected}
                        />
                      </div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300">
                        <Coins className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Result display */}
                  {showResult && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`mb-8 text-4xl font-bold ${
                        showResult === "win" ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {showResult === "win" ? "TO THE MOON!" : "CRASHED!"}
                    </motion.div>
                  )}

                  {/* Enhanced Bet button with more glaring animation */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative cursor-pointer"
                  >
                    {/* Outer glow effect */}
                    <div
                      className="absolute inset-0 rounded-full blur-md"
                      style={{
                        transform: "scale(1.1)",
                      }}
                    />

                    <Button
                      onClick={connected ? placeBet : handleBet}
                      disabled={isSpinning ||
                        betAmount <= 0 ||
                        betAmount > balance ||
                        !connected}
                      className="w-28 h-28 rounded-full text-3xl font-bold shadow-lg transition-all duration-300 relative overflow-hidden z-10"
                      variant="default"
                      size="lg"
                    >
                      {isSpinning ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                          }}
                        >
                          <RotateCcw className="w-10 h-10" />
                        </motion.div>
                      ) : (
                        "BET"
                      )}

                      {/* Enhanced pulsing effect */}
                      {!isSpinning && (
                        <motion.div
                          className="absolute inset-0 rounded-full bg-white"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{
                            opacity: [0, 0.3, 0],
                            scale: [0.8, 1.3, 0.8],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                          }}
                        />
                      )}
                    </Button>
                  </motion.div>

                  {/* Original writeup */}
                  <p className="mt-6 text-gray-400 text-center max-w-xs">
                    Press BET to double or nothing.
                  </p>

                  {/* Wallet connection prompt if needed */}
                  {!connected && (
                    <p className="mt-2 text-blue-300 text-center max-w-xs font-semibold">
                      Connect your wallet to start playing!
                    </p>
                  )}

                  {/* Player stats display */}
                  {stats && (
                    <div className="mt-6 p-3 bg-blue-900/20 rounded-md border border-blue-500/30">
                      <p className="text-blue-200 text-center">
                        Total wins: <span className="text-green-400">{stats.wins?.toString()}</span> | 
                        Losses: <span className="text-red-400">{stats.losses?.toString()}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6 col-span-1">
            {/* Stats card */}
            <Card className="bg-black/40 border-blue-500/30 backdrop-blur-sm">
              <CardContent className="p-3">
                <h2 className="text-xl font-bold mb-4 flex items-center text-blue-300">
                  <Rocket className="w-5 h-5 mr-2" />
                  Game Stats
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/30 p-3 rounded-lg">
                    <div className="text-sm text-gray-400">Moon/Crash</div>
                    <div className="text-xl font-bold">
                      <span className="text-green-400">
                        {lastResults.filter((r) => r === "win").length}
                      </span>
                      /
                      <span className="text-red-400">
                        {lastResults.filter((r) => r === "lose").length}
                      </span>
                    </div>
                  </div>

                  <div className="bg-black/30 p-3 rounded-lg">
                    <div className="text-sm text-gray-400">Total Game</div>
                    <div className="text-xl font-bold text-blue-300">
                      {lastResults.length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* History card */}
            <Card className="bg-black/40 border-blue-500/30 backdrop-blur-sm">
              <CardContent className="p-3">
                <h2 className="text-xl font-bold mb-4 flex items-center text-blue-300">
                  <History className="w-5 h-5 mr-2" />
                  Game History
                </h2>

                <div className="flex flex-wrap gap-2">
                  {lastResults.length > 0 ? (
                    lastResults.map((result, index) => (
                      <div key={index} className="relative">
                        {result === "win" ? (
                          <Moon className="w-6 h-6 text-blue-200 fill-blue-200" />
                        ) : (
                          <Moon className="w-6 h-6 text-red-400" />
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No game yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions card */}
            <Card className="bg-black/40 border-blue-500/30 backdrop-blur-sm">
              <CardContent className="p-3 space-y-3">
                <Button
                  variant="outline"
                  className="w-full border-blue-300 text-blue-300 hover:bg-blue-500/20"
                  disabled={!connected || balance <= 0}
                  onClick={withdrawWinnings}
                  size="default"
                >
                  Withdraw
                </Button>

                {!stats && connected && (
                  <Button
                    variant="outline"
                    className="w-full border-blue-500 text-blue-400 hover:bg-blue-500/20"
                    onClick={initializePlayer}
                    size="default"
                  >
                    Initialize Player
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full border-blue-500 text-blue-400 hover:bg-blue-500/20"
                  onClick={() => connected && setBalance(1.0)}
                  disabled={!connected}
                  size="default"
                >
                  Reset Balance
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Particles />
      </div>
      <footer className="relative z-10 mt-auto border-t border-blue-900/30 bg-black/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <img height={24} width={24} src={logo.src} alt="LOGO" />
              <span className="text-lg font-bold text-blue-200">MOONBETS</span>
            </div>

            <div className="flex items-center gap-6 flex-wrap md:flex-nowrap justify-center">
              <a
                target="_blank"
                rel="noopener noreferrer" 
                href="https://x.com/MOONBETS_"
                className="flex items-center gap-2 text-blue-300 hover:text-blue-100 transition-colors"
                aria-label="Follow us on Twitter/X"
              >
                <Twitter size={18} />
                <span className="text-sm text-nowrap">Follow us on X</span>
              </a>

              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://t.me/MOONBETS_CASINO"
                className="flex items-center gap-2 text-blue-300 hover:text-blue-100 transition-colors"
                aria-label="Join our Telegram"
              >
                <Send size={18} />
                <span className="text-sm text-nowrap">Join Telegram</span>
              </a>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="#"
                className="flex items-center gap-2 text-blue-300 hover:text-blue-100 transition-colors"
              >
                <span className="text-sm">Docs</span>
              </a>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="#"
                className="flex items-center gap-2 text-blue-300 hover:text-blue-100 transition-colors"
              >
                <span className="text-sm text-nowrap">Proof Of Fairness</span>
              </a>
            </div>

            <div className="mt-4 md:mt-0 text-xs text-gray-500">
              &copy; {new Date().getFullYear()} MoonBets. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}