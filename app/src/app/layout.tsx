import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { SolanaProviders } from "./providers";
import Link from "next/link";

export const metadata = {
  title: "Aibet",
  description: "VRF-powered double or nothing game on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SolanaProviders>
          <nav className="bg-gray-800 p-4">
            <div className="container mx-auto flex justify-between items-center">
              <div className="flex space-x-4">
                <Link 
                  href="/" 
                  className="text-white hover:text-gray-300"
                >
                  Home
                </Link>
                <Link 
                  href="/admin" 
                  className="text-white hover:text-gray-300"
                >
                  Admin
                </Link>
              </div>
            </div>
          </nav>
          <main className="container mx-auto">
            {children}
          </main>
        </SolanaProviders>
      </body>
    </html>
  );
}