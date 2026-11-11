import Link from 'next/link';
import { LayoutDashboard, Package, ShoppingCart, Receipt, Pin, Bot, Settings, Megaphone } from 'lucide-react';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/catalogs', label: 'Catalogos', icon: Package },
  { href: '/products', label: 'Produtos', icon: ShoppingCart },
  { href: '/orders', label: 'Pedidos', icon: Receipt },
  { href: '/pins', label: 'Fixadas', icon: Pin },
  { href: '/announce', label: 'Anunciar', icon: Megaphone },
  { href: '/bots', label: 'Bots', icon: Bot },
  { href: '/settings', label: 'Config', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-[#e8e8e8]">
      <aside className="w-64 fixed h-screen overflow-y-auto border-r border-[#2a2a35] bg-[#14141a] p-6 z-20">
        <div className="text-center mb-8 pb-6 border-b border-[#2a2a35]">
          <div className="text-5xl mb-2">&#128058;</div>
          <h1 className="font-bold text-xl text-[#d4af37] tracking-wider">WL7 STORE</h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Setup Bot Control</p>
        </div>
        <nav className="space-y-1">
          {nav.map(item => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-[#1e1e26] transition-colors">
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}

