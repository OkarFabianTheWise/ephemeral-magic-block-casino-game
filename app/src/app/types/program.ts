import { Program, Idl, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Player, PlatformStats } from "./accounts";
import { DiceRolledEvent } from "./events";
import { AibetIDL } from "./idl";

export interface AibetProgram extends Program<Idl> {
  account: {
    player: {
      fetch(address: PublicKey): Promise<Player>;
      all(): Promise<{ publicKey: PublicKey; account: Player }[]>;
    };
    platformStats: {
      fetch(address: PublicKey): Promise<PlatformStats>;
      all(): Promise<{ publicKey: PublicKey; account: PlatformStats }[]>;
    };
  };
  methods: {
    initialize(): {
      accounts: {
        payer: PublicKey;
        player: PublicKey;
        systemProgram: PublicKey;
      };
      signers?: PublicKey[];
      rpc(): Promise<string>;
    };
    initializePlatform(): {
      accounts: {
        admin: PublicKey;
        platformStats: PublicKey;
        systemProgram: PublicKey;
      };
      signers?: PublicKey[];
      rpc(): Promise<string>;
    };
    play(
      userChoice: number,
      betAmount: BN,
      clientSeed: number
    ): {
      accounts: {
        payer: PublicKey;
        player: PublicKey;
        platformVault: PublicKey;
        platformStats: PublicKey;
        oracleQueue: PublicKey;
        programIdentity: PublicKey;
        slotHashes: PublicKey;
        vrfProgram: PublicKey;
        systemProgram: PublicKey;
      };
      signers?: PublicKey[];
      rpc(): Promise<string>;
    };
    withdraw(): {
      accounts: {
        payer: PublicKey;
        player: PublicKey;
        platformVault: PublicKey;
      };
      signers?: PublicKey[];
      rpc(): Promise<string>;
    };
    adminWithdraw(amount: BN): {
      accounts: {
        admin: PublicKey;
        platformVault: PublicKey;
        platformStats: PublicKey;
      };
      signers?: PublicKey[];
      rpc(): Promise<string>;
    };
    adminDeposit(amount: BN): {
      accounts: {
        admin: PublicKey;
        platformVault: PublicKey;
      };
      signers?: PublicKey[];
      rpc(): Promise<string>;
    };
  };
  addEventListener(
    eventName: "DiceRolled",
    callback: (event: DiceRolledEvent, slot: number, signature: string) => void
  ): number;
  removeEventListener(listener: number): Promise<void>;
}