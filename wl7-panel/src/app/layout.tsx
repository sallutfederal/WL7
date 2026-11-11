import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WL7 STORE - Painel',
  description: 'Painel de controle do bot',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-[#0a0a0f] text-[#e8e8e8] antialiased">
        {children}
      </body>
    </html>
  );
}
